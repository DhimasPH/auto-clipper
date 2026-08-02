import os
import subprocess
import sys
import time

from backend import jobs
from backend.crop_utils import crop_to_vertical


def test_cancel_job_kills_running_process():
    """cancel_job must actually terminate the live ffmpeg process, not just flag."""
    job_id = "test-cancel"
    proc = subprocess.Popen([sys.executable, "-c", "import time; time.sleep(30)"])
    jobs.active_jobs[job_id] = {"id": job_id, "cancelled": False, "_proc": proc}
    try:
        assert proc.poll() is None  # running
        jobs.cancel_job(job_id)
        for _ in range(30):
            if proc.poll() is not None:
                break
            time.sleep(0.1)
        assert proc.poll() is not None, "process should have been killed"
        assert jobs.active_jobs[job_id]["cancelled"] is True
    finally:
        if proc.poll() is None:
            proc.kill()
        jobs.active_jobs.pop(job_id, None)


def test_crop_respects_should_cancel(tmp_path):
    """crop_to_vertical should abort before invoking ffmpeg when cancelled."""
    out = tmp_path / "out.mp4"
    try:
        crop_to_vertical(
            str(tmp_path / "missing.mp4"), str(out),
            "00:00:00", "00:00:10",
            should_cancel=lambda: True,
        )
        assert False, "expected a cancellation error"
    except RuntimeError as e:
        assert "Dibatalkan" in str(e)
    assert not out.exists()


def test_run_job_tracks_success_and_failed(tmp_path, monkeypatch):
    """_run_job should count rendered clips as success and crop failures as failed."""
    src = tmp_path / "source.mp4"
    src.write_bytes(b"x")
    job_id = "test-breakdown"
    jobs.active_jobs[job_id] = {
        "id": job_id, "url": f"local:{src}", "provider": "openai", "api_key": "k",
        "mode": "ai", "manual_start": "", "manual_end": "", "aspect_ratio": "9:16",
        "caption_style": "standard", "burn_subs": False, "output_dir": "", "quality": "best",
        "status": "PENDING", "progress": "", "cancelled": False, "clips": [], "failed": 0,
        "error": None,
    }
    seg = lambda s: {"start_time": f"00:00:0{s}", "end_time": f"00:00:1{s}", "description": f"seg{s}", "description_en": f"seg_en{s}", "description_id": f"seg_id{s}"}
    monkeypatch.setattr(jobs, "process_with_openai", lambda *a, **k: {"highlights": [seg(0), seg(1), seg(2)], "subtitle_path": None})
    calls = {"n": 0}
    def fake_crop(*a, **k):
        calls["n"] += 1
        if calls["n"] == 2:
            raise RuntimeError("boom")
        return f"clip_{calls['n']}.mp4"
    monkeypatch.setattr(jobs, "crop_to_vertical", fake_crop)
    monkeypatch.setattr("backend.db.save_history", lambda *a, **k: None)
    try:
        jobs._run_job(job_id)
        job = jobs.active_jobs[job_id]
        if job["status"] != "DONE":
            print(f"FAILED WITH ERROR: {job['error']}")
        assert job["status"] == "DONE"
        assert len(job["clips"]) == 2
        assert job["failed"] == 1
    finally:
        jobs.active_jobs.pop(job_id, None)


def test_create_job_has_no_manual_params():
    import inspect
    from backend.jobs import create_job
    params = inspect.signature(create_job).parameters
    for gone in ("mode", "manual_start", "manual_end"):
        assert gone not in params, f"{gone} should be removed from create_job"


def test_get_project_workspace(tmp_path):
    from backend.jobs import get_project_workspace
    ws = get_project_workspace("Podcast / Radit: Ep 1?", output_dir=str(tmp_path))
    assert ws["safe_title"] == "Podcast  Radit Ep 1"
    assert os.path.exists(ws["source_dir"])
    assert os.path.exists(ws["subtitles_dir"])
    assert os.path.exists(ws["clips_dir"])
    assert os.path.exists(ws["broll_dir"])


