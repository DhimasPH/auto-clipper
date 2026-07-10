from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
from backend.video_utils import download_youtube_video
from backend.ai_utils import process_with_openai, process_with_gemini
from backend.crop_utils import crop_to_vertical
import os
import re
import traceback

app = FastAPI(title="Auto Clipper API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_error_log_path():
    return os.path.join(os.getcwd(), "backend_error.log")


def get_temp_dir():
    return os.path.join(os.getcwd(), "temp_downloads")


def log_error(context: str) -> None:
    """Write the full traceback to the log file. Never sent to the client."""
    try:
        with open(get_error_log_path(), "a") as f:
            f.write(f"{context} ERROR:\n{traceback.format_exc()}\n")
    except Exception:
        pass


@app.get("/health")
def health_check():
    return {"status": "ok"}


class DownloadRequest(BaseModel):
    url: str


@app.post("/download")
def download_video(req: DownloadRequest):
    url = req.url.strip()
    output_path = os.path.join(get_temp_dir(), "source.mp4")
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    try:
        download_youtube_video(url, output_path)
        return {"status": "success", "file_path": output_path}
    except Exception as e:
        log_error("DOWNLOAD")
        return {"status": "error", "message": f"Failed to download the video: {e}"}


class ProcessAIRequest(BaseModel):
    file_path: str
    api_key: str
    provider: str = "openai"


@app.post("/process-ai")
def process_ai(req: ProcessAIRequest):
    api_key = req.api_key.strip()
    if not os.path.exists(req.file_path):
        return {"status": "error", "message": "Source video not found. Please download it first."}

    try:
        if req.provider == "gemini":
            result = process_with_gemini(req.file_path, api_key)
        else:
            result = process_with_openai(req.file_path, api_key)

        return {
            "status": "success",
            "transcript": result["transcript"],
            "highlights": result["highlights"],
            "subtitle_path": result.get("subtitle_path"),
        }
    except Exception as e:
        log_error("PROCESS-AI")
        return {"status": "error", "message": f"AI analysis failed: {e}"}


class CropRequest(BaseModel):
    file_path: str
    start_time: str
    end_time: str
    subtitle_path: str | None = None


@app.post("/crop")
def crop_video(req: CropRequest):
    if not os.path.exists(req.file_path):
        return {"status": "error", "message": "Source video not found."}

    safe_start_time = re.sub(r'[^0-9a-zA-Z]', '', req.start_time)
    output_path = req.file_path.replace(".mp4", f"_crop_{safe_start_time}.mp4")

    try:
        result_path = crop_to_vertical(
            req.file_path, output_path, req.start_time, req.end_time,
            subtitle_path=req.subtitle_path,
        )
        return {"status": "success", "file_path": result_path}
    except Exception as e:
        log_error("CROP")
        return {"status": "error", "message": f"Cropping failed: {e}"}


@app.get("/video")
def get_video(path: str):
    """Serve a generated clip so the frontend can preview it inline.

    Restricted to files inside the temp downloads directory. Starlette's
    FileResponse handles HTTP Range requests, so seeking works in the player.
    """
    abs_path = os.path.abspath(path)
    temp_dir = os.path.abspath(get_temp_dir())
    if not abs_path.startswith(temp_dir) or not os.path.exists(abs_path):
        return JSONResponse(status_code=404, content={"status": "error", "message": "File not found"})
    return FileResponse(abs_path, media_type="video/mp4")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, reload=True)
