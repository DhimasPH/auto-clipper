# Product Requirements Document (PRD) - Auto Clipper

## 1. Product Vision

Menjadi asisten editing video pribadi bagi setiap kreator konten, yang secara otomatis, cerdas, dan cepat menghasilkan _short-form content_ berkualitas viral langsung dari komputer pengguna tanpa biaya langganan, dengan kontrol tambahan yang diperlukan oleh kreator.

## 2. Fitur Utama (Core Features)

### 2.1 Video Input & Integration

- **Input Fleksibel**: Pengguna dapat memasukkan URL video YouTube atau mengunggah file video lokal (.mp4, .mov, dll).
- **Proses**: Sistem akan mengunduh video dengan kualitas optimal dari YouTube menggunakan `yt-dlp`, atau langsung memproses video lokal tanpa membebani kuota internet.

### 2.2 Smart Job Management & Pipelines

- **Pipelines**: Menyediakan pipeline terintegrasi untuk otomatisasi penuh (Auto AI), penyesuaian durasi/batas klip secara manual, dan proses re-render secara efisien.
- **Project Workspaces**: Mengisolasi semua aset hasil pemrosesan (video mentah, file subtitle `.ass`, dan potongan klip `.mp4`) ke dalam direktori khusus per _project/job_ untuk mencegah tercampurnya file antar proyek.
- **Sleep Prevention (BusyOverlay)**: Sistem mencegah OS untuk _sleep_ atau _hibernate_ secara agresif selama pemrosesan latar belakang, memastikan proses yang memakan waktu lama selesai tanpa gangguan.
- **OS Notifications**: Memberikan notifikasi sistem (_native OS notifications_) kepada pengguna saat suatu job/tugas selesai, menggantikan notifikasi web konvensional.

### 2.3 AI Highlight Extraction & Metadata

- **Proses**: Menganalisis transkripsi (menggunakan Whisper) dengan LLM untuk mendeteksi segmen video yang paling menarik, emosional, atau memiliki retensi tinggi. Sistem menggunakan **AI Provider Registry** yang memungkinkan dynamic model fetching (Gemini, OpenAI, dll) berdasarkan preferensi/kunci API pengguna, dengan mekanisme _retry logic_ agar pemrosesan tidak mudah gagal.
- **Output**: Kandidat video pendek (15-60 detik) beserta transkripsi, serta Metadata Media Sosial (Judul viral, Deskripsi menarik, dan hashtag relevan).

### 2.4 Smart Auto-Cropping & Canvas Background Styling

- **Input**: Klip video (Sistem akan secara otomatis melakukan deteksi _Landscape_ vs _Portrait_ sebelum pemrosesan).
- **Mode Pemrosesan**:
  - **Dynamic Face-Tracking**: Untuk video _Landscape_ berfokus pada pembicara tunggal, sistem menggunakan OpenCV untuk melacak wajah dan menggeser kamera secara halus di komposisi 9:16.
  - **Landscape-to-Portrait Canvas Styling**: Untuk video lanskap yang ingin mempertahankan seluruh frame 16:9 tanpa _cropping_ (misalnya slide presentasi, podcast multi-orang, gameplay). Video dipusatkan di atas kanvas 9:16 dengan 3 opsi latar belakang:
    - _Blurred Background_: Latar belakang video di-crop ke 9:16 dan di-blur menggunakan Gaussian filter (`boxblur`) dengan preset intensitas _Light_, _Medium_, atau _Heavy_.
    - _Solid Color Background_: Latar belakang warna solid elegan (preset Slate, Navy, Gray, Black, White, atau Custom Hex).
    - _Custom Image Background_: Latar belakang gambar dari file lokal pengguna (.jpg, .png, .webp).
  - **Foreground Zoom / Enlarge**: Pilihan skala pembesaran video foreground (1.0x, 1.2x, 1.5x, 1.8x, 2.0x) secara proporsional di tengah kanvas.
- **Output**: Video vertikal 9:16 yang dinamis atau video kanvas berlatar estetis siap pakai.

### 2.5 Auto-Subtitling & Adaptive Positioning

