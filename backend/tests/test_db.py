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

