# SP3 Lightweight App, Optional Add-ons, and Output Folder Security Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cut ~260 MB from the core desktop and Auto Clipper Web bundle by removing `mediapipe` and its transitive dependencies from the base build, speed up sidecar startup/idle RAM via lazy imports, add an atomic pinned-SHA-256 add-on downloader (`cuda` cuBLAS for Windows NVIDIA subtitles and `mediapipe` Tasks `FaceLandmarker` for precise face tracking) in Pengaturan with an explicit fallback message when Teliti is chosen uninstalled, add a CPU Whisper confirmation dialog before starting `medium`/`large-v3` without GPU, and close `output_dir` security (`T1.y`) while enabling `/video` and `/save_file` for valid custom Desktop output folders.

**Architecture:** The backend splits optional heavy native runtimes (`cuda` DLLs on Windows, pinned `mediapipe==1.2.3` wheel + `face_landmarker.task` on desktop/local-web) into `<app_data_dir>/addons/<id>` managed by `backend/addons.py` with locked versions, HTTPS URLs, byte sizes, and SHA-256 digests (`PINNED_ADDONS`). Core modules (`video_utils`, `ai_utils`, `crop_utils`, `preflight`) defer heavy imports (`yt_dlp`, `openai`, `google.genai`, `cv2`, `numpy`) using lazy proxies/local imports so `main`, `preflight`, and `jobs` start fast with minimal RSS without breaking existing test mocks. On the frontend, `TranscriptionSection` and `FaceTrackingSection` drive `/api/settings/addons`, `ProgressPanel` displays a plain-language fallback note whenever `Teliti` falls back to `Standar`, and `CreatePage` prompts users once with a `Dialog` before running `medium`/`large-v3` on CPU.

**Tech Stack:** Python 3.11+, FastAPI, PyInstaller (`--onefile` Windows / `--onedir` macOS), ctypes, zipfile/hashlib, pytest; React 19, TypeScript 6, Vite 8, Tailwind 3, i18next, Vitest, oxlint.

**Spec:** `docs/superpowers/specs/2026-11-24-sp3-lightweight-design.md` (binding). Parent: `docs/superpowers/specs/2026-11-12-enhancement-roadmap.md`. Ledger: `tasks/sp3-ledger.md`.

## Global Constraints

Repo and process:
- Branch: `feat/sp3-lightweight` (created from `9ff373f`). Never push, open a PR, or merge without the owner's explicit request.
- Every commit message ends with `Co-Authored-By: <Agent Name> <noreply@anthropic.com>`.
- Python tests always use the project venv (never `python` on PATH): `C:\Users\dhima\projects\ac-venv\Scripts\python.exe -m pytest backend/tests -q -p no:cacheprovider`. Baseline: **860 passed, 6 skipped**.
- Frontend checks run from `C:\Users\dhima\projects\auto-clipper` (uppercase `C:` drive letter so Vitest does not double-load): `npm test` (baseline **424 passed** across 64 files), `npm run lint` (`0` errors), `npm run build`, `npm run build:cloud`.
- No Rust toolchain AND `PyInstaller` is not installed in `ac-venv` on this machine: local `npm run tauri build` and local `pyinstaller` frozen builds cannot execute here and are verified in CI (`PR Check`, `Build and Release`, `Web Package`), while Task 0 verifies isolated runtime add-on loading and spec stdlib coverage on this machine.
- Append a 3–6 line entry to `tasks/PROGRESS-LOG.md` under `## 2026-11-24 · SP3` and record Task completion / Rulings in `tasks/sp3-ledger.md` inside every task commit.

Backend invariants (`.agents/AGENTS.md` A, B, E):
- **NEVER `print()` to stdout** in any backend module (Tauri handshake relies on strict stdout); use `log_error(context, err)` / `log_app(msg)`.
- `backend.metadata` AND all stdlib modules needed when loading add-on `mediapipe` (`wave`, `csv`, `timeit`, `getpass`, `xml`) stay in `backend.spec` `hiddenimports`; Windows keeps `--onefile`, macOS keeps `--onedir`.
- Every endpoint taking file paths from requests calls `path_guard.is_protected()` first and responds with `path_guard.denied()` (403 `Access denied`).
- Add-on downloads ONLY fetch **locked URLs and SHA-256 digests defined in `PINNED_ADDONS`** (never PyPI "latest"), write to `.part` temp directories, validate SHA-256 + byte length before `os.replace`.
- Cloud mode (`AUTO_CLIPPER_CLOUD_MODE`) disables add-on downloads (`available: false`) and ignores client-supplied `output_dir`. Local web mode (`web_ui.is_web_mode()`) ignores client-supplied `output_dir`.

Frontend & copy invariants (`.agents/AGENTS.md` F, SP2 4.6):
- Every UI string lives in both `src/locales/id.json` and `src/locales/en.json` added via `node scripts/add-locale-keys.mjs`; `locales.test.ts`, `plainWords.test.ts` (no banned words `transkripsi`, `transcription`, `render`, `encoder`, `json`, `sidecar`, `token`, `prompt`, `backend`, `ffmpeg`, `nvenc`, `cuda`, `whisper`, no emoji, no `—` in main-screen namespaces or `preflight.py` titles/messages), and `contrast.test.ts` MUST pass.
- Components inspect `platform().caps`, never `platform().kind`; dialogs use `src/components/ui/Dialog.tsx`. Every backend URL uses `API_URL` (`src/platform/backendUrl.ts`).

---

## File Structure

Created:
- `backend/tests/test_addons_spike.py` (Task 0 spike test / temporary verification script; either kept lightweight or recorded in Task 0)
- `backend/addons.py`: pinned add-on manifest (`PINNED_ADDONS` for `cuda` and `mediapipe`), atomic HTTPS wheel/model installation with SHA-256 verification, status reporting, removal, `os.add_dll_directory`, `sys.path`, lightweight `matplotlib`/`sounddevice` stubs.
- `backend/tests/test_startup_lazy.py`: isolated subprocess import checks (`backend.main`, `preflight.run_preflight()`, `backend.jobs`) + `backend.spec` checks.
- `backend/tests/test_addons.py`: unit + FastAPI endpoint tests for `backend/addons.py` and `/api/settings/addons`.
- `backend/tests/test_output_dir.py`: unit + FastAPI endpoint tests for `T1.y`.
- `src/hooks/useAddons.ts`: hook fetching & polling `/api/settings/addons` and invoking install/remove endpoints.
- `src/components/settings/FaceTrackingSection.tsx` (+ `FaceTrackingSection.test.tsx`): settings card for `faceTrackingEngine`, uninstalled fallback notice, and optional `mediapipe` add-on install/remove.
- `docs/decisions/015-sp3-lightweight-addons-and-output-dir.md`: ADR documenting SP3 architectural decisions.

