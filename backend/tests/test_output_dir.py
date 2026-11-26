"""The output folder a job writes to (T1.y, SP3 spec 4.5).

Only the Desktop app may choose it: Cloud and local web ignore ``output_dir``
from the request, so a browser or a tunnel never names a folder on the server.
On Desktop the chosen folder, and the project folder inside it, must never be
a private app file or folder (``path_guard``). /video and /save_file read
clips from a project folder the user chose, but only one that a real job
recorded on the server (running jobs or history), never one from the request.
"""
import os
import sys

import pytest
from fastapi.testclient import TestClient

from backend import cookies, db, jobs, main, video_sign, workspace
from backend.errors import AppError

client = TestClient(main.app)

DENIED = {"status": "error", "message": "Access denied"}
TOKEN = "tok"


@pytest.fixture
def library(tmp_path, monkeypatch):
    lib = tmp_path / "library"
    lib.mkdir()
    monkeypatch.setenv("AUTO_CLIPPER_WORKSPACE", str(lib))
    monkeypatch.delenv("AUTO_CLIPPER_WORK_DIR", raising=False)
    monkeypatch.delenv("AUTO_CLIPPER_CLOUD_MODE", raising=False)
    monkeypatch.delenv("AUTO_CLIPPER_WEB_MODE", raising=False)
    monkeypatch.setattr(cookies, "_copy_dir", lambda: str(lib / "cookie-copies"))
    db.init_db()
    return lib


@pytest.fixture
def captured(monkeypatch):
    """Replaces every job creator and records the output_dir each one was given."""
    seen = {}

    def fake_create_job(url, provider, api_key, aspect_ratio, caption_style, burn_subs, output_dir, *a, **k):
        seen["jobs"] = output_dir
        return "job-1"

    def fake_create_manual_job(url, clips, aspect_ratio, caption_style, burn_subs, output_dir, *a, **k):
        seen["jobs_manual"] = output_dir
        return "job-2"

    def fake_create_rerender_job(history_id, aspect_ratio, burn_subs, output_dir, *a, **k):
        seen["rerender"] = output_dir
        return "job-3"

    def fake_create_rerun_ai_job(history_id, provider, api_key, aspect_ratio, burn_subs, output_dir, *a, **k):
        seen["rerun_ai"] = output_dir
        return "job-4"

    monkeypatch.setattr("backend.jobs.create_job", fake_create_job)
    monkeypatch.setattr("backend.jobs.create_manual_job", fake_create_manual_job)
    monkeypatch.setattr("backend.jobs.create_rerender_job", fake_create_rerender_job)
    monkeypatch.setattr("backend.jobs.create_rerun_ai_job", fake_create_rerun_ai_job)
    return seen


ENDPOINTS = ["jobs", "jobs_manual", "rerender", "rerun_ai"]


def _post(endpoint: str, output_dir: str, title: str = "Talk", headers=None):
    body = {"url": "https://youtu.be/abc", "title": title, "provider": "manual_ai", "output_dir": output_dir}
    path = {
        "jobs": "/jobs",
        "jobs_manual": "/jobs/manual",
        "rerender": "/jobs/hist-1/rerender",
        "rerun_ai": "/jobs/hist-1/rerun_ai",
    }[endpoint]
    return client.post(path, json=body, headers=headers or {})


# --- Cloud and local web ignore output_dir ----------------------------------------------------

@pytest.mark.parametrize("mode_env", ["AUTO_CLIPPER_CLOUD_MODE", "AUTO_CLIPPER_WEB_MODE"])
@pytest.mark.parametrize("endpoint", ENDPOINTS)
def test_cloud_and_local_web_ignore_the_requested_output_dir(library, captured, monkeypatch, tmp_path, mode_env, endpoint):
    monkeypatch.setenv(mode_env, "1")
    monkeypatch.setenv("AUTO_CLIPPER_WEB_TOKEN", TOKEN)
    anywhere = tmp_path / "anywhere"

    r = _post(endpoint, str(anywhere), headers={"Authorization": f"Bearer {TOKEN}"})

    assert r.status_code == 200, r.text
    assert captured[endpoint] == ""
    assert not anywhere.exists()


