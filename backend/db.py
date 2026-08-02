import sqlite3
import os
import json
from datetime import datetime
import sys
from backend.logger import log_error

def get_app_data_dir():
    home = os.path.expanduser("~")
    if sys.platform == "win32":
        base = os.environ.get("APPDATA", os.path.join(home, "AppData", "Roaming"))
    elif sys.platform == "darwin":
        base = os.path.join(home, "Library", "Application Support")
    else:
        base = os.environ.get("XDG_DATA_HOME", os.path.join(home, ".local", "share"))
    
    app_dir = os.path.join(base, "AutoClipper")
    os.makedirs(app_dir, exist_ok=True)
    return app_dir

def get_db_path():
    return os.path.join(get_app_data_dir(), "history.db")

def init_db():
    conn = sqlite3.connect(get_db_path())
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
    conn.commit()
    conn.close()

def save_history(job_id: str, url: str, status: str, clips: list, metadata: dict = None):
    conn = sqlite3.connect(get_db_path())
    cursor = conn.cursor()
    created_at = datetime.now().isoformat()
    clips_json = json.dumps(clips)
    meta_json = json.dumps(metadata) if metadata else None
    
    cursor.execute("SELECT id FROM history WHERE id=?", (job_id,))
    if cursor.fetchone():
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

def get_all_history():
    conn = sqlite3.connect(get_db_path())
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
    conn = sqlite3.connect(get_db_path())
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

def delete_history(job_id: str):
    conn = sqlite3.connect(get_db_path())
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
                    if "path" in c and os.path.exists(c["path"]):
                        try:
                            os.remove(c["path"])
                        except Exception as e:
                            log_error("db.delete_history", f"Failed to delete clip file {c.get('path')}: {e}")
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
                if not source_in_use and target_source and os.path.exists(target_source):
                    try:
                        os.remove(target_source)
                    except Exception as e:
                        log_error("db.delete_history", f"Failed to delete source video {target_source}: {e}")

                # Hanya hapus subtitle fisik jika TIDAK ada job lain yang memakainya
                if not sub_in_use and target_sub and os.path.exists(target_sub):
                    try:
                        os.remove(target_sub)
                    except Exception as e:
                        log_error("db.delete_history", f"Failed to delete subtitle file {target_sub}: {e}")
            except Exception as e:
                log_error("db.delete_history", f"Failed to parse metadata: {e}")

    cursor.execute("DELETE FROM history WHERE id=?", (job_id,))
    conn.commit()
    conn.close()
