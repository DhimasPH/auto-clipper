import errno
import json
import re

import pytest

from backend.errors import (
    AppError,
    ERROR_CODES,
    classify_download_error,
    to_app_error,
)

# Error texts as yt-dlp raises them (yt_dlp.utils.DownloadError: "ERROR: ...").
SIGNIN_BOT = (
    "ERROR: [youtube] dQw4w9WgXcQ: Sign in to confirm you’re not a bot. "
    "Use --cookies-from-browser or --cookies for the authentication. "
    "See  https://github.com/yt-dlp/yt-dlp/wiki/FAQ#how-do-i-pass-cookies-to-yt-dlp  "
    "for how to manually pass cookies."
)
SIGNIN_AGE = (
    "ERROR: [youtube] abc123XYZ_0: Sign in to confirm your age. "
    "This video may be inappropriate for some users. Use --cookies-from-browser or --cookies for the authentication."
)
HTTP_403 = "ERROR: unable to download video data: HTTP Error 403: Forbidden"
HTTP_429 = "ERROR: [youtube] dQw4w9WgXcQ: Unable to download webpage: HTTP Error 429: Too Many Requests (caused by <HTTPError 429: Too Many Requests>)"
RATE_LIMITED_SESSION = (
    "ERROR: [youtube] dQw4w9WgXcQ: Video unavailable. This content isn’t available, try again later. "
    "The current session has been rate-limited by YouTube for up to an hour."
)
PRIVATE = "ERROR: [youtube] dQw4w9WgXcQ: Private video. Sign in if you've been granted access to this video"
UNAVAILABLE = "ERROR: [youtube] dQw4w9WgXcQ: Video unavailable"
GEO_BLOCKED = (
    "ERROR: [youtube] dQw4w9WgXcQ: Video unavailable. The uploader has not made this video available in your country"
)
REMOVED = "ERROR: [youtube] dQw4w9WgXcQ: Video unavailable. This video has been removed by the uploader"
MEMBERS_ONLY = (
    "ERROR: [youtube] dQw4w9WgXcQ: Join this channel to get access to members-only content like this video, "
    "and other exclusive perks."
)
NOT_YET_LIVE = "ERROR: [youtube] dQw4w9WgXcQ: This live event will begin in 3 hours."
DISK_FULL = "ERROR: unable to write data: [Errno 28] No space left on device"
NETWORK = "ERROR: unable to download video data: <urlopen error [Errno -3] Temporary failure in name resolution>"


@pytest.mark.parametrize("message, code", [
    (SIGNIN_BOT, "YT_SIGNIN_REQUIRED"),
    (SIGNIN_AGE, "YT_SIGNIN_REQUIRED"),
    (HTTP_403, "YT_SIGNIN_REQUIRED"),
    (HTTP_429, "YT_RATE_LIMITED"),
    (RATE_LIMITED_SESSION, "YT_RATE_LIMITED"),
    (PRIVATE, "VIDEO_UNAVAILABLE"),
    (UNAVAILABLE, "VIDEO_UNAVAILABLE"),
    (GEO_BLOCKED, "VIDEO_UNAVAILABLE"),
    (REMOVED, "VIDEO_UNAVAILABLE"),
    (MEMBERS_ONLY, "VIDEO_UNAVAILABLE"),
    (NOT_YET_LIVE, "VIDEO_UNAVAILABLE"),
    (DISK_FULL, "DISK_FULL"),
    (NETWORK, "UNKNOWN"),
])
def test_download_errors_map_to_codes(message, code):
    assert classify_download_error(Exception(message)).code == code


def test_real_yt_dlp_exception_type_is_classified():
    from yt_dlp.utils import DownloadError
    assert classify_download_error(DownloadError(SIGNIN_BOT)).code == "YT_SIGNIN_REQUIRED"


def test_classified_error_keeps_the_raw_message_as_its_text():
    """Old frontends show str(error); that text must stay the original one."""
    err = classify_download_error(Exception(SIGNIN_BOT))
    assert str(err) == SIGNIN_BOT
    assert err.to_dict()["technical"] == SIGNIN_BOT


