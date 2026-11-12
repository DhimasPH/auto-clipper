"""cookies.txt upload: validation, storage, status, delete, and the API around it.

Cookie values in these fixtures carry the marker ``S3CRET`` so tests can prove
that no value ever reaches a response or a log file.
"""
import calendar
import io
import json
import os
import time

import pytest
from fastapi.testclient import TestClient

from backend import cookies
from backend.errors import AppError, ERROR_CODES
from backend.logger import get_log_content
from backend.main import app

client = TestClient(app)

NOW = 1_800_000_000  # fixed clock for validation tests
DAY = 86400
HEADER = "# Netscape HTTP Cookie File\n# This is a generated file! Do not edit.\n\n"
URL = "/api/settings/cookies"
STATUS_KEYS = {
    "present", "valid", "logged_in", "cookie_count", "youtube_cookie_count",
    "earliest_expiry", "latest_expiry", "uploaded_at", "error_info",
}


def cookie_line(domain, name, expires, value="S3CRET-value", http_only=False):
    flag = "TRUE" if domain.startswith(".") else "FALSE"
    prefix = "#HttpOnly_" if http_only else ""
    return f"{prefix}{domain}\t{flag}\t/\tTRUE\t{expires}\t{name}\t{value}"


def cookies_txt(*lines, header=HEADER):
    return (header + "\n".join(lines) + "\n").encode("utf-8")


def valid_file(now=NOW):
    return cookies_txt(
        cookie_line(".youtube.com", "LOGIN_INFO", now + 300 * DAY, http_only=True),
        cookie_line(".youtube.com", "SAPISID", now + 400 * DAY),
        cookie_line(".youtube.com", "PREF", now + 30 * DAY),
        cookie_line(".youtube.com", "YSC", 0),
        cookie_line(".google.com", "NID", now + 100 * DAY),
    )


def expired_file(now=NOW):
    return cookies_txt(
        cookie_line(".youtube.com", "LOGIN_INFO", now - 10 * DAY),
        cookie_line(".youtube.com", "SAPISID", now - DAY),
        cookie_line(".youtube.com", "YSC", 0),
    )


JSON_EXPORT = json.dumps([
    {"domain": ".youtube.com", "name": "SAPISID", "value": "S3CRET-json", "expirationDate": NOW + DAY, "path": "/"},
]).encode("utf-8")
RANDOM_TEXT = b"Hello,\nthis is my S3CRET shopping list.\n- eggs\n- milk\n"
BINARY = bytes(range(256)) * 4
SPACES_NOT_TABS = b"# Netscape HTTP Cookie File\n.youtube.com TRUE / TRUE 1900000000 SAPISID S3CRET-spaces\n"


@pytest.fixture(autouse=True)
def cookie_store(tmp_path, monkeypatch):
    """Each test gets its own app data directory and working-copy directory."""
    monkeypatch.setenv("AUTO_CLIPPER_WORKSPACE", str(tmp_path / "appdata"))
    monkeypatch.setattr(cookies, "_copy_dir", lambda: str(tmp_path / "copies"))
    return tmp_path / "appdata"


def _code(data, now=NOW):
    with pytest.raises(AppError) as excinfo:
        cookies.validate_cookies(data, now=now)
    return excinfo.value.code


def _iso(ts):
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(ts))


# --- validation ---------------------------------------------------------------

def test_valid_file_is_accepted():
    text = cookies.validate_cookies(valid_file(), now=NOW)
    assert text.startswith("# Netscape HTTP Cookie File\n")
    for name in ("LOGIN_INFO", "SAPISID", "PREF", "YSC", "NID"):
        assert f"\t{name}\t" in text


@pytest.mark.parametrize("data", [
    b"",
    b"   \n\r\n\t\n",
    HEADER.encode("utf-8"),
    b"\xef\xbb\xbf# Netscape HTTP Cookie File\n# only comments\n",
], ids=["zero-bytes", "whitespace", "header-only", "bom-and-comments"])
def test_empty_file_is_rejected(data):
    assert _code(data) == "COOKIES_EMPTY"


