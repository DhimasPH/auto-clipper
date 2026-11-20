"""The job status names the stage that is running now (SP2 spec 4.4), without changing timings."""
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from backend import jobs, main, stage_timer
from backend.stage_timer import collect_timings, stage

client = TestClient(main.app)


def _job(job_id, src, tmp_path, **extra):
    job = {
        "id": job_id, "url": f"local:{src}", "provider": "openai", "api_key": "k", "mode": "ai",
        "aspect_ratio": "9:16", "title": f"Current {job_id}", "caption_style": "standard",
        "burn_subs": False, "output_dir": str(tmp_path), "quality": "best", "whisper_model": "small",
        "max_clips": 0, "status": "PENDING", "progress": "", "cancelled": False, "clips": [],
        "failed": 0, "error": None,
    }
    job.update(extra)
    return job


def test_live_stage_is_none_for_unknown_and_finished_jobs():
    assert jobs.live_stage("no-such-job") is None
    jobs.active_jobs["test-current-done"] = {"id": "test-current-done", "status": "DONE", "_live": {}}
    try:
        assert jobs.live_stage("test-current-done") is None
    finally:
        jobs.active_jobs.pop("test-current-done", None)


def test_run_job_reports_each_running_stage_with_its_device(tmp_path, monkeypatch):
    src = tmp_path / "source.mp4"
    src.write_bytes(b"x")
    job_id = "test-current-run"
    jobs.active_jobs[job_id] = _job(job_id, src, tmp_path, provider="manual_ai", api_key="",
                                    metadata={"title": "Current run"})
    seen = {}

    def fake_extract_audio(video, audio, register_proc=None):
        with stage("extract_audio"):
            seen["extract_audio"] = jobs.live_stage(job_id)
        return audio

    def fake_transcribe(audio, karaoke=False, is_cancelled=None, model_size="small"):
        with stage("transcribe", whisper_model=model_size) as rec:
            rec["whisper_device"] = "cpu"
            seen["transcribe"] = jobs.live_stage(job_id)
        return {"segments": [{"start": 0.0, "end": 1.0, "text": "halo"}]}

    monkeypatch.setattr("backend.ai_utils.extract_audio", fake_extract_audio)
    monkeypatch.setattr("backend.ai_utils.transcribe_with_faster_whisper", fake_transcribe)
    monkeypatch.setattr("backend.video_utils.get_video_duration", lambda p: 60.0)
    monkeypatch.setattr("backend.db.save_history", lambda *a, **k: None)
    try:
        jobs._run_job(job_id)
        assert jobs.active_jobs[job_id]["status"] == "AWAITING_MANUAL"
        assert seen["extract_audio"]["stage"] == "extract_audio"
        assert seen["transcribe"]["stage"] == "transcribe"
        assert seen["transcribe"]["device"] == "cpu"
        assert jobs.live_stage(job_id) is None
    finally:
        jobs.active_jobs.pop(job_id, None)


def test_render_reports_clip_number_of_total_without_touching_timings(tmp_path, monkeypatch):
    src = tmp_path / "source.mp4"
    src.write_bytes(b"x")
    job_id = "test-current-render"
    seg = {"start_time": "00:00:01", "end_time": "00:00:11", "description": "s"}
    metadata = {"highlights": [dict(seg), dict(seg)], "title": "Current render"}
    job = _job(job_id, src, tmp_path, metadata=metadata)
    live = job["_live"] = {}
    jobs.active_jobs[job_id] = job
    seen = []

    def fake_crop(*a, **k):
        with stage("render") as rec:
            rec["encoder"] = "libx264"
            seen.append(jobs.live_stage(job_id))
        return "clip.mp4"

    monkeypatch.setattr(jobs, "crop_to_vertical", fake_crop)
    monkeypatch.setattr("backend.db.save_history", lambda *a, **k: None)
    timings = []
    try:
        with collect_timings(timings, live):
            jobs._render_video_clips(job, job_id, metadata, str(src), None, lambda: False, 0)
        assert [(c["clip"], c["clips_total"], c["device"]) for c in seen] == [(1, 2, "libx264"), (2, 2, "libx264")]
        assert all("clips_total" not in t and "percent" not in t for t in timings)
    finally:
        jobs.active_jobs.pop(job_id, None)


