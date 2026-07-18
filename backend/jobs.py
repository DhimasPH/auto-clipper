import threading
import re
import uuid
import traceback
import os
from backend.video_utils import download_youtube_video
from backend.ai_utils import process_with_openai, process_with_gemini, process_with_openai_compatible, OPENAI_COMPAT_PROVIDERS
from backend.crop_utils import crop_to_vertical
from backend.db import save_history, get_app_data_dir

active_jobs = {}
def _get_clip_limit(max_clips: int, duration_seconds: float) -> int:
    if max_clips > 0:
        return max_clips
    minutes = duration_seconds / 60.0
    if minutes < 5:
        return 3
    elif minutes < 15:
        return 5
    elif minutes < 30:
        return 10
    else:
        return 15


def get_temp_dir():
    return os.path.join(get_app_data_dir(), "temp_downloads")

def get_error_log_path():
    return os.path.join(get_app_data_dir(), "backend_error.log")

def log_error(context: str) -> None:
    import datetime
    try:
        timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        with open(get_error_log_path(), "a") as f:
            f.write(f"[{timestamp}] {context} ERROR:\n{traceback.format_exc()}\n")
    except Exception:
        pass

def create_job(url: str, provider: str, api_key: str, aspect_ratio: str = "9:16", caption_style: str = "standard", burn_subs: bool = True, output_dir: str = "", quality: str = "best", title: str = "", enable_broll: bool = False, pexels_api_key: str = "", max_clips: int = 0, custom_base_url: str = "", custom_model_name: str = "") -> str:
    job_id = str(uuid.uuid4())
    active_jobs[job_id] = {
        "id": job_id,
        "url": url,
        "provider": provider,
        "api_key": api_key,
        "custom_base_url": custom_base_url,
        "custom_model_name": custom_model_name,
        "mode": "ai",
        "aspect_ratio": aspect_ratio,
        "caption_style": caption_style,
        "burn_subs": burn_subs,
        "output_dir": output_dir,
        "quality": quality,
        "title": title,
        "enable_broll": enable_broll,
        "pexels_api_key": pexels_api_key,
        "max_clips": max_clips,
        "status": "PENDING",
        "progress": "",
        "cancelled": False,
        "clips": [],
        "failed": 0,
        "error": None
    }
    threading.Thread(target=_run_job, args=(job_id,), daemon=True).start()
    return job_id

def create_rerender_job(history_id: str, aspect_ratio: str, burn_subs: bool, output_dir: str, max_clips: int = 0) -> str:
    from backend.db import get_history
    hist = get_history(history_id)
    if not hist or not hist.get("metadata") or not hist["metadata"].get("source_video"):
        raise ValueError("History tidak valid atau metadata tidak lengkap.")
        
    job_id = str(uuid.uuid4())
    active_jobs[job_id] = {
        "id": job_id,
        "url": hist["url"],
        "mode": "rerender",
        "aspect_ratio": aspect_ratio,
        "burn_subs": burn_subs,
        "output_dir": output_dir,
        "max_clips": max_clips,
        "status": "PENDING",
        "progress": "",
        "cancelled": False,
        "clips": [],
        "failed": 0,
        "error": None,
        "metadata": hist["metadata"]
    }
    threading.Thread(target=_run_rerender_job, args=(job_id,), daemon=True).start()
    return job_id

def get_job(job_id: str) -> dict:
    return active_jobs.get(job_id)

def _register_proc(job: dict, proc):
    """Stash the currently-running ffmpeg process so cancel can kill it."""
    job["_proc"] = proc

def cancel_job(job_id: str):
    if job_id in active_jobs:
        job = active_jobs[job_id]
        job["cancelled"] = True
        # Actually terminate the ffmpeg render in progress, otherwise the
        # current clip keeps rendering to completion before the flag is seen.
        proc = job.get("_proc")
        if proc is not None:
            try:
                if proc.poll() is None:
                    proc.kill()
            except Exception:
                pass

