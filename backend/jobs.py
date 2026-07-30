import threading
import re
import uuid
import traceback
import os
from backend.video_utils import download_youtube_video
from backend.ai_utils import process_with_openai, process_with_gemini, process_with_openai_compatible, OPENAI_COMPAT_PROVIDERS
from backend.crop_utils import crop_to_vertical
from backend.db import save_history, get_app_data_dir
from backend.logger import log_app, log_error

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



def create_job(url: str, provider: str, api_key: str, aspect_ratio: str = "9:16", caption_style: str = "standard", burn_subs: bool = True, output_dir: str = "", quality: str = "best", title: str = "", enable_broll: bool = False, pexels_api_key: str = "", max_clips: int = 0, custom_base_url: str = "", custom_model_name: str = "", is_gaming_video: bool = False) -> str:
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
        "is_gaming_video": is_gaming_video,
        "status": "PENDING",
        "progress": "",
        "cancelled": False,
        "clips": [],
        "failed": 0,
        "error": None
    }
    threading.Thread(target=_run_job, args=(job_id,), daemon=True).start()
    return job_id


def create_manual_job(url: str, clips: list, aspect_ratio: str = "9:16", caption_style: str = "standard",
                      burn_subs: bool = True, output_dir: str = "", quality: str = "best", title: str = "", is_gaming_video: bool = False) -> str:
    """Manual clipper job: cut user-chosen ranges, no AI highlight selection.

    Reuses the existing crop + faster-whisper caption pipeline but bypasses any
    LLM provider entirely (see the Smart Manual Clipper design spec).
    """
    job_id = str(uuid.uuid4())
    active_jobs[job_id] = {
        "id": job_id,
        "url": url,
        "provider": "manual",
        "api_key": "",
        "mode": "manual",
        "manual_clips": clips or [],
        "aspect_ratio": aspect_ratio,
        "caption_style": caption_style,
        "burn_subs": burn_subs,
        "output_dir": output_dir,
        "quality": quality,
        "title": title,
        "enable_broll": False,
        "pexels_api_key": "",
        "max_clips": 0,
        "is_gaming_video": is_gaming_video,
        "status": "PENDING",
        "progress": "",
        "cancelled": False,
        "clips": [],
        "failed": 0,
        "error": None,
    }
    threading.Thread(target=_run_manual_job, args=(job_id,), daemon=True).start()
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
        "is_gaming_video": hist.get("metadata", {}).get("is_gaming_video", False),
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
        log_app(f"[{job_id}] " + str("DOWNLOADING"))
        
        def is_cancelled():
            return job.get("cancelled", False)
            
        if job["url"].startswith("local:"):
            job["progress"] = "Mempersiapkan video lokal..."
            log_app(f"[{job_id}] " + str("Mempersiapkan video lokal..."))
            # output_path is exactly the local file we saved in /upload
            output_path = job["url"].split("local:")[1]
        else:
            job["progress"] = "Mengunduh video..."
            log_app(f"[{job_id}] " + str("Mengunduh video..."))
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
        log_app(f"[{job_id}] " + str("TRANSCRIBING"))
        job["progress"] = f"Menganalisis video dengan {job['provider']}..."
        log_app(f"[{job_id}] " + str(f"Menganalisis video dengan {job['provider']}..."))

        is_karaoke = (job["caption_style"] == "karaoke")
        
        # Predict subtitle path early so it's saved in metadata even if the LLM call fails
        base, _ = os.path.splitext(output_path)
        predicted_subtitle_path = base + (".words.json" if is_karaoke else ".srt")
        metadata["subtitle_path"] = predicted_subtitle_path

        try:
            if job["provider"] == "manual_ai":
                from backend.ai_utils import transcribe_with_faster_whisper, extract_audio, build_srt_from_segments
                import json
                
                if os.path.exists(predicted_subtitle_path) and os.path.getsize(predicted_subtitle_path) > 0:
                    job["progress"] = "Membaca subtitle yang sudah ada..."
                    log_app(f"[{job_id}] Membaca subtitle yang sudah ada: {predicted_subtitle_path}")
                    if is_karaoke:
                        with open(predicted_subtitle_path, "r", encoding="utf-8") as f:
                            transcript_data = json.load(f)
                        srt_segments = [{"start": s.get("start"), "end": s.get("end"), "text": s.get("text")} for s in transcript_data.get("segments", [])]
                        transcript_text = build_srt_from_segments(srt_segments)
                    else:
                        with open(predicted_subtitle_path, "r", encoding="utf-8") as f:
                            transcript_text = f.read()
                    subtitle_path = predicted_subtitle_path
                else:
                    audio_path = base + "_audio.mp3"
                    job["progress"] = "Mengekstrak audio..."
                    extract_audio(output_path, audio_path, register_proc=lambda p: _register_proc(job, p))
                    
                    job["progress"] = "Mentranskripsi audio (Lokal)..."
                    transcript = transcribe_with_faster_whisper(audio_path, karaoke=is_karaoke, is_cancelled=is_cancelled)
                    
                    if is_karaoke:
                        subtitle_path = base + ".words.json"
                        with open(subtitle_path, "w", encoding="utf-8") as f:
                            json.dump(transcript, f)
                        srt_segments = [{"start": s.get("start"), "end": s.get("end"), "text": s.get("text")} for s in transcript.get("segments", [])]
                        transcript_text = build_srt_from_segments(srt_segments)
                    else:
                        subtitle_path = base + ".srt"
                        with open(subtitle_path, "w", encoding="utf-8") as f:
                            f.write(str(transcript))
                        transcript_text = str(transcript)
                    
                from backend.ai_utils import generate_manual_prompt
                job["progress"] = "Membuat prompt manual..."
                manual_prompt = generate_manual_prompt(transcript_text, extra_prompt=metadata.get("extra_prompt", ""), limit=limit)
                
                metadata["manual_prompt"] = manual_prompt
                metadata["subtitle_path"] = subtitle_path
                job["status"] = "AWAITING_MANUAL"
                
                _finalize_job(job_id, "AWAITING_MANUAL", metadata)
                return
            elif job["provider"].startswith("gemini"):
                model_name = job["provider"] if job["provider"] != "gemini" else "gemini-2.0-flash"
                ai_result = process_with_gemini(output_path, job["api_key"], model_name=model_name, limit=limit, is_cancelled=is_cancelled, register_proc=lambda p: _register_proc(job, p))
            elif job["provider"] == "custom" or job["provider"] in OPENAI_COMPAT_PROVIDERS:
                ai_result = process_with_openai_compatible(output_path, job["api_key"], job["provider"], karaoke=is_karaoke, limit=limit, is_cancelled=is_cancelled, register_proc=lambda p: _register_proc(job, p), custom_base_url=job.get("custom_base_url"), custom_model_name=job.get("custom_model_name"))
            else:
                ai_result = process_with_openai(output_path, job["api_key"], karaoke=is_karaoke, limit=limit, is_cancelled=is_cancelled, register_proc=lambda p: _register_proc(job, p))
        except Exception as ai_e:
            raise ai_e

        highlights = ai_result.get("highlights", [])
        subtitle_path = ai_result.get("subtitle_path")

        metadata["subtitle_path"] = subtitle_path
        metadata["highlights"] = highlights

        if not highlights:
            raise ValueError("Tidak ada highlight yang ditemukan oleh AI.")
            
        if job["cancelled"]:
            _finalize_job(job_id, "CANCELLED")
            return
            
        _render_video_clips(job, job_id, metadata, output_path, subtitle_path, is_cancelled, limit)
    except Exception as e:
        log_error(f"JOB {job_id}")
        job["error"] = str(e)
        _finalize_job(job_id, "ERROR", locals().get('metadata', {}))