def test_manual_resume_shows_finished_stages_while_it_runs(tmp_path, monkeypatch):
    src = tmp_path / "source.mp4"
    src.write_bytes(b"x")
    history = {
        "id": "test-current-manual", "url": f"local:{src}", "status": "AWAITING_MANUAL", "result_clips": [],
        "metadata": {
            "source_video": str(src), "subtitle_path": str(src), "title": "Current manual",
            "aspect_ratio": "9:16", "burn_subs": False, "output_dir": str(tmp_path),
            "timings": [{"stage": "transcribe", "seconds": 3.0, "rss_mb_peak": 1.0, "ok": True}],
        },
    }
    monkeypatch.setattr("backend.db.get_history", lambda j: history)
    monkeypatch.setattr("backend.db.save_history", lambda *a, **k: None)
    # P5: patch _start_job (and cancel queue entry in finally) so no phantom item stays in job_queue.
    monkeypatch.setattr(jobs, "_start_job", lambda *a, **k: None)
    shared = []

    def fake_crop(*a, **k):
        job = jobs.active_jobs["test-current-manual"]
        shared.append(job["metadata"]["timings"] is job["timings"])
        return "clip.mp4"

    monkeypatch.setattr(jobs, "crop_to_vertical", fake_crop)
    payload = '[{"start_time": "00:00:00", "end_time": "00:00:04", "description": "x"}]'
    job_id = jobs.resume_manual_job("test-current-manual", payload)
    try:
        from backend.ai_utils import _parse_highlights
        jobs._run_manual_resume_job(job_id, _parse_highlights(payload))
        assert shared == [True]
    finally:
        jobs.job_queue.cancel(job_id)
        jobs.active_jobs.pop(job_id, None)


@pytest.mark.parametrize("update, expected", [
    ({"status": "downloading", "downloaded_bytes": 50, "total_bytes": 200}, 25.0),
    ({"status": "downloading", "downloaded_bytes": 30, "total_bytes_estimate": 60}, 50.0),
    ({"status": "downloading", "downloaded_bytes": 90, "total_bytes": 60}, 100.0),
    ({"status": "downloading", "downloaded_bytes": 10}, None),
    ({"status": "downloading", "downloaded_bytes": 10, "total_bytes": 0}, None),
    ({"status": "finished", "downloaded_bytes": 10, "total_bytes": 10}, None),
    ("not a dict", None),
])
def test_download_percent(update, expected):
    from backend.video_utils import download_percent
    assert download_percent(update) == expected


@patch("backend.video_utils.yt_dlp.YoutubeDL")
def test_download_reports_percent_while_the_download_stage_runs(mock_ytdl, tmp_path):
    from backend.video_utils import download_youtube_video
    seen, live = [], {}

    def construct(opts):
        ydl = MagicMock()

        def download(urls):
            for hook in opts["progress_hooks"]:
                hook({"status": "downloading", "downloaded_bytes": 50, "total_bytes": 200})
            seen.append(stage_timer.current_stage(live))

        ydl.download.side_effect = download
        manager = MagicMock()
        manager.__enter__.return_value = ydl
        manager.__exit__.return_value = False
        return manager

    mock_ytdl.side_effect = construct
    with collect_timings([], live):
        download_youtube_video("https://youtu.be/x", str(tmp_path / "v.mp4"))
    assert seen[0]["stage"] == "download"
    assert seen[0]["percent"] == 25.0


def test_job_status_carries_current_while_a_stage_runs():
    job_id = "test-current-api"
    live = {}
    jobs.active_jobs[job_id] = {"id": job_id, "url": "local:x", "status": "TRANSCRIBING", "progress": "",
                                "clips": [], "failed": 0, "error": None, "metadata": {}, "_live": live}
    try:
        with collect_timings([], live):
            with stage("transcribe") as rec:
                rec["whisper_device"] = "cuda"
                body = client.get(f"/jobs/{job_id}").json()
        assert body["current"]["stage"] == "transcribe"
        assert body["current"]["device"] == "cuda"
        assert "_live" not in body
        jobs.active_jobs[job_id]["status"] = "DONE"
        assert client.get(f"/jobs/{job_id}").json()["current"] is None
    finally:
        jobs.active_jobs.pop(job_id, None)


def test_job_status_from_history_has_no_current(monkeypatch):
    monkeypatch.setattr("backend.db.get_history", lambda j: {"url": "u", "status": "DONE", "result_clips": [], "metadata": {}})
    assert client.get("/jobs/test-current-history").json()["current"] is None
