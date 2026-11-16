import os
import shutil
import sqlite3
import subprocess
import sys
from contextlib import closing

import pytest

import backend.db as db
from backend import jobs



def _use_tmp_db(monkeypatch, tmp_path):
    dbfile = tmp_path / "history.db"
    monkeypatch.setattr(db, "get_db_path", lambda: str(dbfile))
    db.init_db()


def test_history_roundtrip(monkeypatch, tmp_path):
    _use_tmp_db(monkeypatch, tmp_path)

    clips = [{"path": "/x/clip1.mp4", "description": "a"}]
    meta = {"source_video": "/x/source.mp4", "highlights": [{"start_time": "0"}]}
    db.save_history("job-1", "https://youtu.be/x", "DONE", clips, meta)

    one = db.get_history("job-1")
    assert one is not None
    assert one["url"] == "https://youtu.be/x"
    assert one["result_clips"] == clips
    assert one["metadata"]["source_video"] == "/x/source.mp4"

    all_rows = db.get_all_history()
    assert any(r["id"] == "job-1" for r in all_rows)


def test_save_history_updates_existing(monkeypatch, tmp_path):
    _use_tmp_db(monkeypatch, tmp_path)
    db.save_history("job-2", "u", "PENDING", [], {})
    db.save_history("job-2", "u", "DONE", [{"path": "/c.mp4"}], {})
    row = db.get_history("job-2")
    assert row["status"] == "DONE"
    assert len(db.get_all_history()) == 1  # updated, not duplicated


def test_delete_history(monkeypatch, tmp_path):
    _use_tmp_db(monkeypatch, tmp_path)
    db.save_history("job-3", "u", "DONE", [], {})
    db.delete_history("job-3")
    assert db.get_history("job-3") is None


def test_delete_history_shared_source_preserves_file(monkeypatch, tmp_path):
    _use_tmp_db(monkeypatch, tmp_path)

    src_file = tmp_path / "source_video.mp4"
    src_file.write_bytes(b"dummy video")

    sub_file = tmp_path / "subtitles.srt"
    sub_file.write_bytes(b"1\n00:00:00,000 --> 00:00:05,000\nHello\n")

    clip1 = tmp_path / "clip1.mp4"
    clip1.write_bytes(b"clip 1")
    clip2 = tmp_path / "clip2.mp4"
    clip2.write_bytes(b"clip 2")

    meta_parent = {"source_video": str(src_file), "subtitle_path": str(sub_file)}
    meta_rerender = {"source_video": str(src_file), "subtitle_path": str(sub_file)}

    db.save_history("job-parent", "https://youtu.be/test", "DONE", [{"path": str(clip1)}], meta_parent)
    db.save_history("job-rerender", "https://youtu.be/test", "DONE", [{"path": str(clip2)}], meta_rerender)

    # Delete rerender job
    db.delete_history("job-rerender")

    # Clip 2 must be deleted
    assert not clip2.exists()
    # But shared source and subtitle MUST still exist!
    assert src_file.exists()
    assert sub_file.exists()
    # Clip 1 must still exist
    assert clip1.exists()
    assert db.get_history("job-parent") is not None
    assert db.get_history("job-rerender") is None

    # Now delete parent job (the last one referencing the source)
    db.delete_history("job-parent")
    assert not clip1.exists()
    assert not src_file.exists()
    assert not sub_file.exists()
    assert db.get_history("job-parent") is None


def test_safe_remove_file_and_dir(tmp_path):
    f = tmp_path / "test.txt"
    f.write_text("hello")
    assert f.exists()
    assert db.safe_remove_file(str(f)) is True
    assert not f.exists()
    assert db.safe_remove_file(str(f)) is True  # non-existent is safe

    d = tmp_path / "subdir"
    d.mkdir()
    (d / "inner.txt").write_text("inner")
    assert d.exists()
    assert db.safe_remove_dir(str(d)) is True
    assert not d.exists()


