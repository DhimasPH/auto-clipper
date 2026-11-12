"""One user-supplied cookies.txt, used by yt-dlp to get past YouTube's sign-in check.

The file is kept in the local app data directory. Its content goes to yt-dlp
and nowhere else: cookie values are never logged, never put in an error and
never returned by ``get_status``.
"""
import contextlib
import io
import os
import re
import tempfile
import threading
import time
import warnings
from dataclasses import dataclass, field
from datetime import datetime, timezone

from backend.errors import AppError
from backend.logger import get_app_data_dir, log_error

# The error text for COOKIES_TOO_LARGE names this limit.
MAX_COOKIES_BYTES = 1024 * 1024

_HEADER = "# Netscape HTTP Cookie File\n"
_HTTPONLY_PREFIX = "#HttpOnly_"
_DOMAIN = re.compile(r"\.?[A-Za-z0-9_-]+(\.[A-Za-z0-9_-]+)*")
_EXPIRES = re.compile(r"([0-9]+(\.[0-9]+)?)?")
_FLAGS = ("TRUE", "FALSE")
# What yt-dlp itself checks to decide that YouTube cookies belong to a logged-in account.
_LOGIN_MARKER = "LOGIN_INFO"
_LOGIN_IDS = {"SAPISID", "__Secure-1PAPISID", "__Secure-3PAPISID"}

_lock = threading.RLock()


def get_cookies_path() -> str:
    return os.path.join(get_app_data_dir(), "cookies", "cookies.txt")


def _copy_dir() -> str:
    # Working copies stay off the app data directory: on Colab that directory
    # is Google Drive, where a deleted file lingers in the trash.
    return os.path.join(tempfile.gettempdir(), "auto-clipper-cookies")


@dataclass
class _Parsed:
    lines: list = field(default_factory=list)    # cookie lines of every site, ready for yt-dlp
    youtube: list = field(default_factory=list)  # (name, expiry) per youtube.com cookie, expiry 0 = session
    unreadable: int = 0                          # lines that are neither a cookie nor a comment


def _is_youtube(domain: str) -> bool:
    host = domain.lstrip(".").lower()
    return host == "youtube.com" or host.endswith(".youtube.com")


def _parse(text: str) -> _Parsed:
    parsed = _Parsed()
    for raw in text.split("\n"):
        line = raw.rstrip("\r")
        http_only = line.startswith(_HTTPONLY_PREFIX)
        if http_only:
            line = line[len(_HTTPONLY_PREFIX):]
        if not line.strip() or line.lstrip().startswith(("#", "$")):
            continue
        fields = line.split("\t")
        if len(fields) != 7:
            parsed.unreadable += 1
            continue
        domain, subdomains, path, secure, expires, name, value = fields
        if not (_DOMAIN.fullmatch(domain) and subdomains.upper() in _FLAGS and secure.upper() in _FLAGS
                and _EXPIRES.fullmatch(expires)):
            parsed.unreadable += 1
            continue
        # yt-dlp refuses the whole file when this flag contradicts the leading dot.
        subdomains = "TRUE" if domain.startswith(".") else "FALSE"
        parsed.lines.append(
            (_HTTPONLY_PREFIX if http_only else "")
            + "\t".join((domain, subdomains, path, secure.upper(), expires, name, value))
        )
        if _is_youtube(domain):
            parsed.youtube.append((name, float(expires or 0)))
    return parsed


def _problem(parsed: _Parsed, now: float):
    """The AppError that makes these cookies unusable, or None."""
    technical = (
        f"cookies.txt: {len(parsed.lines)} cookies, {len(parsed.youtube)} for youtube.com, "
        f"{parsed.unreadable} unreadable lines"
    )
    if not parsed.lines:
        return AppError("COOKIES_INVALID_FORMAT" if parsed.unreadable else "COOKIES_EMPTY", technical=technical)
    if not parsed.youtube:
        return AppError("COOKIES_NO_YOUTUBE", technical=technical)
    # Session cookies carry no date, and every export has some, so they say
    # nothing about how old the file is.
    dated = [expiry for _, expiry in parsed.youtube if expiry]
    if dated and max(dated) <= now:
        return AppError("COOKIES_EXPIRED", technical=technical)
    return None


def _loads_in_yt_dlp(text: str) -> bool:
    """Whether the installed yt-dlp accepts the file, so a download never fails on loading it."""
    from yt_dlp.cookies import YoutubeDLCookieJar
    sink = io.StringIO()  # the loader prints the lines it rejects
    try:
        with contextlib.redirect_stdout(sink), contextlib.redirect_stderr(sink), warnings.catch_warnings():
            warnings.simplefilter("ignore")
            YoutubeDLCookieJar(io.StringIO(text)).load()
        return True
    except Exception:
        return False


