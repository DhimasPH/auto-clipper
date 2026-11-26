"""App files that no endpoint may read, copy or overwrite by a path from the request.

The stored cookies.txt (a YouTube login) and its working copies, the job
history database with its snapshot and SQLite side files, the backend logs and
the key that signs /video links (video_signing.key), the local web token (web_instance.json) and the last local web port (web_port.json) sit next to the clips in
the app data folder, which on Colab is the user's Google Drive. Every endpoint that opens a request-provided path asks
``is_protected`` first and answers a protected path with ``denied``.

Paths are compared after ``os.path.realpath`` (symlinks, ``..``, Windows short
names and trailing dots resolved) and in lower case on every platform, because
Windows and the default macOS file system ignore case.
"""
import os
import re
import secrets

from fastapi.responses import JSONResponse

from backend.logger import log_error

# history.db, history.db-wal/-shm/-journal, .history.db.part, history.db.unreadable-<date>
_DB_PREFIX = "history.db"
# backend_error.log, backend_app.log, backend_ai.log and anything rotated from them
_LOG_PREFIXES = ("backend_error.log", "backend_app.log", "backend_ai.log")
# video_signing.key (signs /video links, backend.video_sign), web_instance.json (port and
# token of the local web server, backend.web_mode) and web_port.json (port of the last local web
# launch), with their temp copies while they are written
_PRIVATE_FILE_PREFIXES = ("video_signing.key", "web_instance.json", "web_port.json")

DENIED_MESSAGE = "Access denied"


# Win32 device and NT namespace prefixes (\\?\, \\.\, \??\), after "/" became "\".
_DEVICE_PREFIXES = ("\\\\?\\", "\\\\.\\", "\\??\\")
_DRIVE_ROOT = re.compile(r"[A-Za-z]:\\")


def _drop_device_prefix(path: str) -> str:
    """``\\\\?\\C:\\x`` and ``\\\\.\\C:\\x`` name the same file as ``C:\\x`` (and ``\\\\?\\UNC\\s\\x`` as ``\\\\s\\x``).

    Any other device form (``\\\\?\\GLOBALROOT\\??\\C:\\x``, ``\\??\\C:\\x``,
    ``\\\\?\\Volume{...}\\x``, a named NTFS stream such as
    ``folder::$INDEX_ALLOCATION``) can reach a file under another spelling,
    so it raises ValueError: the callers then fail closed.
    """
    if os.name != "nt":
        return path
    path = path.replace("/", "\\")
    for prefix in ("\\\\?\\UNC\\", "\\\\.\\UNC\\"):
        if path[:len(prefix)].upper() == prefix:
            path = "\\\\" + path[len(prefix):]
            break
    else:
        if path[:4] in ("\\\\?\\", "\\\\.\\") and _DRIVE_ROOT.match(path, 4):
            path = path[4:]
    if path.startswith(_DEVICE_PREFIXES):
        raise ValueError("unsupported device path")
    # A colon only belongs in the drive letter; anything after it names an NTFS stream.
    if ":" in (path[2:] if path[1:2] == ":" else path):
        raise ValueError("unsupported path with a stream name")
    return path


def _canonical(path: str) -> str:
    resolved = os.path.realpath(os.path.abspath(_drop_device_prefix(path)))
    return os.path.normcase(_drop_device_prefix(resolved)).lower()


def is_network_or_device_path(path: str) -> bool:
    """True for a UNC path (``\\\\host\\share``, ``//host/share``) or a device path (``\\\\?\\``, ``\\\\.\\``, ``\\??\\``), by its text alone.

    /video and /save_file refuse these before any file system call: resolving
    a UNC path opens an SMB connection to that host (and on Windows sends the
    user's login hash), before any signature or folder check could refuse it.
    The app never writes clips to such a path (``main._resolve_safe_output_dir``).
    """
    if not isinstance(path, str):
        return True
    text = path.strip().replace("/", "\\")
    return text.startswith("\\\\") or text.startswith("\\??\\")


def _within(path: str, root: str) -> bool:
    try:
        return os.path.commonpath([path, root]) == root
    except ValueError:  # different drives on Windows
        return False


def is_within(path: str, root: str) -> bool:
    """True when ``path`` resolves to ``root`` or to something inside it."""
    try:
        return _within(_canonical(path), _canonical(root))
    except (OSError, ValueError, TypeError):
        return False


def _protected_name(name: str) -> bool:
    name = name.lower().lstrip(".")
    return name.startswith(_DB_PREFIX) or name.startswith(_LOG_PREFIXES) or name.startswith(_PRIVATE_FILE_PREFIXES)


def _protected_dirs() -> list:
    from backend import cookies
    return [os.path.dirname(cookies.get_cookies_path()), cookies._copy_dir()]


def private_folders() -> list:
    """The private folders (stored cookies, cookie working copies): nothing may be written into them or replace them."""
    return list(_protected_dirs())


def is_protected(path: str) -> bool:
    """True when ``path`` is, or resolves to, a private app file or something inside a private folder.

    The answer never depends on whether the file exists. A path that cannot be
    resolved counts as protected.
    """
    try:
        target = _canonical(path)
        if _protected_name(os.path.basename(os.path.abspath(path))) or _protected_name(os.path.basename(target)):
            return True
        return any(_within(target, _canonical(d)) for d in _protected_dirs())
    except (OSError, ValueError, TypeError):
        return True


def denied(endpoint: str, path: str) -> JSONResponse:
    """The 403 for a protected path. Logs the request, never the file."""
    log_error(f"path_guard.{endpoint}", f"Refused a protected app file: {path!r}", exc_info=False)
    return JSONResponse(status_code=403, content={"status": "error", "message": DENIED_MESSAGE})


def safe_upload_name(filename: str) -> str:
    """The last part of an uploaded file's name, so it can never climb out of the uploads folder."""
    name = (filename or "").replace("\\", "/").rsplit("/", 1)[-1].strip()
    return name if name.strip(".") else "video"


def write_private_file(path: str, data: bytes) -> None:
    """Atomically write ``data`` to ``path`` with mode 0600 (owner-only on POSIX)."""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    temp = f"{path}.{secrets.token_hex(4)}.part"
    fd = os.open(temp, os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_BINARY", 0), 0o600)
    with os.fdopen(fd, "wb") as f:
        f.write(data)
        f.flush()
        os.fsync(f.fileno())
    os.replace(temp, path)
