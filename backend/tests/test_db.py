import backend.db as db


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