- **Proses**: Teks di-_burn-in_ langsung ke video melalui FFmpeg dengan pengaturan rendering (_bitrate, framerate_) yang optimal. Sistem secara otomatis mengatur posisi vertikal margin (_Adaptive Subtitle Margin_) saat mode kanvas aktif agar teks muncul di ruang kosong bawah video tanpa menutupi visual utama. Sistem akan mencoba melakukan **Hardware Acceleration (NVENC)** terlebih dahulu, dan secara otomatis melakukan _safe fallback_ ke CPU (`libx264`) jika proses _hardware encoding_ gagal atau tidak didukung.
- **Output**: File akhir `.mp4` siap unggah.

### 2.6 Internationalization (i18n)

- **Proses**: Aplikasi mendukung pengaturan bahasa antarmuka (saat ini Bahasa Inggris dan Indonesia) untuk mengakomodir kebutuhan kreator lokal dan global.

## 3. User Flow

1. **Launch**: Pengguna membuka aplikasi desktop Auto Clipper.
2. **Input & Aspect Ratio**: Pengguna menempelkan URL YouTube atau memilih file video lokal, lalu memilih rasio aspek target (9:16 Vertical atau 16:9 Landscape dengan opsi Canvas Background Styling & Zoom).
3. **Workflow Selection**: Pengguna dapat memilih mode otomatisasi (**AI-driven**) atau mode seleksi manual (**Manual Editor**).
4. **Processing (Background)**:
   - Sistem memulai Job dan mengisolasi aset di dalam _Project Workspace_ baru. _System Sleep Prevention_ diaktifkan.
   - Sistem melakukan deteksi layout video, ekstraksi audio, dan terjemahan ke teks (Whisper).
   - _Hanya pada AI mode_: Sistem mendeteksi highlight momen dan mengkalkulasi Metadata Sosial (LLM).
5. **Intervention (Opsional / Wajib untuk Manual Mode)**: Pengguna meninjau highlight yang ditemukan AI, atau membuat/mengedit klip secara manual. Pengguna juga dapat menyesuaikan durasi (_fine-tuning_) sebelum meneruskan ke tahap _render_.
6. **Rendering**: Sistem melakukan _face-tracking crop_ atau _canvas background styling_, serta _burn-in_ subtitle adaptif secara optimal (NVENC dengan fallback CPU).
7. **Result & Smart Re-render**: Pengguna mendapatkan **Native OS Notification** yang menandakan kesuksesan, dialihkan ke halaman History, dan dapat langsung membuka file hasil rilis `.mp4` atau melakukan _Re-render_ dengan rasio/gaya kanvas baru kapan saja.

## 4. Technical Architecture Overview

- **Frontend**: Tauri, React, Vite, Tailwind CSS. Berfungsi sebagai UI yang modern, interaktif (multi-bahasa), dan reaktif.
- **Backend / Sidecar (FastAPI)**: Memanfaatkan Python (ter-bundle dengan PyInstaller) yang bertindak sebagai Server API Lokal (FastAPI). Backend mengelola Database SQLite untuk riwayat dan antrean Job, memuat pustaka FFmpeg, downloader, dan modul pengolah AI.
- **Komunikasi**: Komunikasi berjalan via protokol HTTP (REST API) dari Frontend Tauri ke port FastAPI lokal di _backend_, diamankan menggunakan token keamanan internal (API*SECRET_TOKEN) saat environment \_production*.

## 5. System Requirements

- **OS**: Windows 10/11 (64-bit), macOS 12+, Linux Ubuntu 22.04+
- **CPU**: Intel Core i5 Gen-8 / AMD Ryzen 5 ke atas.
- **RAM**: Minimal 8 GB (16 GB sangat direkomendasikan).
- **Koneksi**: Diperlukan koneksi internet stabil (kecuali saat memproses file lokal secara offline jika tidak menggunakan API eksternal untuk LLM).

## 6. Future Enhancements (Backlog)

- _Multi-speaker face-tracking_ (membuat format _split-screen_ atas-bawah saat ada dua narasumber berbicara bersamaan dalam layar yang sama).
- Integrasi _auto-post_ ke YouTube Shorts, TikTok, Facebook dan Instagram Reels.
- Revamp/Redesign UI/UX lebih user friendly, modern dan enterprise-level.
- Subtitle support translate multi bahasa. Contoh video yang di klip bahasa inggris, tapi di subtitle bahasa indonesia.
- Tambahkan konfigurasi untuk bebas mengatur posisi subtitle (X dan Y axis) pada setiap clip.
- Pembuatan Hook di awal video
- Penambahan Cinematic effect
- Pembuatan thumbnail dari hasil clip video tiap clip
