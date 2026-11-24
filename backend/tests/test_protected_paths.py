"""Endpoints that take a file path never read, copy or overwrite the app's private files.

Private: the stored cookies.txt and its working copies (a YouTube login), the
job history database with its snapshot and SQLite side files, and the backend
logs. On Colab the app data folder holding them is the user's Google Drive.
"""
import os
import sys

import pytest
from fastapi.testclient import TestClient

from backend import cookies, main, video_sign

client = TestClient(main.app)

DENIED = {"status": "error", "message": "Access denied"}


@pytest.fixture
def app_files(tmp_path, monkeypatch):
    """A library (app data) and a work dir holding every kind of private file, plus a clip, a source and an upload."""
    library = tmp_path / "library"
    work = tmp_path / "work"
    copies = library / "cookie-copies"  # inside an allowed folder, so only the deny rule stops it
    monkeypatch.setenv("AUTO_CLIPPER_WORKSPACE", str(library))
    monkeypatch.setenv("AUTO_CLIPPER_WORK_DIR", str(work))
    monkeypatch.setattr(cookies, "_copy_dir", lambda: str(copies))

    files = {
        "cookies": library / "cookies" / "cookies.txt",
        "cookies_mp4": library / "cookies" / "cookies.mp4",
        "cookie_copy": copies / "run-abc.txt",
        "cookie_copy_mp4": copies / "run-abc.mp4",
        "history": work / "history.db",
        "history_wal": work / "history.db-wal",
        "snapshot": library / "history.db",
        "snapshot_part": library / ".history.db.part",
        "error_log": library / "backend_error.log",
        "app_log": library / "backend_app.log",
        "clip": library / "projects" / "Talk" / "clips" / "clip_1.mp4",
        "source": work / "projects" / "Talk" / "source.mp4",
        "upload": work / "temp_downloads" / "upload_talk.mp4",
    }
    for name, path in files.items():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(f"secret {name}".encode() if name not in ("clip", "source", "upload") else name.encode())
    files["library"] = library
    files["work"] = work
    return files


PRIVATE = ["cookies", "cookies_mp4", "cookie_copy", "cookie_copy_mp4", "history", "history_wal",
           "snapshot", "snapshot_part", "error_log", "app_log"]


# --- /video ----------------------------------------------------------------------------------

@pytest.mark.parametrize("name", PRIVATE)
def test_video_refuses_private_app_files(app_files, name):
    r = client.get("/video", params={"path": str(app_files[name])})

    assert r.status_code == 403
    assert r.json() == DENIED
    assert b"secret" not in r.content


def test_video_refuses_a_dotdot_path_that_lands_on_the_cookies(app_files):
    path = os.path.join(str(app_files["library"]), "projects", "..", "cookies", "cookies.mp4")

    assert client.get("/video", params={"path": path}).status_code == 403


@pytest.mark.skipif(sys.platform != "win32", reason="Windows paths ignore case")
def test_video_refuses_the_cookies_spelled_in_another_case(app_files):
    path = str(app_files["cookies_mp4"]).upper()

    assert client.get("/video", params={"path": path}).status_code == 403


def test_video_refuses_a_link_to_the_cookies(app_files):
    link = app_files["clip"].parent / "innocent.mp4"
    try:
        os.symlink(app_files["cookies"], link)
    except (OSError, NotImplementedError):
        pytest.skip("this machine cannot create symlinks")

    r = client.get("/video", params={"path": str(link)})

    assert r.status_code == 403
    assert b"secret" not in r.content


def test_video_answers_the_same_whether_a_private_file_exists_or_not(app_files):
    missing = app_files["library"] / "cookies" / "gone.mp4"

    there = client.get("/video", params={"path": str(app_files["cookies_mp4"])})
    gone = client.get("/video", params={"path": str(missing)})

    assert (there.status_code, there.json()) == (gone.status_code, gone.json()) == (403, DENIED)


