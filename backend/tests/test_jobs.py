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