def _run_job(job_id: str):
    import time
    job = active_jobs[job_id]
    job["start_time"] = time.time()
    
    try:
        if job["cancelled"]:
            _finalize_job(job_id, "CANCELLED")
            return
            
        metadata = {}
        # 1. DOWNLOAD OR LOCAL FILE
        job["status"] = "DOWNLOADING"
        
        def is_cancelled():
            return job.get("cancelled", False)
            
        if job["url"].startswith("local:"):
            job["progress"] = "Mempersiapkan video lokal..."
            # output_path is exactly the local file we saved in /upload
            output_path = job["url"].split("local:")[1]
        else:
            job["progress"] = "Mengunduh video..."
            output_path = os.path.join(get_temp_dir(), f"source_{job_id}.mp4")
            os.makedirs(os.path.dirname(output_path), exist_ok=True)
            
                
            try:
                download_youtube_video(job["url"], output_path, job.get("quality", "best"), is_cancelled=is_cancelled)
            except Exception as e:
                if job.get("cancelled"):
                    _finalize_job(job_id, "CANCELLED")
                    return
                raise e

        # Remember the real source path so re-render/re-run works for BOTH
        # downloads and local uploads (was previously hardcoded in _finalize_job).
        job["source_path"] = output_path
        
        if job["cancelled"]:
            _finalize_job(job_id, "CANCELLED")
            return
            
        from backend.video_utils import get_video_duration
        dur_secs = get_video_duration(output_path)
        limit = _get_clip_limit(job.get("max_clips", 0), dur_secs)
            
        # 2. AI PROCESSING
        job["status"] = "TRANSCRIBING"
        job["progress"] = f"Menganalisis video dengan {job['provider']}..."

        is_karaoke = (job["caption_style"] == "karaoke")

        if job["provider"].startswith("gemini"):
            model_name = job["provider"] if job["provider"] != "gemini" else "gemini-2.0-flash"
            ai_result = process_with_gemini(output_path, job["api_key"], model_name=model_name, limit=limit, is_cancelled=is_cancelled, register_proc=lambda p: _register_proc(job, p))
        elif job["provider"] == "custom" or job["provider"] in OPENAI_COMPAT_PROVIDERS:
            ai_result = process_with_openai_compatible(output_path, job["api_key"], job["provider"], karaoke=is_karaoke, limit=limit, is_cancelled=is_cancelled, register_proc=lambda p: _register_proc(job, p), custom_base_url=job.get("custom_base_url"), custom_model_name=job.get("custom_model_name"))
        else:
            ai_result = process_with_openai(output_path, job["api_key"], karaoke=is_karaoke, limit=limit, is_cancelled=is_cancelled, register_proc=lambda p: _register_proc(job, p))

        highlights = ai_result.get("highlights", [])
        subtitle_path = ai_result.get("subtitle_path")

        metadata["subtitle_path"] = subtitle_path

        if not highlights:
            raise ValueError("Tidak ada highlight yang ditemukan oleh AI.")
            
        if job["cancelled"]:
            _finalize_job(job_id, "CANCELLED")
            return
            
        # 3. CROPPING
        job["status"] = "CROPPING"
        
        try:
            from backend.crop_utils import to_seconds
            highlights.sort(key=lambda x: to_seconds(x.get("start_time", "00:00:00")))
        except Exception:
            pass
            
        segments = highlights[:limit]
        metadata["highlights"] = segments
        
        for i, seg in enumerate(segments):
            if job["cancelled"]:
                _finalize_job(job_id, "CANCELLED")
                return
                
            broll_path = None
            if job.get("enable_broll") and job.get("pexels_api_key"):
                job["progress"] = f"Mengunduh B-Roll untuk klip {i+1}..."
                from backend.broll import download_pexels_broll
                query = seg.get("broll_query_en") or seg.get("description_en")
                if query:
                    broll_out = os.path.join(get_temp_dir(), f"broll_{job_id}_{i}.mp4")
                    success = download_pexels_broll(query, job["pexels_api_key"], broll_out, is_cancelled=is_cancelled)
                    if success:
                        broll_path = broll_out

            job["progress"] = f"Merender klip {i+1} dari {len(segments)}..."
            
            safe_start_time = re.sub(r'[^0-9a-zA-Z]', '', seg.get("start_time", ""))
            import shutil
            
            clip_output = output_path.replace(".mp4", f"_crop_{safe_start_time}.mp4")
            
            if job.get("output_dir"):
                out_dir = job["output_dir"]
                safe_title = ""
                if job.get("title"):
                    safe_title = re.sub(r'[^a-zA-Z0-9\s_-]', '', job["title"]).strip()
                    if safe_title:
                        out_dir = os.path.join(out_dir, safe_title)
                os.makedirs(out_dir, exist_ok=True)
                
                filename_base = safe_title if safe_title else f"AutoClipper_{job_id}"
                clip_output = os.path.join(out_dir, f"{filename_base}_clip_{i+1}.mp4")
            
            try:
                result_path = crop_to_vertical(
                    output_path, clip_output, seg["start_time"], seg["end_time"],
                    subtitle_path=subtitle_path if job.get("burn_subs", True) else None,
                    aspect_ratio=job["aspect_ratio"],
                    register_proc=lambda p: _register_proc(job, p),
                    should_cancel=lambda: job["cancelled"],
                    broll_path=broll_path
                )

                # Append to clips
                job["clips"].append({
                    "path": result_path,
                    "description": seg.get("description", f"Highlight {i+1}"),
                    "description_en": seg.get("description_en", seg.get("description", f"Highlight {i+1}")),
                    "description_id": seg.get("description_id", seg.get("description", f"Sorotan {i+1}")),
                    "start": seg["start_time"],
                    "end": seg["end_time"],
                    "subs": bool(subtitle_path),
                    "v": 0
                })
            except Exception as e:
                log_error(f"JOB CROP {job_id}")
                job["failed"] = job.get("failed", 0) + 1
                print(f"Clip {i+1} failed: {e}")
                
        # Done
        if not job["clips"]:
             raise ValueError("Semua klip gagal dirender.")
             
        _finalize_job(job_id, "DONE", metadata)
        
    except Exception as e:
        log_error(f"JOB {job_id}")
        job["error"] = str(e)
        _finalize_job(job_id, "ERROR", locals().get('metadata', {}))