def test_refusal_is_logged_without_the_file_contents(app_files, monkeypatch):
    logged = []
    monkeypatch.setattr("backend.path_guard.log_error", lambda *a, **k: logged.append(a))

    client.get("/video", params={"path": str(app_files["cookies_mp4"])})

    assert logged
    assert "secret" not in repr(logged)


@pytest.mark.parametrize("name", ["clip", "source", "upload"])
def test_video_still_serves_clips_sources_and_uploads(app_files, name):
    path = str(app_files[name])
    r = client.get("/video", params={"path": path, "sig": video_sign.sign(path)})

    assert r.status_code == 200
    assert r.content == name.encode()


# --- /save_file ------------------------------------------------------------------------------

@pytest.mark.parametrize("name", PRIVATE)
def test_save_file_refuses_to_copy_private_app_files(app_files, tmp_path, name):
    dest = tmp_path / "out" / "copy.bin"
    dest.parent.mkdir()

    r = client.post("/save_file", json={"src": str(app_files[name]), "dest": str(dest)})

    assert r.status_code == 403
    assert r.json() == DENIED
    assert not dest.exists()


def test_save_file_refuses_a_dotdot_path_to_the_history(app_files, tmp_path):
    src = os.path.join(str(app_files["library"]), "projects", "Talk", "..", "..", "history.db")
    dest = tmp_path / "copy.db"

    assert client.post("/save_file", json={"src": src, "dest": str(dest)}).status_code == 403
    assert not dest.exists()


@pytest.mark.skipif(sys.platform != "win32", reason="Windows paths ignore case")
def test_save_file_refuses_the_cookies_spelled_in_another_case(app_files, tmp_path):
    dest = tmp_path / "copy.txt"
    src = str(app_files["cookies"]).swapcase()

    assert client.post("/save_file", json={"src": src, "dest": str(dest)}).status_code == 403
    assert not dest.exists()


@pytest.mark.parametrize("name", ["cookies", "history", "snapshot", "error_log"])
def test_save_file_refuses_to_overwrite_private_app_files(app_files, name):
    before = app_files[name].read_bytes()

    r = client.post("/save_file", json={"src": str(app_files["clip"]), "dest": str(app_files[name])})

    assert r.status_code == 403
    # The error log also gets the refusal appended, so check it still starts with what it had.
    assert app_files[name].read_bytes().startswith(before)


@pytest.mark.skipif(sys.platform != "win32", reason="Windows device path prefixes")
@pytest.mark.parametrize("prefix", ["\\\\?\\", "\\\\.\\", "//?/"])
def test_save_file_refuses_private_files_behind_a_windows_device_prefix(app_files, tmp_path, prefix):
    before = app_files["cookies"].read_bytes()
    dest = tmp_path / "copy.txt"

    to_cookies = client.post("/save_file", json={"src": str(app_files["clip"]), "dest": prefix + str(app_files["cookies"])})
    from_cookies = client.post("/save_file", json={"src": prefix + str(app_files["cookies"]), "dest": str(dest)})

    assert (to_cookies.status_code, from_cookies.status_code) == (403, 403)
    assert app_files["cookies"].read_bytes() == before
    assert not dest.exists()


def test_save_file_refuses_to_copy_into_the_cookies_folder(app_files):
    r = client.post("/save_file", json={"src": str(app_files["clip"]), "dest": str(app_files["cookies"].parent)})

    assert r.status_code == 403
    assert not (app_files["cookies"].parent / "clip_1.mp4").exists()


def test_save_file_refuses_a_folder_destination_that_would_name_the_copy_history_db(app_files, tmp_path):
    # The library has a project file called history.db; copied into a folder, it would replace the snapshot.
    odd = app_files["library"] / "projects" / "Talk" / "history.db"
    odd.write_bytes(b"not the real history")
    before = app_files["snapshot"].read_bytes()

    r = client.post("/save_file", json={"src": str(odd), "dest": str(app_files["library"])})

    assert r.status_code == 403
    assert app_files["snapshot"].read_bytes() == before