def _render_video_clips(job: dict, job_id: str, metadata: dict, output_path: str, subtitle_path: str, is_cancelled: callable, limit: int = 0):
    job["status"] = "CROPPING"
    log_app(f"[{job_id}] " + str("CROPPING"))
    
    try:
        from backend.crop_utils import to_seconds
        highlights = metadata.get("highlights", [])
        highlights.sort(key=lambda x: to_seconds(x.get("start_time", "00:00:00")))
    except Exception:
        pass
        
    highlights = metadata.get("highlights", [])
    segments = highlights[:limit] if limit > 0 else highlights
    metadata["highlights"] = segments

    # Detect layout once for the whole video (gaming split-screen auto-detect).
    job_layout = None
    if job.get("aspect_ratio") == "9:16" and job.get("is_gaming_video"):
        try:
            from backend.crop_utils import detect_video_layout
            job_layout = detect_video_layout(output_path)
        except Exception as e:
            log_error(f"Failed to detect video layout: {e}")
            job_layout = None

    for i, seg in enumerate(segments):
        if is_cancelled():
            _finalize_job(job_id, "CANCELLED")
            return
            
        broll_path = None
        if job.get("enable_broll") and job.get("pexels_api_key"):
            job["progress"] = f"Mengunduh B-Roll untuk klip {i+1}..."
            log_app(f"[{job_id}] " + str(f"Mengunduh B-Roll untuk klip {i+1}..."))
            from backend.broll import download_pexels_broll
            query = seg.get("broll_query_en") or seg.get("description_en")
            if query:
                broll_out = os.path.join(get_temp_dir(), f"broll_{job_id}_{i}.mp4")
                success = download_pexels_broll(query, job["pexels_api_key"], broll_out, is_cancelled=is_cancelled)
                if success:
                    broll_path = broll_out

        job["progress"] = f"Merender klip {i+1} dari {len(segments)}..."
        log_app(f"[{job_id}] " + str(f"Merender klip {i+1} dari {len(segments)}..."))
        
        import re, shutil, os
        safe_start_time = re.sub(r'[^0-9a-zA-Z]', '', seg.get("start_time", ""))
        
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
            from backend.crop_utils import crop_to_vertical
            result_path = crop_to_vertical(
                output_path, clip_output, seg["start_time"], seg["end_time"],
                subtitle_path=subtitle_path if job.get("burn_subs", True) else None,
                aspect_ratio=job["aspect_ratio"],
                register_proc=lambda p: _register_proc(job, p),
                should_cancel=is_cancelled,
                broll_path=broll_path,
                layout=job_layout
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
                "social": seg.get("social", {}),
                "v": 0
            })
        except Exception as e:
            log_error(f"JOB CROP {job_id}")
            job["failed"] = job.get("failed", 0) + 1
            log_error(f"Clip {i+1} failed", str(e))
            
    # Done
    if not job["clips"]:
         raise ValueError("Semua klip gagal dirender.")
         
    metadata["is_gaming_video"] = job.get("is_gaming_video", False)
    _finalize_job(job_id, "DONE", metadata)

