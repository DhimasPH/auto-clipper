import multiprocessing
if __name__ == "__main__":
    multiprocessing.freeze_support()

from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
from typing import List, Optional
from backend.db import init_db, get_all_history, delete_history, get_app_data_dir
from backend.logger import log_error, get_log_content
import os
import sys
import shutil
import re
import secrets
from starlette.requests import Request

# --- Frozen-mode stdout guard & SSL Cert Setup ---
# In PyInstaller bundles, some libraries (ctranslate2, onnxruntime, etc.)
# may print to stdout on first import, breaking the PORT:/TOKEN: handshake.
# We capture stdout until we're ready to emit the handshake lines.
_original_stdout = None
_original_stderr = None

if getattr(sys, 'frozen', False):
    import io
    _original_stdout = sys.stdout
    _original_stderr = sys.stderr
    sys.stdout = io.StringIO()
    sys.stderr = io.StringIO()

    # Configure SSL certificates for requests / httpx in frozen bundle
    try:
        import certifi
        cert_path = certifi.where()
        if os.path.exists(cert_path):
            os.environ.setdefault("SSL_CERT_FILE", cert_path)
            os.environ.setdefault("REQUESTS_CA_BUNDLE", cert_path)
    except Exception:
        pass

def handle_uncaught_exception(exc_type, exc_value, exc_traceback):
    if issubclass(exc_type, KeyboardInterrupt):
        if _original_stdout is not None:
            sys.stdout = _original_stdout
        if _original_stderr is not None:
            sys.stderr = _original_stderr
        sys.__excepthook__(exc_type, exc_value, exc_traceback)
        return
    log_error("Global Uncaught Exception", f"{exc_type.__name__}: {exc_value}")
    if _original_stderr is not None:
        try:
            _original_stderr.write(f"[FATAL] {exc_type.__name__}: {exc_value}\n")
            _original_stderr.flush()
        except Exception:
            pass

sys.excepthook = handle_uncaught_exception


API_SECRET_TOKEN = os.environ.get("AUTO_CLIPPER_WEB_TOKEN") or os.environ.get("AUTO_CLIPPER_DEV_TOKEN") or secrets.token_hex(32)

# Tambahkan folder bin ke PATH agar FFmpeg dan dependensi lain bisa ditemukan di dev mode maupun bundle mode.
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
bin_paths = [
    os.path.join(project_root, "bin"),
    os.path.join(project_root, "src-tauri", "bin"),
]
if getattr(sys, 'frozen', False):
    bin_dir = os.path.dirname(sys.executable)
    bin_paths.extend([
        bin_dir,
        os.path.dirname(bin_dir),
        os.path.join(bin_dir, "bin"), # Windows resource path
        os.path.join(os.path.dirname(bin_dir), "Resources", "bin") # macOS resource path
    ])

valid_paths = [p for p in bin_paths if os.path.isdir(p)]
if valid_paths:
    os.environ["PATH"] = os.pathsep.join(valid_paths) + os.pathsep + os.environ.get("PATH", "")

# Initialize DB on startup
init_db()

app = FastAPI(title="Auto Clipper API")

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    log_error(f"FastAPI Unhandled [{request.method} {request.url.path}]", exc)
    return JSONResponse(
        status_code=500,
        content={"status": "error", "message": f"Internal Server Error: {str(exc)}"}
    )