def test_save_file_refuses_a_folder_that_only_starts_like_the_app_data_folder(app_files, tmp_path):
    sibling = tmp_path / "library-other" / "clip.mp4"
    sibling.parent.mkdir()
    sibling.write_bytes(b"not ours")
    dest = tmp_path / "copy.mp4"

    r = client.post("/save_file", json={"src": str(sibling), "dest": str(dest)})

    assert r.status_code == 403
    assert not dest.exists()


def test_save_file_still_copies_a_clip_to_the_users_folder(app_files, tmp_path):
    dest = tmp_path / "Videos" / "my clip.mp4"
    dest.parent.mkdir()

    r = client.post("/save_file", json={"src": str(app_files["clip"]), "dest": str(dest)})

    assert r.status_code == 200
    assert dest.read_bytes() == b"clip"


def test_save_file_still_copies_a_clip_into_a_chosen_folder(app_files, tmp_path):
    folder = tmp_path / "Videos"
    folder.mkdir()

    r = client.post("/save_file", json={"src": str(app_files["clip"]), "dest": str(folder)})

    assert r.status_code == 200
    assert (folder / "clip_1.mp4").read_bytes() == b"clip"


def test_save_file_still_copies_an_upload_without_a_work_dir(tmp_path, monkeypatch):
    library = tmp_path / "library"
    monkeypatch.setenv("AUTO_CLIPPER_WORKSPACE", str(library))
    monkeypatch.delenv("AUTO_CLIPPER_WORK_DIR", raising=False)
    upload = library / "temp_downloads" / "upload_talk.mp4"
    upload.parent.mkdir(parents=True)
    upload.write_bytes(b"upload")
    dest = tmp_path / "copy.mp4"

    r = client.post("/save_file", json={"src": str(upload), "dest": str(dest)})

    assert r.status_code == 200
    assert dest.read_bytes() == b"upload"


# --- /upload ---------------------------------------------------------------------------------

@pytest.mark.parametrize("name", [
    "../../../cookies/cookies.txt",
    "..\\..\\..\\cookies\\cookies.txt",
    "../../history.db",
    "..\\..\\history.db",
])
def test_upload_name_cannot_climb_out_of_the_uploads_folder(tmp_path, monkeypatch, name):
    library = tmp_path / "library"
    monkeypatch.setenv("AUTO_CLIPPER_WORKSPACE", str(library))
    monkeypatch.delenv("AUTO_CLIPPER_WORK_DIR", raising=False)
    stored = library / "cookies" / "cookies.txt"
    stored.parent.mkdir(parents=True)
    stored.write_bytes(b"secret cookies")
    snapshot = library / "history.db"
    snapshot.write_bytes(b"secret history")

    r = client.post("/upload", files={"file": (name, b"uploaded source", "video/mp4")})

    assert stored.read_bytes() == b"secret cookies"
    assert snapshot.read_bytes() == b"secret history"
    if r.status_code == 200:
        path = r.json()["url"][len("local:"):]
        uploads = os.path.normcase(str(library / "temp_downloads")) + os.sep
        assert os.path.normcase(os.path.abspath(path)).startswith(uploads)
        assert open(path, "rb").read() == b"uploaded source"


# --- other endpoints that open a file by path ------------------------------------------------

@pytest.mark.parametrize("name", ["cookies", "history", "snapshot", "error_log"])
def test_thumbnails_refuse_private_app_files(app_files, name):
    r = client.get("/api/thumbnails", params={"path": str(app_files[name]), "start": 0, "end": 3, "count": 2})

    assert r.status_code == 403
    assert r.json() == DENIED


