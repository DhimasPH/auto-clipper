from fastapi.testclient import TestClient
from backend.main import app, is_valid_source_url

client = TestClient(app)


def test_health_check():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_is_valid_source_url_accepts_supported_platforms():
    assert is_valid_source_url("https://www.youtube.com/watch?v=abc")
    assert is_valid_source_url("https://youtu.be/abc")
    assert is_valid_source_url("https://www.tiktok.com/@u/video/123")
    assert is_valid_source_url("https://www.instagram.com/reel/abc/")
    assert is_valid_source_url("https://x.com/u/status/123")
    assert is_valid_source_url("https://twitter.com/u/status/123")
    assert is_valid_source_url("local:/tmp/x.mp4")


def test_is_valid_source_url_rejects_others():
    assert not is_valid_source_url("")
    assert not is_valid_source_url("https://example.com/video")
    assert not is_valid_source_url("not a url")


def test_create_job_rejects_invalid_url():
    r = client.post("/jobs", json={"url": "https://example.com/x"})
    assert r.status_code == 400
    assert r.json()["status"] == "error"


def test_create_job_accepts_valid_url(monkeypatch):
    # Avoid spawning a real download/render thread.
    monkeypatch.setattr("backend.main.create_job", lambda *a, **k: "fake-id")
    monkeypatch.setattr("backend.main.ping_provider", lambda *a, **k: None)
    r = client.post("/jobs", json={"url": "https://youtube.com/watch?v=abc"})
    assert r.status_code == 200
    assert r.json()["job_id"] == "fake-id"


def test_get_unknown_job_404():
    r = client.get("/jobs/does-not-exist")
    assert r.status_code == 404


def test_cancel_unknown_job_404():
    r = client.post("/jobs/does-not-exist/cancel")
    assert r.status_code == 404


def test_history_list_ok():
    r = client.get("/history")
    assert r.status_code == 200
    assert r.json()["status"] == "success"
    assert isinstance(r.json()["history"], list)


def test_video_missing_returns_404():
    r = client.get("/video", params={"path": "/nope.mp4"})
    assert r.status_code == 404


def test_get_job_exposes_success_and_failed_counts():
    from backend import jobs
    job_id = "endpoint-breakdown"
    jobs.active_jobs[job_id] = {
        "id": job_id, "status": "DONE", "progress": "",
        "clips": [{"path": "a.mp4"}, {"path": "b.mp4"}], "failed": 1, "error": None,
    }
    try:
        r = client.get(f"/jobs/{job_id}")
        assert r.status_code == 200
        body = r.json()
        assert body["failed"] == 1
        assert len(body["clips"]) == 2
    finally:
        jobs.active_jobs.pop(job_id, None)


def test_probe_endpoint_ok(monkeypatch):
    monkeypatch.setattr("backend.main.probe_formats", lambda url: [1080, 720])
    r = client.get("/probe", params={"url": "https://youtube.com/watch?v=x"})
    assert r.status_code == 200
    assert r.json()["heights"] == [1080, 720]


def test_probe_endpoint_rejects_invalid_url():
    r = client.get("/probe", params={"url": "https://example.com/x"})
    assert r.status_code == 400


def test_create_job_request_has_no_manual_fields():
    from backend.main import CreateJobRequest
    fields = CreateJobRequest.model_fields
    for gone in ("mode", "manual_start", "manual_end"):
        assert gone not in fields, f"{gone} should be removed from CreateJobRequest"