@pytest.mark.parametrize("mode_env", ["AUTO_CLIPPER_CLOUD_MODE", "AUTO_CLIPPER_WEB_MODE"])
def test_cloud_and_local_web_ignore_even_a_protected_output_dir(library, captured, monkeypatch, mode_env):
    monkeypatch.setenv(mode_env, "1")
    monkeypatch.setenv("AUTO_CLIPPER_WEB_TOKEN", TOKEN)

    r = _post("jobs", str(library / "cookies"), headers={"Authorization": f"Bearer {TOKEN}"})

    assert r.status_code == 200
    assert captured["jobs"] == ""


# --- Desktop: a chosen folder must not be private ---------------------------------------------

@pytest.mark.parametrize("endpoint", ENDPOINTS)
def test_desktop_refuses_a_protected_output_dir(library, captured, endpoint):
    r = _post(endpoint, str(library / "cookies"))

    assert (r.status_code, r.json()) == (403, DENIED)
    assert endpoint not in captured


@pytest.mark.parametrize("endpoint", ENDPOINTS)
def test_desktop_refuses_a_dotdot_output_dir_that_lands_on_the_cookies(library, captured, endpoint):
    sneaky = os.path.join(str(library), "projects", "..", "cookies")

    r = _post(endpoint, sneaky)

    assert (r.status_code, r.json()) == (403, DENIED)
    assert endpoint not in captured


@pytest.mark.parametrize("endpoint", ["jobs", "jobs_manual"])
def test_desktop_refuses_a_title_that_makes_the_project_folder_the_cookies_folder(library, captured, endpoint):
    # The app data folder itself is not private, but <app data>/cookies is.
    r = _post(endpoint, str(library), title="cookies")

    assert (r.status_code, r.json()) == (403, DENIED)
    assert endpoint not in captured


@pytest.mark.parametrize("endpoint", ["rerender", "rerun_ai"])
def test_desktop_refuses_a_rerun_whose_project_title_lands_on_the_cookies_folder(library, captured, endpoint):
    db.save_history("hist-1", "https://youtu.be/abc", "DONE", [], {"title": "cookies", "source_video": "x"})

    r = _post(endpoint, str(library))

    assert (r.status_code, r.json()) == (403, DENIED)
    assert endpoint not in captured


@pytest.mark.parametrize("endpoint", ENDPOINTS)
def test_desktop_passes_a_chosen_folder_on_as_an_absolute_path(library, captured, tmp_path, endpoint):
    chosen = tmp_path / "Videos" / "Klip"

    r = _post(endpoint, "  " + str(chosen) + "  ")

    assert r.status_code == 200, r.text
    assert captured[endpoint] == os.path.abspath(str(chosen))


@pytest.mark.parametrize("endpoint", ENDPOINTS)
def test_desktop_without_a_chosen_folder_uses_the_library(library, captured, endpoint):
    r = _post(endpoint, "")

    assert r.status_code == 200, r.text
    assert captured[endpoint] == ""


# --- get_project_workspace never builds a private project folder ------------------------------

def test_workspace_refuses_a_title_that_names_the_cookies_folder(library):
    with pytest.raises(AppError) as err:
        jobs.get_project_workspace("cookies", output_dir=str(library))

    assert err.value.code == "OUTPUT_DIR_REFUSED"
    assert not (library / "cookies" / "clips").exists()


def test_workspace_refuses_a_protected_output_dir(library):
    with pytest.raises(AppError):
        jobs.get_project_workspace("Talk", output_dir=str(library / "cookies"))

    assert not (library / "cookies" / "Talk").exists()


def test_workspace_refuses_a_project_folder_named_like_the_history_database(library):
    with pytest.raises(AppError):
        jobs.get_project_workspace("history.db", output_dir=str(library))


def test_workspace_refuses_an_output_dir_linked_to_the_cookies_folder(library, tmp_path):
    (library / "cookies").mkdir()
    link = tmp_path / "innocent"
    try:
        os.symlink(library / "cookies", link, target_is_directory=True)
    except (OSError, NotImplementedError):
        pytest.skip("this machine cannot create symlinks")

    with pytest.raises(AppError):
        jobs.get_project_workspace("Talk", output_dir=str(link))

    assert not (library / "cookies" / "Talk").exists()


