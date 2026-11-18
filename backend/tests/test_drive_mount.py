"""Colab started before Google Drive was mounted (T0.17).

The library is /content/drive/MyDrive/AutoClipperData. Before the notebook
mounts Drive, that path is only a folder on the runtime's own disk: anything
created there is lost with the runtime and makes the later
drive.mount('/content/drive') fail. So nothing may be created under
/content/drive, and every job is refused with DRIVE_NOT_MOUNTED.

A temp folder stands in for /content/drive and ``os.path.ismount`` decides
whether it is mounted.
"""
import os
import sqlite3
import time
from contextlib import closing
from types import SimpleNamespace

import pytest

import backend.db as db
from backend import colab_api, cookies, drive_mount, jobs, logger, preflight, workspace
from backend.errors import AppError


def _forget_snapshots():
    for snap in list(db._snapshots.values()):
        if snap._timer is not None:
            snap._timer.cancel()
    db._snapshots.clear()


@pytest.fixture
def colab(tmp_path, monkeypatch):
    """A Colab runtime whose library is on a Google Drive that is not mounted yet."""
    drive = tmp_path / "drive"
    state = SimpleNamespace(
        drive=drive, work=tmp_path / "work", library=drive / "MyDrive" / "AutoClipperData",
        temp=tmp_path / "system-temp", mounted=False,
    )
    real_ismount = os.path.ismount

    def ismount(path):
        if os.path.normcase(os.path.abspath(str(path))) == os.path.normcase(str(drive)):
            return state.mounted
        return real_ismount(path)

    monkeypatch.setattr(os.path, "ismount", ismount)
    monkeypatch.setattr(drive_mount, "DRIVE_ROOT", str(drive))
    monkeypatch.setattr(colab_api, "DRIVE_ROOT", str(drive), raising=False)
    monkeypatch.setattr(drive_mount, "_system_temp_dir", lambda: str(state.temp))
    monkeypatch.setenv("AUTO_CLIPPER_CLOUD_MODE", "1")
    monkeypatch.setenv("AUTO_CLIPPER_WORKSPACE", str(state.library))
    monkeypatch.setenv("AUTO_CLIPPER_WORK_DIR", str(state.work))
    monkeypatch.setattr(db, "SNAPSHOT_MIN_INTERVAL", 3600.0)
    _forget_snapshots()
    yield state
    _forget_snapshots()


def _nothing_under(drive) -> bool:
    return not drive.exists()


# --- nothing is created under an unmounted Drive ---------------------------------

def test_app_data_dir_is_refused_instead_of_created(colab):
    for get_dir in (logger.get_app_data_dir, db.get_app_data_dir):
        with pytest.raises(AppError) as caught:
            get_dir()
        assert caught.value.code == "DRIVE_NOT_MOUNTED"
    assert _nothing_under(colab.drive)


def test_logs_go_to_the_work_dir_while_drive_is_not_mounted(colab):
    logger.log_error("test.drive", "something failed", exc_info=False)
    logger.log_app("an app line")

    assert "something failed" in (colab.work / "backend_error.log").read_text(encoding="utf-8")
    assert "an app line" in logger.get_log_content("app")
    assert _nothing_under(colab.drive)


def test_logs_go_to_the_system_temp_dir_without_a_work_dir(colab, monkeypatch):
    monkeypatch.delenv("AUTO_CLIPPER_WORK_DIR")
    logger.log_error("test.drive", "something failed", exc_info=False)

    assert "something failed" in (colab.temp / "AutoClipper" / "backend_error.log").read_text(encoding="utf-8")
    assert _nothing_under(colab.drive)


def test_history_works_on_the_work_dir_and_no_snapshot_is_written_to_drive(colab):
    db.init_db()
    db.save_history("job-1", "u", "DONE", [], {})
    assert db.flush_snapshot() is True

    assert db.get_db_path() == str(colab.work / "history.db")
    assert [row["id"] for row in db.get_all_history()] == ["job-1"]
    assert _nothing_under(colab.drive)


