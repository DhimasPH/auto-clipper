from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from backend.video_utils import download_youtube_video
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, reload=True)