def _run_rerender_job(job_id: str):
    import time
    job = active_jobs[job_id]
    job["start_time"] = time.time()
    metadata = job["metadata"]
    try:
        if job["cancelled"]:
            _finalize_job(job_id, "CANCELLED", metadata)
            return
            
        output_path = metadata["source_video"]
        if not os.path.exists(output_path):
            raise ValueError("Video sumber tidak ditemukan di memori lokal. Silakan proses dari awal.")
            
        subtitle_path = metadata.get("subtitle_path")
        highlights = metadata.get("highlights", [])
        
        job["status"] = "CROPPING"
        
        try:
            from backend.crop_utils import to_seconds
            highlights.sort(key=lambda x: to_seconds(x.get("start_time", "00:00:00")))
        except Exception:
            pass
            
        from backend.video_utils import get_video_duration
        dur_secs = get_video_duration(output_path)
        limit = _get_clip_limit(job.get("max_clips", 0), dur_secs)
            
        segments = highlights[:limit]
        
        for i, seg in enumerate(segments):
            if job["cancelled"]:
                _finalize_job(job_id, "CANCELLED", metadata)
                return
                
            broll_path = None
            if job.get("enable_broll") and job.get("pexels_api_key"):
                job["progress"] = f"Mengunduh B-Roll untuk klip {i+1}..."
                from backend.broll import download_pexels_broll
                query = seg.get("broll_query_en") or seg.get("description_en")
                if query:
                    broll_out = os.path.join(get_temp_dir(), f"broll_{job_id}_{i}.mp4")
                    success = download_pexels_broll(query, job["pexels_api_key"], broll_out, is_cancelled=lambda: job.get("cancelled", False))
                    if success:
                        broll_path = broll_out

            job["progress"] = f"Merender klip {i+1} dari {len(segments)}..."
            
            safe_start_time = re.sub(r'[^0-9a-zA-Z]', '', seg.get("start_time", ""))
            import shutil
            
            clip_output = output_path.replace(".mp4", f"_crop_{job_id}_{safe_start_time}.mp4")
            
            if job.get("output_dir"):
                out_dir = job["output_dir"]
                safe_title = ""
                if job.get("title"):
                    safe_title = re.sub(r'[^a-zA-Z0-9\s_-]', '', job["title"]).strip()
                    if safe_title:
                        out_dir = os.path.join(out_dir, safe_title)
                os.makedirs(out_dir, exist_ok=True)
                
                filename_base = safe_title if safe_title else f"AutoClipper_{job_id}"
                clip_output = os.path.join(out_dir, f"{filename_base}_clip_{i+1}.mp4")
            
            try:
                result_path = crop_to_vertical(
                    output_path, clip_output, seg["start_time"], seg["end_time"],
                    subtitle_path=subtitle_path if job.get("burn_subs", True) else None,
                    aspect_ratio=job["aspect_ratio"],
                    register_proc=lambda p: _register_proc(job, p),
                    should_cancel=lambda: job["cancelled"],
                    broll_path=broll_path
                )

                job["clips"].append({
                    "path": result_path,
                    "description": seg.get("description", f"Highlight {i+1}"),
                    "description_en": seg.get("description_en", seg.get("description", f"Highlight {i+1}")),
                    "description_id": seg.get("description_id", seg.get("description", f"Sorotan {i+1}")),
                    "start": seg["start_time"],
                    "end": seg["end_time"],
                    "subs": bool(subtitle_path),
                    "v": 0
                })
            except Exception as e:
                log_error(f"JOB RERENDER CROP {job_id}")
                job["failed"] = job.get("failed", 0) + 1
                print(f"Clip {i+1} failed: {e}")
                
        if not job["clips"]:
             raise ValueError("Semua klip gagal dirender.")
             
        _finalize_job(job_id, "DONE", metadata)
        
    except Exception as e:
        log_error(f"JOB RERENDER {job_id}")
        job["error"] = str(e)
        _finalize_job(job_id, "ERROR", metadata)