def test_create_job_requires_title():
    import pytest
    from backend.jobs import create_job, create_manual_job
    with pytest.raises(ValueError, match="Judul Proyek wajib diisi"):
        create_job("https://youtu.be/x", "openai", "key", title="")
    with pytest.raises(ValueError, match="Judul Proyek wajib diisi"):
        create_manual_job("https://youtu.be/x", [{"start": 0, "end": 5}], title="   ")


def test_cancel_job_updates_status_and_calls_db(monkeypatch):
    """cancel_job should immediately mark status as CANCELLED and call save_history."""
    job_id = "test-cancel-db"
    db_calls = []
    monkeypatch.setattr("backend.db.save_history", lambda *a: db_calls.append(a))
    jobs.active_jobs[job_id] = {
        "id": job_id, "url": "https://youtu.be/abc", "status": "CROPPING", "progress": "Merender...",
        "cancelled": False, "clips": [], "metadata": {"title": "Test"}
    }
    try:
        jobs.cancel_job(job_id)
        assert jobs.active_jobs[job_id]["cancelled"] is True
        assert jobs.active_jobs[job_id]["status"] == "CANCELLED"
        assert len(db_calls) == 1
        assert db_calls[0][0] == job_id
        assert db_calls[0][2] == "CANCELLED"
    finally:
        jobs.active_jobs.pop(job_id, None)


def test_finalize_job_prioritizes_cancelled(monkeypatch):
    """_finalize_job must never overwrite CANCELLED with ERROR if cancelled flag is true."""
    job_id = "test-finalize-cancelled"
    saved_status = []
    monkeypatch.setattr("backend.db.save_history", lambda j_id, url, status, clips, meta: saved_status.append(status))
    jobs.active_jobs[job_id] = {
        "id": job_id, "url": "https://youtu.be/abc", "status": "CROPPING",
        "cancelled": True, "clips": []
    }
    try:
        jobs._finalize_job(job_id, "ERROR", {})
        assert jobs.active_jobs[job_id]["status"] == "CANCELLED"
        assert saved_status == ["CANCELLED"]
    finally:
        jobs.active_jobs.pop(job_id, None)


def test_resume_job_reuses_highlights(tmp_path, monkeypatch):
    """_run_resume_job should reuse metadata['highlights'] and NOT call any LLM API."""
    src = tmp_path / "source.mp4"
    src.write_bytes(b"x")
    
    seg = {"start_time": "00:00:00", "end_time": "00:00:05", "description": "Existing Highlight"}
    metadata = {
        "source_video": str(src),
        "subtitle_path": None,
        "highlights": [seg],
        "title": "Test Resume",
        "mode": "manual",
        "aspect_ratio": "9:16",
        "burn_subs": False,
        "output_dir": str(tmp_path)
    }
    
    job_id = "test-resume-reuse"
    jobs.active_jobs[job_id] = {
        "id": job_id,
        "url": "local:test",
        "provider": "manual_ai",
        "api_key": "",
        "status": "QUEUED",
        "cancelled": False,
        "clips": [],
        "failed": 0,
        "error": None,
        "aspect_ratio": "9:16",
        "burn_subs": False,
        "output_dir": str(tmp_path),
        "metadata": metadata
    }
    
    # Fake crop_to_vertical
    monkeypatch.setattr(jobs, "crop_to_vertical", lambda *a, **k: str(tmp_path / "clip.mp4"))
    monkeypatch.setattr("backend.db.save_history", lambda *a, **k: None)
    
    # LLM function should NOT be called; if called, raise error
    monkeypatch.setattr("backend.ai_utils.get_highlights", lambda *a, **k: (_ for _ in ()).throw(RuntimeError("Should not call LLM")))
    
    try:
        jobs._run_resume_job(job_id)
        job = jobs.active_jobs[job_id]
        assert job["status"] == "DONE"
        assert len(job["clips"]) == 1
        assert job["clips"][0]["description"] == "Existing Highlight"
    finally:
        jobs.active_jobs.pop(job_id, None)

