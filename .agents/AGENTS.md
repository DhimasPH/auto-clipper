# Auto Clipper - AI Agent Guidelines & Context Hub

Panduan arsitektur, standar kode, dan aturan kerja untuk AI Agent pada repositori `auto-clipper`.

---

## 1. Arsitektur Proyek & Tech Stack

- **Frontend Desktop**: Tauri v2 (Rust) + React 18 + TypeScript + Vite + Tailwind CSS + Lucide React + React Router.
- **Frontend Web (Cloud UI)**: Terletak di folder `web/`. Menggunakan React 18 + TypeScript + Vite + Tailwind CSS untuk antarmuka web murni (tanpa Tauri).
- **Backend Core (Sidecar)**: Python 3.11+ berjalan sebagai server lokal **FastAPI** yang dibungkus menjadi single executable dengan PyInstaller (`backend-x86_64-pc-windows-msvc.exe` di folder `bin/`).
- **Cloud Backend Support**: Backend Python mendukung eksekusi di cloud GPU (seperti Google Colab) menggunakan *Ngrok tunnel*. Frontend Web berkomunikasi menggunakan `AUTO_CLIPPER_WEB_TOKEN`.
- **Database**: SQLite lokal (`history.db`) via `backend/db.py` untuk mengelola riwayat job, metadata klip, dan status pemrosesan.
- **AI & Processing Pipeline**:
  - **Speech-to-Text**: `faster-whisper` (didukung model: `small`, `medium`, `large-v3`) + Silero VAD filter (`min_silence_duration_ms=500`).
  - **Highlight Extraction & Social Kit**: **AI Provider Registry** (Mendukung provider dinamis seperti OpenAI, Gemini, dll) dengan parser JSON tangguh (`clean_json_response`).
  - **Face Detection & Tracking**: OpenCV Haar Cascade + Exponential Moving Average (EMA, alpha ~0.25) + ekspresi interpolasi FFmpeg dinamis.
  - **Subtitles**: Engine ASS single-word pop karaoke non-overlapping (`words_to_karaoke_ass`) & sentence reconstruction (`words_to_standard_ass`) dengan tipografi kustom (ADR-009).
  - **Video Rendering & Cropping**: FFmpeg via subproses Python (menggunakan Hardware Acceleration `h264_nvenc` dengan mekanisme fallback otomatis ke `libx264`).
  - **Downloader**: `yt-dlp` dengan fallback cookie browser.

---

## 2. Aturan Baku Pengembangan (Rules & Invariants)

### A. Handshake Sidecar & Larangan Print Stdout (Kritis)
1. Backend berkomunikasi dengan frontend melalui REST API lokal dengan port dinamis dan token autentikasi (`API_SECRET_TOKEN`).
2. **JANGAN PERNAH** menuliskan `print()` sembarangan ke `stdout` di modul backend manapun. Handshake Tauri bergantung pada format stdout ketat dari `backend/main.py` (`PORT:<port>` dan `TOKEN:<token>`). Output liar di stdout akan menggagalkan inisialisasi aplikasi.
3. **Sidecar Auto-Recovery & Health Polling**: Frontend memantau status backend melalui endpoint `POST /heartbeat` dan `GET /health`. Jika koneksi terputus, frontend dapat me-restart sidecar (`resetAndRespawnBackend`). Interceptor HTTP dan fetch di sisi frontend harus diatur ulang (re-wire) dengan token yang baru saat sidecar di-restart.
4. **Cross-Platform CORS Invariant (ADR-011)**: Backend FastAPI **WAJIB** mengizinkan origin dari semua platform desktop webview (Windows WebView2: `http://tauri.localhost` / `https://tauri.localhost`, macOS WKWebView: `tauri://localhost` / `tauri://*`, dan local dev server) menggunakan format regex komprehensif: `r"https?://([a-zA-Z0-9_.-]+\.)?localhost(:\d+)?|https?://127\.0\.0\.1(:\d+)?|tauri://.*|app://.*"`. Dilarang menggunakan regex sempit yang mengecualikan subdomain localhost.

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

