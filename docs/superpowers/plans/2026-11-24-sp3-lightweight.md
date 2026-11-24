# SP3 Lightweight App, Optional Add-ons, and Output Folder Security Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cut ~260 MB from the core desktop and Auto Clipper Web bundle by removing `mediapipe` and its transitive dependencies from the base build, speed up sidecar startup/idle RAM via lazy imports, add an atomic PyPI/official-model add-on downloader (`cuda` cuBLAS for Windows NVIDIA subtitles and `mediapipe` Tasks `FaceLandmarker` for precise face tracking) in Pengaturan, add a CPU Whisper confirmation dialog before starting `medium`/`large-v3` without GPU, and close `output_dir` security (`T1.y`) while enabling `/video` and `/save_file` for valid custom Desktop output folders.

**Architecture:** The backend splits optional heavy native runtimes (`cuda` DLLs on Windows, `mediapipe` wheel + `face_landmarker.task` on desktop/local-web) into `<app_data_dir>/addons/<id>` managed by a new `backend/addons.py` module, while `video_utils`, `ai_utils`, and `crop_utils` defer heavy imports (`yt_dlp`, `openai`, `google.genai`, `cv2`, `numpy`) until execution so `main`, `preflight`, and `jobs` start fast with minimal RSS. On the frontend, `TranscriptionSection` and a new `FaceTrackingSection` drive `GET/POST/DELETE /api/settings/addons` and surface CPU model guidance, while `CreatePage` prompts users once with a plain-language `Dialog` before running `medium`/`large-v3` on CPU.

**Tech Stack:** Python 3.11+, FastAPI, PyInstaller (`--onefile` Windows / `--onedir` macOS), ctypes, zipfile/hashlib, pytest; React 19, TypeScript 6, Vite 8, Tailwind 3, i18next, Vitest, oxlint.

**Spec:** `docs/superpowers/specs/2026-11-24-sp3-lightweight-design.md` (binding). Parent: `docs/superpowers/specs/2026-11-12-enhancement-roadmap.md`.

## Global Constraints

Repo and process:
- Stay on the working branch requested by the owner (`feat/sp3-lightweight` or active branch); never push, open a PR, or merge without the owner's explicit request.
- Every commit message ends with `Co-Authored-By: <Agent Name> <noreply@anthropic.com>`.
- Python tests always use the project venv (never `python` on PATH): `C:\Users\dhima\projects\ac-venv\Scripts\python.exe -m pytest backend/tests -q -p no:cacheprovider`. Current baseline: **860 passed, 6 skipped**.
- Frontend checks run from `C:\Users\dhima\projects\auto-clipper` (uppercase `C:` drive letter so Vitest does not double-load): `npm test` (baseline **424 passed** across 64 files), `npm run lint` (`0` errors), `npm run build`, `npm run build:cloud`.
- No Rust toolchain on this machine (`npm run tauri build` runs in CI PR Check); desktop behaviors are verified with unit tests and mocked platform/Tauri tests.
- Append a 3–6 line entry to `tasks/PROGRESS-LOG.md` under `## 2026-11-24 · SP3` and record Task status / Rulings in `tasks/sp3-ledger.md` inside every task commit.

Backend invariants (`.agents/AGENTS.md` A, B, E):
- **NEVER `print()` to stdout** in any backend module (Tauri handshake relies on strict stdout); use `log_error(context, err)` / `log_app(msg)`.
- `backend.metadata` stays in `backend.spec` `hiddenimports`; Windows keeps `--onefile`, macOS keeps `--onedir`.
- Every endpoint taking file paths from requests calls `path_guard.is_protected()` first and responds with `path_guard.denied()` (403 `Access denied`).
- Add-on downloads write to `.part` temp directories, validate SHA-256 against PyPI metadata before `os.replace`, and only fetch from allowlisted hosts (`pypi.org`, `files.pythonhosted.org`, `storage.googleapis.com`).
- Cloud mode (`AUTO_CLIPPER_CLOUD_MODE`) disables add-on downloads (`available: false`) and ignores client-supplied `output_dir`. Local web mode (`web_ui.is_web_mode()`) ignores client-supplied `output_dir`.

Frontend & copy invariants (`.agents/AGENTS.md` F, SP2 4.6):
- Every UI string lives in both `src/locales/id.json` and `src/locales/en.json` added via `node scripts/add-locale-keys.mjs`; `locales.test.ts`, `plainWords.test.ts` (no banned words `transkripsi`, `transcription`, `render`, `encoder`, `json`, `sidecar`, `token`, `prompt`, `backend`, `ffmpeg`, `nvenc`, `cuda`, `whisper`, no emoji, no `—` in main-screen namespaces or `preflight.py` titles/messages), and `contrast.test.ts` MUST pass.
- Components inspect `platform().caps`, never `platform().kind`; dialogs use `src/components/ui/Dialog.tsx`.
- Every backend URL uses `API_URL` from `src/platform/backendUrl.ts`.

---

## File Structure

Created:
- `backend/addons.py`: manages optional runtime add-ons (`cuda`, `mediapipe`) in `<app_data_dir>/addons/`, atomic HTTPS wheel/model installation with SHA-256 verification, status reporting, removal, and runtime activation (`os.add_dll_directory`, `sys.path`, lightweight `matplotlib`/`sounddevice` stubs).
- `backend/tests/test_startup_lazy.py`: isolated subprocess import checks guaranteeing `backend.main`, `preflight.run_preflight()`, and `backend.jobs` do not import `yt_dlp`, `cv2`, `numpy`, `openai`, or `google.genai`, plus `backend.spec` package/filter verification.
- `backend/tests/test_addons.py`: unit + FastAPI endpoint tests for `backend/addons.py` and `/api/settings/addons`.
- `backend/tests/test_output_dir.py`: unit + FastAPI endpoint tests for `T1.y` (`output_dir` cloud/web clamping, desktop `path_guard`, `/video` + `/save_file` custom project folder allowlisting).
- `src/hooks/useAddons.ts`: hook fetching & polling `/api/settings/addons` and invoking install/remove endpoints.
- `src/components/settings/FaceTrackingSection.tsx`: settings card for `faceTrackingEngine` + optional `mediapipe` add-on install/remove (`+ FaceTrackingSection.test.tsx`).
- `tasks/sp3-ledger.md`: SP3 task ledger and Rulings.
- `docs/decisions/015-sp3-lightweight-addons-and-output-dir.md`: ADR documenting SP3 architectural decisions.

