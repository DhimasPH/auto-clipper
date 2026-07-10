from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
from backend.db import init_db, get_all_history, delete_history
from backend.jobs import create_job, get_job, cancel_job
import os
import re

# Initialize DB on startup
init_db()

app = FastAPI(title="Auto Clipper API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)




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

@app.post("/jobs")
def api_create_job(req: CreateJobRequest):
    if not req.url:
        return JSONResponse(status_code=400, content={"status": "error", "message": "URL is required"})
    job_id = create_job(req.url, req.provider, req.api_key, req.mode, req.manual_start, req.manual_end)
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
    temp_dir = os.path.abspath(os.path.join(os.getcwd(), "temp_downloads"))
    if not abs_path.startswith(temp_dir) or not os.path.exists(abs_path):
        return JSONResponse(status_code=404, content={"status": "error", "message": "File not found"})
    return FileResponse(abs_path, media_type="video/mp4")


if __name__ == "__main__":
    import uvicorn
    # reload=False: the reloader spawns an extra child process that Electron
    # can't reliably kill on Windows, leaving a zombie backend on port 8000.
    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, reload=False)
