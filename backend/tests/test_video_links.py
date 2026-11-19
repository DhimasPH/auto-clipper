"""/video needs a signed link on every platform; clip data carries the links (SP1, spec 4.5).

The player cannot send the API token, so /video checks ``sig`` instead. The
token-protected POST /video-url signs any other path, and GET /jobs/{id} and
GET /history add ``video_url`` to each clip when they are read. history.db
never stores a link.
"""
import importlib
import sqlite3
from urllib.parse import parse_qs, urlsplit

import pytest
from fastapi.testclient import TestClient

from backend import db, jobs, main, video_sign

client = TestClient(main.app)

DENIED = {"status": "error", "message": "Access denied"}


@pytest.fixture
def library(tmp_path, monkeypatch):
    lib = tmp_path / "library"
    monkeypatch.setenv("AUTO_CLIPPER_WORKSPACE", str(lib))
    monkeypatch.delenv("AUTO_CLIPPER_WORK_DIR", raising=False)
    monkeypatch.delenv("AUTO_CLIPPER_CLOUD_MODE", raising=False)
    clips = lib / "projects" / "Talk" / "clips"
    clips.mkdir(parents=True)
    (clips / "clip_1.mp4").write_bytes(b"clip one")
    (clips / "clip_2.mp4").write_bytes(b"clip two")
    return lib


def _clip(library, n=1) -> str:
    return str(library / "projects" / "Talk" / "clips" / f"clip_{n}.mp4")


# --- GET /video --------------------------------------------------------------------------------

def test_video_without_a_signature_is_refused(library):
    r = client.get("/video", params={"path": _clip(library)})

    assert (r.status_code, r.json()) == (403, DENIED)


def test_video_with_a_wrong_signature_is_refused(library):
    r = client.get("/video", params={"path": _clip(library), "sig": "0" * 64})

    assert (r.status_code, r.json()) == (403, DENIED)


def test_the_signature_of_one_clip_does_not_open_another(library):
    r = client.get("/video", params={"path": _clip(library, 2), "sig": video_sign.sign(_clip(library, 1))})

    assert r.status_code == 403
    assert b"clip two" not in r.content


def test_a_signed_link_plays_the_clip(library):
    r = client.get(video_sign.signed_url(_clip(library)))

    assert r.status_code == 200
    assert r.content == b"clip one"
    assert r.headers["content-disposition"].startswith("inline")


def test_a_signed_link_with_dl_1_downloads_the_clip(library):
    r = client.get(video_sign.signed_url(_clip(library)) + "&dl=1&v=3")

    assert r.status_code == 200
    assert r.content == b"clip one"
    assert r.headers["content-disposition"].startswith("attachment")


def test_a_signed_link_still_works_after_a_restart(library):
    url = video_sign.signed_url(_clip(library))

    importlib.reload(video_sign)

    assert client.get(url).status_code == 200


def test_a_signed_link_to_a_protected_file_is_still_refused(library):
    cookies = library / "cookies" / "cookies.mp4"
    cookies.parent.mkdir()
    cookies.write_bytes(b"secret cookies")
    video_sign.load_key()

    for path in (str(cookies), video_sign.key_path()):
        r = client.get(video_sign.signed_url(path))
        assert (r.status_code, r.json()) == (403, DENIED)
        assert b"secret" not in r.content


# --- POST /video-url ---------------------------------------------------------------------------

def test_video_url_signs_a_path_and_the_link_plays(library):
    r = client.post("/video-url", json={"path": _clip(library)})

    assert r.status_code == 200
    assert r.json()["status"] == "success"
    assert client.get(r.json()["video_url"]).content == b"clip one"


def test_video_url_drops_the_local_prefix(library):
    r = client.post("/video-url", json={"path": "local:" + _clip(library)})

    assert parse_qs(urlsplit(r.json()["video_url"]).query)["path"] == [_clip(library)]


def test_video_url_refuses_protected_paths(library):
    r = client.post("/video-url", json={"path": str(library / "history.db")})

    assert (r.status_code, r.json()) == (403, DENIED)


def test_video_url_needs_a_path(library):
    assert client.post("/video-url", json={"path": ""}).status_code == 400


def test_video_url_needs_the_token_where_tokens_are_checked_but_video_does_not(library, monkeypatch):
    monkeypatch.setenv("AUTO_CLIPPER_CLOUD_MODE", "1")
    monkeypatch.setenv("AUTO_CLIPPER_WEB_TOKEN", "tok")

    assert client.post("/video-url", json={"path": _clip(library)}).status_code == 401
    ok = client.post("/video-url", json={"path": _clip(library)}, headers={"Authorization": "Bearer tok"})
    assert ok.status_code == 200
    assert client.get(ok.json()["video_url"]).status_code == 200  # the player sends no header


# --- links in clip data ------------------------------------------------------------------------

def test_job_status_carries_signed_links_without_changing_the_job(library):
    job_id = "signed-links"
    jobs.active_jobs[job_id] = {
        "id": job_id, "status": "DONE", "progress": "",
        "clips": [{"path": _clip(library), "v": 1}], "failed": 0, "error": None,
    }

    body = client.get(f"/jobs/{job_id}").json()

    assert body["clips"][0]["video_url"] == video_sign.signed_url(_clip(library))
    assert body["clips"][0]["v"] == 1
    assert "video_url" not in jobs.active_jobs[job_id]["clips"][0]


def test_history_carries_signed_links_that_are_never_stored(library):
    db.init_db()
    db.save_history("signed-history", "https://youtu.be/x", "DONE", [{"path": _clip(library)}], {})

    history = client.get("/history").json()["history"]

    entry = next(h for h in history if h["id"] == "signed-history")
    assert entry["result_clips"][0]["video_url"] == video_sign.signed_url(_clip(library))
    conn = sqlite3.connect(db.get_db_path())
    try:
        stored = conn.execute("SELECT result_clips FROM history WHERE id=?", ("signed-history",)).fetchone()[0]
    finally:
        conn.close()
    assert "video_url" not in stored
    assert "sig=" not in stored


def test_history_reads_the_signing_key_once_across_multiple_entries(library, monkeypatch):
    db.init_db()
    db.save_history("signed-h1", "https://youtu.be/1", "DONE", [{"path": _clip(library, 1)}], {})
    db.save_history("signed-h2", "https://youtu.be/2", "DONE", [{"path": _clip(library, 2)}], {})
    real_load_key = video_sign.load_key
    calls = 0

    def counted_load_key():
        nonlocal calls
        calls += 1
        return real_load_key()

    monkeypatch.setattr(video_sign, "load_key", counted_load_key)

    history = client.get("/history").json()["history"]

    assert calls == 1
    assert next(h for h in history if h["id"] == "signed-h1")["result_clips"][0]["video_url"] == video_sign.signed_url(_clip(library, 1))
    assert next(h for h in history if h["id"] == "signed-h2")["result_clips"][0]["video_url"] == video_sign.signed_url(_clip(library, 2))
