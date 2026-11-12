import importlib.util
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[2] / "scripts" / "benchmark_pipeline.py"


def _load():
    spec = importlib.util.spec_from_file_location("benchmark_pipeline", SCRIPT)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


TIMINGS = [
    {"stage": "download", "seconds": 41.2, "rss_mb_peak": 210.4, "ok": True},
    {"stage": "transcribe", "seconds": 300.0, "rss_mb_peak": 2900.0, "ok": True, "whisper_model": "small", "whisper_device": "cpu"},
    {"stage": "tracking", "clip": 1, "seconds": 12.5, "rss_mb_peak": 950.0, "ok": True, "tracking_engine_used": "haar"},
    {"stage": "render", "clip": 1, "seconds": 20.0, "rss_mb_peak": None, "ok": False, "encoder": "libx264"},
]


def test_table_has_one_row_per_stage_with_time_memory_and_device():
    table = _load().format_timings_table(TIMINGS)
    rows = table.splitlines()

    assert any("download" in r and "41.2" in r and "210.4" in r for r in rows)
    assert any("transcribe" in r and "300.0" in r and "whisper_device=cpu" in r for r in rows)
    assert any("tracking" in r and "tracking_engine_used=haar" in r for r in rows)
    assert any("render" in r and "encoder=libx264" in r and "FAILED" in r for r in rows)


def test_table_shows_total_time_and_peak_memory():
    table = _load().format_timings_table(TIMINGS)
    assert "373.7" in table      # 41.2 + 300.0 + 12.5 + 20.0
    assert "2900.0" in table


def test_table_handles_no_timings():
    assert "no timings" in _load().format_timings_table([]).lower()


def test_local_file_becomes_a_local_source(tmp_path):
    video = tmp_path / "talk.mp4"
    video.write_bytes(b"x")
    mod = _load()
    assert mod.to_source_url(str(video)) == f"local:{video.resolve()}"
    assert mod.to_source_url("https://youtu.be/abc") == "https://youtu.be/abc"


def test_clip_argument_is_parsed_into_start_and_end():
    mod = _load()
    assert mod.parse_clip("00:01:00-00:02:00") == {"start": "00:01:00", "end": "00:02:00"}