def test_expired_file_is_rejected():
    assert _code(expired_file()) == "COOKIES_EXPIRED"


@pytest.mark.parametrize("data", [JSON_EXPORT, RANDOM_TEXT, BINARY, SPACES_NOT_TABS],
                         ids=["json-export", "random-text", "binary", "spaces-not-tabs"])
def test_non_netscape_file_is_rejected(data):
    assert _code(data) == "COOKIES_INVALID_FORMAT"


@pytest.mark.parametrize("domain", [".google.com", "notyoutube.com", ".youtube.com.example.org", "youtu.be"])
def test_file_without_youtube_cookies_is_rejected(domain):
    assert _code(cookies_txt(cookie_line(domain, "SAPISID", NOW + DAY))) == "COOKIES_NO_YOUTUBE"


@pytest.mark.parametrize("domain", [".youtube.com", "youtube.com", "www.youtube.com", ".music.youtube.com", ".YouTube.com"])
def test_youtube_subdomains_count_as_youtube(domain):
    assert cookies.validate_cookies(cookies_txt(cookie_line(domain, "PREF", NOW + DAY)), now=NOW)


def test_file_over_the_size_limit_is_rejected():
    padding = cookie_line(".example.com", "pad", NOW + DAY, value="x" * 1000)
    big = cookies_txt(cookie_line(".youtube.com", "PREF", NOW + DAY), *[padding] * 1100)
    assert len(big) > cookies.MAX_COOKIES_BYTES
    assert _code(big) == "COOKIES_TOO_LARGE"


def test_one_unexpired_youtube_cookie_is_enough():
    data = cookies_txt(
        cookie_line(".youtube.com", "OLD", NOW - DAY),
        cookie_line(".youtube.com", "FRESH", NOW + DAY),
    )
    assert cookies.validate_cookies(data, now=NOW)


def test_session_cookies_do_not_hide_an_expired_file():
    """YSC has no expiry date in every real export, so it must not count as fresh."""
    data = cookies_txt(cookie_line(".youtube.com", "SAPISID", NOW - DAY), cookie_line(".youtube.com", "YSC", 0))
    assert _code(data) == "COOKIES_EXPIRED"


def test_file_with_only_session_cookies_is_accepted():
    data = cookies_txt(cookie_line(".youtube.com", "YSC", 0), cookie_line(".youtube.com", "OTHER", ""))
    assert cookies.validate_cookies(data, now=NOW)


def test_unexpired_cookies_of_other_sites_do_not_hide_expired_youtube_cookies():
    data = cookies_txt(cookie_line(".youtube.com", "SAPISID", NOW - DAY), cookie_line(".google.com", "NID", NOW + DAY))
    assert _code(data) == "COOKIES_EXPIRED"


def test_windows_line_endings_bom_and_decimal_expiry_are_accepted():
    lines = [cookie_line(".youtube.com", "SAPISID", f"{NOW + DAY}.123456", http_only=True)]
    data = b"\xef\xbb\xbf" + (HEADER + "\n".join(lines) + "\n").replace("\n", "\r\n").encode("utf-8")
    text = cookies.validate_cookies(data, now=NOW)
    assert "\r" not in text
    assert "﻿" not in text
    assert "#HttpOnly_.youtube.com\t" in text


def test_unreadable_lines_are_dropped_and_the_rest_is_kept():
    data = cookies_txt(
        cookie_line(".youtube.com", "SAPISID", NOW + DAY),
        "this line is not a cookie",
        cookie_line(".youtube.com", "BAD_EXPIRY", "soon"),
        '{"looks": "like json"}',
    )
    text = cookies.validate_cookies(data, now=NOW)
    assert "\tSAPISID\t" in text
    assert "not a cookie" not in text
    assert "BAD_EXPIRY" not in text
    assert "json" not in text


@pytest.mark.parametrize("data", [b"", JSON_EXPORT, RANDOM_TEXT, SPACES_NOT_TABS, expired_file(),
                                  cookies_txt(cookie_line(".google.com", "NID", NOW + DAY))])
