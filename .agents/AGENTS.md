# Auto Clipper - AI Agent Guidelines & Context Hub

Panduan arsitektur, standar kode, dan aturan kerja untuk AI Agent pada repositori `auto-clipper`.

---

## 1. Arsitektur Proyek & Tech Stack

- **Frontend Desktop**: Tauri v2 (Rust) + React 18 + TypeScript + Vite + Tailwind CSS + Lucide React + React Router.
- **Backend Core (Sidecar)**: Python 3.11+ berjalan sebagai server lokal **FastAPI** yang dibungkus menjadi single executable dengan PyInstaller (`backend-x86_64-pc-windows-msvc.exe` di folder `bin/`).
- **Database**: SQLite lokal (`history.db`) via `backend/db.py` untuk mengelola riwayat job, metadata klip, dan status pemrosesan.
- **AI & Processing Pipeline**:
  - **Speech-to-Text**: `faster-whisper` (didukung model: `small`, `medium`, `large-v3`) + Silero VAD filter (`min_silence_duration_ms=500`).
  - **Highlight Extraction & Social Kit**: **AI Provider Registry** (Mendukung provider dinamis seperti OpenAI, Gemini, dll) dengan parser JSON tangguh (`clean_json_response`).
  - **Face Detection & Tracking**: OpenCV Haar Cascade + Exponential Moving Average (EMA, alpha ~0.25) + ekspresi interpolasi FFmpeg dinamis.
  - **Subtitles**: Generator ASS format cumulative word-by-word karaoke (`words_to_karaoke_ass`).
  - **Video Rendering & Cropping**: FFmpeg via subproses Python (menggunakan Hardware Acceleration `h264_nvenc` dengan mekanisme fallback otomatis ke `libx264`).
  - **Downloader**: `yt-dlp` dengan fallback cookie browser.

---

## 2. Aturan Baku Pengembangan (Rules & Invariants)

### A. Handshake Sidecar & Larangan Print Stdout (Kritis)
1. Backend berkomunikasi dengan frontend melalui REST API lokal dengan port dinamis dan token autentikasi (`API_SECRET_TOKEN`).
2. **JANGAN PERNAH** menuliskan `print()` sembarangan ke `stdout` di modul backend manapun. Handshake Tauri bergantung pada format stdout ketat dari `backend/main.py` (`PORT:<port>` dan `TOKEN:<token>`). Output liar di stdout akan menggagalkan inisialisasi aplikasi.

### B. Standarisasi Error Logging & Exception (ADR-006)
1. Semua error, peringatan, dan exception di backend **HARUS** dicatat menggunakan `log_error(err, context="...")` dari `backend.logger`.
2. Log disimpan ke file `backend_error.log` secara fail-safe dengan encoding UTF-8.
3. Error di sisi frontend diteruskan ke backend melalui endpoint `POST /log-error`.
4. Endpoint FastAPI dilindungi oleh `@app.exception_handler(Exception)` dan `sys.excepthook` untuk mencegah unhandled crash.

### C. Offline-First & Whisper Model Management (ADR-005)
1. Model Whisper default adalah `small`. Model yang lebih besar (`medium`, `large-v3`) diunduh secara eksplisit melalui endpoint `POST /api/settings/whisper-models/download`.
2. Saat eksekusi job transkripsi, parameter `local_files_only=True` selalu diaktifkan untuk model non-default agar tidak pernah mencoba mengunduh diam-diam saat offline atau koneksi tidak stabil.
3. Selalu sertakan `vad_filter=True` untuk memangkas jeda hening dan mencegah halusinasi teks berulang.
4. **AI Provider Registry & Dynamic Models**: Sistem **tidak boleh** melakukan hardcode pada model LLM. Selalu gunakan sistem *AI Provider Registry* yang mengambil konfigurasi model secara dinamis dari frontend/backend settings.