def create_rerun_ai_job(history_job_id: str, provider: str, api_key: str, aspect_ratio: str, burn_subs: bool, output_dir: str, extra_prompt: str, max_clips: int = 0, custom_base_url: str = "", custom_model_name: str = ""):
    from backend.db import get_history
    job_record = get_history(history_job_id)
    if not job_record:
        raise ValueError("History job not found")

    metadata = job_record.get("metadata", {})
    source_video = metadata.get("source_video")
    if not source_video or not os.path.exists(source_video):
        raise ValueError("Source video tidak ditemukan lagi di memori lokal.")
        
    new_job_id = str(uuid.uuid4())
    active_jobs[new_job_id] = {
        "id": new_job_id,
        "url": job_record.get("url", "local:"),
        "provider": provider,
        "api_key": api_key,
        "custom_base_url": custom_base_url,
        "custom_model_name": custom_model_name,
        "mode": "ai",
        "aspect_ratio": aspect_ratio,
        "caption_style": job_record.get("caption_style", "standard"),
        "burn_subs": burn_subs,
        "output_dir": output_dir,
        "quality": "best",
        "max_clips": max_clips,
        "status": "QUEUED",
        "progress": "Menyiapkan AI Koreksi...",
        "clips": [],
        "failed": 0,
        "error": None,
        "cancelled": False,
        "history_ref": history_job_id,
        "extra_prompt": extra_prompt,
        "metadata_ref": metadata
    }
    
    t = threading.Thread(target=_run_rerun_ai_job, args=(new_job_id, source_video, metadata))
    t.start()
    return new_job_id

