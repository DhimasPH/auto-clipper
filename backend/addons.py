"""Pinned optional runtime add-ons stored under ``<app_data_dir>/addons/``.

Keeping heavy/platform-specific native binaries (Windows ``cuda`` cuBLAS for
GPU subtitles, and ``mediapipe`` Tasks for precise face tracking) out of the
base PyInstaller bundle keeps the app ~260 MB lighter while letting users
install them in one click without Python or ``pip``.

Every download uses an allowlisted HTTPS URL, exact byte size, and lowercase
hex SHA-256 digest locked in ``PINNED_ADDONS`` (never PyPI's floating latest).
"""
import ctypes
import hashlib
import json
import os
import platform as _platform
import shutil
import sys
import threading
import uuid
import zipfile
from pathlib import Path
from typing import Callable, Optional
from urllib.parse import urlparse

from backend.logger import get_app_data_dir, log_app, log_error

ADDON_IDS = ("cuda", "mediapipe")
ALLOWED_HOSTS = frozenset({"pypi.org", "files.pythonhosted.org", "storage.googleapis.com"})
_MANIFEST_FILE = "manifest.json"

PINNED_ADDONS = {
    "cuda": {
        "win_amd64": {
            "package": "nvidia-cublas-cu12",
            "version": "12.9.2.10",
            "url": "https://files.pythonhosted.org/packages/20/e2/fc9a0e985249d873150276d5afb02e39a66817fedbf1a385724393e505ed/nvidia_cublas_cu12-12.9.2.10-py3-none-win_amd64.whl",
            "size": 553162896,
            "sha256": "623f43027d40d44ceadf0043f002bd25cf353e8f13ce90b9a87057019f560661",
            "dlls": ("cublasLt64_12.dll", "cublas64_12.dll"),
        },
    },
    "mediapipe": {
        "wheels": {
            "win_amd64": {
                "package": "mediapipe",
                "version": "1.2.3",
                "url": "https://files.pythonhosted.org/packages/a8/b8/e1b66b6adc856a2af7b995d69ddebee73a0368b95f1f2361aed2cd6f9748/mediapipe-1.2.3-py3-none-win_amd64.whl",
                "size": 25678743,
                "sha256": "2e2ebc8ae2c11ae032753bc3cafad5142ef0b755448509122bc6c1442bd19676",
            },
            "win_arm64": {
                "package": "mediapipe",
                "version": "1.2.3",
                "url": "https://files.pythonhosted.org/packages/41/d0/5424adc1594d4951102c460fa9e71f714ba9b4ce38c49f10db39da8f3131/mediapipe-1.2.3-py3-none-win_arm64.whl",
                "size": 22307061,
                "sha256": "9b3871f1faeb6eb69c28675ea78cff7e45bb6dd2dc72b0d3d07ee06f73144976",
            },
            "macosx_arm64": {
                "package": "mediapipe",
                "version": "1.2.3",
                "url": "https://files.pythonhosted.org/packages/8a/31/5dcba256f3d7c02cabc834628006aa36c7b36752f1df18082e3dae6229fa/mediapipe-1.2.3-py3-none-macosx_11_0_arm64.whl",
                "size": 38679054,
                "sha256": "077ef409d79ef274b076d47a744018af5f7487c09a1d237e9d2f707d33e39867",
            },
            "linux_x86_64": {
                "package": "mediapipe",
                "version": "1.2.3",
                "url": "https://files.pythonhosted.org/packages/31/2a/5217e7c5d9984f71fedcc6b33862f6141178ac598d06b0d4b81ea647b9fc/mediapipe-1.2.3-py3-none-manylinux_2_28_x86_64.whl",
                "size": 43342798,
                "sha256": "1fcda646cc7b96f73453acc416ce31d0fba287d0f1fc095865272a7ea6986497",
            },
            "linux_aarch64": {
                "package": "mediapipe",
                "version": "1.2.3",
                "url": "https://files.pythonhosted.org/packages/bf/ec/d29126f33b5c8de9b4ad70b2cf17d06853f3d9c13d8228a1e4c1887e630e/mediapipe-1.2.3-py3-none-manylinux_2_28_aarch64.whl",
                "size": 40704840,
                "sha256": "59d55f6395efbda2a053a8db18f598277e63c264f9a6f65a819c23d92b90fed8",
            },
        },
        "common": [
            {
                "name": "flatbuffers",
                "kind": "wheel",
                "prefixes": ("flatbuffers/",),
                "url": "https://files.pythonhosted.org/packages/e8/2d/d2a548598be01649e2d46231d151a6c56d10b964d94043a335ae56ea2d92/flatbuffers-25.12.19-py2.py3-none-any.whl",
                "size": 26661,
                "sha256": "7634f50c427838bb021c2d66a3d1168e9d199b0607e6329399f04846d42e20b4",
            },
            {
                "name": "absl-py",
                "kind": "wheel",
                "prefixes": ("absl/",),
                "url": "https://files.pythonhosted.org/packages/b3/7d/01e62f59e4166af1be6238d9f2b7f3453630c51b8044b412d05b5606532a/absl_py-2.5.1-py3-none-any.whl",
                "size": 137673,
                "sha256": "721200f2f0e9960f2ca9dc3a2a706b201f5f75d812c158f059cbbe29eeafbdb8",
            },
            {
                "name": "face_landmarker.task",
                "kind": "file",
                "filename": "face_landmarker.task",
                "url": "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
                "size": 3758596,
                "sha256": "64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff",
            },
        ],
    },
}

