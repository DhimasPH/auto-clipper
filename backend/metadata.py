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

def generate_thumbnails(video_path: str, duration: float,
                        thumb_w: int = 160, thumb_h: int = 90,
                        max_thumbs: int = 24) -> list:
    """Extract evenly-spaced filmstrip thumbnails as base64 JPEG data URIs.

    Each frame is scaled to *cover* thumb_w x thumb_h (centre-cropped, no
    stretching) so the frontend can lay them edge-to-edge like a CapCut/Premiere
    filmstrip without distortion. Count is small and fixed so an hour-long video
    stays light and each frame stays recognisable.
    """
    import base64
    import tempfile
    import shutil
    import glob

    if duration <= 0:
        duration = 1.0
    count = max(6, min(max_thumbs, max(6, int(duration))))
    fps = count / duration if duration else 1.0

    tmpdir = tempfile.mkdtemp(prefix="ac_thumbs_")
    try:
        pattern = os.path.join(tmpdir, "th_%04d.jpg")
        cmd = [
            "ffmpeg", "-y", "-i", video_path,
            "-vf", f"fps={fps:.6f},scale={thumb_w}:{thumb_h}:force_original_aspect_ratio=increase,"
                   f"crop={thumb_w}:{thumb_h}",
            "-qscale:v", "4", "-frames:v", str(count),
            pattern,
        ]
        res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                             text=True, encoding="utf-8", errors="replace")
        files = sorted(glob.glob(os.path.join(tmpdir, "th_*.jpg")))
        if res.returncode != 0 and not files:
            raise RuntimeError(f"thumbnail generation failed: {(res.stderr or '')[-500:]}")
        uris = []
        for fp in files:
            with open(fp, "rb") as fh:
                b64 = base64.b64encode(fh.read()).decode("ascii")
            uris.append(f"data:image/jpeg;base64,{b64}")
        return uris
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


def generate_thumbnails_window(video_path: str, start: float, end: float, count: int,
                               thumb_w: int = 160, thumb_h: int = 90) -> list:
    """Extract `count` cover-cropped thumbnails evenly across [start, end].

    Powers the zoomable timeline: the frontend requests just the frames for the
    currently-visible window, so an hour-long video never renders more frames
    than fit on screen.
    """
    import base64
    import tempfile
    import shutil
    import glob

    start = max(0.0, float(start))
    end = float(end)
    span = end - start
    if span <= 0:
        span = 1.0
        end = start + span
    count = max(1, min(60, int(count)))
    fps = count / span

    tmpdir = tempfile.mkdtemp(prefix="ac_thumbs_")
    try:
        pattern = os.path.join(tmpdir, "th_%04d.jpg")
        cmd = [
            "ffmpeg", "-y",
            "-ss", f"{start:.3f}", "-to", f"{end:.3f}",
            "-i", video_path,
            "-vf", f"fps={fps:.6f},scale={thumb_w}:{thumb_h}:force_original_aspect_ratio=increase,"
                   f"crop={thumb_w}:{thumb_h}",
            "-qscale:v", "5", "-frames:v", str(count),
            pattern,
        ]
        res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                             text=True, encoding="utf-8", errors="replace")
        files = sorted(glob.glob(os.path.join(tmpdir, "th_*.jpg")))
        if res.returncode != 0 and not files:
            raise RuntimeError(f"windowed thumbnail generation failed: {(res.stderr or '')[-400:]}")
        uris = []
        for fp in files:
            with open(fp, "rb") as fh:
                uris.append("data:image/jpeg;base64," + base64.b64encode(fh.read()).decode("ascii"))
        return uris
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


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
        "thumbnails": None,
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
            # Higher resolution so the waveform still shows detail when zoomed in.
            target = min(16000, max(2000, int(duration * 8)))
            job["peaks"] = compute_peaks(video_path, target_peaks=target)
        except Exception as e:
            job["errors"]["peaks"] = str(e)
            job["peaks"] = []

    if "thumbnails" in types:
        job["progress"] = "Generating thumbnails..."
        try:
            job["thumbnails"] = generate_thumbnails(video_path, duration)
        except Exception as e:
            job["errors"]["thumbnails"] = str(e)
            job["thumbnails"] = []

    job["progress"] = ""
    job["status"] = "DONE"