def test_delete_history_cleans_project_workspace(monkeypatch, tmp_path):
    _use_tmp_db(monkeypatch, tmp_path)
    monkeypatch.setenv("AUTO_CLIPPER_WORKSPACE", str(tmp_path))

    ws_dir = tmp_path / "projects" / "Project_job-clean"
    ws_clips = ws_dir / "clips"
    ws_clips.mkdir(parents=True)
    clip_file = ws_clips / "clip_1.mp4"
    clip_file.write_bytes(b"clip data")

    db.save_history("job-clean", "https://youtu.be/clean", "DONE", [{"path": str(clip_file)}], {})
    assert ws_dir.exists()

    db.delete_history("job-clean")
    assert not clip_file.exists()
    assert not ws_dir.exists()
    assert db.get_history("job-clean") is None


def test_get_app_data_dir_custom_workspace(monkeypatch, tmp_path):
    custom_ws = str(tmp_path / "custom_workspace")
    monkeypatch.setenv("AUTO_CLIPPER_WORKSPACE", f"  {custom_ws}  ")
    res = db.get_app_data_dir()
    assert res == os.path.abspath(custom_ws)
    assert (tmp_path / "custom_workspace").is_dir()


def test_get_app_data_dir_default(monkeypatch, tmp_path):
    monkeypatch.delenv("AUTO_CLIPPER_WORKSPACE", raising=False)
    monkeypatch.setenv("APPDATA", str(tmp_path))
    res = db.get_app_data_dir()
    assert "AutoClipper" in res

    # Empty string should fallback
    monkeypatch.setenv("AUTO_CLIPPER_WORKSPACE", "   ")
    res2 = db.get_app_data_dir()
    assert "AutoClipper" in res2


def test_fix_stuck_jobs_marks_in_progress_with_error_message(monkeypatch, tmp_path):
    _use_tmp_db(monkeypatch, tmp_path)
    
    # Save jobs in different in-progress states
    db.save_history("job-dl", "https://youtu.be/dl", "DOWNLOADING", [], {"source_video": "/tmp/v.mp4"})
    db.save_history("job-trans", "https://youtu.be/trans", "TRANSCRIBING", [], {"source_video": "/tmp/v.mp4"})
    db.save_history("job-anal", "https://youtu.be/anal", "ANALYZING", [], {"source_video": "/tmp/v.mp4"})
    db.save_history("job-crop", "https://youtu.be/crop", "CROPPING", [], {"highlights": [{"start": 0}]})
    db.save_history("job-done", "https://youtu.be/done", "DONE", [{"path": "/tmp/c.mp4"}], {})

    db.fix_stuck_jobs()

    # In-progress jobs should become ERROR with explanatory error message in metadata
    for jid in ["job-dl", "job-trans", "job-anal", "job-crop"]:
        row = db.get_history(jid)
        assert row["status"] == "ERROR"
        assert "ter-restart" in row["metadata"]["error"]

    # DONE job should stay DONE
    done_row = db.get_history("job-done")
    assert done_row["status"] == "DONE"


def test_save_history_preserves_metadata_when_none(monkeypatch, tmp_path):
    _use_tmp_db(monkeypatch, tmp_path)
    initial_meta = {"provider": "gemini", "title": "My Title"}
    db.save_history("job-meta", "https://youtu.be/m", "DOWNLOADING", [], initial_meta)

    # Update with metadata=None
    db.save_history("job-meta", "https://youtu.be/m", "TRANSCRIBING", [], None)
    row = db.get_history("job-meta")
    assert row["status"] == "TRANSCRIBING"
    assert row["metadata"]["provider"] == "gemini"
    assert row["metadata"]["title"] == "My Title"


