import datetime
import re

import pytest

from backend import preflight
from backend.errors import AppError

ALL_IDS = ["ffmpeg", "disk", "ram", "gpu", "gpu_render", "drive", "deno", "downloader"]


@pytest.fixture
def healthy(monkeypatch):
    """A machine where every check passes; tests then break one thing at a time."""
    monkeypatch.setattr(preflight, "_ffmpeg_path", lambda: "/usr/bin/ffmpeg")
    monkeypatch.setattr(preflight, "_free_disk_gb", lambda: 80.0)
    monkeypatch.setattr(preflight, "_available_ram_gb", lambda: 10.0)
    monkeypatch.setattr(preflight, "_cuda_device_count", lambda: 1)
    monkeypatch.setattr(preflight, "_whisper_gpu_libs_missing", lambda: [])
    monkeypatch.setattr(preflight, "_gpu_encoder_available", lambda: True)
    monkeypatch.setattr(preflight, "_cloud_drive_expected", lambda: True)
    monkeypatch.setattr(preflight, "_drive_mounted", lambda: True)
    monkeypatch.setattr(preflight, "_deno_path", lambda: "/usr/bin/deno")
    monkeypatch.setattr(preflight, "_downloader_version", lambda: "2026.10.26")
    monkeypatch.setattr(preflight, "_today", lambda: datetime.date(2026, 11, 12))


def _by_id(results):
    return {r["id"]: r for r in results}


def test_healthy_machine_reports_every_check_as_ok(healthy):
    results = preflight.run_preflight()
    assert [r["id"] for r in results] == ALL_IDS
    assert {r["level"] for r in results} == {"ok"}
    assert preflight.blocking_error() is None


def test_every_result_has_the_contract_fields_in_both_languages(healthy):
    for r in preflight.run_preflight():
        assert {"id", "level", "title", "message", "title_en", "message_en"} <= set(r)
        assert r["level"] in ("ok", "warn", "block")
        for field in ("title", "message", "title_en", "message_en"):
            assert isinstance(r[field], str) and r[field].strip()


# --- one failing thing at a time --------------------------------------------

def test_missing_ffmpeg_blocks(healthy, monkeypatch):
    monkeypatch.setattr(preflight, "_ffmpeg_path", lambda: None)
    r = _by_id(preflight.run_preflight())["ffmpeg"]
    assert r["level"] == "block"
    assert r["code"] == "FFMPEG_MISSING"


def test_nearly_full_disk_blocks_and_names_the_free_space(healthy, monkeypatch):
    monkeypatch.setattr(preflight, "_free_disk_gb", lambda: 0.4)
    r = _by_id(preflight.run_preflight())["disk"]
    assert r["level"] == "block"
    assert r["code"] == "DISK_FULL"
    assert "0,4 GB" in r["message"]
    assert "0.4 GB" in r["message_en"]


def test_low_disk_warns_without_blocking(healthy, monkeypatch):
    monkeypatch.setattr(preflight, "_free_disk_gb", lambda: 3.0)
    assert _by_id(preflight.run_preflight())["disk"]["level"] == "warn"
    assert preflight.blocking_error() is None


def test_low_memory_warns(healthy, monkeypatch):
    monkeypatch.setattr(preflight, "_available_ram_gb", lambda: 1.2)
    r = _by_id(preflight.run_preflight())["ram"]
    assert r["level"] == "warn"
    assert "1,2 GB" in r["message"]


def test_unreadable_memory_is_reported_honestly_not_as_a_problem(healthy, monkeypatch):
    monkeypatch.setattr(preflight, "_available_ram_gb", lambda: None)
    r = _by_id(preflight.run_preflight())["ram"]
    assert r["level"] == "ok"
    assert "tidak bisa dibaca" in r["message"]


def test_no_gpu_warns_that_subtitles_will_be_slow(healthy, monkeypatch):
    monkeypatch.setattr(preflight, "_cuda_device_count", lambda: 0)
    r = _by_id(preflight.run_preflight())["gpu"]
    assert r["level"] == "warn"
    assert r["code"] == "NO_GPU_SLOW"
    assert "lambat" in r["message"]