def test_rejections_never_quote_the_file(data):
    with pytest.raises(AppError) as excinfo:
        cookies.validate_cookies(data, now=NOW)
    assert "S3CRET" not in json.dumps(excinfo.value.to_dict())
    assert "S3CRET" not in str(excinfo.value)


def test_every_validation_error_code_is_in_the_catalog():
    for code in ("COOKIES_EMPTY", "COOKIES_INVALID_FORMAT", "COOKIES_NO_YOUTUBE", "COOKIES_EXPIRED", "COOKIES_TOO_LARGE"):
        assert code in ERROR_CODES
        assert [a["id"] for a in AppError(code).to_dict()["actions"]] == ["upload_cookies"]


# --- what yt-dlp makes of the stored file --------------------------------------

def _load_with_yt_dlp(path):
    from yt_dlp.cookies import YoutubeDLCookieJar
    jar = YoutubeDLCookieJar(str(path))
    jar.load()
    return {(c.domain, c.name): c for c in jar}


def test_stored_file_loads_in_yt_dlp(cookie_store):
    cookies.save_cookies(valid_file(), now=NOW)
    jar = _load_with_yt_dlp(cookies.get_cookies_path())
    assert jar[(".youtube.com", "SAPISID")].value == "S3CRET-value"
    assert (".youtube.com", "LOGIN_INFO") in jar  # written as a "#HttpOnly_" line, which is not a comment
    assert (".google.com", "NID") in jar
    assert len(jar) == 5


def test_files_yt_dlp_would_choke_on_are_repaired_before_storing():
    """No header, a subdomain flag that contradicts the domain, and junk lines."""
    data = (
        ".youtube.com\tFALSE\t/\tTRUE\t1900000000\tSAPISID\tS3CRET-a\n"
        "youtube.com\tTRUE\t/\tfalse\t1900000000\tPREF\tS3CRET-b\n"
        "{\"junk\": true}\n"
    ).encode("utf-8")
    from yt_dlp.cookies import YoutubeDLCookieJar
    with pytest.raises(Exception):  # the raw upload is not loadable as it is
        YoutubeDLCookieJar(io.StringIO(data.decode())).load()

    cookies.save_cookies(data, now=NOW)

    jar = _load_with_yt_dlp(cookies.get_cookies_path())
    assert set(jar) == {(".youtube.com", "SAPISID"), ("youtube.com", "PREF")}


def test_a_file_the_downloader_cannot_load_is_rejected(monkeypatch):
    monkeypatch.setattr(cookies, "_loads_in_yt_dlp", lambda text: False)
    assert _code(valid_file()) == "COOKIES_INVALID_FORMAT"


# --- storage and status ---------------------------------------------------------

def test_status_when_nothing_is_stored():
    assert cookies.get_status() == {
        "present": False, "valid": False, "logged_in": False, "cookie_count": 0, "youtube_cookie_count": 0,
        "earliest_expiry": None, "latest_expiry": None, "uploaded_at": None, "error_info": None,
    }


def test_save_stores_the_file_in_the_app_data_directory(cookie_store):
    before = time.time()
    status = cookies.save_cookies(valid_file(), now=NOW)

    path = cookies.get_cookies_path()
    assert os.path.isfile(path)
    assert os.path.commonpath([path, str(cookie_store)]) == str(cookie_store)
    assert set(status) == STATUS_KEYS
    assert status["present"] is True
    assert status["valid"] is True
    assert status["logged_in"] is True
    assert status["cookie_count"] == 5
    assert status["youtube_cookie_count"] == 4
    assert status["earliest_expiry"] == _iso(NOW + 30 * DAY)
    assert status["latest_expiry"] == _iso(NOW + 400 * DAY)
    assert status["error_info"] is None
    uploaded = calendar.timegm(time.strptime(status["uploaded_at"], "%Y-%m-%dT%H:%M:%SZ"))
    assert before - 5 <= uploaded <= time.time() + 5


def test_status_matches_what_save_returned():
    saved = cookies.save_cookies(valid_file(), now=NOW)
    assert cookies.get_status(now=NOW) == saved