def _run_manual_job(job_id: str):
    import time
    job = active_jobs[job_id]
    job["start_time"] = time.time()
    metadata = {}
    try:
        def is_cancelled():
            return job.get("cancelled", False)

        if is_cancelled():
            _finalize_job(job_id, "CANCELLED")
            return

        # 1. Resolve source (local upload or download).
        job["status"] = "DOWNLOADING"
        log_app(f"[{job_id}] " + str("DOWNLOADING"))
        if job["url"].startswith("local:"):
            job["progress"] = "Mempersiapkan video lokal..."
            log_app(f"[{job_id}] " + str("Mempersiapkan video lokal..."))
            source_path = job["url"].split("local:")[1]
        else:
            job["progress"] = "Mengunduh video..."
            log_app(f"[{job_id}] " + str("Mengunduh video..."))
            source_path = os.path.join(get_temp_dir(), f"source_{job_id}.mp4")
            os.makedirs(os.path.dirname(source_path), exist_ok=True)
            download_youtube_video(job["url"], source_path, job.get("quality", "best"), is_cancelled=is_cancelled)
        if not os.path.exists(source_path):
            raise ValueError("Video sumber tidak ditemukan.")
        job["source_path"] = source_path

        clips = job.get("manual_clips", [])
        if not clips:
            from backend.video_utils import get_video_duration
            from backend.crop_utils import _fmt_srt_ts
            dur_secs = get_video_duration(source_path)
            clips = [{"start": "00:00:00.000", "end": _fmt_srt_ts(dur_secs)}]

        # 2. Optional captions: transcribe the source once with faster-whisper
        #    (no LLM), then let crop_to_vertical shift subtitles per clip.
        subtitle_path = None
        if job.get("burn_subs", True):
            if is_cancelled():
                _finalize_job(job_id, "CANCELLED")
                return
            job["status"] = "TRANSCRIBING"
            log_app(f"[{job_id}] " + str("TRANSCRIBING"))
            job["progress"] = "Membuat subtitle otomatis..."
            log_app(f"[{job_id}] " + str("Membuat subtitle otomatis..."))
            from backend.ai_utils import transcribe_with_faster_whisper
            from backend.video_utils import extract_audio
            import json as _json
            is_karaoke = (job.get("caption_style") == "karaoke")
            base, _ = os.path.splitext(source_path)
            audio_path = base + "_audio.mp3"
            extract_audio(source_path, audio_path, register_proc=lambda p: _register_proc(job, p))
            transcript_data = transcribe_with_faster_whisper(audio_path, karaoke=is_karaoke, is_cancelled=is_cancelled)
            if is_karaoke:
                subtitle_path = base + ".words.json"
                with open(subtitle_path, "w", encoding="utf-8") as f:
                    _json.dump(transcript_data, f)
            else:
                subtitle_path = base + ".srt"
                with open(subtitle_path, "w", encoding="utf-8") as f:
                    f.write(transcript_data)

        # 3. Detect layout once (gaming split-screen auto-detect, 9:16 only).
        job_layout = None
        if job.get("aspect_ratio") == "9:16" and job.get("is_gaming_video"):
            try:
                from backend.crop_utils import detect_video_layout
                job_layout = detect_video_layout(source_path)
            except Exception as e:
                log_error(f"Failed to detect video layout (manual): {e}")
                job_layout = None

        # 4. Crop each user-selected range.
        job["status"] = "CROPPING"
        log_app(f"[{job_id}] " + str("CROPPING"))
        for i, clip in enumerate(clips):
            if is_cancelled():
                _finalize_job(job_id, "CANCELLED")
                return
            job["progress"] = f"Merender klip {i+1} dari {len(clips)}..."
            log_app(f"[{job_id}] " + str(f"Merender klip {i+1} dari {len(clips)}..."))
            start_t = clip.get("start")
            end_t = clip.get("end")

            clip_output = os.path.join(get_temp_dir(), f"{job_id}_manual_{i+1}.mp4")
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
                    source_path, clip_output, start_t, end_t,
                    subtitle_path=subtitle_path,
                    aspect_ratio=job["aspect_ratio"],
                    register_proc=lambda p: _register_proc(job, p),
                    should_cancel=lambda: job["cancelled"],
                    layout=job_layout,
                )
                job["clips"].append({
                    "path": result_path,
                    "description": f"Manual Clip {i+1}",
                    "description_en": f"Manual Clip {i+1}",
                    "description_id": f"Klip Manual {i+1}",
                    "start": start_t,
                    "end": end_t,
                    "subs": bool(subtitle_path),
                    "v": 0,
                })
            except Exception as e:
                log_error(f"MANUAL JOB CROP {job_id}")
                job["failed"] = job.get("failed", 0) + 1
                log_error(f"Manual clip {i+1} failed", str(e))

        if not job["clips"]:
            raise ValueError("Semua klip gagal dirender.")

        metadata["manual_clips"] = clips
        _finalize_job(job_id, "DONE", metadata)

    except Exception as e:
        log_error(f"MANUAL JOB {job_id}")
        job["error"] = str(e)
        _finalize_job(job_id, "ERROR", metadata)


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
        log_app(f"[{job_id}] " + str("CROPPING"))
        
        try:
            from backend.crop_utils import to_seconds
            highlights.sort(key=lambda x: to_seconds(x.get("start_time", "00:00:00")))
        except Exception:
            pass
            
        from backend.video_utils import get_video_duration
        dur_secs = get_video_duration(output_path)
        limit = _get_clip_limit(job.get("max_clips", 0), dur_secs)
            
        segments = highlights[:limit]

        job_layout = None
        if job.get("aspect_ratio") == "9:16":
            try:
                from backend.crop_utils import detect_video_layout
                job_layout = detect_video_layout(output_path)
            except Exception as e:
                log_error(f"Failed to detect video layout (rerender): {e}")
                job_layout = None

        for i, seg in enumerate(segments):
            if job["cancelled"]:
                _finalize_job(job_id, "CANCELLED", metadata)
                return
                
            broll_path = None
            if job.get("enable_broll") and job.get("pexels_api_key"):
                job["progress"] = f"Mengunduh B-Roll untuk klip {i+1}..."
                log_app(f"[{job_id}] " + str(f"Mengunduh B-Roll untuk klip {i+1}..."))
                from backend.broll import download_pexels_broll
                query = seg.get("broll_query_en") or seg.get("description_en")
                if query:
                    broll_out = os.path.join(get_temp_dir(), f"broll_{job_id}_{i}.mp4")
                    success = download_pexels_broll(query, job["pexels_api_key"], broll_out, is_cancelled=lambda: job.get("cancelled", False))
                    if success:
                        broll_path = broll_out

            job["progress"] = f"Merender klip {i+1} dari {len(segments)}..."
            log_app(f"[{job_id}] " + str(f"Merender klip {i+1} dari {len(segments)}..."))
            
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
                    broll_path=broll_path,
                    layout=job_layout
                )

                job["clips"].append({
                    "path": result_path,
                    "description": seg.get("description", f"Highlight {i+1}"),
                    "description_en": seg.get("description_en", seg.get("description", f"Highlight {i+1}")),
                    "description_id": seg.get("description_id", seg.get("description", f"Sorotan {i+1}")),
                    "start": seg["start_time"],
                    "end": seg["end_time"],
                    "subs": bool(subtitle_path),
                    "social": seg.get("social", {}),
                    "v": 0
                })
            except Exception as e:
                log_error(f"JOB RERENDER CROP {job_id}")
                job["failed"] = job.get("failed", 0) + 1
                log_error(f"Clip {i+1} failed", str(e))
                
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
        log_app(f"[{job_id}] " + str("TRANSCRIBING"))
        job["progress"] = f"Menganalisis ulang dengan {job['provider']}..."
        log_app(f"[{job_id}] " + str(f"Menganalisis ulang dengan {job['provider']}..."))
        
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
        metadata["highlights"] = highlights
        
        if not highlights:
            raise ValueError("Tidak ada klip baru yang ditemukan AI dengan instruksi tersebut.")
            
        job["status"] = "CROPPING"
        log_app(f"[{job_id}] " + str("CROPPING"))
        
        try:
            from backend.crop_utils import to_seconds
            highlights.sort(key=lambda x: to_seconds(x.get("start_time", "00:00:00")))
        except Exception:
            pass
            
        segments = highlights[:limit]

        job_layout = None
        if job.get("aspect_ratio") == "9:16":
            try:
                from backend.crop_utils import detect_video_layout
                job_layout = detect_video_layout(source_video)
            except Exception:
                job_layout = None

        for i, seg in enumerate(segments):
            if job["cancelled"]: break
            
            broll_path = None
            if job.get("enable_broll") and job.get("pexels_api_key"):
                job["progress"] = f"Mengunduh B-Roll untuk klip {i+1}..."
                log_app(f"[{job_id}] " + str(f"Mengunduh B-Roll untuk klip {i+1}..."))
                from backend.broll import download_pexels_broll
                query = seg.get("broll_query_en") or seg.get("description_en")
                if query:
                    broll_out = os.path.join(get_temp_dir(), f"broll_{job_id}_{i}.mp4")
                    success = download_pexels_broll(query, job["pexels_api_key"], broll_out, is_cancelled=is_cancelled)
                    if success:
                        broll_path = broll_out
                        
            job["progress"] = f"Memotong klip {i+1} dari {len(segments)} (AI Koreksi)..."
            log_app(f"[{job_id}] " + str(f"Memotong klip {i+1} dari {len(segments)} (AI Koreksi)..."))
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
                    broll_path=broll_path,
                    layout=job_layout
                )
                
                job["clips"].append({
                    "path": result_path,
                    "description": seg.get("description", f"AI Corrected Highlight {i+1}"),
                    "description_en": seg.get("description_en", seg.get("description", f"AI Corrected Highlight {i+1}")),
                    "description_id": seg.get("description_id", seg.get("description", f"Sorotan Koreksi AI {i+1}")),
                    "start": seg["start_time"],
                    "end": seg["end_time"],
                    "subs": bool(subtitle_path),
                    "social": seg.get("social", {}),
                    "v": 0
                })
            except Exception as e:
                log_error(f"JOB RERUN AI CROP {job_id}")
                job["failed"] = job.get("failed", 0) + 1
                log_error(f"Clip {i+1} failed", str(e))
                
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
    log_app(f"[{job_id}] " + str(status))

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
        
    for key in ["provider", "api_key", "custom_base_url", "custom_model_name", "mode", "aspect_ratio", "caption_style", "burn_subs", "output_dir", "enable_broll", "pexels_api_key", "max_clips", "is_gaming_video"]:
        if key in job:
            metadata[key] = job[key]

    if status in ["DONE", "ERROR", "CANCELLED", "AWAITING_MANUAL"]:
        try:
            from backend.db import save_history
            save_history(job_id, job["url"], status, job["clips"], metadata)
        except Exception:
            pass