Modified:
- `backend/requirements.txt`, `backend.spec`: remove `mediapipe`, trim `collect_all` to native packages, filter headers/tests/unused Haar XMLs.
- `backend/video_utils.py`, `backend/ai_utils.py`, `backend/crop_utils.py`, `backend/preflight.py`: lazy imports for `yt_dlp`, `openai`, `google.genai`, `cv2`, `numpy`; decouple `is_nvenc_available()`; add `gc.collect()` after face tracking; support `FaceLandmarker` + `FaceMesh` in `crop_utils.py`; extend `_whisper_gpu_libs_missing()` for Windows `cublas64_12.dll`; add `gpu_ready` and `processor_slow_models` to `get_whisper_status()` / `/api/settings/whisper-models`.
- `backend/workspace.py`, `backend/jobs.py`, `backend/main.py`: `addons` startup hook + endpoints; `sanitize_output_dir` / `allowed_project_output_dirs` and `GET /video` + `POST /save_file` integration.
- `src/components/settings/TranscriptionSection.tsx` (+ test), `src/pages/SettingsPage.tsx`, `src/pages/CreatePage.tsx` (+ test), `src/locales/{id,en}.json`.
- `tasks/roadmap-todo.md`, `tasks/PROGRESS-LOG.md`, `tasks/HANDOFF-AI.md`, `.agents/AGENTS.md`, `CHANGELOG.md`.

---

### Task 1: Bundle Trimming & Startup Lazy Imports (`requirements.txt`, `backend.spec`, `video_utils`, `ai_utils`, `crop_utils`, `preflight`)

**Files:**
- Modify: `backend/requirements.txt:15-16`
- Modify: `backend.spec:50-92`
- Modify: `backend/video_utils.py:1-14` (and inside `probe_formats`, `download_youtube_video`, `_download_with_opts`)
- Modify: `backend/ai_utils.py:1-14` (and inside `ping_provider`, `fetch_provider_models`, `process_with_openai`, `process_with_gemini`, `process_with_openai_compatible`, `generate_social_kit_only`)
- Modify: `backend/crop_utils.py:1-35, 456-560`
- Test: `backend/tests/test_startup_lazy.py` (create)

**Interfaces:**
- Produces: `backend/crop_utils.is_nvenc_available()` works without importing `cv2` or `numpy` at module top level; `backend/video_utils.py`, `backend/ai_utils.py`, and `backend/crop_utils.py` keep all existing public function names and signatures intact; existing tests mocking `backend.crop_utils.cv2` must still work (keep `_cv2()` / module-level `cv2` binding compatible, or import `cv2` into module namespace only when a video/tracking function runs, never on `import backend.crop_utils`).

- [ ] **Step 1: Write the failing test in `backend/tests/test_startup_lazy.py`**