@pytest.mark.parametrize("name", ["cookies", "history", "snapshot", "error_log"])
def test_extract_metadata_refuses_private_app_files(app_files, name):
    r = client.post("/api/extract-metadata", json={"path": "local:" + str(app_files[name]), "type": ["silence"]})

    assert r.status_code == 403
    assert r.json() == DENIED


# --- NT device paths and network paths (SP3 Task 4 review, Critical 1 and Important 2) --------

# Both reach C:\ through the NT object namespace, which the drive-letter and UNC prefix removal does not cover.
NT_DEVICE_PREFIXES = ["\\\\?\\GLOBALROOT\\??\\", "\\??\\", "//?/GLOBALROOT/??/", "\\\\.\\GLOBALROOT\\??\\"]
DRIVE_DEVICE_PREFIXES = ["\\\\?\\", "\\\\.\\"]
windows_only = pytest.mark.skipif(sys.platform != "win32", reason="Windows device path prefixes")


@windows_only
@pytest.mark.parametrize("prefix", NT_DEVICE_PREFIXES)
@pytest.mark.parametrize("name", ["cookies", "clip"])
def test_any_other_device_path_counts_as_protected(app_files, prefix, name):
    from backend.path_guard import is_protected

    assert is_protected(prefix + str(app_files[name]))
    assert is_protected(prefix + str(app_files[name].parent))


@windows_only
@pytest.mark.parametrize("prefix", NT_DEVICE_PREFIXES)
def test_any_other_device_path_is_never_inside_a_folder(app_files, prefix):
    from backend.path_guard import is_within

    library = str(app_files["library"])
    assert not is_within(prefix + str(app_files["clip"]), library)
    assert not is_within(str(app_files["clip"]), prefix + library)
    assert not is_within(prefix + library, prefix + library)


def _volume_forms(path: str) -> list:
    """``path`` spelled through its volume GUID and its NT device name, with no drive letter or colon left.

    Only the device-prefix rule refuses these: the colon rule does not see them,
    and realpath turns them back into the plain path.
    """
    import ctypes

    drive, rest = os.path.splitdrive(path)
    kernel32 = ctypes.windll.kernel32
    buf = ctypes.create_unicode_buffer(260)
    assert kernel32.GetVolumeNameForVolumeMountPointW(drive + "\\", buf, 260)
    volume = buf.value.rstrip("\\")  # \\?\Volume{GUID}
    assert kernel32.QueryDosDeviceW(drive, buf, 260)
    device = buf.value  # \Device\HarddiskVolumeN
    return [volume + rest, "\\\\.\\" + volume[4:] + rest,
            "\\\\?\\GLOBALROOT" + device + rest, "\\\\.\\GLOBALROOT" + device + rest]


@windows_only
@pytest.mark.parametrize("form", range(4), ids=["volume-guid", "volume-guid-dot", "globalroot-device", "globalroot-device-dot"])
def test_a_volume_guid_or_nt_device_name_counts_as_protected_and_outside_every_folder(app_files, form):
    from backend.path_guard import is_protected, is_within

    library = str(app_files["library"])
    clip = _volume_forms(str(app_files["clip"]))[form]
    assert ":" not in clip
    assert is_protected(clip)
    assert is_protected(_volume_forms(str(app_files["cookies"]))[form])
    assert not is_within(clip, library)
    assert not is_within(str(app_files["clip"]), _volume_forms(library)[form])


@windows_only
@pytest.mark.parametrize("prefix", DRIVE_DEVICE_PREFIXES)
def test_a_plain_drive_letter_device_path_still_resolves(app_files, prefix):
    from backend.path_guard import is_protected, is_within

    assert is_protected(prefix + str(app_files["cookies"]))
    assert not is_protected(prefix + str(app_files["clip"]))
    assert is_within(prefix + str(app_files["clip"]), str(app_files["library"]))