def resume_manual_job(history_id: str, json_payload: str) -> str:
    from backend.db import get_history
    hist = get_history(history_id)
    if not hist or not hist.get("metadata"):
        raise ValueError("Histori pekerjaan tidak valid.")
        
    hist_meta = hist["metadata"]
    if not hist_meta.get("source_video") or not hist_meta.get("subtitle_path"):
        raise ValueError("Video sumber atau subtitle tidak ditemukan.")

    job_id = str(uuid.uuid4())
    active_jobs[job_id] = {
        "id": job_id,
        "url": hist["url"],
        "provider": "manual_ai",
        "api_key": "",
        "mode": hist_meta.get("mode", "ai"),
        "aspect_ratio": hist_meta.get("aspect_ratio", "9:16"),
        "caption_style": hist_meta.get("caption_style", "standard"),
        "burn_subs": hist_meta.get("burn_subs", True),
        "output_dir": hist_meta.get("output_dir", ""),
        "enable_broll": hist_meta.get("enable_broll", False),
        "pexels_api_key": hist_meta.get("pexels_api_key", ""),
        "max_clips": hist_meta.get("max_clips", 0),
        "is_gaming_video": hist_meta.get("is_gaming_video", False),
        "status": "PENDING",
        "progress": "Melanjutkan perenderan...",
        "cancelled": False,
        "clips": [],
        "failed": 0,
        "error": None,
        "source_path": hist_meta["source_video"]
    }
    
    # Parse payload
    from backend.ai_utils import _parse_highlights
    parsed = _parse_highlights(json_payload)
    if not parsed:
        raise ValueError("Format JSON payload tidak valid atau kosong.")
        
    hist_meta["highlights"] = parsed
    
    import threading
    threading.Thread(target=_run_manual_resume_job, args=(job_id, hist_meta), daemon=True).start()
    return job_id

