"""Signed /video links: the key file and the signatures (SP1, spec 4.5).

sig = HMAC_SHA256(key, canonical path), no expiry. The 32-byte key lives in
the app data folder as video_signing.key, is created once, and is read from
the file on every use, so links survive a restart and deleting the file
cancels every old link.
"""
import hashlib
import hmac
import importlib
import os
import sys
from urllib.parse import parse_qs, urlsplit

import pytest

from backend import drive_mount, path_guard, video_sign


@pytest.fixture
def library(tmp_path, monkeypatch):
    lib = tmp_path / "library"
    monkeypatch.setenv("AUTO_CLIPPER_WORKSPACE", str(lib))
    monkeypatch.delenv("AUTO_CLIPPER_CLOUD_MODE", raising=False)
    return lib


def test_key_is_32_random_bytes_created_once_in_the_app_data_folder(library):
    first = video_sign.load_key()
    second = video_sign.load_key()

    key_file = library / "video_signing.key"
    assert video_sign.key_path() == str(key_file)
    assert len(first) == 32
    assert first == second == key_file.read_bytes()


def test_each_library_gets_its_own_random_key(tmp_path, monkeypatch):
    monkeypatch.setenv("AUTO_CLIPPER_WORKSPACE", str(tmp_path / "a"))
    a = video_sign.load_key()
    monkeypatch.setenv("AUTO_CLIPPER_WORKSPACE", str(tmp_path / "b"))

    assert video_sign.load_key() != a


@pytest.mark.skipif(sys.platform == "win32", reason="POSIX file modes")
def test_key_file_is_readable_by_its_owner_only(library):
    video_sign.load_key()

    assert (library / "video_signing.key").stat().st_mode & 0o077 == 0


def test_a_key_file_of_the_wrong_size_is_replaced(library):
    library.mkdir(parents=True)
    (library / "video_signing.key").write_bytes(b"short")

    key = video_sign.load_key()

    assert len(key) == 32
    assert (library / "video_signing.key").read_bytes() == key


def test_signature_is_hmac_sha256_of_the_canonical_path(library):
    clip = str(library / "clips" / "clip_1.mp4")
    expected = hmac.new(video_sign.load_key(), video_sign.canonical_path(clip).encode("utf-8"), hashlib.sha256).hexdigest()

    assert video_sign.sign(clip) == expected
    assert len(expected) == 64


def test_verify_accepts_the_right_signature_and_refuses_everything_else(library):
    a = str(library / "clips" / "a.mp4")
    b = str(library / "clips" / "b.mp4")
    sig_a = video_sign.sign(a)

    assert video_sign.verify(a, sig_a)
    assert video_sign.verify(a, sig_a.upper())
    assert not video_sign.verify(b, sig_a)  # the link of file A does not open file B
    assert not video_sign.verify(a, "")
    assert not video_sign.verify(a, None)
    assert not video_sign.verify(a, "0" * 64)
    assert not video_sign.verify(a, "é" * 64)
    assert not video_sign.verify("", sig_a)


def test_the_same_file_written_another_way_has_the_same_signature(library):
    plain = os.path.join(str(library), "clips", "a.mp4")
    roundabout = os.path.join(str(library), "projects", "..", "clips", ".", "a.mp4")

    assert video_sign.verify(roundabout, video_sign.sign(plain))


def test_links_stay_valid_after_a_restart(library):
    path = str(library / "clips" / "a.mp4")
    sig = video_sign.sign(path)

    importlib.reload(video_sign)  # nothing is kept in memory: the key comes from the file

    assert video_sign.verify(path, sig)


def test_deleting_the_key_file_cancels_every_old_link(library):
    path = str(library / "clips" / "a.mp4")
    sig = video_sign.sign(path)

    os.remove(video_sign.key_path())

    assert not video_sign.verify(path, sig)
    assert video_sign.verify(path, video_sign.sign(path))


def test_key_stays_off_an_unmounted_google_drive(tmp_path, monkeypatch):
    local = tmp_path / "local"
    monkeypatch.setattr(drive_mount, "library_unavailable", lambda: True)
    monkeypatch.setattr(drive_mount, "local_dir", lambda: str(local))

    video_sign.load_key()

    assert video_sign.key_path() == str(local / "video_signing.key")
    assert (local / "video_signing.key").exists()


def test_signed_url_is_a_relative_video_link_with_path_and_sig(library):
    path = str(library / "clips" / "klip satu & dua.mp4")

    url = video_sign.signed_url(path)

    assert url.startswith("/video?")
    assert parse_qs(urlsplit(url).query) == {"path": [path], "sig": [video_sign.sign(path)]}


def test_with_video_urls_adds_links_to_copies_only(library):
    clips = [{"path": str(library / "c1.mp4"), "v": 0}, {"description": "no file yet"}, "junk"]

    out = video_sign.with_video_urls(clips)

    assert out[0]["video_url"] == video_sign.signed_url(clips[0]["path"])
    assert out[0]["v"] == 0
    assert "video_url" not in clips[0]  # history.db and the running job never get a link
    assert out[1] == {"description": "no file yet"}
    assert out[2] == "junk"
    assert video_sign.with_video_urls(None) is None


def test_with_video_urls_reads_the_key_file_once_for_a_batch_of_clips(library, monkeypatch):
    real_load_key = video_sign.load_key
    calls = 0

    def counted_load_key():
        nonlocal calls
        calls += 1
        return real_load_key()

    monkeypatch.setattr(video_sign, "load_key", counted_load_key)
    clips = [{"path": str(library / f"c{i}.mp4")} for i in (1, 2, 3)]

    out = video_sign.with_video_urls(clips)

    assert calls == 1
    assert [c["video_url"] for c in out] == [video_sign.signed_url(c["path"]) for c in clips]


def test_with_video_urls_leaves_clips_without_links_when_signing_fails(library, monkeypatch):
    def broken():
        raise OSError("disk gone")

    logged = []
    monkeypatch.setattr(video_sign, "load_key", broken)
    monkeypatch.setattr(video_sign, "log_error", lambda *a, **k: logged.append(a))

    assert video_sign.with_video_urls([{"path": "x.mp4"}]) == [{"path": "x.mp4"}]
    assert logged


def test_path_guard_protects_the_key_file_and_its_temp_copies(library):
    assert path_guard.is_protected(str(library / "video_signing.key"))
    assert path_guard.is_protected(str(library / "VIDEO_SIGNING.KEY"))
    assert path_guard.is_protected(str(library / "video_signing.key.1a2b3c4d.part"))
    assert not path_guard.is_protected(str(library / "clips" / "clip_1.mp4"))
