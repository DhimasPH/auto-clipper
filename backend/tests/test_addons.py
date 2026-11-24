import hashlib
import io
import os
import sys
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


def test_cuda_addon_install_verifies_pinned_sha256_and_extracts_only_dlls(tmp_path, monkeypatch):
    monkeypatch.setattr(addons, "get_app_data_dir", lambda: str(tmp_path))
    monkeypatch.delenv("AUTO_CLIPPER_CLOUD_MODE", raising=False)
    monkeypatch.setattr(addons.sys, "platform", "win32")
    monkeypatch.setattr(addons, "_cuda_count", lambda: 1)

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
    assert (tmp_path / "addons" / "cuda" / "bin" / "cublas64_12.dll").read_bytes() == b"cublas-dll"
    assert (tmp_path / "addons" / "cuda" / "bin" / "cublasLt64_12.dll").read_bytes() == b"cublasLt-dll"
    assert not (tmp_path / "addons" / "cuda" / "bin" / "cublas.h").exists()


def test_addon_install_rejects_sha256_mismatch_and_cleans_part(tmp_path, monkeypatch):
    monkeypatch.setattr(addons, "get_app_data_dir", lambda: str(tmp_path))
    monkeypatch.delenv("AUTO_CLIPPER_CLOUD_MODE", raising=False)
    monkeypatch.setattr(addons.sys, "platform", "win32")
    monkeypatch.setattr(addons, "_cuda_count", lambda: 1)

    monkeypatch.setattr(
        addons, "_download_file",
        lambda url, dest, cb: dest.write_bytes(b"corrupted"),
    )
    with pytest.raises(ValueError, match="SHA-256"):
        addons.install_addon_sync("cuda")

    assert addons.is_addon_installed("cuda") is False
    addons_dir = tmp_path / "addons"
    if addons_dir.exists():
        assert [p for p in addons_dir.iterdir() if ".part" in p.name] == []


def test_activate_installed_registers_dll_dir_path_and_preloads_cublas(tmp_path, monkeypatch):
    monkeypatch.setattr(addons, "get_app_data_dir", lambda: str(tmp_path))
    monkeypatch.setattr(addons.sys, "platform", "win32")

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

    assert added_dirs == [str(cuda_bin)]
    assert os.environ["PATH"].startswith(str(cuda_bin) + os.pathsep)
    assert loaded_dlls == [str(cuda_bin / "cublasLt64_12.dll"), str(cuda_bin / "cublas64_12.dll")]


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
    assert client.get("/api/settings/addons").status_code == 401
    assert client.get("/api/settings/addons", headers={"Authorization": "Bearer tok"}).json()["addons"]["mediapipe"]["available"] is False
    assert client.post("/api/settings/addons/mediapipe/download", headers={"Authorization": "Bearer tok"}).status_code == 400
    assert client.delete("/api/settings/addons/mediapipe", headers={"Authorization": "Bearer tok"}).status_code == 400
