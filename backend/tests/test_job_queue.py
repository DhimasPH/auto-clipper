import threading
import time

import pytest

from backend.job_queue import JobAlreadyQueuedError, JobQueue


def _wait_until(predicate, timeout=5.0):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if predicate():
            return True
        time.sleep(0.01)
    return False


class Recorder:
    """Fake heavy tasks that record how many ran at the same time."""

    def __init__(self):
        self.lock = threading.Lock()
        self.running = 0
        self.max_running = 0
        self.started = []
        self.finished = []

    def task(self, name, gate=None, seconds=0.05):
        def run():
            with self.lock:
                self.running += 1
                self.max_running = max(self.max_running, self.running)
                self.started.append(name)
            try:
                if gate is not None:
                    assert gate.wait(5), "test gate was never opened"
                else:
                    time.sleep(seconds)
            finally:
                with self.lock:
                    self.running -= 1
                    self.finished.append(name)
        return run


def test_two_jobs_never_run_heavy_work_at_the_same_time():
    q, rec = JobQueue(), Recorder()
    for name in ("a", "b", "c"):
        q.submit(name, rec.task(name))

    assert _wait_until(lambda: len(rec.finished) == 3)
    assert rec.max_running == 1
    assert rec.started == ["a", "b", "c"]


def test_position_is_zero_when_running_and_counts_up_while_waiting():
    q, rec = JobQueue(), Recorder()
    gate = threading.Event()
    q.submit("a", rec.task("a", gate))
    q.submit("b", rec.task("b", gate))
    q.submit("c", rec.task("c", gate))

    assert _wait_until(lambda: rec.started == ["a"])
    assert q.position("a") == 0
    assert q.position("b") == 1
    assert q.position("c") == 2
    assert q.position("never-submitted") is None

    gate.set()
    assert _wait_until(lambda: len(rec.finished) == 3)
    assert q.position("a") is None
    assert q.position("c") is None


def test_cancelling_a_waiting_job_drops_it_without_running_it():
    q, rec = JobQueue(), Recorder()
    gate = threading.Event()
    q.submit("a", rec.task("a", gate))
    q.submit("b", rec.task("b"))
    q.submit("c", rec.task("c"))
    assert _wait_until(lambda: rec.started == ["a"])

    assert q.cancel("b") is True
    assert q.position("b") is None
    assert q.position("c") == 1

    gate.set()
    assert _wait_until(lambda: "c" in rec.finished)
    assert "b" not in rec.started


def test_cancelling_a_running_job_keeps_its_slot_until_it_really_stops():
    q, rec = JobQueue(), Recorder()
    gate = threading.Event()
    q.submit("a", rec.task("a", gate))
    q.submit("b", rec.task("b"))
    assert _wait_until(lambda: rec.started == ["a"])

    assert q.cancel("a") is False
    time.sleep(0.1)
    assert rec.started == ["a"], "b must not start while a is still winding down"

    gate.set()
    assert _wait_until(lambda: "b" in rec.finished)
    assert rec.max_running == 1


def test_a_crashing_job_releases_the_slot(monkeypatch):
    logged = []
    monkeypatch.setattr("backend.job_queue.log_error", lambda *a, **k: logged.append(a))
    q, rec = JobQueue(), Recorder()

    def crash():
        raise RuntimeError("boom")

    q.submit("a", crash)
    q.submit("b", rec.task("b"))

    assert _wait_until(lambda: rec.finished == ["b"])
    assert q.position("a") is None
    assert logged, "the crash must be logged, not lost"


def test_slot_count_comes_from_the_environment(monkeypatch):
    monkeypatch.setenv("AUTO_CLIPPER_MAX_HEAVY_JOBS", "2")
    q, rec = JobQueue(), Recorder()
    gate = threading.Event()
    for name in ("a", "b", "c"):
        q.submit(name, rec.task(name, gate))

    assert _wait_until(lambda: len(rec.started) == 2)
    time.sleep(0.1)
    assert sorted(rec.started) == ["a", "b"]
    assert q.position("c") == 1

    gate.set()
    assert _wait_until(lambda: len(rec.finished) == 3)
    assert rec.max_running == 2


@pytest.mark.parametrize("value", ["", "0", "-3", "many"])
def test_bad_slot_count_falls_back_to_one(monkeypatch, value):
    monkeypatch.setenv("AUTO_CLIPPER_MAX_HEAVY_JOBS", value)
    q, rec = JobQueue(), Recorder()
    for name in ("a", "b"):
        q.submit(name, rec.task(name))

    assert _wait_until(lambda: len(rec.finished) == 2)
    assert rec.max_running == 1


def test_submitting_an_id_that_is_still_queued_or_running_is_rejected():
    q, rec = JobQueue(), Recorder()
    gate = threading.Event()
    q.submit("a", rec.task("a", gate))
    q.submit("b", rec.task("b", gate))
    assert _wait_until(lambda: rec.started == ["a"])

    with pytest.raises(JobAlreadyQueuedError):
        q.submit("a", rec.task("a-again"))
    with pytest.raises(JobAlreadyQueuedError):
        q.submit("b", rec.task("b-again"))

    gate.set()
    assert _wait_until(lambda: len(rec.finished) == 2)
    assert rec.started == ["a", "b"]


def test_on_wait_is_called_only_for_a_job_that_has_to_wait():
    q, rec = JobQueue(), Recorder()
    gate = threading.Event()
    waits = []
    q.submit("a", rec.task("a", gate), on_wait=lambda pos: waits.append(("a", pos)))
    assert _wait_until(lambda: rec.started == ["a"])
    q.submit("b", rec.task("b"), on_wait=lambda pos: waits.append(("b", pos)))

    assert _wait_until(lambda: waits == [("b", 1)])
    gate.set()
    assert _wait_until(lambda: len(rec.finished) == 2)
    assert waits == [("b", 1)]


def test_job_is_not_left_in_the_queue_when_its_thread_cannot_start(monkeypatch):
    q = JobQueue()

    def no_threads(self):
        raise RuntimeError("can't start new thread")

    monkeypatch.setattr(threading.Thread, "start", no_threads)
    with pytest.raises(RuntimeError):
        q.submit("a", lambda: None)
    assert q.position("a") is None


def test_arguments_are_passed_to_the_task():
    q = JobQueue()
    seen = []
    q.submit("a", lambda x, y: seen.append((x, y)), args=(1, 2))
    assert _wait_until(lambda: seen == [(1, 2)])