@pytest.mark.parametrize("title", ["..", ".", " .. ", "...", ". ."])
def test_a_title_of_only_dots_never_climbs_out_of_the_output_folder(library, tmp_path, title):
    out = tmp_path / "out"

    ws = jobs.get_project_workspace(title, output_dir=str(out))

    library_dir = os.path.realpath(ws["library_dir"])
    assert os.path.dirname(library_dir) == os.path.realpath(str(out))


def test_a_title_of_only_dots_never_makes_the_app_data_folder_a_project(library):
    ws = jobs.get_project_workspace("..")

    assert os.path.dirname(os.path.realpath(ws["library_dir"])) == os.path.realpath(str(library / "projects"))


def test_the_refusal_code_has_plain_text_in_both_languages():
    info = AppError("OUTPUT_DIR_REFUSED").to_dict()

    for field in ("title", "message", "title_en", "message_en"):
        assert info[field] and "—" not in info[field]
    assert info["title"] != info["title_en"]
    assert info["message"].count(".") >= 2 and info["message_en"].count(".") >= 2
    assert [a["id"] for a in info["actions"]] == ["open_settings"]


# --- allowed_project_output_dirs ----------------------------------------------------------------

def test_allowed_dirs_come_from_running_jobs_and_history(library, tmp_path):
    running_out = tmp_path / "running"
    history_out = tmp_path / "history"
    active = {"j1": {"id": "j1", "title": "Live Talk", "output_dir": str(running_out), "metadata": {}}}
    history = [{"id": "h1", "metadata": {"title": "Old Talk", "output_dir": str(history_out)}, "result_clips": []}]

    dirs = workspace.allowed_project_output_dirs(active, history)

    assert os.path.join(os.path.abspath(str(running_out)), "Live Talk") in dirs
    assert os.path.join(os.path.abspath(str(history_out)), "Old Talk") in dirs


def test_allowed_dirs_are_project_folders_not_the_whole_output_folder(library, tmp_path):
    out = tmp_path / "out"
    history = [{"id": "h1", "metadata": {"title": "Talk", "output_dir": str(out)}, "result_clips": []}]

    dirs = workspace.allowed_project_output_dirs({}, history)

    assert os.path.abspath(str(out)) not in dirs


def test_allowed_dirs_include_the_project_folder_of_recorded_clips_inside_the_output_folder(library, tmp_path):
    out = tmp_path / "out"
    clip = out / "Older Name" / "clips" / "clip_1.mp4"
    stray = tmp_path / "elsewhere" / "clips" / "clip_2.mp4"
    history = [{"id": "h1", "metadata": {"title": "Talk", "output_dir": str(out)},
                "result_clips": [{"path": str(clip)}, {"path": str(stray)}]}]

    dirs = workspace.allowed_project_output_dirs({}, history)

    assert str(out / "Older Name") in dirs
    assert str(tmp_path / "elsewhere") not in dirs


def test_allowed_dirs_skip_jobs_without_a_chosen_folder_and_private_folders(library, tmp_path):
    active = {"j1": {"id": "j1", "title": "Talk", "output_dir": "", "metadata": {}}}
    history = [{"id": "h1", "metadata": {"title": "cookies", "output_dir": str(library)}, "result_clips": []}]

    assert workspace.allowed_project_output_dirs(active, history) == []


def test_allowed_dirs_are_empty_on_cloud(library, tmp_path, monkeypatch):
    monkeypatch.setenv("AUTO_CLIPPER_CLOUD_MODE", "1")
    history = [{"id": "h1", "metadata": {"title": "Talk", "output_dir": str(tmp_path / "out")}, "result_clips": []}]

    assert workspace.allowed_project_output_dirs({}, history) == []


# --- /video and /save_file read clips from a chosen folder --------------------------------------

def _custom_clip(tmp_path, folder="out", title="Talk", name="clip_1.mp4", data=b"custom clip"):
    clip = tmp_path / folder / title / "clips" / name
    clip.parent.mkdir(parents=True, exist_ok=True)
    clip.write_bytes(data)
    return clip


def _record_history(tmp_path, folder="out", title="Talk"):
    out = tmp_path / folder
    clip = out / title / "clips" / "clip_1.mp4"
    db.save_history("hist-custom", "https://youtu.be/abc", "DONE", [{"path": str(clip)}],
                    {"title": title, "output_dir": str(out)})