def test_gpu_without_its_subtitle_libraries_warns_that_subtitles_use_the_processor(healthy, monkeypatch):
    # Colab 2026-11-18: a T4 was found, but libcublas.so.12 was not, so Whisper
    # quietly ran on the processor for more than half an hour.
    monkeypatch.setattr(preflight, "_whisper_gpu_libs_missing", lambda: ["libcublas.so.12"])
    r = _by_id(preflight.run_preflight())["gpu"]
    assert r["level"] == "warn"
    assert "prosesor" in r["message"] and "processor" in r["message_en"]
    assert "Langkah 3" in r["message"]
    assert "libcublas.so.12" in r["technical"]


def test_subtitle_libraries_are_not_checked_without_a_gpu(healthy, monkeypatch):
    monkeypatch.setattr(preflight, "_cuda_device_count", lambda: 0)
    asked = []
    monkeypatch.setattr(preflight, "_whisper_gpu_libs_missing", lambda: asked.append(1) or ["x"])
    assert _by_id(preflight.run_preflight())["gpu"]["code"] == "NO_GPU_SLOW"
    assert asked == []


def test_subtitle_library_probe_finds_libraries_in_the_nvidia_packages(monkeypatch, tmp_path):
    loaded = []

    def fake_cdll(name):
        if "/" not in name.replace("\\", "/"):
            raise OSError(f"{name}: cannot open shared object file")
        loaded.append(name)

    monkeypatch.setattr(preflight.sys, "platform", "linux")
    monkeypatch.setattr(preflight.ctypes, "CDLL", fake_cdll)
    monkeypatch.setattr(preflight, "_nvidia_lib_dir", lambda package: str(tmp_path / package) if package == "cublas" else None)

    assert preflight._whisper_gpu_libs_missing() == ["libcudnn.so.9"]
    assert loaded == [str(tmp_path / "cublas" / "libcublas.so.12")]


def test_subtitle_library_probe_is_skipped_off_linux(monkeypatch):
    monkeypatch.setattr(preflight.sys, "platform", "win32")
    monkeypatch.setattr(preflight.ctypes, "CDLL", lambda name: (_ for _ in ()).throw(AssertionError(name)))
    assert preflight._whisper_gpu_libs_missing() == []


def test_cpu_rendering_is_reported_not_hidden(healthy, monkeypatch):
    monkeypatch.setattr(preflight, "_gpu_encoder_available", lambda: False)
    r = _by_id(preflight.run_preflight())["gpu_render"]
    assert r["level"] == "warn"
    assert "prosesor" in r["message"]


def test_unmounted_drive_blocks_in_colab(healthy, monkeypatch):
    # Owner decision 2026-11-18 (T0.17): without the mount every clip would be lost, so no job starts.
    monkeypatch.setattr(preflight, "_drive_mounted", lambda: False)
    r = _by_id(preflight.run_preflight())["drive"]
    assert r["level"] == "block"
    assert r["code"] == "DRIVE_NOT_MOUNTED"


def test_drive_folder_without_a_mount_is_not_a_mounted_drive(monkeypatch):
    # The backend creates /content/drive/MyDrive/... on the local disk when it
    # opens the library, so the folder existing proves nothing.
    monkeypatch.setattr(preflight.os.path, "isdir", lambda p: True)
    monkeypatch.setattr(preflight.os.path, "ismount", lambda p: False)
    assert preflight._drive_mounted() is False


def test_drive_mount_point_counts_as_mounted(monkeypatch):
    asked = []
    monkeypatch.setattr(preflight.os.path, "ismount", lambda p: asked.append(p) or True)
    assert preflight._drive_mounted() is True
    assert asked == ["/content/drive"]


def test_drive_is_not_a_concern_outside_colab(healthy, monkeypatch):
    monkeypatch.setattr(preflight, "_cloud_drive_expected", lambda: False)
    monkeypatch.setattr(preflight, "_drive_mounted", lambda: False)
    assert _by_id(preflight.run_preflight())["drive"]["level"] == "ok"


def test_missing_deno_warns(healthy, monkeypatch):
    monkeypatch.setattr(preflight, "_deno_path", lambda: None)
    assert _by_id(preflight.run_preflight())["deno"]["level"] == "warn"


