import json
import threading
import time

import pytest

from backend import stage_timer
from backend.stage_timer import collect_timings, stage


def test_stage_records_name_seconds_and_peak_memory():
    timings = []
    with collect_timings(timings):
        with stage("download"):
            time.sleep(0.05)

    assert len(timings) == 1
    rec = timings[0]
    assert rec["stage"] == "download"
    assert rec["seconds"] >= 0.04
    assert rec["rss_mb_peak"] > 0
    assert rec["ok"] is True


def test_stage_without_collector_is_harmless():
    with stage("orphan") as rec:
        rec["note"] = "x"
    assert rec["stage"] == "orphan"


def test_fields_from_kwargs_and_from_body_are_kept():
    timings = []
    with collect_timings(timings):
        with stage("transcribe", model="small") as rec:
            rec["whisper_device"] = "cpu"

    assert timings[0]["model"] == "small"
    assert timings[0]["whisper_device"] == "cpu"


def test_nested_stage_inherits_fields_of_enclosing_stage():
    timings = []
    with collect_timings(timings):
        with stage("clip", clip=3):
            with stage("tracking"):
                pass

    by_stage = {t["stage"]: t for t in timings}
    assert by_stage["tracking"]["clip"] == 3
    assert by_stage["clip"]["clip"] == 3


def test_fields_do_not_leak_to_later_sibling_stages():
    timings = []
    with collect_timings(timings):
        with stage("clip", clip=1):
            pass
        with stage("publish"):
            pass

    assert "clip" not in timings[1]


def test_set_context_tags_following_stages_until_cleared():
    timings = []
    with collect_timings(timings):
        stage_timer.set_context(clip=2)
        with stage("tracking"):
            pass
        stage_timer.set_context()
        with stage("publish"):
            pass

    assert timings[0]["clip"] == 2
    assert "clip" not in timings[1]


def test_context_does_not_outlive_the_collector():
    with collect_timings([]):
        stage_timer.set_context(clip=5)

    with stage("later") as rec:
        pass
    assert "clip" not in rec


def test_exception_propagates_unchanged_and_is_recorded_as_failed():
    timings = []
    with pytest.raises(ValueError, match="boom"):
        with collect_timings(timings):
            with stage("render"):
                raise ValueError("boom")

    assert timings[0]["stage"] == "render"
    assert timings[0]["ok"] is False
    assert timings[0]["seconds"] >= 0


def test_peak_is_the_largest_sample(monkeypatch):
    samples = iter([100.0, 350.0, 200.0])
    last = {"v": 200.0}

    def fake_rss():
        last["v"] = next(samples, last["v"])
        return last["v"]

    monkeypatch.setattr(stage_timer, "read_rss_mb", fake_rss)
    monkeypatch.setattr(stage_timer, "SAMPLE_INTERVAL", 0.01)

    timings = []
    with collect_timings(timings):
        with stage("transcribe"):
            time.sleep(0.2)

    assert timings[0]["rss_mb_peak"] == 350.0


def test_memory_probe_failure_never_breaks_the_stage(monkeypatch):
    def broken():
        raise OSError("no /proc here")

    monkeypatch.setattr(stage_timer, "read_rss_mb", broken)

    timings = []
    with collect_timings(timings):
        with stage("download"):
            pass

    assert timings[0]["rss_mb_peak"] is None
    assert timings[0]["ok"] is True


def test_collector_is_per_thread():
    mine = []
    seen_in_other_thread = []

    def other():
        with stage("other-thread") as rec:
            seen_in_other_thread.append(rec)

    with collect_timings(mine):
        t = threading.Thread(target=other)
        t.start()
        t.join()

    assert mine == []
    assert seen_in_other_thread[0]["stage"] == "other-thread"


def test_collector_is_removed_after_the_block():
    timings = []
    with collect_timings(timings):
        pass
    with stage("after"):
        pass
    assert timings == []


def test_stage_logs_to_app_log_and_never_to_stdout(monkeypatch, capsys):
    lines = []
    monkeypatch.setattr(stage_timer, "log_app", lines.append)

    with collect_timings([]):
        with stage("download"):
            pass

    out = capsys.readouterr()
    assert out.out == ""
    assert out.err == ""
    assert any("download" in line and "seconds" in line for line in lines)


def test_entries_are_json_serializable():
    timings = []
    with collect_timings(timings):
        with stage("clip", clip=1) as rec:
            rec["encoder"] = "libx264"
    json.dumps(timings)


def test_read_rss_mb_returns_a_plausible_value_on_this_platform():
    value = stage_timer.read_rss_mb()
    assert value is not None
    assert 1 < value < 1024 * 1024
