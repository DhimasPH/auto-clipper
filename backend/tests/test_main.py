from fastapi.testclient import TestClient
from backend.main import app, is_valid_source_url

client = TestClient(app)


def test_health_check():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_cors_headers():
    allowed_origins = [
        "http://tauri.localhost",
        "https://tauri.localhost",
        "tauri://localhost",
        "http://localhost:5173",
        "http://127.0.0.1:8000",
        "app://localhost",
        "https://clipper.dhims.web.id",
    ]
    for origin in allowed_origins:
        r = client.get("/health", headers={"Origin": origin})
        assert r.status_code == 200
        assert r.headers.get("access-control-allow-origin") == origin, f"Origin {origin} was not allowed by CORS"

    # Unauthorized external web origin should NOT receive allow-origin header
    r_unauthorized = client.get("/health", headers={"Origin": "https://malicious-website.com"})
    assert r_unauthorized.headers.get("access-control-allow-origin") is None


def test_heartbeat_endpoint():
    r = client.post("/heartbeat")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_auth_middleware_in_cloud_mode(monkeypatch):
    monkeypatch.setenv("AUTO_CLIPPER_CLOUD_MODE", "1")
    monkeypatch.setenv("AUTO_CLIPPER_WEB_TOKEN", "secret-test-token")
    
    # 1. Protected endpoint without token -> 401
    r_unauthorized = client.get("/history")
    assert r_unauthorized.status_code == 401
    assert r_unauthorized.json()["status"] == "error"

    # 2. Protected endpoint with wrong token -> 401
    r_wrong = client.get("/history", headers={"Authorization": "Bearer wrong-token"})
    assert r_wrong.status_code == 401

    # 3. Protected endpoint with valid token -> 200
    r_authorized = client.get("/history", headers={"Authorization": "Bearer secret-test-token"})
    assert r_authorized.status_code == 200

    # 4. Unprotected endpoints (health, heartbeat) bypass token check
    assert client.get("/health").status_code == 200
    assert client.post("/heartbeat").status_code == 200


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
    monkeypatch.setattr("backend.jobs.create_job", lambda *a, **k: "fake-id")
    monkeypatch.setattr("backend.ai_utils.ping_provider", lambda *a, **k: None)
    r = client.post("/jobs", json={"url": "https://youtube.com/watch?v=abc", "title": "My Test Project"})
    assert r.status_code == 200
    assert r.json()["job_id"] == "fake-id"


def test_create_job_rejects_missing_title(monkeypatch):
    monkeypatch.setattr("backend.ai_utils.ping_provider", lambda *a, **k: None)
    r = client.post("/jobs", json={"url": "https://youtube.com/watch?v=abc", "title": ""})
    assert r.status_code == 400
    assert "Judul Proyek wajib diisi" in r.json()["message"]

    r_spaces = client.post("/jobs", json={"url": "https://youtube.com/watch?v=abc", "title": "   "})
    assert r_spaces.status_code == 400
    assert "Judul Proyek wajib diisi" in r_spaces.json()["message"]


def test_create_manual_job_rejects_missing_title():
    r = client.post("/jobs/manual", json={
        "url": "https://youtube.com/watch?v=abc",
        "clips": [{"start": 0, "end": 10}],
        "title": ""
    })
    assert r.status_code == 400
    assert "Judul Proyek wajib diisi" in r.json()["message"]

    r_spaces = client.post("/jobs/manual", json={
        "url": "https://youtube.com/watch?v=abc",
        "clips": [{"start": 0, "end": 10}],
        "title": "   "
    })
    assert r_spaces.status_code == 400
    assert "Judul Proyek wajib diisi" in r_spaces.json()["message"]


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
    monkeypatch.setattr("backend.video_utils.probe_formats", lambda url: [1080, 720])
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


def test_get_whisper_models_endpoint():
    r = client.get("/api/settings/whisper-models")
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "success"
    assert "models" in data
    assert any(m["id"] == "small" for m in data["models"])


def test_download_whisper_model_endpoint(monkeypatch):
    monkeypatch.setattr("backend.ai_utils.download_whisper_model", lambda m: {"status": "success", "model": m, "message": "ok"})
    r = client.post("/api/settings/whisper-models/download", json={"model": "medium"})
    assert r.status_code == 200
    assert r.json()["status"] == "success"


def test_get_logs_endpoint():
    for lt in ["app", "error", "ai"]:
        res = client.get(f"/logs/{lt}")
        assert res.status_code == 200
        assert res.json()["status"] == "success"
        assert res.json()["log_type"] == lt
        assert "content" in res.json()
        
    res_inv = client.get("/logs/invalid_type")
    assert res_inv.status_code == 400
    assert res_inv.json()["status"] == "error"


def test_api_fetch_models_endpoint(monkeypatch):
    monkeypatch.setattr(
        "backend.ai_utils.fetch_provider_models",
        lambda provider, api_key: [{"id": "gemini-2.5-flash", "label": "Gemini 2.5 Flash"}]
    )
    res = client.post("/api/providers/models", json={"provider": "gemini", "api_key": "valid-key"})
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert len(data["models"]) == 1
    assert data["models"][0]["id"] == "gemini-2.5-flash"


def test_get_words_endpoint(tmp_path, monkeypatch):
    """Test getting words from a subtitle file."""
    src = tmp_path / "source.mp4"
    src.write_bytes(b"x")
    sub = tmp_path / "subs.words.json"
    sub.write_text('{"words": [{"word": "Hello", "start": 0.0, "end": 1.0}, {"word": "world", "start": 1.0, "end": 2.0}]}')
    
    metadata = {
        "source_video": str(src),
        "subtitle_path": str(sub),
        "title": "Orig"
    }
    history_record = {
        "id": "hist-abc",
        "url": f"local:{src}",
        "metadata": metadata,
        "result_clips": [{"path": "clip1.mp4", "start": "00:00:00", "end": "00:00:05", "description": "Desc"}]
    }
    
    monkeypatch.setattr("backend.db.get_history", lambda j_id: history_record if j_id == "hist-abc" else None)
    
    res = client.get("/jobs/hist-abc/clips/0/words")
    assert res.status_code == 200
    assert len(res.json()["words"]) == 2
    assert res.json()["words"][0]["word"] == "Hello"


def test_post_rerender_clip_endpoint(monkeypatch):
    """Test starting a rerender job."""
    history_record = {
        "id": "hist-abc",
        "url": f"local:video.mp4",
        "metadata": {"title": "Test"},
        "result_clips": [{"start": "0", "end": "5"}]
    }
    monkeypatch.setattr("backend.db.get_history", lambda j_id: history_record if j_id == "hist-abc" else None)
    monkeypatch.setattr("backend.jobs.create_rerender_clip_job", lambda *a, **k: "new-job-123")
    
    res = client.post("/jobs/hist-abc/clips/0/rerender", json={
        "words": [{"word": "Hi", "start": 0, "end": 1}],
        "aspect_ratio": "16:9",
        "caption_style": "standard",
        "burn_subs": True
    })
    
    assert res.status_code == 200
    assert res.json()["status"] == "success"
    assert res.json()["job_id"] == "new-job-123"