def _get_video(path):
    return client.get("/video", params={"path": str(path), "sig": video_sign.sign(str(path))})


def test_video_plays_a_clip_from_a_chosen_folder_recorded_in_history(library, tmp_path):
    clip = _custom_clip(tmp_path)
    _record_history(tmp_path)

    r = _get_video(clip)

    assert r.status_code == 200
    assert r.content == b"custom clip"


def test_video_plays_a_clip_from_a_chosen_folder_of_a_running_job(library, tmp_path, monkeypatch):
    clip = _custom_clip(tmp_path)
    monkeypatch.setitem(jobs.active_jobs, "live", {"id": "live", "title": "Talk", "output_dir": str(tmp_path / "out"),
                                                   "metadata": {}, "clips": []})

    assert _get_video(clip).status_code == 200


def test_video_from_a_chosen_folder_still_needs_the_signature(library, tmp_path):
    clip = _custom_clip(tmp_path)
    _record_history(tmp_path)

    assert client.get("/video", params={"path": str(clip)}).status_code == 403
    assert client.get("/video", params={"path": str(clip), "sig": "0" * 64}).status_code == 403


def test_video_refuses_a_file_outside_every_recorded_project(library, tmp_path):
    _record_history(tmp_path)
    outside = tmp_path / "elsewhere" / "private.mp4"
    outside.parent.mkdir()
    outside.write_bytes(b"not ours")

    r = _get_video(outside)

    assert r.status_code == 403
    assert b"not ours" not in r.content


def test_video_refuses_a_folder_that_only_starts_like_the_chosen_folder(library, tmp_path):
    _record_history(tmp_path)
    evil = _custom_clip(tmp_path, folder="out-evil", data=b"evil")
    evil_project = _custom_clip(tmp_path, title="Talk-evil", data=b"evil")

    assert _get_video(evil).status_code == 403
    assert _get_video(evil_project).status_code == 403


def test_video_refuses_another_project_in_the_chosen_folder_that_no_job_recorded(library, tmp_path):
    _record_history(tmp_path)
    other = _custom_clip(tmp_path, title="Unknown", data=b"other")

    assert _get_video(other).status_code == 403


def test_video_refuses_a_private_file_inside_a_chosen_project_folder(library, tmp_path):
    _record_history(tmp_path)
    private = _custom_clip(tmp_path, name="history.db.mp4", data=b"secret")

    r = _get_video(private)

    assert (r.status_code, r.json()) == (403, DENIED)


def test_video_does_not_open_a_chosen_folder_on_cloud(library, tmp_path, monkeypatch):
    clip = _custom_clip(tmp_path)
    _record_history(tmp_path)
    monkeypatch.setenv("AUTO_CLIPPER_CLOUD_MODE", "1")

    assert _get_video(clip).status_code == 403


def test_save_file_copies_a_clip_from_a_chosen_folder(library, tmp_path):
    clip = _custom_clip(tmp_path)
    _record_history(tmp_path)
    dest = tmp_path / "Downloads" / "clip.mp4"
    dest.parent.mkdir()

    r = client.post("/save_file", json={"src": str(clip), "dest": str(dest)})

    assert r.status_code == 200, r.text
    assert dest.read_bytes() == b"custom clip"


def test_save_file_refuses_a_file_outside_every_recorded_project(library, tmp_path):
    _record_history(tmp_path)
    outside = tmp_path / "elsewhere" / "secret.txt"
    outside.parent.mkdir()
    outside.write_bytes(b"not ours")
    dest = tmp_path / "copy.txt"

    r = client.post("/save_file", json={"src": str(outside), "dest": str(dest)})

    assert r.status_code == 403
    assert not dest.exists()


def test_save_file_refuses_a_folder_that_only_starts_like_the_chosen_folder(library, tmp_path):
    _record_history(tmp_path)
    evil = _custom_clip(tmp_path, folder="out-evil", data=b"evil")
    dest = tmp_path / "copy.mp4"

    r = client.post("/save_file", json={"src": str(evil), "dest": str(dest)})

    assert r.status_code == 403
    assert not dest.exists()