def test_old_downloader_warns_and_fresh_one_does_not(healthy, monkeypatch):
    monkeypatch.setattr(preflight, "_downloader_version", lambda: "2026.06.01")
    r = _by_id(preflight.run_preflight())["downloader"]
    assert r["level"] == "warn"
    assert "164" in r["message"]  # days between 2026-06-01 and 2026-11-12

    monkeypatch.setattr(preflight, "_downloader_version", lambda: "2026.09.01")
    assert _by_id(preflight.run_preflight())["downloader"]["level"] == "ok"


def test_downloader_version_with_a_patch_suffix_is_understood(healthy, monkeypatch):
    monkeypatch.setattr(preflight, "_downloader_version", lambda: "2026.10.26.232815")
    assert _by_id(preflight.run_preflight())["downloader"]["level"] == "ok"


# --- robustness ---------------------------------------------------------------

@pytest.mark.parametrize("probe, check_id", [
    ("_ffmpeg_path", "ffmpeg"), ("_free_disk_gb", "disk"), ("_available_ram_gb", "ram"),
    ("_cuda_device_count", "gpu"), ("_whisper_gpu_libs_missing", "gpu"), ("_gpu_encoder_available", "gpu_render"), ("_drive_mounted", "drive"),
    ("_deno_path", "deno"), ("_downloader_version", "downloader"),
])
def test_one_crashing_check_never_takes_down_the_others(healthy, monkeypatch, probe, check_id):
    logged = []
    monkeypatch.setattr(preflight, "log_error", lambda *a, **k: logged.append(a))

    def crash():
        raise RuntimeError("probe exploded")

    monkeypatch.setattr(preflight, probe, crash)
    results = _by_id(preflight.run_preflight())

    assert list(results) == ALL_IDS
    assert results[check_id]["level"] == "warn"
    assert "probe exploded" in results[check_id]["technical"]
    others = [r["level"] for cid, r in results.items() if cid != check_id]
    assert set(others) == {"ok"}
    assert logged
    assert preflight.blocking_error() is None, "a check that could not run must not block jobs"


def test_unparseable_downloader_version_is_a_warning_not_a_crash(healthy, monkeypatch):
    monkeypatch.setattr(preflight, "log_error", lambda *a, **k: None)
    monkeypatch.setattr(preflight, "_downloader_version", lambda: "nightly-build")
    assert _by_id(preflight.run_preflight())["downloader"]["level"] == "warn"


JARGON = ["nvenc", "ctranslate2", "cuda", "yt-dlp", "libx264", "oom", "fuse", "po token", "traceback", "exception"]


def _all_states(monkeypatch):
    """Results for the healthy machine plus every degraded state."""
    states = list(preflight.run_preflight())
    degraded = [
        ("_ffmpeg_path", lambda: None), ("_free_disk_gb", lambda: 0.4), ("_free_disk_gb", lambda: 3.0),
        ("_available_ram_gb", lambda: 1.2), ("_available_ram_gb", lambda: None), ("_cuda_device_count", lambda: 0),
        ("_whisper_gpu_libs_missing", lambda: ["libcublas.so.12"]),
        ("_gpu_encoder_available", lambda: False), ("_drive_mounted", lambda: False),
        ("_deno_path", lambda: None), ("_downloader_version", lambda: "2026.01.01"),
    ]
    for probe, value in degraded:
        with monkeypatch.context() as m:
            m.setattr(preflight, probe, value)
            states.extend(r for r in preflight.run_preflight() if r["level"] != "ok" or probe == "_available_ram_gb")
    return states


def test_no_message_uses_jargon_and_problems_say_what_to_do(healthy, monkeypatch):
    for r in _all_states(monkeypatch):
        for field in ("title", "message", "title_en", "message_en"):
            lowered = r[field].lower()
            for term in JARGON:
                assert not re.search(rf"\b{re.escape(term)}\b", lowered), f"{r['id']}.{field} contains {term!r}"
            assert "—" not in r[field]
        if r["level"] != "ok":
            # what happened, why it matters, what to do
            assert r["message"].count(".") >= 2, r["id"]
            assert r["message_en"].count(".") >= 2, r["id"]


# --- blocking a job -----------------------------------------------------------