def test_history_without_a_work_dir_stays_on_this_machine(colab, monkeypatch):
    monkeypatch.delenv("AUTO_CLIPPER_WORK_DIR")
    db.init_db()
    db.save_history("job-1", "u", "DONE", [], {})

    assert db.get_db_path() == str(colab.temp / "AutoClipper" / "history.db")
    assert [row["id"] for row in db.get_all_history()] == ["job-1"]
    assert _nothing_under(colab.drive)


def test_history_reaches_drive_once_it_is_mounted_and_keeps_the_jobs_already_there(colab):
    db.init_db()
    db.save_history("job-before-mount", "u", "DONE", [], {})
    assert _nothing_under(colab.drive)

    # The notebook mounts Drive, whose library holds a job from an earlier session.
    colab.mounted = True
    colab.library.mkdir(parents=True)
    with closing(sqlite3.connect(str(colab.library / "history.db"))) as conn:
        conn.execute("CREATE TABLE history (id TEXT PRIMARY KEY, url TEXT, status TEXT, created_at TEXT, "
                     "result_clips TEXT, metadata TEXT)")
        conn.execute("INSERT INTO history VALUES ('job-old', 'u', 'DONE', '2026-01-01T00:00:00', '[]', '{}')")
        conn.commit()

    db.save_history("job-after-mount", "u", "DONE", [], {})

    with closing(sqlite3.connect(str(colab.library / "history.db"))) as conn:
        ids = {row[0] for row in conn.execute("SELECT id FROM history")}
    assert ids == {"job-old", "job-before-mount", "job-after-mount"}


def test_storage_and_uploads_use_the_work_dir_only(colab):
    assert workspace.storage_dirs() == [str(colab.work)]
    assert workspace.free_disk_gb() > 0
    assert workspace.uploads_dir() == os.path.join(str(colab.work), "temp_downloads")
    assert _nothing_under(colab.drive)


def test_publishing_to_the_library_is_refused(colab, tmp_path):
    src = tmp_path / "clip.mp4"
    src.write_bytes(b"clip")
    with pytest.raises(AppError) as caught:
        workspace.copy_atomic(str(src), str(colab.library / "projects" / "p" / "clips" / "clip.mp4"))
    assert caught.value.code == "DRIVE_NOT_MOUNTED"
    assert _nothing_under(colab.drive)


def test_cookies_are_not_stored_on_an_unmounted_drive(colab):
    with pytest.raises(AppError) as caught:
        cookies.get_cookies_path()
    assert caught.value.code == "DRIVE_NOT_MOUNTED"
    assert _nothing_under(colab.drive)


def test_endpoint_that_needs_the_library_answers_with_the_error_card(colab, monkeypatch):
    from fastapi.testclient import TestClient
    from backend.main import app

    monkeypatch.setenv("AUTO_CLIPPER_WEB_TOKEN", "t")
    r = TestClient(app).get("/api/settings/cookies", headers={"Authorization": "Bearer t"})

    assert r.status_code == 400
    assert r.json()["error_info"]["code"] == "DRIVE_NOT_MOUNTED"
    assert _nothing_under(colab.drive)


# --- preflight blocks, jobs are refused before any work -------------------------

def test_drive_check_blocks(colab):
    result = preflight.check_drive()
    assert result["level"] == "block"
    assert result["code"] == "DRIVE_NOT_MOUNTED"
    assert _nothing_under(colab.drive)


def test_blocking_error_is_drive_not_mounted(colab):
    err = preflight.blocking_error()
    assert isinstance(err, AppError)
    assert err.code == "DRIVE_NOT_MOUNTED"
    assert _nothing_under(colab.drive)


def test_preflight_endpoint_reports_the_block_and_creates_nothing(colab, monkeypatch):
    from fastapi.testclient import TestClient
    from backend.main import app

    monkeypatch.setenv("AUTO_CLIPPER_WEB_TOKEN", "t")
    r = TestClient(app).get("/api/preflight", headers={"Authorization": "Bearer t"})

    checks = {c["id"]: c for c in r.json()["checks"]}
    assert checks["drive"]["level"] == "block"
    assert checks["disk"]["level"] in ("ok", "warn", "block")  # measured, not crashed
    assert "could not run" not in checks["disk"]["title_en"]
    assert _nothing_under(colab.drive)


