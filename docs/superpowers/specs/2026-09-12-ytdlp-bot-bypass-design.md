# yt-dlp Bot Bypass Design (Client Rotation)

## Context
YouTube has recently increased bot detection stringency. The backend `yt-dlp` configuration currently relies on looping through different local browser installations to extract cookies via `--cookies-from-browser` (e.g., Chrome, Edge). This approach:
1. Frequently fails on Windows due to SQLite database locking (WinError 32) when the browser is actively in use.
2. Completely fails on cloud environments (e.g., Google Colab) where no browser or cookie database exists.
3. Often gets blocked anyway if the cookie signature doesn't match the bot's extractor client.

## Objective
Implement a fully automated, background solution to bypass YouTube's 403 Bot Detection without requiring any user interaction or local browser dependencies.

## Architecture & Implementation

**Component:** `backend/video_utils.py`

### 1. Remove Browser Cookies Loop
The array `browsers_to_try = ['chrome', 'edge', 'firefox', 'brave', 'opera', 'vivaldi', None]` and all related `cookiesfrombrowser` injection logic will be completely removed. This eliminates file-lock crashes and reduces unnecessary latency.

### 2. Client Spoofing Rotation
We will replace the browser loop with a `clients_to_try` loop that rotates the `extractor_args` for the `youtube` plugin. When one client is blocked by YouTube (triggering a download exception), the system catches the error and retries with the next client in the list.

The proposed rotation order is:
1. `ios` (High success rate currently)
2. `tv` (API generally has relaxed bot detection)
3. `web_creator` (YouTube Studio client)
4. `android` (Fallback, current default)

**Implementation Detail:**
For each client string, the `extractor_args` will be updated dynamically:
```python
ydl_opts['extractor_args'] = {'youtube': [f'player_client={client}', 'player_skip=web']}
```

### 3. Broad Application
This rotation logic will be abstracted or replicated across the primary `yt-dlp` interaction points in `video_utils.py`:
- `download_youtube_video()` (Main video downloader)
- `probe_formats()` (Available resolution fetcher)

## Trade-offs & Limitations
- **Cat and Mouse:** YouTube frequently patches client-based bypasses. The order of clients might need to be updated in the future if all fallback clients get blocked simultaneously. 
- **No Private Videos:** Since cookies are no longer extracted from the browser, the user cannot download private or members-only videos using this implementation (which wasn't robustly supported anyway due to cloud constraints).
