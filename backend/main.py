from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from backend.video_utils import download_youtube_video
from backend.ai_utils import process_with_openai, process_with_gemini
from backend.crop_utils import crop_to_vertical
import os
import traceback

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

class DownloadRequest(BaseModel):
    url: str

def get_error_log_path():
    return os.path.join(os.getcwd(), "backend_error.log")

@app.post("/download")
def download_video(req: DownloadRequest):
    req.url = req.url.strip()
    output_path = os.path.join(os.getcwd(), "temp_downloads", "source.mp4")
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    try:
        download_youtube_video(req.url, output_path)
        return {"status": "success", "file_path": output_path}
    except Exception as e:
        err_msg = traceback.format_exc()
        try:
            with open(get_error_log_path(), "a") as f:
                f.write("DOWNLOAD ERROR:\n" + err_msg + "\n")
        except: pass
        return {"status": "error", "message": f"{str(e)} | Trace: {err_msg}"}

class ProcessAIRequest(BaseModel):
    file_path: str
    api_key: str
    provider: str = "openai"

@app.post("/process-ai")
def process_ai(req: ProcessAIRequest):
    req.api_key = req.api_key.strip()
    if not os.path.exists(req.file_path):
        return {"status": "error", "message": "File not found"}
        
    try:
        if req.provider == "gemini":
            result = process_with_gemini(req.file_path, req.api_key)
        else:
            result = process_with_openai(req.file_path, req.api_key)
            
        return {
            "status": "success",
            "transcript": result["transcript"],
            "highlights": result["highlights"]
        }
    except Exception as e:
        err_msg = traceback.format_exc()
        try:
            with open(get_error_log_path(), "a") as f:
                f.write("PROCESS-AI ERROR:\n" + err_msg + "\n")
        except: pass
        return {"status": "error", "message": f"{str(e)} | Trace: {err_msg}"}

class CropRequest(BaseModel):
    file_path: str
    start_time: str
    end_time: str

@app.post("/crop")
def crop_video(req: CropRequest):
    if not os.path.exists(req.file_path):
        return {"status": "error", "message": "File not found"}
        
    import re
    safe_start_time = re.sub(r'[^0-9a-zA-Z]', '', req.start_time)
    output_path = req.file_path.replace(".mp4", f"_crop_{safe_start_time}.mp4")
    
    try:
        result_path = crop_to_vertical(req.file_path, output_path, req.start_time, req.end_time)
        return {"status": "success", "file_path": result_path}
    except Exception as e:
        err_msg = traceback.format_exc()
        try:
            with open(get_error_log_path(), "a") as f:
                f.write("CROP ERROR:\n" + err_msg + "\n")
        except: pass
        return {"status": "error", "message": f"{str(e)} | Trace: {err_msg}"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, reload=True)
