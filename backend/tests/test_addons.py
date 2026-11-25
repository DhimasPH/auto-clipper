import hashlib
import io
import json
import os
import sys
import types
import zipfile

import pytest
from fastapi.testclient import TestClient

from backend import addons, web_ui
from backend.main import app


def _make_wheel(files: dict[str, bytes]) -> tuple[bytes, str]:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for name, data in files.items():
            zf.writestr(name, data)
    raw = buf.getvalue()
    return raw, hashlib.sha256(raw).hexdigest()


def test_cuda_addon_install_verifies_pinned_sha256_reinstalls_and_extracts_only_dlls(tmp_path, monkeypatch):
    monkeypatch.setattr(addons, "get_app_data_dir", lambda: str(tmp_path))
    monkeypatch.delenv("AUTO_CLIPPER_CLOUD_MODE", raising=False)
    monkeypatch.setattr(addons.sys, "platform", "win32")
    monkeypatch.setattr(addons, "_cuda_count", lambda: 1)
    # ctypes.WinDLL exists only on Windows; CI runs this suite on Linux and macOS too.
    loaded_dlls = []
    monkeypatch.setattr(addons.ctypes, "WinDLL", lambda p: loaded_dlls.append(os.path.basename(p)), raising=False)

    # Pre-existing installation + pending removal marker that reinstall must clear before activate_installed
    old_bin = tmp_path / "addons" / "cuda" / "bin"
    old_bin.mkdir(parents=True)
    (old_bin / "stale.dll").write_bytes(b"old")
    (tmp_path / "addons" / "cuda" / "manifest.json").write_text('{"id":"cuda","version":"old"}', encoding="utf-8")
    addons._pending_remove_marker("cuda").write_text("pending", encoding="utf-8")

    wheel_bytes, good_sha = _make_wheel({
        "nvidia/cublas/bin/cublas64_12.dll": b"cublas-dll",
        "nvidia/cublas/bin/cublasLt64_12.dll": b"cublasLt-dll",
        "nvidia/cublas/include/cublas.h": b"header-skip",
        "nvidia_cublas_cu12-12.9.2.10.dist-info/METADATA": b"meta",
    })
    pinned = dict(addons.PINNED_ADDONS["cuda"]["win_amd64"], sha256=good_sha, size=len(wheel_bytes))
    monkeypatch.setitem(addons.PINNED_ADDONS["cuda"], "win_amd64", pinned)
    monkeypatch.setattr(
        addons, "_download_file",
        lambda url, dest, cb: (dest.write_bytes(wheel_bytes), cb(len(wheel_bytes), len(wheel_bytes))),
    )

    addons.install_addon_sync("cuda")
    assert addons.is_addon_installed("cuda") is True
    assert addons._pending_remove_marker("cuda").exists() is False
    assert not (old_bin / "stale.dll").exists()
    assert (tmp_path / "addons" / "cuda" / "bin" / "cublas64_12.dll").read_bytes() == b"cublas-dll"
    assert (tmp_path / "addons" / "cuda" / "bin" / "cublasLt64_12.dll").read_bytes() == b"cublasLt-dll"
    assert not (tmp_path / "addons" / "cuda" / "bin" / "cublas.h").exists()
    assert loaded_dlls == list(addons.PINNED_ADDONS["cuda"]["win_amd64"]["dlls"])