def test_save_file_refuses_a_private_file_inside_a_chosen_project_folder(library, tmp_path):
    _record_history(tmp_path)
    private = _custom_clip(tmp_path, name="backend_error.log", data=b"secret")
    dest = tmp_path / "copy.log"

    r = client.post("/save_file", json={"src": str(private), "dest": str(dest)})

    assert (r.status_code, r.json()) == (403, DENIED)
    assert not dest.exists()


@pytest.mark.skipif(sys.platform != "win32", reason="Windows paths ignore case")
def test_video_matches_a_chosen_folder_in_another_case(library, tmp_path):
    clip = _custom_clip(tmp_path)
    _record_history(tmp_path)
    upper = str(clip).upper()

    r = client.get("/video", params={"path": upper, "sig": video_sign.sign(upper)})

    assert r.status_code == 200


# --- Fix round 1 (SP3 Task 4 review) --------------------------------------------------------------

NT_DEVICE_PREFIXES = ["\\\\?\\GLOBALROOT\\??\\", "\\??\\", "//?/GLOBALROOT/??/"]
windows_only = pytest.mark.skipif(sys.platform != "win32", reason="Windows device paths and drive letters")


@windows_only
@pytest.mark.parametrize("prefix", NT_DEVICE_PREFIXES)
@pytest.mark.parametrize("endpoint", ENDPOINTS)
def test_desktop_refuses_an_nt_device_output_dir_that_names_the_cookies(library, captured, endpoint, prefix):
    db.save_history("hist-1", "https://youtu.be/abc", "DONE", [], {"title": "cookies", "source_video": "x"})

    r = _post(endpoint, prefix + str(library), title="cookies")

    assert (r.status_code, r.json()) == (403, DENIED)
    assert endpoint not in captured


@windows_only
@pytest.mark.parametrize("prefix", NT_DEVICE_PREFIXES + ["\\\\?\\", "\\\\.\\"])
def test_desktop_refuses_any_device_output_dir_even_an_innocent_one(library, captured, tmp_path, prefix):
    r = _post("jobs", prefix + str(tmp_path / "out"))

    assert (r.status_code, r.json()) == (403, DENIED)
    assert "jobs" not in captured


@pytest.mark.parametrize("output_dir", ["\\\\192.0.2.1\\share\\out", "//192.0.2.1/share/out", "\\/192.0.2.1/share/out"])
@pytest.mark.parametrize("endpoint", ENDPOINTS)
def test_desktop_refuses_a_network_output_dir_before_touching_it(library, captured, no_filesystem_for_the_server, endpoint, output_dir):
    db.save_history("hist-1", "https://youtu.be/abc", "DONE", [], {"title": "Talk", "source_video": "x"})

    r = _post(endpoint, output_dir)

    assert (r.status_code, r.json()) == (403, DENIED)
    assert endpoint not in captured
    assert no_filesystem_for_the_server == []


@pytest.mark.parametrize("output_dir", ["out", "./out", "..\\out"] + (["C:out", "\\out", "/out"] if sys.platform == "win32" else []))
def test_desktop_refuses_a_relative_output_dir(library, captured, output_dir):
    r = _post("jobs", output_dir)

    assert (r.status_code, r.json()) == (403, DENIED)
    assert "jobs" not in captured


def _link_folder(link, target):
    """A junction on Windows (no admin needed), a symlink elsewhere."""
    if sys.platform == "win32":
        import _winapi
        _winapi.CreateJunction(str(target), str(link))
    else:
        os.symlink(target, link, target_is_directory=True)


def test_desktop_stores_the_resolved_output_dir(library, captured, tmp_path):
    real = tmp_path / "real"
    real.mkdir()
    link = tmp_path / "link"
    _link_folder(link, real)

    r = _post("jobs", str(link))

    assert r.status_code == 200, r.text
    assert captured["jobs"] == os.path.realpath(str(real))


@windows_only
def test_desktop_keeps_a_mapped_drive_letter_instead_of_its_network_path(library, captured, monkeypatch):
    # realpath turns a mapped drive (Z:\Clips) into \\server\share\Clips; clips must keep the drive letter
    # so /video and /save_file, which refuse network paths, still open them.
    real_realpath = os.path.realpath
    monkeypatch.setattr(os.path, "realpath", lambda p, *a, **k: "\\\\nas\\share\\Clips" if str(p).upper().startswith("Z:") else real_realpath(p, *a, **k))

    r = _post("jobs", "Z:\\Clips")

    assert r.status_code == 200, r.text
    assert captured["jobs"] == "Z:\\Clips"