Modified:
- `backend/requirements.txt`, `backend.spec`
- `backend/video_utils.py`, `backend/ai_utils.py`, `backend/crop_utils.py`, `backend/preflight.py`
- `backend/workspace.py`, `backend/jobs.py`, `backend/main.py`
- `src/lib/progress.ts` (+ `progress.test.ts`), `src/components/create/ProgressPanel.tsx`, `src/components/settings/TranscriptionSection.tsx` (+ test), `src/pages/SettingsPage.tsx`, `src/pages/CreatePage.tsx` (+ test), `src/hooks/useClipJobs.ts`, `src/App.tsx`, `src/locales/{id,en}.json`
- `tasks/roadmap-todo.md`, `tasks/PROGRESS-LOG.md`, `tasks/HANDOFF-AI.md`, `tasks/sp3-ledger.md`, `.agents/AGENTS.md`, `CHANGELOG.md`.

---

### Task 0: Spike — Prove Dynamic Add-on Loading & Windows cuBLAS Resolution

**Goal (before writing feature code):** Prove empirically whether (a) extracting the pinned `mediapipe==1.2.3`, `flatbuffers==25.12.19`, and `absl-py==2.5.1` packages into an external `addons/mediapipe/` folder works without `matplotlib`, `opencv-contrib-python`, or `sounddevice` (and which stdlib modules a frozen PyInstaller executable must keep in `hiddenimports` so the dynamic import succeeds), and (b) `ctypes.WinDLL("cublas64_12.dll")` + `ctranslate2` can load `cublas64_12.dll` from an external `addons/cuda/bin/` directory registered via `os.add_dll_directory()` + `PATH`. Record explicitly why a local PyInstaller `.exe` build cannot run on this machine (`PyInstaller` is absent from `ac-venv` — verified `find_spec('PyInstaller') is None` — so full frozen binary testing waits for CI `PR Check` / `web-package.yml`).

- [ ] **Step 1: Verify `mediapipe.tasks` isolation and stdlib dependencies in an isolated temp folder**
Run a throwaway Python verification command that copies `mediapipe`, `flatbuffers`, and `absl` from `ac-venv/Lib/site-packages` into a fresh `TemporaryDirectory`, removes `ac-venv`'s `site-packages` from `sys.path` (keeping only stdlib, `cv2`, `numpy`, and the temp `addons/mediapipe` dir), stubs `matplotlib`, `matplotlib.pyplot`, and `sounddevice`, and imports `from mediapipe.tasks.python import BaseOptions, vision`:
```powershell
C:\Users\dhima\projects\ac-venv\Scripts\python.exe -c "
import pathlib, shutil, subprocess, sys, tempfile, site
sp = pathlib.Path(site.getsitepackages()[1])
with tempfile.TemporaryDirectory() as d:
    addon = pathlib.Path(d)
    for pkg in ('mediapipe', 'flatbuffers', 'absl'):
        shutil.copytree(sp / pkg, addon / pkg)
    code = f'''
import sys, types
# Keep stdlib + DLLs only; strip site-packages so only addon dir provides mediapipe/flatbuffers/absl
sys.path = [p for p in sys.path if \"site-packages\" not in p.lower()]
sys.path.insert(0, r\"{addon}\")
m = types.ModuleType(\"matplotlib\"); m.pyplot = types.ModuleType(\"matplotlib.pyplot\")
sys.modules[\"matplotlib\"] = m; sys.modules[\"matplotlib.pyplot\"] = m.pyplot
sys.modules[\"sounddevice\"] = types.ModuleType(\"sounddevice\")
# Re-add numpy & cv2 parent only if not in core: here simulate core PyInstaller having numpy/cv2
sys.path.append(r\"{sp}\")  # in real check, verify FaceLandmarker class resolves from addon.__file__!
import mediapipe, flatbuffers, absl
assert str(mediapipe.__file__).startswith(r\"{addon}\"), mediapipe.__file__
from mediapipe.tasks.python import BaseOptions, vision
print(\"SPIKE_MP_OK\", vision.FaceLandmarker)
'''
    r = subprocess.run([sys.executable, '-c', code], capture_output=True, text=True)
    print('rc:', r.returncode, r.stdout.strip(), r.stderr.strip())
"
```

- [ ] **Step 2: Verify Windows `os.add_dll_directory()` + `PATH` resolution for `cublas64_12.dll`**
Confirm whether adding a folder to `os.add_dll_directory()` AND `os.environ["PATH"]` allows `ctypes.WinDLL("cublas64_12.dll")` (used by `preflight._whisper_gpu_libs_missing()`) and `ctranslate2.dll` (`LoadLibraryEx` Windows loader) to resolve a DLL from an arbitrary `<app_data_dir>/addons/cuda/bin` path without `CUDA_PATH`.

- [ ] **Step 3: Verify `PyInstaller` absence on this machine and record spike findings in `tasks/sp3-ledger.md`**
Check `find_spec("PyInstaller") is None` so the ledger honestly states that while isolated add-on imports, stdlib dependencies (`wave`, `csv`, `timeit`, `getpass`, `xml`), and `os.add_dll_directory` resolution passed locally, building and running an actual frozen `backend.exe` requires CI (`PR Check` / `web-package.yml`). Record the spike results under `## Task 0 (Spike)` in `tasks/sp3-ledger.md` and `tasks/PROGRESS-LOG.md`, and commit.

---

### Task 1: Bundle Trimming & Startup Lazy Imports (`requirements.txt`, `backend.spec`, `video_utils`, `ai_utils`, `crop_utils`, `preflight`)

**Files:**
- Modify: `backend/requirements.txt:15-16`
- Modify: `backend.spec:10-92`
- Modify: `backend/preflight.py:152-155` (use `importlib.metadata.version("yt-dlp")` instead of `from yt_dlp.version import __version__`)
- Modify: `backend/video_utils.py:1-14` (replace `import yt_dlp` with `_LazyModule("yt_dlp")` proxy or local imports — `_LazyModule` keeps all 25 existing `patch('backend.video_utils.yt_dlp.YoutubeDL')` test mocks passing without loading `yt_dlp` at module import time!)
- Modify: `backend/ai_utils.py:1-14` (replace top-level `OpenAI` and `genai`/`types` imports with `_LazySymbol` / `_LazyModule` or lazy helper keeping existing `@patch('backend.ai_utils.OpenAI')` and `@patch('google.genai.Client')` passing!)
- Modify: `backend/crop_utils.py:1-35, 1660-1680` (use `_LazyModule("cv2")` and `_LazyModule("numpy")`, decouple `is_nvenc_available()` from `cv2`/`numpy`, call `gc.collect()` after `_sample_face_trajectory` cleanup)
- Test: `backend/tests/test_startup_lazy.py` (create)