def test_addon_install_rejects_sha256_mismatch_and_cleans_part(tmp_path, monkeypatch):
    monkeypatch.setattr(addons, "get_app_data_dir", lambda: str(tmp_path))
    monkeypatch.delenv("AUTO_CLIPPER_CLOUD_MODE", raising=False)
    monkeypatch.setattr(addons.sys, "platform", "win32")
    monkeypatch.setattr(addons, "_cuda_count", lambda: 1)

    monkeypatch.setattr(addons, "_download_file", lambda url, dest, cb: dest.write_bytes(b"corrupted"))
    with pytest.raises(ValueError, match="Byte length"):
        addons.install_addon_sync("cuda")

    # Matching size but wrong content triggers SHA-256 mismatch
    same_len_bad_bytes = b"x" * len(b"corrupted")
    monkeypatch.setitem(addons.PINNED_ADDONS["cuda"], "win_amd64", dict(addons.PINNED_ADDONS["cuda"]["win_amd64"], size=len(same_len_bad_bytes)))
    monkeypatch.setattr(addons, "_download_file", lambda url, dest, cb: dest.write_bytes(same_len_bad_bytes))
    with pytest.raises(ValueError, match="SHA-256"):
        addons.install_addon_sync("cuda")

    assert addons.is_addon_installed("cuda") is False
    addons_dir = tmp_path / "addons"
    if addons_dir.exists():
        assert [p for p in addons_dir.iterdir() if ".part" in p.name] == []


def test_validate_url_rejects_untrusted_scheme_host_and_redirects(tmp_path, monkeypatch):
    import requests
    from types import SimpleNamespace

    with pytest.raises(ValueError, match="Disallowed"):
        addons._validate_url("http://files.pythonhosted.org/x.whl")
    with pytest.raises(ValueError, match="Disallowed"):
        addons._validate_url("https://evil.example.com/x.whl")

    class _FakeResp:
        url = "https://evil.example.com/payload.whl"
        history = [SimpleNamespace(url="https://files.pythonhosted.org/start.whl")]
        headers = {}
        def __enter__(self): return self
        def __exit__(self, *a): return False

    monkeypatch.setattr(requests, "get", lambda *a, **k: _FakeResp())
    with pytest.raises(ValueError, match="Disallowed"):
        addons._download_file("https://files.pythonhosted.org/start.whl", tmp_path / "out.whl", lambda g, t: None)


def test_activate_installed_registers_dll_dir_once_and_preloads_cublas(tmp_path, monkeypatch):
    monkeypatch.setattr(addons, "get_app_data_dir", lambda: str(tmp_path))
    monkeypatch.setattr(addons.sys, "platform", "win32")
    monkeypatch.delenv("AUTO_CLIPPER_CLOUD_MODE", raising=False)
    monkeypatch.setattr(addons, "_activated_dirs", set())

    cuda_bin = tmp_path / "addons" / "cuda" / "bin"
    cuda_bin.mkdir(parents=True)
    (cuda_bin / "cublasLt64_12.dll").write_bytes(b"lt")
    (cuda_bin / "cublas64_12.dll").write_bytes(b"cu")
    (tmp_path / "addons" / "cuda" / "manifest.json").write_text('{"id": "cuda"}', encoding="utf-8")

    added_dirs = []
    loaded_dlls = []
    monkeypatch.setattr(addons.os, "add_dll_directory", lambda p: added_dirs.append(p) or object(), raising=False)
    monkeypatch.setattr(addons.ctypes, "WinDLL", lambda p: loaded_dlls.append(p), raising=False)
    monkeypatch.setenv("PATH", "C:\\Windows")

    addons.activate_installed()
    addons.activate_installed()

    assert added_dirs == [str(cuda_bin)]
    assert os.environ["PATH"].startswith(str(cuda_bin) + os.pathsep)
    assert loaded_dlls == [str(cuda_bin / "cublasLt64_12.dll"), str(cuda_bin / "cublas64_12.dll")]


