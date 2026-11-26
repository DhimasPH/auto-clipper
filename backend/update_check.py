"""Tells Auto Clipper Web that a newer version is out (SP4 spec 4.5, ADR-016). Stage 1: notice only.

Asks GitHub for the latest release at most once a day (cached in app data), with a generic
User-Agent and nothing about the user or this computer in the request. Only links inside this
repository's releases are passed on. Nothing is downloaded or installed here. Standard library
only, and imported only when the endpoint runs (E.21).
"""
import json
import os
import platform
import re
import sys
import time
import urllib.error
import urllib.request
from typing import Optional

from backend.logger import log_app, log_error

LATEST_RELEASE_API = "https://api.github.com/repos/DhimasPH/auto-clipper/releases/latest"
RELEASES_PREFIX = "https://github.com/DhimasPH/auto-clipper/releases/"
USER_AGENT = "AutoClipper-UpdateCheck"
CACHE_FILE_NAME = "update_check.json"
CACHE_SECONDS = 24 * 60 * 60
TIMEOUT_SECONDS = 5
MAX_ANSWER_BYTES = 1_000_000
# The zips .github/workflows/web-package.yml builds: Auto-Clipper-Web-<target>.zip
TARGETS = ("windows", "macos-arm64", "macos-x64", "linux")
TAG_PREFIX = "app-v"
_VERSION = re.compile(r"(\d{1,4})\.(\d{1,4})\.(\d{1,4})", re.ASCII)


def parse_version(text) -> Optional[tuple]:
    """(major, minor, patch) for "1.19.0"; None for anything else."""
    if not isinstance(text, str):
        return None
    match = _VERSION.fullmatch(text.strip())
    return tuple(int(part) for part in match.groups()) if match else None


def package_target(sys_platform: Optional[str] = None, machine: Optional[str] = None) -> Optional[str]:
    """The web package name for the system this backend runs on."""
    sys_platform = sys_platform or sys.platform
    machine = (machine or platform.machine() or "").lower()
    if sys_platform.startswith("win"):
        return "windows"
    if sys_platform == "darwin":
        return "macos-arm64" if machine in ("arm64", "aarch64") else "macos-x64"
    if sys_platform.startswith("linux"):
        return "linux"
    return None


def _trusted(url) -> Optional[str]:
    if not isinstance(url, str) or not url.startswith(RELEASES_PREFIX) or any(ch.isspace() for ch in url):
        return None
    if ".." in url[len(RELEASES_PREFIX):].split("/"):
        return None
    return url


def summarize(release: dict, target: Optional[str]) -> dict:
    """{latest, download_url, release_url} from a GitHub release answer. ValueError when it is not ours."""
    tag = release.get("tag_name") if isinstance(release, dict) else None
    latest = tag[len(TAG_PREFIX):] if isinstance(tag, str) and tag.startswith(TAG_PREFIX) else None
    if parse_version(latest) is None:
        raise ValueError(f"unexpected release tag {tag!r}")
    wanted = f"Auto-Clipper-Web-{target}.zip" if target else None
    download_url = None
    for asset in release.get("assets") or []:
        if wanted and isinstance(asset, dict) and asset.get("name") == wanted:
            download_url = _trusted(asset.get("browser_download_url"))
            break
    return {"latest": latest, "download_url": download_url, "release_url": _trusted(release.get("html_url"))}


def fetch_latest_release() -> dict:
    """One GET to GitHub: generic User-Agent, no query string, no user data."""
    request = urllib.request.Request(
        LATEST_RELEASE_API,
        headers={"User-Agent": USER_AGENT, "Accept": "application/vnd.github+json"},
    )
    with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as response:
        return json.loads(response.read(MAX_ANSWER_BYTES).decode("utf-8"))


def _read_cache(path: str) -> Optional[dict]:
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, dict) else None
    except (OSError, ValueError):
        return None


def _write_cache(path: str, data: dict) -> None:
    try:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        tmp = f"{path}.part"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(data, f)
        os.replace(tmp, path)
    except OSError as e:
        log_error("update_check.cache", e)


def _failure_kind(exc: BaseException) -> str:
    if isinstance(exc, urllib.error.HTTPError):
        return "rate_limited" if exc.code in (403, 429) else "bad_answer"
    if isinstance(exc, (urllib.error.URLError, OSError)):
        return "offline"
    return "bad_answer"


def check(current: str, *, force: bool = False, cache_path: str, now: Optional[float] = None,
          target: Optional[str] = None) -> dict:
    """Whether a version newer than ``current`` is out. Never raises: a failure is ``error``, not cached."""
    now = time.time() if now is None else now
    target = target or package_target()
    cached = None if force else _read_cache(cache_path)
    fresh = (
        cached is not None
        and cached.get("target") == target
        and isinstance(cached.get("checked_at"), (int, float))
        and 0 <= now - cached["checked_at"] < CACHE_SECONDS
        and parse_version(cached.get("latest")) is not None
    )
    if fresh:
        info = {key: cached.get(key) for key in ("latest", "download_url", "release_url")}
        checked_at = cached["checked_at"]
    else:
        try:
            info = summarize(fetch_latest_release(), target)
        except Exception as exc:
            kind = _failure_kind(exc)
            log_app(f"Pemeriksaan versi baru gagal ({kind}): {type(exc).__name__}")
            return {"current": current, "latest": None, "update_available": False, "download_url": None,
                    "release_url": None, "checked_at": now, "error": kind}
        checked_at = now
        _write_cache(cache_path, {**info, "target": target, "checked_at": now})
    latest = info.get("latest")
    newer = parse_version(latest) is not None and parse_version(latest) > parse_version(current)
    return {
        "current": current,
        "latest": latest,
        "update_available": newer,
        # Checked again: a cache file is only a file on disk.
        "download_url": _trusted(info.get("download_url")),
        "release_url": _trusted(info.get("release_url")),
        "checked_at": checked_at,
    }
