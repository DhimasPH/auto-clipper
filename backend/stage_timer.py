"""Per-stage wall time and peak memory for the job pipeline.

Usage, on the job thread:

    with collect_timings(metadata.setdefault("timings", [])):
        with stage("download"):
            ...
        with stage("clip", clip=1):
            with stage("render") as rec:      # inherits clip=1
                rec["encoder"] = "libx264"

Each finished stage appends ``{stage, seconds, rss_mb_peak, ok, ...}`` to the
list handed to ``collect_timings`` and writes one line to the app log. Timing
never changes what the wrapped code does: exceptions pass through untouched and
a failing memory probe only yields ``rss_mb_peak: None``.

Memory is the resident set size of this process. When ``psutil`` is installed
(it is on Google Colab) child processes such as ffmpeg are included too.

While a job runs, ``collect_timings(timings, live)`` also keeps the running stages
on a stack in ``live`` (a dict owned by the job). ``current_stage(live)`` turns the
innermost one into the ``current`` object of the job status (SP2 spec 4.4), and
``report()`` adds live-only facts (``percent``, ``clips_total``). None of this is
ever written to ``timings``.
"""
import os
import sys
import threading
import time
from contextlib import contextmanager

from backend.logger import log_app

SAMPLE_INTERVAL = 1.0  # seconds between memory samples while a stage runs

_local = threading.local()
# Fields that say which device really did the work (see jobs._finalize_job).
DEVICE_FIELDS = ("whisper_device", "encoder", "tracking_engine_used")


def _rss_psutil():
    import psutil
    proc = psutil.Process()
    total = proc.memory_info().rss
    for child in proc.children(recursive=True):
        try:
            total += child.memory_info().rss
        except Exception:
            pass  # the child exited between listing and reading
    return total / (1024 * 1024)


def _rss_windows():
    import ctypes
    from ctypes import wintypes

    class PROCESS_MEMORY_COUNTERS(ctypes.Structure):
        _fields_ = [
            ("cb", wintypes.DWORD),
            ("PageFaultCount", wintypes.DWORD),
            ("PeakWorkingSetSize", ctypes.c_size_t),
            ("WorkingSetSize", ctypes.c_size_t),
            ("QuotaPeakPagedPoolUsage", ctypes.c_size_t),
            ("QuotaPagedPoolUsage", ctypes.c_size_t),
            ("QuotaPeakNonPagedPoolUsage", ctypes.c_size_t),
            ("QuotaNonPagedPoolUsage", ctypes.c_size_t),
            ("PagefileUsage", ctypes.c_size_t),
            ("PeakPagefileUsage", ctypes.c_size_t),
        ]

    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
    kernel32.GetCurrentProcess.restype = wintypes.HANDLE
    kernel32.K32GetProcessMemoryInfo.argtypes = [
        wintypes.HANDLE, ctypes.POINTER(PROCESS_MEMORY_COUNTERS), wintypes.DWORD,
    ]
    kernel32.K32GetProcessMemoryInfo.restype = wintypes.BOOL

    counters = PROCESS_MEMORY_COUNTERS()
    counters.cb = ctypes.sizeof(counters)
    if not kernel32.K32GetProcessMemoryInfo(kernel32.GetCurrentProcess(), ctypes.byref(counters), counters.cb):
        return None
    return counters.WorkingSetSize / (1024 * 1024)


def _rss_proc():
    with open("/proc/self/statm", "r", encoding="ascii") as f:
        resident_pages = int(f.read().split()[1])
    return resident_pages * os.sysconf("SC_PAGE_SIZE") / (1024 * 1024)


def _rss_resource():
    # Lifetime peak, not the current value: the best macOS offers without psutil.
    import resource
    peak = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    return peak / (1024 * 1024) if sys.platform == "darwin" else peak / 1024


def read_rss_mb():
    """Resident memory in MB, or None when it cannot be read on this platform."""
    try:
        return _rss_psutil()
    except ImportError:
        pass
    if sys.platform == "win32":
        return _rss_windows()
    if os.path.exists("/proc/self/statm"):
        return _rss_proc()
    return _rss_resource()


def _safe_rss_mb():
    try:
        value = read_rss_mb()
        return float(value) if value is not None else None
    except Exception:
        return None