### D. Video Cropping, Canvas Styling & Karaoke Subtitle Invariants (ADR-003, ADR-008, ADR-009)
1. **Face Tracking Crop**: Pemotongan video portrait (9:16) standard harus menggunakan `sample_face_trajectory` + `smooth_trajectory` + `build_dynamic_crop_filter` agar kamera mengikuti pergerakan wajah pembicara secara halus.
2. **Canvas Background Styling & Zoom (ADR-008)**: Saat opsi Canvas Styling aktif pada video landscape (16:9), pipeline merender video di atas kanvas 9:16 dengan opsi latar (`blur` [light, medium, heavy], `color` solid, atau `image` kustom) serta pembesaran `enlarge_scale` (1.0x - 2.0x) secara proporsional tanpa memotong sisi video.
3. **Adaptive Subtitle Margin**: Pada mode kanvas, posisi vertikal subtitle ASS disesuaikan secara otomatis (`MarginV` dinaikkan) agar teks berada tepat di area kosong bawah video tanpa menutupi visual utama.
4. **Subtitle Zero-Overlap Invariant (ADR-009)**: Subtitle karaoke wajib menggaransi `end_i <= start_{i+1}` pada flat-word list sehingga kata aktif tampil tunggal (single-word pop) tanpa tumpang tindih waktu antar kata. Format warna primer ASS adalah `&H00BBGGRR` (8-digit hex) dan font weight mendukung `bold` (`Bold=-1`) serta `normal` (`Bold=0`).
5. **Universal Word-Level Transcription & Mode Dispatch**: Whisper wajib selalu mengekstrak word timestamps (`words.json`). Mode subtitle (`standard` vs `karaoke`) dikontrol oleh `subtitle_config.style`, bukan oleh ekstensi file input.
6. **Pipeline Metadata Invariant**: Properti `canvas_config` dan `subtitle_config` **HARUS** dipropagasikan dan dipertahankan di seluruh alur pembuatan job (`create_job`, `create_manual_job`, `create_rerender_job`, `create_rerun_ai_job`) serta alur resume (`create_resume_job`, `resume_manual_job`).
7. Pipeline wajib mendeteksi layout video asli (Landscape/Portrait) secara otomatis sebelum pemrosesan klip.
8. **NVENC Fallback**: Semua *command* FFmpeg untuk rendering video wajib mengimplementasikan percobaan hardware encoding dengan `h264_nvenc`. Jika terjadi error (misalnya karena driver tidak tersedia atau memori GPU penuh), command tersebut harus ditangkap dan fallback secara aman ke CPU encoding (`libx264`).
9. **FFmpeg Path Discovery Hierarchy**: Resolusi path binary FFmpeg wajib memeriksa hirarki `bin_dir`, `bin_dir.parent`, `os.path.dirname(bin_dir)`, dan fallback `PATH` sistem agar konsisten di environment dev, PyInstaller onefile, maupun macOS app bundle.
10. **Custom Subtitle Persistence Invariant**: Setiap modifikasi subtitle kustom per-klip (revisi manual) **WAJIB** disimpan jalurnya (`custom_subtitle_path`) ke dalam objek `result_clips` pada *history database*. *Endpoint* `api_get_clip_words` dan proses batch `_run_rerender_job` **WAJIB** memprioritaskan membaca `clip.get("custom_subtitle_path")` dibandingkan `metadata.get("subtitle_path")`. Hal ini menjamin revisi kata-per-kata yang dilakukan pengguna tidak tertimpa oleh transkripsi *full-video* asli saat dilakukan "Rerender All Clips".
11. **Gaming Layout Auto-Detection & Split-Screen**: Pipeline video secara otomatis dapat mendeteksi layout *gaming* dan mendukung *vertical split-screen cropping* (memotong layar video menjadi atas dan bawah) yang disesuaikan dengan posisi subtitle.
12. **Watermark Support**: Sistem mendukung penambahan *watermark* pada video hasil render akhir.

### E. Multi-Stage Resume, Job Workspaces, & Mode (AI vs Manual)
1. Fitur retry/resume di `backend/jobs.py` tidak boleh mengunduh ulang video jika file lokal sudah tersedia.
2. Jika transkripsi atau highlight sudah ada, gunakan kembali data yang tersimpan di `history.db` tanpa memanggil ulang Whisper atau LLM secara sia-sia.
3. **Project Workspace Isolation**: Semua artefak hasil pemrosesan (video mentah, file `.ass`, dan potongan `.mp4`) **HARUS** di-route dan disimpan di dalam sub-direktori *project workspace* yang terisolasi untuk masing-masing job/project (bukan di root atau shared flat directory).
4. Backend dan frontend mendukung mode alur kerja **AI-driven** maupun **Manual Editor**; metadata klip tidak selalu dihasilkan otomatis oleh LLM.
5. **Manual Downloader Enhancements**: Fitur downloader mendukung pengunduhan *full video* (tanpa memotong klip / *empty clips allowed*) dan pengguna dapat memilih kualitas resolusi video saat mengunduh.
6. **Penghapusan Smart Editor**: Fitur eksperimental *Smart Editor* telah **dihapus secara permanen**. Semua alur penyuntingan dan pemotongan (cropping) kini sepenuhnya mengandalkan pengaturan UI standar, *Gaming Mode*, dan modul *Canvas Config*.
7. **Web UI Draft State Invariant**: Pada Frontend Web, pembersihan status draft di `localStorage` (seperti `ac_draft_step_input`) saat memulai job baru **WAJIB** dilakukan secara asinkron (menggunakan `setTimeout`) untuk menghindari *race condition* dengan efek unmount dari komponen React yang berpotensi menimpa ulang *cache* yang baru saja dihapus.

### F. Frontend, i18n & OS Integration (ADR-004, v1.7.0)
1. Seluruh teks antarmuka **HARUS** mendukung multi-bahasa melalui `src/locales/id.json` dan `src/locales/en.json` (menggunakan library i18n).
2. Notifikasi menggunakan Native OS Notification (`@tauri-apps/plugin-notification`).
3. Proses rendering video wajib mengaktifkan `BusyOverlay` (OS sleep prevention).
4. Startup version check dijalankan secara non-blocking via hook `useStartupUpdateCheck` saat splash screen.
5. Desain UI wajib modern, responsif, mengutamakan Dark Mode, dan menggunakan ikon dari `lucide-react`.

