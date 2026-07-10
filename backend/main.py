from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from backend.video_utils import download_youtube_video
from backend.ai_utils import transcribe_audio, get_highlights
from backend.crop_utils import crop_to_vertical
import os

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

@app.post("/download")
def download_video(req: DownloadRequest):
    # Save to a temp dir in project root for MVP
    output_path = os.path.join(os.getcwd(), "temp_downloads", "source.mp4")
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    try:
        download_youtube_video(req.url, output_path)
        return {"status": "success", "file_path": output_path}
    except Exception as e:
        return {"status": "error", "message": str(e)}

class ProcessAIRequest(BaseModel):
    file_path: str
    api_key: str

@app.post("/process-ai")
def process_ai(req: ProcessAIRequest):
    if not os.path.exists(req.file_path):
        return {"status": "error", "message": "File not found"}
        
    try:
        # 1. Transcribe
        transcript = transcribe_audio(req.file_path, req.api_key)
        
        # 2. Get Highlights
        highlights = get_highlights(transcript, req.api_key)
        
        return {
            "status": "success",
            "transcript": transcript,
            "highlights": highlights
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}

class CropRequest(BaseModel):
    file_path: str
    start_time: str
    end_time: str

@app.post("/crop")
def crop_video(req: CropRequest):
    if not os.path.exists(req.file_path):
        return {"status": "error", "message": "File not found"}
        
    output_path = req.file_path.replace(".mp4", f"_crop_{req.start_time.replace(':', '')}.mp4")
    
    try:
        # Note: requires ffmpeg on system PATH
        result_path = crop_to_vertical(req.file_path, output_path, req.start_time, req.end_time)
        return {"status": "success", "file_path": result_path}
    except Exception as e:
        return {"status": "error", "message": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, reload=True)