class _PeakSampler:
    """Polls memory on a daemon thread and remembers the largest value seen."""

    def __init__(self):
        self.peak = None
        self._stop = threading.Event()
        self._thread = threading.Thread(target=self._run, daemon=True)

    def _sample(self):
        value = _safe_rss_mb()
        if value is not None and (self.peak is None or value > self.peak):
            self.peak = value

    def _run(self):
        while not self._stop.wait(SAMPLE_INTERVAL):
            self._sample()

    def start(self):
        self._sample()
        try:
            self._thread.start()
        except Exception:
            self._thread = None

    def stop(self):
        self._stop.set()
        if self._thread is not None and self._thread.is_alive():
            self._thread.join(timeout=5)
        self._sample()
        return self.peak


@contextmanager
def collect_timings(timings: list, live: dict = None):
    """Send every ``stage`` finished on this thread, inside the block, to ``timings``.

    ``live`` (optional, owned by the job) holds the stages that are running now,
    for the job status. It is never copied into ``timings``.
    """
    previous = getattr(_local, "timings", None)
    previous_fields = getattr(_local, "fields", {})
    previous_live = getattr(_local, "live", None)
    _local.timings = timings
    _local.fields = {}
    _local.live = live
    try:
        yield timings
    finally:
        _local.timings = previous
        _local.fields = previous_fields
        _local.live = previous_live


def set_context(**fields):
    """Tag every following stage on this thread with ``fields`` (e.g. clip=3).

    Call with no arguments to clear. The tags end with the enclosing
    ``collect_timings`` block at the latest.
    """
    _local.fields = dict(fields)


@contextmanager
def stage(name: str, **fields):
    """Time one pipeline stage. Yields the record so the body can add fields."""
    inherited = getattr(_local, "fields", {})
    merged = {**inherited, **fields}
    rec = {"stage": name, **merged}
    _local.fields = merged

    log_app(f"[timing] start stage={name}" + "".join(f" {k}={v}" for k, v in merged.items()))
    sampler = _PeakSampler()
    sampler.start()
    started = time.monotonic()
    live = getattr(_local, "live", None)
    entry = None
    if live is not None:
        # Replaced, never mutated in place: the status request reads it from another thread.
        entry = {"rec": rec, "started": started, "started_at": time.time()}
        live["stack"] = [*(live.get("stack") or []), entry]
    ok = True
    try:
        yield rec
    except BaseException:
        ok = False
        raise
    finally:
        if entry is not None:
            live["stack"] = [e for e in (live.get("stack") or []) if e is not entry]
        rec["seconds"] = round(time.monotonic() - started, 3)
        peak = sampler.stop()
        rec["rss_mb_peak"] = round(peak, 1) if peak is not None else None
        rec["ok"] = ok
        _local.fields = inherited

        timings = getattr(_local, "timings", None)
        if timings is not None:
            timings.append(rec)
        extras = "".join(
            f" {k}={v}" for k, v in rec.items() if k not in ("stage", "seconds", "rss_mb_peak")
        )
        log_app(f"[timing] end stage={name} seconds={rec['seconds']} rss_mb_peak={rec['rss_mb_peak']}{extras}")


def report(**fields):
    """Live facts for the job status only: ``clips_total`` for the run, ``percent`` for the running stage."""
    live = getattr(_local, "live", None)
    if live is None:
        return
    if "clips_total" in fields:
        live["clips_total"] = fields.pop("clips_total")
    stack = live.get("stack") or []
    if stack and fields:
        stack[-1].update(fields)


def _is_int(value) -> bool:
    return isinstance(value, int) and not isinstance(value, bool)


def current_stage(live) -> dict:
    """The innermost running stage as the ``current`` object of the job status, or None.

    ``{stage, started_at, elapsed_seconds, device?, clip?, clips_total?, percent?}``.
    ``elapsed_seconds`` comes from this server's clock, so a phone with another time still
    shows the right running time.
    """
    if not isinstance(live, dict):
        return None
    stack = live.get("stack") or []
    if not stack:
        return None
    top = stack[-1]
    rec = top["rec"]
    out = {
        "stage": rec.get("stage"),
        "started_at": round(top["started_at"], 3),
        "elapsed_seconds": round(max(0.0, time.monotonic() - top["started"]), 1),
    }
    for field in DEVICE_FIELDS:
        value = rec.get(field)
        if isinstance(value, str) and value:
            out["device"] = value
            break
    if _is_int(rec.get("clip")):
        out["clip"] = rec["clip"]
        total = live.get("clips_total")
        if _is_int(total) and total > 0:
            out["clips_total"] = total
    percent = top.get("percent")
    if isinstance(percent, (int, float)) and not isinstance(percent, bool):
        out["percent"] = round(min(100.0, max(0.0, float(percent))), 1)
    return out
