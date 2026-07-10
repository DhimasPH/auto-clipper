import threading
import uuid
import traceback
import re
import os
from backend.video_utils import download_youtube_video
from backend.ai_utils import process_with_openai, process_with_gemini
from backend.crop_utils import crop_to_vertical
from backend.db import save_history

active_jobs = {}
MAX_CLIPS = 3

def get_temp_dir():
    return os.path.join(os.getcwd(), "temp_downloads")

def get_error_log_path():
    return os.path.join(os.getcwd(), "backend_error.log")

def log_error(context: str) -> None:
    try:
        with open(get_error_log_path(), "a") as f:
            f.write(f"{context} ERROR:\n{traceback.format_exc()}\n")
    except Exception:
        pass

def create_job(url: str, provider: str, api_key: str, mode: str, manual_start: str, manual_end: str, aspect_ratio: str = "9:16", caption_style: str = "standard", openai_key: str = "") -> str:
    job_id = str(uuid.uuid4())
    active_jobs[job_id] = {
        "id": job_id,
        "url": url,
        "provider": provider,
        "api_key": api_key,
        "mode": mode,
        "manual_start": manual_start,
        "manual_end": manual_end,
        "aspect_ratio": aspect_ratio,
        "caption_style": caption_style,
        "openai_key": openai_key,
        "status": "PENDING",
        "progress": "",
        "cancelled": False,
        "clips": [],
        "error": None
    }
    threading.Thread(target=_run_job, args=(job_id,), daemon=True).start()
    return job_id

def get_job(job_id: str) -> dict:
    return active_jobs.get(job_id)

def cancel_job(job_id: str):
    if job_id in active_jobs:
        active_jobs[job_id]["cancelled"] = True

def _run_job(job_id: str):
    job = active_jobs[job_id]
    
    try:
        if job["cancelled"]:
            _finalize_job(job_id, "CANCELLED")
            return
            
        # 1. DOWNLOAD OR LOCAL FILE
        job["status"] = "DOWNLOADING"
        
        if job["url"].startswith("local:"):
            job["progress"] = "Mempersiapkan video lokal..."
            # output_path is exactly the local file we saved in /upload
            output_path = job["url"].split("local:")[1]
        else:
            job["progress"] = "Mengunduh video..."
            output_path = os.path.join(get_temp_dir(), f"source_{job_id}.mp4")
            os.makedirs(os.path.dirname(output_path), exist_ok=True)
            download_youtube_video(job["url"], output_path)
        
        if job["cancelled"]:
            _finalize_job(job_id, "CANCELLED")
            return
            
        # 2. AI PROCESSING or MANUAL
        if job["mode"] == "ai":
            job["status"] = "TRANSCRIBING"
            job["progress"] = f"Menganalisis video dengan {job['provider']}..."
            
            is_karaoke = (job["caption_style"] == "karaoke")
            
            if job["provider"] == "gemini":
                ai_result = process_with_gemini(output_path, job["api_key"], openai_api_key=job["openai_key"], karaoke=is_karaoke)
            else:
                ai_result = process_with_openai(output_path, job["api_key"], karaoke=is_karaoke)
                
            highlights = ai_result.get("highlights", [])
            subtitle_path = ai_result.get("subtitle_path")
            
            if not highlights:
                raise ValueError("Tidak ada highlight yang ditemukan oleh AI.")
        else:
            highlights = [{
                "start_time": job["manual_start"],
                "end_time": job["manual_end"],
                "description": "Manual custom clip"
            }]
            subtitle_path = None
            
        if job["cancelled"]:
            _finalize_job(job_id, "CANCELLED")
            return
            
        # 3. CROPPING
        job["status"] = "CROPPING"
        segments = highlights[:MAX_CLIPS]
        
        for i, seg in enumerate(segments):
            if job["cancelled"]:
                _finalize_job(job_id, "CANCELLED")
                return
                
            job["progress"] = f"Merender klip {i+1} dari {len(segments)}..."
            
            safe_start_time = re.sub(r'[^0-9a-zA-Z]', '', seg.get("start_time", ""))
            clip_output = output_path.replace(".mp4", f"_crop_{safe_start_time}.mp4")
            
            try:
                result_path = crop_to_vertical(
                    output_path, clip_output, seg["start_time"], seg["end_time"],
                    subtitle_path=subtitle_path, aspect_ratio=job["aspect_ratio"]
                )
                
                # Append to clips
                job["clips"].append({
                    "path": result_path,
                    "description": seg.get("description", f"Highlight {i+1}"),
                    "start": seg["start_time"],
                    "end": seg["end_time"],
                    "subs": bool(subtitle_path),
                    "v": 0
                })
            except Exception as e:
                log_error(f"JOB CROP {job_id}")
                print(f"Clip {i+1} failed: {e}")
                
        # Done
        if not job["clips"]:
             raise ValueError("Semua klip gagal dirender.")
             
        _finalize_job(job_id, "DONE")
        
    except Exception as e:
        log_error(f"JOB {job_id}")
        job["error"] = str(e)
        _finalize_job(job_id, "ERROR")

def _finalize_job(job_id: str, status: str):
    job = active_jobs[job_id]
    job["status"] = status
    save_history(job_id, job["url"], status, job["clips"])
