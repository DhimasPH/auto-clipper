"""Sleep/wake lifecycle tests for the backend watchdog.

These cover the fix for the "app shows Disconnected after the device sleeps"
bug: the watchdog must NOT kill the backend just because heartbeats paused
during OS sleep — only when the Tauri parent process is actually gone.
"""
import os

from backend.main import (
    is_parent_alive,
    check_watchdog_condition,
    HEARTBEAT_GRACE,
    WAKE_LOOP_THRESHOLD,
)


def test_is_parent_alive_current_process():
    # Our own process is obviously alive.
    assert is_parent_alive(os.getpid()) is True


def test_is_parent_alive_fail_safe_on_unknown_pid():
    # Missing / invalid pids must fail *safe* (assume alive -> never kill).
    assert is_parent_alive(None) is True
    assert is_parent_alive(0) is True
    assert is_parent_alive(-1) is True


def test_is_parent_alive_detects_dead_pid():
    # A pid that (almost certainly) does not exist reads as dead.
    assert is_parent_alive(2_000_000_000) is False


def test_watchdog_wake_from_sleep_does_not_kill():
    # A watchdog loop far longer than its interval means the OS slept; the
    # decision must be "wake" (reset baseline) regardless of heartbeat age.
    action = check_watchdog_condition(
        now_monotonic=10_000.0,
        last_heartbeat_monotonic=0.0,       # "ancient" by wall standards
        loop_delta=WAKE_LOOP_THRESHOLD + 100,
        parent_pid=2_000_000_000,           # even with a dead parent
    )
    assert action == "wake"


def test_watchdog_ok_when_heartbeat_fresh():
    action = check_watchdog_condition(
        now_monotonic=100.0,
        last_heartbeat_monotonic=100.0 - (HEARTBEAT_GRACE - 5),
        loop_delta=5,
        parent_pid=os.getpid(),
    )
    assert action == "ok"


def test_watchdog_stale_but_parent_alive_keeps_running():
    action = check_watchdog_condition(
        now_monotonic=200.0,
        last_heartbeat_monotonic=200.0 - (HEARTBEAT_GRACE + 30),
        loop_delta=5,
        parent_pid=os.getpid(),
    )
    assert action == "stale"


def test_watchdog_kills_when_stale_and_parent_dead():
    action = check_watchdog_condition(
        now_monotonic=200.0,
        last_heartbeat_monotonic=200.0 - (HEARTBEAT_GRACE + 30),
        loop_delta=5,
        parent_pid=2_000_000_000,
    )
    assert action == "kill"
