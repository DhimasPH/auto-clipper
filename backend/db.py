import atexit
import sqlite3
import os
import json
import threading
import time
from contextlib import closing
from datetime import datetime
import sys
from typing import Optional
from backend.logger import log_app, log_error
from backend.workspace import SECRET_KEYS, get_work_dir

DB_NAME = "history.db"
SNAPSHOT_MIN_INTERVAL = 5.0  # seconds between two snapshot writes
SNAPSHOT_RETRY_DELAYS = (5.0, 30.0, 120.0)  # after a failed write; then the next change tries again

_COLUMNS = ("id", "url", "status", "created_at", "result_clips", "metadata")
_IN_PROGRESS = ("DOWNLOADING", "TRANSCRIBING", "ANALYZING", "CROPPING", "QUEUED", "PENDING")

def _app_data_path() -> str:
    custom_ws = os.environ.get("AUTO_CLIPPER_WORKSPACE", "").strip()
    if custom_ws:
        return os.path.abspath(os.path.expanduser(custom_ws))

    home = os.path.expanduser("~")
    if sys.platform == "win32":
        base = os.environ.get("APPDATA", os.path.join(home, "AppData", "Roaming"))
    elif sys.platform == "darwin":
        base = os.path.join(home, "Library", "Application Support")
    else:
        base = os.environ.get("XDG_DATA_HOME", os.path.join(home, ".local", "share"))

    return os.path.join(base, "AutoClipper")


def get_app_data_dir() -> str:
    app_dir = _app_data_path()
    os.makedirs(app_dir, exist_ok=True)
    return app_dir



def get_db_path():
    """Where history.db is opened: the work dir when one is set, else the app data dir.

    The app data dir can be a network mount (Google Drive on Colab), where
    SQLite is slow and a dropped connection can corrupt the file.
    """
    return os.path.join(get_work_dir() or get_app_data_dir(), DB_NAME)


def get_snapshot_path() -> Optional[str]:
    """The library copy of a history.db that lives in the work dir, else None.

    It is the path the database has without a work dir. So a database from
    before the work dir existed is picked up as the first snapshot, and a run
    without a work dir opens the latest snapshot.
    """
    # Only the path: every database call asks for it, and none of them may
    # depend on the library being reachable.
    return os.path.join(_app_data_path(), DB_NAME) if get_work_dir() else None


# --- snapshot of a work-dir database in the library ---------------------------

def _temp_name(path: str) -> str:
    # Same folder as the target so the rename stays on one disk.
    folder, name = os.path.split(path)
    return os.path.join(folder, f".{name}.part")


def _discard(path: str) -> None:
    for leftover in (path, path + "-journal"):
        try:
            os.remove(leftover)
        except OSError:
            pass


def _backup(src: str, dst: str) -> None:
    """Copy a database with SQLite's online backup API: consistent even while ``src`` is being written."""
    if not os.path.isfile(src):  # connect() would create an empty database and copy that
        raise FileNotFoundError(src)
    with closing(sqlite3.connect(src, timeout=30.0)) as source, closing(sqlite3.connect(dst, timeout=30.0)) as target:
        source.backup(target)


def _adopt_missing_jobs(local: str, other: str) -> None:
    """Add to ``local`` the jobs only ``other`` has. A job both have keeps its local row."""
    with closing(sqlite3.connect(local, timeout=30.0)) as conn:
        _create_schema(conn)
        conn.execute("ATTACH DATABASE ? AS other", (other,))
        theirs = [col[1] for col in conn.execute("PRAGMA other.table_info(history)")]
        if "id" in theirs:
            columns = ", ".join(c for c in _COLUMNS if c in theirs)
            conn.execute(f"INSERT OR IGNORE INTO main.history ({columns}) SELECT {columns} FROM other.history")
        conn.commit()


# --- API keys are never kept in history (T0.18) ---------------------------------
#
# The database is copied to the library, which on Colab is Google Drive.

