"""Auto Clipper Web update notice (SP4 spec 4.5): backend/update_check.py and GET /api/update-check."""
import json
import urllib.error

import pytest
from fastapi.testclient import TestClient

from backend import main, update_check

client = TestClient(main.app)
BASE = "https://github.com/DhimasPH/auto-clipper/releases/"


def _release(tag="app-v1.20.0", host=BASE):
    return {
        "tag_name": tag,
        "html_url": f"{BASE}tag/{tag}",
        "assets": [
            {"name": f"Auto-Clipper-Web-{t}.zip", "browser_download_url": f"{host}download/{tag}/Auto-Clipper-Web-{t}.zip"}
            for t in update_check.TARGETS
        ] + [{"name": "latest.json", "browser_download_url": f"{BASE}download/{tag}/latest.json"}],
    }


@pytest.fixture
def fetches(monkeypatch):
    calls = []

    def fake():
        calls.append(1)
        return _release()

    monkeypatch.setattr(update_check, "fetch_latest_release", fake)
    return calls


def test_versions_are_read_strictly():
    assert update_check.parse_version("1.19.0") == (1, 19, 0)
    for bad in ("", "1.19", "v1.19.0", "1.19.0-beta", "1.\u0661\u0669.0", None, 5):
        assert update_check.parse_version(bad) is None


@pytest.mark.parametrize("plat, machine, target", [
    ("win32", "AMD64", "windows"),
    ("darwin", "arm64", "macos-arm64"),
    ("darwin", "x86_64", "macos-x64"),
    ("linux", "x86_64", "linux"),
    ("freebsd13", "amd64", None),
])
def test_the_package_follows_the_running_system(plat, machine, target):
    assert update_check.package_target(plat, machine) == target


@pytest.mark.parametrize("target", update_check.TARGETS)
def test_picks_the_zip_for_this_system(target):
    assert update_check.summarize(_release(), target) == {
        "latest": "1.20.0",
        "download_url": f"{BASE}download/app-v1.20.0/Auto-Clipper-Web-{target}.zip",
        "release_url": f"{BASE}tag/app-v1.20.0",
    }


def test_refuses_links_outside_the_repository_releases():
    info = update_check.summarize(_release(host="https://evil.example/DhimasPH/auto-clipper/releases/"), "windows")
    assert info["download_url"] is None
    assert info["release_url"] == f"{BASE}tag/app-v1.20.0"
    sneaky = _release()
    sneaky["html_url"] = "https://github.com/DhimasPH/auto-clipper-evil/releases/tag/x"
    assert update_check.summarize(sneaky, "linux")["release_url"] is None


def test_an_unexpected_tag_is_a_bad_answer():
    with pytest.raises(ValueError):
        update_check.summarize({"tag_name": "nightly"}, "linux")


@pytest.mark.parametrize("current, available", [("1.19.0", True), ("1.20.0", False), ("1.21.0", False), ("1.9.9", True)])
def test_says_whether_a_newer_version_exists(tmp_path, fetches, current, available):
    result = update_check.check(current, cache_path=str(tmp_path / "c.json"), now=1000.0, target="linux")

    assert result["update_available"] is available
    assert (result["current"], result["latest"], result["checked_at"]) == (current, "1.20.0", 1000.0)
    assert "error" not in result


def test_asks_github_at_most_once_a_day_unless_forced(tmp_path, fetches):
    cache = str(tmp_path / "update_check.json")
    update_check.check("1.19.0", cache_path=cache, now=1000.0, target="linux")
    update_check.check("1.19.0", cache_path=cache, now=1000.0 + 3600, target="linux")
    assert len(fetches) == 1
    update_check.check("1.19.0", cache_path=cache, now=1000.0 + 3600, target="linux", force=True)
    assert len(fetches) == 2
    update_check.check("1.19.0", cache_path=cache, now=1000.0 + 3600 + 24 * 3600, target="linux")
    assert len(fetches) == 3


def test_a_tampered_cache_cannot_hand_out_a_foreign_link(tmp_path, fetches):
    cache = tmp_path / "update_check.json"
    cache.write_text(json.dumps({
        "latest": "9.0.0", "download_url": "https://evil.example/x.zip", "release_url": "https://evil.example/",
        "target": "linux", "checked_at": 1000.0,
    }), encoding="utf-8")

    result = update_check.check("1.19.0", cache_path=str(cache), now=1001.0, target="linux")

    assert fetches == []
    assert (result["download_url"], result["release_url"]) == (None, None)