def test_start_addon_download_handles_concurrent_trigger_without_deadlock_and_reinstalls(tmp_path, monkeypatch):
    import threading
    from backend.errors import AppError

    monkeypatch.setattr(addons, "get_app_data_dir", lambda: str(tmp_path))
    monkeypatch.delenv("AUTO_CLIPPER_CLOUD_MODE", raising=False)
    monkeypatch.setattr(addons, "_mediapipe_platform_key", lambda: "win_amd64")

    # Pre-populate an older installed mediapipe folder to verify overwrite/reinstall
    mp_dir = tmp_path / "addons" / "mediapipe"
    (mp_dir / "mediapipe").mkdir(parents=True)
    (mp_dir / "face_landmarker.task").write_bytes(b"old")
    (mp_dir / "manifest.json").write_text('{"id":"mediapipe","version":"old"}', encoding="utf-8")

    started = threading.Event()
    release = threading.Event()

    def slow_install(addon_id):
        started.set()
        release.wait(5)
        with addons._state_lock:
            addons._download_state[addon_id] = {"downloading": False, "percent": 100, "downloaded_mb": 0.0, "total_mb": 0.0, "error_info": None}
        return addons.get_addon_status(addon_id)

    monkeypatch.setattr(addons, "install_addon_sync", slow_install)

    first = addons.start_addon_download("mediapipe")
    assert first["downloading"] is True
    assert started.wait(5)

    # Concurrent second trigger while downloading must NOT deadlock
    second = addons.start_addon_download("mediapipe")
    assert second["downloading"] is True

    # Removing while downloading must refuse
    with pytest.raises(RuntimeError, match="downloading"):
        addons.remove_addon("mediapipe")

    release.set()
    for _ in range(50):
        if not addons.get_addon_status("mediapipe")["downloading"]:
            break
        threading.Event().wait(0.02)

    # Simulate Windows DLL lock on unlink: marker must be written and manifest preserved;
    # on next launch activate_installed() cleans it up BEFORE loading WinDLL.
    from pathlib import Path
    loaded = []
    monkeypatch.setattr(addons.ctypes, "WinDLL", lambda p: loaded.append(p), raising=False)
    monkeypatch.setattr(addons, "_activated_dirs", set())

    with monkeypatch.context() as m:
        m.setattr(Path, "unlink", lambda self, missing_ok=False: (_ for _ in ()).throw(PermissionError("locked")))
        with pytest.raises(AppError) as exc_info:
            addons.remove_addon("mediapipe")
        assert exc_info.value.code == "ADDON_IN_USE"
    assert addons.is_addon_installed("mediapipe") is True
    assert addons._pending_remove_marker("mediapipe").is_file() is True

    addons.activate_installed()
    assert addons.is_addon_installed("mediapipe") is False
    assert addons._pending_remove_marker("mediapipe").exists() is False
    assert loaded == []


def test_post_download_endpoint_and_cloud_unmounted_drive_safety(tmp_path, monkeypatch):
    from backend.errors import AppError

    monkeypatch.setattr(addons, "get_app_data_dir", lambda: str(tmp_path))
    monkeypatch.delenv("AUTO_CLIPPER_CLOUD_MODE", raising=False)
    monkeypatch.setattr(web_ui, "is_web_mode", lambda: False)
    monkeypatch.setattr(addons, "_mediapipe_platform_key", lambda: "win_amd64")
    monkeypatch.setattr(addons, "start_addon_download", lambda aid: {"id": aid, "available": True, "installed": False, "downloading": True, "percent": 0, "downloaded_mb": 0.0, "total_mb": 29.0, "size_hint_mb": 29, "disk_mb": 0.0})

    client = TestClient(app)
    r_dl = client.post("/api/settings/addons/mediapipe/download")
    assert r_dl.status_code == 200
    assert r_dl.json()["addon"]["downloading"] is True

    # Locally deleting cuda add-on must still be allowed even when _cuda_count() is 0
    monkeypatch.setattr(addons.sys, "platform", "win32")
    monkeypatch.setattr(addons, "_cuda_count", lambda: 0)
    r_del = client.delete("/api/settings/addons/cuda")
    assert r_del.status_code == 200

    # Cloud mode with unmounted Drive: GET /api/settings/addons must never invoke get_app_data_dir()
    monkeypatch.setenv("AUTO_CLIPPER_CLOUD_MODE", "1")
    monkeypatch.setenv("AUTO_CLIPPER_WEB_TOKEN", "tok")
    monkeypatch.setattr(addons, "colab_mediapipe_dir", lambda: str(tmp_path / "no_colab_mp"))
    monkeypatch.setitem(sys.modules, "mediapipe", types.SimpleNamespace())
    monkeypatch.setattr(addons, "get_app_data_dir", lambda: (_ for _ in ()).throw(AppError("DRIVE_NOT_MOUNTED")))
    r_cloud = client.get("/api/settings/addons", headers={"Authorization": "Bearer tok"})
    assert r_cloud.status_code == 200
    assert r_cloud.json()["addons"]["mediapipe"]["installed"] is False