# Minor 5: the app's own working folders are not project folders.
@pytest.mark.parametrize("title", ["projects", "addons", "temp_downloads", "Projects"])
@pytest.mark.parametrize("endpoint", ["jobs", "jobs_manual"])
def test_desktop_refuses_a_project_folder_that_is_an_app_folder(library, captured, endpoint, title):
    r = _post(endpoint, str(library), title=title)

    assert (r.status_code, r.json()) == (403, DENIED)
    assert endpoint not in captured


def test_desktop_refuses_a_project_folder_that_contains_the_app_data_folder(library, captured):
    r = _post("jobs", str(library.parent), title=library.name)

    assert (r.status_code, r.json()) == (403, DENIED)
    assert "jobs" not in captured


@pytest.mark.parametrize("title", ["projects", "addons", "temp_downloads"])
def test_workspace_refuses_a_project_folder_that_is_an_app_folder(library, title):
    with pytest.raises(AppError) as err:
        jobs.get_project_workspace(title, output_dir=str(library))

    assert err.value.code == "OUTPUT_DIR_REFUSED"


def test_workspace_refuses_a_project_folder_that_contains_the_app_data_folder(library):
    with pytest.raises(AppError):
        jobs.get_project_workspace(library.name, output_dir=str(library.parent))


# Re-review minor 3: nor a project folder inside the add-ons or download folders.
@pytest.mark.parametrize("app_folder", ["addons", "temp_downloads", "Addons"])
@pytest.mark.parametrize("endpoint", ["jobs", "jobs_manual"])
def test_desktop_refuses_a_project_folder_inside_the_addons_or_download_folder(library, captured, endpoint, app_folder):
    r = _post(endpoint, str(library / app_folder))

    assert (r.status_code, r.json()) == (403, DENIED)
    assert endpoint not in captured


@pytest.mark.parametrize("output_dir", ["addons", "temp_downloads", "addons/mediapipe", "temp_downloads/old"])
def test_workspace_refuses_a_project_folder_inside_the_addons_or_download_folder(library, output_dir):
    with pytest.raises(AppError) as err:
        jobs.get_project_workspace("Talk", output_dir=str(library.joinpath(*output_dir.split("/"))))

    assert err.value.code == "OUTPUT_DIR_REFUSED"
    assert not (library / output_dir.split("/")[0]).exists()


def test_workspace_still_accepts_a_project_folder_inside_the_projects_folder(library):
    ws = jobs.get_project_workspace("Talk", output_dir=str(library / "projects"))

    assert os.path.isdir(ws["clips_dir"])


def test_workspace_still_accepts_a_project_named_like_an_app_folder_in_another_folder(library, tmp_path):
    ws = jobs.get_project_workspace("projects", output_dir=str(tmp_path / "out"))

    assert os.path.isdir(ws["clips_dir"])


# Minor 6: an unreadable history is the endpoint's JSON error, not a bare 500.
@pytest.mark.parametrize("endpoint", ["rerender", "rerun_ai"])
def test_rerun_with_an_unreadable_history_answers_json(library, captured, monkeypatch, tmp_path, endpoint):
    def broken(job_id):
        raise RuntimeError("database is locked")

    monkeypatch.setattr("backend.db.get_history", broken)

    r = client.post({"rerender": "/jobs/hist-1/rerender", "rerun_ai": "/jobs/hist-1/rerun_ai"}[endpoint],
                    json={"url": "https://youtu.be/abc", "title": "Talk", "provider": "manual_ai", "output_dir": str(tmp_path / "out")})

    assert r.status_code == 400
    assert r.json()["status"] == "error"
    assert endpoint not in captured


# Minor 7: an unreadable history opens nothing more.
def test_allowed_dirs_are_empty_when_history_cannot_be_read(library, monkeypatch):
    def broken():
        raise RuntimeError("database is locked")

    monkeypatch.setattr("backend.db.get_all_history", broken)

    assert workspace.allowed_project_output_dirs({}) == []


