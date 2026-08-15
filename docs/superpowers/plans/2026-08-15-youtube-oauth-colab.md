# YouTube OAuth2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modify `yt-dlp` configuration to use OAuth2 and intercept the device login prompt to bypass YouTube bot protections in Colab, while strictly guarding against breaking the Desktop Tauri version.

**Architecture:** We will update `download_youtube_video` in `backend/video_utils.py` to use `--username oauth2` conditionally based on `AUTO_CLIPPER_CLOUD_MODE`. We will also modify `_SilentLogger` to intercept the device login URL/code, ensuring stdout printing only happens in cloud mode.

**Tech Stack:** Python, yt-dlp

---

### Task 1: Intercept OAuth Device Login Prompt in Logger (Safe Handshake)

**Files:**
- Modify: `backend/video_utils.py:44-65`

- [ ] **Step 1: Write minimal implementation**

Update `_SilentLogger` to intercept the OAuth prompt in `info` and `warning` methods, passing it to `log_error`. Only print to stdout if `AUTO_CLIPPER_CLOUD_MODE` is set to avoid breaking Tauri handshake on Desktop.

```python
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
        if "https://www.google.com/device" in msg:
            log_error(Exception(msg), context="OAuth Required (Colab/Headless)")
            if os.environ.get("AUTO_CLIPPER_CLOUD_MODE"):
                print(f"\n[ACTION REQUIRED] {msg}\n")

    def warning(self, msg):
        if "https://www.google.com/device" in msg:
            log_error(Exception(msg), context="OAuth Required (Colab/Headless)")
            if os.environ.get("AUTO_CLIPPER_CLOUD_MODE"):
                print(f"\n[ACTION REQUIRED] {msg}\n")

    def error(self, msg):
        pass
```

- [ ] **Step 2: Commit (if auto_commit enabled)**

Check `.agent/config.yml` for `auto_commit` setting.

If `auto_commit: true` (default when absent):
```bash
git add backend/video_utils.py
git commit -m "feat: intercept yt-dlp oauth prompt in silent logger safely"
```

If `auto_commit: false`: skip commit and staging. Print: "Skipping commit (auto_commit: false)."

---

### Task 2: Configure yt-dlp with OAuth2 (Cloud Mode Only)

**Files:**
- Modify: `backend/video_utils.py:115-128` (and add helper above it)

- [ ] **Step 1: Write minimal implementation**

Add `_get_ytdlp_cache_dir` helper and update `base_ydl_opts` in `download_youtube_video` to conditionally include OAuth options.

```python
import tempfile

def _get_ytdlp_cache_dir() -> str:
    if os.environ.get("AUTO_CLIPPER_CLOUD_MODE"):
        gdrive_cache = Path("/content/drive/MyDrive/AutoClipper_Data/yt-dlp-cache")
        if gdrive_cache.parent.exists():
            gdrive_cache.mkdir(parents=True, exist_ok=True)
            return str(gdrive_cache.absolute())
    return str(Path(tempfile.gettempdir()) / "auto-clipper" / "yt-dlp-cache")

def download_youtube_video(url: str, output_path: str, quality: str = "best", is_cancelled: callable = None) -> Path:
    format_str = quality_to_format(quality)

    base_ydl_opts = {
        'format': format_str,
        'outtmpl': output_path,
        'merge_output_format': 'mp4',
        'quiet': True,
        'no_warnings': True,
        'noprogress': True,
        'updatetime': False,
        'logger': _SilentLogger(),
    }
    
    if os.environ.get("AUTO_CLIPPER_CLOUD_MODE"):
        base_ydl_opts['username'] = 'oauth2'
        base_ydl_opts['password'] = ''
        base_ydl_opts['cachedir'] = _get_ytdlp_cache_dir()
        base_ydl_opts['extractor_args'] = {'youtube': ['player_client=tv,web']}
```

- [ ] **Step 2: Commit (if auto_commit enabled)**

Check `.agent/config.yml` for `auto_commit` setting.

If `auto_commit: true` (default when absent):
```bash
git add backend/video_utils.py
git commit -m "feat: enable oauth2 and gdrive cache strictly for cloud mode"
```

If `auto_commit: false`: skip commit and staging. Print: "Skipping commit (auto_commit: false)."
