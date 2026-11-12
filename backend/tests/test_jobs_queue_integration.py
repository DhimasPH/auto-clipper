"""Every job thread goes through the queue; queued jobs can be seen and cancelled."""
import inspect
import threading
import time

import pytest

from backend import jobs


def _wait_until(predicate, timeout=5.0):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if predicate():
            return True
        time.sleep(0.01)
    return False


@pytest.fixture
def no_db(monkeypatch):
    monkeypatch.setattr("backend.db.save_history", lambda *a, **k: None)
    monkeypatch.setattr("backend.db.get_all_history", lambda: [])


def _history(tmp_path, **meta):
    src = tmp_path / "source.mp4"
    src.write_bytes(b"x")
    metadata = {"source_video": str(src), "subtitle_path": str(src), "title": "Queued project", "output_dir": str(tmp_path)}
    metadata.update(meta)
    return {
        "id": "hist-1", "url": "https://youtu.be/x", "status": "ERROR", "metadata": metadata,
        "result_clips": [{"path": str(tmp_path / "c.mp4"), "start": "00:00:00", "end": "00:00:05"}],
    }


def test_jobs_module_creates_no_thread_outside_the_queue():
    assert "threading.Thread(" not in inspect.getsource(jobs)


def test_every_job_creation_path_submits_to_the_queue(tmp_path, monkeypatch, no_db):
    history = _history(tmp_path)
    monkeypatch.setattr("backend.db.get_history", lambda j: history)
    submitted = []
    monkeypatch.setattr(jobs.job_queue, "submit", lambda job_id, target, args=(), on_wait=None: submitted.append(args[1].__name__))

    def finish_all():
        for job in jobs.active_jobs.values():
            job["status"] = "DONE"

    jobs.create_job("https://youtu.be/x", "openai", "k", title="Queue A")
    finish_all()
    jobs.create_manual_job("https://youtu.be/x", [], title="Queue B")
    finish_all()
    jobs.create_rerender_job("hist-1", "9:16", False, "")
    finish_all()
    jobs.create_rerun_ai_job("hist-1", "openai", "k", "9:16", False, "", "")
    finish_all()
    jobs.create_rerender_clip_job("hist-1", 0, [], "9:16", "standard", False)
    finish_all()
    jobs.resume_manual_job("hist-1", '[{"start_time": "00:00:00", "end_time": "00:00:04", "description": "x"}]')
    finish_all()
    jobs.create_resume_job("hist-1")

    assert submitted == [
        "_run_job", "_run_manual_job", "_run_rerender_job", "_run_rerun_ai_job",
        "_run_rerender_clip_job", "_run_manual_resume_job", "_run_resume_job",
    ]


def _occupy_slot():
    """Hold the only heavy slot the way a job that is still winding down does."""
    gate = threading.Event()
    started = threading.Event()

    def linger():
        started.set()
        gate.wait(5)

    jobs.job_queue.submit("lingering-job", linger)
    assert started.wait(5)
    return gate


def test_job_created_while_another_holds_the_slot_waits_in_line(monkeypatch, no_db):
    ran = []
    monkeypatch.setattr(jobs, "_run_manual_job", lambda job_id: ran.append(job_id))
    gate = _occupy_slot()

    job_id = jobs.create_manual_job("https://youtu.be/x", [], title="Waiting project")
    assert _wait_until(lambda: "Menunggu" in jobs.active_jobs[job_id]["progress"])
    assert jobs.job_queue.position(job_id) == 1
    assert ran == []

    gate.set()
    assert _wait_until(lambda: ran == [job_id])


def test_cancelling_a_queued_job_removes_it_and_it_never_runs(monkeypatch, no_db):
    ran = []
    monkeypatch.setattr(jobs, "_run_manual_job", lambda job_id: ran.append(job_id))
    gate = _occupy_slot()

    job_id = jobs.create_manual_job("https://youtu.be/x", [], title="Cancelled while waiting")
    assert _wait_until(lambda: jobs.job_queue.position(job_id) == 1)

    jobs.cancel_job(job_id)
    assert jobs.job_queue.position(job_id) is None
    assert jobs.active_jobs[job_id]["status"] == "CANCELLED"
    assert jobs.active_jobs[job_id]["cancelled"] is True

    gate.set()
    assert _wait_until(lambda: jobs.job_queue.position("lingering-job") is None)
    time.sleep(0.1)
    assert ran == []