_state_lock = threading.Lock()
_download_state: dict[str, dict] = {}
_dll_handles: list = []


def _is_cloud_mode() -> bool:
    return bool(os.environ.get("AUTO_CLIPPER_CLOUD_MODE"))


def _cuda_count() -> int:
    try:
        import ctranslate2
        return int(ctranslate2.get_cuda_device_count())
    except Exception:
        return 0


def _mediapipe_platform_key() -> Optional[str]:
    mach = _platform.machine().lower()
    if sys.platform == "win32":
        return "win_arm64" if ("arm64" in mach or "aarch64" in mach) else "win_amd64"
    if sys.platform == "darwin":
        return "macosx_arm64" if ("arm64" in mach or "aarch64" in mach) else None
    if sys.platform.startswith("linux"):
        return "linux_aarch64" if ("aarch64" in mach or "arm64" in mach) else "linux_x86_64"
    return None


def addons_root() -> str:
    return os.path.join(get_app_data_dir(), "addons")


def addon_dir(addon_id: str) -> str:
    if addon_id not in ADDON_IDS:
        raise KeyError(addon_id)
    return os.path.join(addons_root(), addon_id)


def is_addon_available(addon_id: str) -> bool:
    if addon_id not in ADDON_IDS:
        raise KeyError(addon_id)
    if _is_cloud_mode():
        return False
    if addon_id == "cuda":
        return sys.platform == "win32" and _cuda_count() >= 1
    return _mediapipe_platform_key() is not None


def is_addon_installed(addon_id: str) -> bool:
    root = Path(addon_dir(addon_id))
    if not (root / _MANIFEST_FILE).is_file():
        return False
    if addon_id == "cuda":
        return all((root / "bin" / dll).is_file() for dll in PINNED_ADDONS["cuda"]["win_amd64"]["dlls"])
    return (root / "mediapipe").is_dir() and (root / "face_landmarker.task").is_file()


def _dir_size_mb(path: Path) -> float:
    if not path.exists():
        return 0.0
    total = sum(p.stat().st_size for p in path.rglob("*") if p.is_file())
    return round(total / (1024 * 1024), 1)


def _size_hint_mb(addon_id: str) -> int:
    if addon_id == "cuda":
        return round(PINNED_ADDONS["cuda"]["win_amd64"]["size"] / (1024 * 1024))
    key = _mediapipe_platform_key() or "win_amd64"
    mp_bytes = PINNED_ADDONS["mediapipe"]["wheels"][key]["size"]
    common_bytes = sum(item["size"] for item in PINNED_ADDONS["mediapipe"]["common"])
    return round((mp_bytes + common_bytes) / (1024 * 1024))


