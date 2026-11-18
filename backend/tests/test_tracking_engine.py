"""The face tracking engine a project was made with survives into its re-renders.

Before: the engine was never written to the project metadata, and the rerender
and AI re-run jobs dropped it, so they always tracked with Haar.
"""
import pytest

from backend import jobs


@pytest.fixture
def no_side_effects(monkeypatch):
    saved = []
    started = []
    monkeypatch.setattr(jobs, "is_any_job_running", lambda: False)
    monkeypatch.setattr(jobs, "save_history", lambda *a, **k: saved.append(a))
    monkeypatch.setattr(jobs, "_start_job", lambda job_id, *a, **k: started.append(job_id))
    yield {"saved": saved, "started": started}
    for job_id in started:
        jobs.active_jobs.pop(job_id, None)


def _history(engine=None, tracking_mode=None):
    meta = {"title": "T", "source_video": "/tmp/source.mp4"}
    if engine:
        meta["face_tracking_engine"] = engine
    if tracking_mode:
        meta["tracking_mode"] = tracking_mode
    return {"id": "hist-1", "url": "https://youtu.be/x", "result_clips": [], "caption_style": "standard", "metadata": meta}


def test_finished_job_records_its_tracking_choices_in_the_metadata(monkeypatch):
    saved = []
    monkeypatch.setattr("backend.db.save_history", lambda job_id, url, status, clips, metadata: saved.append(metadata))
    monkeypatch.setattr(jobs, "_publish", lambda job, metadata, final=False: [])
    jobs.active_jobs["job-eng"] = {
        "id": "job-eng", "url": "https://youtu.be/x", "status": "CROPPING", "clips": [], "cancelled": False,
        "mode": "ai", "tracking_mode": "auto", "face_tracking_engine": "mediapipe",
    }
    try:
        jobs._finalize_job("job-eng", "DONE", {})
    finally:
        jobs.active_jobs.pop("job-eng", None)

    assert saved[-1]["face_tracking_engine"] == "mediapipe"
    assert saved[-1]["tracking_mode"] == "auto"


def test_rerender_keeps_the_project_engine_when_none_is_asked(monkeypatch, no_side_effects):
    monkeypatch.setattr("backend.db.get_history", lambda h: _history(engine="mediapipe"))
    job_id = jobs.create_rerender_job("hist-1", "9:16", True, "")
    assert jobs.active_jobs[job_id]["face_tracking_engine"] == "mediapipe"


def test_rerender_uses_the_engine_that_is_asked_for(monkeypatch, no_side_effects):
    monkeypatch.setattr("backend.db.get_history", lambda h: _history(engine="mediapipe"))
    job_id = jobs.create_rerender_job("hist-1", "9:16", True, "", face_tracking_engine="haar")
    assert jobs.active_jobs[job_id]["face_tracking_engine"] == "haar"


def test_rerender_of_an_old_project_without_a_recorded_engine_uses_haar(monkeypatch, no_side_effects):
    monkeypatch.setattr("backend.db.get_history", lambda h: _history())
    job_id = jobs.create_rerender_job("hist-1", "9:16", True, "")
    assert jobs.active_jobs[job_id]["face_tracking_engine"] == "haar"


def test_ai_rerun_keeps_the_project_engine(monkeypatch, no_side_effects):
    monkeypatch.setattr("backend.db.get_history", lambda h: _history(engine="mediapipe"))
    monkeypatch.setattr(jobs.os.path, "exists", lambda p: True)
    job_id = jobs.create_rerun_ai_job("hist-1", "openai", "k", "9:16", True, "", "")
    assert jobs.active_jobs[job_id]["face_tracking_engine"] == "mediapipe"


def test_rerender_endpoint_passes_the_engine_only_when_the_app_sends_one(monkeypatch):
    from fastapi.testclient import TestClient
    from backend.main import app

    seen = []
    monkeypatch.setattr("backend.jobs.create_rerender_job", lambda *a, **k: seen.append(k) or "new-job")
    client = TestClient(app)

    assert client.post("/jobs/hist-1/rerender", json={"aspect_ratio": "9:16"}).status_code == 200
    assert client.post("/jobs/hist-1/rerender", json={"aspect_ratio": "9:16", "face_tracking_engine": "mediapipe"}).status_code == 200

    assert seen[0]["face_tracking_engine"] is None  # not sent: the project's own engine applies
    assert seen[1]["face_tracking_engine"] == "mediapipe"
