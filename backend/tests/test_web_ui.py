"""Local web mode: the backend serves the built UI and every API call needs the launch token (SP1, spec 4.4)."""
import os
import sys

import pytest
from fastapi.testclient import TestClient

from backend import main, video_sign, web_ui
from backend.logger import get_app_data_dir

client = TestClient(main.app)

TOKEN = "web-launch-token"
AUTH = {"Authorization": f"Bearer {TOKEN}"}


@pytest.fixture
def web(tmp_path, monkeypatch):
    """A built UI folder and web mode switched on, the way backend.web_mode.launch does it."""
    ui = tmp_path / "ui"
    (ui / "assets").mkdir(parents=True)
    (ui / "index.html").write_text('<!doctype html><title>Auto Clipper</title><div id="root"></div>', encoding="utf-8")
    (ui / "assets" / "index-abc123.js").write_text("console.log('ui')", encoding="utf-8")
    (ui / "assets" / "index-abc123.css").write_text("body{}", encoding="utf-8")
    (ui / "logo.svg").write_text("<svg/>", encoding="utf-8")
    (ui / "character.png").write_bytes(b"\x89PNG")
    (tmp_path / "secret.txt").write_text("not ui", encoding="utf-8")
    monkeypatch.setenv("AUTO_CLIPPER_WEB_MODE", "1")
    monkeypatch.setenv("AUTO_CLIPPER_UI_DIR", str(ui))
    monkeypatch.setenv("AUTO_CLIPPER_WEB_TOKEN", TOKEN)
    monkeypatch.delenv("AUTO_CLIPPER_CLOUD_MODE", raising=False)
    return ui


def test_index_is_served_without_the_token(web):
    r = client.get("/")

    assert r.status_code == 200
    assert '<div id="root">' in r.text
    assert r.headers["content-type"].startswith("text/html")
    assert r.headers["cache-control"] == "no-cache"


def test_assets_are_served_without_the_token_with_types_the_browser_accepts(web):
    js = client.get("/assets/index-abc123.js")
    css = client.get("/assets/index-abc123.css")

    assert (js.status_code, css.status_code) == (200, 200)
    assert js.headers["content-type"].startswith("text/javascript")
    assert css.headers["content-type"].startswith("text/css")
    assert "immutable" in js.headers["cache-control"]


def test_image_files_at_the_top_of_the_ui_folder_are_served(web):
    svg = client.get("/logo.svg")
    png = client.get("/character.png")

    assert (svg.status_code, png.status_code) == (200, 200)
    assert svg.headers["content-type"].startswith("image/svg+xml")
    assert png.content == b"\x89PNG"


def test_missing_files_and_files_outside_the_ui_folder_are_not_found(web):
    for url in ("/assets/missing.js", "/assets/%2E%2E/%2E%2E/secret.txt", "/assets/..%2F..%2Fsecret.txt", "/secret.txt", "/index.html"):
        r = client.get(url, headers=AUTH)
        assert r.status_code == 404, url
        assert b"not ui" not in r.content


def test_protected_files_inside_the_ui_folder_are_never_served(web):
    (web / "assets" / "history.db").write_text("secret db", encoding="utf-8")
    (web / "assets" / "backend_error.log").write_text("secret log", encoding="utf-8")
    (web / "history.db.png").write_bytes(b"secret db png")

    for url in ("/assets/history.db", "/assets/backend_error.log", "/history.db.png"):
        r = client.get(url, headers=AUTH)
        assert r.status_code == 404, url
        assert b"secret" not in r.content


def test_ui_routes_do_not_shadow_the_api(web):
    r = client.get("/history", headers=AUTH)

    assert r.status_code == 200
    assert r.json()["status"] == "success"


def test_api_needs_the_launch_token_in_web_mode(web):
    assert client.get("/history").status_code == 401
    assert client.get("/history", headers={"Authorization": "Bearer wrong"}).status_code == 401
    assert client.get("/history", headers=AUTH).status_code == 200
    assert client.post("/video-url", json={"path": "x.mp4"}).status_code == 401