def test_save_history_preserves_clips_when_empty(monkeypatch, tmp_path):
    _use_tmp_db(monkeypatch, tmp_path)
    clips = [{"path": "/x/clip1.mp4", "description": "Clip 1"}]
    db.save_history("job-clips", "https://youtu.be/c", "CROPPING", clips, {"title": "Test"})

    # Update with empty clips list (e.g. intermediate save without passing clips)
    db.save_history("job-clips", "https://youtu.be/c", "CROPPING", [], {"title": "Test", "step": 2})
    row = db.get_history("job-clips")
    assert len(row["result_clips"]) == 1
    assert row["result_clips"][0]["path"] == "/x/clip1.mp4"


# --- history.db on the work dir, snapshot in the library (T0.9) -------------------
#
# Two temp folders stand in for the fast local disk and for Google Drive.

HOUR = 3600.0
_SCHEMA = "CREATE TABLE history (id TEXT PRIMARY KEY, url TEXT, status TEXT, created_at TEXT, result_clips TEXT, metadata TEXT)"


def _forget_process_state():
    """What a killed process leaves behind: nothing pending is written, nothing is remembered."""
    for snap in list(db._snapshots.values()):
        if snap._timer is not None:
            snap._timer.cancel()
    db._snapshots.clear()


@pytest.fixture
def split(tmp_path, monkeypatch):
    work = tmp_path / "work"
    library = tmp_path / "library"
    monkeypatch.setenv("AUTO_CLIPPER_WORK_DIR", str(work))
    monkeypatch.setenv("AUTO_CLIPPER_WORKSPACE", str(library))
    # No snapshot is due again within a test unless the test says so.
    monkeypatch.setattr(db, "SNAPSHOT_MIN_INTERVAL", HOUR)
    yield work, library
    _forget_process_state()


def _statuses(db_file) -> dict:
    with closing(sqlite3.connect(str(db_file))) as conn:
        return dict(conn.execute("SELECT id, status FROM history"))


def _wait_for_due_snapshot():
    """Let the snapshot timer finish. Only for a timer that is due now."""
    snap = db._snapshot()
    timer = snap._timer
    if timer is not None:
        timer.join(10)
    with snap._io:  # a timer that already fired may still be writing
        pass


def _write_db(folder, rows):
    """A history.db written directly with SQLite, as every version before the work dir did."""
    folder.mkdir(parents=True, exist_ok=True)
    with closing(sqlite3.connect(str(folder / "history.db"))) as conn:
        conn.execute(_SCHEMA)
        for job_id, status in rows:
            conn.execute("INSERT INTO history VALUES (?, 'u', ?, '2026-01-01T00:00:00', '[]', '{}')", (job_id, status))
        conn.commit()


def test_without_a_work_dir_the_db_stays_in_the_library_and_no_snapshot_runs(monkeypatch, tmp_path):
    monkeypatch.delenv("AUTO_CLIPPER_WORK_DIR", raising=False)
    monkeypatch.setenv("AUTO_CLIPPER_WORKSPACE", str(tmp_path))

    assert db.get_db_path() == str(tmp_path / "history.db")
    assert db.get_snapshot_path() is None

    db.init_db()
    db.save_history("job-1", "u", "DONE", [], {})
    assert os.listdir(tmp_path) == ["history.db"]
    assert db._snapshots == {}


def test_with_a_work_dir_the_db_lives_there_and_the_snapshot_in_the_library(split):
    work, library = split
    assert db.get_db_path() == str(work / "history.db")
    assert db.get_snapshot_path() == str(library / "history.db")

    db.init_db()
    db.save_history("job-1", "u", "DONE", [], {})
    assert _statuses(work / "history.db") == {"job-1": "DONE"}


def test_work_dir_equal_to_the_library_has_no_snapshot(monkeypatch, tmp_path):
    monkeypatch.setenv("AUTO_CLIPPER_WORK_DIR", str(tmp_path))
    monkeypatch.setenv("AUTO_CLIPPER_WORKSPACE", str(tmp_path))
    db.init_db()
    db.save_history("job-1", "u", "DONE", [], {})
    assert os.listdir(tmp_path) == ["history.db"]
    assert db._snapshots == {}


