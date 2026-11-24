import yt_dlp
import contextlib
import io
import subprocess
import os
import sys
import shutil
from pathlib import Path
from backend.cookies import ytdlp_cookiefile
from backend.errors import classify_download_error
from backend.logger import log_error
from backend.stage_timer import report, stage


def get_ffmpeg_path() -> str | None:
    """Finds the absolute path to the ffmpeg executable."""
    found = shutil.which("ffmpeg")
    if found:
        return found
    project_root = Path(__file__).resolve().parent.parent
    candidates = [
        project_root / "bin" / ("ffmpeg.exe" if os.name == "nt" else "ffmpeg"),
        project_root / "src-tauri" / "bin" / ("ffmpeg.exe" if os.name == "nt" else "ffmpeg"),
    ]
    if getattr(sys, 'frozen', False):
        bin_dir = Path(sys.executable).parent
        candidates.extend([
            bin_dir / ("ffmpeg.exe" if os.name == "nt" else "ffmpeg"),
            bin_dir / "bin" / ("ffmpeg.exe" if os.name == "nt" else "ffmpeg"),
            bin_dir.parent / ("ffmpeg.exe" if os.name == "nt" else "ffmpeg"),
            bin_dir.parent / "Resources" / "bin" / "ffmpeg",
        ])
    else:
        candidates.append(
            project_root / "node_modules" / "ffmpeg-static" / ("ffmpeg.exe" if os.name == "nt" else "ffmpeg")
        )
    for c in candidates:
        if c.exists():
            return str(c)
    return None