**Interfaces:**
- Produces: lazy proxies in `video_utils`, `ai_utils`, and `crop_utils` so importing `backend.main`, calling `preflight.run_preflight()`, and importing `backend.jobs` NEVER trigger real imports of `yt_dlp`, `cv2`, `numpy`, `openai`, or `google.genai` into `sys.modules`; `backend/crop_utils.is_nvenc_available()` continues to execute FFmpeg probe cleanly without loading OpenCV or NumPy; `backend.spec` includes stdlib `wave`, `csv`, `timeit`, `getpass`, `xml` in `hiddenimports` for dynamic add-on loading while excluding `mediapipe` and stripping unused XML cascades/headers/tests.

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
    lines = [line.strip() for line in proc.stdout.splitlines() if line.strip()]
    assert lines == ["[]"], f"Expected no heavy modules loaded at startup, got: {proc.stdout!r}"


def test_requirements_and_backend_spec_drop_mediapipe_and_keep_addon_stdlib():
    reqs = (ROOT / "backend" / "requirements.txt").read_text(encoding="utf-8").lower()
    assert "mediapipe" not in reqs

    spec = (ROOT / "backend.spec").read_text(encoding="utf-8")
    assert "'mediapipe'" not in spec and '"mediapipe"' not in spec
    assert "haarcascade_frontalface_default.xml" in spec
    assert "backend.metadata" in spec
    for mod in ("'wave'", "'csv'", "'timeit'", "'getpass'", "'xml'"):
        assert mod in spec, f"{mod} missing from backend.spec hiddenimports"
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `C:\Users\dhima\projects\ac-venv\Scripts\python.exe -m pytest backend/tests/test_startup_lazy.py -q -p no:cacheprovider`
Expected: FAIL.

