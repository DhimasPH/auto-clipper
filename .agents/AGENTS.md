# Project: Auto Clipper

## Tech Stack
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS (optional/pending)
- **Backend**: Python 3.11, FastAPI, Uvicorn, yt-dlp, ffmpeg-python, google-genai
- **App Shell**: Electron

## Commands
- **Run App (Dev)**: `npm run electron:dev` (This spins up the Vite frontend and Electron shell, which in turn spawns the FastAPI backend).
- **Backend (Standalone for Debugging)**: `python -m backend.main`

## Architecture & Code Conventions
- **Electron Shell (`electron/main.cjs`)**: Responsible for spawning the Python backend as a child process. It must ensure the Python process is properly killed when the app closes to avoid zombie processes holding port 8000.
- **FastAPI Backend (`backend/main.py`)**: Runs on `http://127.0.0.1:8000`. Handles video downloading, AI processing, and cropping. 
- **Frontend (`src/App.tsx`)**: React app making HTTP requests to the FastAPI backend.

## Known Gotchas & Important Boundaries
- **Zombie Python Processes**: Electron on Windows may fail to kill the `python.exe` child process when closing. If port 8000 is blocked, or if users report changes not taking effect, use `taskkill /F /IM python.exe /T` in PowerShell to clear out zombie backends.
- **`yt-dlp` on Windows (`[Errno 22] Invalid argument`)**: `yt-dlp` often throws `[Errno 22]` on Windows during file merge if it tries to update file timestamps. Always pass `{'updatetime': False}` in `ydl_opts` to prevent this.
- **File Locking (`client.files.upload`)**: The Google GenAI SDK (`google-genai`) can fail or get locked if the file isn't cleanly closed. Be cautious with file paths and always ensure downloads are complete and sanitized.
- **Input Sanitization**: Always `.strip()` URLs and API keys in the backend routes to prevent hidden newline characters from causing `yt-dlp` or API failures.
- **Error Logging**: Tracebacks are written to `backend_error.log` in the root directory. Check this file when investigating generic backend 500 errors.