def _run_manual_resume_job(job_id: str, metadata: dict):
    import time
    job = active_jobs[job_id]
    job["start_time"] = time.time()
    
    try:
        def is_cancelled():
            return job.get("cancelled", False)
            
        output_path = metadata.get("source_video")
        subtitle_path = metadata.get("subtitle_path")
        
        limit = _get_clip_limit(job.get("max_clips", 0), metadata.get("duration_seconds", 0))
        
        _render_video_clips(job, job_id, metadata, output_path, subtitle_path, is_cancelled, limit)
    except Exception as e:
        log_error(f"JOB RESUME {job_id}")
        job["error"] = str(e)
        _finalize_job(job_id, "ERROR", metadata)

def create_resume_job(history_id: str, fallback_api_key: str = None, fallback_provider: str = None, fallback_custom_base_url: str = None, fallback_custom_model_name: str = None) -> str:
    from backend.db import get_history
    hist = get_history(history_id)
    if not hist or not hist.get("metadata") or not hist["metadata"].get("source_video"):
        raise ValueError("Video sumber tidak ditemukan di histori.")

    job_id = str(uuid.uuid4())
    hist_meta = hist.get("metadata", {})
    active_jobs[job_id] = {
        "id": job_id,
        "url": hist["url"],
        "provider": hist_meta.get("provider") or fallback_provider or "openai",
        "api_key": hist_meta.get("api_key") or fallback_api_key or "",
        "custom_base_url": hist_meta.get("custom_base_url") or fallback_custom_base_url or "",
        "custom_model_name": hist_meta.get("custom_model_name") or fallback_custom_model_name or "",
        "mode": hist_meta.get("mode", "ai"),
        "aspect_ratio": hist_meta.get("aspect_ratio", "9:16"),
        "caption_style": hist_meta.get("caption_style", "standard"),
        "burn_subs": hist_meta.get("burn_subs", True),
        "output_dir": hist_meta.get("output_dir", ""),
        "quality": hist_meta.get("quality", "best"),
        "title": hist_meta.get("title", ""),
        "enable_broll": hist_meta.get("enable_broll", False),
        "pexels_api_key": hist_meta.get("pexels_api_key", ""),
        "max_clips": hist_meta.get("max_clips", 0),
        "is_gaming_video": hist_meta.get("is_gaming_video", False),
        "status": "QUEUED",
        "progress": "Melanjutkan AI Processing...",
        "cancelled": False,
        "clips": [],
        "failed": 0,
        "error": None,
        "metadata": hist_meta
    }
    import threading
    threading.Thread(target=_run_resume_job, args=(job_id,), daemon=True).start()
    return job_id