def test_blocking_error_is_an_app_error_with_the_check_code(healthy, monkeypatch):
    monkeypatch.setattr(preflight, "_ffmpeg_path", lambda: None)
    err = preflight.blocking_error()
    assert isinstance(err, AppError)
    assert err.code == "FFMPEG_MISSING"
    assert "ffmpeg" in err.technical.lower()


def test_blocking_error_only_runs_the_checks_that_can_block(healthy, monkeypatch):
    # The drive check can block since T0.17, so its probes now run before every
    # job. They stay cheap: one environment variable and one os.path.ismount.
    called = []
    for probe in ("_available_ram_gb", "_cuda_device_count", "_whisper_gpu_libs_missing", "_gpu_encoder_available", "_deno_path", "_downloader_version"):
        monkeypatch.setattr(preflight, probe, lambda probe=probe: called.append(probe))
    asked = []
    monkeypatch.setattr(preflight, "_drive_mounted", lambda: asked.append("_drive_mounted") or True)
    assert preflight.blocking_error() is None
    assert called == []
    assert asked == ["_drive_mounted"]


def test_blocking_error_stops_a_job_when_drive_is_not_mounted(healthy, monkeypatch):
    monkeypatch.setattr(preflight, "_drive_mounted", lambda: False)
    err = preflight.blocking_error()
    assert isinstance(err, AppError)
    assert err.code == "DRIVE_NOT_MOUNTED"
    assert "mount point" in err.technical


# --- real probes on this machine: they must return, not raise -----------------

def test_real_probes_run_on_this_machine():
    assert preflight._free_disk_gb() > 0
    ram = preflight._available_ram_gb()
    assert ram is None or ram > 0
    assert isinstance(preflight._cuda_device_count(), int)
    assert re.match(r"\d{4}\.\d{1,2}\.\d{1,2}", preflight._downloader_version())
    assert isinstance(preflight._cloud_drive_expected(), bool)
    assert preflight._today() == datetime.date.today()


def test_drive_is_expected_only_for_a_colab_workspace(monkeypatch):
    monkeypatch.setenv("AUTO_CLIPPER_CLOUD_MODE", "1")
    monkeypatch.setenv("AUTO_CLIPPER_WORKSPACE", "/content/drive/MyDrive/AutoClipperData")
    assert preflight._cloud_drive_expected() is True

    monkeypatch.setenv("AUTO_CLIPPER_WORKSPACE", "/content/work")
    assert preflight._cloud_drive_expected() is False

    monkeypatch.delenv("AUTO_CLIPPER_CLOUD_MODE")
    monkeypatch.setenv("AUTO_CLIPPER_WORKSPACE", "/content/drive/MyDrive/AutoClipperData")
    assert preflight._cloud_drive_expected() is False


# --- GET /api/preflight -------------------------------------------------------

def _client():
    from fastapi.testclient import TestClient
    from backend.main import app
    return TestClient(app)


def test_endpoint_returns_every_check(healthy):
    r = _client().get("/api/preflight")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "success"
    assert [c["id"] for c in body["checks"]] == ALL_IDS


def test_endpoint_survives_a_crashing_check(healthy, monkeypatch):
    monkeypatch.setattr(preflight, "log_error", lambda *a, **k: None)

    def crash():
        raise RuntimeError("probe exploded")

    monkeypatch.setattr(preflight, "_cuda_device_count", crash)
    r = _client().get("/api/preflight")
    assert r.status_code == 200
    assert _by_id(r.json()["checks"])["gpu"]["level"] == "warn"


def test_endpoint_needs_the_same_token_as_other_endpoints_in_cloud_mode(healthy, monkeypatch):
    monkeypatch.setenv("AUTO_CLIPPER_CLOUD_MODE", "1")
    monkeypatch.setenv("AUTO_CLIPPER_WEB_TOKEN", "secret-test-token")
    client = _client()

    assert client.get("/api/preflight").status_code == 401
    assert client.get("/api/preflight", headers={"Authorization": "Bearer wrong"}).status_code == 401
    assert client.get("/api/preflight", headers={"Authorization": "Bearer secret-test-token"}).status_code == 200


# --- a blocking check stops the job before it starts --------------------------

import time

from backend import jobs


