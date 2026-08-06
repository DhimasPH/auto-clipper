import pytest
from backend import jobs
from backend.main import CreateJobRequest, ManualJobRequest

def test_job_requests_accept_subtitle_config():
    req1 = CreateJobRequest(
        url="https://youtube.com/watch?v=123",
        provider="gemini",
        api_key="xyz",
        title="Test Project",
        subtitle_config={"style": "karaoke", "font_size": 24, "primary_color": "#00FFFF"}
    )
    assert req1.subtitle_config["style"] == "karaoke"
    assert req1.subtitle_config["font_size"] == 24

    req2 = ManualJobRequest(
        url="https://youtube.com/watch?v=123",
        title="Manual Project",
        clips=[{"start": "00:00:00", "end": "00:00:10"}],
        subtitle_config={"style": "standard", "font_name": "Arial"}
    )
    assert req2.subtitle_config["font_name"] == "Arial"


def test_create_job_stores_subtitle_config(monkeypatch):
    monkeypatch.setattr("threading.Thread.start", lambda self: None)
    sub_cfg = {"style": "karaoke", "font_size": 22, "font_weight": "bold"}
    job_id = jobs.create_job(
        url="https://youtube.com/watch?v=123",
        provider="gemini",
        api_key="xyz",
        title="My Title",
        subtitle_config=sub_cfg
    )
    assert jobs.active_jobs[job_id]["subtitle_config"] == sub_cfg
    jobs.active_jobs.pop(job_id, None)


def test_create_manual_job_stores_subtitle_config(monkeypatch):
    monkeypatch.setattr("threading.Thread.start", lambda self: None)
    sub_cfg = {"style": "standard", "font_size": 18}
    job_id = jobs.create_manual_job(
        url="https://youtube.com/watch?v=123",
        clips=[{"start": "00:00:00", "end": "00:00:10"}],
        title="Manual Title",
        subtitle_config=sub_cfg
    )
    assert jobs.active_jobs[job_id]["subtitle_config"] == sub_cfg
    jobs.active_jobs.pop(job_id, None)


def test_finalize_job_persists_subtitle_config(monkeypatch):
    saved = {}
    def fake_save_history(job_id, url, status, clips, metadata):
        saved["job_id"] = job_id
        saved["metadata"] = metadata

    monkeypatch.setattr("backend.db.save_history", fake_save_history)
    sub_cfg = {"style": "karaoke", "primary_color": "#FFFF00"}
    job_id = "test-finalize-sub"
    jobs.active_jobs[job_id] = {
        "id": job_id,
        "url": "local:test.mp4",
        "clips": [],
        "subtitle_config": sub_cfg,
        "mode": "ai"
    }

    jobs._finalize_job(job_id, "DONE", metadata={})
    assert "subtitle_config" in saved["metadata"]
    assert saved["metadata"]["subtitle_config"] == sub_cfg
    jobs.active_jobs.pop(job_id, None)
