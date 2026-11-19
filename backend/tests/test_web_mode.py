"""`backend --web`: one instance per computer, a browser tab with the token, the console text,
and a server on 127.0.0.1 only (SP1, spec 4.4 and 6)."""
import io
import json
import os
import socket
import subprocess
import sys
import threading
import time
from pathlib import Path

import pytest

from backend import path_guard, web_mode

REPO = Path(__file__).resolve().parents[2]


@pytest.fixture
def ui(tmp_path):
    folder = tmp_path / "ui"
    folder.mkdir()
    (folder / "index.html").write_text('<!doctype html><div id="root"></div>', encoding="utf-8")
    return folder


@pytest.fixture
def web_env(monkeypatch):
    """launch() switches web mode on in os.environ; monkeypatch puts the old values back."""
    for name in ("AUTO_CLIPPER_WEB_MODE", "AUTO_CLIPPER_UI_DIR", "AUTO_CLIPPER_WEB_TOKEN"):
        monkeypatch.setenv(name, "")


class FakeServer:
    """Stands in for run_server: records the call, reads the instance file while "running"."""

    def __init__(self, instance_file):
        self.instance_file = Path(instance_file)
        self.calls = []
        self.instance_during_run = None

    def __call__(self, app, port, on_ready):
        self.calls.append((app, port))
        self.instance_during_run = json.loads(self.instance_file.read_text(encoding="utf-8"))
        on_ready()


def _no_instance_expected(info):
    pytest.fail("there is no instance file to check")


def test_launch_starts_one_server_and_opens_the_app_with_its_token(tmp_path, ui, web_env):
    data = tmp_path / "data"
    serve = FakeServer(data / "web_instance.json")
    opened, out = [], io.StringIO()

    code = web_mode.launch("APP", ["--web", "--ui-dir", str(ui)], out, serve=serve,
                           open_browser=lambda url: opened.append(url) or True,
                           is_alive=_no_instance_expected, data_dir=str(data))

    assert code == 0
    [(app, port)] = serve.calls
    token = os.environ["AUTO_CLIPPER_WEB_TOKEN"]
    assert app == "APP"
    assert len(token) >= 32
    assert opened == [f"http://127.0.0.1:{port}/#t={token}"]
    assert serve.instance_during_run == {"port": port, "pid": os.getpid(), "token": token}
    assert os.environ["AUTO_CLIPPER_WEB_MODE"] == "1"
    assert os.environ["AUTO_CLIPPER_UI_DIR"] == str(ui)
    text = out.getvalue()
    assert "Auto Clipper berjalan. Jangan tutup jendela ini selama memakai aplikasi." in text
    assert "Auto Clipper is running. Do not close this window while you use the app." in text
    assert opened[0] in text
    assert not (data / "web_instance.json").exists()  # removed when the server stops


def test_a_second_launch_only_opens_a_tab_on_the_running_server(tmp_path, ui, web_env):
    data = tmp_path / "data"
    web_mode.write_instance(web_mode.instance_path(str(data)), 5123, 4242, "old-token")
    opened, out = [], io.StringIO()

    code = web_mode.launch("APP", ["--web", "--ui-dir", str(ui)], out,
                           serve=lambda *a: pytest.fail("must not start a second server"),
                           open_browser=lambda url: opened.append(url) or True,
                           is_alive=lambda info: info["port"] == 5123, data_dir=str(data))

    assert code == 0
    assert opened == ["http://127.0.0.1:5123/#t=old-token"]
    assert "Auto Clipper sudah berjalan" in out.getvalue()
    assert "already running" in out.getvalue()
    assert web_mode.read_instance(web_mode.instance_path(str(data)))["pid"] == 4242


def test_a_stale_instance_file_is_replaced_by_a_new_server(tmp_path, ui, web_env):
    data = tmp_path / "data"
    web_mode.write_instance(web_mode.instance_path(str(data)), 5123, 4242, "old-token")
    serve = FakeServer(data / "web_instance.json")

    web_mode.launch("APP", ["--web", "--ui-dir", str(ui)], io.StringIO(), serve=serve,
                    open_browser=lambda url: True, is_alive=lambda info: False, data_dir=str(data))

    assert serve.instance_during_run["pid"] == os.getpid()
    assert serve.instance_during_run["token"] != "old-token"