def test_mediapipe_addon_install_import_and_remove(tmp_path, monkeypatch):
    monkeypatch.setattr(addons, "get_app_data_dir", lambda: str(tmp_path))
    monkeypatch.delenv("AUTO_CLIPPER_CLOUD_MODE", raising=False)
    monkeypatch.setattr(addons, "_mediapipe_platform_key", lambda: "win_amd64")

    mp_whl, mp_sha = _make_wheel({
        "mediapipe/__init__.py": b"__version__ = '1.2.3'\n",
        "mediapipe/tasks/c/libmediapipe.dll": b"mp",
        "matplotlib/pyplot.py": b"skip-me",
    })
    fb_whl, fb_sha = _make_wheel({"flatbuffers/__init__.py": b"ok\n"})
    ab_whl, ab_sha = _make_wheel({"absl/__init__.py": b"ok\n"})
    task_bytes = b"tflite-model"
    task_sha = hashlib.sha256(task_bytes).hexdigest()

    mp_entry = dict(addons.PINNED_ADDONS["mediapipe"]["wheels"]["win_amd64"], sha256=mp_sha, size=len(mp_whl))
    monkeypatch.setitem(addons.PINNED_ADDONS["mediapipe"]["wheels"], "win_amd64", mp_entry)
    monkeypatch.setitem(addons.PINNED_ADDONS["mediapipe"], "common", [
        {"name": "flatbuffers", "kind": "wheel", "prefixes": ("flatbuffers/",), "url": "https://files.pythonhosted.org/fb.whl", "size": len(fb_whl), "sha256": fb_sha},
        {"name": "absl-py", "kind": "wheel", "prefixes": ("absl/",), "url": "https://files.pythonhosted.org/ab.whl", "size": len(ab_whl), "sha256": ab_sha},
        {"name": "face_landmarker.task", "kind": "file", "filename": "face_landmarker.task", "url": "https://storage.googleapis.com/mediapipe-models/face_landmarker.task", "size": len(task_bytes), "sha256": task_sha},
    ])

    payloads = {
        mp_entry["url"]: mp_whl,
        "https://files.pythonhosted.org/fb.whl": fb_whl,
        "https://files.pythonhosted.org/ab.whl": ab_whl,
        "https://storage.googleapis.com/mediapipe-models/face_landmarker.task": task_bytes,
    }
    monkeypatch.setattr(
        addons, "_download_file",
        lambda url, dest, cb: (dest.write_bytes(payloads[url]), cb(len(payloads[url]), len(payloads[url]))),
    )

    addons.install_addon_sync("mediapipe")
    assert addons.is_addon_installed("mediapipe") is True
    assert not (tmp_path / "addons" / "mediapipe" / "matplotlib").exists()
    task_path = tmp_path / "addons" / "mediapipe" / "face_landmarker.task"
    assert task_path.read_bytes() == task_bytes

    monkeypatch.setattr(sys, "path", list(sys.path))
    monkeypatch.delitem(sys.modules, "matplotlib", raising=False)
    monkeypatch.delitem(sys.modules, "matplotlib.pyplot", raising=False)
    monkeypatch.delitem(sys.modules, "sounddevice", raising=False)

    assert addons.ensure_mediapipe_importable() == str(task_path)
    assert str(tmp_path / "addons" / "mediapipe") in sys.path
    assert "matplotlib.pyplot" in sys.modules
    assert "sounddevice" in sys.modules

    addons.remove_addon("mediapipe")
    assert addons.is_addon_installed("mediapipe") is False