def _validate_url(url: str) -> None:
    parsed = urlparse(url)
    if parsed.scheme != "https" or (parsed.hostname or "").lower() not in ALLOWED_HOSTS:
        raise ValueError(f"Disallowed add-on source URL: {url}")


def _download_file(url: str, dest: Path, progress_cb: Callable[[int, int], None]) -> None:
    import requests
    _validate_url(url)
    with requests.get(url, stream=True, timeout=60) as resp:
        resp.raise_for_status()
        total = int(resp.headers.get("content-length") or 0)
        got = 0
        with open(dest, "wb") as f:
            for chunk in resp.iter_content(chunk_size=262144):
                if not chunk:
                    continue
                f.write(chunk)
                got += len(chunk)
                progress_cb(got, total)


def _verify_sha256(path: Path, expected_sha256: str) -> None:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while True:
            chunk = f.read(262144)
            if not chunk:
                break
            h.update(chunk)
    actual = h.hexdigest().lower()
    if actual != expected_sha256.lower():
        raise ValueError(f"SHA-256 mismatch for {path.name}: expected {expected_sha256}, got {actual}")


def _download_error_info(exc: Exception) -> dict:
    return {
        "code": "ADDON_DOWNLOAD_FAILED",
        "title": "Gagal memasang komponen tambahan",
        "message": "Unduhan komponen berhenti atau file tidak lengkap. Periksa koneksi internet dan ruang penyimpanan, lalu coba lagi.",
        "title_en": "Could not install add-on component",
        "message_en": "The component download stopped or the file was incomplete. Check your internet connection and storage space, then try again.",
        "actions": [],
        "technical": str(exc) or type(exc).__name__,
    }


def _set_progress(addon_id: str, downloaded_bytes: int, total_bytes: int) -> None:
    pct = min(99, int((downloaded_bytes / total_bytes) * 100)) if total_bytes > 0 else 0
    with _state_lock:
        st = _download_state.setdefault(addon_id, {})
        st.update({
            "downloading": True,
            "percent": pct,
            "downloaded_mb": round(downloaded_bytes / (1024 * 1024), 1),
            "total_mb": round(total_bytes / (1024 * 1024), 1),
            "error_info": None,
        })


def _install_cuda(staging: Path, cache_dir: Path) -> str:
    spec = PINNED_ADDONS["cuda"]["win_amd64"]
    whl_path = cache_dir / "cuda.whl"
    _download_file(spec["url"], whl_path, lambda got, _tot: _set_progress("cuda", got, spec["size"]))
    _verify_sha256(whl_path, spec["sha256"])

    bin_dir = staging / "bin"
    bin_dir.mkdir(parents=True, exist_ok=True)
    wanted = set(spec["dlls"])
    extracted = set()
    with zipfile.ZipFile(whl_path) as zf:
        for member in zf.namelist():
            base = os.path.basename(member)
            if base in wanted and not member.endswith("/"):
                with zf.open(member) as src, open(bin_dir / base, "wb") as dst:
                    shutil.copyfileobj(src, dst)
                extracted.add(base)
    if extracted != wanted:
        raise ValueError(f"Expected DLLs {sorted(wanted)} missing from wheel; found {sorted(extracted)}")
    return spec["version"]


def _extract_prefixes(whl_path: Path, staging: Path, prefixes: tuple[str, ...]) -> None:
    with zipfile.ZipFile(whl_path) as zf:
        for member in zf.namelist():
            if member.endswith("/") or not member.startswith(prefixes):
                continue
            target = (staging / member).resolve()
            if not str(target).startswith(str(staging.resolve())):
                raise ValueError(f"Unsafe zip member: {member}")
            target.parent.mkdir(parents=True, exist_ok=True)
            with zf.open(member) as src, open(target, "wb") as dst:
                shutil.copyfileobj(src, dst)