@windows_only
@pytest.mark.parametrize("stream", ["::$INDEX_ALLOCATION", ":$I30:$INDEX_ALLOCATION"])
def test_a_folder_named_by_its_ntfs_stream_counts_as_protected(app_files, stream):
    from backend.path_guard import is_protected, is_within

    path = str(app_files["cookies"].parent) + stream + "\\new.txt"
    assert is_protected(path)
    assert not is_within(str(app_files["library"] / "projects") + stream, str(app_files["library"]))


def _record_device_project(app_files, prefix):
    """A running Desktop job with output_dir=<prefix><app data> and title "cookies" (the reviewer's chain).

    Before the fix such a job was accepted, and its project folder (the cookies
    folder) joined the folders /video and /save_file may read.
    """
    from backend import jobs
    jobs.active_jobs["job-device"] = {"id": "job-device", "title": "cookies", "metadata": {}, "clips": [],
                                      "output_dir": prefix + str(app_files["library"])}


@windows_only
@pytest.mark.parametrize("prefix", NT_DEVICE_PREFIXES)
def test_save_file_refuses_cookies_behind_an_nt_device_path(app_files, tmp_path, prefix):
    _record_device_project(app_files, prefix)
    before = app_files["cookies"].read_bytes()
    dest = tmp_path / "stolen.txt"

    from_cookies = client.post("/save_file", json={"src": prefix + str(app_files["cookies"]), "dest": str(dest)})
    to_cookies = client.post("/save_file", json={"src": str(app_files["clip"]), "dest": prefix + str(app_files["cookies"])})

    assert (from_cookies.status_code, to_cookies.status_code) == (403, 403)
    assert not dest.exists()
    assert app_files["cookies"].read_bytes() == before


@windows_only
@pytest.mark.parametrize("prefix", NT_DEVICE_PREFIXES)
def test_video_refuses_a_signed_nt_device_path(app_files, prefix):
    _record_device_project(app_files, prefix)
    path = prefix + str(app_files["cookies_mp4"])

    r = client.get("/video", params={"path": path, "sig": video_sign.sign(path)})

    assert r.status_code == 403
    assert b"secret" not in r.content


UNC_PATHS = ["\\\\192.0.2.1\\share\\clip.mp4", "//192.0.2.1/share/clip.mp4",
             "\\\\?\\UNC\\192.0.2.1\\share\\clip.mp4", "\\/192.0.2.1\\share\\clip.mp4"]


@pytest.mark.parametrize("path", UNC_PATHS)
def test_video_refuses_a_network_path_before_touching_it(app_files, no_filesystem_for_the_server, path):
    r = client.get("/video", params={"path": path, "sig": "0" * 64})

    assert (r.status_code, r.json()) == (403, DENIED)
    assert no_filesystem_for_the_server == []


@pytest.mark.parametrize("path", UNC_PATHS)
def test_save_file_refuses_a_network_source_or_destination_before_touching_it(app_files, tmp_path, no_filesystem_for_the_server, path):
    from_server = client.post("/save_file", json={"src": path, "dest": str(tmp_path / "copy.mp4")})
    to_server = client.post("/save_file", json={"src": str(app_files["clip"]), "dest": path})

    assert (from_server.status_code, from_server.json()) == (403, DENIED)
    assert (to_server.status_code, to_server.json()) == (403, DENIED)
    assert no_filesystem_for_the_server == []
    assert not (tmp_path / "copy.mp4").exists()


@windows_only
@pytest.mark.parametrize("prefix", NT_DEVICE_PREFIXES + DRIVE_DEVICE_PREFIXES)
def test_video_and_save_file_refuse_every_device_path_by_its_text(app_files, tmp_path, prefix):
    clip = prefix + str(app_files["clip"])

    assert client.get("/video", params={"path": clip, "sig": video_sign.sign(clip)}).status_code == 403
    assert client.post("/save_file", json={"src": clip, "dest": str(tmp_path / "copy.mp4")}).status_code == 403
    assert not (tmp_path / "copy.mp4").exists()
