# Local CDP Auto-Post Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrates automated multi-platform social media publishing (Instagram, Facebook, YouTube Shorts, TikTok) using local Chrome DevTools Protocol (CDP) hijacking to bypass APIs and OAuth.

**Architecture:** A FastAPI backend uses Playwright to connect to a user's running Chrome/Edge instance via CDP, navigating to social platforms and uploading rendered videos natively. A React frontend provides a modal for selecting targets and schedules.

**Tech Stack:** FastAPI, Playwright (Python), React, Tailwind CSS, Lucide React.

---

### Task 1: Backend Dependencies & CDP Core Setup

**Files:**
- Modify: `backend/requirements.txt`
- Create: `backend/publisher/__init__.py`
- Create: `backend/publisher/cdp_core.py`
- Test: `backend/tests/test_cdp_core.py`

- [ ] **Step 1: Add Playwright dependency**
Modify `backend/requirements.txt` to include `playwright>=1.45.0` at the end of the file.

```text
playwright>=1.45.0
```

- [ ] **Step 2: Create publisher package and CDP core**
Create `backend/publisher/__init__.py` as an empty file.
Create `backend/publisher/cdp_core.py`:

```python
import os
import subprocess
import time
from typing import Optional
from playwright.sync_api import sync_playwright, Browser, BrowserContext

def find_browser_executable() -> str:
    # A simple fallback check for Windows standard Chrome/Edge paths
    paths = [
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
    ]
    for path in paths:
        if os.path.exists(path):
            return path
    raise FileNotFoundError("Could not find Chrome or Edge executable.")

def launch_browser_cdp(port: int = 9222) -> None:
    exe_path = find_browser_executable()
    # Launch detached so the app doesn't block
    subprocess.Popen([
        exe_path,
        f"--remote-debugging-port={port}",
        "--remote-allow-origins=*"
    ], start_new_session=True)
    time.sleep(2) # Give it time to start

def get_cdp_context(port: int = 9222) -> BrowserContext:
    pw = sync_playwright().start()
    try:
        browser = pw.chromium.connect_over_cdp(f"http://localhost:{port}")
        return browser.contexts[0]
    except Exception:
        # If connection fails, launch it and try again
        launch_browser_cdp(port)
        browser = pw.chromium.connect_over_cdp(f"http://localhost:{port}")
        return browser.contexts[0]
```

- [ ] **Step 3: Commit**
Check `.agent/config.yml` for `auto_commit` setting.
If `auto_commit: true`:
```bash
git add backend/requirements.txt backend/publisher/
git commit -m "feat: add CDP core for auto-post"
```

---

### Task 2: Backend Platform Publishers (Stub Implementation)

**Files:**
- Create: `backend/publisher/instagram_publisher.py`
- Create: `backend/publisher/facebook_publisher.py`
- Create: `backend/publisher/youtube_publisher.py`
- Create: `backend/publisher/tiktok_publisher.py`

- [ ] **Step 1: Create Instagram Publisher**
Create `backend/publisher/instagram_publisher.py`:

```python
from playwright.sync_api import Page
import time

def publish_to_instagram(page: Page, video_path: str, caption: str, schedule_date: str = None):
    # Stub: Target is instagram.com native web UI
    page.goto("https://www.instagram.com/")
    time.sleep(2)
    print(f"Uploading to Instagram: {video_path}")
    if schedule_date:
        print(f"Scheduling via IG Advanced Settings / Scheduled Content for {schedule_date}")
```

- [ ] **Step 2: Create Facebook Publisher**
Create `backend/publisher/facebook_publisher.py`:

```python
from playwright.sync_api import Page
import time

def publish_to_facebook(page: Page, video_path: str, caption: str, schedule_date: str = None):
    # Stub: Target is facebook.com native web UI
    page.goto("https://www.facebook.com/")
    time.sleep(2)
    print(f"Uploading to Facebook: {video_path}")
    if schedule_date:
        print(f"Scheduling for {schedule_date}")
```

- [ ] **Step 3: Create YouTube Publisher**
Create `backend/publisher/youtube_publisher.py`:

```python
from playwright.sync_api import Page
import time

def publish_to_youtube(page: Page, video_path: str, caption: str, schedule_date: str = None):
    # Stub: Target is studio.youtube.com
    page.goto("https://studio.youtube.com/")
    time.sleep(2)
    print(f"Uploading to YouTube: {video_path}")
```

- [ ] **Step 4: Create TikTok Publisher**
Create `backend/publisher/tiktok_publisher.py`:

```python
from playwright.sync_api import Page
import time

def publish_to_tiktok(page: Page, video_path: str, caption: str, schedule_date: str = None):
    # Stub: Target is tiktok.com/upload
    page.goto("https://www.tiktok.com/upload")
    time.sleep(2)
    print(f"Uploading to TikTok: {video_path}")
```

- [ ] **Step 5: Commit**
Check `.agent/config.yml` for `auto_commit` setting.
If `auto_commit: true`:
```bash
git add backend/publisher/
git commit -m "feat: add publisher stubs for IG, FB, YT, TikTok"
```

---

### Task 3: Backend API Integration

**Files:**
- Modify: `backend/main.py`

- [ ] **Step 1: Add Publishing Endpoint**
In `backend/main.py`, add the endpoints for publishing. Update imports to reflect the separated IG and FB publishers.

