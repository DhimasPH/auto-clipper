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


def download_youtube_video(url: str, output_path: str, quality: str = "best") -> Path:
    format_str = 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best'
    if quality == "1080p":
        format_str = 'bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best'
    elif quality == "720p":
        format_str = 'bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best'

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