@pytest.mark.parametrize("exc, kind", [
    (urllib.error.URLError("no network"), "offline"),
    (TimeoutError("slow"), "offline"),
    (urllib.error.HTTPError(update_check.LATEST_RELEASE_API, 403, "rate limited", {}, None), "rate_limited"),
    (urllib.error.HTTPError(update_check.LATEST_RELEASE_API, 404, "not found", {}, None), "bad_answer"),
    (ValueError("bad json"), "bad_answer"),
])
def test_a_failed_check_is_a_quiet_answer_and_is_not_cached(tmp_path, monkeypatch, exc, kind):
    def fail():
        raise exc

    monkeypatch.setattr(update_check, "fetch_latest_release", fail)
    cache = tmp_path / "update_check.json"

    result = update_check.check("1.19.0", cache_path=str(cache), now=5.0, target="linux")

    assert result == {
        "current": "1.19.0", "latest": None, "update_available": False, "download_url": None,
        "release_url": None, "checked_at": 5.0, "error": kind,
    }
    assert not cache.exists()


def test_the_request_names_no_user_and_asks_only_github(monkeypatch):
    seen = {}

    class Answer:
        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

        def read(self, limit):
            seen["limit"] = limit
            return json.dumps(_release()).encode("utf-8")

    def fake_urlopen(request, timeout):
        seen.update(url=request.full_url, headers=dict(request.header_items()), data=request.data,
                    method=request.get_method(), timeout=timeout)
        return Answer()

    monkeypatch.setattr(update_check.urllib.request, "urlopen", fake_urlopen)

    assert update_check.fetch_latest_release()["tag_name"] == "app-v1.20.0"
    assert seen["url"] == "https://api.github.com/repos/DhimasPH/auto-clipper/releases/latest"
    assert (seen["method"], seen["data"]) == ("GET", None)
    assert seen["headers"] == {"User-agent": "AutoClipper-UpdateCheck", "Accept": "application/vnd.github+json"}
    assert (seen["timeout"], seen["limit"]) == (5, 1_000_000)


@pytest.fixture
def web(tmp_path, monkeypatch):
    monkeypatch.setenv("AUTO_CLIPPER_WORKSPACE", str(tmp_path / "data"))
    monkeypatch.setenv("AUTO_CLIPPER_WEB_MODE", "1")
    monkeypatch.setenv("AUTO_CLIPPER_WEB_TOKEN", "tok")
    monkeypatch.delenv("AUTO_CLIPPER_CLOUD_MODE", raising=False)
    monkeypatch.setattr(update_check, "package_target", lambda *a: "windows")
    return {"Authorization": "Bearer tok"}


def test_endpoint_exists_only_in_local_web_mode(tmp_path, monkeypatch, fetches):
    monkeypatch.setenv("AUTO_CLIPPER_WORKSPACE", str(tmp_path / "data"))
    monkeypatch.delenv("AUTO_CLIPPER_WEB_MODE", raising=False)
    monkeypatch.delenv("AUTO_CLIPPER_CLOUD_MODE", raising=False)

    assert client.get("/api/update-check", params={"current": "1.19.0"}).status_code == 404
    assert fetches == []


def test_endpoint_needs_the_token(web, fetches):
    assert client.get("/api/update-check", params={"current": "1.19.0"}).status_code == 401
    assert fetches == []


def test_endpoint_answers_for_this_system_and_caches(web, fetches):
    r = client.get("/api/update-check", params={"current": "1.19.0"}, headers=web)

    assert r.status_code == 200
    body = r.json()
    assert (body["update_available"], body["latest"]) == (True, "1.20.0")
    assert body["download_url"] == f"{BASE}download/app-v1.20.0/Auto-Clipper-Web-windows.zip"
    client.get("/api/update-check", params={"current": "1.19.0"}, headers=web)
    assert len(fetches) == 1
    client.get("/api/update-check", params={"current": "1.19.0", "force": 1}, headers=web)
    assert len(fetches) == 2


def test_endpoint_refuses_a_version_it_cannot_read(web, fetches):
    assert client.get("/api/update-check", params={"current": "abc"}, headers=web).status_code == 400
    assert fetches == []