def _wait_until(predicate, timeout=5.0):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if predicate():
            return True
        time.sleep(0.01)
    return False


@pytest.fixture
def no_db(monkeypatch):
    saved = []
    monkeypatch.setattr("backend.db.save_history", lambda job_id, url, status, clips, meta: saved.append((job_id, status, meta)))
    monkeypatch.setattr("backend.db.get_all_history", lambda: [])
    return saved


def test_blocked_job_ends_as_error_with_error_info_and_never_runs(healthy, monkeypatch, no_db):
    monkeypatch.setattr(preflight, "_ffmpeg_path", lambda: None)
    ran = []
    monkeypatch.setattr(jobs, "_run_manual_job", lambda job_id: ran.append(job_id))

    job_id = jobs.create_manual_job("https://youtu.be/x", [], title="Blocked project")

    assert _wait_until(lambda: jobs.active_jobs[job_id]["status"] == "ERROR")
    job = jobs.active_jobs[job_id]
    assert ran == []
    assert job["error_info"]["code"] == "FFMPEG_MISSING"
    assert job["error"]
    assert _wait_until(lambda: jobs.job_queue.position(job_id) is None), "the slot must be released"
    last = [s for s in no_db if s[0] == job_id][-1]
    assert last[1] == "ERROR"
    assert last[2]["error_info"]["code"] == "FFMPEG_MISSING"


def test_warnings_do_not_stop_a_job(healthy, monkeypatch, no_db):
    monkeypatch.setattr(preflight, "_cuda_device_count", lambda: 0)
    monkeypatch.setattr(preflight, "_gpu_encoder_available", lambda: False)
    monkeypatch.setattr(preflight, "_free_disk_gb", lambda: 3.0)
    ran = []
    monkeypatch.setattr(jobs, "_run_manual_job", lambda job_id: ran.append(job_id))

    job_id = jobs.create_manual_job("https://youtu.be/x", [], title="Warned project")
    assert _wait_until(lambda: ran == [job_id])


def test_blocked_clip_rerender_reports_the_error_without_a_history_row(healthy, monkeypatch, no_db):
    monkeypatch.setattr(preflight, "_free_disk_gb", lambda: 0.2)
    ran = []
    monkeypatch.setattr(jobs, "_run_rerender_clip_job", lambda job_id: ran.append(job_id))

    job_id = jobs.create_rerender_clip_job("parent-1", 0, [], "9:16", "standard", False)

    assert _wait_until(lambda: jobs.active_jobs[job_id]["status"] == "ERROR")
    assert ran == []
    assert jobs.active_jobs[job_id]["error_info"]["code"] == "DISK_FULL"
    assert [s for s in no_db if s[0] == job_id] == []


def test_job_cancelled_while_waiting_is_not_reported_as_blocked(healthy, monkeypatch, no_db):
    import threading
    monkeypatch.setattr(preflight, "_ffmpeg_path", lambda: None)
    gate, started = threading.Event(), threading.Event()

    def linger():
        started.set()
        gate.wait(5)

    jobs.job_queue.submit("lingering-job", linger)
    assert started.wait(5)

    job_id = jobs.create_manual_job("https://youtu.be/x", [], title="Cancelled before preflight")
    assert _wait_until(lambda: jobs.job_queue.position(job_id) == 1)
    jobs.cancel_job(job_id)
    gate.set()
    assert _wait_until(lambda: jobs.job_queue.position("lingering-job") is None)
    time.sleep(0.1)

    assert jobs.active_jobs[job_id]["status"] == "CANCELLED"
    assert not jobs.active_jobs[job_id].get("error_info")


def test_job_cancelled_just_before_its_turn_does_no_work_and_is_not_blocked(healthy, monkeypatch, no_db):
    monkeypatch.setattr(preflight, "_ffmpeg_path", lambda: None)
    job_id = "cancelled-at-the-door"
    jobs.active_jobs[job_id] = {"id": job_id, "url": "local:x", "status": "CANCELLED", "cancelled": True, "clips": []}
    ran = []

    jobs._run_queued(job_id, lambda jid: ran.append(jid), ())

    assert ran == []
    assert jobs.active_jobs[job_id]["status"] == "CANCELLED"
    assert not jobs.active_jobs[job_id].get("error_info")
