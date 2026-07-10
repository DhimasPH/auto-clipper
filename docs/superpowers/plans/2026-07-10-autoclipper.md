# Auto Clipper MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a desktop application that automatically downloads YouTube videos, finds interesting highlights, extracts audio/text, and auto-crops the video to a 9:16 vertical format with subtitles.

**Architecture:** Electron + React (Vite) frontend for a fast, modern UI, communicating with a local Python (FastAPI) sidecar backend that orchestrates `yt-dlp`, `ffmpeg`, OpenCV (face tracking), and OpenAI API.

**Tech Stack:** React, TypeScript, Electron, Vite, TailwindCSS, Python, FastAPI, yt-dlp, ffmpeg-python, opencv-python, openai.

---

### Task 1: Setup Python Backend & Basic API

**Files:**
- Create: `backend/requirements.txt`
- Create: `backend/main.py`
- Create: `backend/tests/test_main.py`

- [ ] **Step 1: Write the failing test for healthcheck**

```python
# backend/tests/test_main.py
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest backend/tests/test_main.py -v`
Expected: FAIL with module not found or similar error.

- [ ] **Step 3: Write minimal implementation**

```python
# backend/requirements.txt
fastapi
uvicorn
pytest
httpx
```

```python
# backend/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Auto Clipper API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health_check():
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, reload=True)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pip install -r backend/requirements.txt`
Run: `pytest backend/tests/test_main.py -v`
Expected: PASS

- [ ] **Step 5: Commit (if auto_commit enabled)**

Check `.agent/config.yml` for `auto_commit` setting.
If `auto_commit: true`:
```bash
git add backend/
git commit -m "feat: setup python backend and health check"
```
If `auto_commit: false`: skip commit and staging. Print: "Skipping commit (auto_commit: false)."

---

### Task 2: Setup Electron + React Frontend

**Files:**
- Create: `package.json`
- Create: `vite.config.ts`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `electron/main.js`

- [ ] **Step 1: Initialize Vite React Project & Install Electron**

Run: `npm create vite@latest . -- --template react-ts`
Run: `npm install electron concurrently wait-on cross-env --save-dev`
Run: `npm install tailwindcss postcss autoprefixer axios`
Run: `npx tailwindcss init -p`

- [ ] **Step 2: Write minimal Electron Main Process**

```javascript
# electron/main.js
const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let pythonProcess;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  // Start Python Backend
  pythonProcess = spawn('python', ['-m', 'backend.main']);
  
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
  if (pythonProcess) {
    pythonProcess.kill();
  }
});
```

- [ ] **Step 3: Configure package.json scripts**

Modify `package.json` to add:
```json
"main": "electron/main.js",
"scripts": {
  "dev": "vite",
  "build": "tsc && vite build",
  "electron:dev": "cross-env NODE_ENV=development concurrently \"npm run dev\" \"wait-on tcp:5173 && electron .\""
}
```

- [ ] **Step 4: Create Basic App UI (React)**

```tsx
# src/App.tsx
import { useState, useEffect } from 'react';
import axios from 'axios';

function App() {
  const [status, setStatus] = useState('Checking backend...');

  useEffect(() => {
    axios.get('http://127.0.0.1:8000/health')
      .then(res => setStatus('Backend Status: ' + res.data.status))
      .catch(err => setStatus('Backend Error: ' + err.message));
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center">
      <h1 className="text-4xl font-bold mb-4">Auto Clipper MVP</h1>
      <p className="text-xl">{status}</p>
    </div>
  );
}
export default App;
```

- [ ] **Step 5: Run to verify**
Run: `npm run electron:dev` (Verify window opens and says "Backend Status: ok").

- [ ] **Step 6: Commit (if auto_commit enabled)**

Check `.agent/config.yml` for `auto_commit` setting.
If `auto_commit: true`:
```bash
git add package.json package-lock.json vite.config.ts electron/ src/ tailwind.config.js postcss.config.js
git commit -m "feat: setup electron react frontend"
```

---

### Task 3: Video Download Module (yt-dlp)

**Files:**
- Modify: `backend/requirements.txt`
- Create: `backend/video_utils.py`
- Create: `backend/tests/test_video_utils.py`
- Modify: `backend/main.py`

- [ ] **Step 1: Write failing test**

```python
# backend/tests/test_video_utils.py
from backend.video_utils import download_youtube_video

def test_download_youtube_video(tmp_path):
    # Use a very short test video URL
    url = "https://www.youtube.com/watch?v=BaW_jenozKc" 
    output_path = tmp_path / "video.mp4"
    result_path = download_youtube_video(url, str(output_path))
    
    assert result_path.exists()
```

- [ ] **Step 2: Implement yt-dlp downloader**

