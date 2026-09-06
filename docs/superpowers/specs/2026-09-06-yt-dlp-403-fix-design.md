# yt-dlp 403 Forbidden Fix Design

## Goal
Resolve the recurring `HTTP Error 403: Forbidden` issue when `auto-clipper` attempts to download YouTube videos via `yt-dlp`. YouTube is increasingly blocking default clients and browser cookie extraction.

## Architecture & Changes

The fix relies on leveraging `yt-dlp`'s built-in client impersonation features rather than requiring user authentication (OAuth2) or manual cookie file management. 

### 1. Dependency Update
- **File**: `backend/requirements.txt`
- **Change**: Bump the minimum version of `yt-dlp` to ensure we have the most robust and up-to-date client impersonation features. We will set it to `yt-dlp>=2024.11.0` (or the latest stable).

### 2. Video Downloader Configuration
- **File**: `backend/video_utils.py`
- **Change**: Update the `base_ydl_opts` dictionary in both `download_youtube_video` and `probe_formats` functions.
- **Details**: We will pass `extractor_args` to instruct `yt-dlp` to impersonate an Android client and explicitly skip the `web` client, which is the primary target for YouTube's current blocking mechanism.

```python
'extractor_args': {
    'youtube': ['player_client=android', 'player_skip=web']
}
```

## Data Flow
No changes to the overall data flow. The download functions will just pass additional configuration to the `YoutubeDL` instance.

## Error Handling
The existing error handling mechanisms (retries across different browsers, exponential backoff) will remain intact. The client impersonation should significantly reduce the frequency of 403 errors triggering these fallback mechanisms.

## Testing
1. Attempt to download a YouTube video that previously resulted in a 403 error.
2. Verify that the video downloads successfully without triggering fallback browsers or failing.
3. Verify that format probing (`probe_formats`) still works correctly and returns the available resolutions.