def test_final_status_is_in_the_snapshot_when_save_history_returns(split):
    work, library = split
    db.init_db()
    db.save_history("job-1", "u", "PENDING", [], {})
    _wait_for_due_snapshot()
    assert _statuses(library / "history.db") == {"job-1": "PENDING"}

    # Inside the rate-limit window, yet a finished job must not wait for it.
    db.save_history("job-1", "u", "DONE", [{"path": "/x/clip.mp4"}], {})
    assert _statuses(library / "history.db") == {"job-1": "DONE"}

    db.save_history("job-2", "u", "ERROR", [], {"error": "boom"})
    assert _statuses(library / "history.db") == {"job-1": "DONE", "job-2": "ERROR"}


def test_changes_inside_the_window_are_held_back_then_written_once_by_a_trailing_snapshot(split, monkeypatch):
    work, library = split
    monkeypatch.setattr(db, "SNAPSHOT_MIN_INTERVAL", 1.0)
    writes = []
    real_write = db._Snapshot._write
    monkeypatch.setattr(db._Snapshot, "_write", lambda self: (writes.append(1), real_write(self))[1])

    db.init_db()
    db.save_history("job-1", "u", "PENDING", [], {})
    _wait_for_due_snapshot()
    assert _statuses(library / "history.db") == {"job-1": "PENDING"}
    assert len(writes) == 1

    for status in ("DOWNLOADING", "TRANSCRIBING", "ANALYZING"):
        db.save_history("job-1", "u", status, [], {})
    assert _statuses(library / "history.db") == {"job-1": "PENDING"}, "written again inside the window"
    assert len(writes) == 1

    # No further change arrives: the last state still reaches the snapshot.
    _wait_for_due_snapshot()
    assert _statuses(library / "history.db") == {"job-1": "ANALYZING"}
    assert len(writes) == 2


def test_snapshot_is_written_under_another_name_then_renamed(split, monkeypatch):
    work, library = split
    db.init_db()
    db.save_history("job-1", "u", "DONE", [], {})
    target = library / "history.db"
    seen = {}
    real_backup = db._backup

    def spy(src, dst):
        seen["dst"] = dst
        real_backup(src, dst)
        seen["snapshot_while_writing"] = _statuses(target)

    monkeypatch.setattr(db, "_backup", spy)
    db.save_history("job-2", "u", "DONE", [], {})

    assert seen["dst"] != str(target)
    assert os.path.dirname(seen["dst"]) == str(library)  # same folder, so the rename is atomic
    assert seen["snapshot_while_writing"] == {"job-1": "DONE"}  # still the complete old one
    assert _statuses(target) == {"job-1": "DONE", "job-2": "DONE"}
    assert os.listdir(library) == ["history.db"]


def test_snapshot_failure_is_logged_keeps_the_old_snapshot_and_does_not_fail_the_save(split, monkeypatch):
    work, library = split
    db.init_db()
    db.save_history("job-1", "u", "PENDING", [], {})
    _wait_for_due_snapshot()
    logged = []
    monkeypatch.setattr(db, "log_error", lambda context, err=None, **k: logged.append((context, err)))
    real_backup = db._backup

    def drive_gone(src, dst):
        with open(dst, "wb") as f:
            f.write(b"half a database")
        raise OSError(107, "Transport endpoint is not connected")

    monkeypatch.setattr(db, "_backup", drive_gone)
    db.save_history("job-1", "u", "DONE", [], {})  # must not raise

    assert db.get_history("job-1")["status"] == "DONE"
    assert [context for context, _ in logged] == ["db.snapshot"]
    assert isinstance(logged[0][1], OSError)
    assert _statuses(library / "history.db") == {"job-1": "PENDING"}
    assert os.listdir(library) == ["history.db"]

    # Drive is back: the state that failed to be written is not forgotten.
    monkeypatch.setattr(db, "_backup", real_backup)
    assert db.flush_snapshot() is True
    assert _statuses(library / "history.db") == {"job-1": "DONE"}