@pytest.mark.parametrize("content", [
    "",
    "not json",
    "[]",
    '{"port": "5123", "pid": 1, "token": "t"}',
    '{"port": 5123, "pid": 1, "token": ""}',
])
def test_an_unreadable_instance_file_counts_as_no_instance(tmp_path, content):
    path = tmp_path / "web_instance.json"
    path.write_text(content, encoding="utf-8")

    assert web_mode.read_instance(str(path)) is None


def test_launch_without_the_ui_folder_explains_and_stops(tmp_path, web_env):
    out = io.StringIO()

    code = web_mode.launch("APP", ["--web", "--ui-dir", str(tmp_path / "missing")], out,
                           serve=lambda *a: pytest.fail("must not start"), data_dir=str(tmp_path / "data"))

    assert code == 1
    assert "tidak ditemukan" in out.getvalue()
    assert "was not found" in out.getvalue()


def test_the_browser_can_be_switched_off_for_the_ci_smoke_test(monkeypatch):
    monkeypatch.setenv("AUTO_CLIPPER_NO_BROWSER", "1")
    monkeypatch.setattr(web_mode.webbrowser, "open", lambda url: pytest.fail("browser opened"))

    assert web_mode.open_in_browser("http://127.0.0.1:1/#t=x") is False


def test_the_instance_file_of_a_newer_launch_is_left_alone(tmp_path):
    path = str(tmp_path / "web_instance.json")
    web_mode.write_instance(path, 5123, 999999, "newer")

    web_mode.remove_instance(path, os.getpid())

    assert web_mode.read_instance(path)["token"] == "newer"


@pytest.mark.skipif(sys.platform == "win32", reason="POSIX file modes")
def test_instance_file_is_readable_by_its_owner_only(tmp_path):
    path = tmp_path / "web_instance.json"

    web_mode.write_instance(str(path), 5123, 1, "secret")

    assert path.stat().st_mode & 0o077 == 0


def test_path_guard_protects_the_instance_file(tmp_path):
    assert path_guard.is_protected(str(tmp_path / "web_instance.json"))
    assert path_guard.is_protected(str(tmp_path / "web_instance.json.1a2b3c4d.part"))


def test_free_port_is_free_on_loopback():
    port = web_mode.free_port()

    assert 0 < port < 65536
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", port))
        assert s.getsockname()[1] == port


def test_ui_folder_defaults_to_the_vite_build_of_a_source_checkout():
    norm = lambda p: os.path.normcase(os.path.realpath(p))
    assert norm(web_mode.ui_dir_from_args(["--web"])) == norm(str(REPO / "dist"))
    assert norm(web_mode.ui_dir_from_args(["--web", "--ui-dir", "some/ui"])) == norm(os.path.abspath("some/ui"))


def test_the_server_listens_on_127_0_0_1_only_and_answers_its_own_token(ui, web_env, monkeypatch):
    from backend import main
    token = "integration-token"
    monkeypatch.setenv("AUTO_CLIPPER_WEB_MODE", "1")
    monkeypatch.setenv("AUTO_CLIPPER_UI_DIR", str(ui))
    monkeypatch.setenv("AUTO_CLIPPER_WEB_TOKEN", token)
    port = web_mode.free_port()
    server = web_mode.make_server(main.app, port)
    thread = threading.Thread(target=server.run, daemon=True)
    thread.start()
    try:
        deadline = time.monotonic() + 30
        while not server.started and time.monotonic() < deadline:
            time.sleep(0.05)
        assert server.started
        assert server.config.host == "127.0.0.1"
        assert {sock.getsockname()[0] for srv in server.servers for sock in srv.sockets} == {"127.0.0.1"}
        assert web_mode.instance_alive({"port": port, "pid": os.getpid(), "token": token})
        assert not web_mode.instance_alive({"port": port, "pid": os.getpid(), "token": "wrong"})
    finally:
        server.should_exit = True
        thread.join(timeout=10)
    assert not web_mode.instance_alive({"port": port, "pid": 1, "token": token}, timeout=0.5)


def test_backend_main_with_web_flag_runs_the_launcher(tmp_path):
    env = dict(os.environ, AUTO_CLIPPER_WORKSPACE=str(tmp_path / "library"), AUTO_CLIPPER_NO_BROWSER="1")

    result = subprocess.run(
        [sys.executable, "-m", "backend.main", "--web", "--ui-dir", str(tmp_path / "missing")],
        cwd=str(REPO), env=env, capture_output=True, text=True, timeout=180,
    )

    assert result.returncode == 1
    assert "was not found" in result.stdout
