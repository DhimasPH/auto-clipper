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


# --- live stage for the job status (SP2 spec 4.4) ---------------------------------------------

def test_current_stage_is_none_without_a_running_stage():
    live = {}
    assert stage_timer.current_stage(live) is None
    assert stage_timer.current_stage(None) is None
    with collect_timings([], live):
        assert stage_timer.current_stage(live) is None


def test_current_stage_shows_the_running_stage_and_clears_when_it_ends():
    live = {}
    with collect_timings([], live):
        before = time.time()
        with stage("download"):
            cur = stage_timer.current_stage(live)
            assert cur["stage"] == "download"
            assert before - 1 <= cur["started_at"] <= time.time() + 1
            assert cur["elapsed_seconds"] >= 0
        assert stage_timer.current_stage(live) is None


def test_nested_stage_shows_the_inner_one_then_the_outer_again():
    live = {}
    with collect_timings([], live):
        with stage("clip", clip=1):
            with stage("render"):
                assert stage_timer.current_stage(live)["stage"] == "render"
            assert stage_timer.current_stage(live)["stage"] == "clip"
        assert stage_timer.current_stage(live) is None


def test_device_comes_from_the_field_the_stage_records():
    live = {}
    with collect_timings([], live):
        with stage("transcribe", whisper_model="small") as rec:
            assert "device" not in stage_timer.current_stage(live)
            rec["whisper_device"] = "cpu"
            assert stage_timer.current_stage(live)["device"] == "cpu"


def test_clip_number_and_total_while_rendering():
    live = {}
    with collect_timings([], live):
        stage_timer.report(clips_total=3)
        stage_timer.set_context(clip=2)
        with stage("render") as rec:
            rec["encoder"] = "libx264"
            cur = stage_timer.current_stage(live)
    assert (cur["clip"], cur["clips_total"], cur["device"]) == (2, 3, "libx264")


def test_percent_is_rounded_and_clamped():
    live = {}
    with collect_timings([], live):
        with stage("download"):
            stage_timer.report(percent=42.1234)
            assert stage_timer.current_stage(live)["percent"] == 42.1
            stage_timer.report(percent=180)
            assert stage_timer.current_stage(live)["percent"] == 100.0


def test_live_data_never_reaches_timings():
    timings, live = [], {}
    with collect_timings(timings, live):
        stage_timer.report(clips_total=4)
        stage_timer.set_context(clip=1)
        with stage("download"):
            stage_timer.report(percent=50)
    assert set(timings[0]) == {"stage", "clip", "seconds", "rss_mb_peak", "ok"}


def test_report_without_a_live_dict_is_harmless():
    stage_timer.report(percent=10, clips_total=2)


def test_live_device_override_shows_in_current_stage_without_leaking_to_timings():
    timings, live = [], {}
    with collect_timings(timings, live):
        with stage("tracking") as rec:
            rec["tracking_engine_requested"] = "mediapipe"
            # While tracking runs and before engine_used is finalized, requested engine is NOT live device.
            assert "device" not in stage_timer.current_stage(live)
            stage_timer.report(device="haar_fallback")
            assert stage_timer.current_stage(live)["device"] == "haar_fallback"
            rec["tracking_fallback_reason"] = "addon_not_installed"
            rec["tracking_engine_used"] = "haar"
            assert stage_timer.current_stage(live)["device"] == "haar_fallback"
    assert "device" not in timings[0]


def test_tracking_request_and_fallback_reason_are_not_treated_as_live_device():
    live = {}
    with collect_timings([], live):
        with stage("tracking") as rec:
            rec["tracking_engine_requested"] = "mediapipe"
            rec["tracking_fallback_reason"] = "addon_not_installed"
            assert "device" not in stage_timer.current_stage(live)
            rec["tracking_engine_used"] = "haar"
            assert stage_timer.current_stage(live)["device"] == "haar"
    timings = []
    with collect_timings(timings):
        with stage("download"):
            stage_timer.report(percent=10)
    assert "percent" not in timings[0]


def test_a_failing_stage_still_leaves_the_live_stack():
    live = {}
    with collect_timings([], live):
        with pytest.raises(RuntimeError):
            with stage("render"):
                raise RuntimeError("ffmpeg died")
        assert stage_timer.current_stage(live) is None


def test_each_collector_block_has_its_own_live_dict():
    outer, inner = {}, {}
    with collect_timings([], outer):
        with collect_timings([], inner):
            with stage("render"):
                assert stage_timer.current_stage(outer) is None
                assert stage_timer.current_stage(inner)["stage"] == "render"

