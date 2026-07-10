import sqlite3
import os
import json
from datetime import datetime

def get_db_path():
    return os.path.join(os.getcwd(), "history.db")

def init_db():
    conn = sqlite3.connect(get_db_path())
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS history (
            id TEXT PRIMARY KEY,
            url TEXT,
            status TEXT,
            created_at TEXT,
            result_clips TEXT
        )
    """)
    conn.commit()
    conn.close()

def save_history(job_id: str, url: str, status: str, clips: list):
    conn = sqlite3.connect(get_db_path())
    cursor = conn.cursor()
    created_at = datetime.now().isoformat()
    clips_json = json.dumps(clips)
    
    cursor.execute("SELECT id FROM history WHERE id=?", (job_id,))
    if cursor.fetchone():
        cursor.execute("""
            UPDATE history 
            SET status=?, result_clips=?
            WHERE id=?
        """, (status, clips_json, job_id))
    else:
        cursor.execute("""
            INSERT INTO history (id, url, status, created_at, result_clips)
            VALUES (?, ?, ?, ?, ?)
        """, (job_id, url, status, created_at, clips_json))
        
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
            "result_clips": json.loads(row["result_clips"]) if row["result_clips"] else []
        })
    return history

def delete_history(job_id: str):
    conn = sqlite3.connect(get_db_path())
    cursor = conn.cursor()
    cursor.execute("DELETE FROM history WHERE id=?", (job_id,))
    conn.commit()
    conn.close()