def _run_rerun_ai_job(job_id: str, source_video: str, old_metadata: dict):
    import time
    job = active_jobs[job_id]
    job["start_time"] = time.time()
    metadata = dict(old_metadata) # clone
    try:
        if job["cancelled"]: return

        job["status"] = "TRANSCRIBING"
        job["progress"] = f"Menganalisis ulang dengan {job['provider']}..."
        
        is_karaoke = (job["caption_style"] == "karaoke")
        extra_prompt = job.get("extra_prompt", "")
        
        from backend.video_utils import get_video_duration
        dur_secs = get_video_duration(source_video)
        limit = _get_clip_limit(job.get("max_clips", 0), dur_secs)
        
        def is_cancelled():
            return job.get("cancelled", False)

        from backend.ai_utils import process_with_gemini, process_with_openai, process_with_openai_compatible, OPENAI_COMPAT_PROVIDERS
        if job["provider"].startswith("gemini"):
            model_name = job["provider"] if job["provider"] != "gemini" else "gemini-2.0-flash"
            ai_result = process_with_gemini(source_video, job["api_key"], extra_prompt=extra_prompt, model_name=model_name, limit=limit, is_cancelled=is_cancelled, register_proc=lambda p: _register_proc(job, p))
        elif job["provider"] == "custom" or job["provider"] in OPENAI_COMPAT_PROVIDERS:
            ai_result = process_with_openai_compatible(source_video, job["api_key"], job["provider"], karaoke=is_karaoke, extra_prompt=extra_prompt, limit=limit, is_cancelled=is_cancelled, register_proc=lambda p: _register_proc(job, p), custom_base_url=job.get("custom_base_url"), custom_model_name=job.get("custom_model_name"))
        else:
            ai_result = process_with_openai(source_video, job["api_key"], karaoke=is_karaoke, extra_prompt=extra_prompt, limit=limit, is_cancelled=is_cancelled, register_proc=lambda p: _register_proc(job, p))
            
        highlights = ai_result.get("highlights", [])
        subtitle_path = ai_result.get("subtitle_path")
        metadata["subtitle_path"] = subtitle_path
        
        if not highlights:
            raise ValueError("Tidak ada klip baru yang ditemukan AI dengan instruksi tersebut.")
            
        job["status"] = "CROPPING"
        
        try:
            from backend.crop_utils import to_seconds
            highlights.sort(key=lambda x: to_seconds(x.get("start_time", "00:00:00")))
        except Exception:
            pass
            
        segments = highlights[:limit]
            
        for i, seg in enumerate(segments):
            if job["cancelled"]: break
            
            broll_path = None
            if job.get("enable_broll") and job.get("pexels_api_key"):
                job["progress"] = f"Mengunduh B-Roll untuk klip {i+1}..."
                from backend.broll import download_pexels_broll
                query = seg.get("broll_query_en") or seg.get("description_en")
                if query:
                    broll_out = os.path.join(get_temp_dir(), f"broll_{job_id}_{i}.mp4")
                    success = download_pexels_broll(query, job["pexels_api_key"], broll_out, is_cancelled=is_cancelled)
                    if success:
                        broll_path = broll_out
                        
            job["progress"] = f"Memotong klip {i+1} dari {len(segments)} (AI Koreksi)..."
            try:
                clip_output = os.path.join(get_temp_dir(), f"{job_id}_clip_{i+1}.mp4")
                if job.get("output_dir"):
                    out_dir = job["output_dir"]
                    safe_title = ""
                    if job.get("title"):
                        safe_title = re.sub(r'[^a-zA-Z0-9\s_-]', '', job["title"]).strip()
                        if safe_title:
                            out_dir = os.path.join(out_dir, safe_title)
                    os.makedirs(out_dir, exist_ok=True)
                    
                    filename_base = safe_title if safe_title else f"AutoClipper_{job_id}"
                    clip_output = os.path.join(out_dir, f"{filename_base}_clip_{i+1}.mp4")

                result_path = crop_to_vertical(
                    source_video, clip_output, seg["start_time"], seg["end_time"],
                    subtitle_path=subtitle_path if job.get("burn_subs", True) else None,
                    aspect_ratio=job["aspect_ratio"],
                    register_proc=lambda p: _register_proc(job, p),
                    should_cancel=lambda: job["cancelled"],
                    broll_path=broll_path
                )
                
                job["clips"].append({
                    "path": result_path,
                    "description": seg.get("description", f"AI Corrected Highlight {i+1}"),
                    "description_en": seg.get("description_en", seg.get("description", f"AI Corrected Highlight {i+1}")),
                    "description_id": seg.get("description_id", seg.get("description", f"Sorotan Koreksi AI {i+1}")),
                    "start": seg["start_time"],
                    "end": seg["end_time"],
                    "subs": bool(subtitle_path),
                    "v": 0
                })
            except Exception as e:
                log_error(f"JOB RERUN AI CROP {job_id}")
                job["failed"] = job.get("failed", 0) + 1
                print(f"Clip {i+1} failed: {e}")
                
        if not job["clips"]:
             raise ValueError("Semua klip gagal dirender pada AI Koreksi.")
             
        _finalize_job(job_id, "DONE", metadata)
        
    except Exception as e:
        log_error(f"JOB RERUN AI {job_id}")
        job["error"] = str(e)
        _finalize_job(job_id, "ERROR", metadata)

def _finalize_job(job_id: str, status: str, metadata: dict = None):
    import time
    job = active_jobs[job_id]
    job["status"] = status

    if metadata is None:
        metadata = {}
        
    if "start_time" in job:
        metadata["duration_seconds"] = int(time.time() - job["start_time"])
    metadata["title"] = job.get("title", "")
    metadata["quality"] = job.get("quality", "best")
    # Use the REAL source path (download or local upload), not a hardcoded name.
    # Keep any source_video already carried over from a re-render/re-run job.
    if not metadata.get("source_video"):
        src = job.get("source_path")
        if src:
            metadata["source_video"] = src
    # Flag AI jobs so the UI can offer "AI Koreksi" (needs highlights to re-run).
    if metadata.get("highlights") and job.get("mode") == "ai":
        metadata["ai_job"] = True

    if status == "DONE" or status == "ERROR" or status == "CANCELLED":
        try:
            from backend.db import save_history
            save_history(job_id, job["url"], status, job["clips"], metadata)
        except Exception:
            pass
