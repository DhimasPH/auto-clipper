# Local CDP Auto-Post Design Specification

## Context
Auto Clipper aims to help creators automate their short-form content workflow. Currently, the pipeline ends at video generation. To provide a complete end-to-end solution, we need an integration that auto-posts or schedules the rendered video clips ke 4 platform utama: **Instagram Reels, Facebook Reels, YouTube Shorts, dan TikTok**.

To avoid the complexities of official App Review processes, strict API limitations (like TikTok's Watermark API or YouTube's strict quota limits), and the security risk of storing OAuth secrets in a local desktop app, we are adopting a **Local Browser Automation via CDP (Chrome DevTools Protocol)** approach untuk keempat platform.

## 1. System Architecture

### 1.1 Local Browser Hijacking (CDP)
Aplikasi desktop (via backend FastAPI Python) akan memanfaatkan instalasi browser yang sudah ada di PC pengguna (Google Chrome atau Microsoft Edge).
1. **Locator**: Backend mendeteksi lokasi *executable* browser pengguna di OS.
2. **Launch**: Backend membuka browser dengan argumen `--remote-debugging-port=9222`.
3. **Connect**: Backend menggunakan pustaka `playwright` (khususnya fungsi `connect_over_cdp("http://localhost:9222")`) untuk mengontrol browser tanpa harus membuka instansiasi Chromium headless baru.

### 1.2 Session & Identity Management
Karena kita menggunakan browser lokal pengguna, aplikasi mewarisi sesi login (Cookies/Local Storage) dan alamat IP yang sudah biasa digunakan oleh pengguna di keempat platform tersebut.
- Jika pengguna belum login ke Meta Business Suite/Instagram/YouTube/TikTok, script automasi akan menghentikan alur dan meminta pengguna login secara manual di jendela browser yang terbuka.
- Tidak ada penyimpanan kredensial, token API, maupun App Secret di dalam *source code* atau *database* `history.db`.

## 2. Automasi Publikasi & Platform Logic

Konfigurasi CDP dan selektor elemen akan dipisahkan menjadi modul (adapter) tersendiri berdasarkan platform:
- `meta_publisher.py`: Mengontrol Web UI Instagram / Meta Business Suite (FB Reels).
- `youtube_publisher.py`: Mengontrol Web UI YouTube Studio (`studio.youtube.com`). Memilih "Shorts" secara default berdasarkan aspek rasio dan durasi.
- `tiktok_publisher.py`: Mengontrol Web UI TikTok Creator Center (`tiktok.com/upload`).

### 2.1 Proses Navigasi dan Upload
- Script Playwright akan membuka URL platform target.
- Script mensimulasikan klik pada form unggahan dan mengirimkan _absolute path_ dari file `.mp4` hasil render ke input `<input type="file">`.
- Script mengisi input teks (Caption) dengan Judul, Deskripsi, dan Hashtag viral yang telah dihasilkan oleh LLM sebelumnya pada tahap *highlight extraction*.

### 2.2 Proses Penjadwalan (Native Scheduling)
Alih-alih mengandalkan Cron Job lokal yang memaksa aplikasi Auto Clipper menyala 24/7, kita menggunakan fitur *Scheduling* asli milik platform sosial media. Semua 4 platform mendukung penjadwalan via web:
- **Meta/IG**: Mendukung penjadwalan di UI Business Suite.
- **YouTube**: Mendukung fitur *Schedule / Premiere* di YouTube Studio.
- **TikTok**: Mendukung fitur *Schedule video* (toggle) di Web UI (untuk akun bisnis/kreator).
Script akan menavigasi ke bagian pengaturan jadwal di web UI target, menginput tanggal & jam dari aplikasi, dan menekan tombol *Schedule*.

## 3. UI/UX (Frontend React)

### 3.1 Kontrol Publikasi
- Halaman **History**: Di setiap entri klip, ditambahkan sebuah aksi baru: tombol **"Publish"** atau ikon *Share*.
- **Publish Modal**: Saat diklik, modal ini memungkinkan pengguna:
  - Memilih **Platform Target** dengan *checkboxes* (Bisa pilih lebih dari satu, misal centang IG Reels, YT Shorts, dan TikTok sekaligus).
  - Mengonfirmasi/mengedit *Caption* (Teks + Hashtag). Masing-masing platform dapat memiliki batas karakter (misal YT judul 100 karakter, TikTok caption panjang) sehingga opsi penyesuaian khusus per-platform disediakan.
  - Memilih jadwal: **Publish Now** atau **Schedule for Later** (lengkap dengan *Date & Time picker*).

### 3.2 Feedback & Progress
Proses automasi UI (Puppeteer/Playwright) dapat memakan waktu 30-90 detik per platform. 
- Akan ditampilkan **Progress Overlay** dengan *Live Status Updates* yang di-streaming dari backend (Server-Sent Events).
- Contoh pesan status saat multi-platform:
  - `[1/3] YouTube: Mengunggah Video (45%)...` 
  - `[2/3] TikTok: Menyiapkan Jadwal...`
  - `[3/3] Instagram: Membuka Business Suite...`

## 4. Error Handling & Edge Cases
- **Browser Tidak Ditemukan / Port Bentrok**: Jika port 9222 sedang digunakan, sistem akan mencoba mencari port kosong (misalnya 9223, 9224).
- **Web UI Berubah**: Ini adalah risiko utama pendekatan CDP. Jika platform memperbarui tata letak *website* mereka, *Exception* Playwright (`TimeoutError`) akan terjadi. Modul *publisher* per-platform akan menangkap ini dan mengirim notifikasi kegagalan UI spesifik ke *frontend* agar pengguna dapat menyelesaikan publikasi di *tab* yang sedang terbuka secara manual.
- **Platform Limitations**: Jika jadwal yang dipilih melebihi batasan platform (misal TikTok hanya mengizinkan maksimal 10 hari ke depan), UI Frontend akan memvalidasi jadwal sebelum proses CDP dimulai.

## 5. Security & Isolation
- Port *debugging* hanya di-bind ke `localhost` (`127.0.0.1`).
- Semua script berjalan di komputer lokal; memastikan privasi sesi (cookie) dan integritas file render 100% terjaga dan aman.