app.add_middleware(
    CORSMiddleware,
    # Allow local dev and all variations of Tauri custom protocols (including tauri.localhost on Windows), plus cloud web app
    allow_origin_regex=r"https?://([a-zA-Z0-9_.-]+\.)?localhost(:\d+)?|https?://127\.0\.0\.1(:\d+)?|tauri://.*|app://.*|https://clipper\.dhims\.web\.id",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def verify_token(request: Request, call_next):
    # Biarkan endpoint tertentu tanpa token (video player tidak bisa mengirim header dengan mudah)
    path = request.url.path
    if request.method == "OPTIONS" or path.startswith("/video") or path in ["/health", "/heartbeat"]:
        return await call_next(request)
        
    # Enforce token verification in frozen bundles or cloud mode
    cloud_mode = bool(os.environ.get("AUTO_CLIPPER_CLOUD_MODE"))
    if not getattr(sys, 'frozen', False) and not cloud_mode:
        return await call_next(request)
        
    auth_header = request.headers.get("Authorization")
    token = os.environ.get("AUTO_CLIPPER_WEB_TOKEN") or os.environ.get("AUTO_CLIPPER_DEV_TOKEN") or API_SECRET_TOKEN
    if not auth_header or auth_header != f"Bearer {token}":
        return JSONResponse(status_code=401, content={"status": "error", "message": "Unauthorized API access"})
        
    return await call_next(request)

@app.post("/upload")
def api_upload_video(file: UploadFile = File(...)):
    temp_dir = os.path.abspath(os.path.join(get_app_data_dir(), "temp_downloads"))
    os.makedirs(temp_dir, exist_ok=True)
    file_path = os.path.join(temp_dir, f"upload_{file.filename}")
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    # Return local path prefixed with local: so jobs.py knows to skip download
    return {"status": "success", "url": f"local:{file_path}"}

@app.get("/probe")
def api_probe(url: str):
    """Return available video heights (descending) for a source URL."""
    if not url or url.startswith("local:") or not is_valid_source_url(url):
        return JSONResponse(status_code=400, content={"status": "error", "message": "URL tidak valid untuk probing."})
    try:
        from backend.video_utils import probe_formats
        return {"status": "success", "heights": probe_formats(url.strip())}
    except Exception as e:
        return JSONResponse(status_code=400, content={"status": "error", "message": str(e)})


@app.get("/health")
async def health_check():
    return {"status": "ok"}

from fastapi import Query

@app.get("/gdrive-browser")
def api_get_gdrive_browser(dir_path: str = Query("/content/drive/MyDrive")):
    if not os.environ.get("AUTO_CLIPPER_CLOUD_MODE"):
        return {"status": "error", "message": "Only available in Cloud Mode"}
    
    # Keamanan: pastikan path selalu berada di dalam /content/drive/MyDrive
    base_drive = os.path.abspath("/content/drive/MyDrive")
    target_path = os.path.abspath(dir_path)
    if not target_path.startswith(base_drive):
        target_path = base_drive
        
    if not os.path.exists(target_path):
        return {"status": "success", "items": [], "current_dir": target_path}
        
    items = []
    try:
        for f in os.listdir(target_path):
            full_path = os.path.join(target_path, f)
            is_dir = os.path.isdir(full_path)
            
            # Filter: Hanya tampilkan folder atau file video
            if not is_dir and not f.lower().endswith((".mp4", ".mov", ".mkv", ".webm")):
                continue
                
            items.append({
                "name": f,
                "is_dir": is_dir,
                "path": full_path
            })
            
        # Urutkan: folder di atas, lalu berdasarkan nama abjad
        items.sort(key=lambda x: (not x["is_dir"], x["name"].lower()))
        
    except Exception as e:
        log_error("Browsing GDrive", e)
        
    return {
        "status": "success", 
        "items": items, 
        "current_dir": target_path,
        "parent_dir": os.path.dirname(target_path) if target_path != base_drive else None
    }


last_heartbeat = 0.0


@app.post("/heartbeat")
async def api_heartbeat():
    global last_heartbeat
    import time
    last_heartbeat = time.monotonic()
    return {"status": "ok"}


class LogErrorPayload(BaseModel):
    context: str
    error_msg: str

@app.post("/log-error")
def handle_log_error(payload: LogErrorPayload):
    log_error(payload.context, payload.error_msg)
    return {"status": "ok"}


@app.get("/logs/{log_type}")
def api_get_logs(log_type: str):
    if log_type not in ("app", "error", "ai"):
        return JSONResponse(status_code=400, content={"status": "error", "message": "Invalid log type"})
    content = get_log_content(log_type)
    return {"status": "success", "log_type": log_type, "content": content}


class TestAiRequest(BaseModel):
    provider: str
    api_key: str
    custom_base_url: str = ""
    custom_model_name: str = ""
    model: str = ""

class FetchModelsRequest(BaseModel):
    provider: str
    api_key: str

class GenerateSocialKitRequest(BaseModel):
    description: str
    provider: str = "openai"
    api_key: str = ""
    custom_base_url: str = ""
    custom_model_name: str = ""
    model: str = ""

@app.post("/api/settings/test-ai")
def api_test_ai(req: TestAiRequest):
    try:
        from backend.ai_utils import ping_provider
        ping_provider(req.provider, req.api_key.strip(), req.custom_base_url.strip(), req.custom_model_name.strip(), model=req.model.strip() if req.model else None)
        return {"status": "success", "message": "API Key is valid!"}
    except Exception as e:
        return JSONResponse(status_code=400, content={"status": "error", "message": str(e)})

@app.post("/api/providers/models")
def api_fetch_models(req: FetchModelsRequest):
    """Fetch available models from a provider's API."""
    try:
        from backend.ai_utils import fetch_provider_models
        models = fetch_provider_models(req.provider, req.api_key.strip())
        return {"status": "success", "models": models}
    except Exception as e:
        return JSONResponse(status_code=400, content={"status": "error", "message": str(e)})


class TestPexelsRequest(BaseModel):
    api_key: str

@app.post("/api/settings/test-pexels")
def api_test_pexels(req: TestPexelsRequest):
    try:
        from backend.broll import ping_pexels
        ping_pexels(req.api_key.strip())
        return {"status": "success", "message": "Pexels API Key is valid!"}
    except Exception as e:
        return JSONResponse(status_code=400, content={"status": "error", "message": str(e)})


@app.get("/api/settings/whisper-models")
def api_get_whisper_models():
    try:
        from backend.ai_utils import get_available_whisper_models
        return {"status": "success", "models": get_available_whisper_models()}
    except Exception as e:
        log_error("api_get_whisper_models", e)
        return JSONResponse(status_code=500, content={"status": "error", "message": str(e)})


class DownloadWhisperModelRequest(BaseModel):
    model: str


@app.post("/api/settings/whisper-models/download")
def api_download_whisper_model(req: DownloadWhisperModelRequest):
    try:
        from backend.ai_utils import download_whisper_model
        res = download_whisper_model(req.model.strip())
        return res
    except Exception as e:
        log_error("api_download_whisper_model", e)
        return JSONResponse(status_code=400, content={"status": "error", "message": str(e)})


class CanvasConfig(BaseModel):
    enabled: bool = False
    background_type: str = "blur"      # "blur" | "color" | "image"
    blur_level: str = "medium"         # "light" | "medium" | "strong"
    background_color: str = "#000000"
    background_image_path: str = ""
    enlarge_scale: float = 1.0         # 1.0, 1.2, 1.5, 1.8, 2.0

class CreateJobRequest(BaseModel):
    url: str
    provider: str = "openai"
    api_key: str = ""
    aspect_ratio: str = "9:16"
    caption_style: str = "standard"
    burn_subs: bool = True
    output_dir: str = ""
    quality: str = "best"
    extra_prompt: str = ""
    title: str = ""
    enable_broll: bool = False
    pexels_api_key: str = ""
    max_clips: int = 0
    custom_base_url: str = ""
    custom_model_name: str = ""
    is_gaming_video: bool = False
    whisper_model: str = "small"
    model: str = ""
    canvas_config: Optional[CanvasConfig] = None
    subtitle_config: Optional[dict] = None

class SaveFileRequest(BaseModel):
    src: str
    dest: str

@app.post("/save_file")
def api_save_file(req: SaveFileRequest):
    try:
        abs_src = os.path.abspath(req.src)
        app_data = os.path.abspath(get_app_data_dir())
        # Only allow copying files that originate from our AppData directory
        if not abs_src.startswith(app_data):
            return JSONResponse(status_code=403, content={"status": "error", "message": "Hanya diperbolehkan menyalin file dari direktori internal aplikasi."})
            
        shutil.copy2(req.src, req.dest)
        return {"status": "success"}
    except Exception as e:
        return JSONResponse(status_code=400, content={"status": "error", "message": str(e)})

class OpenFolderRequest(BaseModel):
    path: str

@app.post("/open_folder")
def api_open_folder(req: OpenFolderRequest):
    try:
        import subprocess
        folder_path = req.path
        if not os.path.exists(folder_path):
            folder_path = os.path.dirname(req.path)
            
        if not os.path.exists(folder_path):
            return JSONResponse(status_code=404, content={"status": "error", "message": "Folder not found"})
            
        if os.path.isfile(folder_path):
            folder_path = os.path.dirname(folder_path)

        if sys.platform == 'win32':
            os.startfile(folder_path)
        elif sys.platform == 'darwin':
            subprocess.Popen(['open', folder_path])
        else:
            subprocess.Popen(['xdg-open', folder_path])
        return {"status": "success"}
    except Exception as e:
        return JSONResponse(status_code=400, content={"status": "error", "message": str(e)})

@app.post("/jobs/{job_id}/rerender")
def api_rerender_job(job_id: str, req: CreateJobRequest):
    try:
        from backend.jobs import create_rerender_job
        canvas_cfg = req.canvas_config.model_dump() if req.canvas_config else None
        new_job_id = create_rerender_job(job_id, req.aspect_ratio, req.burn_subs, req.output_dir, req.max_clips, canvas_config=canvas_cfg, subtitle_config=req.subtitle_config)
        return {"status": "success", "job_id": new_job_id}
    except Exception as e:
        return JSONResponse(status_code=400, content={"status": "error", "message": str(e)})

@app.post("/jobs/{job_id}/rerun_ai")
def api_rerun_ai_job(job_id: str, req: CreateJobRequest):
    try:
        from backend.ai_utils import ping_provider
        ping_provider(req.provider, req.api_key.strip(), req.custom_base_url.strip(), req.custom_model_name.strip(), model=req.model.strip() if req.model else None)
        from backend.jobs import create_rerun_ai_job
        canvas_cfg = req.canvas_config.model_dump() if req.canvas_config else None
        new_job_id = create_rerun_ai_job(
            job_id, req.provider, req.api_key.strip(),
            req.aspect_ratio, req.burn_subs, req.output_dir, req.extra_prompt, req.max_clips,
            req.custom_base_url.strip(), req.custom_model_name.strip(), req.whisper_model,
            req.model, canvas_config=canvas_cfg, subtitle_config=req.subtitle_config
        )
        return {"status": "success", "job_id": new_job_id}
    except Exception as e:
        return JSONResponse(status_code=400, content={"status": "error", "message": str(e)})

@app.get("/jobs/{job_id}/clips/{clip_index}/words")
async def get_clip_words(job_id: str, clip_index: int):
    from fastapi import HTTPException
    from backend.db import get_history
    history = get_history(job_id)
    if not history:
        raise HTTPException(status_code=404, detail="Job not found")

    clips = history.get("result_clips", [])
    if clip_index < 0 or clip_index >= len(clips):
        raise HTTPException(status_code=404, detail="Clip not found")

    clip = clips[clip_index]
    metadata = history.get("metadata", {})
    
    # Priority to custom edited words
    subtitle_path = clip.get("custom_subtitle_path") or metadata.get("subtitle_path")

    if not subtitle_path or not os.path.exists(subtitle_path):
        return {"words": [], "reason": "no_subtitle_file"}

    import json
    try:
        with open(subtitle_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        all_words = data.get("words", []) if isinstance(data, dict) else []
        if not all_words:
            return {"words": [], "reason": "no_words_in_file"}

        from backend.crop_utils import to_seconds
        start_s = to_seconds(clip.get("start"))
        end_s = to_seconds(clip.get("end"))

        # Filter words within clip bounds with 0.5s padding (matches crop_to_vertical PAD)
        pad = 0.5
        clip_words = []
        for w in all_words:
            w_start = w.get("start", 0)
            if w_start >= (start_s - pad) and w_start <= (end_s + pad):
                clip_words.append(w)

        return {"words": clip_words, "reason": None}
    except Exception as e:
        from backend.logger import log_error
        log_error("get_clip_words", e)
        return {"words": [], "reason": "read_error"}
class AICorrectSubtitleRequest(BaseModel):
    words: list
    provider: str
    api_key: str
    model: str = ""
    custom_base_url: str = ""
    custom_model_name: str = ""

@app.post("/api/ai/correct-subtitle")
async def api_ai_correct_subtitle(req: AICorrectSubtitleRequest):
    try:
        from backend.ai_utils import correct_subtitle_words_with_ai
        if not req.api_key and req.provider != "custom":
            raise ValueError("API Key is required for Auto mode.")
            
        corrected_words = correct_subtitle_words_with_ai(
            words=req.words,
            provider=req.provider,
            api_key=req.api_key.strip(),
            model=req.model.strip(),
            custom_base_url=req.custom_base_url.strip(),
            custom_model_name=req.custom_model_name.strip()
        )
        return {"status": "success", "words": corrected_words}
    except Exception as e:
        return JSONResponse(status_code=400, content={"status": "error", "message": str(e)})

class RerenderClipRequest(BaseModel):
    words: list
    aspect_ratio: str
    caption_style: str
    burn_subs: bool
    canvas_config: dict = None
    subtitle_config: dict = None

@app.post("/jobs/{job_id}/clips/{clip_index}/rerender")
async def api_rerender_clip(job_id: str, clip_index: int, req: RerenderClipRequest):
    from backend.jobs import create_rerender_clip_job
    new_job_id = create_rerender_clip_job(
        job_id=job_id,
        clip_index=clip_index,
        custom_words=req.words,
        aspect_ratio=req.aspect_ratio,
        caption_style=req.caption_style,
        burn_subs=req.burn_subs,
        canvas_config=req.canvas_config,
        subtitle_config=req.subtitle_config
    )
    return {"status": "success", "job_id": new_job_id}

from pydantic import BaseModel
from typing import Optional

class ResumeJobRequest(BaseModel):
    api_key: Optional[str] = None
    provider: Optional[str] = None
    custom_base_url: Optional[str] = None
    custom_model_name: Optional[str] = None
    whisper_model: Optional[str] = None
    model: Optional[str] = None

@app.post("/jobs/{job_id}/resume")
def api_resume_job(job_id: str, req: ResumeJobRequest):
    try:
        from backend.jobs import create_resume_job
        new_job_id = create_resume_job(
            job_id,
            fallback_api_key=req.api_key,
            fallback_provider=req.provider,
            fallback_custom_base_url=req.custom_base_url,
            fallback_custom_model_name=req.custom_model_name,
            fallback_whisper_model=req.whisper_model,
            fallback_model=req.model
        )
        return {"status": "success", "job_id": new_job_id}
    except Exception as e:
        return JSONResponse(status_code=400, content={"status": "error", "message": str(e)})

class ResumeManualJobRequest(BaseModel):
    json_payload: str

@app.post("/jobs/{job_id}/resume-manual")
def api_resume_manual_job(job_id: str, req: ResumeManualJobRequest):
    try:
        from backend.jobs import resume_manual_job
        new_job_id = resume_manual_job(job_id, req.json_payload)
        return {"status": "success", "job_id": new_job_id}
    except Exception as e:
        return JSONResponse(status_code=400, content={"status": "error", "message": str(e)})

SUPPORTED_URL_RE = re.compile(
    r'^(https?://)?(www\.|m\.)?'
    r'(youtube\.com|youtu\.be|tiktok\.com|vt\.tiktok\.com|instagram\.com|x\.com|twitter\.com)/.+',
    re.IGNORECASE,
)


def is_valid_source_url(url: str) -> bool:
    """Whitelist of platforms we route to yt-dlp, plus local uploads."""
    if not url:
        return False
    if url.startswith("local:"):
        return True
    return bool(SUPPORTED_URL_RE.match(url.strip()))


# --- Sleep-safe lifecycle helpers -------------------------------------------
# Kept at module level (not nested inside __main__) so they can be unit-tested
# without spinning up the whole server.

WATCHDOG_INTERVAL = 5      # seconds between watchdog checks
HEARTBEAT_GRACE = 30       # seconds without a heartbeat before it counts as stale
WAKE_LOOP_THRESHOLD = 15   # a watchdog loop slower than this means the OS slept


def is_parent_alive(pid) -> bool:
    """Return True if the parent process (the Tauri shell) is still running.

    The backend must only self-terminate when the app that spawned it is
    actually gone — not merely because heartbeats paused (e.g. the OS slept and
    the webview froze). This check fails *safe*: if the state cannot be
    determined, we assume the parent is alive so a healthy backend is never
    killed by mistake.
    """
    if os.environ.get("AUTO_CLIPPER_CLOUD_MODE"):
        return True
    if not pid or pid <= 0:
        return True
    # Prefer psutil when available (cross-platform, reliable).
    try:
        import psutil
        return psutil.pid_exists(int(pid))
    except Exception:
        pass
    if sys.platform == "win32":
        try:
            import ctypes
            PROCESS_QUERY_LIMITED_INFORMATION = 0x1000
            STILL_ACTIVE = 259
            kernel32 = ctypes.windll.kernel32
            handle = kernel32.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, False, int(pid))
            if not handle:
                return False
            exit_code = ctypes.c_ulong()
            ok = kernel32.GetExitCodeProcess(handle, ctypes.byref(exit_code))
            kernel32.CloseHandle(handle)
            if not ok:
                return True  # couldn't read exit code -> fail safe
            return exit_code.value == STILL_ACTIVE
        except Exception:
            return True
    # POSIX fallback.
    try:
        os.kill(int(pid), 0)
        return True
    except ProcessLookupError:
        return False
    except PermissionError:
        return True  # exists but we can't signal it
    except Exception:
        return True


def check_watchdog_condition(now_monotonic, last_heartbeat_monotonic, loop_delta,
                             parent_pid=None,
                             grace=HEARTBEAT_GRACE,
                             wake_threshold=WAKE_LOOP_THRESHOLD):
    """Decide what the watchdog should do on a single tick.

    All times are on a *monotonic* clock so OS sleep cannot make the heartbeat
    look ancient. Returns one of:

      "wake"  -> the watchdog loop itself took far longer than its interval,
                 meaning the machine just resumed from sleep. Reset the
                 heartbeat baseline and do NOT kill.
      "kill"  -> heartbeats are stale AND the parent app is gone: safe to exit.
      "stale" -> heartbeats are stale but the parent app is still alive: keep
                 running and let the frontend reconnect.
      "ok"    -> healthy, keep running.
    """
    if os.environ.get("AUTO_CLIPPER_CLOUD_MODE"):
        return "ok"
    if loop_delta > wake_threshold:
        return "wake"
    if (now_monotonic - last_heartbeat_monotonic) > grace:
        return "stale" if is_parent_alive(parent_pid) else "kill"
    return "ok"


@app.post("/jobs")
def api_create_job(req: CreateJobRequest):
    if not req.url:
        return JSONResponse(status_code=400, content={"status": "error", "message": "URL is required"})

    if not req.title or not req.title.strip():
        return JSONResponse(status_code=400, content={"status": "error", "message": "Judul Proyek wajib diisi."})

    if not is_valid_source_url(req.url):
        return JSONResponse(status_code=400, content={"status": "error", "message": "URL tidak valid. Didukung: YouTube, TikTok, Instagram, X/Twitter, atau upload file lokal."})

    try:
        from backend.ai_utils import ping_provider
        ping_provider(req.provider, req.api_key.strip(), req.custom_base_url.strip(), req.custom_model_name.strip(), model=req.model.strip() if req.model else None)
    except Exception as e:
        return JSONResponse(status_code=400, content={"status": "error", "message": str(e)})

    from backend.jobs import create_job
    canvas_cfg = req.canvas_config.model_dump() if req.canvas_config else None
    job_id = create_job(
        req.url.strip(), req.provider, req.api_key.strip(),
        req.aspect_ratio, req.caption_style, req.burn_subs, req.output_dir, req.quality,
        req.title.strip(), req.enable_broll, req.pexels_api_key.strip(), req.max_clips,
        req.custom_base_url.strip(), req.custom_model_name.strip(), req.is_gaming_video,
        req.whisper_model, req.model, canvas_config=canvas_cfg, subtitle_config=req.subtitle_config
    )
    return {"status": "success", "job_id": job_id}

@app.get("/jobs/{job_id}")
def api_get_job(job_id: str):
    from backend.jobs import get_job
    job = get_job(job_id)
    if not job:
        return JSONResponse(status_code=404, content={"status": "error", "message": "Job not found"})
    # Only return safe fields to frontend
    return {
        "id": job["id"],
        "status": job["status"],
        "progress": job["progress"],
        "clips": job["clips"],
        "failed": job.get("failed", 0),
        "error": job.get("error"),
        "metadata": job.get("metadata", {})
    }

@app.post("/jobs/{job_id}/clips/{clip_index}/social")
def api_generate_social_kit(job_id: str, clip_index: int, req: GenerateSocialKitRequest):
    from backend.jobs import get_job
    from backend.db import get_history, save_history
    from backend.ai_utils import generate_social_kit_only
    
    job = get_job(job_id)
    is_active = True
    if not job:
        job = get_history(job_id)
        is_active = False
        
    if not job:
        return JSONResponse(status_code=404, content={"status": "error", "message": "Job not found"})
        
    clips = job.get("clips") if is_active else job.get("result_clips")
    
    if not clips or clip_index < 0 or clip_index >= len(clips):
        return JSONResponse(status_code=404, content={"status": "error", "message": "Clip not found"})

    try:
        social_kit = generate_social_kit_only(
            description=req.description,
            api_key=req.api_key.strip(),
            provider=req.provider,
            base_url=req.custom_base_url.strip(),
            model=req.model.strip() if req.model else req.custom_model_name.strip()
        )
        
        clips[clip_index]["social"] = social_kit
        
        if not is_active:
            save_history(job["id"], job["url"], job["status"], clips, job.get("metadata"))
            
        return {"status": "success", "social": social_kit}
    except Exception as e:
        debug_msg = f"DEBUG [provider={req.provider}, key_len={len(req.api_key.strip())}, base_url={req.custom_base_url}]. Error: {str(e)}"
        return JSONResponse(status_code=500, content={"status": "error", "message": debug_msg})

@app.post("/jobs/{job_id}/cancel")
def api_cancel_job(job_id: str):
    from backend.jobs import get_job, cancel_job
    job = get_job(job_id)
    if not job:
        return JSONResponse(status_code=404, content={"status": "error", "message": "Job not found"})
    cancel_job(job_id)
    return {"status": "success"}

@app.get("/history")
def api_get_history():
    return {"status": "success", "history": get_all_history()}

@app.delete("/history/{job_id}")
def api_delete_history(job_id: str):
    delete_history(job_id)
    return {"status": "success"}


class ExtractMetadataRequest(BaseModel):
    path: str
    type: List[str] = ["silence"]


@app.post("/api/extract-metadata")
def api_extract_metadata(req: ExtractMetadataRequest):
    """Kick off async metadata extraction (silence / peaks / thumbnails).

    Returns a job_id immediately; the frontend polls GET /api/metadata/{id}.
    """
    path = req.path
    if path.startswith("local:"):
        path = path.split("local:")[1]
    if not path or not os.path.exists(path):
        return JSONResponse(status_code=400, content={"status": "error", "message": "File tidak ditemukan."})
    from backend.metadata import create_metadata_job
    job_id = create_metadata_job(path, req.type)
    return {"status": "success", "job_id": job_id}


@app.get("/api/metadata/{job_id}")
def api_get_metadata(job_id: str):
    from backend.metadata import get_metadata_job
    job = get_metadata_job(job_id)
    if not job:
        return JSONResponse(status_code=404, content={"status": "error", "message": "Job not found"})
    return {
        "status": job["status"],
        "progress": job.get("progress", ""),
        "duration": job.get("duration"),
        "silence": job.get("silence"),
        "peaks": job.get("peaks"),
        "thumbnails": job.get("thumbnails"),
        "error": job.get("error"),
        "errors": job.get("errors", {}),
    }


@app.get("/api/thumbnails")
def api_get_thumbnails(path: str, start: float = 0.0, end: float = 0.0, count: int = 12):
    """On-demand filmstrip thumbnails for a time window (zoomable timeline)."""
    p = path
    if p.startswith("local:"):
        p = p.split("local:")[1]
    if not p or not os.path.exists(p):
        return JSONResponse(status_code=400, content={"status": "error", "message": "File tidak ditemukan."})
    if end <= start:
        return JSONResponse(status_code=400, content={"status": "error", "message": "Rentang waktu tidak valid."})
    try:
        from backend.metadata import generate_thumbnails_window
        uris = generate_thumbnails_window(p, start, end, count)
        return {"status": "success", "start": start, "end": end, "count": len(uris), "thumbnails": uris}
    except Exception as e:
        return JSONResponse(status_code=400, content={"status": "error", "message": str(e)})


class ManualJobRequest(BaseModel):
    url: str
    clips: List[dict] = []
    aspect_ratio: str = "9:16"
    caption_style: str = "standard"
    burn_subs: bool = True
    output_dir: str = ""
    quality: str = "best"
    title: str = ""
    is_gaming_video: bool = False
    whisper_model: str = "small"
    canvas_config: Optional[CanvasConfig] = None
    subtitle_config: Optional[dict] = None


@app.post("/jobs/manual")
def api_create_manual_job(req: ManualJobRequest):
    if not req.url:
        return JSONResponse(status_code=400, content={"status": "error", "message": "URL is required"})
    if not req.title or not req.title.strip():
        return JSONResponse(status_code=400, content={"status": "error", "message": "Judul Proyek wajib diisi."})
    if not is_valid_source_url(req.url):
        return JSONResponse(status_code=400, content={"status": "error", "message": "URL tidak valid untuk klip manual."})

    try:
        from backend.jobs import create_manual_job
        canvas_cfg = req.canvas_config.model_dump() if req.canvas_config else None
        job_id = create_manual_job(
            req.url.strip(), req.clips, req.aspect_ratio, req.caption_style,
            req.burn_subs, req.output_dir, req.quality, req.title.strip(), req.is_gaming_video,
            req.whisper_model, canvas_config=canvas_cfg, subtitle_config=req.subtitle_config
        )
        return {"status": "success", "job_id": job_id}
    except Exception as e:
        return JSONResponse(status_code=400, content={"status": "error", "message": str(e)})


@app.get("/video")
def get_video(path: str, dl: int = 0, title: str = None):
    """Serve a generated clip so the frontend can preview it inline.

    Restricted to existing .mp4 files. Starlette's
    FileResponse handles HTTP Range requests, so seeking works in the player.
    """
    from backend.logger import log_app
    
    abs_path = os.path.normpath(os.path.abspath(path))
    
    # Path traversal protection: ensure file is inside app data dir or project root
    safe_dirs = [
        os.path.abspath(get_app_data_dir()),
        os.path.abspath(os.getcwd())
    ]
    if not any(abs_path.startswith(safe_dir) for safe_dir in safe_dirs):
        log_app(f"[video] Security error: Path traversal attempt: {abs_path}")
        return JSONResponse(status_code=403, content={"status": "error", "message": "Access denied"})
        
    log_app(f"[video] Requested: {path} → Resolved: {abs_path} → Exists: {os.path.exists(abs_path)}")
    if not os.path.exists(abs_path) or not abs_path.lower().endswith(".mp4"):
        return JSONResponse(status_code=404, content={"status": "error", "message": f"File not found or invalid format: {abs_path}"})
    
    filename = os.path.basename(abs_path)
    if title:
        clean_title = re.sub(r'[^\w\s-]', '', title).strip().replace(' ', '_')
        filename = f"{clean_title}.mp4"
        
    disposition = "attachment" if dl == 1 else "inline"
    
    return FileResponse(
        abs_path,
        media_type="video/mp4",
        headers={
            "Content-Disposition": f'{disposition}; filename="{filename}"',
            "Accept-Ranges": "bytes",
            "Cache-Control": "no-cache",
        },
    )


if __name__ == "__main__":
    # Setup logger and cleanup old temp files
    # freeze_support already called at the top of the file

    try:
        import uvicorn
        import socket
        import sys
        import threading
        import os
        import time

        # Watchdog thread: only kills the backend when the frontend has gone
        # quiet AND the Tauri parent process is actually gone. Heartbeat is
        # tracked on a MONOTONIC clock, and a suspiciously long watchdog loop is
        # treated as "the machine just woke from sleep" (reset, don't kill) so
        # the app no longer shows "Disconnected" after the device sleeps.
        # Disabled in cloud mode (e.g. Google Colab) where there is no parent Tauri process.
        last_heartbeat = time.monotonic()

        if not os.environ.get("AUTO_CLIPPER_CLOUD_MODE"):
            parent_pid = os.getppid()

            def watchdog():
                global last_heartbeat
                last_loop = time.monotonic()
                while True:
                    time.sleep(WATCHDOG_INTERVAL)
                    now = time.monotonic()
                    loop_delta = now - last_loop
                    last_loop = now
                    action = check_watchdog_condition(now, last_heartbeat, loop_delta, parent_pid)
                    if action == "wake":
                        # Resumed from sleep: give the frontend time to reconnect
                        # instead of killing a perfectly healthy backend.
                        last_heartbeat = now
                        continue
                    if action == "kill":
                        os._exit(0)
                    # "ok" / "stale": keep running.

            # Start the watchdog as a daemon thread
            threading.Thread(target=watchdog, daemon=True).start()

        # Find a free port dynamically and reliably
        def get_free_port():
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
                s.bind(("127.0.0.1", 0))
                return s.getsockname()[1]

        port = get_free_port()

        # Restore stdout/stderr for handshake output
        if _original_stdout is not None:
            sys.stdout = _original_stdout
        if _original_stderr is not None:
            sys.stderr = _original_stderr

        # Cetak port ke stdout agar ditangkap oleh frontend
        try:
            print(f"AUTO_CLIPPER_BACKEND_PORT={port}")
            print(f"PORT:{port}")
            print(f"TOKEN:{API_SECRET_TOKEN}")
            sys.stdout.flush()
        except BrokenPipeError:
            pass

        # reload=False: the reloader spawns an extra child process that Electron/Tauri
        # can't reliably kill on Windows, leaving a zombie backend.
        uvicorn.run(app, host="127.0.0.1", port=port, reload=False, log_level="info")
    except Exception as e:
        if _original_stdout is not None:
            sys.stdout = _original_stdout
        if _original_stderr is not None:
            sys.stderr = _original_stderr
        log_error("Backend Main Startup", e)
        sys.stderr.write(f"Backend fatal startup error: {e}\n")
        sys.stderr.flush()
        sys.exit(1)