def _without_secrets(metadata):
    """The metadata as it may be stored: without API keys. The caller's dict is not changed."""
    if isinstance(metadata, dict) and any(key in metadata for key in SECRET_KEYS):
        return {k: v for k, v in metadata.items() if k not in SECRET_KEYS}
    return metadata


def _remove_secrets(conn: sqlite3.Connection) -> int:
    """Remove the API keys that older versions stored in job metadata. Returns the number of jobs changed.

    Cheap when there is nothing to remove: one text match over the metadata
    column. After a change the file is rebuilt (VACUUM), so the old text does
    not stay behind in free pages that the snapshot backup would copy along.
    """
    if "metadata" not in [col[1] for col in conn.execute("PRAGMA table_info(history)")]:
        return 0
    matches = " OR ".join("metadata LIKE ?" for _ in SECRET_KEYS)
    rows = conn.execute(f"SELECT id, metadata FROM history WHERE {matches}", [f'%"{key}"%' for key in SECRET_KEYS]).fetchall()
    changed = 0
    for job_id, meta_json in rows:
        try:
            meta = json.loads(meta_json)
        except ValueError:
            continue
        clean = _without_secrets(meta)
        if clean is not meta:
            conn.execute("UPDATE history SET metadata=? WHERE id=?", (json.dumps(clean), job_id))
            changed += 1
    conn.commit()
    if changed:
        conn.execute("VACUUM")
        log_app(f"Removed stored API keys from {changed} job(s) in the history.")
    return changed


def _remove_secrets_from(path: str) -> int:
    with closing(sqlite3.connect(path, timeout=30.0)) as conn:
        return _remove_secrets(conn)


class _Snapshot:
    """Keeps the library copy of one work-dir database up to date.

    A change is written by a timer thread, at most once per
    SNAPSHOT_MIN_INTERVAL; changes inside that window share one trailing write.
    A final job status does not wait: it is written before save_history returns,
    because the runtime is often closed right after a job ends.

    The library copy is never replaced before it has been read once (restored,
    or its jobs added to the local database), so no job on it is lost.
    """

    def __init__(self, local: str, target: str):
        self.local = local
        self.target = target
        self._io = threading.Lock()  # one restore or write at a time
        self._state = threading.Lock()  # guards the fields below
        self._dirty = False
        self._timer = None
        self._last_write = float("-inf")  # monotonic time of the last attempt
        self._failures = 0
        self._prepared = False
        self._synced = False

    def prepare(self) -> None:
        """Bring in what the library has, once, before the database is first opened. Never raises."""
        if self._prepared:
            return
        with self._io:
            if self._prepared:
                return
            self._prepared = True
            had_local = os.path.isfile(self.local)
            try:
                had_secrets = self._sync()
            except Exception as e:
                log_error("db.restore", e)  # tried again before the first snapshot write
                return
        # After a server restart the local database may be ahead of the
        # snapshot; a snapshot that held API keys must be replaced by a clean one.
        if had_local or had_secrets:
            self.changed()

    def _sync(self) -> bool:
        """Restore a missing local database from the library copy, else add the jobs only that copy has.

        An existing local database wins: it has every write of this runtime,
        while the snapshot can only lag behind it. API keys in the library copy
        are removed before anything is taken from it. True when it had some.
        """
        if not os.path.isfile(self.target):
            return False  # nothing there yet (Drive may be mounted later): looked at again before the first write
        incoming = _temp_name(self.local)
        _discard(incoming)
        had_secrets = False
        try:
            if self._fetch(incoming):
                had_secrets = _remove_secrets_from(incoming) > 0
                if os.path.isfile(self.local):
                    _adopt_missing_jobs(self.local, incoming)
                else:
                    os.replace(incoming, self.local)
        finally:
            _discard(incoming)
        self._synced = True
        return had_secrets

    def _fetch(self, incoming: str) -> bool:
        """Copy the library database to the local disk. False when that file is not a database."""
        try:
            _backup(self.target, incoming)
            return True
        except sqlite3.DatabaseError as e:
            if isinstance(e, sqlite3.OperationalError):
                raise  # locked or an I/O error: the file may be fine, so try again later
            kept = f"{self.target}.unreadable-{datetime.now():%Y%m%d-%H%M%S}"
            os.replace(self.target, kept)
            log_error("db.snapshot_unreadable", f"{self.target} is not a SQLite database ({e}). Kept as {kept}.", exc_info=False)
            return False

    def changed(self, final: bool = False) -> None:
        with self._state:
            self._dirty = True
            if not final:
                self._schedule(max(0.0, self._last_write + SNAPSHOT_MIN_INTERVAL - time.monotonic()))
                return
        self.flush()

    def _schedule(self, delay: float) -> None:
        if self._timer is None:
            timer = threading.Timer(delay, self.flush)
            timer.daemon = True
            timer.start()
            self._timer = timer  # only once it runs: a timer that never started would block every later one

    def flush(self) -> bool:
        """Write the snapshot now if anything changed since the last one. Never raises."""
        with self._io:
            with self._state:
                if self._timer is not None:
                    self._timer.cancel()
                    self._timer = None
                if not self._dirty:
                    return True
                self._dirty = False
                self._last_write = time.monotonic()
            try:
                if not self._synced:
                    self._sync()
                self._write()
                self._synced = True  # from here on the library copy is this process's own
            except Exception as e:
                log_error("db.snapshot", e)
                with self._state:
                    self._dirty = True
                    if self._failures < len(SNAPSHOT_RETRY_DELAYS):
                        self._schedule(SNAPSHOT_RETRY_DELAYS[self._failures])
                    self._failures += 1
                return False
            with self._state:
                self._failures = 0
            return True

    def _write(self) -> None:
        # Under another name, then renamed: a reader of the library sees the
        # previous snapshot or the complete new one.
        tmp = _temp_name(self.target)
        os.makedirs(os.path.dirname(tmp), exist_ok=True)
        _discard(tmp)
        try:
            _backup(self.local, tmp)
            os.replace(tmp, self.target)
        finally:
            _discard(tmp)


