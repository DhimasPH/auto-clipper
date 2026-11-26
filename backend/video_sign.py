"""Signed links for GET /video (SP1, spec 4.5, ADR-013).

The <video> player cannot send the Authorization header, so /video is not
behind the API token. Instead every link carries ``sig``:

    sig = HMAC_SHA256(key, canonical path)   (hex, no expiry)

A link opens exactly one file, for as long as the key file exists. The key is
32 random bytes in the app data folder (``video_signing.key``; on Colab that
is the user's Google Drive, so links survive a new session), created once and
read from the file on every use: nothing is kept in memory, links stay valid
after a restart, and deleting the file cancels every old link. path_guard
refuses the key file to every endpoint.

Links are added to clip data when it is read (``with_video_urls``), never
stored in history.db.
"""
import hashlib
import hmac
import os
import secrets
import threading
from typing import Optional
from urllib.parse import urlencode

from backend import drive_mount
from backend.logger import get_app_data_dir, log_error
from backend.path_guard import write_private_file

KEY_FILE_NAME = "video_signing.key"
KEY_BYTES = 32

_create_lock = threading.Lock()


def key_path() -> str:
    """Where the key lives. While the Colab library is on an unmounted Drive it stays on this machine (E.16)."""
    folder = drive_mount.local_dir() if drive_mount.library_unavailable() else get_app_data_dir()
    return os.path.join(folder, KEY_FILE_NAME)


def _read_key(path: str) -> Optional[bytes]:
    try:
        with open(path, "rb") as f:
            data = f.read()
    except FileNotFoundError:
        return None
    if len(data) != KEY_BYTES:
        log_error("video_sign.load_key", f"{KEY_FILE_NAME} has {len(data)} bytes instead of {KEY_BYTES}; making a new key", exc_info=False)
        return None
    return data


def _write_key(path: str, key: bytes) -> None:
    write_private_file(path, key)


def load_key() -> bytes:
    """The signing key, created on first use."""
    path = key_path()
    key = _read_key(path)
    if key is not None:
        return key
    with _create_lock:
        key = _read_key(path)
        if key is None:
            key = secrets.token_bytes(KEY_BYTES)
            _write_key(path, key)
        return key


def canonical_path(path: str) -> str:
    """One spelling per file: absolute, symlinks and ``..`` resolved, case folded where the OS ignores case."""
    return os.path.normcase(os.path.realpath(os.path.abspath(path)))


def sign(path: str, key: Optional[bytes] = None) -> str:
    if key is None:
        key = load_key()
    return hmac.new(key, canonical_path(path).encode("utf-8"), hashlib.sha256).hexdigest()


def verify(path: str, sig: Optional[str]) -> bool:
    """True when ``sig`` was made for this file with the current key. Never raises."""
    if not path or not sig or not sig.isascii():
        return False
    try:
        expected = sign(path)
    except Exception as e:  # unreadable key or path: refuse
        log_error("video_sign.verify", e)
        return False
    return hmac.compare_digest(expected, sig.strip().lower())


def signed_url(path: str, key: Optional[bytes] = None) -> str:
    """The relative link the frontend puts after the backend address."""
    return "/video?" + urlencode({"path": path, "sig": sign(path, key=key)})


def with_video_urls(clips, key: Optional[bytes] = None):
    """Copies of ``clips`` with a signed ``video_url`` on every clip that has a path.

    The input is not changed, so the running job and history.db never hold a
    link. A clip that cannot be signed is returned without a link; the
    frontend then asks POST /video-url for one.
    """
    if not isinstance(clips, list):
        return clips
    key_loaded = key is not None
    result = []
    for clip in clips:
        if isinstance(clip, dict) and isinstance(clip.get("path"), str) and clip["path"]:
            clip = dict(clip)
            if not key_loaded:
                key_loaded = True
                try:
                    key = load_key()
                except Exception as e:
                    log_error("video_sign.with_video_urls", e)
            if key is not None:
                try:
                    clip["video_url"] = signed_url(clip["path"], key=key)
                except Exception as e:
                    log_error("video_sign.with_video_urls", e)
        result.append(clip)
    return result