def test_status_never_contains_cookie_values():
    status = cookies.save_cookies(valid_file(), now=NOW)
    assert "S3CRET" not in json.dumps(status)
    assert "S3CRET" not in json.dumps(cookies.get_status(now=NOW))


def test_logged_out_export_is_stored_but_reported_as_not_logged_in():
    data = cookies_txt(cookie_line(".youtube.com", "PREF", NOW + DAY), cookie_line(".youtube.com", "YSC", 0))
    status = cookies.save_cookies(data, now=NOW)
    assert status["valid"] is True
    assert status["logged_in"] is False


def test_expired_login_cookies_do_not_count_as_logged_in():
    data = cookies_txt(
        cookie_line(".youtube.com", "LOGIN_INFO", NOW - DAY),
        cookie_line(".youtube.com", "SAPISID", NOW - DAY),
        cookie_line(".youtube.com", "PREF", NOW + DAY),
    )
    assert cookies.save_cookies(data, now=NOW)["logged_in"] is False


def test_status_flags_a_stored_file_that_has_expired_since_upload():
    cookies.save_cookies(valid_file(), now=NOW)
    status = cookies.get_status(now=NOW + 500 * DAY)
    assert status["present"] is True
    assert status["valid"] is False
    assert status["logged_in"] is False
    assert status["error_info"]["code"] == "COOKIES_EXPIRED"
    assert status["earliest_expiry"] is None
    assert status["latest_expiry"] == _iso(NOW + 400 * DAY)
    assert "S3CRET" not in json.dumps(status)


def test_status_flags_a_stored_file_that_was_damaged_on_disk():
    cookies.save_cookies(valid_file(), now=NOW)
    with open(cookies.get_cookies_path(), "wb") as f:
        f.write(BINARY)
    status = cookies.get_status(now=NOW)
    assert status["present"] is True
    assert status["valid"] is False
    assert status["error_info"]["code"] == "COOKIES_INVALID_FORMAT"


def test_a_rejected_upload_keeps_the_file_that_was_already_stored():
    cookies.save_cookies(valid_file(), now=NOW)
    with open(cookies.get_cookies_path(), "rb") as f:
        stored = f.read()

    with pytest.raises(AppError):
        cookies.save_cookies(RANDOM_TEXT, now=NOW)

    with open(cookies.get_cookies_path(), "rb") as f:
        assert f.read() == stored
    assert cookies.get_status(now=NOW)["valid"] is True


def test_a_new_upload_replaces_the_old_file():
    cookies.save_cookies(valid_file(), now=NOW)
    status = cookies.save_cookies(cookies_txt(cookie_line(".youtube.com", "PREF", NOW + DAY)), now=NOW)
    assert status["cookie_count"] == 1
    assert os.listdir(os.path.dirname(cookies.get_cookies_path())) == ["cookies.txt"]


