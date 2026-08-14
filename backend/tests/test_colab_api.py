import os
import subprocess
import sys
from unittest.mock import MagicMock, patch

import pytest
from backend.colab_api import (
    DEFAULT_HOST,
    DEFAULT_PORT,
    DEFAULT_WORKSPACE,
    parse_args,
    run_server,
    setup_environment,
    start_cloudflared,
    start_uvicorn,
    terminate_processes,
)


@pytest.fixture(autouse=True)
def preserve_environment():
    """Ensure tests in this module do not pollute os.environ for other tests."""
    original_environ = os.environ.copy()
    yield
    os.environ.clear()
    os.environ.update(original_environ)


def test_parse_args_defaults(monkeypatch):
    monkeypatch.delenv("CLOUDFLARE_TOKEN", raising=False)
    monkeypatch.delenv("CF_TUNNEL_TOKEN", raising=False)
    monkeypatch.delenv("API_SECRET_TOKEN", raising=False)
    monkeypatch.delenv("AUTO_CLIPPER_DEV_TOKEN", raising=False)
    monkeypatch.delenv("AUTO_CLIPPER_WEB_TOKEN", raising=False)
    monkeypatch.delenv("AUTO_CLIPPER_WORKSPACE", raising=False)
    monkeypatch.delenv("HOST", raising=False)
    monkeypatch.delenv("PORT", raising=False)

    args = parse_args([])
    assert args.cloudflare_token == ""
    assert args.api_token == ""
    assert args.workspace == DEFAULT_WORKSPACE
    assert args.host == DEFAULT_HOST
    assert args.port == DEFAULT_PORT


def test_parse_args_from_env(monkeypatch):
    monkeypatch.setenv("CLOUDFLARE_TOKEN", "cf-test-token")
    monkeypatch.setenv("API_SECRET_TOKEN", "api-test-token")
    monkeypatch.setenv("AUTO_CLIPPER_WORKSPACE", "/custom/path")
    monkeypatch.setenv("HOST", "127.0.0.1")
    monkeypatch.setenv("PORT", "9000")

    args = parse_args([])
    assert args.cloudflare_token == "cf-test-token"
    assert args.api_token == "api-test-token"
    assert args.workspace == "/custom/path"
    assert args.host == "127.0.0.1"
    assert args.port == 9000


def test_parse_args_cli_overrides_env(monkeypatch):
    monkeypatch.setenv("CLOUDFLARE_TOKEN", "cf-env-token")
    monkeypatch.setenv("API_SECRET_TOKEN", "api-env-token")

    args = parse_args([
        "--cloudflare-token", "cf-cli-token",
        "--api-token", "api-cli-token",
        "--workspace", "/cli/workspace",
        "--host", "0.0.0.0",
        "--port", "8888",
    ])
    assert args.cloudflare_token == "cf-cli-token"
    assert args.api_token == "api-cli-token"
    assert args.workspace == "/cli/workspace"
    assert args.host == "0.0.0.0"
    assert args.port == 8888


def test_setup_environment(tmp_path):
    ws_dir = str(tmp_path / "autoclipper_ws")
    setup_environment(ws_dir, api_token="my-secret-key")

    assert os.environ.get("AUTO_CLIPPER_CLOUD_MODE") == "1"
    assert os.environ.get("AUTO_CLIPPER_WORKSPACE") == ws_dir
    assert os.environ.get("AUTO_CLIPPER_DEV_TOKEN") == "my-secret-key"
    assert os.environ.get("AUTO_CLIPPER_WEB_TOKEN") == "my-secret-key"
    assert os.environ.get("API_SECRET_TOKEN") == "my-secret-key"
    assert os.path.isdir(ws_dir)


def test_setup_environment_handles_dir_error():
    with patch("os.makedirs", side_effect=PermissionError("Cannot write directory")):
        # Should not raise uncaught exception, but print warning
        setup_environment("/invalid/dir", api_token="token")
        assert os.environ.get("AUTO_CLIPPER_CLOUD_MODE") == "1"


def test_start_uvicorn():
    with patch("subprocess.Popen") as mock_popen:
        mock_proc = MagicMock()
        mock_popen.return_value = mock_proc

        proc = start_uvicorn("0.0.0.0", 8000)
        assert proc == mock_proc
        mock_popen.assert_called_once()
        cmd = mock_popen.call_args[0][0]
        assert cmd[0] == sys.executable
        assert "-m" in cmd
        assert "uvicorn" in cmd
        assert "backend.main:app" in cmd
        assert "--host" in cmd
        assert "0.0.0.0" in cmd
        assert "--port" in cmd
        assert "8000" in cmd


def test_start_cloudflared_empty():
    assert start_cloudflared("") is None
    assert start_cloudflared("   ") is None


def test_start_cloudflared_with_token():
    with patch("subprocess.Popen") as mock_popen:
        mock_proc = MagicMock()
        mock_popen.return_value = mock_proc

        proc = start_cloudflared("cf-token-123")
        assert proc == mock_proc
        mock_popen.assert_called_once()
        cmd = mock_popen.call_args[0][0]
        assert cmd == ["cloudflared", "tunnel", "run", "--token", "cf-token-123"]


def test_start_cloudflared_not_found():
    with patch("subprocess.Popen", side_effect=FileNotFoundError("Executable not found")):
        proc = start_cloudflared("cf-token-123")
        assert proc is None


def test_terminate_processes():
    proc1 = MagicMock(spec=subprocess.Popen)
    proc1.poll.return_value = 0
    proc1.pid = 1001

    proc2 = MagicMock(spec=subprocess.Popen)
    proc2.poll.return_value = None  # Still running
    proc2.wait.side_effect = subprocess.TimeoutExpired(cmd="test", timeout=0.1)
    proc2.pid = 1002

    terminate_processes([proc1, proc2], timeout=0.1)

    proc1.terminate.assert_not_called()
    proc2.terminate.assert_called_once()
    proc2.kill.assert_called_once()


def test_run_server_lifecycle():
    polls = [None, 0]

    def mock_poll():
        if polls:
            return polls.pop(0)
        return 0

    mock_api = MagicMock(spec=subprocess.Popen)
    mock_api.poll.side_effect = mock_poll
    mock_api.returncode = 0
    mock_api.pid = 5001

    mock_cf = MagicMock(spec=subprocess.Popen)
    mock_cf.poll.return_value = None
    mock_cf.pid = 5002

    with patch("backend.colab_api.start_uvicorn", return_value=mock_api):
        with patch("backend.colab_api.start_cloudflared", return_value=mock_cf):
            with patch("time.sleep", return_value=None):
                code = run_server(["--cloudflare-token", "token-xyz", "--workspace", "/tmp/ws"])
                assert code == 0
                mock_cf.terminate.assert_called()