_snapshots = {}
_snapshots_lock = threading.Lock()


def _snapshot() -> Optional[_Snapshot]:
    """The snapshot of the current database, or None when it already lives in the library."""
    target = get_snapshot_path()
    if not target:
        return None
    local = get_db_path()
    if os.path.normcase(os.path.abspath(local)) == os.path.normcase(os.path.abspath(target)):
        return None
    with _snapshots_lock:
        key = (local, target)
        if key not in _snapshots:
            _snapshots[key] = _Snapshot(local, target)
        return _snapshots[key]


def _changed(final: bool = False) -> None:
    """History was committed: get it into the snapshot. A snapshot problem never fails the caller."""
    try:
        snap = _snapshot()
        if snap:
            snap.changed(final)
    except Exception as e:
        log_error("db.snapshot", e)


def flush_snapshot() -> bool:
    """Write a pending snapshot now. True when the library copy is up to date."""
    snap = _snapshot()
    return snap.flush() if snap else True


@atexit.register
def _flush_snapshots_at_exit() -> None:
    for snap in list(_snapshots.values()):
        snap.flush()


def _connect() -> sqlite3.Connection:
    snap = _snapshot()
    if snap:
        snap.prepare()
    return sqlite3.connect(get_db_path(), timeout=30.0)


def _create_schema(conn: sqlite3.Connection) -> None:
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS history (
            id TEXT PRIMARY KEY,
            url TEXT,
            status TEXT,
            created_at TEXT,
            result_clips TEXT,
            metadata TEXT
        )
    """)
    # Check if metadata column exists (migration)
    cursor.execute("PRAGMA table_info(history)")
    columns = [col[1] for col in cursor.fetchall()]
    if "metadata" not in columns:
        cursor.execute("ALTER TABLE history ADD COLUMN metadata TEXT")


def init_db():
    conn = _connect()
    _create_schema(conn)
    conn.commit()
    try:
        had_secrets = _remove_secrets(conn) > 0
    except Exception as e:
        log_error("db.remove_secrets", e)  # tried again at the next start; the app still starts
        had_secrets = False
    finally:
        conn.close()
    if had_secrets:
        _changed(final=True)  # do not leave the keys in the library copy until the next job

    fix_stuck_jobs()

def fix_stuck_jobs():
    """Convert any in-progress jobs to ERROR so the user can resume them if the backend crashed."""
    conn = _connect()
    cursor = conn.cursor()

    placeholders = ",".join(["?"] * len(_IN_PROGRESS))
    cursor.execute(f"SELECT id, metadata FROM history WHERE status IN ({placeholders})", _IN_PROGRESS)
    rows = cursor.fetchall()
    for row in rows:
        job_id, meta_str = row[0], row[1]
        try:
            meta = json.loads(meta_str) if meta_str else {}
        except Exception:
            meta = {}
        if not meta.get("error"):
            meta["error"] = "Proses terhenti karena backend Google Colab ter-restart (misal: OOM / restart session). Anda dapat melanjutkan (resume) proses ini."
        cursor.execute("UPDATE history SET status='ERROR', metadata=? WHERE id=?", (json.dumps(meta), job_id))
    if rows:
        log_error("fix_stuck_jobs", f"Fixed {len(rows)} stuck jobs to ERROR state.")
    conn.commit()
    conn.close()
    if rows:
        _changed()

def save_history(job_id: str, url: str, status: str, clips: list, metadata: dict = None):
    conn = _connect()
    cursor = conn.cursor()
    created_at = datetime.now().isoformat()
    clips_json = json.dumps(clips) if clips is not None else "[]"
    meta_json = json.dumps(_without_secrets(metadata)) if metadata is not None else None
    
    cursor.execute("SELECT id, result_clips, metadata FROM history WHERE id=?", (job_id,))
    existing = cursor.fetchone()
    if existing:
        ex_clips, ex_meta = existing[1], existing[2]
        # Preserve existing metadata if current call passed None
        if meta_json is None and ex_meta is not None:
            meta_json = ex_meta
        # Preserve existing clips if current call passed empty list and existing had clips
        if (not clips) and ex_clips:
            clips_json = ex_clips

        cursor.execute("""
            UPDATE history 
            SET status=?, result_clips=?, metadata=?
            WHERE id=?
        """, (status, clips_json, meta_json, job_id))
    else:
        cursor.execute("""
            INSERT INTO history (id, url, status, created_at, result_clips, metadata)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (job_id, url, status, created_at, clips_json, meta_json))

    conn.commit()
    conn.close()
    # A finished job is written to the snapshot at once; a stage change may wait its turn.
    _changed(final=status not in _IN_PROGRESS)

