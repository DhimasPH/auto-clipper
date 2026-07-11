import yt_dlp
import contextlib
import io
import subprocess
from pathlib import Path


class _SilentLogger:
    """Route all yt-dlp output away from stdout/stderr.

    When the backend runs as an Electron child process on Windows, its stderr
    handle can be invalid, so yt-dlp crashes with ``OSError: [Errno 22]`` the
    moment it tries to flush a warning. Giving yt-dlp a logger makes it send
    messages here instead of ever touching the broken stream.
    """

    def debug(self, msg):
        pass

    def info(self, msg):
        pass

    def warning(self, msg):
        pass

    def error(self, msg):
        pass


class DownloadCancelledError(Exception):
    pass

def quality_to_format(quality: str) -> str:
    """yt-dlp format selector for a requested quality label.

    Heights use '<=' so yt-dlp gracefully falls back to the best resolution at
    or below the target when the exact one isn't available.
    """
    caps = {"2160p": 2160, "1440p": 1440, "1080p": 1080, "720p": 720, "480p": 480}
    h = caps.get(quality)
    if h:
        return f"bestvideo[height<={h}][ext=mp4]+bestaudio[ext=m4a]/best[height<={h}][ext=mp4]/best"
    return 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best'


def probe_formats(url: str) -> list:
    """Available video heights for a URL, descending & unique, via yt-dlp."""
    ydl_opts = {
        'quiet': True, 'no_warnings': True, 'skip_download': True,
        'logger': _SilentLogger(),
    }
    sink = io.StringIO()
    with contextlib.redirect_stdout(sink), contextlib.redirect_stderr(sink):
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
    formats = (info or {}).get("formats", []) if isinstance(info, dict) else []
    heights = {f.get("height") for f in formats if isinstance(f, dict) and f.get("height")}
    return sorted(heights, reverse=True)


def download_youtube_video(url: str, output_path: str, quality: str = "best", is_cancelled: callable = None) -> Path:
    format_str = quality_to_format(quality)

    ydl_opts = {
        'format': format_str,
        'outtmpl': output_path,
        'merge_output_format': 'mp4',
        'quiet': True,
        'no_warnings': True,
        'noprogress': True,
        'updatetime': False,
        'logger': _SilentLogger(),
    }
    
    if is_cancelled:
        def hook(d):
            if is_cancelled():
                raise DownloadCancelledError("Download cancelled by user")
        ydl_opts['progress_hooks'] = [hook]

    # yt-dlp snapshots sys.stdout/stderr at construction and writes to them
    # directly for some messages (e.g. deprecation notices), bypassing the
    # logger. On a broken Windows child-process stream that flush raises
    # OSError [Errno 22], so we redirect both streams to an in-memory sink for
    # the whole call.
    sink = io.StringIO()
    with contextlib.redirect_stdout(sink), contextlib.redirect_stderr(sink):
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])

    return Path(output_path)



def extract_audio(video_path: str, audio_path: str) -> str:
    """Extract a compact mono 16kHz audio track for speech-to-text.

    Whisper only accepts audio and caps uploads at 25MB, so sending the raw
    (often multi-GB) video fails on real long-form content. A mono 16kHz MP3
    stays tiny even for hour-long videos while keeping speech intelligible.
    """
    cmd = [
        "ffmpeg", "-y",
        "-i", video_path,
        "-vn",
        "-ac", "1",
        "-ar", "16000",
        "-b:a", "64k",
        audio_path,
    ]
    subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    return audio_path
