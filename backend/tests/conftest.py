import os
import tempfile

import pytest

# Keep tests away from the real app data directory (history.db, logs). Set
# before any backend module is imported, because backend.main opens the
# database at import time.
os.environ["AUTO_CLIPPER_WORKSPACE"] = tempfile.mkdtemp(prefix="auto-clipper-tests-")


@pytest.fixture(autouse=True)
def _isolated_job_state(monkeypatch):
    """Each test gets an empty job queue and leaves no job behind.

    Several tests stub ``threading.Thread.start`` so a job never runs; without
    this, that job would stay first in line and block every later test.
    """
    from backend import jobs
    from backend.job_queue import JobQueue

    monkeypatch.setattr(jobs, "job_queue", JobQueue(), raising=False)
    yield
    jobs.active_jobs.clear()


@pytest.fixture(autouse=True)
def _preflight_passes(monkeypatch):
    """Jobs started in tests must not depend on this machine having FFmpeg or free disk.

    Tests of the preflight checks replace these probes again with their own values.
    """
    from backend import preflight

    monkeypatch.setattr(preflight, "_ffmpeg_path", lambda: "ffmpeg")
    monkeypatch.setattr(preflight, "_free_disk_gb", lambda: 100.0)