def get_all_history():
    conn = _connect()
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM history ORDER BY created_at DESC")
    rows = cursor.fetchall()
    conn.close()
    
    history = []
    for row in rows:
        history.append({
            "id": row["id"],
            "url": row["url"],
            "status": row["status"],
            "created_at": row["created_at"],
            "result_clips": json.loads(row["result_clips"]) if row["result_clips"] else [],
            "metadata": json.loads(row["metadata"]) if row["metadata"] else {}
        })
    return history

def get_history(job_id: str) -> dict:
    conn = _connect()
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM history WHERE id=?", (job_id,))
    row = cursor.fetchone()
    conn.close()
    if not row:
        return None
    return {
        "id": row["id"],
        "url": row["url"],
        "status": row["status"],
        "created_at": row["created_at"],
        "result_clips": json.loads(row["result_clips"]) if row["result_clips"] else [],
        "metadata": json.loads(row["metadata"]) if row["metadata"] else {}
    }

def safe_remove_file(file_path: str, retries: int = 4, delay: float = 0.15) -> bool:
    """Safely remove a file with garbage collection and retry backoff on Windows."""
    if not file_path or not os.path.exists(file_path):
        return True

    import gc
    import time

    for attempt in range(retries):
        try:
            gc.collect()
            os.remove(file_path)
            return True
        except PermissionError as e:
            if attempt < retries - 1:
                time.sleep(delay * (attempt + 1))
            else:
                log_error("db.safe_remove_file", f"PermissionError deleting file {file_path} after {retries} retries: {e}")
                return False
        except Exception as e:
            log_error("db.safe_remove_file", f"Failed to delete file {file_path}: {e}")
            return False
    return False


