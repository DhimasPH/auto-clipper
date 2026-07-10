from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
from backend.db import init_db, get_all_history, delete_history
from backend.jobs import create_job, get_job, cancel_job
import os
import sys
import shutil
import re

# Jika dijalankan sebagai PyInstaller bundle, tambahkan folder executable ke PATH
# agar FFmpeg dan dependensi lain yang dibundel bisa ditemukan.
if getattr(sys, 'frozen', False):
    bin_dir = os.path.dirname(sys.executable)
    os.environ["PATH"] = bin_dir + os.pathsep + os.environ.get("PATH", "")

# Initialize DB on startup
init_db()

app = FastAPI(title="Auto Clipper API")

app.add_middleware(
    CORSMiddleware,
    # Batasi ke asal Electron atau Vite dev server
    allow_origins=[
        "http://localhost:5173", 
        "http://127.0.0.1:5173",
        "app://.",
        "file://"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from backend.db import init_db, get_all_history, delete_history, get_app_data_dir

@app.post("/upload")
def api_upload_video(file: UploadFile = File(...)):
    temp_dir = os.path.abspath(os.path.join(get_app_data_dir(), "temp_downloads"))
    os.makedirs(temp_dir, exist_ok=True)
    file_path = os.path.join(temp_dir, f"upload_{file.filename}")
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    # Return local path prefixed with local: so jobs.py knows to skip download
    return {"status": "success", "url": f"local:{file_path}"}

@app.get("/health")
def health_check():
    return {"status": "ok"}


class CreateJobRequest(BaseModel):
    url: str
    provider: str = "openai"
    api_key: str = ""
    mode: str = "ai"
    manual_start: str = ""
    manual_end: str = ""
    aspect_ratio: str = "9:16"
    caption_style: str = "standard"
    burn_subs: bool = True
    output_dir: str = ""
    quality: str = "best"
    extra_prompt: str = ""

@app.post("/jobs/{job_id}/rerender")
def api_rerender_job(job_id: str, req: CreateJobRequest):
    try:
        from backend.jobs import create_rerender_job
        new_job_id = create_rerender_job(job_id, req.aspect_ratio, req.burn_subs, req.output_dir)
        return {"status": "success", "job_id": new_job_id}
    except Exception as e:
        return JSONResponse(status_code=400, content={"status": "error", "message": str(e)})

@app.post("/jobs/{job_id}/rerun_ai")
def api_rerun_ai_job(job_id: str, req: CreateJobRequest):
    try:
        from backend.jobs import create_rerun_ai_job
        new_job_id = create_rerun_ai_job(
            job_id, req.provider, req.api_key.strip(),
            req.aspect_ratio, req.burn_subs, req.output_dir, req.extra_prompt
        )
        return {"status": "success", "job_id": new_job_id}
    except Exception as e:
        return JSONResponse(status_code=400, content={"status": "error", "message": str(e)})

@app.post("/jobs")
def api_create_job(req: CreateJobRequest):
    if not req.url:
        return JSONResponse(status_code=400, content={"status": "error", "message": "URL is required"})
        
    # Input Validation Hardening (Task 6.5)
    valid_url = False
    if req.url.startswith("local:"):
        valid_url = True
    elif re.match(r'^(https?://)?(www\.)?(youtube\.com|youtu\.be|tiktok\.com)/.+', req.url):
        valid_url = True
        
    if not valid_url:
        return JSONResponse(status_code=400, content={"status": "error", "message": "URL tidak valid. Hanya mendukung YouTube, TikTok, atau upload file lokal."})

    job_id = create_job(
        req.url.strip(), req.provider, req.api_key.strip(), req.mode, 
        req.manual_start, req.manual_end, req.aspect_ratio, req.caption_style, req.burn_subs, req.output_dir, req.quality
    )
    return {"status": "success", "job_id": job_id}

@app.get("/jobs/{job_id}")
def api_get_job(job_id: str):
    job = get_job(job_id)
    if not job:
        return JSONResponse(status_code=404, content={"status": "error", "message": "Job not found"})
    # Only return safe fields to frontend
    return {
        "id": job["id"],
        "status": job["status"],
        "progress": job["progress"],
        "clips": job["clips"],
        "error": job["error"]
    }

@app.post("/jobs/{job_id}/cancel")
def api_cancel_job(job_id: str):
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


@app.get("/video")
def get_video(path: str):
    """Serve a generated clip so the frontend can preview it inline.

    Restricted to files inside the temp downloads directory. Starlette's
    FileResponse handles HTTP Range requests, so seeking works in the player.
    """
    abs_path = os.path.abspath(path)
    temp_dir = os.path.abspath(os.path.join(get_app_data_dir(), "temp_downloads"))
    if not abs_path.startswith(temp_dir) or not os.path.exists(abs_path):
        return JSONResponse(status_code=404, content={"status": "error", "message": "File not found"})
    return FileResponse(abs_path, media_type="video/mp4", filename=os.path.basename(abs_path))


if __name__ == "__main__":
    import uvicorn
    import socket
    import sys

    # Find a free port dynamically
    def get_free_port():
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.bind(("", 0))
            return s.getsockname()[1]

    port = get_free_port()
    
    # Cetak port ke stdout agar ditangkap oleh Electron main.cjs
    print(f"AUTO_CLIPPER_BACKEND_PORT={port}")
    sys.stdout.flush()

    # reload=False: the reloader spawns an extra child process that Electron
    # can't reliably kill on Windows, leaving a zombie backend.
    uvicorn.run("backend.main:app", host="127.0.0.1", port=port, reload=False)