def test_heartbeat_needs_the_token_in_web_mode_but_health_does_not(web):
    assert client.post("/heartbeat").status_code == 401
    assert client.post("/heartbeat", headers=AUTH).status_code == 200
    assert client.get("/health").status_code == 200


def test_video_uses_its_signature_not_the_token_in_web_mode(web):
    clip = os.path.join(get_app_data_dir(), "projects", "Web", "clips", "clip_1.mp4")
    os.makedirs(os.path.dirname(clip), exist_ok=True)
    with open(clip, "wb") as f:
        f.write(b"web clip")

    r = client.get(video_sign.signed_url(clip))

    assert r.status_code == 200
    assert r.content == b"web clip"


def test_ui_is_not_served_outside_web_mode(web, monkeypatch):
    monkeypatch.delenv("AUTO_CLIPPER_WEB_MODE")

    assert client.get("/").status_code == 404
    assert client.get("/assets/index-abc123.js").status_code == 404
    assert client.get("/history").status_code == 200  # desktop dev: no token, as before


def test_web_mode_without_a_ui_folder_answers_not_found(web, monkeypatch):
    monkeypatch.delenv("AUTO_CLIPPER_UI_DIR")

    assert client.get("/").status_code == 404


def test_installed_desktop_rules_are_unchanged(monkeypatch):
    monkeypatch.delenv("AUTO_CLIPPER_WEB_MODE", raising=False)
    monkeypatch.delenv("AUTO_CLIPPER_CLOUD_MODE", raising=False)
    monkeypatch.setenv("AUTO_CLIPPER_WEB_TOKEN", TOKEN)
    monkeypatch.setattr(sys, "frozen", True, raising=False)

    assert client.get("/history").status_code == 401
    assert client.get("/history", headers=AUTH).status_code == 200
    assert client.post("/heartbeat").status_code == 200
    assert client.get("/").status_code == 401  # not a public path outside web mode


@pytest.mark.parametrize("path, public", [
    ("/", True),
    ("/health", True),
    ("/assets/index-abc123.js", True),
    ("/logo.svg", True),
    ("/character.png", True),
    ("/favicon.ico", True),
    ("/history", False),
    ("/heartbeat", False),
    ("/video-url", False),
    ("/assets", False),
    ("/api/settings/logo.png", False),
    ("/index.html", False),
])
def test_public_paths(path, public):
    assert web_ui.is_public_path(path) is public


# Encoded so the URL reaches the route as text with "\" and ":" in it.
NETWORK_ASSET_URLS = [
    "/assets/%5C%5C192.0.2.1%5Cs%5Cx.js",
    "/assets/%5C%5C192.0.2.1/s/x.js",
    "/assets/%5C%5C%3F%5CUNC%5C192.0.2.1%5Cs%5Cx.js",
    "/assets/C:%5C192.0.2.1%5Cx.js",
    "/assets/C:/192.0.2.1/x.js",
    "/assets/x.js:192.0.2.1",
]


@pytest.mark.parametrize("url", NETWORK_ASSET_URLS)
def test_an_asset_path_naming_a_network_share_is_refused_before_touching_it(web, no_filesystem_for_the_server, url):
    """No token is needed for /assets/, so a page on any site could make the browser ask for one.

    os.path.join drops the UI folder for a part starting with "\\\\" or a drive,
    and resolving that UNC path would open an SMB connection to the host.
    """
    r = client.get(url)

    assert r.status_code == 404
    assert no_filesystem_for_the_server == []


def test_an_asset_with_a_backslash_or_colon_in_its_name_is_not_served(web):
    (web / "assets" / "a-b.js").write_text("ok", encoding="utf-8")

    assert client.get("/assets/a-b.js").status_code == 200
    assert client.get("/assets/a%5Cb.js").status_code == 404
    assert client.get("/assets/a:b.js").status_code == 404