def validate_cookies(data: bytes, now: float = None) -> str:
    """Check an uploaded cookies.txt and return the text to store.

    Raises AppError (COOKIES_*) when the file cannot be used. The returned text
    holds the same cookies, cleaned up so yt-dlp loads it: a header line is
    added and lines that are not cookies are dropped.
    """
    now = time.time() if now is None else now
    if len(data) > MAX_COOKIES_BYTES:
        raise AppError("COOKIES_TOO_LARGE", technical=f"cookies.txt: more than {MAX_COOKIES_BYTES} bytes")
    try:
        text = data.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise AppError("COOKIES_INVALID_FORMAT", technical="cookies.txt: not UTF-8 text") from None
    parsed = _parse(text)
    problem = _problem(parsed, now)
    if problem:
        raise problem
    stored = _HEADER + "\n".join(parsed.lines) + "\n"
    if not _loads_in_yt_dlp(stored):
        raise AppError("COOKIES_INVALID_FORMAT", technical="cookies.txt: the downloader could not load the file")
    return stored


def _iso(timestamp: float):
    try:
        return datetime.fromtimestamp(timestamp, timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    except (ValueError, OverflowError, OSError):
        return None


def _read_stored():
    """(text, upload time) of the stored file, or (None, None)."""
    path = get_cookies_path()
    with _lock:
        try:
            with open(path, "rb") as f:
                data = f.read()
            return data.decode("utf-8", errors="replace"), os.path.getmtime(path)
        except FileNotFoundError:
            return None, None


def get_status(now: float = None) -> dict:
    """What the UI may know about the stored cookies. Never includes a cookie value.

    ``earliest_expiry`` is the next date a YouTube cookie runs out,
    ``latest_expiry`` the date the last one does; after that the file counts as
    expired. Times are ISO 8601 in UTC.
    """
    now = time.time() if now is None else now
    status = {
        "present": False, "valid": False, "logged_in": False, "cookie_count": 0, "youtube_cookie_count": 0,
        "earliest_expiry": None, "latest_expiry": None, "uploaded_at": None, "error_info": None,
    }
    text, uploaded_at = _read_stored()
    if text is None:
        return status

    parsed = _parse(text)
    problem = _problem(parsed, now)
    live_names = {name for name, expiry in parsed.youtube if not expiry or expiry > now}
    dated = [expiry for _, expiry in parsed.youtube if expiry]
    upcoming = [expiry for expiry in dated if expiry > now]
    status.update({
        "present": True,
        "valid": problem is None,
        "logged_in": problem is None and _LOGIN_MARKER in live_names and bool(live_names & _LOGIN_IDS),
        "cookie_count": len(parsed.lines),
        "youtube_cookie_count": len(parsed.youtube),
        "earliest_expiry": _iso(min(upcoming)) if upcoming else None,
        "latest_expiry": _iso(max(dated)) if dated else None,
        "uploaded_at": _iso(uploaded_at),
        "error_info": problem.to_dict() if problem else None,
    })
    return status


def save_cookies(data: bytes, now: float = None) -> dict:
    """Validate and store an uploaded cookies.txt, replacing any earlier one. Returns its status."""
    text = validate_cookies(data, now)
    path = get_cookies_path()
    with _lock:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        # mkstemp makes the file readable by this user only; the rename keeps
        # a half-written file from ever being the stored one.
        fd, tmp = tempfile.mkstemp(prefix=".upload-", suffix=".tmp", dir=os.path.dirname(path))
        try:
            with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as f:
                f.write(text)
            os.replace(tmp, path)
        except BaseException:
            _erase(tmp)
            raise
    return get_status(now)


def _erase(path: str) -> None:
    try:
        # Empty it first, so a copy kept by a trash folder or a sync service holds nothing.
        with open(path, "r+b") as f:
            f.truncate(0)
        os.remove(path)
    except FileNotFoundError:
        pass


def delete_cookies() -> None:
    """Remove the stored cookies and any working copy a crashed download left behind."""
    with _lock:
        _erase(get_cookies_path())
        try:
            leftovers = [os.path.join(_copy_dir(), name) for name in os.listdir(_copy_dir())]
        except OSError:
            leftovers = []
        for leftover in leftovers:
            try:
                _erase(leftover)
            except OSError as e:
                log_error("cookies.delete_cookies", e)


def _make_working_copy():
    """Path of a private copy of the stored cookies, or None when there is nothing usable."""
    text, _ = _read_stored()
    if text is None or _problem(_parse(text), time.time()):
        return None
    path = None
    try:
        os.makedirs(_copy_dir(), exist_ok=True)
        fd, path = tempfile.mkstemp(prefix="run-", suffix=".txt", dir=_copy_dir())
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as f:
            f.write(text)
        return path
    except OSError as e:
        # A download without cookies beats no download at all.
        log_error("cookies.ytdlp_cookiefile", e)
        if path:
            with contextlib.suppress(OSError):
                _erase(path)
        return None


@contextlib.contextmanager
def ytdlp_cookiefile():
    """Yield a cookie file path for yt-dlp's ``cookiefile`` option, or None.

    yt-dlp rewrites the cookie file it is given every time a YoutubeDL object
    closes. It therefore gets a throwaway copy, which may be shared by all
    attempts of one download, and the stored file stays exactly as validated.
    """
    path = _make_working_copy()
    try:
        yield path
    finally:
        if path:
            try:
                _erase(path)
            except OSError as e:
                log_error("cookies.ytdlp_cookiefile", e)
