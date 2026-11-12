"""Job failures reach the UI as structured error_info, and old fields keep working."""
import json
from unittest.mock import MagicMock, patch

import pytest

from backend import jobs
from backend.errors import AppError

SIGNIN_BOT = (
    "ERROR: [youtube] dQw4w9WgXcQ: Sign in to confirm you’re not a bot. "
    "Use --cookies-from-browser or --cookies for the authentication."
)


def _yt_dlp_failing_with(mock_ytdl, message):
    from yt_dlp.utils import DownloadError
    inst = MagicMock()
    inst.download.side_effect = DownloadError(message)
    inst.extract_info.side_effect = DownloadError(message)
    mock_ytdl.return_value.__enter__.return_value = inst
    return inst


@patch("backend.video_utils.yt_dlp.YoutubeDL")
def test_download_failure_is_raised_as_classified_app_error(mock_ytdl, tmp_path):
    from backend.video_utils import download_youtube_video
    _yt_dlp_failing_with(mock_ytdl, SIGNIN_BOT)

    with pytest.raises(AppError) as excinfo:
        download_youtube_video("https://youtu.be/x", str(tmp_path / "v.mp4"))

    assert excinfo.value.code == "YT_SIGNIN_REQUIRED"
    assert str(excinfo.value) == SIGNIN_BOT


@patch("backend.video_utils.yt_dlp.YoutubeDL")
def test_cancelled_download_is_not_turned_into_an_app_error(mock_ytdl, tmp_path):
    from backend.video_utils import download_youtube_video, DownloadCancelledError
    _yt_dlp_failing_with(mock_ytdl, "ERROR: interrupted")

    with pytest.raises(DownloadCancelledError):
        download_youtube_video("https://youtu.be/x", str(tmp_path / "v.mp4"), is_cancelled=lambda: True)


@patch("backend.video_utils.yt_dlp.YoutubeDL")
def test_probe_failure_is_raised_as_classified_app_error(mock_ytdl):
    from backend.video_utils import probe_formats
    _yt_dlp_failing_with(mock_ytdl, "ERROR: [youtube] abc: Private video. Sign in if you've been granted access to this video")

    with pytest.raises(AppError) as excinfo:
        probe_formats("https://youtu.be/x")

    assert excinfo.value.code == "VIDEO_UNAVAILABLE"


def _url_job(job_id, tmp_path):
    return {
        "id": job_id, "url": "https://youtu.be/x", "provider": "openai", "api_key": "k",
        "mode": "ai", "aspect_ratio": "9:16", "title": f"Err {job_id}",
        "caption_style": "standard", "burn_subs": False, "output_dir": str(tmp_path), "quality": "best",
        "status": "PENDING", "progress": "", "cancelled": False, "clips": [], "failed": 0,
        "error": None, "metadata": {},
    }


def test_failed_job_gets_error_info_and_keeps_the_raw_error_string(tmp_path, monkeypatch):
    job_id = "test-error-info"
    jobs.active_jobs[job_id] = _url_job(job_id, tmp_path)

    def failing_download(*a, **k):
        raise AppError("YT_SIGNIN_REQUIRED", technical=SIGNIN_BOT)

    monkeypatch.setattr(jobs, "download_youtube_video", failing_download)
    saved = []
    monkeypatch.setattr("backend.db.save_history", lambda job_id, url, status, clips, meta: saved.append((status, json.dumps(meta))))

    try:
        jobs._run_job(job_id)
        job = jobs.active_jobs[job_id]
        assert job["status"] == "ERROR"
        assert job["error"] == SIGNIN_BOT
        assert job["error_info"]["code"] == "YT_SIGNIN_REQUIRED"
        assert job["error_info"]["technical"] == SIGNIN_BOT

        status, meta = saved[-1]
        meta = json.loads(meta)
        assert status == "ERROR"
        assert meta["error"] == SIGNIN_BOT
        assert meta["error_info"]["code"] == "YT_SIGNIN_REQUIRED"
    finally:
        jobs.active_jobs.pop(job_id, None)


def test_unrecognised_failure_becomes_unknown_with_the_raw_text(tmp_path, monkeypatch):
    job_id = "test-error-unknown"
    jobs.active_jobs[job_id] = _url_job(job_id, tmp_path)
    monkeypatch.setattr(jobs, "download_youtube_video", lambda *a, **k: (_ for _ in ()).throw(RuntimeError("weird failure 123")))
    monkeypatch.setattr("backend.db.save_history", lambda *a, **k: None)

    try:
        jobs._run_job(job_id)
        job = jobs.active_jobs[job_id]
        assert job["error"] == "weird failure 123"
        assert job["error_info"]["code"] == "UNKNOWN"
        assert job["error_info"]["technical"] == "weird failure 123"
    finally:
        jobs.active_jobs.pop(job_id, None)


