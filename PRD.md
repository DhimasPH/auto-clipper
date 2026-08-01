# Product Requirements Document (PRD) - Auto Clipper

## 1. Product Vision
Menjadi asisten editing video pribadi bagi setiap kreator konten, yang secara otomatis, cerdas, dan cepat menghasilkan *short-form content* berkualitas viral langsung dari komputer pengguna tanpa biaya langganan, dengan kontrol tambahan yang diperlukan oleh kreator.

## 2. Fitur Utama (Core Features)

### 2.1 Video Input & Integration
- **Input Fleksibel**: Pengguna dapat memasukkan URL video YouTube atau mengunggah file video lokal (.mp4, .mov, dll).
- **Proses**: Sistem akan mengunduh video dengan kualitas optimal dari YouTube menggunakan `yt-dlp`, atau langsung memproses video lokal tanpa membebani kuota internet.

### 2.2 Smart Job Management & Pipelines
- **Pipelines**: Menyediakan pipeline terintegrasi untuk otomatisasi penuh (Auto AI), penyesuaian durasi/batas klip secara manual, dan proses re-render secara efisien.
- **Sleep Prevention (BusyOverlay)**: Sistem mencegah OS untuk *sleep* atau *hibernate* secara agresif selama pemrosesan latar belakang, memastikan proses yang memakan waktu lama selesai tanpa gangguan.
- **OS Notifications**: Memberikan notifikasi sistem (*native OS notifications*) kepada pengguna saat suatu job/tugas selesai, menggantikan notifikasi web konvensional.

### 2.3 AI Highlight Extraction & Metadata
- **Proses**: Menganalisis transkripsi (menggunakan Whisper) dengan LLM untuk mendeteksi segmen video yang paling menarik, emosional, atau memiliki retensi tinggi. Dibangun dengan mekanisme *retry logic* agar pemrosesan tidak mudah gagal.
- **Output**: Kandidat video pendek (15-60 detik) beserta transkripsi, serta Metadata Media Sosial (Judul viral, Deskripsi menarik, dan hashtag relevan).

### 2.4 Smart Auto-Cropping (Face-Tracking)
- **Input**: Klip video lanskap (16:9).
- **Proses**: Menggunakan OpenCV untuk mendeteksi wajah pembicara di setiap frame dan mempertahankan wajah tersebut berada di tengah komposisi vertikal (9:16).
- **Output**: Video vertikal yang dinamis (kamera mengikuti pergerakan subjek).

### 2.5 Auto-Subtitling & One-Click Export
- **Proses**: Teks di-*burn-in* langsung ke video melalui FFmpeg dengan pengaturan rendering (*bitrate, framerate*) yang optimal.
- **Output**: File akhir `.mp4` siap unggah.

### 2.6 Internationalization (i18n)
- **Proses**: Aplikasi mendukung pengaturan bahasa antarmuka (saat ini Bahasa Inggris dan Indonesia) untuk mengakomodir kebutuhan kreator lokal dan global.

## 3. User Flow
1. **Launch**: Pengguna membuka aplikasi desktop Auto Clipper.
2. **Input**: Pengguna menempelkan URL YouTube atau memilih file video lokal.
3. **Processing (Background)**: 
   - Sistem memulai Job (di-manage oleh Job Scheduler internal). *System Sleep Prevention* diaktifkan.
   - Sistem melakukan ekstraksi audio dan terjemahan ke teks (Whisper).
   - Sistem mendeteksi highlight momen dan mengkalkulasi Metadata Sosial (LLM).
   - Sistem melakukan analisa *face-tracking*.
4. **Intervention (Opsional)**: Pengguna dapat meninjau highlight yang ditemukan AI, menggeser batas durasi klip (*fine-tuning* manual), lalu meneruskan ke tahap *render*.
5. **Rendering**: Teks subtitle di-*burn-in* dan video di-*crop*.
6. **Result**: Pengguna mendapatkan **Native OS Notification** yang menandakan kesuksesan, dialihkan ke halaman History, dan dapat langsung membuka file hasil rilis `.mp4`.

## 4. Technical Architecture Overview
- **Frontend**: Tauri, React, Vite, Tailwind CSS. Berfungsi sebagai UI yang modern, interaktif (multi-bahasa), dan reaktif.
- **Backend / Sidecar (FastAPI)**: Memanfaatkan Python (ter-bundle dengan PyInstaller) yang bertindak sebagai Server API Lokal (FastAPI). Backend mengelola Database SQLite untuk riwayat dan antrean Job, memuat pustaka FFmpeg, downloader, dan modul pengolah AI.
- **Komunikasi**: Komunikasi berjalan via protokol HTTP (REST API) dari Frontend Tauri ke port FastAPI lokal di *backend*, diamankan menggunakan token keamanan internal (API_SECRET_TOKEN) saat environment *production*.

## 5. System Requirements
- **OS**: Windows 10/11 (64-bit), macOS 12+, Linux Ubuntu 22.04+
- **CPU**: Intel Core i5 Gen-8 / AMD Ryzen 5 ke atas.
- **RAM**: Minimal 8 GB (16 GB sangat direkomendasikan).
- **Koneksi**: Diperlukan koneksi internet stabil (kecuali saat memproses file lokal secara offline jika tidak menggunakan API eksternal untuk LLM).

## 6. Future Enhancements (Backlog)
- Preset kustomisasi visual subtitle (warna, font, gaya animasi seperti model font viral Alex Hormozi).
- *Multi-speaker face-tracking* (membuat format *split-screen* atas-bawah saat ada dua narasumber berbicara bersamaan dalam layar yang sama).
- Integrasi *auto-post* ke YouTube Shorts, TikTok, dan Instagram Reels.
