from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)


def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_process_ai_missing_file_returns_404():
    r = client.post("/process-ai", json={"file_path": "/nope.mp4", "api_key": "x"})
    assert r.status_code == 404
    assert r.json()["status"] == "error"


def test_crop_missing_file_returns_404():
    r = client.post(
        "/crop",
        json={"file_path": "/nope.mp4", "start_time": "0", "end_time": "1"},
    )
    assert r.status_code == 404
    assert r.json()["status"] == "error"


def test_video_missing_returns_404():
    r = client.get("/video", params={"path": "/nope.mp4"})
    assert r.status_code == 404