```python
import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
HEAVY_MODULES = ("yt_dlp", "cv2", "numpy", "openai", "google.genai")


def test_startup_imports_do_not_eagerly_load_heavy_modules():
    code = (
        "import json, sys\n"
        "import backend.main\n"
        "from backend.preflight import run_preflight\n"
        "run_preflight()\n"
        "import backend.jobs\n"
        f"loaded = [m for m in {list(HEAVY_MODULES)!r} if m in sys.modules]\n"
        "print(json.dumps(loaded))\n"
    )
    proc = subprocess.run(
        [sys.executable, "-c", code],
        cwd=str(ROOT),
        capture_output=True,
        text=True,
        check=True,
    )
    # stdout ends with the JSON line (no stray backend prints allowed)
    lines = [line.strip() for line in proc.stdout.splitlines() if line.strip()]
    assert lines == ["[]"], f"Expected no heavy modules loaded at startup, got: {proc.stdout!r}"


def test_requirements_and_backend_spec_drop_mediapipe():
    reqs = (ROOT / "backend" / "requirements.txt").read_text(encoding="utf-8").lower()
    assert "mediapipe" not in reqs

    spec = (ROOT / "backend.spec").read_text(encoding="utf-8")
    assert "'mediapipe'" not in spec and '"mediapipe"' not in spec
    assert "haarcascade_frontalface_default.xml" in spec
    assert "backend.metadata" in spec
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `C:\Users\dhima\projects\ac-venv\Scripts\python.exe -m pytest backend/tests/test_startup_lazy.py -q -p no:cacheprovider`
Expected: FAIL because `yt_dlp`, `cv2`, `numpy`, `openai`, `google.genai` are imported eagerly and `mediapipe` is still in `requirements.txt` and `backend.spec`.

- [ ] **Step 3: Inspect call sites before editing**
Check where `yt_dlp`, `OpenAI`, `genai`, `types`, `cv2`, and `np` are used across `backend/video_utils.py`, `backend/ai_utils.py`, and `backend/crop_utils.py`, and check existing monkeypatches in `backend/tests/` (`rg -n "crop_utils\.cv2|video_utils\.yt_dlp|ai_utils\.OpenAI|ai_utils\.genai" backend/tests`).

- [ ] **Step 4: Implement minimal changes**
1. **`backend/requirements.txt`**: Remove `mediapipe>=0.10.0`.
2. **`backend.spec`**:
   - Collect native runtime packages only (`faster_whisper`, `ctranslate2`, `onnxruntime`, `av`, `numpy`, `certifi`), plus for `cv2` collect its extension binary/libs and **only** `cv2/data/haarcascade_frontalface_default.xml` (using `PyInstaller.utils.hooks.collect_dynamic_libs('cv2')` + `collect_submodules('cv2')` / filtered `collect_all('cv2')`).
   - Remove `'mediapipe'` and pure-Python packages from `collect_all`; keep `'backend.metadata'` and SDKs in `hiddenimports`.
   - Filter `a.datas` and `a.binaries` after `Analysis(...)` to strip test folders (`/tests/`, `\tests\`, `/test/`, `\test\`), headers/debug artifacts (`.h`, `.hpp`, `.lib`, `.pdb`), and unused `cv2/data/*.xml` cascades other than `haarcascade_frontalface_default.xml`.
3. **`backend/video_utils.py`**:
   - Remove top-level `import yt_dlp`. Import `yt_dlp` inside functions that use it (e.g. `probe_formats`, `download_youtube_video`, `_ydl_opts`, etc.). Keep `from yt_dlp.version import __version__` inside `preflight._downloader_version()` as today.
4. **`backend/ai_utils.py`**:
   - Remove top-level `from openai import OpenAI` and `from google import genai` / `from google.genai import types`.
   - Add a tiny helper `_openai_client(...)` / import locally inside each provider function (`ping_provider`, `fetch_provider_models`, `process_with_openai`, `process_with_gemini`, `process_with_openai_compatible`, `generate_social_kit_only`, and `correct_subtitle_words_with_ai` which already does local imports). Note: if any existing pytest test patches `backend.ai_utils.OpenAI` or `backend.ai_utils.genai`, provide optional module attributes `OpenAI = None` / `genai = None` fallback ONLY when mocked in tests (`OpenAI_cls = OpenAI or __import__("openai").OpenAI`), OR check with `rg` in Step 3 so existing tests never break!
5. **`backend/crop_utils.py`**:
   - Remove top-level `import cv2` and `import numpy as np`.
   - Keep `cv2 = None` at module level only if tests patch `backend.crop_utils.cv2` (`@patch('backend.crop_utils.cv2.VideoCapture')` fails if `crop_utils.cv2` is `None` unless `cv2` is a lazy proxy or functions check `_cv2()`). Solution that keeps `@patch('backend.crop_utils.cv2.VideoCapture')` 100% working without importing real `cv2` at import time:
     ```python
     class _LazyModule:
         def __init__(self, name: str):
             self._name = name
             self._mod = None
         def _load(self):
             if self._mod is None:
                 self._mod = __import__(self._name)
             return self._mod
         def __getattr__(self, item):
             return getattr(self._load(), item)

     cv2 = _LazyModule("cv2")
     np = _LazyModule("numpy")
     ```
     Wait: `unittest.mock.patch('backend.crop_utils.cv2.VideoCapture')` resolves `cv2` on `backend.crop_utils` first — if `cv2` is a `_LazyModule`, `getattr(cv2, 'VideoCapture')` triggers `_load()` during patching! That's completely fine during a tracking test, while production `import backend.main` + `run_preflight()` + `import backend.jobs` NEVER touches `cv2.VideoCapture` so `cv2` and `numpy` never load!
   - Also call `import gc; gc.collect()` in the `finally:` block of `_sample_face_trajectory` after closing `face_mesh`, `reader`, and `cap`.

- [ ] **Step 5: Run tests and verify startup improvement**

Run:
`C:\Users\dhima\projects\ac-venv\Scripts\python.exe -m pytest backend/tests/test_startup_lazy.py backend/tests/test_crop_utils.py backend/tests/test_preflight.py -q -p no:cacheprovider`
`C:\Users\dhima\projects\ac-venv\Scripts\python.exe -m pytest backend/tests -q -p no:cacheprovider`
Expected: PASS (0 failures). Measure `read_rss_mb()` before/after in a quick one-liner to record numbers for the ledger.

- [ ] **Step 6: Commit**
Update `tasks/sp3-ledger.md` and `tasks/PROGRESS-LOG.md`, then commit:
```bash
git add backend/requirements.txt backend.spec backend/video_utils.py backend/ai_utils.py backend/crop_utils.py backend/tests/test_startup_lazy.py tasks/sp3-ledger.md tasks/PROGRESS-LOG.md
git commit -m "perf(sp3): trim mediapipe from base bundle and defer heavy startup imports" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Optional Runtime Add-on Manager (`backend/addons.py`) & Settings Endpoints

**Files:**
- Create: `backend/addons.py`
- Modify: `backend/main.py` (call `addons.activate_installed()` at startup + add `/api/settings/addons` routes)
- Modify: `backend/ai_utils.py` (call `addons.activate_installed()` at start of `_transcribe_with_faster_whisper`)
- Test: `backend/tests/test_addons.py` (create)

**Interfaces:**
- Produces in `backend/addons.py`:
  - `ADDON_IDS = ("cuda", "mediapipe")`
  - `addons_root() -> str` (`os.path.join(get_app_data_dir(), "addons")`)
  - `addon_dir(addon_id: str) -> str`
  - `is_addon_installed(addon_id: str) -> bool`
  - `is_addon_available(addon_id: str) -> bool` (`False` in `AUTO_CLIPPER_CLOUD_MODE`; for `"cuda"`, `True` only when `sys.platform == "win32"` and `ctranslate2.get_cuda_device_count() >= 1`; for `"mediapipe"`, `True` on desktop/local-web when wheel platform tag is known)
  - `get_addon_statuses() -> dict[str, dict]` where each entry has `{ "id": str, "available": bool, "installed": bool, "downloading": bool, "percent": int, "downloaded_mb": float, "total_mb": float, "size_hint_mb": int, "disk_mb": float, "error_info": dict | None }`
  - `start_addon_download(addon_id: str) -> dict` (starts background thread if not already downloading; returns current status dict; raises `KeyError` for unknown id, `RuntimeError` when unavailable)
  - `remove_addon(addon_id: str) -> dict` (deletes `addon_dir(addon_id)`, returns updated status)
  - `activate_installed() -> None` (registers `<addons>/cuda/bin` via `os.add_dll_directory` + `PATH` on Windows when installed)
  - `ensure_mediapipe_importable() -> str | None` (adds `<addons>/mediapipe` to `sys.path` when installed, installs lightweight `matplotlib`/`matplotlib.pyplot`/`sounddevice` stubs into `sys.modules` only if absent, returns `face_landmarker.task` path when present or `None`)
- Produces in `backend/main.py`:
  - `GET /api/settings/addons` → `{"status": "success", "addons": addons.get_addon_statuses()}`
  - `POST /api/settings/addons/{addon_id}/download` → 404 for unknown id, 400 when unavailable, else 200 `{"status": "success", "addon": ...}`
  - `DELETE /api/settings/addons/{addon_id}` → 404 for unknown id, 400 when unavailable, else 200 `{"status": "success", "addon": ...}`

- [ ] **Step 1: Write failing tests in `backend/tests/test_addons.py`**

```python
import hashlib
import io
import zipfile
from fastapi.testclient import TestClient

from backend import addons
from backend.main import app


def _make_wheel(files: dict[str, bytes]) -> tuple[bytes, str]:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for name, data in files.items():
            zf.writestr(name, data)
    raw = buf.getvalue()
    return raw, hashlib.sha256(raw).hexdigest()


def test_cuda_addon_install_extracts_only_cublas_dlls_and_rejects_bad_sha(tmp_path, monkeypatch):
    monkeypatch.setattr(addons, "get_app_data_dir", lambda: str(tmp_path))
    monkeypatch.setattr(addons.sys, "platform", "win32")
    monkeypatch.setattr(addons, "_cuda_count", lambda: 1)

    wheel_bytes, good_sha = _make_wheel({
        "nvidia/cublas/bin/cublas64_12.dll": b"cublas-dll",
        "nvidia/cublas/bin/cublasLt64_12.dll": b"cublasLt-dll",
        "nvidia/cublas/include/cublas.h": b"header-skip",
        "nvidia_cublas_cu12-12.9.2.10.dist-info/METADATA": b"meta",
    })
    pypi_json = {
        "releases": {
            "12.9.2.10": [{
                "packagetype": "bdist_wheel",
                "filename": "nvidia_cublas_cu12-12.9.2.10-py3-none-win_amd64.whl",
                "url": "https://files.pythonhosted.org/packages/test/cublas.whl",
                "size": len(wheel_bytes),
                "digests": {"sha256": good_sha},
            }]
        }
    }

    monkeypatch.setattr(addons, "_fetch_json", lambda url: pypi_json)
    monkeypatch.setattr(addons, "_download_to_file", lambda url, dest, sha, cb: (dest.write_bytes(wheel_bytes), cb(len(wheel_bytes), len(wheel_bytes))))

    addons.install_addon_sync("cuda")
    assert addons.is_addon_installed("cuda") is True
    assert (tmp_path / "addons" / "cuda" / "bin" / "cublas64_12.dll").read_bytes() == b"cublas-dll"
    assert (tmp_path / "addons" / "cuda" / "bin" / "cublasLt64_12.dll").read_bytes() == b"cublasLt-dll"
    assert not (tmp_path / "addons" / "cuda" / "bin" / "cublas.h").exists()


def test_mediapipe_addon_install_and_remove(tmp_path, monkeypatch):
    monkeypatch.setattr(addons, "get_app_data_dir", lambda: str(tmp_path))
    monkeypatch.delenv("AUTO_CLIPPER_CLOUD_MODE", raising=False)
    monkeypatch.setattr(addons, "_platform_wheel_tags", lambda: ("win_amd64",))

    mp_whl, mp_sha = _make_wheel({"mediapipe/__init__.py": b"__version__ = '1.2.3'", "mediapipe/tasks/c/libmediapipe.dll": b"mp"})
    fb_whl, fb_sha = _make_wheel({"flatbuffers/__init__.py": b"ok"})
    ab_whl, ab_sha = _make_wheel({"absl/__init__.py": b"ok"})
    task_bytes = b"tflite-model"

    def fake_fetch(url):
        if "/mediapipe/" in url:
            return {"info": {"version": "1.2.3"}, "urls": [{"packagetype": "bdist_wheel", "filename": "mediapipe-1.2.3-py3-none-win_amd64.whl", "url": "https://files.pythonhosted.org/mp.whl", "size": len(mp_whl), "digests": {"sha256": mp_sha}}]}
        if "/flatbuffers/" in url:
            return {"info": {"version": "25.12.19"}, "urls": [{"packagetype": "bdist_wheel", "filename": "flatbuffers-25.12.19-py2.py3-none-any.whl", "url": "https://files.pythonhosted.org/fb.whl", "size": len(fb_whl), "digests": {"sha256": fb_sha}}]}
        return {"info": {"version": "2.3.1"}, "urls": [{"packagetype": "bdist_wheel", "filename": "absl_py-2.3.1-py3-none-any.whl", "url": "https://files.pythonhosted.org/ab.whl", "size": len(ab_whl), "digests": {"sha256": ab_sha}}]}

    payloads = {
        "https://files.pythonhosted.org/mp.whl": mp_whl,
        "https://files.pythonhosted.org/fb.whl": fb_whl,
        "https://files.pythonhosted.org/ab.whl": ab_whl,
        addons.FACE_LANDMARKER_URL: task_bytes,
    }
    monkeypatch.setattr(addons, "_fetch_json", fake_fetch)
    monkeypatch.setattr(addons, "_download_to_file", lambda url, dest, sha, cb: (dest.write_bytes(payloads[url]), cb(len(payloads[url]), len(payloads[url]))))

    addons.install_addon_sync("mediapipe")
    assert addons.is_addon_installed("mediapipe") is True
    assert (tmp_path / "addons" / "mediapipe" / "face_landmarker.task").read_bytes() == task_bytes

    addons.remove_addon("mediapipe")
    assert addons.is_addon_installed("mediapipe") is False


def test_addons_endpoints_validate_id_and_cloud_mode(monkeypatch):
    client = TestClient(app)
    assert client.get("/api/settings/addons").status_code == 200
    assert client.post("/api/settings/addons/unknown/download").status_code == 404

    monkeypatch.setenv("AUTO_CLIPPER_CLOUD_MODE", "1")
    monkeypatch.setenv("AUTO_CLIPPER_WEB_TOKEN", "tok")
    assert client.get("/api/settings/addons", headers={"Authorization": "Bearer tok"}).json()["addons"]["mediapipe"]["available"] is False
    assert client.post("/api/settings/addons/mediapipe/download", headers={"Authorization": "Bearer tok"}).status_code == 400
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `C:\Users\dhima\projects\ac-venv\Scripts\python.exe -m pytest backend/tests/test_addons.py -q -p no:cacheprovider`
Expected: FAIL (`ImportError: cannot import name 'addons' from 'backend'`).

- [ ] **Step 3: Implement `backend/addons.py`, startup hook + routes in `backend/main.py`, and hook in `backend/ai_utils.py`**
Key implementation details for `backend/addons.py`:
- Allowed HTTPS hosts: `{"pypi.org", "files.pythonhosted.org", "storage.googleapis.com"}` checked via `urllib.parse.urlparse`.
- Atomic installation: download and extract into `<addons_root()>/.<addon_id>.<uuid>.part`, write `manifest.json` (`{"id": addon_id, "version": ...}`), remove any prior folder atomically (`os.replace` / backup swap), discard `.part` on any error.
- `_download_to_file(url, dest, expected_sha256, progress_cb)`: streams in 256 KB chunks with `requests.get(..., stream=True, timeout=30)`, tracks SHA-256 (`hashlib.sha256`), raises `ValueError` on checksum mismatch when `expected_sha256` is given.
- `FACE_LANDMARKER_URL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"`.
- For `"cuda"` (`nvidia-cublas-cu12` `win_amd64`), pick the newest version in `data["releases"]` that has a `win_amd64` wheel (`cublas64_12.dll` and `cublasLt64_12.dll`, `os.path.basename` copied to `bin/`).
- For `"mediapipe"`, find matching `py3-none-<tag>` wheel using `_platform_wheel_tags()` (`win_amd64` on win32 amd64, `macosx_11_0_arm64` / `arm64` on Darwin arm64, `macosx_10_15_x86_64` / `x86_64` on Darwin x64, `manylinux_2_28_x86_64` / `manylinux` on Linux x86_64), plus `flatbuffers` (`none-any.whl`) and `absl-py` (`none-any.whl`), extracting only `mediapipe/`, `flatbuffers/`, `absl/` top-level packages (skipping `.dist-info`, tests, `matplotlib`, `cv2`).
- `ensure_mediapipe_importable()` also installs lightweight `types.ModuleType` stubs for `matplotlib`, `matplotlib.pyplot`, and `sounddevice` **only if not already in `sys.modules`** when importing `mediapipe` from `<app_data_dir>/addons/mediapipe`.
- Run `addons.activate_installed()` near startup in `backend/main.py` and at the top of `_transcribe_with_faster_whisper()` in `backend/ai_utils.py`.

- [ ] **Step 4: Run tests**

Run: `C:\Users\dhima\projects\ac-venv\Scripts\python.exe -m pytest backend/tests/test_addons.py backend/tests/test_startup_lazy.py -q -p no:cacheprovider`
Expected: PASS.

- [ ] **Step 5: Commit**
Update `tasks/sp3-ledger.md` and `tasks/PROGRESS-LOG.md`, then commit:
```bash
git add backend/addons.py backend/main.py backend/ai_utils.py backend/tests/test_addons.py tasks/sp3-ledger.md tasks/PROGRESS-LOG.md
git commit -m "feat(sp3): add optional cuda and mediapipe runtime add-on installer" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Windows GPU Preflight Check, Dual MediaPipe API (`FaceLandmarker` + `FaceMesh`), & Whisper `gpu_ready`

**Files:**
- Modify: `backend/preflight.py:103-135, 268-291`
- Modify: `backend/crop_utils.py:132-182, 490-510`
- Modify: `backend/ai_utils.py:481-496` (add `get_whisper_status()`)
- Modify: `backend/main.py:362-370` (add `gpu_ready` and `processor_slow_models` to `/api/settings/whisper-models`)
- Test: `backend/tests/test_preflight.py`, `backend/tests/test_crop_utils.py`

**Interfaces:**
- Consumes: `backend.addons.activate_installed()`, `backend.addons.ensure_mediapipe_importable()` (Task 2).
- Produces:
  - `preflight._whisper_gpu_libs_missing()`: returns `["cublas64_12.dll"]` on Windows (`sys.platform == "win32"`) if `cublas64_12.dll` cannot be loaded after `addons.activate_installed()`, or `[]` when loaded; keeps Linux `libcublas.so.12` / `libcudnn.so.9` probe unchanged; skips on macOS.
  - `preflight.check_gpu()`: on Windows (`sys.platform == "win32"`) when GPU exists but `_whisper_gpu_libs_missing()` is non-empty, returns a `warn` result directing users to **Pengaturan → Lanjutan → Model subtitle** without using any `MAIN_SCREEN_BANNED` word in `title`, `message`, `title_en`, `message_en`.
  - `crop_utils._open_face_mesh()`: tries `mp.solutions.face_mesh.FaceMesh(...)` first; if `'solutions'` is missing, instantiates `mediapipe.tasks.python.vision.FaceLandmarker.create_from_options(...)` using `<addons>/mediapipe/face_landmarker.task` (or explicit model path), wrapped in `_FaceLandmarkerAdapter` whose `.process(rgb_frame)` returns an object with `.multi_face_landmarks` compatible with `_mediapipe_faces()` and whose `.close()` releases the landmarker.
  - `GET /api/settings/whisper-models`: returns `{"status": "success", "models": [...], "gpu_ready": bool, "processor_slow_models": ["medium", "large-v3"]}`.

- [ ] **Step 1: Write failing tests in `backend/tests/test_preflight.py` and `backend/tests/test_crop_utils.py`**

In `backend/tests/test_preflight.py`:
```python
def test_windows_gpu_missing_cublas_warns_plainly_pointing_to_settings(healthy, monkeypatch):
    monkeypatch.setattr(preflight.sys, "platform", "win32")
    monkeypatch.setattr(preflight, "_whisper_gpu_libs_missing", lambda: ["cublas64_12.dll"])
    r = _by_id(preflight.run_preflight())["gpu"]
    assert r["level"] == "warn"
    assert "Pengaturan" in r["message"]
    assert "Settings" in r["message_en"]
    for field in ("title", "message", "title_en", "message_en"):
        assert not any(w in r[field].lower() for w in MAIN_SCREEN_BANNED)
        assert "—" not in r[field]


def test_whisper_gpu_libs_probe_checks_cublas64_12_on_windows(monkeypatch):
    monkeypatch.setattr(preflight.sys, "platform", "win32")
    monkeypatch.setattr(preflight.addons, "activate_installed", lambda: None)

    def missing_dll(name):
        raise OSError("not found")

    monkeypatch.setattr(preflight.ctypes, "WinDLL", missing_dll, raising=False)
    assert preflight._whisper_gpu_libs_missing() == ["cublas64_12.dll"]
```

In `backend/tests/test_crop_utils.py`:
```python
def test_face_landmarker_adapter_processes_and_closes(monkeypatch, tmp_path):
    from backend import crop_utils, addons
    model_file = tmp_path / "face_landmarker.task"
    model_file.write_bytes(b"task")
    monkeypatch.setattr(addons, "ensure_mediapipe_importable", lambda: str(model_file))

    class _Lm:
        def __init__(self, x, y): self.x, self.y = x, y

    pts = [_Lm(0.5, 0.5) for _ in range(468)]
    pts[234] = _Lm(0.4, 0.5)
    pts[454] = _Lm(0.6, 0.5)

    class _FakeLandmarker:
        closed = False
        def detect(self, mp_image):
            return type("Res", (), {"face_landmarks": [pts]})()
        def close(self):
            self.closed = True

    fake_lm = _FakeLandmarker()
    fake_mp = type("MP", (), {
        "Image": staticmethod(lambda image_format, data: (image_format, data)),
        "ImageFormat": type("Fmt", (), {"SRGB": 1}),
    })()
    fake_vision = type("Vision", (), {
        "FaceLandmarkerOptions": staticmethod(lambda **kw: kw),
        "RunningMode": type("RM", (), {"IMAGE": 1}),
        "FaceLandmarker": type("FL", (), {"create_from_options": staticmethod(lambda opts: fake_lm)}),
    })()
    monkeypatch.setitem(sys.modules, "mediapipe", fake_mp)
    monkeypatch.setitem(sys.modules, "mediapipe.tasks", type("Tasks", (), {})())
    monkeypatch.setitem(sys.modules, "mediapipe.tasks.python", type("Py", (), {"BaseOptions": staticmethod(lambda **kw: kw), "vision": fake_vision})())
    monkeypatch.setitem(sys.modules, "mediapipe.tasks.python.vision", fake_vision)

    mesh = crop_utils._open_face_mesh()
    faces = crop_utils._mediapipe_faces(mesh, __import__("numpy").zeros((20, 20, 3), dtype="uint8"))
    assert len(faces) == 1 and abs(faces[0]["w"] - 0.2) < 1e-6
    crop_utils._close_face_mesh(mesh)
    assert fake_lm.closed is True
```

Also add a test checking `GET /api/settings/whisper-models` includes `"gpu_ready"` and `"processor_slow_models": ["medium", "large-v3"]`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `C:\Users\dhima\projects\ac-venv\Scripts\python.exe -m pytest backend/tests/test_preflight.py backend/tests/test_crop_utils.py -k "windows_gpu or cublas64 or landmarker_adapter or whisper_models" -q -p no:cacheprovider`
Expected: FAIL.

- [ ] **Step 3: Implement changes in `preflight.py`, `crop_utils.py`, `ai_utils.py`, and `main.py`**
- In `backend/preflight.py`:
  - Import `from backend import addons` cleanly (no heavy side effects).
  - In `_whisper_gpu_libs_missing()`: on `sys.platform == "win32"`, call `addons.activate_installed()`, then try `ctypes.WinDLL("cublas64_12.dll")`, returning `["cublas64_12.dll"]` on `OSError`, `[]` on success.
  - In `check_gpu()`: if `sys.platform == "win32"`, return a Windows-specific `warn` telling the user in plain Indonesian & English to install GPU support under **Pengaturan → Lanjutan → Model subtitle** (avoiding all `MAIN_SCREEN_BANNED` terms); otherwise keep the existing Colab message on Linux.
- In `backend/crop_utils.py`:
  - In `_open_face_mesh()`: call `model_path = addons.ensure_mediapipe_importable()`, `import mediapipe as mp`. If `hasattr(mp, "solutions")`, use `mp.solutions.face_mesh.FaceMesh(...)`. Else import `BaseOptions` & `vision` from `mediapipe.tasks.python` and construct `_FaceLandmarkerAdapter(landmarker, mp)`.
- In `backend/ai_utils.py` & `backend/main.py`:
  - Add `get_whisper_status() -> dict` returning `{"models": get_available_whisper_models(), "gpu_ready": bool(preflight._cuda_device_count() >= 1 and not preflight._whisper_gpu_libs_missing()), "processor_slow_models": ["medium", "large-v3"]}` (with safe fallback `False` if CUDA probe raises), and return `{"status": "success", **get_whisper_status()}` from `GET /api/settings/whisper-models`.

- [ ] **Step 4: Run tests**

Run: `C:\Users\dhima\projects\ac-venv\Scripts\python.exe -m pytest backend/tests/test_preflight.py backend/tests/test_crop_utils.py -q -p no:cacheprovider`
Expected: PASS.

- [ ] **Step 5: Commit**
Update `tasks/sp3-ledger.md` and `tasks/PROGRESS-LOG.md`, then commit:
```bash
git add backend/preflight.py backend/crop_utils.py backend/ai_utils.py backend/main.py backend/tests/test_preflight.py backend/tests/test_crop_utils.py tasks/sp3-ledger.md tasks/PROGRESS-LOG.md
git commit -m "feat(sp3): check Windows cuBLAS in preflight, support FaceLandmarker, and expose gpu_ready" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Output Directory Security (`T1.y`) & Custom Desktop Output Folder Playback/Save

**Files:**
- Modify: `backend/workspace.py` (add `allowed_project_output_dirs`)
- Modify: `backend/jobs.py:156-189` (`get_project_workspace` rejects protected `library_dir`)
- Modify: `backend/main.py:451-468, 506-539, 798-829, 1003-1027, 1029-1088` (`_resolve_safe_output_dir`, `GET /video`, `POST /save_file`)
- Test: `backend/tests/test_output_dir.py` (create)

**Interfaces:**
- Produces:
  - `backend/workspace.allowed_project_output_dirs(active_jobs: dict | None = None) -> list[str]` returning deduplicated existing/configured non-protected `output_dir` roots from `active_jobs` and `db.get_all_history()`.
  - `backend/main._resolve_safe_output_dir(output_dir: str, endpoint: str) -> tuple[str, Optional[JSONResponse]]`: returns `("", None)` when `AUTO_CLIPPER_CLOUD_MODE` or `web_ui.is_web_mode()`; otherwise checks `path_guard.is_protected(os.path.abspath(output_dir.strip()))` and returns `("", path_guard.denied(endpoint, output_dir))` on match.
  - `GET /video` and `POST /save_file` allow reading from `[get_app_data_dir(), *work_dirs, *allowed_project_output_dirs()]` (plus `os.getcwd()` for `/video` as before), always **after** `path_guard.is_protected()` and (`GET /video`) `video_sign.verify()`.

- [ ] **Step 1: Write failing tests in `backend/tests/test_output_dir.py`**

```python
from fastapi.testclient import TestClient

from backend import jobs, video_sign, web_ui
from backend.main import app


def test_cloud_and_local_web_ignore_output_dir(tmp_path, monkeypatch):
    monkeypatch.setattr("backend.jobs.get_app_data_dir", lambda: str(tmp_path))
    monkeypatch.setattr("backend.jobs.save_history", lambda *a, **k: None)
    monkeypatch.setattr("backend.jobs._start_job", lambda *a, **k: None)

    captured = []
    orig_create = jobs.create_manual_job

    def spy_create(*args, **kwargs):
        captured.append(args[5] if len(args) > 5 else kwargs.get("output_dir", ""))
        return orig_create(*args, **kwargs)

    monkeypatch.setattr("backend.jobs.create_manual_job", spy_create)

    monkeypatch.setenv("AUTO_CLIPPER_CLOUD_MODE", "1")
    monkeypatch.setenv("AUTO_CLIPPER_WEB_TOKEN", "tok")
    r = TestClient(app).post(
        "/jobs/manual",
        headers={"Authorization": "Bearer tok"},
        json={"url": "https://youtu.be/x", "title": "CloudSafe", "output_dir": str(tmp_path / "escape")},
    )
    assert r.status_code == 200
    assert captured[-1] == ""

    monkeypatch.delenv("AUTO_CLIPPER_CLOUD_MODE", raising=False)
    monkeypatch.setattr(web_ui, "is_web_mode", lambda: True)
    web_ui._web_token = "tok"
    r2 = TestClient(app).post(
        "/jobs/manual",
        headers={"Authorization": "Bearer tok"},
        json={"url": "https://youtu.be/x", "title": "WebSafe", "output_dir": str(tmp_path / "escape2")},
    )
    assert r2.status_code == 200
    assert captured[-1] == ""


def test_desktop_refuses_protected_output_dir(tmp_path, monkeypatch):
    monkeypatch.setattr("backend.db.get_app_data_dir", lambda: str(tmp_path))
    monkeypatch.delenv("AUTO_CLIPPER_CLOUD_MODE", raising=False)
    monkeypatch.setattr(web_ui, "is_web_mode", lambda: False)

    cookies_dir = tmp_path / "cookies"
    cookies_dir.mkdir(parents=True, exist_ok=True)
    r = TestClient(app).post(
        "/jobs/manual",
        json={"url": "https://youtu.be/x", "title": "BadOut", "output_dir": str(cookies_dir)},
    )
    assert r.status_code == 403
    assert r.json()["message"] == "Access denied"


def test_video_and_save_file_allow_registered_desktop_output_dir_and_refuse_arbitrary(tmp_path, monkeypatch):
    app_data = tmp_path / "appdata"
    custom_out = tmp_path / "MyVideos"
    dest_dir = tmp_path / "Exported"
    (custom_out / "DemoProj" / "clips").mkdir(parents=True)
    dest_dir.mkdir(parents=True)

    clip = custom_out / "DemoProj" / "clips" / "clip_01.mp4"
    clip.write_bytes(b"mp4bytes")
    arbitrary = tmp_path / "secret.mp4"
    arbitrary.write_bytes(b"secret")

    monkeypatch.setattr("backend.main.get_app_data_dir", lambda: str(app_data))
    monkeypatch.setattr("backend.db.get_app_data_dir", lambda: str(app_data))
    monkeypatch.setattr("backend.db.get_all_history", lambda: [
        {"id": "h1", "metadata": {"output_dir": str(custom_out)}, "result_clips": [{"path": str(clip)}]}
    ])
    monkeypatch.setattr(video_sign, "load_key", lambda: b"k" * 32)
    monkeypatch.delenv("AUTO_CLIPPER_CLOUD_MODE", raising=False)
    monkeypatch.setattr(web_ui, "is_web_mode", lambda: False)

    client = TestClient(app)
    sig_ok = video_sign.sign(str(clip), b"k" * 32)
    sig_bad_dir = video_sign.sign(str(arbitrary), b"k" * 32)

    assert client.get(f"/video?path={clip}&sig={sig_ok}").status_code == 200
    assert client.get(f"/video?path={arbitrary}&sig={sig_bad_dir}").status_code == 403

    r_copy = client.post("/save_file", json={"src": str(clip), "dest": str(dest_dir / "out.mp4")})
    assert r_copy.status_code == 200
    assert (dest_dir / "out.mp4").read_bytes() == b"mp4bytes"

    r_arb = client.post("/save_file", json={"src": str(arbitrary), "dest": str(dest_dir / "out2.mp4")})
    assert r_arb.status_code == 403
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `C:\Users\dhima\projects\ac-venv\Scripts\python.exe -m pytest backend/tests/test_output_dir.py -q -p no:cacheprovider`
Expected: FAIL.

- [ ] **Step 3: Implement `output_dir` sanitization and project output allowlisting**
- In `backend/workspace.py`: add `allowed_project_output_dirs(active_jobs: dict | None = None) -> list[str]` collecting valid non-protected `output_dir` paths from `active_jobs` and `backend.db.get_all_history()`.
- In `backend/jobs.py` (`get_project_workspace`): call `path_guard.is_protected(library_dir)` when `output_dir` is set, raising `AppError("PATH_DENIED", technical=f"Protected output_dir: {library_dir}")` if protected (or ensure `_resolve_safe_output_dir` already rejects protected paths with 403).
- In `backend/main.py`: add `_resolve_safe_output_dir(output_dir, endpoint)` and call it in `/jobs`, `/jobs/manual`, `/jobs/{id}/rerender`, `/jobs/{id}/rerun_ai`; update `GET /video` and `POST /save_file` to append `workspace.allowed_project_output_dirs(jobs.active_jobs)` to `safe_dirs`.

- [ ] **Step 4: Run tests**

Run: `C:\Users\dhima\projects\ac-venv\Scripts\python.exe -m pytest backend/tests/test_output_dir.py backend/tests/test_path_guard.py -q -p no:cacheprovider`
Expected: PASS.

- [ ] **Step 5: Commit**
Update `tasks/sp3-ledger.md` and `tasks/PROGRESS-LOG.md`, then commit:
```bash
git add backend/workspace.py backend/jobs.py backend/main.py backend/tests/test_output_dir.py tasks/sp3-ledger.md tasks/PROGRESS-LOG.md
git commit -m "fix(sp3): enforce output_dir path guard and allow custom Desktop clip access" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Frontend Add-on UI (`useAddons`, `TranscriptionSection`, `FaceTrackingSection`) & Locale Keys

**Files:**
- Create: `src/hooks/useAddons.ts`
- Create: `src/components/settings/FaceTrackingSection.tsx`
- Create: `src/components/settings/FaceTrackingSection.test.tsx`
- Modify: `src/components/settings/TranscriptionSection.tsx`
- Modify: `src/components/settings/TranscriptionSection.test.tsx`
- Modify: `src/pages/SettingsPage.tsx:59-72`
- Modify: `src/locales/id.json`, `src/locales/en.json`

**Interfaces:**
- Consumes: `GET /api/settings/addons`, `POST /api/settings/addons/{id}/download`, `DELETE /api/settings/addons/{id}`, and `gpu_ready` on `GET /api/settings/whisper-models`.
- Produces:
  - `AddonStatus` & `useAddons()` hook in `src/hooks/useAddons.ts` (`addons`, `loading`, `error`, `install(id)`, `remove(id)`, `refresh()`).
  - `FaceTrackingSection` component rendering the `faceTrackingEngine` selector plus the `"mediapipe"` optional component install/progress/remove block when `addons.mediapipe?.available`.
  - Updated `TranscriptionSection` displaying CPU guidance on `medium`/`large-v3` when `!gpuReady`, and the `"cuda"` optional GPU component install/progress/remove block when `addons.cuda?.available`.

- [ ] **Step 1: Add plain-language locale keys (no banned words, no emoji, no em dash)**
Inspect banned words in `src/locales/plainWords.test.ts` and existing `settings.*` keys in `src/locales/id.json`, then add keys via `node scripts/add-locale-keys.mjs`:
- `settings.whisper_cpu_note`: `"Disarankan memakai kartu grafis. Di prosesor, video 30 menit bisa lebih dari satu jam."` / `"Recommended with a graphics card. On a processor, a 30-minute video can take over an hour."`
- `settings.addon_gpu_title`, `settings.addon_gpu_desc`, `settings.addon_gpu_install`, `settings.addon_gpu_remove`, `settings.addon_gpu_ready`
- `settings.addon_face_title`, `settings.addon_face_desc`, `settings.addon_face_install`, `settings.addon_face_remove`, `settings.addon_face_ready`
- `settings.addon_downloading`, `settings.addon_download_failed`, `settings.addon_remove_failed`
- `create.cpu_model_title`, `create.cpu_model_body`, `create.cpu_model_use_fast`, `create.cpu_model_keep_accurate`

- [ ] **Step 2: Write failing component tests**
Write tests in `src/components/settings/TranscriptionSection.test.tsx` (CPU note shown when `gpu_ready: false`; GPU add-on install button & progress shown when `cuda.available && !cuda.installed`; remove button when installed) and `src/components/settings/FaceTrackingSection.test.tsx` (`mediapipe` install/remove actions and engine dropdown behavior).

- [ ] **Step 3: Run tests to confirm they fail**
Run: `npx vitest run src/components/settings/TranscriptionSection.test.tsx src/components/settings/FaceTrackingSection.test.tsx` (from `C:\Users\dhima\projects\auto-clipper`).
Expected: FAIL.

- [ ] **Step 4: Implement `useAddons.ts`, `FaceTrackingSection.tsx`, `TranscriptionSection.tsx`, and wire `SettingsPage.tsx`**

- [ ] **Step 5: Run Vitest + locale/plainWords/contrast + lint + builds**
Run:
`npx vitest run`
`npx oxlint src`
`npm run build`
`npm run build:cloud`
Expected: all pass, 0 oxlint errors.

- [ ] **Step 6: Commit**
Update `tasks/sp3-ledger.md` and `tasks/PROGRESS-LOG.md`, then commit:
```bash
git add src/hooks/useAddons.ts src/components/settings/FaceTrackingSection.tsx src/components/settings/FaceTrackingSection.test.tsx src/components/settings/TranscriptionSection.tsx src/components/settings/TranscriptionSection.test.tsx src/pages/SettingsPage.tsx src/locales/id.json src/locales/en.json tasks/sp3-ledger.md tasks/PROGRESS-LOG.md
git commit -m "feat(sp3): add settings UI for optional GPU and precise tracking add-ons" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: CreatePage CPU Whisper Confirmation Dialog, Benchmarks, Docs & Final Verification

**Files:**
- Modify: `src/pages/CreatePage.tsx` (and `src/hooks/useClipJobs.ts` / `src/App.tsx` if `handleGenerate` needs an optional `overrideWhisperModel?: string` parameter)
- Modify: `src/pages/CreatePage.test.tsx`
- Create: `docs/decisions/015-sp3-lightweight-addons-and-output-dir.md`
- Modify: `.agents/AGENTS.md`, `CHANGELOG.md`, `tasks/roadmap-todo.md`, `tasks/sp3-ledger.md`, `tasks/PROGRESS-LOG.md`, `tasks/HANDOFF-AI.md`

**Interfaces:**
- Consumes: `preflight.checks` (specifically `checks.find(c => c.id === 'gpu')`) and `ctx.whisperModel` / `ctx.setWhisperModel` + `ctx.handleGenerate(provider, title, overrideWhisperModel?)`.
- Produces: When user clicks **Mulai** with `ctx.whisperModel` in `("medium", "large-v3")` and preflight `gpu` check has `level === "warn"`, `CreatePage` opens a `Dialog` offering **"Pakai model Cepat (disarankan)"** (sets `small` and starts job) or **"Tetap pakai model Akurat"** (starts job with chosen model).

- [ ] **Step 1: Write failing tests in `src/pages/CreatePage.test.tsx`**
Add 3 unit tests:
1. Pressing **Mulai** with `whisperModel="medium"` and preflight `gpu.level === "warn"` opens the CPU model dialog instead of calling `handleGenerate` immediately; clicking **"Pakai model Cepat (disarankan)"** starts with `"small"`.
2. Clicking **"Tetap pakai model Akurat"** starts with `"medium"`.
3. Pressing **Mulai** with `whisperModel="medium"` and preflight `gpu.level === "ok"` calls `handleGenerate` immediately without opening the dialog.

- [ ] **Step 2: Run `CreatePage.test.tsx` to verify failure**
Run: `npx vitest run src/pages/CreatePage.test.tsx` (from `C:\Users\dhima\projects\auto-clipper`).
Expected: FAIL.

- [ ] **Step 3: Implement CPU confirmation dialog in `CreatePage.tsx` (+ `overrideWhisperModel` on `handleGenerate`)**

- [ ] **Step 4: Run full backend + frontend verification & capture SP3 benchmarks**
Run:
- `C:\Users\dhima\projects\ac-venv\Scripts\python.exe -m pytest backend/tests -q -p no:cacheprovider`
- `npx vitest run`
- `npx oxlint src`
- `npm run build`
- `npm run build:cloud`
- Measure `import backend.main` + `run_preflight()` + `import backend.jobs` RSS & startup time after SP3 and record before/after table in `docs/decisions/015-sp3-lightweight-addons-and-output-dir.md` & `tasks/PROGRESS-LOG.md`.

- [ ] **Step 5: Update docs & commit**
Write ADR-015, update `.agents/AGENTS.md` (add `T1.y` closed, add `addons` invariant, drop `mediapipe` from base requirement note), `CHANGELOG.md`, `tasks/roadmap-todo.md` (`[x]` SP3 items + `T1.y`), `tasks/sp3-ledger.md`, `tasks/PROGRESS-LOG.md`, and `tasks/HANDOFF-AI.md`, then commit without pushing.
