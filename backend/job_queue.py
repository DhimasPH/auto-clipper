"""Run heavy jobs one at a time, in the order they were submitted.

Each job gets its own thread, but only ``AUTO_CLIPPER_MAX_HEAVY_JOBS`` of them
(default 1) may run their work at once. The rest wait in a FIFO line. A job
holds its slot until its thread really returns, including after an error or a
cancel, so two transcriptions or renders never share the machine's memory.
"""
import os
import threading

from backend.logger import log_error


class JobAlreadyQueuedError(Exception):
    """The job id is already waiting or running."""


def max_heavy_jobs() -> int:
    try:
        return max(1, int(os.environ.get("AUTO_CLIPPER_MAX_HEAVY_JOBS", "1")))
    except ValueError:
        return 1


class JobQueue:
    def __init__(self):
        self._cond = threading.Condition()
        self._waiting = []      # job ids, first in line first
        self._running = set()

    def submit(self, job_id: str, target, args: tuple = (), on_wait=None) -> None:
        """Queue ``target(*args)`` for ``job_id`` on a new daemon thread.

        ``on_wait(position)`` is called once, on the job's thread, if the job
        cannot start right away.
        """
        with self._cond:
            if job_id in self._running or job_id in self._waiting:
                raise JobAlreadyQueuedError(job_id)
            self._waiting.append(job_id)
        thread = threading.Thread(target=self._work, args=(job_id, target, args, on_wait), daemon=True)
        try:
            thread.start()
        except Exception:
            self.cancel(job_id)
            raise

    def position(self, job_id: str):
        """0 while running, 1 for the next in line, 2 after that; None if unknown."""
        with self._cond:
            if job_id in self._running:
                return 0
            if job_id in self._waiting:
                return self._waiting.index(job_id) + 1
            return None

    def cancel(self, job_id: str) -> bool:
        """Drop a waiting job. Returns False if it was not waiting (e.g. already running)."""
        with self._cond:
            if job_id not in self._waiting:
                return False
            self._waiting.remove(job_id)
            self._cond.notify_all()
            return True

    def _take_slot(self, job_id: str, on_wait) -> bool:
        notified = False
        with self._cond:
            while True:
                if job_id not in self._waiting:
                    return False  # cancelled while waiting
                if self._waiting[0] == job_id and len(self._running) < max_heavy_jobs():
                    self._waiting.pop(0)
                    self._running.add(job_id)
                    self._cond.notify_all()
                    return True
                if on_wait is not None and not notified:
                    notified = True
                    try:
                        on_wait(self._waiting.index(job_id) + 1)
                    except Exception as e:
                        log_error("job_queue.on_wait", e)
                self._cond.wait(timeout=1.0)

    def _work(self, job_id: str, target, args: tuple, on_wait) -> None:
        if not self._take_slot(job_id, on_wait):
            return
        try:
            target(*args)
        except Exception as e:
            log_error(f"job_queue.job[{job_id}]", e)
        finally:
            with self._cond:
                self._running.discard(job_id)
                self._cond.notify_all()