def test_slot_is_released_when_a_job_fails(tmp_path, monkeypatch, no_db):
    def failing_download(*a, **k):
        raise RuntimeError("download failed")

    monkeypatch.setattr(jobs, "download_youtube_video", failing_download)
    first = jobs.create_manual_job("https://youtu.be/x", [], title="Failing project", output_dir=str(tmp_path))
    assert _wait_until(lambda: jobs.active_jobs[first]["status"] == "ERROR")
    assert _wait_until(lambda: jobs.job_queue.position(first) is None)

    ran = []
    monkeypatch.setattr(jobs, "_run_manual_job", lambda job_id: ran.append(job_id))
    second = jobs.create_manual_job("https://youtu.be/y", [], title="Next project", output_dir=str(tmp_path))
    assert _wait_until(lambda: ran == [second])


def test_second_resume_of_the_same_project_is_rejected_with_a_clear_message(tmp_path, monkeypatch, no_db):
    history = _history(tmp_path)
    monkeypatch.setattr("backend.db.get_history", lambda j: history)
    monkeypatch.setattr("threading.Thread.start", lambda self: None)

    jobs.create_resume_job("hist-1")
    with pytest.raises(ValueError, match="masih diproses"):
        jobs.create_resume_job("hist-1")


def test_resume_is_rejected_while_the_job_itself_is_still_running(tmp_path, monkeypatch, no_db):
    history = _history(tmp_path)
    monkeypatch.setattr("backend.db.get_history", lambda j: history)
    jobs.active_jobs["hist-1"] = {"id": "hist-1", "status": "CROPPING", "cancelled": False, "clips": []}

    with pytest.raises(ValueError, match="masih diproses"):
        jobs.create_resume_job("hist-1")
    with pytest.raises(ValueError, match="masih diproses"):
        jobs.resume_manual_job("hist-1", '[{"start_time": "00:00:00", "end_time": "00:00:04", "description": "x"}]')
    assert jobs.active_jobs["hist-1"]["status"] == "CROPPING", "the running job must not be overwritten"


def test_resume_is_allowed_again_after_the_first_resume_finished(tmp_path, monkeypatch, no_db):
    history = _history(tmp_path)
    monkeypatch.setattr("backend.db.get_history", lambda j: history)
    monkeypatch.setattr(jobs.job_queue, "submit", lambda *a, **k: None)

    first = jobs.create_resume_job("hist-1")
    jobs.active_jobs[first]["status"] = "ERROR"
    second = jobs.create_resume_job("hist-1")
    assert second != first


def test_resume_endpoint_reports_the_duplicate_as_a_plain_message(tmp_path, monkeypatch, no_db):
    from fastapi.testclient import TestClient
    from backend.main import app

    history = _history(tmp_path)
    monkeypatch.setattr("backend.db.get_history", lambda j: history)
    # Not threading.Thread.start: the test client needs real threads.
    monkeypatch.setattr(jobs.job_queue, "submit", lambda *a, **k: None)
    client = TestClient(app)

    assert client.post("/jobs/hist-1/resume", json={}).status_code == 200
    r = client.post("/jobs/hist-1/resume", json={})
    assert r.status_code == 400
    assert "masih diproses" in r.json()["message"]


def test_job_status_endpoint_reports_queue_position(monkeypatch, no_db):
    from fastapi.testclient import TestClient
    from backend.main import app

    monkeypatch.setattr(jobs, "_run_manual_job", lambda job_id: None)
    gate = _occupy_slot()
    client = TestClient(app)

    job_id = jobs.create_manual_job("https://youtu.be/x", [], title="Position project")
    assert _wait_until(lambda: jobs.job_queue.position(job_id) == 1)
    assert client.get(f"/jobs/{job_id}").json()["queue_position"] == 1

    gate.set()
    assert _wait_until(lambda: jobs.job_queue.position(job_id) is None)
    assert client.get(f"/jobs/{job_id}").json()["queue_position"] is None