Modify `backend/requirements.txt` to add `yt-dlp`. Run `pip install -r backend/requirements.txt`.

```python
# backend/video_utils.py
import yt_dlp
import os
from pathlib import Path

def download_youtube_video(url: str, output_path: str) -> Path:
    ydl_opts = {
        'format': 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
        'outtmpl': output_path,
        'merge_output_format': 'mp4',
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        ydl.download([url])
    
    return Path(output_path)
```

- [ ] **Step 3: Expose FastAPI Endpoint**

```python
# backend/main.py (Append to file)
from pydantic import BaseModel
from backend.video_utils import download_youtube_video
import os

class DownloadRequest(BaseModel):
    url: str

@app.post("/download")
def download_video(req: DownloadRequest):
    # Save to a temp dir in project root for MVP
    output_path = os.path.join(os.getcwd(), "temp_downloads", "source.mp4")
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    try:
        download_youtube_video(req.url, output_path)
        return {"status": "success", "file_path": output_path}
    except Exception as e:
        return {"status": "error", "message": str(e)}
```

- [ ] **Step 4: Run tests**
Run: `pytest backend/tests/test_video_utils.py -v` (Note: this might take a few seconds to download the test video). Expected: PASS.

- [ ] **Step 5: Commit**
(Check auto_commit logic as in previous steps)

---

### Task 4: AI Transcription & Highlights (OpenAI API)

**Files:**
- Modify: `backend/requirements.txt`
- Create: `backend/ai_processor.py`
- Modify: `backend/main.py`

- [ ] **Step 1: Install OpenAI**
Add `openai`, `python-dotenv` to `backend/requirements.txt`. Run `pip install -r backend/requirements.txt`.

- [ ] **Step 2: Implement Transcription and Highlights**

```python
# backend/ai_processor.py
from openai import OpenAI
import os

def transcribe_audio(audio_path: str, api_key: str):
    client = OpenAI(api_key=api_key)
    with open(audio_path, "rb") as audio_file:
        transcript = client.audio.transcriptions.create(
            model="whisper-1",
            file=audio_file,
            response_format="srt"
        )
    return transcript

def find_highlights(transcript_srt: str, api_key: str):
    client = OpenAI(api_key=api_key)
    prompt = f"Analyze this SRT transcript and find the most engaging 30-60 second highlight. Return ONLY the start and end timestamp in the format MM:SS-MM:SS.\n\n{transcript_srt}"
    
    response = client.chat.completions.create(
        model="gpt-3.5-turbo",
        messages=[{"role": "user", "content": prompt}]
    )
    return response.choices[0].message.content.strip()
```

- [ ] **Step 3: Expose FastAPI Endpoints**
Update `backend/main.py` to add endpoints for `/process_ai` which takes the video path, extracts audio (using FFmpeg, requires `ffmpeg-python`), and calls the functions in `ai_processor.py`.

---

### Task 5: Video Cropping (16:9 to 9:16) & Rendering

**Files:**
- Create: `backend/crop_utils.py`
- Modify: `backend/requirements.txt`

- [ ] **Step 1: Install dependencies**
Add `ffmpeg-python`, `opencv-python` to `backend/requirements.txt`.

- [ ] **Step 2: Implement basic center crop & subtitles**

```python
# backend/crop_utils.py
import ffmpeg

def crop_and_burn_subs(input_video: str, srt_file: str, start_time: str, end_time: str, output_path: str):
    # MVP: Basic center crop to 9:16 (Assuming 1920x1080 input -> 608x1080 output)
    # Burns subtitles using the 'subtitles' filter
    
    stream = ffmpeg.input(input_video, ss=start_time, to=end_time)
    
    video = stream.video.filter('crop', 'ih*9/16', 'ih')
    # Windows absolute path for subtitles filter requires escaping backslashes and colons
    escaped_srt = srt_file.replace('\\', '/').replace(':', '\\:')
    video = video.filter('subtitles', escaped_srt)
    
    audio = stream.audio
    
    out = ffmpeg.output(video, audio, output_path)
    out.run(overwrite_output=True)
    return output_path
```

---

### Task 6: Main UI Implementation (React)

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/VideoUploader.tsx`

- [ ] **Step 1: Build the Input UI**
Create a form to accept a YouTube URL and an OpenAI API Key.
Make a POST request to `/download`, then `/process_ai`, then `/render`.

- [ ] **Step 2: Build the Result UI**
Add a `<video>` tag to preview the generated `output.mp4`.

---

## ⚠️ Pre-Flight Check
- The user must have FFmpeg installed on their system PATH for `ffmpeg-python` to work.
- The user must provide a valid OpenAI API key in the UI.
