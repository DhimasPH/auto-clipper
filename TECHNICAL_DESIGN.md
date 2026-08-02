# Technical Design Document - Auto Clipper

Dokumen ini menjelaskan arsitektur teknis, diagram alur, dan interaksi komponen dalam aplikasi Auto Clipper.

## 1. High-Level Architecture

Aplikasi ini menggunakan model **Sidecar Architecture**, tetapi alih-alih hanya mengeksekusi skrip secara pasif, Sidecar Python beroperasi sebagai **Server API Lokal (FastAPI)**. Antarmuka pengguna (Frontend Tauri) dan mesin pemrosesan berinteraksi melalui HTTP REST API dan Token Autentikasi.

```mermaid
graph TD
    subgraph Frontend [Tauri App - UI Layer]
        A[React UI + Vite + Tailwind] 
        B[Tauri Commands & OS Events]
        A <-->|State & Fetch| B
    end

    subgraph Backend [Python Sidecar - FastAPI Server]
        C[FastAPI REST API]
        D[Job Management / DB SQLite / Workspace]
        E[yt-dlp Downloader / Local File handler]
        F[AI Pipeline: Whisper, AI Providers, OpenCV]
        G[FFmpeg Renderer <br/> NVENC Fallback]
        
        C <--> D
        D --> E
        D --> F
        D --> G
    end

    B <-->|HTTP Requests + API Token| C
    B -->|Native OS Notifications| User
```

## 2. Alur Pemrosesan Video (Video Processing Flow)

Pekerjaan (Jobs) diatur oleh modul *Job Management* di Python. Sistem ini tangguh berkat adanya *retry logic* saat ekstraksi LLM dan penanganan background agar sistem operasi tidak tidur (Sleep Prevention / BusyOverlay).

```mermaid
sequenceDiagram
    participant User
    participant Frontend as Tauri (React)
    participant API as FastAPI Backend
    participant JobMgr as Job Manager
    participant AI as AI & LLM Modules
    participant FFmpeg as FFmpeg

    User->>Frontend: Input URL/File & Click "Proses"
    Frontend->>Frontend: Enable BusyOverlay (Sleep Prevention)
    Frontend->>API: POST /job (Create Task)
    API->>JobMgr: Initialize & Enqueue Job
    JobMgr-->>Frontend: 200 OK (Job ID)
    
    loop Status Polling / Streaming
        Frontend->>API: GET /job/{id}/status
        API-->>Frontend: Status Updates (Progress %)
    end
    
    JobMgr->>JobMgr: 1. Initialize Workspace & Download Media
    JobMgr->>AI: 2. Layout Classification & Transcribe (Whisper)
    AI-->>JobMgr: Layout & Transcription Data
    
    alt AI Mode
        JobMgr->>AI: 3. Highlight Extraction (AI Provider)
        Note right of AI: Uses Retry Logic on JSON Parsing Error
        AI-->>JobMgr: Highlight Timestamps & Metadata
    else Manual Mode
        Frontend->>API: 3. User provides Highlight Timestamps
    end
    
    JobMgr->>AI: 4. Face Tracking (OpenCV - for Landscape)
    AI-->>JobMgr: Crop Coordinates
    
    JobMgr->>FFmpeg: 5. Render Video (Crop & Subtitle)
    Note right of FFmpeg: Tries h264_nvenc, fallback to libx264
    FFmpeg-->>JobMgr: Final MP4 output
    
    JobMgr->>API: Mark Job Complete
    API-->>Frontend: Status: "Completed"
    Frontend->>Frontend: Disable BusyOverlay
    Frontend->>User: Native OS Notification (Tauri plugin) & Redirect to History
```

## 3. Struktur Direktori Utama

- `src/`: Berisi kode sumber Frontend (React, Vite, Tailwind). Komponen UI, state management, dan modul i18n (Internationalization) ada di sini.
- `src-tauri/`: Kode Rust yang membungkus aplikasi web menjadi *desktop app*. Mendefinisikan kapabilitas *Native Notifications*, konfigurasi *sleep prevention*, dan eksekusi *sidecar* (`tauri.conf.json`).
- `backend/`: Kode Python (FastAPI). 
  - `main.py`: Entry point server web lokal.
  - `jobs.py`: Scheduler dan handler pemrosesan dengan manajemen *Project Workspace*.
  - `ai_utils.py`: Logika interaksi AI (Whisper, AI Provider Registry) yang dilengkapi metode fallback/retry.
  - `crop_utils.py`: Utilitas deteksi wajah (OpenCV), klasifikasi layout, pembuat subtitle karaoke, dan filter *panning* FFmpeg dinamis.
  - `db.py`: Koneksi dan model SQLite untuk manajemen riwayat.
- `bin/`: Direktori tempat executable *sidecar* dari PyInstaller disimpan (`backend-x86_64-pc-windows-msvc.exe`) sebelum dipanggil oleh Tauri.

## 4. Inter-Process Communication (IPC) & Keamanan

Komunikasi antara UI (Tauri) dan backend (Python) tidak lagi menggunakan *Standard Input/Output (stdio)* mentah. Saat Tauri dijalankan, ia membangunkan sidecar FastAPI di port lokal secara dinamis.

- **HTTP REST API**: Frontend Tauri melakukan inisiasi data (seperti URL/Video Path) melalui Endpoint POST, dan membaca *progress state* melalui Endpoint GET (Polling/Streaming).
- **Keamanan Token Lokal**: Akses ke Endpoint dibentengi oleh `API_SECRET_TOKEN` yang di-generate dinamis dari *stdout* saat Tauri membangunkan *sidecar*.
- **Developer Mode**: Saat pengembangan dengan `uvicorn` *auto-reload*, pengembang menyetel environment variable `$env:AUTO_CLIPPER_DEV_TOKEN="dev-token"` agar komunikasi frontend berjalan lancar tanpa proses parsing token dari *stdout*.
- **Sleep Prevention & OS Notifications**: Ketika backend sibuk merender, Tauri di sisi frontend menjaga OS agar tidak masuk status *Sleep* (melalui library terkait atau API native Tauri). Begitu server merespons "Selesai", Tauri akan membunyikan Notifikasi OS (OS Level, bukan HTML Web Toast biasa) yang mendukung multi-bahasa sesuai pengaturan *locale* user.
