"""Scripts of the local web package (SP1, spec 4.6): the Windows launcher, the package layout,
the macOS/Linux launch scripts and the CI smoke test."""
import importlib.util
import io
import os
import stat
import sys
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[2]
SCRIPTS = REPO / "scripts"
PACKAGING = REPO / "packaging" / "web"


def _load(name):
    spec = importlib.util.spec_from_file_location(name, SCRIPTS / f"{name}.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


# --- scripts/web_launcher.py (Auto Clipper Web.exe) ------------------------------------------

def test_launcher_runs_the_backend_in_web_mode_with_the_ui_next_to_it(tmp_path):
    launcher = _load("web_launcher")
    app = tmp_path / "app"
    app.mkdir()
    (app / "backend.exe").write_bytes(b"")
    ran = []

    code = launcher.main(str(tmp_path), run=lambda cmd: ran.append(cmd) or 0, out=io.StringIO(),
                         wait=lambda prompt: pytest.fail("no pause after a normal stop"))

    assert code == 0
    assert ran == [[str(app / "backend.exe"), "--web", "--ui-dir", str(app / "ui")]]


def test_launcher_keeps_the_window_open_when_the_backend_fails(tmp_path):
    launcher = _load("web_launcher")
    (tmp_path / "app").mkdir()
    (tmp_path / "app" / "backend.exe").write_bytes(b"")
    waited = []

    code = launcher.main(str(tmp_path), run=lambda cmd: 1, out=io.StringIO(), wait=lambda prompt: waited.append(prompt))

    assert code == 1
    assert waited and "Enter" in waited[0]


def test_launcher_explains_a_package_that_was_not_extracted(tmp_path):
    launcher = _load("web_launcher")
    out, waited = io.StringIO(), []

    code = launcher.main(str(tmp_path), run=lambda cmd: pytest.fail("nothing to run"), out=out,
                         wait=lambda prompt: waited.append(prompt))

    assert code == 1
    assert "ekstrak" in out.getvalue()
    assert "extract" in out.getvalue()
    assert waited


def test_launcher_explains_a_backend_that_cannot_start(tmp_path):
    """Antivirus often blocks the unsigned backend.exe: explain it instead of closing on a traceback."""
    launcher = _load("web_launcher")
    (tmp_path / "app").mkdir()
    (tmp_path / "app" / "backend.exe").write_bytes(b"")
    out, waited = io.StringIO(), []

    def blocked(cmd):
        raise PermissionError(13, "Access is denied")

    code = launcher.main(str(tmp_path), run=blocked, out=out, wait=lambda prompt: waited.append(prompt))

    assert code == 1
    text = out.getvalue()
    assert "tidak bisa dijalankan" in text
    assert "could not be started" in text
    assert "antivirus" in text
    assert "Access is denied" in text  # the technical detail, for a bug report
    assert waited


def test_launcher_survives_a_window_without_input(tmp_path):
    launcher = _load("web_launcher")

    def no_input(prompt):
        raise EOFError

    assert launcher.main(str(tmp_path), run=lambda cmd: 0, out=io.StringIO(), wait=no_input) == 1


# --- scripts/assemble_web_package.py ---------------------------------------------------------

def _fake_build(tmp_path, target):
    dist = tmp_path / "dist"
    if target == "windows":
        dist.mkdir()
        (dist / "backend.exe").write_bytes(b"exe")
    elif target == "linux":
        dist.mkdir()
        (dist / "backend").write_bytes(b"elf")
    else:
        (dist / "backend_app" / "_internal").mkdir(parents=True)
        (dist / "backend_app" / "backend").write_bytes(b"macho")
        (dist / "backend_app" / "_internal" / "lib.dylib").write_bytes(b"lib")
    ui = tmp_path / "web-ui"
    (ui / "assets").mkdir(parents=True)
    (ui / "index.html").write_text('<div id="root"></div>', encoding="utf-8")
    (ui / "assets" / "index-1.js").write_text("js", encoding="utf-8")
    ffmpeg = tmp_path / ("ffmpeg.exe" if target == "windows" else "ffmpeg")
    ffmpeg.write_bytes(b"ff")
    launcher = tmp_path / "Auto Clipper Web.exe"
    launcher.write_bytes(b"launcher")
    return dist, ui, ffmpeg, launcher


MAC_FILES = ["Auto Clipper Web.command", "BACA-SAYA.txt", "app/backend/backend", "app/backend/_internal/lib.dylib",
             "app/ffmpeg", "app/ui/assets/index-1.js", "app/ui/index.html"]
EXPECTED = {
    "windows": ["Auto Clipper Web.exe", "BACA-SAYA.txt", "app/backend.exe", "app/ffmpeg.exe",
                "app/ui/assets/index-1.js", "app/ui/index.html"],
    "linux": ["Auto Clipper Web.sh", "BACA-SAYA.txt", "app/backend", "app/ffmpeg",
              "app/ui/assets/index-1.js", "app/ui/index.html"],
    "macos-arm64": MAC_FILES,
    "macos-x64": MAC_FILES,
}


def _assemble(tmp_path, target):
    assemble = _load("assemble_web_package")
    dist, ui, ffmpeg, launcher = _fake_build(tmp_path, target)
    out = tmp_path / "pkg" / "Auto Clipper Web"
    assemble.assemble(target, str(out), backend_dist=str(dist), ui_dist=str(ui), ffmpeg=str(ffmpeg),
                      launcher_exe=str(launcher), packaging_dir=str(PACKAGING))
    return out


@pytest.mark.parametrize("target", sorted(EXPECTED))
def test_package_layout(tmp_path, target):
    out = _assemble(tmp_path, target)

    files = sorted(p.relative_to(out).as_posix() for p in out.rglob("*") if p.is_file())
    assert files == sorted(EXPECTED[target])


@pytest.mark.skipif(sys.platform == "win32", reason="POSIX file modes")
@pytest.mark.parametrize("target, programs", [
    ("linux", ["Auto Clipper Web.sh", "app/backend", "app/ffmpeg"]),
    ("macos-arm64", ["Auto Clipper Web.command", "app/backend/backend", "app/ffmpeg"]),
])
def test_launchers_and_programs_are_executable(tmp_path, target, programs):
    out = _assemble(tmp_path, target)

    for rel in programs:
        assert os.stat(out / rel).st_mode & stat.S_IXUSR, rel


def test_a_package_without_the_built_ui_is_refused(tmp_path):
    assemble = _load("assemble_web_package")
    dist, ui, ffmpeg, launcher = _fake_build(tmp_path, "linux")
    (ui / "index.html").unlink()

    with pytest.raises(SystemExit, match="index.html"):
        assemble.assemble("linux", str(tmp_path / "out"), backend_dist=str(dist), ui_dist=str(ui),
                          ffmpeg=str(ffmpeg), packaging_dir=str(PACKAGING))


def test_an_unknown_target_is_refused(tmp_path):
    assemble = _load("assemble_web_package")

    with pytest.raises(SystemExit, match="unknown target"):
        assemble.assemble("windows-arm", str(tmp_path / "out"), backend_dist=str(tmp_path), ui_dist=str(tmp_path),
                          ffmpeg=str(tmp_path / "ffmpeg"), packaging_dir=str(PACKAGING))


# --- packaging/web ---------------------------------------------------------------------------

@pytest.mark.parametrize("name, command", [
    ("Auto Clipper Web.command", '"$DIR/app/backend/backend" --web --ui-dir "$DIR/app/ui"'),
    ("Auto Clipper Web.sh", '"$DIR/app/backend" --web --ui-dir "$DIR/app/ui"'),
])
def test_unix_launchers_start_the_backend_in_web_mode(name, command):
    text = (PACKAGING / name).read_bytes()

    assert text.startswith(b"#!/usr/bin/env bash\n")
    assert b"\r\n" not in text  # bash on macOS/Linux fails on CRLF; .gitattributes keeps LF
    assert command.encode() in text


def test_readme_explains_every_os_in_both_languages():
    text = (PACKAGING / "BACA-SAYA.txt").read_text(encoding="utf-8")

    for phrase in ("Windows", "macOS", "Linux", "Run anyway", "Open", "Jangan tutup", "Do not close", "#t="):
        assert phrase in text, phrase


# --- scripts/smoke_web_package.py ------------------------------------------------------------

def test_smoke_test_reads_the_address_line():
    smoke = _load("smoke_web_package")

    assert smoke.parse_address("http://127.0.0.1:5123/#t=abc-_DEF09\n") == (5123, "abc-_DEF09")
    assert smoke.parse_address("Auto Clipper berjalan. Jangan tutup jendela ini selama memakai aplikasi.") is None


def test_smoke_test_finds_the_script_of_the_built_page():
    smoke = _load("smoke_web_package")
    html = '<script type="module" crossorigin src="./assets/index-AbC1.js"></script>'

    assert smoke.first_asset(html) == "assets/index-AbC1.js"
    assert smoke.first_asset("<html></html>") is None


def test_smoke_request_treats_remote_disconnected_as_stopped(monkeypatch):
    import http.client

    smoke = _load("smoke_web_package")

    def drop(*args, **kwargs):
        raise http.client.RemoteDisconnected("closed during shutdown")

    monkeypatch.setattr(smoke.urllib.request, "urlopen", drop)

    assert smoke._request("http://127.0.0.1:9/health") == (None, "", b"")


def test_smoke_wait_stopped_polls_until_server_closes(monkeypatch):
    smoke = _load("smoke_web_package")
    replies = iter([(200, "application/json", b"{}"), (None, "", b"")])

    monkeypatch.setattr(smoke, "_request", lambda url: next(replies))

    assert smoke._wait_stopped("http://127.0.0.1:9", timeout=1.0, interval=0.0) is True

    monkeypatch.setattr(smoke, "_request", lambda url: (200, "application/json", b"{}"))
    assert smoke._wait_stopped("http://127.0.0.1:9", timeout=0.0, interval=0.0) is False
