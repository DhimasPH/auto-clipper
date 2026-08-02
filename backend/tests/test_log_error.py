import pytest
from fastapi.testclient import TestClient
from backend.main import app
import os
from backend.logger import get_error_log_path

client = TestClient(app)

def test_log_error_endpoint():
    payload = {
        "context": "TestStartupUpdater",
        "error_msg": "Test network timeout error"
    }
    response = client.post("/log-error", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    
    log_path = get_error_log_path()
    assert os.path.exists(log_path)
    with open(log_path, "r", encoding="utf-8") as f:
        content = f.read()
        assert "TestStartupUpdater" in content
        assert "Test network timeout error" in content