- [ ] **Step 3: Implement lazy imports (`_LazyModule`), `backend/requirements.txt`, `backend.spec`, and `gc.collect()`**
Use a small helper class (either inline in each module or in `backend/_lazy.py`, e.g. `_LazyModule(name)` and `_LazyAttr(module_name, attr_name)`) so:
- `backend/video_utils.py`: `yt_dlp = _LazyModule("yt_dlp")` (or local import when not patched). Because `unittest.mock.patch("backend.video_utils.yt_dlp.YoutubeDL")` runs `getattr(video_utils.yt_dlp, "YoutubeDL")` during tests, that triggers lazy load inside unit tests (acceptable) while production `import backend.main` + `run_preflight()` + `import backend.jobs` NEVER touches `video_utils.yt_dlp`!
- `backend/preflight.py` `_downloader_version()`: use `import importlib.metadata; return importlib.metadata.version("yt-dlp")` with fallback `from yt_dlp.version import __version__` when frozen without dist-info (inside frozen builds `dist-info` may be stripped or kept — wait: let's keep `collect_all` metadata or `importlib.metadata` for `yt-dlp` via `copy_metadata('yt-dlp')` in `backend.spec`!).
- `backend/ai_utils.py`: replace top-level `from openai import OpenAI` and `from google import genai` / `from google.genai import types` with lazy wrappers (`_LazyModule("google.genai")`, `_LazyModule("google.genai.types")`, `_LazyAttr("openai", "OpenAI")`), preserving `@patch('backend.ai_utils.OpenAI')` and `@patch('google.genai.Client')` seamlessly! Note for `OpenAI`: `patch('backend.ai_utils.OpenAI')` uses `setattr(ai_utils, 'OpenAI', mock)`, which replaces `_LazyAttr` cleanly; `OpenAI(...)` calls `__call__` on `_LazyAttr` to import and invoke `openai.OpenAI(...)`.
- `backend/crop_utils.py`: `cv2 = _LazyModule("cv2")`, `np = _LazyModule("numpy")`. `is_nvenc_available()` uses only `subprocess`, keeping `cv2`/`numpy` unloaded during `run_preflight()`. Call `gc.collect()` at the end of `_sample_face_trajectory` `finally:`.
- `backend/requirements.txt` & `backend.spec`: remove `mediapipe`, keep native `collect_all` (`faster_whisper`, `ctranslate2`, `onnxruntime`, `av`, `numpy`, `certifi`, `cv2` filtered to binary + `haarcascade_frontalface_default.xml`), add `copy_metadata('yt-dlp')` + addon stdlib `hiddenimports` (`wave`, `csv`, `timeit`, `getpass`, `xml`), and strip `/tests/`, `*.h`, `*.hpp`, `*.lib`, `*.pdb`, unused `cv2/data/*.xml`.

- [ ] **Step 4: Run tests & measure startup RSS**

Run:
`C:\Users\dhima\projects\ac-venv\Scripts\python.exe -m pytest backend/tests -q -p no:cacheprovider`
Measure startup RSS & duration (`read_rss_mb()`) and record in ledger.

- [ ] **Step 5: Commit**
Update `tasks/sp3-ledger.md` and `tasks/PROGRESS-LOG.md`, then commit without pushing.

---

### Task 2: Pinned SHA-256 Optional Runtime Add-on Manager (`backend/addons.py`) & Settings Endpoints

**Files:**
- Create: `backend/addons.py`
- Modify: `backend/main.py` (startup `addons.activate_installed()`, `GET /api/settings/addons`, `POST /api/settings/addons/{addon_id}/download`, `DELETE /api/settings/addons/{addon_id}`)
- Modify: `backend/ai_utils.py` (call `addons.activate_installed()` at start of `_transcribe_with_faster_whisper`)
- Test: `backend/tests/test_addons.py` (create)

**Interfaces:**
- Produces in `backend/addons.py`:
  - `PINNED_ADDONS: dict`: hardcoded pinned versions, HTTPS URLs (`files.pythonhosted.org`, `storage.googleapis.com`), exact byte sizes, and lowercase hex SHA-256 digests:
    - `"cuda"`: `{"win_amd64": {"package": "nvidia-cublas-cu12", "version": "12.9.2.10", "url": "https://files.pythonhosted.org/packages/20/e2/fc9a0e985249d873150276d5afb02e39a66817fedbf1a385724393e505ed/nvidia_cublas_cu12-12.9.2.10-py3-none-win_amd64.whl", "size": 553162896, "sha256": "623f43027d40d44ceadf0043f002bd25cf353e8f13ce90b9a87057019f560661"}}`
    - `"mediapipe"`:
      - `wheels_by_platform`:
        - `"win_amd64"`: version `1.2.3`, url `https://files.pythonhosted.org/packages/a8/b8/e1b66b6adc856a2af7b995d69ddebee73a0368b95f1f2361aed2cd6f9748/mediapipe-1.2.3-py3-none-win_amd64.whl`, size `25678743`, sha256 `2e2ebc8ae2c11ae032753bc3cafad5142ef0b755448509122bc6c1442bd19676`
        - `"win_arm64"`: version `1.2.3`, url `https://files.pythonhosted.org/packages/41/d0/5424adc1594d4951102c460fa9e71f714ba9b4ce38c49f10db39da8f3131/mediapipe-1.2.3-py3-none-win_arm64.whl`, size `22307061`, sha256 `9b3871f1faeb6eb69c28675ea78cff7e45bb6dd2dc72b0d3d07ee06f73144976`
        - `"macosx_arm64"`: version `1.2.3`, url `https://files.pythonhosted.org/packages/8a/31/5dcba256f3d7c02cabc834628006aa36c7b36752f1df18082e3dae6229fa/mediapipe-1.2.3-py3-none-macosx_11_0_arm64.whl`, size `38679054`, sha256 `077ef409d79ef274b076d47a744018af5f7487c09a1d237e9d2f707d33e39867`
        - `"linux_x86_64"`: version `1.2.3`, url `https://files.pythonhosted.org/packages/31/2a/5217e7c5d9984f71fedcc6b33862f6141178ac598d06b0d4b81ea647b9fc/mediapipe-1.2.3-py3-none-manylinux_2_28_x86_64.whl`, size `43342798`, sha256 `1fcda646cc7b96f73453acc416ce31d0fba287d0f1fc095865272a7ea6986497`
        - `"linux_aarch64"`: version `1.2.3`, url `https://files.pythonhosted.org/packages/bf/ec/d29126f33b5c8de9b4ad70b2cf17d06853f3d9c13d8228a1e4c1887e630e/mediapipe-1.2.3-py3-none-manylinux_2_28_aarch64.whl`, size `40704840`, sha256 `59d55f6395efbda2a053a8db18f598277e63c264f9a6f65a819c23d92b90fed8`
      - `common`:
        - `flatbuffers==25.12.19`: url `https://files.pythonhosted.org/packages/e8/2d/d2a548598be01649e2d46231d151a6c56d10b964d94043a335ae56ea2d92/flatbuffers-25.12.19-py2.py3-none-any.whl`, size `26661`, sha256 `7634f50c427838bb021c2d66a3d1168e9d199b0607e6329399f04846d42e20b4`
        - `absl-py==2.5.1`: url `https://files.pythonhosted.org/packages/b3/7d/01e62f59e4166af1be6238d9f2b7f3453630c51b8044b412d05b5606532a/absl_py-2.5.1-py3-none-any.whl`, size `137673`, sha256 `721200f2f0e9960f2ca9dc3a2a706b201f5f75d812c158f059cbbe29eeafbdb8`
        - `face_landmarker.task`: url `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`, size `3758596`, sha256 `64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff`
  - `get_addon_statuses()`, `start_addon_download(addon_id)`, `install_addon_sync(addon_id)`, `remove_addon(addon_id)`, `activate_installed()`, `ensure_mediapipe_importable()`.
- Produces in `backend/main.py`: `GET /api/settings/addons`, `POST /api/settings/addons/{addon_id}/download`, `DELETE /api/settings/addons/{addon_id}`.

- [ ] **Step 1: Write failing tests in `backend/tests/test_addons.py`**

```python
import hashlib
import io
import pytest
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
        addons, "_download_bytes_to_file",
        lambda url, dest, cb: (dest.write_bytes(wheel_bytes), cb(len(wheel_bytes), len(wheel_bytes))),
    )

    addons.install_addon_sync("cuda")
    assert addons.is_addon_installed("cuda") is True
    assert (tmp_path / "addons" / "cuda" / "bin" / "cublas64_12.dll").read_bytes() == b"cublas-dll"
    assert (tmp_path / "addons" / "cuda" / "bin" / "cublasLt64_12.dll").read_bytes() == b"cublasLt-dll"
    assert not (tmp_path / "addons" / "cuda" / "bin" / "cublas.h").exists()


def test_addon_install_rejects_sha256_mismatch(tmp_path, monkeypatch):
    monkeypatch.setattr(addons, "get_app_data_dir", lambda: str(tmp_path))
    monkeypatch.delenv("AUTO_CLIPPER_CLOUD_MODE", raising=False)
    monkeypatch.setattr(addons.sys, "platform", "win32")
    monkeypatch.setattr(addons, "_cuda_count", lambda: 1)

    monkeypatch.setattr(
        addons, "_download_bytes_to_file",
        lambda url, dest, cb: dest.write_bytes(b"corrupted"),
    )
    with pytest.raises(ValueError, match="SHA-256|sha256|checksum"):
        addons.install_addon_sync("cuda")
    assert addons.is_addon_installed("cuda") is False


def test_mediapipe_addon_install_uses_pinned_artifacts_and_remove(tmp_path, monkeypatch):
    monkeypatch.setattr(addons, "get_app_data_dir", lambda: str(tmp_path))
    monkeypatch.delenv("AUTO_CLIPPER_CLOUD_MODE", raising=False)
    monkeypatch.setattr(addons, "_mediapipe_platform_key", lambda: "win_amd64")

    mp_whl, mp_sha = _make_wheel({"mediapipe/__init__.py": b"__version__ = '1.2.3'", "mediapipe/tasks/c/libmediapipe.dll": b"mp"})
    fb_whl, fb_sha = _make_wheel({"flatbuffers/__init__.py": b"ok"})
    ab_whl, ab_sha = _make_wheel({"absl/__init__.py": b"ok"})
    task_bytes = b"tflite-model"
    task_sha = hashlib.sha256(task_bytes).hexdigest()

    mp_entry = dict(addons.PINNED_ADDONS["mediapipe"]["wheels"]["win_amd64"], sha256=mp_sha, size=len(mp_whl))
    monkeypatch.setitem(addons.PINNED_ADDONS["mediapipe"]["wheels"], "win_amd64", mp_entry)
    monkeypatch.setitem(addons.PINNED_ADDONS["mediapipe"], "common", [
        {"name": "flatbuffers", "kind": "wheel", "url": "https://files.pythonhosted.org/fb.whl", "size": len(fb_whl), "sha256": fb_sha},
        {"name": "absl-py", "kind": "wheel", "url": "https://files.pythonhosted.org/ab.whl", "size": len(ab_whl), "sha256": ab_sha},
        {"name": "face_landmarker.task", "kind": "file", "url": "https://storage.googleapis.com/mediapipe-models/face_landmarker.task", "size": len(task_bytes), "sha256": task_sha},
    ])

    payloads = {
        mp_entry["url"]: mp_whl,
        "https://files.pythonhosted.org/fb.whl": fb_whl,
        "https://files.pythonhosted.org/ab.whl": ab_whl,
        "https://storage.googleapis.com/mediapipe-models/face_landmarker.task": task_bytes,
    }
    monkeypatch.setattr(
        addons, "_download_bytes_to_file",
        lambda url, dest, cb: (dest.write_bytes(payloads[url]), cb(len(payloads[url]), len(payloads[url]))),
    )

    addons.install_addon_sync("mediapipe")
    assert addons.is_addon_installed("mediapipe") is True
    assert (tmp_path / "addons" / "mediapipe" / "face_landmarker.task").read_bytes() == task_bytes

    addons.remove_addon("mediapipe")
    assert addons.is_addon_installed("mediapipe") is False


def test_addons_endpoints_validate_id_cloud_mode_and_macos_intel(monkeypatch):
    client = TestClient(app)
    assert client.get("/api/settings/addons").status_code == 200
    assert client.post("/api/settings/addons/unknown/download").status_code == 404

    monkeypatch.setattr(addons, "_mediapipe_platform_key", lambda: None)
    assert client.get("/api/settings/addons").json()["addons"]["mediapipe"]["available"] is False

    monkeypatch.setenv("AUTO_CLIPPER_CLOUD_MODE", "1")
    monkeypatch.setenv("AUTO_CLIPPER_WEB_TOKEN", "tok")
    assert client.get("/api/settings/addons", headers={"Authorization": "Bearer tok"}).json()["addons"]["mediapipe"]["available"] is False
    assert client.post("/api/settings/addons/mediapipe/download", headers={"Authorization": "Bearer tok"}).status_code == 400
```

- [ ] **Step 2: Run tests to verify failure**
Run: `C:\Users\dhima\projects\ac-venv\Scripts\python.exe -m pytest backend/tests/test_addons.py -q -p no:cacheprovider`

- [ ] **Step 3: Implement `backend/addons.py`, startup hook & endpoints in `backend/main.py`, and hook in `backend/ai_utils.py`**
Key contract points:
- Zero network calls to PyPI JSON API at download time: read `url`, `size`, and `sha256` exclusively from `PINNED_ADDONS`.
- Validate host allowlist (`pypi.org`, `files.pythonhosted.org`, `storage.googleapis.com`), compute SHA-256 + byte count on download, fail & clean `.part` on mismatch.
- `activate_installed()` registers `<app_data_dir>/addons/cuda/bin` via `os.add_dll_directory()` + `PATH` when present; `ensure_mediapipe_importable()` puts `<app_data_dir>/addons/mediapipe` in `sys.path` and stubs `matplotlib`/`matplotlib.pyplot`/`sounddevice` when absent.

- [ ] **Step 4: Run tests & commit**
Run: `C:\Users\dhima\projects\ac-venv\Scripts\python.exe -m pytest backend/tests/test_addons.py backend/tests/test_startup_lazy.py -q -p no:cacheprovider`
Update ledger + progress log, commit without pushing.

---

### Task 3: Windows GPU Preflight Check, Dual MediaPipe API (`FaceLandmarker` + `FaceMesh`) with Clear Fallback Metadata, & Whisper `gpu_ready`

**Files:**
- Modify: `backend/preflight.py:103-135, 268-291`
- Modify: `backend/crop_utils.py:132-182, 450-510, 1670-1680`
- Modify: `backend/jobs.py:805-820, 1005-1025` (propagate `tracking_engine_requested` and `tracking_fallback_reason` into `metadata`)
- Modify: `backend/ai_utils.py:481-496` (add `get_whisper_status()`)
- Modify: `backend/main.py:362-370` (add `gpu_ready` and `processor_slow_models` to `/api/settings/whisper-models`)
- Test: `backend/tests/test_preflight.py`, `backend/tests/test_crop_utils.py`

**Interfaces:**
- Consumes: `backend.addons.activate_installed()`, `backend.addons.ensure_mediapipe_importable()`.
- Produces:
  - `preflight._whisper_gpu_libs_missing()` checks `cublas64_12.dll` on Windows via `ctypes.WinDLL`.
  - `preflight.check_gpu()` on Windows points plainly to **Pengaturan → Lanjutan → Model subtitle** without banned words.
  - `crop_utils._open_face_mesh()` supports `FaceMesh` and `FaceLandmarker`, recording `info["fallback_reason"] = "addon_not_installed"` (logged via `log_app`) when `engine == "mediapipe"` falls back to `"haar"` because neither `solutions` nor `<addons>/mediapipe` is available.
  - `jobs.py` sets `metadata["tracking_engine_requested"]` (`"mediapipe"` or `"haar"`) and `metadata["tracking_fallback_reason"]` (when fallen back) as soon as tracking resolves.
  - `GET /api/settings/whisper-models` returns `{"status": "success", "models": [...], "gpu_ready": bool, "processor_slow_models": ["medium", "large-v3"]}`.

- [ ] **Step 1: Write failing tests in `backend/tests/test_preflight.py` and `backend/tests/test_crop_utils.py`**
Add tests verifying:
1. Windows `check_gpu()` missing `cublas64_12.dll` returns `warn` mentioning Settings without `MAIN_SCREEN_BANNED` terms.
2. `_whisper_gpu_libs_missing()` checks `ctypes.WinDLL("cublas64_12.dll")` on Windows.
3. `_FaceLandmarkerAdapter` detects landmarks (`w == 0.2`) and closes properly in `finally`.
4. Calling `sample_face_trajectory(..., engine="mediapipe", info=info)` when `mediapipe` is missing falls back to `info["engine_used"] == "haar"` and sets `info["fallback_reason"] == "addon_not_installed"`.
5. `GET /api/settings/whisper-models` returns `"gpu_ready"` (`bool`) and `"processor_slow_models": ["medium", "large-v3"]`.

- [ ] **Step 2: Run tests to verify failure**
- [ ] **Step 3: Implement changes in `preflight.py`, `crop_utils.py`, `jobs.py`, `ai_utils.py`, `main.py`**
- [ ] **Step 4: Run tests & commit**
Run: `C:\Users\dhima\projects\ac-venv\Scripts\python.exe -m pytest backend/tests/test_preflight.py backend/tests/test_crop_utils.py backend/tests/test_addons.py -q -p no:cacheprovider`
Update ledger + progress log, commit without pushing.

---

### Task 4: Output Directory Security (`T1.y`) & Custom Desktop Output Folder Playback/Save

**Files:**
- Modify: `backend/workspace.py` (`allowed_project_output_dirs`)
- Modify: `backend/jobs.py:156-189` (`get_project_workspace` validates `library_dir` via `path_guard`)
- Modify: `backend/main.py:451-468, 506-539, 798-829, 1003-1027, 1029-1088` (`_resolve_safe_output_dir`, `GET /video`, `POST /save_file`)
- Test: `backend/tests/test_output_dir.py` (create)

**Interfaces:**
- Produces: `_resolve_safe_output_dir`, `allowed_project_output_dirs(active_jobs)`.

- [ ] **Step 1: Write failing tests in `backend/tests/test_output_dir.py`** (testing Cloud/Local-Web `output_dir` clamping on `/jobs` + `/jobs/manual` + `/jobs/{id}/rerender` + `/jobs/{id}/rerun_ai`, Desktop `403 Access denied` on protected `output_dir`, and `/video` + `/save_file` allowlisting of valid Desktop project `output_dir` while refusing arbitrary outside files).
- [ ] **Step 2: Run tests to verify failure**
- [ ] **Step 3: Implement `output_dir` sanitization and project output allowlisting**
- [ ] **Step 4: Run tests & commit**
Run: `C:\Users\dhima\projects\ac-venv\Scripts\python.exe -m pytest backend/tests/test_output_dir.py backend/tests/test_path_guard.py -q -p no:cacheprovider`
Update ledger + progress log, commit without pushing.

---

### Task 5: Frontend Add-on UI (`useAddons`, `TranscriptionSection`, `FaceTrackingSection`), Fallback Notice (`ProgressPanel`), & Locale Keys

**Files:**
- Create: `src/hooks/useAddons.ts`
- Create: `src/components/settings/FaceTrackingSection.tsx`
- Create: `src/components/settings/FaceTrackingSection.test.tsx`
- Modify: `src/components/settings/TranscriptionSection.tsx` (+ `TranscriptionSection.test.tsx`)
- Modify: `src/pages/SettingsPage.tsx:59-72`
- Modify: `src/lib/progress.ts` (+ `src/lib/progress.test.ts`)
- Modify: `src/pages/CreatePage.tsx` (pass `trackingRequested`/`trackingUsed` or `liveMeta` into `ProgressPanel` or include `"fallback_tracking"` inside `deviceNotes`)
- Modify: `src/components/create/ProgressPanel.tsx` (+ `ProgressPanel.test.tsx`)
- Modify: `src/locales/id.json`, `src/locales/en.json`

**Interfaces:**
- Consumes: `/api/settings/addons`, `/api/settings/whisper-models` (`gpu_ready`), `metadata.tracking_engine_requested`, `metadata.tracking_engine_used`, `metadata.timings`.
- Produces:
  - `AddonStatus`, `useAddons()` in `src/hooks/useAddons.ts`
  - `FaceTrackingSection` component in `src/components/settings/FaceTrackingSection.tsx`
  - `DeviceNote` union extended to `"cpu_subtitle" | "cpu_render" | "fallback_tracking"` in `src/lib/progress.ts`; `deviceNotes(current, timings, stages, meta?)` emits `"fallback_tracking"` when `meta?.tracking_engine_requested === "mediapipe"` and `tracking_engine_used === "haar"` (or timing row shows fallback).

- [ ] **Step 1: Add locale keys via `node scripts/add-locale-keys.mjs`** (checking `plainWords.test.ts` banned list: NO `transkripsi`, `transcription`, `render`, `encoder`, `json`, `sidecar`, `token`, `prompt`, `backend`, `ffmpeg`, `nvenc`, `cuda`, `whisper`, NO emoji, NO `—` in `create.*`, `progress.*`, or any locale text):
  - `progress.fallback_tracking`: `"Pelacak teliti belum terpasang, jadi video ini memakai cara Standar. Pasang komponennya di Pengaturan bila dibutuhkan."` / `"The precise tracker add-on is not installed yet, so this video uses Standard mode. Install it in Settings when needed."`
  - `settings.whisper_cpu_note`, `settings.addon_gpu_title`, `settings.addon_gpu_desc`, `settings.addon_gpu_install`, `settings.addon_gpu_remove`, `settings.addon_gpu_ready`, `settings.addon_face_title`, `settings.addon_face_desc`, `settings.addon_face_fallback_note` (*"Komponen pelacak teliti belum terpasang. Selama belum dipasang, aplikasi otomatis memakai mode Standar."*), `settings.addon_face_install`, `settings.addon_face_remove`, `settings.addon_face_ready`, `settings.addon_face_unavailable`, `settings.addon_downloading`, `settings.addon_download_failed`, `settings.addon_remove_failed`
  - `create.cpu_model_title`, `create.cpu_model_body`, `create.cpu_model_use_fast`, `create.cpu_model_keep_accurate`

- [ ] **Step 2: Write failing tests in `TranscriptionSection.test.tsx`, `FaceTrackingSection.test.tsx`, and `src/lib/progress.test.ts`**

In `src/components/settings/TranscriptionSection.test.tsx` (append inside `describe` block; remember Ruling P15: pass `useAddons` or mock `axios.get` for both `/api/settings/whisper-models` and `/api/settings/addons`):
```tsx
  it("shows CPU warning for medium/large-v3 when gpu_ready is false and renders Windows GPU addon card", async () => {
    vi.mocked(axios.get).mockImplementation(async (url: string) => {
      if (url.endsWith("/api/settings/addons")) {
        return {
          data: {
            status: "success",
            addons: {
              cuda: { id: "cuda", available: true, installed: false, downloading: false, percent: 0, downloaded_mb: 0, total_mb: 0, size_hint_mb: 528, disk_mb: 0 },
              mediapipe: { id: "mediapipe", available: true, installed: false, downloading: false, percent: 0, downloaded_mb: 0, total_mb: 0, size_hint_mb: 35, disk_mb: 0 },
            },
          },
        };
      }
      return { data: { status: "success", models: [model("small", true), model("medium", true)], gpu_ready: false, processor_slow_models: ["medium", "large-v3"] } };
    });
    vi.mocked(axios.post).mockResolvedValueOnce({
      data: { status: "success", addon: { id: "cuda", available: true, installed: false, downloading: true, percent: 10, downloaded_mb: 50, total_mb: 528, size_hint_mb: 528, disk_mb: 0 } },
    });

    await render("medium");

    expect(container.textContent).toContain(i18n.t("settings.whisper_cpu_note"));
    const installBtn = [...container.querySelectorAll("button")].find((b) => b.textContent?.includes(i18n.t("settings.addon_gpu_install")))!;
    expect(installBtn).toBeTruthy();
    await act(async () => installBtn.click());
    expect(vi.mocked(axios.post)).toHaveBeenCalledWith(`${API}/api/settings/addons/cuda/download`);
  });
```

In `src/components/settings/FaceTrackingSection.test.tsx`:
```tsx
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import axios from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../../i18n";
import { setApiUrl } from "../../platform/backendUrl";
import { FaceTrackingSection } from "./FaceTrackingSection";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("axios", () => ({ default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }));

describe("FaceTrackingSection", () => {
  const API = "http://127.0.0.1:5123";
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    await i18n.changeLanguage("id");
    setApiUrl(API);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.resetAllMocks();
  });

  it("shows fallback note and install button when Teliti is chosen without addon installed", async () => {
    vi.mocked(axios.get).mockResolvedValue({
      data: {
        status: "success",
        addons: {
          mediapipe: { id: "mediapipe", available: true, installed: false, downloading: false, percent: 0, downloaded_mb: 0, total_mb: 0, size_hint_mb: 35, disk_mb: 0 },
        },
      },
    });
    vi.mocked(axios.post).mockResolvedValueOnce({
      data: { status: "success", addon: { id: "mediapipe", available: true, installed: false, downloading: true, percent: 25, downloaded_mb: 8, total_mb: 35, size_hint_mb: 35, disk_mb: 0 } },
    });

    await act(async () => root.render(<FaceTrackingSection value="mediapipe" onChange={vi.fn()} />));

    expect(container.textContent).toContain(i18n.t("settings.addon_face_fallback_note"));
    const installBtn = [...container.querySelectorAll("button")].find((b) => b.textContent?.includes(i18n.t("settings.addon_face_install")))!;
    await act(async () => installBtn.click());
    expect(vi.mocked(axios.post)).toHaveBeenCalledWith(`${API}/api/settings/addons/mediapipe/download`);
  });

  it("shows remove button when mediapipe addon is installed", async () => {
    vi.mocked(axios.get).mockResolvedValue({
      data: {
        status: "success",
        addons: {
          mediapipe: { id: "mediapipe", available: true, installed: true, downloading: false, percent: 100, downloaded_mb: 35, total_mb: 35, size_hint_mb: 35, disk_mb: 35 },
        },
      },
    });
    vi.mocked(axios.delete).mockResolvedValueOnce({
      data: { status: "success", addon: { id: "mediapipe", available: true, installed: false, downloading: false, percent: 0, downloaded_mb: 0, total_mb: 0, size_hint_mb: 35, disk_mb: 0 } },
    });

    await act(async () => root.render(<FaceTrackingSection value="mediapipe" onChange={vi.fn()} />));

    const removeBtn = [...container.querySelectorAll("button")].find((b) => b.textContent?.includes(i18n.t("settings.addon_face_remove")))!;
    await act(async () => removeBtn.click());
    expect(vi.mocked(axios.delete)).toHaveBeenCalledWith(`${API}/api/settings/addons/mediapipe`);
  });
});
```

In `src/lib/progress.test.ts` (append test for `fallback_tracking`):
```ts
  it("reports fallback_tracking when mediapipe was requested but haar ran", () => {
    expect(
      deviceNotes(null, [{ stage: "tracking", seconds: 5, tracking_engine_used: "haar" }], ["tracking", "render", "publish"], {
        tracking_engine_requested: "mediapipe",
        tracking_engine_used: "haar",
      }),
    ).toContain("fallback_tracking");
  });
```

- [ ] **Step 3: Run tests to verify failure**
Run: `npx vitest run src/components/settings/TranscriptionSection.test.tsx src/components/settings/FaceTrackingSection.test.tsx src/lib/progress.test.ts` (from `C:\Users\dhima\projects\auto-clipper`).

- [ ] **Step 4: Implement `useAddons.ts`, `FaceTrackingSection.tsx`, `TranscriptionSection.tsx`, `SettingsPage.tsx`, `progress.ts`, and `ProgressPanel.tsx`**
Note: preserve existing `TranscriptionSection.test.tsx` assertions cleanly (when `/api/settings/addons` fails or isn't mocked in older tests, `useAddons` degrades quietly without breaking whisper model selection!). Also wrap `useAddons` / `axios.delete` safely in `FaceTrackingSection` and call `preflight.recheck()` / window event or callback after `cuda` install so CreatePage preflight stays fresh.

- [ ] **Step 5: Run Vitest + locale/plainWords/contrast + lint + builds & commit**
Run: `npx vitest run`, `npx oxlint src`, `npm run build`, `npm run build:cloud`.
Update `tasks/sp3-ledger.md` and `tasks/PROGRESS-LOG.md`, commit without pushing.

---

### Task 6: CreatePage CPU Whisper Confirmation Dialog, Benchmarks, Docs & Final Verification

**Files:**
- Modify: `src/hooks/useClipJobs.ts:263-355` (add optional third arg `overrideWhisperModel?: string` on `handleGenerate`)
- Modify: `src/App.tsx` (type & pass-through `overrideWhisperModel` if `handleGenerate` signature is typed in context)
- Modify: `src/pages/CreatePage.tsx:102-177` (CPU model confirmation `Dialog`)
- Modify: `src/pages/CreatePage.test.tsx`
- Create: `docs/decisions/015-sp3-lightweight-addons-and-output-dir.md`
- Modify: `.agents/AGENTS.md`, `CHANGELOG.md`, `tasks/roadmap-todo.md`, `tasks/sp3-ledger.md`, `tasks/PROGRESS-LOG.md`, `tasks/HANDOFF-AI.md`

**Interfaces:**
- Consumes: `preflight.checks` (specifically `gpuCheck = preflight.checks.find(c => c.id === 'gpu')`), `ctx.whisperModel`, `ctx.setWhisperModel`, `ctx.handleGenerate(provider, title, overrideWhisperModel?)`.
- Produces: When user clicks **Mulai** (`start()` in `CreatePage.tsx`) and `["medium", "large-v3"].includes(ctx.whisperModel)` and `gpuCheck?.level === "warn"`, `CreatePage` opens a `Dialog` with:
  - Filled primary button (`create.cpu_model_use_fast`): closes dialog, calls `ctx.setWhisperModel?.("small")`, and calls `ctx.handleGenerate(effectiveProvider(...), title, "small")`.
  - Outline secondary button (`create.cpu_model_keep_accurate`): closes dialog and calls `ctx.handleGenerate(effectiveProvider(...), title, ctx.whisperModel)`.
  - When `gpuCheck?.level !== "warn"`, `start()` calls `ctx.handleGenerate(...)` directly with no dialog.

- [ ] **Step 1: Write failing tests in `src/pages/CreatePage.test.tsx`**
Also update `makeContext()` in `CreatePage.test.tsx` to include default `whisperModel: "small"`, `setWhisperModel: vi.fn()`, and append:
```tsx
  it("prompts before starting when medium/large-v3 is active and preflight gpu check warns, letting user switch to small", async () => {
    setPlatform({ caps: CAPS.desktop, pickVideo: vi.fn() } as unknown as Platform);
    vi.spyOn(axios, "get").mockResolvedValue({
      data: { checks: [{ id: "gpu", level: "warn", title: "Subtitle memakai prosesor", message: "Lambat." }] },
    });
    const file = new File(["video"], "podcast.mp4", { type: "video/mp4" });
    const handleGenerate = vi.fn();
    const setWhisperModel = vi.fn();
    await renderPage({
      inputType: "local",
      localFile: file,
      whisperModel: "medium",
      setWhisperModel,
      handleGenerate,
      aiMode: "manual",
      provider: "openai",
    });

    act(() => startButton().click());
    expect(handleGenerate).not.toHaveBeenCalled();
    expect(container.textContent).toContain(i18n.t("create.cpu_model_title"));

    const fastBtn = [...container.querySelectorAll("button")].find((b) => b.textContent === i18n.t("create.cpu_model_use_fast"))!;
    act(() => fastBtn.click());
    expect(setWhisperModel).toHaveBeenCalledWith("small");
    expect(handleGenerate).toHaveBeenCalledWith("manual_ai", expect.stringMatching(/^podcast /), "small");
  });

  it("lets user keep accurate whisper model from CPU confirmation dialog", async () => {
    setPlatform({ caps: CAPS.desktop, pickVideo: vi.fn() } as unknown as Platform);
    vi.spyOn(axios, "get").mockResolvedValue({
      data: { checks: [{ id: "gpu", level: "warn", title: "Subtitle memakai prosesor", message: "Lambat." }] },
    });
    const file = new File(["video"], "short.mp4", { type: "video/mp4" });
    const handleGenerate = vi.fn();
    await renderPage({
      inputType: "local",
      localFile: file,
      whisperModel: "large-v3",
      setWhisperModel: vi.fn(),
      handleGenerate,
      aiMode: "manual",
      provider: "openai",
    });

    act(() => startButton().click());
    const keepBtn = [...container.querySelectorAll("button")].find((b) => b.textContent === i18n.t("create.cpu_model_keep_accurate"))!;
    act(() => keepBtn.click());
    expect(handleGenerate).toHaveBeenCalledWith("manual_ai", expect.stringMatching(/^short /), "large-v3");
  });

  it("starts immediately without CPU dialog when preflight gpu check is ok", async () => {
    setPlatform({ caps: CAPS.desktop, pickVideo: vi.fn() } as unknown as Platform);
    vi.spyOn(axios, "get").mockResolvedValue({
      data: { checks: [{ id: "gpu", level: "ok", title: "GPU aktif", message: "Cepat." }] },
    });
    const file = new File(["video"], "gpu.mp4", { type: "video/mp4" });
    const handleGenerate = vi.fn();
    await renderPage({
      inputType: "local",
      localFile: file,
      whisperModel: "medium",
      setWhisperModel: vi.fn(),
      handleGenerate,
      aiMode: "manual",
      provider: "openai",
    });

    act(() => startButton().click());
    expect(container.textContent).not.toContain(i18n.t("create.cpu_model_title"));
    expect(handleGenerate).toHaveBeenCalledWith("manual_ai", expect.stringMatching(/^gpu /));
  });
```
*(Update `CreatePage.tsx` `start()` so direct start keeps the 2-arg call `ctx.handleGenerate(provider, title)` when `ctx.whisperModel` doesn't need override — this keeps existing `CreatePage.test.tsx` assertion `toHaveBeenCalledWith("manual_ai", ...)` 100% green!)*

- [ ] **Step 2: Run `CreatePage.test.tsx` to verify failure**
Run: `npx vitest run src/pages/CreatePage.test.tsx` (from `C:\Users\dhima\projects\auto-clipper`).

- [ ] **Step 3: Implement CPU confirmation dialog in `CreatePage.tsx` and `overrideWhisperModel` in `useClipJobs.ts`**

- [ ] **Step 4: Run full backend + frontend verification & capture before/after benchmarks**
Run:
- `C:\Users\dhima\projects\ac-venv\Scripts\python.exe -m pytest backend/tests -q -p no:cacheprovider`
- `npx vitest run`
- `npx oxlint src`
- `npm run build`
- `npm run build:cloud`
- Measure `import backend.main` + `run_preflight()` + `import backend.jobs` startup time & RSS and record before/after comparison (baseline: `43.5 MB / 0.63 s` → `88.1 MB / +1.90 s` → `119.9 MB / +1.24 s`) in ADR-015 & `tasks/PROGRESS-LOG.md`.

- [ ] **Step 5: Update docs & commit**
Write `docs/decisions/015-sp3-lightweight-addons-and-output-dir.md`, update `.agents/AGENTS.md` (close `T1.y`, add `addons` & pinned-SHA-256 invariant, update `mediapipe` optional note), `CHANGELOG.md`, `tasks/roadmap-todo.md`, `tasks/sp3-ledger.md`, `tasks/PROGRESS-LOG.md`, and `tasks/HANDOFF-AI.md`, then commit without pushing.