def safe_remove_dir(dir_path: str, retries: int = 3, delay: float = 0.15) -> bool:
    """Safely remove an entire directory if empty or unused."""
    if not dir_path or not os.path.isdir(dir_path):
        return True
    import gc
    import time
    import shutil

    for attempt in range(retries):
        try:
            gc.collect()
            shutil.rmtree(dir_path, ignore_errors=False)
            return True
        except Exception:
            if attempt < retries - 1:
                time.sleep(delay * (attempt + 1))
            else:
                try:
                    shutil.rmtree(dir_path, ignore_errors=True)
                except Exception:
                    pass
                return False
    return False


def delete_history(job_id: str):
    conn = _connect()
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT result_clips, metadata FROM history WHERE id=?", (job_id,))
    row = cursor.fetchone()
    if row:
        # 1. Hapus file clips spesifik job ini
        if row["result_clips"]:
            try:
                clips = json.loads(row["result_clips"])
                for c in clips:
                    if "path" in c and c["path"]:
                        safe_remove_file(c["path"])
            except Exception as e:
                log_error("db.delete_history", f"Failed to parse result_clips: {e}")

        # 2. Cek apakah file source & subtitle masih digunakan job lain
        if row["metadata"]:
            try:
                meta = json.loads(row["metadata"])
                target_source = meta.get("source_video")
                target_sub = meta.get("subtitle_path")

                cursor.execute("SELECT id, metadata FROM history WHERE id != ?", (job_id,))
                other_rows = cursor.fetchall()

                source_in_use = False
                sub_in_use = False

                for o_row in other_rows:
                    if o_row["metadata"]:
                        try:
                            o_meta = json.loads(o_row["metadata"])
                            if target_source and o_meta.get("source_video") == target_source:
                                source_in_use = True
                            if target_sub and o_meta.get("subtitle_path") == target_sub:
                                sub_in_use = True
                        except Exception:
                            pass

                # Hanya hapus source_video fisik jika TIDAK ada job lain yang memakainya
                if not source_in_use and target_source:
                    safe_remove_file(target_source)

                # Hanya hapus subtitle fisik jika TIDAK ada job lain yang memakainya
                if not sub_in_use and target_sub:
                    safe_remove_file(target_sub)
            except Exception as e:
                log_error("db.delete_history", f"Failed to parse metadata: {e}")

        # 3. Bersihkan direktori project workspace jika tidak dipakai job lain
        try:
            from backend.jobs import get_project_workspace
            meta_dict = json.loads(row["metadata"]) if row["metadata"] else {}
            ws = get_project_workspace(meta_dict.get("title", ""), meta_dict.get("output_dir", ""), job_id)
            project_ws = ws.get("project_dir")

            if project_ws and os.path.isdir(project_ws):
                cursor.execute("SELECT id, metadata FROM history WHERE id != ?", (job_id,))
                all_other_rows = cursor.fetchall()
                ws_in_use = False
                for o_row in all_other_rows:
                    if o_row["metadata"]:
                        try:
                            o_meta = json.loads(o_row["metadata"])
                            o_ws = get_project_workspace(o_meta.get("title", ""), o_meta.get("output_dir", ""), o_row["id"])
                            if o_ws.get("project_dir") == project_ws:
                                ws_in_use = True
                                break
                        except Exception:
                            pass
                
                if not ws_in_use:
                    safe_remove_dir(project_ws)
                    # With a work dir the published copy is a second folder.
                    library_ws = ws.get("library_dir")
                    if library_ws and library_ws != project_ws:
                        safe_remove_dir(library_ws)
        except Exception as e:
            log_error("db.delete_history", f"Failed to clean project workspace: {e}")

    cursor.execute("DELETE FROM history WHERE id=?", (job_id,))
    conn.commit()
    conn.close()
    _changed()

