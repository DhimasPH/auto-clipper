# YouTube OAuth2 Authentication for Colab (yt-dlp)

## 1. Context & Motivation
YouTube increasingly blocks direct downloads from datacenter IPs (like Google Colab) to prevent bots. The current workaround (`cookies.txt` or browser cookies) is unreliable in headless environments and requires tedious manual steps for the user. `yt-dlp` provides an OAuth2 authentication mechanism (`--username oauth2`) that generates a device login code. Once authenticated, the session acts like a legitimate YouTube TV client, bypassing most bot protection and age restrictions.

## 2. Architecture & Components

### A. Persistent Cache & OAuth Setup (Conditional for Colab)
- **Target File**: `backend/video_utils.py`
- **Changes**: Modify `download_youtube_video` to set yt-dlp options, **ONLY IF `AUTO_CLIPPER_CLOUD_MODE` is true**:
  - `username`: `"oauth2"`
  - `password`: `""`
  - `cachedir`: A helper function `_get_ytdlp_cache_dir()` that defaults to `/content/drive/MyDrive/AutoClipper_Data/yt-dlp-cache` in Colab, or OS default temp dir as fallback.
  - `extractor_args`: `youtube:player_client=tv,web` (Adds extra resistance against bot detection).
- **Rationale**: If the Colab runtime disconnects, the OAuth token must persist so the user does not have to re-authenticate every time they start a new session. We must use `AUTO_CLIPPER_CLOUD_MODE` to avoid breaking the Tauri Desktop app, which uses `cookiesfrombrowser` perfectly fine.

### B. OAuth Prompt Interceptor (Safe Handshake)
- **Target File**: `backend/video_utils.py` (specifically `_SilentLogger`)
- **Changes**:
  - `yt-dlp` logs the device code instruction (e.g., "To give yt-dlp access to your account, go to https://www.google.com/device and enter code ABCD-EFGH") via its logger (`info` or `warning`).
  - We will modify `_SilentLogger.warning` or `_SilentLogger.info` to detect this specific regex or substring.
  - When detected, we will surface this message prominently via `log_error`. 
  - **CRITICAL**: We will only `print()` to stdout if `AUTO_CLIPPER_CLOUD_MODE` is true. Printing to stdout in Desktop mode will break the Tauri sidecar handshake.
- **Rationale**: The user must be informed that the download process is paused and requires them to open a link on their smartphone/PC to enter the code. Without this interceptor, the Web UI will appear to hang indefinitely.

## 3. Data Flow

1. User submits a YouTube URL via Web UI.
2. Backend (`download_youtube_video`) checks for `AUTO_CLIPPER_CLOUD_MODE`. If true, initializes `yt-dlp` with OAuth options and Google Drive cache dir. If false, falls back to regular cookie browser logic.
3. `yt-dlp` checks the cache.
   - **Scenario A (Cached & Valid)**: Download proceeds normally.
   - **Scenario B (No Cache or Invalid)**: `yt-dlp` emits the device code instruction.
4. `_SilentLogger` intercepts the device code string, logs it to `backend_error.log`, and prints to stdout *only* in Cloud Mode.
5. The Colab user sees the code, opens `google.com/device`, and inputs it.
6. `yt-dlp` resumes the download automatically.

## 4. Error Handling & Edge Cases
- **Desktop Invariant**: The changes strictly guard OAuth2 and `print()` behind `AUTO_CLIPPER_CLOUD_MODE` to prevent breaking the Desktop Tauri version.
- **Cache Persistence**: The Google Drive cache path ensures the token isn't lost on Colab restart.
- **yt-dlp Updates**: OAuth2 reliability depends on yt-dlp being up to date. Users must ensure `pip install -U yt-dlp` is run in the Colab notebook.

## 5. Scope Check
This design is highly scoped to modifying `video_utils.py` and specifically the yt-dlp downloader configuration and logger, with strict guardrails to protect the desktop build.
