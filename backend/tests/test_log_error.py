import pytest
from fastapi.testclient import TestClient
from backend.main import app
import os
from backend.logger import log_error, get_error_log_path, get_log_content, log_app, log_ai

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

def test_log_error_with_string_and_exception(tmp_path, monkeypatch):
    test_log = str(tmp_path / "test_error.log")
    monkeypatch.setattr("backend.logger.get_error_log_path", lambda: test_log)
    
    # 1. Test string error
    log_error("test_context", "Something went wrong")
    assert os.path.exists(test_log)
    with open(test_log, "r", encoding="utf-8") as f:
        content = f.read()
    assert "[test_context] ERROR:" in content
    assert "Something went wrong" in content
    
    # 2. Test Exception object
    try:
        raise ValueError("Custom test value error")
    except Exception as e:
        log_error("test_exception_context", e)
        
    with open(test_log, "r", encoding="utf-8") as f:
        content2 = f.read()
    assert "[test_exception_context] ERROR:" in content2
    assert "Custom test value error" in content2
    assert "Traceback" in content2

def test_get_log_content(tmp_path, monkeypatch):
    app_log = str(tmp_path / "test_app.log")
    error_log = str(tmp_path / "test_error.log")
    ai_log = str(tmp_path / "test_ai.log")
    monkeypatch.setattr("backend.logger.get_app_log_path", lambda: app_log)
    monkeypatch.setattr("backend.logger.get_error_log_path", lambda: error_log)
    monkeypatch.setattr("backend.logger.get_ai_log_path", lambda: ai_log)
    
    # Empty / non-existent log
    assert get_log_content("app") == ""
    
    # Write some lines
    log_app("Line 1")
    log_app("Line 2")
    log_app("Line 3")
    
    content = get_log_content("app", max_lines=2)
    assert "Line 2" in content
    assert "Line 3" in content
    assert "Line 1" not in content