def test_cancelled_job_has_no_error_info(tmp_path, monkeypatch):
    job_id = "test-error-cancelled"
    job = _url_job(job_id, tmp_path)
    jobs.active_jobs[job_id] = job

    def cancelled_download(*a, **k):
        job["cancelled"] = True
        raise RuntimeError("Download cancelled by user")

    monkeypatch.setattr(jobs, "download_youtube_video", cancelled_download)
    monkeypatch.setattr("backend.db.save_history", lambda *a, **k: None)

    try:
        jobs._run_job(job_id)
        assert job["status"] == "CANCELLED"
        assert not job.get("error_info")
    finally:
        jobs.active_jobs.pop(job_id, None)


def test_successful_finalize_drops_a_stale_error_from_an_earlier_attempt(monkeypatch):
    job_id = "test-error-stale"
    monkeypatch.setattr("backend.db.save_history", lambda *a, **k: None)
    jobs.active_jobs[job_id] = {"id": job_id, "url": "local:x", "status": "CROPPING", "cancelled": False, "clips": [], "error": None}
    metadata = {"error": "old failure", "error_info": {"code": "UNKNOWN"}}
    try:
        jobs._finalize_job(job_id, "DONE", metadata)
        assert "error" not in metadata
        assert "error_info" not in metadata
    finally:
        jobs.active_jobs.pop(job_id, None)


def test_rerender_clip_failure_gets_error_info(monkeypatch):
    job_id = "test-error-rerender-clip"
    jobs.active_jobs[job_id] = {
        "id": job_id, "type": "rerender_clip", "url": "clip-rerender:none", "parent_job_id": "does-not-exist",
        "clip_index": 0, "custom_words": [], "aspect_ratio": "9:16", "caption_style": "standard", "burn_subs": False,
        "status": "QUEUED", "progress": "", "clips": [], "cancelled": False, "failed": 0, "error": None,
    }
    monkeypatch.setattr("backend.db.get_history", lambda j: None)
    try:
        jobs._run_rerender_clip_job(job_id)
        job = jobs.active_jobs[job_id]
        assert job["status"] == "ERROR"
        assert job["error_info"]["code"] == "UNKNOWN"
        assert job["error_info"]["technical"] == job["error"]
    finally:
        jobs.active_jobs.pop(job_id, None)


def test_get_job_from_history_returns_error_info(monkeypatch):
    info = AppError("DISK_FULL", technical="[Errno 28] No space left on device").to_dict()
    record = {
        "id": "hist-err-info", "url": "https://youtu.be/x", "status": "ERROR", "result_clips": [],
        "metadata": {"error": "[Errno 28] No space left on device", "error_info": info},
    }
    monkeypatch.setattr("backend.db.get_history", lambda j: record if j == "hist-err-info" else None)
    jobs.active_jobs.pop("hist-err-info", None)

    loaded = jobs.get_job("hist-err-info")
    assert loaded["error"] == "[Errno 28] No space left on device"
    assert loaded["error_info"]["code"] == "DISK_FULL"


# --- API surface -------------------------------------------------------------

def test_job_status_endpoint_returns_error_info():
    from fastapi.testclient import TestClient
    from backend.main import app

    job_id = "test-api-error-info"
    info = AppError("YT_RATE_LIMITED", technical="HTTP Error 429").to_dict()
    jobs.active_jobs[job_id] = {
        "id": job_id, "status": "ERROR", "progress": "", "clips": [], "failed": 0,
        "error": "HTTP Error 429", "error_info": info, "metadata": {},
    }
    try:
        body = TestClient(app).get(f"/jobs/{job_id}").json()
        assert body["error"] == "HTTP Error 429"
        assert body["error_info"]["code"] == "YT_RATE_LIMITED"
    finally:
        jobs.active_jobs.pop(job_id, None)


def test_job_status_endpoint_returns_null_error_info_for_healthy_job():
    from fastapi.testclient import TestClient
    from backend.main import app

    job_id = "test-api-no-error-info"
    jobs.active_jobs[job_id] = {"id": job_id, "status": "CROPPING", "progress": "", "clips": [], "metadata": {}}
    try:
        body = TestClient(app).get(f"/jobs/{job_id}").json()
        assert body["error_info"] is None
    finally:
        jobs.active_jobs.pop(job_id, None)


def test_probe_endpoint_returns_error_info_with_the_old_message(monkeypatch):
    from fastapi.testclient import TestClient
    from backend.main import app

    def failing_probe(url):
        raise AppError("YT_SIGNIN_REQUIRED", technical=SIGNIN_BOT)

    monkeypatch.setattr("backend.video_utils.probe_formats", failing_probe)
    r = TestClient(app).get("/probe", params={"url": "https://youtu.be/x"})
    assert r.status_code == 400
    body = r.json()
    assert body["message"] == SIGNIN_BOT
    assert body["error_info"]["code"] == "YT_SIGNIN_REQUIRED"