def test_history_stays_readable_and_writable_while_the_library_is_unreachable(split, monkeypatch):
    work, library = split
    db.init_db()
    db.save_history("job-1", "u", "DONE", [], {})
    logged = []
    monkeypatch.setattr(db, "log_error", lambda context, err=None, **k: logged.append(context))
    real_makedirs = os.makedirs

    def drive_hangs(path, *a, **k):
        if os.path.abspath(path).startswith(str(library)):
            raise OSError(107, "Transport endpoint is not connected")
        return real_makedirs(path, *a, **k)

    monkeypatch.setattr(os, "makedirs", drive_hangs)

    assert [r["id"] for r in db.get_all_history()] == ["job-1"]
    assert logged == [], "reading history touched the library"
    db.save_history("job-2", "u", "DONE", [], {})  # must not raise
    assert db.get_history("job-2")["status"] == "DONE"
    assert logged == ["db.snapshot"]


def test_failed_snapshot_is_retried_without_another_change(split, monkeypatch):
    work, library = split
    monkeypatch.setattr(db, "SNAPSHOT_RETRY_DELAYS", (0.05,))
    monkeypatch.setattr(db, "log_error", lambda *a, **k: None)
    db.init_db()
    real_backup = db._backup
    calls = []

    def fails_once(src, dst):
        calls.append(dst)
        if len(calls) == 1:
            raise OSError(5, "Input/output error")
        real_backup(src, dst)

    monkeypatch.setattr(db, "_backup", fails_once)
    db.save_history("job-1", "u", "DONE", [], {})
    assert not (library / "history.db").exists()

    _wait_for_due_snapshot()
    assert _statuses(library / "history.db") == {"job-1": "DONE"}


def test_deleting_a_job_reaches_the_snapshot(split):
    work, library = split
    db.init_db()
    db.save_history("job-1", "u", "DONE", [], {})
    db.save_history("job-2", "u", "DONE", [], {})

    db.delete_history("job-1")
    assert db.flush_snapshot() is True
    assert _statuses(library / "history.db") == {"job-2": "DONE"}


def test_missing_local_db_is_restored_from_the_snapshot_before_first_use(split):
    work, library = split
    db.init_db()
    db.save_history("job-1", "https://youtu.be/x", "DONE", [{"path": "/lib/clip.mp4"}], {"title": "Ep 1"})
    _forget_process_state()
    shutil.rmtree(work)

    # No init_db: whatever touches the database first gets the restored one.
    row = db.get_history("job-1")
    assert row["status"] == "DONE"
    assert row["result_clips"] == [{"path": "/lib/clip.mp4"}]
    assert row["metadata"] == {"title": "Ep 1"}
    assert os.listdir(work) == ["history.db"]


def test_library_db_from_before_the_work_dir_is_picked_up_on_the_first_run(split):
    work, library = split
    _write_db(library, [("old-1", "DONE"), ("old-2", "ERROR")])

    db.init_db()
    assert {r["id"] for r in db.get_all_history()} == {"old-1", "old-2"}

    # The same file goes on being the library copy: no second database appears there.
    db.save_history("new-1", "u", "DONE", [], {})
    assert _statuses(library / "history.db") == {"old-1": "DONE", "old-2": "ERROR", "new-1": "DONE"}
    assert os.listdir(library) == ["history.db"]


