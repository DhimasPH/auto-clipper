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