def test_classifying_an_app_error_returns_it_unchanged():
    original = AppError("DISK_FULL", technical="x")
    assert classify_download_error(original) is original
    assert to_app_error(original) is original


def test_error_info_shape():
    info = classify_download_error(Exception(SIGNIN_BOT)).to_dict()
    assert set(info) == {"code", "title", "message", "title_en", "message_en", "actions", "technical"}
    assert info["code"] == "YT_SIGNIN_REQUIRED"
    action_ids = [a["id"] for a in info["actions"]]
    assert action_ids == ["upload_cookies", "upload_video"]
    for action in info["actions"]:
        assert set(action) == {"id", "label", "label_en"}
    json.dumps(info)


EXPECTED_CODES = {
    "YT_SIGNIN_REQUIRED", "YT_RATE_LIMITED", "VIDEO_UNAVAILABLE", "VIDEO_TOO_LONG",
    "OUT_OF_MEMORY", "NO_GPU_SLOW", "DRIVE_NOT_MOUNTED", "DISK_FULL", "AI_KEY_INVALID",
    "FFMPEG_MISSING", "UNKNOWN",
}


def test_catalog_has_every_code_from_the_spec():
    assert EXPECTED_CODES <= set(ERROR_CODES)


# Terms a non-technical user should never have to read on the main screen.
JARGON = ["po token", "fuse", "oom", "nvenc", "ctranslate2", "cuda", "yt-dlp", "libx264", "traceback",
          "exception", "stderr", "http error", "errno"]


@pytest.mark.parametrize("code", sorted(EXPECTED_CODES))
def test_every_code_has_plain_text_in_both_languages(code):
    info = AppError(code).to_dict()
    for field in ("title", "message", "title_en", "message_en"):
        text = info[field]
        assert text and text.strip() == text
        lowered = text.lower()
        for term in JARGON:
            assert not re.search(rf"\b{re.escape(term)}\b", lowered), f"{code}.{field} contains jargon {term!r}"
        assert "—" not in text
    assert info["title"] != info["title_en"]
    assert info["message"] != info["message_en"]
    # what happened + why + what to do needs more than one sentence
    assert info["message"].count(".") >= 2
    assert info["message_en"].count(".") >= 2
    assert len(info["title"]) <= 60
    for action in info["actions"]:
        assert action["label"] and action["label_en"]


def test_unknown_code_falls_back_to_unknown_text():
    info = AppError("SOMETHING_NEW", technical="raw").to_dict()
    assert info["code"] == "SOMETHING_NEW"
    assert info["title"] == AppError("UNKNOWN").to_dict()["title"]


# --- generic job failures ---------------------------------------------------

@pytest.mark.parametrize("exc, code", [
    (MemoryError(), "OUT_OF_MEMORY"),
    (RuntimeError("CUDA out of memory. Tried to allocate 512.00 MiB"), "OUT_OF_MEMORY"),
    (RuntimeError("Unable to allocate 1.20 GiB for an array with shape (1, 2)"), "OUT_OF_MEMORY"),
    (OSError(errno.ENOSPC, "No space left on device"), "DISK_FULL"),
    (Exception("Error code: 401 - {'error': {'message': 'Incorrect API key provided: sk-abc. You can find your API key at https://platform.openai.com/account/api-keys.'}}"), "AI_KEY_INVALID"),
    (Exception("400 INVALID_ARGUMENT. {'error': {'code': 400, 'message': 'API key not valid. Please pass a valid API key.', 'status': 'INVALID_ARGUMENT'}}"), "AI_KEY_INVALID"),
    (ValueError("Semua klip gagal dirender."), "UNKNOWN"),
])
def test_job_failures_map_to_codes(exc, code):
    err = to_app_error(exc)
    assert err.code == code
    assert err.to_dict()["technical"]


def test_to_app_error_recognises_download_errors_too():
    assert to_app_error(Exception(SIGNIN_BOT)).code == "YT_SIGNIN_REQUIRED"


def test_app_error_is_an_exception_that_chains_the_cause():
    cause = RuntimeError("boom")
    err = to_app_error(cause)
    assert isinstance(err, Exception)
    assert err.__cause__ is cause