def test_deleting_an_old_dotdot_project_keeps_the_output_folder_and_its_parent(library, tmp_path):
    # Before sanitize_title refused it, a ".." title made <output>/.. the project folder.
    parent = tmp_path / "parent"
    out = parent / "out"
    out.mkdir(parents=True)
    (out / "keep.txt").write_text("mine")
    (parent / "keep.txt").write_text("mine too")
    db.save_history("old-dotdot", "https://youtu.be/abc", "DONE", [], {"title": "..", "output_dir": str(out)})

    db.delete_history("old-dotdot")

    assert (out / "keep.txt").read_text() == "mine"
    assert (parent / "keep.txt").read_text() == "mine too"
    assert db.get_history("old-dotdot") is None


# Minor 3: AI Koreksi records the folder it really writes to.
def test_rerun_ai_without_a_chosen_folder_keeps_the_output_folder_from_history(library, tmp_path, monkeypatch):
    out = tmp_path / "out"
    source = tmp_path / "source.mp4"
    source.write_bytes(b"video")
    db.save_history("hist-1", "https://youtu.be/abc", "DONE", [], {"title": "Talk", "output_dir": str(out), "source_video": str(source)})
    monkeypatch.setattr(jobs, "_start_job", lambda *a, **k: None)

    job_id = jobs.create_rerun_ai_job("hist-1", "manual_ai", "", "9:16", True, "", "")

    assert jobs.active_jobs[job_id]["output_dir"] == str(out)


# Minor 4: Cloud never writes into an output folder from history.
@pytest.mark.parametrize("output_dir", ["out", ""])
def test_cloud_workspace_ignores_an_output_dir_from_history(library, tmp_path, monkeypatch, output_dir):
    monkeypatch.setenv("AUTO_CLIPPER_CLOUD_MODE", "1")
    old = tmp_path / output_dir if output_dir else ""

    ws = jobs.get_project_workspace("Talk", output_dir=str(old) if old else "")

    assert os.path.realpath(ws["library_dir"]) == os.path.realpath(str(library / "projects" / "Talk"))
    if old:
        assert not old.exists()


def test_cloud_project_folder_is_in_the_library_not_the_old_output_folder(library, tmp_path, monkeypatch):
    monkeypatch.setenv("AUTO_CLIPPER_CLOUD_MODE", "1")
    out = tmp_path / "old-out"

    assert jobs.project_library_dir("Talk", str(out)) == os.path.join(str(library), "projects", "Talk")


# Minor 8: Windows drops trailing dots and spaces, so "Wow..." would make a folder it cannot open.
@pytest.mark.parametrize("title,folder", [("Wow...", "Wow"), ("Talk . ", "Talk"), ("A.b.", "A.b"), ("Wow!!!", "Wow")])
def test_sanitize_title_drops_trailing_dots_and_spaces(title, folder):
    assert jobs.sanitize_title(title) == folder


def test_a_title_ending_in_dots_makes_a_usable_project_folder(library, tmp_path):
    ws = jobs.get_project_workspace("Wow...", output_dir=str(tmp_path / "out"))

    assert os.path.basename(ws["library_dir"]) == "Wow"
    assert os.path.isdir(os.path.join(ws["library_dir"], "source"))


def test_workspace_refuses_a_project_folder_inside_the_work_dir_downloads(tmp_path, monkeypatch):
    import pytest
    from backend import errors, jobs

    lib = tmp_path / "lib"
    work = tmp_path / "work"
    lib.mkdir()
    work.mkdir()
    monkeypatch.setenv("AUTO_CLIPPER_WORKSPACE", str(lib))
    monkeypatch.setenv("AUTO_CLIPPER_WORK_DIR", str(work))
    monkeypatch.delenv("AUTO_CLIPPER_CLOUD_MODE", raising=False)

    with pytest.raises(errors.AppError) as exc:
        jobs.refuse_protected_project_dir("", str(work / "temp_downloads" / "proj"))
    assert exc.value.code == "OUTPUT_DIR_REFUSED"

    with pytest.raises(errors.AppError) as exc2:
        jobs.get_project_workspace("temp_downloads", output_dir=str(work))
    assert exc2.value.code == "OUTPUT_DIR_REFUSED"