def _install_mediapipe(staging: Path, cache_dir: Path) -> str:
    key = _mediapipe_platform_key()
    if not key:
        raise RuntimeError("No mediapipe add-on build exists for this processor architecture.")
    mp_spec = PINNED_ADDONS["mediapipe"]["wheels"][key]
    common = PINNED_ADDONS["mediapipe"]["common"]
    total_all = mp_spec["size"] + sum(item["size"] for item in common)
    completed_bytes = 0

    def report_bytes(cur: int, _tot: int) -> None:
        _set_progress("mediapipe", completed_bytes + cur, total_all)

    mp_whl = cache_dir / "mediapipe.whl"
    _download_file(mp_spec["url"], mp_whl, report_bytes)
    _verify_sha256(mp_whl, mp_spec["sha256"])
    _extract_prefixes(mp_whl, staging, ("mediapipe/",))
    completed_bytes += mp_spec["size"]

    for idx, item in enumerate(common):
        dl_path = cache_dir / f"item_{idx}_{item['name']}"
        _download_file(item["url"], dl_path, report_bytes)
        _verify_sha256(dl_path, item["sha256"])
        if item["kind"] == "wheel":
            _extract_prefixes(dl_path, staging, item["prefixes"])
        else:
            shutil.copyfile(dl_path, staging / item["filename"])
        completed_bytes += item["size"]
    return mp_spec["version"]


def install_addon_sync(addon_id: str) -> dict:
    """Download, verify SHA-256, and atomically install ``addon_id``."""
    if not is_addon_available(addon_id):
        raise RuntimeError(f"Add-on '{addon_id}' is not available on this platform.")
    root = Path(addons_root())
    root.mkdir(parents=True, exist_ok=True)
    token = uuid.uuid4().hex[:8]
    staging = root / f".{addon_id}.{token}.part"
    cache_dir = root / f".{addon_id}.{token}.dl.part"
    staging.mkdir(parents=True, exist_ok=True)
    cache_dir.mkdir(parents=True, exist_ok=True)

    _set_progress(addon_id, 0, _size_hint_mb(addon_id) * 1024 * 1024)
    try:
        version = _install_cuda(staging, cache_dir) if addon_id == "cuda" else _install_mediapipe(staging, cache_dir)
        manifest = {"id": addon_id, "version": version}
        (staging / _MANIFEST_FILE).write_text(json.dumps(manifest), encoding="utf-8")

        final_dir = Path(addon_dir(addon_id))
        backup_dir = root / f".{addon_id}.{token}.old.part"
        if final_dir.exists():
            os.replace(final_dir, backup_dir)
        os.replace(staging, final_dir)
        if backup_dir.exists():
            shutil.rmtree(backup_dir, ignore_errors=True)

        activate_installed()
        with _state_lock:
            _download_state[addon_id] = {"downloading": False, "percent": 100, "downloaded_mb": 0.0, "total_mb": 0.0, "error_info": None}
        log_app(f"Add-on '{addon_id}' ({version}) installed cleanly")
        return get_addon_status(addon_id)
    except Exception as exc:
        log_error(f"addons.install.{addon_id}", exc)
        with _state_lock:
            _download_state[addon_id] = {
                "downloading": False, "percent": 0, "downloaded_mb": 0.0, "total_mb": 0.0,
                "error_info": _download_error_info(exc),
            }
        raise
    finally:
        shutil.rmtree(staging, ignore_errors=True)
        shutil.rmtree(cache_dir, ignore_errors=True)


def start_addon_download(addon_id: str) -> dict:
    if not is_addon_available(addon_id):
        raise RuntimeError(f"Add-on '{addon_id}' is not available on this platform.")
    with _state_lock:
        current = _download_state.get(addon_id, {})
        if current.get("downloading"):
            return get_addon_status(addon_id)
        _download_state[addon_id] = {"downloading": True, "percent": 0, "downloaded_mb": 0.0, "total_mb": float(_size_hint_mb(addon_id)), "error_info": None}

    def _worker():
        try:
            install_addon_sync(addon_id)
        except Exception:
            pass  # recorded in _download_state and logged by install_addon_sync

    threading.Thread(target=_worker, daemon=True).start()
    return get_addon_status(addon_id)