### D. Video Cropping & Karaoke Subtitle Invariants (ADR-003)
1. Pemotongan video portrait (9:16) harus menggunakan `sample_face_trajectory` + `smooth_trajectory` + `build_dynamic_crop_filter` agar kamera mengikuti pergerakan wajah pembicara secara halus.
2. Subtitle karaoke harus menggunakan `words_to_karaoke_ass` dengan pola kemunculan kata bertahap (kata aktif berwarna kuning `{\c&H00FFFF&}`, kata sebelumnya putih), disertai hold time di akhir kalimat.
3. Pipeline wajib mendeteksi layout video asli (Landscape/Portrait) secara otomatis sebelum pemrosesan klip.
4. **NVENC Fallback**: Semua *command* FFmpeg untuk rendering video wajib mengimplementasikan percobaan hardware encoding dengan `h264_nvenc`. Jika terjadi error (misalnya karena driver tidak tersedia atau memori GPU penuh), command tersebut harus ditangkap dan fallback secara aman ke CPU encoding (`libx264`).

### E. Multi-Stage Resume, Job Workspaces, & Mode (AI vs Manual)
1. Fitur retry/resume di `backend/jobs.py` tidak boleh mengunduh ulang video jika file lokal sudah tersedia.
2. Jika transkripsi atau highlight sudah ada, gunakan kembali data yang tersimpan di `history.db` tanpa memanggil ulang Whisper atau LLM secara sia-sia.
3. **Project Workspace Isolation**: Semua artefak hasil pemrosesan (video mentah, file `.ass`, dan potongan `.mp4`) **HARUS** di-route dan disimpan di dalam sub-direktori *project workspace* yang terisolasi untuk masing-masing job/project (bukan di root atau shared flat directory).
4. Backend dan frontend mendukung mode alur kerja **AI-driven** maupun **Manual Editor**; metadata klip tidak selalu dihasilkan otomatis oleh LLM.

### F. Frontend, i18n & OS Integration (ADR-004, v1.7.0)
1. Seluruh teks antarmuka **HARUS** mendukung multi-bahasa melalui `src/locales/id.json` dan `src/locales/en.json` (menggunakan library i18n).
2. Notifikasi menggunakan Native OS Notification (`@tauri-apps/plugin-notification`).
3. Proses rendering video wajib mengaktifkan `BusyOverlay` (OS sleep prevention).
4. Startup version check dijalankan secara non-blocking via hook `useStartupUpdateCheck` saat splash screen.
5. Desain UI wajib modern, responsif, mengutamakan Dark Mode, dan menggunakan ikon dari `lucide-react`.

### G. PyInstaller & Tauri Build Invariants
1. Executable backend Python dibangun dengan target triplet di folder `bin/` (contoh: `bin/backend-x86_64-pc-windows-msvc.exe`).
2. Script build: jalankan `build-be.ps1` atau `build-be.bat` (selalu gunakan flag `--clean`).
3. Konfigurasi perizinan Tauri ada di `src-tauri/tauri.conf.json` dan `src-tauri/capabilities/default.json`.

### H. Dokumentasi ADR & Testing
1. Setiap perubahan arsitektur signifikan, penambahan library inti, atau perubahan alur data wajib dibuatkan dokumen ADR di `docs/decisions/` format `[nomor]-[nama-singkat].md`.
2. Selalu jalankan unit test backend dengan `pytest` di folder `backend/tests/` dan validasi build frontend sebelum menyelesaikan task besar.

### I. Developer Mode & Uvicorn Auto-Reload
1. Saat menjalankan backend secara lokal untuk *development*, gunakan environment variable `AUTO_CLIPPER_DEV_TOKEN="dev-token"` dan jalankan `uvicorn` dengan mode auto-reload. Frontend akan menggunakan token statis ini untuk handshake (mem-bypass pembacaan `stdout` untuk `PORT`/`TOKEN`).

---

## 3. Direktori & File Penting
- `backend/main.py`: Entry point FastAPI, exception handler, port/token emitter.
- `backend/jobs.py`: Worker queue, pipeline eksekusi klip, resume/retry logic.
- `backend/ai_utils.py`: Integrasi Whisper, model registry, prompt LLM & JSON sanitizer.
- `backend/crop_utils.py`: Face tracking (OpenCV), crop filter generator, subtitle ASS parser.
- `backend/logger.py`: Fail-safe error logger (`backend_error.log`).
- `backend/db.py`: SQLite database schema & repository functions.
- `src/App.tsx`: Routing, splash screen, startup update check.
- `src/locales/`: File terjemahan bilingual (`id.json`, `en.json`).
- `src-tauri/`: Tauri Rust backend & configuration.
- `docs/decisions/`: Architecture Decision Records (ADR-001 s/d ADR-006).