### G. PyInstaller & Tauri Build Invariants (ADR-010, ADR-011)
1. **Platform Packaging Split**:
   - **Windows**: Menggunakan PyInstaller `--onefile` (`bin/backend-x86_64-pc-windows-msvc.exe`).
   - **macOS**: Menggunakan PyInstaller `--onedir` (`bin/backend-x86_64-apple-darwin/` atau `bin/backend-aarch64-apple-darwin/`) yang dikonfigurasi via `src-tauri/tauri.macos.conf.json`.
2. Script build: jalankan `build-be.ps1` atau `build-be.bat` untuk Windows (selalu gunakan flag `--clean`), atau `build-mac-local.sh` untuk environment macOS.
3. Release manual macOS Intel x86_64 dengan bundel updater artifact dijalankan menggunakan `release-mac-intel.sh` (panduan di `docs/release-macos-intel.md`).
4. Konfigurasi perizinan Tauri ada di `src-tauri/tauri.conf.json` dan `src-tauri/capabilities/default.json`.
5. **NSIS Preinstall File-Lock Prevention (`hooks.nsh`)**: Installer Windows wajib mengeksekusi `taskkill` untuk semua kemungkinan proses backend dan aplikasi (`backend.exe`, `backend-x86_64-pc-windows-msvc.exe`, `Auto Clipper.exe`, `app.exe`) sebelum instalasi dimulai guna menghindari `WinError 32` file lock.
6. **PyInstaller Dependency Collection**: Konfigurasi `backend.spec` wajib mendaftarkan `backend.metadata` pada `hiddenimports` dan mengumpulkan paket runtime penting seperti `numpy` via `collect_all('numpy')`.
7. **Tauri Dev Build Zombie Lock (Windows)**: Jika *build* Tauri gagal dengan pesan `PermissionDenied (os error 5)` atau panic pada `tauri-build` saat menjalankan `npm run tauri dev` atau `cargo run`, itu menandakan adanya *zombie sidecar process* (`backend.exe` atau `Auto Clipper.exe`) yang mengunci folder `target/debug`. Solusi wajib: Jalankan `taskkill /F /IM "backend.exe" /T` dan `taskkill /F /IM "Auto Clipper.exe" /T`, kemudian bersihkan *cache* yang *corrupt* dengan perintah `cargo clean` di dalam direktori `src-tauri` sebelum me-rebuild.

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
- `backend/crop_utils.py`: Face tracking (OpenCV), generator kanvas background (`build_canvas_background_filter`), subtitle ASS anti-overlap & typography parser.
- `backend/logger.py`: Fail-safe error logger (`backend_error.log`).
- `backend/db.py`: SQLite database schema & repository functions.
- `backend/tests/test_subtitle_render.py` & `backend/tests/test_jobs_subtitle.py`: Pengujian render subtitle ASS, anti-overlap, dan jobs threading.
- `Auto_Clipper_Colab.ipynb`: Jupyter Notebook untuk menjalankan backend FastAPI di Google Colab dengan GPU gratis dan Ngrok.
- `src/App.tsx`: Routing, splash screen, startup update check.
- `src/pages/LandingPage.tsx`: Halaman utama aplikasi dengan integrasi navigasi tautan sosial dan akses ke *workspace* video.
- `src/pages/ManualDownloaderPage.tsx`: Halaman pengunduhan manual dengan dukungan kustomisasi resolusi.
- `src/components/ui/CanvasConfigControls.tsx`: UI selector mode canvas, color picker, blur level, image picker, & zoom slider.
- `src/components/ui/SubtitleConfigControls.tsx`: UI kontrol tipografi subtitle, preset warna, position selector, dan Live Preview simulator.
- `src/types/canvas.ts` & `src/types/subtitle.ts`: Interface TypeScript `CanvasConfig` dan `SubtitleConfig`.
- `src/locales/`: File terjemahan bilingual (`id.json`, `en.json`).
- `src-tauri/`: Tauri Rust backend & configuration (`tauri.conf.json`, `tauri.macos.conf.json`).
- `src-tauri/hooks.nsh`: NSIS preinstall script untuk kill zombie backend/app processes di Windows.
- `release-mac-intel.sh` & `docs/release-macos-intel.md`: Script dan panduan build rilis macOS Intel dengan updater artifacts.
- `docs/decisions/`: Architecture Decision Records (ADR-001 s/d ADR-011).
- `web/src/App.tsx`: Entry point untuk Web UI (Wizard flow & autentikasi).
- `web/src/components/HistoryList.tsx`: Menampilkan riwayat job, *Social Kit*, dan Rerender panel di Web UI.
- `web/src/components/ClipEditModal.tsx`: Modal Web UI untuk koreksi subtitle secara manual/AI dan *rerender* per klip.