def test_server_restart_in_the_same_session_keeps_the_local_db(split):
    work, library = split
    db.init_db()
    db.save_history("job-1", "u", "PENDING", [], {})
    _wait_for_due_snapshot()
    db.save_history("job-1", "u", "CROPPING", [{"path": "/lib/clip_1.mp4"}], {"highlights": [1, 2]})
    _forget_process_state()  # killed before the trailing snapshot
    assert _statuses(library / "history.db") == {"job-1": "PENDING"}

    db.init_db()
    row = db.get_history("job-1")
    assert row["result_clips"] == [{"path": "/lib/clip_1.mp4"}], "the older snapshot replaced the local database"
    assert row["metadata"]["highlights"] == [1, 2]
    assert row["status"] == "ERROR"  # interrupted, so offered for resume

    assert db.flush_snapshot() is True
    assert _statuses(library / "history.db") == {"job-1": "ERROR"}


def test_snapshot_that_failed_before_a_restart_is_written_after_it(split, monkeypatch):
    work, library = split
    monkeypatch.setattr(db, "log_error", lambda *a, **k: None)
    real_backup = db._backup

    def drive_gone(src, dst):
        raise OSError(107, "Transport endpoint is not connected")

    db.init_db()
    monkeypatch.setattr(db, "_backup", drive_gone)
    db.save_history("job-1", "u", "DONE", [], {})
    _forget_process_state()
    assert not (library / "history.db").exists()

    # Nothing changes after the restart, yet the library must not stay behind.
    monkeypatch.setattr(db, "_backup", real_backup)
    db.init_db()
    _wait_for_due_snapshot()
    assert _statuses(library / "history.db") == {"job-1": "DONE"}


def test_jobs_only_the_library_knows_are_adopted_instead_of_overwritten(split):
    """A local database created while Drive was unreachable must not replace the Drive history."""
    work, library = split
    _write_db(work, [("both", "DONE"), ("local-only", "DONE")])
    _write_db(library, [("both", "ERROR"), ("library-only", "DONE")])

    db.init_db()
    merged = {"both": "DONE", "local-only": "DONE", "library-only": "DONE"}  # the local row wins
    assert {r["id"]: r["status"] for r in db.get_all_history()} == merged
    assert db.flush_snapshot() is True
    assert _statuses(library / "history.db") == merged


def test_library_db_that_could_not_be_read_at_startup_is_merged_before_it_is_overwritten(split, monkeypatch):
    work, library = split
    _write_db(library, [("old-1", "DONE")])
    monkeypatch.setattr(db, "log_error", lambda *a, **k: None)
    real_backup = db._backup

    def unreadable(src, dst):
        raise OSError(5, "Input/output error")

    monkeypatch.setattr(db, "_backup", unreadable)
    db.init_db()  # must not raise
    db.save_history("new-1", "u", "DONE", [], {})
    assert _statuses(library / "history.db") == {"old-1": "DONE"}, "history on Drive was overwritten unseen"

    monkeypatch.setattr(db, "_backup", real_backup)
    assert db.flush_snapshot() is True
    assert {r["id"] for r in db.get_all_history()} == {"old-1", "new-1"}
    assert _statuses(library / "history.db") == {"old-1": "DONE", "new-1": "DONE"}


def test_library_db_that_appears_after_startup_is_merged_before_it_is_overwritten(split):
    work, library = split
    db.init_db()  # Drive not mounted yet: the library has no database
    _write_db(library, [("old-1", "DONE")])

    db.save_history("new-1", "u", "DONE", [], {})
    assert {r["id"] for r in db.get_all_history()} == {"old-1", "new-1"}
    assert _statuses(library / "history.db") == {"old-1": "DONE", "new-1": "DONE"}


def test_pending_snapshot_is_written_when_the_process_exits_normally(split):
    work, library = split
    script = (
        "import backend.db as db\n"
        "db.SNAPSHOT_MIN_INTERVAL = 3600.0\n"
        "db.init_db()\n"
        "db.save_history('job-1', 'u', 'PENDING', [], {})\n"
        "assert db.flush_snapshot()\n"
        "db.save_history('job-1', 'u', 'TRANSCRIBING', [], {})\n"  # held back by the rate limit
    )
    repo_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    done = subprocess.run([sys.executable, "-c", script], cwd=repo_root, capture_output=True, text=True, timeout=60)

    assert done.returncode == 0, done.stderr
    assert done.stdout == ""  # the sidecar handshake owns stdout
    assert _statuses(library / "history.db") == {"job-1": "TRANSCRIBING"}


