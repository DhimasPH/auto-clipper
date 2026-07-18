from backend.metadata import parse_silence
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)


SAMPLE_STDERR = """
Input #0, mov, from 'x.mp4':
[silencedetect @ 0x1] silence_start: 1.234
[silencedetect @ 0x1] silence_end: 3.456 | silence_duration: 2.222
[silencedetect @ 0x1] silence_start: 10.0
[silencedetect @ 0x1] silence_end: 12.5 | silence_duration: 2.5
frame= 100 fps=50
"""


def test_parse_silence_pairs():
    segs = parse_silence(SAMPLE_STDERR)
    assert segs == [
        {"start": 1.234, "end": 3.456},
        {"start": 10.0, "end": 12.5},
    ]


def test_parse_silence_drops_dangling_start():
    text = (
        "[silencedetect @ 0x1] silence_start: 5.0\n"
        "[silencedetect @ 0x1] silence_end: 7.0 | silence_duration: 2.0\n"
        "[silencedetect @ 0x1] silence_start: 20.0\n"  # no matching end
    )
    segs = parse_silence(text)
    assert segs == [{"start": 5.0, "end": 7.0}]


def test_parse_silence_empty():
    assert parse_silence("no markers here") == []


def test_extract_metadata_missing_file_returns_400():
    r = client.post("/api/extract-metadata", json={"path": "/nope/none.mp4", "type": ["silence"]})
    assert r.status_code == 400


def test_get_metadata_unknown_job_returns_404():
    r = client.get("/api/metadata/does-not-exist")
    assert r.status_code == 404


def test_manual_job_rejects_empty_clips():
    r = client.post("/jobs/manual", json={"url": "local:/tmp/x.mp4", "clips": []})
    assert r.status_code == 400


def test_manual_job_rejects_invalid_url():
    r = client.post("/jobs/manual", json={"url": "ftp://bad", "clips": [{"start": 0, "end": 1}]})
    assert r.status_code == 400


def test_thumbnails_endpoint_missing_file():
    r = client.get("/api/thumbnails", params={"path": "/nope/x.mp4", "start": 0, "end": 3, "count": 6})
    assert r.status_code == 400


def test_thumbnails_endpoint_invalid_range(tmp_path):
    f = tmp_path / "v.mp4"
    f.write_bytes(b"x")
    r = client.get("/api/thumbnails", params={"path": str(f), "start": 5, "end": 5, "count": 6})
    assert r.status_code == 400