def _wait_until(predicate, timeout=5.0):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if predicate():
            return True
        time.sleep(0.01)
    return False


def test_new_job_is_refused_before_any_work(colab, monkeypatch):
    saved = []
    monkeypatch.setattr("backend.db.save_history", lambda job_id, url, status, clips, meta: saved.append((job_id, status, meta)))
    monkeypatch.setattr("backend.db.get_all_history", lambda: [])
    ran = []
    monkeypatch.setattr(jobs, "_run_manual_job", lambda job_id: ran.append(job_id))

    job_id = jobs.create_manual_job("https://youtu.be/x", [], title="No Drive")

    assert _wait_until(lambda: jobs.active_jobs[job_id]["status"] == "ERROR")
    assert ran == []
    assert jobs.active_jobs[job_id]["error_info"]["code"] == "DRIVE_NOT_MOUNTED"
    assert saved[-1][1] == "ERROR" and saved[-1][2]["error_info"]["code"] == "DRIVE_NOT_MOUNTED"
    assert _nothing_under(colab.drive)


# --- the Colab entry point -------------------------------------------------------

@pytest.fixture
def restored_environment(monkeypatch):
    # setup_environment writes these straight into os.environ.
    for name in ("AUTO_CLIPPER_DEV_TOKEN", "AUTO_CLIPPER_WEB_TOKEN", "API_SECRET_TOKEN", "LD_LIBRARY_PATH"):
        monkeypatch.delenv(name, raising=False)


def test_colab_setup_creates_nothing_on_drive_and_says_jobs_are_refused(colab, restored_environment, capsys):
    colab_api.setup_environment(str(colab.library), work_dir=str(colab.work))

    err = capsys.readouterr().err
    assert "belum terhubung" in err and "ditolak" in err and "refused" in err
    assert colab.work.is_dir()
    assert _nothing_under(colab.drive)


def test_colab_setup_does_not_create_a_work_dir_on_an_unmounted_drive(colab, restored_environment):
    colab_api.setup_environment(str(colab.library), work_dir=str(colab.drive / "MyDrive" / "work"))
    assert _nothing_under(colab.drive)


def test_colab_setup_creates_the_library_once_drive_is_mounted(colab, restored_environment, capsys):
    colab.mounted = True
    colab_api.setup_environment(str(colab.library), work_dir=str(colab.work))
    assert colab.library.is_dir()
    assert "belum terhubung" not in capsys.readouterr().err


# --- unchanged when Drive is mounted, outside Colab, or with a local library -------

def test_mounted_drive_behaves_as_before(colab):
    colab.mounted = True

    assert logger.get_app_data_dir() == str(colab.library)
    assert preflight.check_drive()["level"] == "ok"
    assert preflight.blocking_error() is None
    logger.log_error("test.drive", "mounted", exc_info=False)
    assert (colab.library / "backend_error.log").is_file()
    assert workspace.storage_dirs() == [str(colab.library), str(colab.work)]


def test_outside_colab_nothing_changes(colab, monkeypatch):
    monkeypatch.delenv("AUTO_CLIPPER_CLOUD_MODE")

    assert db.get_app_data_dir() == str(colab.library)
    assert preflight.check_drive()["level"] == "ok"
    assert preflight.blocking_error() is None
    logger.log_error("test.drive", "desktop", exc_info=False)
    assert (colab.library / "backend_error.log").is_file()


def test_library_outside_drive_is_not_affected(colab, monkeypatch, tmp_path):
    local = tmp_path / "local-library"
    monkeypatch.setenv("AUTO_CLIPPER_WORKSPACE", str(local))

    assert logger.get_app_data_dir() == str(local)
    assert preflight.check_drive()["level"] == "ok"
    assert preflight.blocking_error() is None
    assert _nothing_under(colab.drive)


@pytest.mark.parametrize("path, on_drive", [
    ("/content/drive", True),
    ("/content/drive/MyDrive/AutoClipperData", True),
    ("/content/drive-backup/data", False),
    ("/content/work", False),
    ("", False),
])
def test_only_paths_inside_the_drive_mount_point_count(path, on_drive):
    assert drive_mount.is_on_drive(path) is on_drive