def test_library_file_that_is_not_a_database_is_set_aside_not_deleted(split, monkeypatch):
    work, library = split
    library.mkdir()
    (library / "history.db").write_bytes(b"this is not a database " * 200)
    logged = []
    monkeypatch.setattr(db, "log_error", lambda context, err=None, **k: logged.append(context))

    db.init_db()  # must not raise
    assert db.get_all_history() == []
    assert logged == ["db.snapshot_unreadable"]

    db.save_history("job-1", "u", "DONE", [], {})
    assert _statuses(library / "history.db") == {"job-1": "DONE"}
    kept = [name for name in os.listdir(library) if name != "history.db"]
    assert len(kept) == 1 and kept[0].startswith("history.db.unreadable-")
    assert (library / kept[0]).read_bytes().startswith(b"this is not a database")


def test_runtime_dies_mid_job_then_history_is_restored_and_the_job_resumes(split, monkeypatch):
    work, library = split
    clip = library / "projects" / "Ep 1" / "clips" / "clip_1.mp4"
    highlights = [{"start_time": "00:00:10", "end_time": "00:00:40", "description": "a"},
                  {"start_time": "00:01:00", "end_time": "00:01:30", "description": "b"}]
    metadata = {
        "title": "Ep 1", "mode": "ai", "provider": "gemini", "whisper_model": "small",
        "source_video": str(work / "projects" / "Ep 1" / "source.mp4"),
        "subtitle_path": str(library / "projects" / "Ep 1" / "subtitles" / "subtitles.words.json"),
        "highlights": highlights,
    }

    # First process: the job gets as far as its first rendered clip.
    db.init_db()
    db.save_history("job-1", "https://youtu.be/x", "PENDING", [], {"title": "Ep 1"})
    _wait_for_due_snapshot()
    monkeypatch.setattr(db, "SNAPSHOT_MIN_INTERVAL", 0.0)  # the stages of a real job are minutes apart
    db.save_history("job-1", "https://youtu.be/x", "TRANSCRIBING", [], dict(metadata, highlights=[]))
    _wait_for_due_snapshot()
    db.save_history("job-1", "https://youtu.be/x", "CROPPING", [{"path": str(clip)}], metadata)
    _wait_for_due_snapshot()

    # The runtime dies: no shutdown code runs and the local disk is gone. Drive survives.
    _forget_process_state()
    shutil.rmtree(work)
    assert os.listdir(library) == ["history.db"]

    # New runtime, new process.
    db.init_db()
    row = db.get_history("job-1")
    assert row is not None, "history was not restored from the snapshot"
    assert row["status"] == "ERROR"  # an interrupted job is offered for resume
    assert "resume" in row["metadata"]["error"]
    assert row["result_clips"] == [{"path": str(clip)}]
    assert row["metadata"]["highlights"] == highlights

    # Resume starts from the stored state: transcript, highlights and the clip already rendered.
    submitted = []
    monkeypatch.setattr(jobs.job_queue, "submit", lambda job_id, target, args=(), on_wait=None: submitted.append(args[1].__name__))
    new_id = jobs.create_resume_job("job-1")
    job = jobs.active_jobs[new_id]
    assert submitted == ["_run_resume_job"]
    assert job["resumed_from"] == "job-1"
    assert job["url"] == "https://youtu.be/x"
    assert job["clips"] == [{"path": str(clip)}]
    assert job["metadata"]["highlights"] == highlights
    assert job["metadata"]["subtitle_path"] == metadata["subtitle_path"]
    assert db.get_history(new_id)["status"] == "QUEUED"



