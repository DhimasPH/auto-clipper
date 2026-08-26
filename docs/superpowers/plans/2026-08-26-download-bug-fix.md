# Download Bug Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the web UI download bug by passing a download flag to the backend to force a native `attachment` response, without breaking the desktop app inline video player.

**Architecture:** We will add `dl` and `title` query parameters to the FastAPI `/video` endpoint. The frontend will build a download URL with these parameters and synchronously navigate to it using a hidden `<a>` tag, bypassing `fetch()` and Blob memory limits.

**Tech Stack:** Python (FastAPI), React (TypeScript)

---

### Task 1: Update Backend `/video` Endpoint

**Files:**
- Modify: `backend/main.py`

- [ ] **Step 1: Write minimal implementation**

Update the `get_video` function in `backend/main.py` (around line 837) to accept `dl: int = 0` and `title: str = None`.

```python
@app.get("/video")
def get_video(path: str, dl: int = 0, title: str = None):
    """Serve a generated clip so the frontend can preview it inline or download it."""
    from backend.logger import log_app
    import os
    import re
    
    abs_path = os.path.normpath(os.path.abspath(path))
    log_app(f"[video] Requested: {path} → Resolved: {abs_path} → Exists: {os.path.exists(abs_path)}")
    if not os.path.exists(abs_path) or not abs_path.lower().endswith(".mp4"):
        return JSONResponse(status_code=404, content={"status": "error", "message": f"File not found or invalid format: {abs_path}"})
    
    filename = os.path.basename(abs_path)
    if title:
        clean_title = re.sub(r'[^a-zA-Z0-9_-]', '_', title)
        filename = f"{clean_title}.mp4"
        
    disposition = "attachment" if dl == 1 else "inline"
    
    return FileResponse(
        abs_path,
        media_type="video/mp4",
        headers={
            "Content-Disposition": f'{disposition}; filename="{filename}"',
            "Accept-Ranges": "bytes",
            "Cache-Control": "no-cache",
        },
    )
```

- [ ] **Step 2: Commit (if auto_commit enabled)**

Check `.agent/config.yml` for `auto_commit` setting.

If `auto_commit: true` (default when absent):
```bash
git add backend/main.py
git commit -m "fix(backend): add dl param to video endpoint for forced attachment downloads"
```

If `auto_commit: false`: skip commit and staging. Print: "Skipping commit (auto_commit: false)."

---

### Task 2: Add `getDownloadUrl` helper to API

**Files:**
- Modify: `web/src/api.ts`

- [ ] **Step 1: Write minimal implementation**

Add the `getDownloadUrl` function to `web/src/api.ts` below `getVideoStreamUrl` (around line 196).

```typescript
export function getVideoStreamUrl(pathOrUrl: string, version?: number): string {
  if (!pathOrUrl) return "";
  if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) {
    return pathOrUrl;
  }
  const vParam = version !== undefined && version !== 0 ? `&v=${version}` : "";
  return `${API_URL}/video?path=${encodeURIComponent(pathOrUrl)}${vParam}`;
}

export function getDownloadUrl(pathOrUrl: string, version?: number, customName?: string): string {
  const base = getVideoStreamUrl(pathOrUrl, version);
  if (!base.startsWith("http")) return base;
  
  const separator = base.includes("?") ? "&" : "?";
  let url = `${base}${separator}dl=1`;
  if (customName) {
    url += `&title=${encodeURIComponent(customName)}`;
  }
  return url;
}
```

- [ ] **Step 2: Commit (if auto_commit enabled)**

Check `.agent/config.yml` for `auto_commit` setting.

If `auto_commit: true` (default when absent):
```bash
git add web/src/api.ts
git commit -m "feat(web): add getDownloadUrl helper for direct downloads"
```

If `auto_commit: false`: skip commit and staging. Print: "Skipping commit (auto_commit: false)."

---

### Task 3: Refactor UI Download Flow

**Files:**
- Modify: `web/src/components/Steps/StepResult.tsx`

- [ ] **Step 1: Update imports**

Update line 16 to include `getDownloadUrl`.

```typescript
import { getVideoStreamUrl, getDownloadUrl } from "../../api";
```

- [ ] **Step 2: Rewrite `handleDownloadClip`**

Replace the existing `handleDownloadClip` (around line 73) which uses `fetch` and Blob with a synchronous native link click.

```typescript
  const handleDownloadClip = (clip: Clip, index: number) => {
    try {
      const cleanName = (clip.description || `clip_${index + 1}`)
        .slice(0, 30)
        .replace(/[^a-zA-Z0-9_-]/g, "_");
      const filename = `${cleanName}_${jobId.slice(0, 6)}`;
      
      const downloadUrl = getDownloadUrl(clip.path, clip.v, filename);
      
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.target = "_blank"; // Opens a new tab which immediately closes for downloads
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.warn("Failed to trigger download", err);
    }
  };
```

- [ ] **Step 3: Remove loading states (Optional but recommended)**

Since the download is synchronous and handled by the browser, `downloadingIndex` logic in the return statement (around line 361) can be removed or left as is (it will just never be truthy since we removed `setDownloadingIndex` in the handler). For cleanliness, update the button to strictly use the `Download` icon.

```tsx
                        <button
                          type="button"
                          onClick={() => handleDownloadClip(clip, index)}
                          className="flex-1 py-2.5 px-3 bg-amber-400 hover:bg-amber-300 active:scale-95 text-neutral-950 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-md shadow-amber-400/10"
                        >
                          <Download className="w-4 h-4" />
                          <span>Download Clip</span>
                        </button>
```
*(Also remove `downloadingIndex` from `useState` at the top of the file if you like)*

- [ ] **Step 4: Commit (if auto_commit enabled)**

Check `.agent/config.yml` for `auto_commit` setting.

If `auto_commit: true` (default when absent):
```bash
git add web/src/components/Steps/StepResult.tsx
git commit -m "fix(web): use synchronous native download approach in StepResult"
```

If `auto_commit: false`: skip commit and staging. Print: "Skipping commit (auto_commit: false)."