def test_a_file_right_at_the_size_limit_is_stored_and_read_back_whole():
    expires = int(time.time()) + DAY
    first = cookie_line(".youtube.com", "PREF", expires) + "\n"
    filler = cookie_line(".example.com", "pad", expires, value="x" * 1000) + "\n"
    body = first + filler * ((cookies.MAX_COOKIES_BYTES - len(first)) // len(filler) - 1)
    last = cookie_line(".example.com", "last", expires, value="")
    tail = "y" * (cookies.MAX_COOKIES_BYTES - len(body) - len(last) - 1)
    data = (body + last + tail + "\n").encode("utf-8")  # no header, so the stored file is larger than the upload
    assert len(data) == cookies.MAX_COOKIES_BYTES

    status = cookies.save_cookies(data)

    assert status["cookie_count"] == data.count(b"\n")
    with cookies.ytdlp_cookiefile() as path:
        assert _load_with_yt_dlp(path)[(".example.com", "last")].value == tail


def test_delete_removes_the_file():
    cookies.save_cookies(valid_file(), now=NOW)
    cookies.delete_cookies()
    assert not os.path.exists(cookies.get_cookies_path())
    assert cookies.get_status()["present"] is False


def test_delete_without_a_stored_file_is_fine():
    cookies.delete_cookies()
    assert cookies.get_status()["present"] is False


# --- the copy handed to yt-dlp ---------------------------------------------------

def test_no_cookie_file_for_yt_dlp_when_nothing_is_stored():
    with cookies.ytdlp_cookiefile() as path:
        assert path is None


def test_yt_dlp_gets_a_copy_and_the_stored_file_is_never_rewritten():
    now = int(time.time())
    cookies.save_cookies(valid_file(now))
    stored_path = cookies.get_cookies_path()
    with open(stored_path, "rb") as f:
        stored = f.read()

    with cookies.ytdlp_cookiefile() as path:
        assert path and os.path.isfile(path)
        assert os.path.abspath(path) != os.path.abspath(stored_path)
        assert (".youtube.com", "SAPISID") in _load_with_yt_dlp(path)
        with open(path, "w", encoding="utf-8") as f:  # yt-dlp rewrites its cookie file on close
            f.write("# Netscape HTTP Cookie File\n")

    assert not os.path.exists(path)
    with open(stored_path, "rb") as f:
        assert f.read() == stored


def test_the_copy_is_removed_even_when_the_download_fails():
    cookies.save_cookies(valid_file(int(time.time())))
    with pytest.raises(RuntimeError):
        with cookies.ytdlp_cookiefile() as path:
            raise RuntimeError("download failed")
    assert not os.path.exists(path)


def test_an_expired_stored_file_is_not_handed_to_yt_dlp():
    uploaded = int(time.time()) - 100 * DAY
    cookies.save_cookies(expired_file(uploaded + 20 * DAY), now=uploaded)  # still valid on upload day
    assert cookies.get_status()["valid"] is False
    with cookies.ytdlp_cookiefile() as path:
        assert path is None


def test_delete_also_removes_copies_left_behind_by_a_crash():
    cookies.save_cookies(valid_file(int(time.time())))
    leftover = cookies._make_working_copy()
    assert os.path.isfile(leftover)
    cookies.delete_cookies()
    assert not os.path.exists(leftover)


def test_real_yt_dlp_reads_the_copy_and_leaves_the_stored_file_alone():
    """yt-dlp's own option handling, with no request made."""
    import yt_dlp
    now = int(time.time())
    cookies.save_cookies(valid_file(now))
    with open(cookies.get_cookies_path(), "rb") as f:
        stored = f.read()

    with cookies.ytdlp_cookiefile() as path:
        with yt_dlp.YoutubeDL({"cookiefile": path, "quiet": True, "no_warnings": True}) as ydl:
            names = {c.name for c in ydl.cookiejar.get_cookies_for_url("https://www.youtube.com/watch?v=x")}
        with open(path, "r", encoding="utf-8") as f:
            assert "generated by yt-dlp" in f.read()  # the copy was rewritten on close

    assert {"LOGIN_INFO", "SAPISID", "PREF", "YSC"} <= names
    with open(cookies.get_cookies_path(), "rb") as f:
        assert f.read() == stored


# --- logs ------------------------------------------------------------------------

def test_cookie_values_never_reach_the_logs():
    now = int(time.time())
    for data in (b"", JSON_EXPORT, RANDOM_TEXT, SPACES_NOT_TABS, expired_file(now)):
        r = client.post(URL, files={"file": ("cookies.txt", data, "text/plain")})
        assert r.status_code == 400
    assert client.post(URL, files={"file": ("cookies.txt", valid_file(now), "text/plain")}).status_code == 200
    with cookies.ytdlp_cookiefile():
        pass
    client.get(URL)
    client.delete(URL)

    for log_type in ("app", "error", "ai"):
        assert "S3CRET" not in get_log_content(log_type)


# --- endpoints -------------------------------------------------------------------

def _upload(data, filename="cookies.txt"):
    return client.post(URL, files={"file": (filename, data, "text/plain")})


def test_status_endpoint_when_nothing_is_stored():
    r = client.get(URL)
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "success"
    assert set(body["cookies"]) == STATUS_KEYS
    assert body["cookies"]["present"] is False
    assert body["cookies"]["valid"] is False


def test_upload_endpoint_stores_a_valid_file():
    now = int(time.time())
    r = _upload(valid_file(now))
    assert r.status_code == 200
    body = r.json()
    assert set(body) == {"status", "cookies"}
    assert body["status"] == "success"
    assert set(body["cookies"]) == STATUS_KEYS
    assert body["cookies"]["present"] is True
    assert body["cookies"]["valid"] is True
    assert body["cookies"]["logged_in"] is True
    assert body["cookies"]["cookie_count"] == 5
    assert body["cookies"]["youtube_cookie_count"] == 4
    assert body["cookies"]["earliest_expiry"] == _iso(now + 30 * DAY)
    assert "S3CRET" not in r.text

    status = client.get(URL)
    assert status.status_code == 200
    assert status.json()["cookies"] == body["cookies"]
    assert "S3CRET" not in status.text


@pytest.mark.parametrize("make, code", [
    (lambda now: b"", "COOKIES_EMPTY"),
    (lambda now: expired_file(now), "COOKIES_EXPIRED"),
    (lambda now: JSON_EXPORT, "COOKIES_INVALID_FORMAT"),
    (lambda now: RANDOM_TEXT, "COOKIES_INVALID_FORMAT"),
    (lambda now: cookies_txt(cookie_line(".google.com", "NID", now + DAY)), "COOKIES_NO_YOUTUBE"),
    (lambda now: b"x" * (cookies.MAX_COOKIES_BYTES + 1), "COOKIES_TOO_LARGE"),
], ids=["empty", "expired", "json", "random-text", "no-youtube", "too-large"])
def test_upload_endpoint_rejects_bad_files_with_a_structured_error(make, code):
    r = _upload(make(int(time.time())))
    assert r.status_code == 400
    body = r.json()
    assert body["status"] == "error"
    info = body["error_info"]
    assert set(info) == {"code", "title", "message", "title_en", "message_en", "actions", "technical"}
    assert info["code"] == code
    assert body["message"] == info["message"]
    assert [a["id"] for a in info["actions"]] == ["upload_cookies"]
    assert "S3CRET" not in r.text
    assert client.get(URL).json()["cookies"]["present"] is False


def test_upload_endpoint_does_not_trust_the_file_name(cookie_store):
    r = _upload(valid_file(int(time.time())), filename="../../evil.mp4")
    assert r.status_code == 200
    stored = [os.path.join(root, name) for root, _, names in os.walk(cookie_store) for name in names
              if not name.startswith("backend_")]
    assert stored == [cookies.get_cookies_path()]


def test_delete_endpoint_removes_the_file():
    _upload(valid_file(int(time.time())))
    r = client.delete(URL)
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "success"
    assert body["cookies"]["present"] is False
    assert not os.path.exists(cookies.get_cookies_path())
    assert client.get(URL).json()["cookies"]["present"] is False


def test_delete_endpoint_without_a_stored_file_is_fine():
    r = client.delete(URL)
    assert r.status_code == 200
    assert r.json()["cookies"]["present"] is False


def test_cookie_endpoints_require_the_token_in_cloud_mode(monkeypatch):
    monkeypatch.setenv("AUTO_CLIPPER_CLOUD_MODE", "1")
    monkeypatch.setenv("AUTO_CLIPPER_WEB_TOKEN", "secret-test-token")
    files = {"file": ("cookies.txt", valid_file(int(time.time())), "text/plain")}

    assert client.get(URL).status_code == 401
    assert client.post(URL, files=files).status_code == 401
    assert client.delete(URL).status_code == 401
    assert client.get(URL, headers={"Authorization": "Bearer wrong"}).status_code == 401
    assert not os.path.exists(cookies.get_cookies_path())

    auth = {"Authorization": "Bearer secret-test-token"}
    assert client.post(URL, files=files, headers=auth).status_code == 200
    assert client.get(URL, headers=auth).json()["cookies"]["valid"] is True
    assert client.delete(URL, headers=auth).status_code == 200