# Ensure ffmpeg folder is prepended to system PATH
_ffmpeg_exec = get_ffmpeg_path()
if _ffmpeg_exec:
    _ffmpeg_dir = os.path.dirname(_ffmpeg_exec)
    if _ffmpeg_dir not in os.environ.get("PATH", ""):
        os.environ["PATH"] = _ffmpeg_dir + os.pathsep + os.environ.get("PATH", "")


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

    "best" (and any unknown label) means H.264 up to 1080p. YouTube also serves
    AV1/VP9 up to 4K inside mp4, which decodes several times slower on a small
    CPU and is not needed for 1080x1920 clips. 1440p and 2160p stay available
    when asked for by name.

    Every alternative is looser than the one before it and the list ends in
    plain 'best', so a source without H.264, without m4a audio, or with nothing
    at or below the cap still downloads.
    """
    caps = {"2160p": 2160, "1440p": 1440, "1080p": 1080, "720p": 720, "480p": 480}
    h = caps.get(quality) or 1080
    alternatives = []
    if h <= 1080:
        alternatives += [
            f"bestvideo[vcodec^=avc1][height<={h}]+bestaudio[ext=m4a]",
            f"bestvideo[vcodec^=avc1][height<={h}]+bestaudio",
        ]
    alternatives += [
        f"bestvideo[height<={h}][ext=mp4]+bestaudio[ext=m4a]",
        f"bestvideo[height<={h}]+bestaudio",
        f"best[height<={h}][ext=mp4]",
        f"best[height<={h}]",
        "bestvideo+bestaudio",
        "best",
    ]
    return "/".join(alternatives)


# Each entry is tried once, in this order. None leaves the choice to yt-dlp,
# which tracks the clients YouTube currently serves. The others are the
# fallback from the SP0 spec (4.6), for when that selection is refused.
PLAYER_CLIENT_ORDER = (None, "web_embedded", "android_vr")

# yt-dlp drops these clients when the cookie file holds a login, which would
# leave the attempt with no client at all. They run without the cookies.
_CLIENTS_WITHOUT_COOKIE_SUPPORT = {"android_vr"}

# Failures caused by the video, the internet address or the disk. They are the
# same for every player client.
_SAME_FOR_EVERY_CLIENT = {"VIDEO_UNAVAILABLE", "YT_RATE_LIMITED", "DISK_FULL"}

# Lets yt-dlp fetch its challenge solver script (EJS) from the yt-dlp/ejs
# GitHub releases and check it against the hash it ships. Only used when the
# yt-dlp-ejs package is absent, and a plain "pip install yt-dlp" leaves it out.
_EJS_REMOTE_COMPONENTS = ("ejs:github",)


def ytdlp_attempt_options(base: dict, client: str | None, cookiefile: str | None, deno_path: str | None) -> dict:
    """yt-dlp options for one attempt: ``base`` plus player client, cookies and Deno.

    Pure, so every combination is testable without network or files.
    """
    opts = dict(base)
    if client:
        opts['extractor_args'] = {'youtube': {'player_client': [client]}}
    if cookiefile and client not in _CLIENTS_WITHOUT_COOKIE_SUPPORT:
        opts['cookiefile'] = cookiefile
    # Without Deno neither option is set: yt-dlp then looks for a runtime on
    # its own and otherwise keeps to the clients that need none.
    if deno_path:
        opts['js_runtimes'] = {'deno': {'path': deno_path}}
        opts['remote_components'] = list(_EJS_REMOTE_COMPONENTS)
    return opts


def another_client_may_help(code: str, sent_cookies: bool) -> bool:
    """Whether a failed attempt is worth following with the next player client."""
    if code in _SAME_FOR_EVERY_CLIENT:
        return False
    if code == "YT_SIGNIN_REQUIRED":
        # Without cookies another client is the only thing left to try. With
        # cookies YouTube has turned down the account itself: yt-dlp's default
        # selection for a login already includes web_embedded, android_vr
        # cannot carry cookies, and every repeat puts the account at risk.
        return not sent_cookies
    return True


def _deno_path() -> str | None:
    """Where Deno is installed according to the preflight check, or None."""
    try:
        from backend import preflight
        return preflight._deno_path()
    except Exception as e:
        # A download without Deno beats no download at all.
        log_error("video_utils.deno_path", e)
        return None


def _run_ytdlp(base_opts: dict, cookiefile: str | None, run: callable, is_cancelled: callable = None):
    """Call ``run(ydl)`` under each player client in turn and return the first result.

    When every attempt fails, raises the AppError of the first failure with a
    known code, so "sign in required" is not hidden by a vaguer error from a
    fallback client. With no known code it is the last failure.
    """
    deno_path = _deno_path()
    failure = None
    for client in PLAYER_CLIENT_ORDER:
        opts = ytdlp_attempt_options(base_opts, client, cookiefile, deno_path)
        try:
            # yt-dlp snapshots sys.stdout/stderr at construction and writes to
            # them directly for some messages (e.g. deprecation notices),
            # bypassing the logger. On a broken Windows child-process stream
            # that flush raises OSError [Errno 22], so both streams go to an
            # in-memory sink for the whole call.
            sink = io.StringIO()
            with contextlib.redirect_stdout(sink), contextlib.redirect_stderr(sink):
                with yt_dlp.YoutubeDL(opts) as ydl:
                    return run(ydl)
        except DownloadCancelledError:
            raise
        except Exception as e:
            if is_cancelled and is_cancelled():
                raise DownloadCancelledError("Download cancelled by user")
            log_error(f"video_utils.ytdlp[{client or 'default'}]", e)
            error = classify_download_error(e)
            if failure is None or failure.code == "UNKNOWN":
                failure = error
            if not another_client_may_help(error.code, 'cookiefile' in opts):
                break
    raise failure


def probe_formats(url: str) -> list:
    """Available video heights for a URL, descending & unique, via yt-dlp."""
    with ytdlp_cookiefile() as cookiefile:
        return _probe_formats(url, cookiefile)


def _probe_formats(url: str, cookiefile: str | None) -> list:
    base_ydl_opts = {
        'quiet': True, 'no_warnings': True, 'skip_download': True,
        'logger': _SilentLogger(),
    }
    info = _run_ytdlp(base_ydl_opts, cookiefile, lambda ydl: ydl.extract_info(url, download=False))

    formats = (info or {}).get("formats", []) if isinstance(info, dict) else []
    heights = {f.get("height") for f in formats if isinstance(f, dict) and f.get("height")}
    return sorted(heights, reverse=True)


def download_percent(d) -> float:
    """How far one yt-dlp progress update is, in percent, or None when yt-dlp does not know the size."""
    if not isinstance(d, dict) or d.get("status") != "downloading":
        return None
    done = d.get("downloaded_bytes")
    total = d.get("total_bytes") or d.get("total_bytes_estimate")
    if not isinstance(done, (int, float)) or not isinstance(total, (int, float)) or total <= 0:
        return None
    return min(100.0, done * 100.0 / total)


def download_youtube_video(url: str, output_path: str, quality: str = "best", is_cancelled: callable = None) -> Path:
    with stage("download"), ytdlp_cookiefile() as cookiefile:
        return _download_youtube_video(url, output_path, quality, is_cancelled, cookiefile)


def _download_youtube_video(url: str, output_path: str, quality: str, is_cancelled: callable,
                            cookiefile: str | None = None) -> Path:
    base_ydl_opts = {
        'format': quality_to_format(quality),
        'outtmpl': output_path,
        'merge_output_format': 'mp4',
        'quiet': True,
        'no_warnings': True,
        'noprogress': True,
        'updatetime': False,
        'logger': _SilentLogger(),
    }
    ffmpeg_loc = get_ffmpeg_path()
    if ffmpeg_loc:
        base_ydl_opts['ffmpeg_location'] = ffmpeg_loc

    def hook(d):
        if is_cancelled and is_cancelled():
            raise DownloadCancelledError("Download cancelled by user")
        percent = download_percent(d)
        if percent is not None:
            report(percent=percent)  # live status only (spec 4.4), not timings

    base_ydl_opts['progress_hooks'] = [hook]

    _run_ytdlp(base_ydl_opts, cookiefile, lambda ydl: ydl.download([url]), is_cancelled)
    return Path(output_path)



def extract_audio(video_path: str, audio_path: str, register_proc: callable = None) -> str:
    """Extract a compact mono 16kHz audio track for speech-to-text.

    Whisper only accepts audio and caps uploads at 25MB, so sending the raw
    (often multi-GB) video fails on real long-form content. A mono 16kHz MP3
    stays tiny even for hour-long videos while keeping speech intelligible.
    """
    if os.path.exists(audio_path) and os.path.getsize(audio_path) > 0:
        return audio_path

    cmd = [
        "ffmpeg", "-y",
        "-i", video_path,
        "-vn",
        "-ac", "1",
        "-ar", "16000",
        "-b:a", "64k",
        audio_path,
    ]
    with stage("extract_audio"):
        proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        if register_proc:
            register_proc(proc)
        stdout, stderr = proc.communicate()
        if proc.returncode != 0:
            raise subprocess.CalledProcessError(proc.returncode, cmd, stdout, stderr)
    return audio_path

def get_video_duration(video_path: str) -> float:
    """Get video duration in seconds using ffmpeg (bundled), parsing stderr."""
    import re
    cmd = ["ffmpeg", "-i", video_path]
    try:
        res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, encoding="utf-8", errors="replace")
        match = re.search(r"Duration:\s*(\d{2}):(\d{2}):(\d{2}\.\d+)", res.stderr)
        if match:
            h, m, s = match.groups()
            return int(h) * 3600 + int(m) * 60 + float(s)
    except Exception as e:
        log_error("video_utils.get_video_duration", e)
    return 0.0