```python
# Add to top imports
from typing import List, Optional
from pydantic import BaseModel
from publisher.cdp_core import get_cdp_context
from publisher.instagram_publisher import publish_to_instagram
from publisher.facebook_publisher import publish_to_facebook
from publisher.youtube_publisher import publish_to_youtube
from publisher.tiktok_publisher import publish_to_tiktok

class PublishRequest(BaseModel):
    video_path: str
    caption: str
    platforms: List[str]
    schedule_date: Optional[str] = None

@app.post("/api/publish")
def api_publish(req: PublishRequest):
    try:
        context = get_cdp_context()
        results = []
        for platform in req.platforms:
            page = context.new_page()
            try:
                if platform == "instagram":
                    publish_to_instagram(page, req.video_path, req.caption, req.schedule_date)
                elif platform == "facebook":
                    publish_to_facebook(page, req.video_path, req.caption, req.schedule_date)
                elif platform == "youtube":
                    publish_to_youtube(page, req.video_path, req.caption, req.schedule_date)
                elif platform == "tiktok":
                    publish_to_tiktok(page, req.video_path, req.caption, req.schedule_date)
                results.append({"platform": platform, "status": "success"})
            except Exception as e:
                results.append({"platform": platform, "status": "error", "message": str(e)})
            finally:
                page.close()
        return {"status": "completed", "results": results}
    except Exception as e:
        return {"status": "error", "message": str(e)}
```

- [ ] **Step 2: Commit**
Check `.agent/config.yml` for `auto_commit` setting.
If `auto_commit: true`:
```bash
git add backend/main.py
git commit -m "feat: add api/publish endpoint with distinct platforms"
```

---

### Task 4: Frontend UI - Publish Modal & History Action

**Files:**
- Create: `src/components/ui/PublishModal.tsx`
- Modify: `src/pages/HistoryPage.tsx`

- [ ] **Step 1: Create PublishModal Component**
Create `src/components/ui/PublishModal.tsx`:

```tsx
import React, { useState } from 'react';
import { X } from 'lucide-react';
import Button from './Button';

interface PublishModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoPath: string;
  defaultCaption: string;
}

export default function PublishModal({ isOpen, onClose, videoPath, defaultCaption }: PublishModalProps) {
  const [caption, setCaption] = useState(defaultCaption);
  const [platforms, setPlatforms] = useState({ instagram: false, facebook: false, youtube: false, tiktok: false });
  const [isPublishing, setIsPublishing] = useState(false);
  const [schedule, setSchedule] = useState('');

  if (!isOpen) return null;

  const handlePublish = async () => {
    setIsPublishing(true);
    const selectedPlatforms = Object.entries(platforms).filter(([_, v]) => v).map(([k]) => k);
    try {
      await fetch('http://127.0.0.1:8000/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          video_path: videoPath,
          caption,
          platforms: selectedPlatforms,
          schedule_date: schedule || null
        })
      });
      alert('Publishing completed/scheduled!');
      onClose();
    } catch (e) {
      alert('Failed to publish');
    }
    setIsPublishing(false);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 p-6 rounded-xl max-w-lg w-full">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white">Publish Video</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        
        <div className="mb-4">
          <label className="block text-gray-400 text-sm mb-2">Platforms</label>
          <div className="flex flex-col gap-2">
            <label className="flex items-center text-white gap-2">
              <input type="checkbox" checked={platforms.instagram} onChange={e => setPlatforms({...platforms, instagram: e.target.checked})} /> Instagram Reels
            </label>
            <label className="flex items-center text-white gap-2">
              <input type="checkbox" checked={platforms.facebook} onChange={e => setPlatforms({...platforms, facebook: e.target.checked})} /> Facebook Reels
            </label>
            <label className="flex items-center text-white gap-2">
              <input type="checkbox" checked={platforms.youtube} onChange={e => setPlatforms({...platforms, youtube: e.target.checked})} /> YouTube Shorts
            </label>
            <label className="flex items-center text-white gap-2">
              <input type="checkbox" checked={platforms.tiktok} onChange={e => setPlatforms({...platforms, tiktok: e.target.checked})} /> TikTok
            </label>
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-gray-400 text-sm mb-2">Caption</label>
          <textarea className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white h-24" value={caption} onChange={e => setCaption(e.target.value)} />
        </div>

        <div className="mb-4">
          <label className="block text-gray-400 text-sm mb-2">Schedule (Optional)</label>
          <input type="datetime-local" className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white" value={schedule} onChange={e => setSchedule(e.target.value)} />
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handlePublish} disabled={isPublishing}>
            {isPublishing ? 'Publishing...' : 'Publish'}
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update HistoryPage to trigger the Modal**
Modify `src/pages/HistoryPage.tsx` to include `PublishModal`.

Add imports at the top:
```tsx
import PublishModal from '../components/ui/PublishModal';
import { Share } from 'lucide-react';
```

Add state inside the `HistoryPage` component:
```tsx
  const [publishModalData, setPublishModalData] = useState<{ isOpen: boolean; videoPath: string; caption: string }>({ isOpen: false, videoPath: '', caption: '' });
```

Find the action buttons section in the `renderClipRow` or equivalent map function, and add a Publish button:
```tsx
<Button variant="secondary" size="sm" onClick={() => setPublishModalData({ isOpen: true, videoPath: clip.output_path || '', caption: clip.metadata?.social_caption || '' })}>
  <Share className="w-4 h-4 mr-2" />
  Publish
</Button>
```

Add the modal at the bottom of the returned JSX:
```tsx
<PublishModal
  isOpen={publishModalData.isOpen}
  onClose={() => setPublishModalData({ ...publishModalData, isOpen: false })}
  videoPath={publishModalData.videoPath}
  defaultCaption={publishModalData.caption}
/>
```

- [ ] **Step 3: Commit**
Check `.agent/config.yml` for `auto_commit` setting.
If `auto_commit: true`:
```bash
git add src/components/ui/PublishModal.tsx src/pages/HistoryPage.tsx
git commit -m "feat: add frontend publish UI with separate IG and FB options"
```