def test_addons_endpoints_validate_id_cloud_mode_macos_intel_and_auth(tmp_path, monkeypatch):
    monkeypatch.setattr(addons, "get_app_data_dir", lambda: str(tmp_path))
    monkeypatch.delenv("AUTO_CLIPPER_CLOUD_MODE", raising=False)
    monkeypatch.setattr(web_ui, "is_web_mode", lambda: False)

    client = TestClient(app)
    r_get = client.get("/api/settings/addons")
    assert r_get.status_code == 200
    assert set(r_get.json()["addons"]) == {"cuda", "mediapipe"}
    assert client.post("/api/settings/addons/unknown/download").status_code == 404
    assert client.delete("/api/settings/addons/unknown").status_code == 404

    monkeypatch.setattr(addons, "_mediapipe_platform_key", lambda: None)
    assert client.get("/api/settings/addons").json()["addons"]["mediapipe"]["available"] is False
    assert client.post("/api/settings/addons/mediapipe/download").status_code == 400

    monkeypatch.setattr(addons, "_mediapipe_platform_key", lambda: "win_amd64")
    monkeypatch.setenv("AUTO_CLIPPER_CLOUD_MODE", "1")
    monkeypatch.setenv("AUTO_CLIPPER_WEB_TOKEN", "tok")
    monkeypatch.setattr(addons, "colab_mediapipe_dir", lambda: str(tmp_path / "no_colab_mp"))
    monkeypatch.setitem(sys.modules, "mediapipe", types.SimpleNamespace())
    assert client.get("/api/settings/addons").status_code == 401
    assert client.get("/api/settings/addons", headers={"Authorization": "Bearer tok"}).json()["addons"]["mediapipe"]["available"] is False
    assert client.post("/api/settings/addons/mediapipe/download", headers={"Authorization": "Bearer tok"}).status_code == 400
    assert client.delete("/api/settings/addons/mediapipe", headers={"Authorization": "Bearer tok"}).status_code == 400


def test_install_colab_mediapipe_uses_pinned_linux_wheel_and_is_idempotent(tmp_path, monkeypatch):
    import json
    monkeypatch.setattr(addons, "get_app_data_dir", lambda: (_ for _ in ()).throw(AssertionError("must not read app_data_dir")))

    mp_whl, mp_sha = _make_wheel({"mediapipe/__init__.py": b"__version__ = '1.2.3'\n", "matplotlib/pyplot.py": b"skip\n"})
    fb_whl, fb_sha = _make_wheel({"flatbuffers/__init__.py": b"ok\n"})
    ab_whl, ab_sha = _make_wheel({"absl/__init__.py": b"ok\n"})
    task_bytes = b"tflite-colab"
    task_sha = hashlib.sha256(task_bytes).hexdigest()

    mp_entry = dict(addons.PINNED_ADDONS["mediapipe"]["wheels"]["linux_x86_64"], sha256=mp_sha, size=len(mp_whl))
    monkeypatch.setitem(addons.PINNED_ADDONS["mediapipe"]["wheels"], "linux_x86_64", mp_entry)
    monkeypatch.setitem(addons.PINNED_ADDONS["mediapipe"], "common", [
        {"name": "flatbuffers", "kind": "wheel", "prefixes": ("flatbuffers/",), "url": "https://files.pythonhosted.org/fb.whl", "size": len(fb_whl), "sha256": fb_sha},
        {"name": "absl-py", "kind": "wheel", "prefixes": ("absl/",), "url": "https://files.pythonhosted.org/ab.whl", "size": len(ab_whl), "sha256": ab_sha},
        {"name": "face_landmarker.task", "kind": "file", "filename": "face_landmarker.task", "url": "https://storage.googleapis.com/mediapipe-models/face_landmarker.task", "size": len(task_bytes), "sha256": task_sha},
    ])
    payloads = {
        mp_entry["url"]: mp_whl,
        "https://files.pythonhosted.org/fb.whl": fb_whl,
        "https://files.pythonhosted.org/ab.whl": ab_whl,
        "https://storage.googleapis.com/mediapipe-models/face_landmarker.task": task_bytes,
    }
    downloads = []
    monkeypatch.setattr(
        addons, "_download_file",
        lambda url, dest, cb: (downloads.append(url), dest.write_bytes(payloads[url]), cb(len(payloads[url]), len(payloads[url]))),
    )

    target = tmp_path / "mediapipe_colab"
    ver = addons.install_colab_mediapipe(str(target))
    assert ver == "1.2.3"
    assert (target / "mediapipe" / "__init__.py").is_file()
    assert (target / "flatbuffers" / "__init__.py").is_file()
    assert (target / "absl" / "__init__.py").is_file()
    assert not (target / "matplotlib").exists()
    assert (target / "face_landmarker.task").read_bytes() == task_bytes
    assert json.loads((target / "manifest.json").read_text(encoding="utf-8"))["version"] == "1.2.3"
    assert len(downloads) == 4

    # Calling a second time is a no-op when already installed cleanly.
    addons.install_colab_mediapipe(str(target))
    assert len(downloads) == 4