def _run_resume_job(job_id: str):
    import time
    job = active_jobs[job_id]
    job["start_time"] = time.time()
    metadata = job["metadata"]
    try:
        if job["cancelled"]:
            _finalize_job(job_id, "CANCELLED", metadata)
            return

        source_video = metadata["source_video"]
        if not os.path.exists(source_video):
            raise ValueError("Video lokal tidak ditemukan. Silakan proses dari awal.")

        subtitle_path = metadata.get("subtitle_path")
        has_subtitle = subtitle_path and os.path.exists(subtitle_path)

        def is_cancelled():
            return job.get("cancelled", False)

        from backend.video_utils import get_video_duration
        dur_secs = get_video_duration(source_video)
        limit = _get_clip_limit(job.get("max_clips", 0), dur_secs)

        highlights = []

        if has_subtitle:
            job["status"] = "TRANSCRIBING"
            log_app(f"[{job_id}] TRANSCRIBING (Resuming)")
            job["progress"] = f"Menganalisis ulang dengan {job['provider']} (Resume)..."

            with open(subtitle_path, "r", encoding="utf-8") as f:
                transcript_text = f.read()

            from backend.ai_utils import get_highlights, OPENAI_COMPAT_PROVIDERS
            if job["provider"].startswith("gemini"):
                from google import genai
                from google.genai import types
                from backend.ai_utils import _with_retry, HIGHLIGHT_GUIDANCE, SOCIAL_PROMPT_TEMPLATE, _get_user_datetime_context, _parse_highlights
                client = genai.Client(api_key=job["api_key"])
                model_name = job["provider"] if job["provider"] != "gemini" else "gemini-2.0-flash"
                
                video_file = _with_retry(lambda: client.files.upload(file=source_video), attempts=8)
                while video_file.state.name == "PROCESSING":
                    if is_cancelled(): raise Exception("Cancelled by user")
                    time.sleep(2)
                    video_file = _with_retry(lambda: client.files.get(name=video_file.name), attempts=8)
                
                prompt = (
                    "Watch this video and read the following accurate transcript. "
                    f"{HIGHLIGHT_GUIDANCE}\n\nFind up to {limit} of the best highlights.\n\n"
                    f"{SOCIAL_PROMPT_TEMPLATE.format(datetime_context=_get_user_datetime_context())}\n\n"
                    f"Transcript:\n{transcript_text}"
                )
                response = _with_retry(lambda: client.models.generate_content(
                    model=model_name,
                    contents=[video_file, prompt],
                    config=types.GenerateContentConfig(response_mime_type="application/json")
                ))
                highlights = _parse_highlights(response.text)
            else:
                base_url = None
                model = "gpt-4o-mini"
                if job["provider"] == "custom":
                    base_url = job.get("custom_base_url")
                    model = job.get("custom_model_name")
                elif job["provider"] in OPENAI_COMPAT_PROVIDERS:
                    cfg = OPENAI_COMPAT_PROVIDERS[job["provider"]]
                    base_url = cfg["base_url"]
                    model = cfg["model"]
                
                effective_key = job["api_key"] or "-" if job["provider"] == "custom" else job["api_key"]
                highlights = get_highlights(transcript_text, effective_key, "", base_url=base_url, model=model, limit=limit)
        else:
            job["status"] = "TRANSCRIBING"
            log_app(f"[{job_id}] TRANSCRIBING (Resuming Extracting)")
            job["progress"] = f"Mengekstrak dan menganalisis dengan {job['provider']} (Resume)..."
            
            is_karaoke = (job.get("caption_style") == "karaoke")
            from backend.ai_utils import process_with_gemini, process_with_openai_compatible, process_with_openai, OPENAI_COMPAT_PROVIDERS

            base, _ = os.path.splitext(source_video)
            predicted_subtitle_path = base + (".words.json" if is_karaoke else ".srt")
            metadata["subtitle_path"] = predicted_subtitle_path

            if job["provider"].startswith("gemini"):
                model_name = job["provider"] if job["provider"] != "gemini" else "gemini-2.0-flash"
                ai_result = process_with_gemini(source_video, job["api_key"], model_name=model_name, limit=limit, is_cancelled=is_cancelled, register_proc=lambda p: _register_proc(job, p))
            elif job["provider"] == "custom" or job["provider"] in OPENAI_COMPAT_PROVIDERS:
                ai_result = process_with_openai_compatible(source_video, job["api_key"], job["provider"], karaoke=is_karaoke, limit=limit, is_cancelled=is_cancelled, register_proc=lambda p: _register_proc(job, p), custom_base_url=job.get("custom_base_url"), custom_model_name=job.get("custom_model_name"))
            else:
                ai_result = process_with_openai(source_video, job["api_key"], karaoke=is_karaoke, limit=limit, is_cancelled=is_cancelled, register_proc=lambda p: _register_proc(job, p))
            
            highlights = ai_result.get("highlights", [])
            subtitle_path = ai_result.get("subtitle_path")
            metadata["subtitle_path"] = subtitle_path

        if not highlights:
            raise ValueError("Tidak ada highlight yang ditemukan oleh AI.")

        metadata["highlights"] = highlights
        job["status"] = "CROPPING"
        log_app(f"[{job_id}] CROPPING")
        
        try:
            from backend.crop_utils import to_seconds
            highlights.sort(key=lambda x: to_seconds(x.get("start_time", "00:00:00")))
        except:
            pass

        segments = highlights[:limit]
        job_layout = None
        if job.get("aspect_ratio") == "9:16":
            try:
                from backend.crop_utils import detect_video_layout
                job_layout = detect_video_layout(source_video)
            except:
                job_layout = None

        for i, seg in enumerate(segments):
            if is_cancelled(): break
            
            broll_path = None
            if job.get("enable_broll") and job.get("pexels_api_key"):
                job["progress"] = f"Mengunduh B-Roll untuk klip {i+1}..."
                from backend.broll import download_pexels_broll
                query = seg.get("broll_query_en") or seg.get("description_en")
                if query:
                    broll_out = os.path.join(get_temp_dir(), f"broll_{job_id}_{i}.mp4")
                    success = download_pexels_broll(query, job["pexels_api_key"], broll_out, is_cancelled=is_cancelled)
                    if success: broll_path = broll_out

            job["progress"] = f"Merender klip {i+1} dari {len(segments)}..."
            safe_start_time = re.sub(r'[^0-9a-zA-Z]', '', seg.get("start_time", ""))
            
            clip_output = os.path.join(get_temp_dir(), f"{job_id}_clip_{safe_start_time}.mp4")
            if job.get("output_dir"):
                out_dir = job["output_dir"]
                safe_title = ""
                if job.get("title"):
                    safe_title = re.sub(r'[^a-zA-Z0-9\s_-]', '', job["title"]).strip()
                    if safe_title: out_dir = os.path.join(out_dir, safe_title)
                os.makedirs(out_dir, exist_ok=True)
                filename_base = safe_title if safe_title else f"AutoClipper_{job_id}"
                clip_output = os.path.join(out_dir, f"{filename_base}_clip_{i+1}.mp4")

            try:
                from backend.crop_utils import crop_to_vertical
                result_path = crop_to_vertical(
                    source_video, clip_output, seg["start_time"], seg["end_time"],
                    subtitle_path=subtitle_path if job.get("burn_subs", True) else None,
                    aspect_ratio=job["aspect_ratio"],
                    register_proc=lambda p: _register_proc(job, p),
                    should_cancel=is_cancelled,
                    broll_path=broll_path,
                    layout=job_layout
                )
                job["clips"].append({
                    "path": result_path,
                    "description": seg.get("description", f"Highlight {i+1}"),
                    "description_en": seg.get("description_en", seg.get("description", f"Highlight {i+1}")),
                    "description_id": seg.get("description_id", seg.get("description", f"Sorotan {i+1}")),
                    "start": seg["start_time"],
                    "end": seg["end_time"],
                    "subs": bool(subtitle_path),
                    "social": seg.get("social", {}),
                    "v": 0
                })
            except Exception as e:
                log_error(f"JOB RESUME CROP {job_id}", str(e))
                job["failed"] = job.get("failed", 0) + 1
                log_error(f"Clip {i+1} failed", str(e))

        if not job["clips"]:
            raise ValueError("Semua klip gagal dirender pada saat resume.")

        _finalize_job(job_id, "DONE", metadata)

    except Exception as e:
        log_error(f"JOB RESUME {job_id}", str(e))
        job["error"] = str(e)
        _finalize_job(job_id, "ERROR", metadata)
