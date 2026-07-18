"""Async metadata extraction for the Smart Manual Clipper.

Targets long-form content (podcasts, gaming streams of an hour or more), so all
heavy work (silence detection, waveform peaks, thumbnail sprite) runs in a
background thread and the frontend polls for the result. Everything is derived
with ffmpeg and downsampled so the cost stays bounded regardless of duration.
"""

import os
import re
import uuid
import threading
import subprocess
import math

from backend.db import get_app_data_dir

# job_id -> {status, progress, silence, peaks, sprite, error, ...}
metadata_jobs = {}


def _meta_dir():
    d = os.path.join(get_app_data_dir(), "temp_downloads", "metadata")
    os.makedirs(d, exist_ok=True)
    return d


# --- Silence detection -----------------------------------------------------

def parse_silence(stderr_text: str) -> list:
    """Parse ffmpeg ``silencedetect`` stderr into ``[{start, end}, ...]``.

    Pure function so it can be unit-tested against captured ffmpeg output. A
    trailing ``silence_start`` with no matching end (video ends mid-silence) is
    dropped since we can't know its end without the duration.
    """
    segments = []
    pending_start = None
    for line in stderr_text.splitlines():
        m_start = re.search(r"silence_start:\s*(-?\d+(?:\.\d+)?)", line)
        if m_start:
            pending_start = float(m_start.group(1))
            continue
        m_end = re.search(r"silence_end:\s*(-?\d+(?:\.\d+)?)", line)
        if m_end and pending_start is not None:
            end = float(m_end.group(1))
            segments.append({"start": max(0.0, pending_start), "end": end})
            pending_start = None
    return segments


def run_silencedetect(video_path: str, noise_db: int = -30, min_duration: float = 0.5) -> list:
    """Run ffmpeg silencedetect and return silence segments."""
    cmd = [
        "ffmpeg", "-i", video_path,
        "-af", f"silencedetect=noise={noise_db}dB:d={min_duration}",
        "-f", "null", "-",
    ]
    res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                         text=True, encoding="utf-8", errors="replace")
    return parse_silence(res.stderr or "")


# --- Waveform peaks --------------------------------------------------------

def compute_peaks(video_path: str, target_peaks: int = 1000, sample_rate: int = 4000) -> list:
    """Downsampled waveform peaks (0.0-1.0) for wavesurfer to render.

    Decodes a low-rate mono PCM stream and reduces it to at most
    ``target_peaks`` buckets, so a wavesurfer instance never has to decode the
    original (hour-long) audio in the browser.
    """
    import numpy as np

    cmd = [
        "ffmpeg", "-i", video_path,
        "-ac", "1", "-ar", str(sample_rate),
        "-f", "s16le", "-",
    ]
    res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if res.returncode != 0 or not res.stdout:
        return []
    samples = np.frombuffer(res.stdout, dtype=np.int16).astype(np.float32)
    if samples.size == 0:
        return []
    samples = np.abs(samples) / 32768.0

    n = min(target_peaks, samples.size)
    if n <= 0:
        return []
    bucket = math.ceil(samples.size / n)
    peaks = []
    for i in range(0, samples.size, bucket):
        chunk = samples[i:i + bucket]
        if chunk.size:
            peaks.append(round(float(chunk.max()), 4))
    return peaks


# --- Thumbnail sprite ------------------------------------------------------

def generate_thumbnail_sprite(video_path: str, out_path: str, duration: float,
                              cols: int = 10, thumb_w: int = 160, thumb_h: int = 90,
                              max_thumbs: int = 100) -> dict:
    """Render a downsampled filmstrip sprite (grid) covering the whole video.

    Returns sprite geometry so the frontend can map a timestamp to a cell.
    ``count`` thumbnails are spread evenly across ``duration`` (capped at
    ``max_thumbs`` so an hour-long video isn't thousands of frames).
    """
    if duration <= 0:
        duration = 1.0
    count = max(1, min(max_thumbs, int(duration)))
    rows = math.ceil(count / cols)
    fps = count / duration if duration else 1.0

    cmd = [
        "ffmpeg", "-y", "-i", video_path,
        "-vf", f"fps={fps:.6f},scale={thumb_w}:{thumb_h}:force_original_aspect_ratio=increase,"
               f"crop={thumb_w}:{thumb_h},tile={cols}x{rows}",
        "-frames:v", "1", "-qscale:v", "3",
        out_path,
    ]
    res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                         text=True, encoding="utf-8", errors="replace")
    if res.returncode != 0 or not os.path.exists(out_path):
        raise RuntimeError(f"sprite generation failed: {(res.stderr or '')[-500:]}")
    return {
        "path": out_path,
        "count": count,
        "cols": cols,
        "rows": rows,
        "thumb_w": thumb_w,
        "thumb_h": thumb_h,
        "interval": duration / count,
    }


# --- Async job orchestration ----------------------------------------------

def create_metadata_job(video_path: str, types: list) -> str:
    job_id = str(uuid.uuid4())
    metadata_jobs[job_id] = {
        "id": job_id,
        "status": "PENDING",
        "progress": "",
        "types": types or ["silence"],
        "silence": None,
        "peaks": None,
        "sprite": None,
        "error": None,
        "errors": {},  # per-artifact soft failures
    }
    threading.Thread(target=_run_metadata_job, args=(job_id, video_path), daemon=True).start()
    return job_id


def get_metadata_job(job_id: str) -> dict:
    return metadata_jobs.get(job_id)


def _run_metadata_job(job_id: str, video_path: str):
    from backend.video_utils import get_video_duration
    job = metadata_jobs[job_id]
    job["status"] = "RUNNING"
    types = job["types"]

    if not os.path.exists(video_path):
        job["status"] = "ERROR"
        job["error"] = "Source video not found."
        return

    duration = get_video_duration(video_path) or 0.0
    job["duration"] = duration

    if "silence" in types:
        job["progress"] = "Detecting silence..."
        try:
            job["silence"] = run_silencedetect(video_path)
        except Exception as e:
            job["errors"]["silence"] = str(e)
            job["silence"] = []

    if "peaks" in types:
        job["progress"] = "Computing waveform..."
        try:
            job["peaks"] = compute_peaks(video_path)
        except Exception as e:
            job["errors"]["peaks"] = str(e)
            job["peaks"] = []

    if "thumbnails" in types:
        job["progress"] = "Generating thumbnails..."
        try:
            sprite_path = os.path.join(_meta_dir(), f"sprite_{job_id}.jpg")
            job["sprite"] = generate_thumbnail_sprite(video_path, sprite_path, duration)
        except Exception as e:
            job["errors"]["thumbnails"] = str(e)
            job["sprite"] = None

    job["progress"] = ""
    job["status"] = "DONE"