def test_cloud_mode_treats_colab_mediapipe_as_available_and_keeps_endpoints_blocked(tmp_path, monkeypatch):
    monkeypatch.setenv("AUTO_CLIPPER_CLOUD_MODE", "1")
    monkeypatch.setenv("AUTO_CLIPPER_WEB_TOKEN", "tok")
    monkeypatch.setattr(addons, "get_app_data_dir", lambda: (_ for _ in ()).throw(AssertionError("must not read app_data_dir")))

    colab_dir = tmp_path / "mediapipe_colab"
    (colab_dir / "mediapipe").mkdir(parents=True)
    (colab_dir / "mediapipe" / "__init__.py").write_text("__version__ = '1.2.3'\n", encoding="utf-8")
    (colab_dir / "face_landmarker.task").write_bytes(b"tflite")
    monkeypatch.setattr(addons, "colab_mediapipe_dir", lambda: str(colab_dir))
    monkeypatch.setattr(sys, "path", list(sys.path))
    monkeypatch.delitem(sys.modules, "mediapipe", raising=False)
    monkeypatch.delitem(sys.modules, "matplotlib", raising=False)
    monkeypatch.delitem(sys.modules, "matplotlib.pyplot", raising=False)
    monkeypatch.delitem(sys.modules, "sounddevice", raising=False)

    # Cloud GET /api/settings/addons must succeed even when Drive is not mounted (never calls get_app_data_dir)
    # and without mutating sys.path before ensure_mediapipe_importable().
    assert str(colab_dir) not in sys.path
    client = TestClient(app)
    r_status = client.get("/api/settings/addons", headers={"Authorization": "Bearer tok"})
    assert r_status.status_code == 200
    mp_status = r_status.json()["addons"]["mediapipe"]
    assert mp_status["available"] is True
    assert mp_status["installed"] is True
    assert mp_status["disk_mb"] >= 0.0
    assert addons.is_addon_installed("mediapipe") is True
    assert addons.is_addon_available("mediapipe") is True
    assert addons.is_addon_available("cuda") is False

    # Partial matplotlib in sys.modules (missing matplotlib.pyplot) must still stub cleanly.
    monkeypatch.setitem(sys.modules, "matplotlib", types.ModuleType("matplotlib"))
    monkeypatch.setattr(addons.importlib if hasattr(addons, "importlib") else __import__("importlib"), "import_module", lambda n: (_ for _ in ()).throw(RuntimeError("partial matplotlib")))
    assert addons.ensure_mediapipe_importable() == str(colab_dir / "face_landmarker.task")
    assert "matplotlib.pyplot" in sys.modules

    # Cloud endpoints never allow downloading or deleting via the Settings API.
    assert client.post("/api/settings/addons/mediapipe/download", headers={"Authorization": "Bearer tok"}).status_code == 400
    assert client.delete("/api/settings/addons/mediapipe", headers={"Authorization": "Bearer tok"}).status_code == 400