def remove_addon(addon_id: str) -> dict:
    if addon_id not in ADDON_IDS:
        raise KeyError(addon_id)
    target = Path(addon_dir(addon_id))
    if target.exists():
        shutil.rmtree(target, ignore_errors=True)
    with _state_lock:
        _download_state[addon_id] = {"downloading": False, "percent": 0, "downloaded_mb": 0.0, "total_mb": 0.0, "error_info": None}
    return get_addon_status(addon_id)


def get_addon_status(addon_id: str) -> dict:
    if addon_id not in ADDON_IDS:
        raise KeyError(addon_id)
    with _state_lock:
        state = dict(_download_state.get(addon_id, {}))
    installed = is_addon_installed(addon_id)
    disk_mb = _dir_size_mb(Path(addon_dir(addon_id))) if installed else 0.0
    out = {
        "id": addon_id,
        "available": is_addon_available(addon_id),
        "installed": installed,
        "downloading": bool(state.get("downloading", False)),
        "percent": int(state.get("percent", 100 if installed else 0)),
        "downloaded_mb": float(state.get("downloaded_mb", 0.0)),
        "total_mb": float(state.get("total_mb", 0.0)),
        "size_hint_mb": _size_hint_mb(addon_id),
        "disk_mb": disk_mb,
    }
    if state.get("error_info"):
        out["error_info"] = state["error_info"]
    return out


def get_addon_statuses() -> dict[str, dict]:
    return {aid: get_addon_status(aid) for aid in ADDON_IDS}


def activate_installed() -> None:
    """Register installed runtime DLL add-ons (Windows cuBLAS for Whisper GPU)."""
    if sys.platform != "win32" or _is_cloud_mode():
        return
    if not is_addon_installed("cuda"):
        return
    cuda_bin = os.path.join(addon_dir("cuda"), "bin")
    if hasattr(os, "add_dll_directory"):
        try:
            _dll_handles.append(os.add_dll_directory(cuda_bin))
        except Exception as e:
            log_error("addons.add_dll_directory", e)
    cur_path = os.environ.get("PATH", "")
    if cuda_bin not in cur_path.split(os.pathsep):
        os.environ["PATH"] = cuda_bin + os.pathsep + cur_path
    for dll in PINNED_ADDONS["cuda"]["win_amd64"]["dlls"]:
        dll_path = os.path.join(cuda_bin, dll)
        if os.path.isfile(dll_path):
            try:
                ctypes.WinDLL(dll_path)
            except OSError as e:
                log_error(f"addons.preload.{dll}", e)


def ensure_mediapipe_importable() -> Optional[str]:
    """Attach the installed mediapipe add-on folder and stubs to ``sys.path``."""
    import types

    if _is_cloud_mode() or not is_addon_installed("mediapipe"):
        return None
    mp_root = addon_dir("mediapipe")
    if mp_root not in sys.path:
        sys.path.insert(0, mp_root)

    # mediapipe.tasks.python.vision.__init__ eagerly imports matplotlib.pyplot for
    # drawing helpers that Auto Clipper never uses; stub them when matplotlib is omitted.
    if "matplotlib" not in sys.modules:
        try:
            import importlib
            importlib.import_module("matplotlib.pyplot")
        except ImportError:
            mpl = types.ModuleType("matplotlib")
            mpl_plt = types.ModuleType("matplotlib.pyplot")
            mpl.pyplot = mpl_plt
            sys.modules["matplotlib"] = mpl
            sys.modules["matplotlib.pyplot"] = mpl_plt
    if "sounddevice" not in sys.modules:
        try:
            import importlib
            importlib.import_module("sounddevice")
        except ImportError:
            sys.modules["sounddevice"] = types.ModuleType("sounddevice")

    task_path = os.path.join(mp_root, "face_landmarker.task")
    return task_path if os.path.isfile(task_path) else None
