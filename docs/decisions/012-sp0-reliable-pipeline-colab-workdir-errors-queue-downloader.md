# ADR-012: Pipeline Andal di Colab (Work Dir, Snapshot Riwayat, Error Terstruktur, Antrean Job, Cookies, dan Strategi yt-dlp)

- **Status**: Accepted (pertanyaan terbuka di bagian 4 belum diputuskan)
- **Date**: 2026-11-18
- **Context**: SP0 "Pipeline andal dan cepat", rilis v1.18.0. Spec: `docs/superpowers/specs/2026-11-12-pipeline-stability-design.md`

---

## 1. Konteks & Masalah

Video YouTube 30 menit di Google Colab gratis berjalan lambat lalu gagal: runtime terputus, proses mati dengan `-9` (RAM habis), dan yt-dlp sering berhenti dengan "Sign in to confirm you're not a bot". Pengguna awam hanya melihat error mentah.

Temuan dari membaca kode (spec bagian 2, sebagian besar belum terukur):

1. Seluruh workspace Colab, termasuk video sumber, render, dan SQLite `history.db`, berada di mount Google Drive (`/content/drive/MyDrive/AutoClipperData`). Drive lambat untuk seek dan tulis acak, dan SQLite di atas FUSE berisiko rusak.
2. Setiap job membuat thread sendiri tanpa batas. Dua job (atau dua klik Resume) berarti dua Whisper dan dua render bersamaan di RAM 12 GB.
3. Error dilempar ke UI sebagai teks mentah. Tidak ada kode yang bisa dipetakan ke tindakan.
4. Rotasi client yt-dlp lama memakai bentuk `extractor_args` yang diabaikan yt-dlp, jadi permintaan yang sama diulang hingga 12 kali. Tidak ada cookies dan tidak ada JS runtime.
5. Fallback GPU ke CPU (Whisper), NVENC ke `libx264`, dan MediaPipe ke Haar terjadi diam-diam.

---

## 2. Keputusan Arsitektur

### A. Work dir vs pustaka, dengan publish atomik (`backend/workspace.py`)
- Dua tempat: **pustaka** (`AUTO_CLIPPER_WORKSPACE` / app data dir / folder output pilihan pengguna) menyimpan hasil yang harus bertahan; **work dir** (`AUTO_CLIPPER_WORK_DIR`) adalah disk lokal cepat untuk semua file antara (video sumber, audio, subtitle kerja, render, unggahan `/upload`).
- `AUTO_CLIPPER_WORK_DIR` kosong berarti perilaku lama (desktop tidak berubah). Notebook Colab mengaturnya ke `/content/work`; `backend/colab_api.py` juga menerima `--work-dir`.
- `get_project_workspace()` mengembalikan `project_dir` di work dir dan `library_dir` di pustaka. `workspace.publish()` menyalin klip, subtitle hasil edit, dan transkrip ke pustaka **setelah setiap klip dan di akhir job**, lewat `copy_atomic` (tulis ke `.<nama>.<acak>.part` di folder tujuan, lalu `os.replace`). Pembaca hanya melihat file lama atau file baru yang utuh. Di akhir job ditulis `metadata.json` tanpa API key.
- **Invarian: riwayat tidak pernah menunjuk ke path di work dir.** Setelah publish, `result_clips[].path`, `custom_subtitle_path`, dan `metadata.subtitle_path` diarahkan ke salinan di pustaka. Klip yang masih tercatat di work dir pada publish akhir dianggap gagal.
- Video sumber **tidak** dipublikasikan (besar). `jobs._restore_source_video` memulihkannya saat dibutuhkan (Resume, render ulang, AI Koreksi, resume manual): job URL diunduh ulang, job `local:` disalin ulang dari file asalnya, dan bila file asal juga hilang muncul `UPLOAD_MISSING`.
- Publish yang gagal mengakhiri job dengan `ERROR` (`PUBLISH_FAILED` atau `DISK_FULL`); Resume hanya menyalin ulang. Drive yang tidak ter-mount tidak menghentikan job, tetapi menambah `job["warnings"]`.

### B. `history.db` lokal dengan snapshot dan pemulihan (`backend/db.py`)
- Dengan work dir aktif, `history.db` dibuka di work dir. Snapshot ditulis ke `<pustaka>/history.db`, yaitu path lama, sehingga database lama di Drive otomatis menjadi snapshot pertama tanpa migrasi, dan run tanpa work dir membuka snapshot terbaru.
- Snapshot memakai API backup SQLite (konsisten walau sumber sedang ditulis) ke `.history.db.part`, lalu `os.replace`.
- Frekuensi: perubahan tahap dibatasi sekali per 5 detik (`SNAPSHOT_MIN_INTERVAL`) dengan satu penulisan susulan; status akhir (`DONE`, `ERROR`, `CANCELLED`, `AWAITING_MANUAL`) ditulis sebelum `save_history` kembali. Gagal menulis dicatat dan dicoba ulang (5 s, 30 s, 120 s).
- Startup: db lokal tidak ada → pulihkan dari snapshot; keduanya ada → lokal menang, job yang hanya ada di snapshot digabungkan. Snapshot tidak pernah ditimpa sebelum isinya dibaca sekali.
- Kait ada di lapisan db, jadi `jobs.py` tidak tahu soal snapshot.

### C. Error terstruktur (`backend/errors.py`)
- `AppError(code, technical)` diserialisasi ke `job["error_info"]` = `{code, title, message, title_en, message_en, actions: [{id, label, label_en}], technical}`. Judul dan pesan berbahasa awam (Indonesia default, Inggris), masing-masing menjawab apa yang terjadi, kenapa, dan harus apa. Teks asli hanya di `technical`.
- `classify_download_error()` memetakan error yt-dlp (urutan: disk penuh, rate limit, video tidak tersedia, sign-in); `to_app_error()` memetakan semua kegagalan job (OOM, ENOSPC, API key). Yang tidak dikenali menjadi `UNKNOWN`.
- Kedua frontend (`src/`, `web/`) merender satu `ErrorCard` generik dengan tombol aksi dari `actions` dan "Detail teknis" yang tertutup. Teks error tidak di-hardcode di frontend.

### D. Satu antrean job berat (`backend/job_queue.py`)
- **Invarian: semua thread job di `jobs.py` dimulai lewat `jobs._start_job()` → `job_queue.submit()`.** Tidak ada `threading.Thread` langsung untuk job.
- `AUTO_CLIPPER_MAX_HEAVY_JOBS` slot (default 1, desktop boleh lebih). FIFO; job memegang slot sampai thread-nya benar-benar selesai, termasuk saat error atau batal. `queue_position` ditampilkan UI ("Menunggu giliran"). Job yang dibatalkan saat mengantre langsung dibuang. Resume kedua untuk proyek yang masih antre/berjalan ditolak.
- Begitu mendapat slot, job menjalankan pemeriksaan preflight yang bisa memblokir (FFmpeg, disk). Hasil `block` menjadi `AppError` sebelum pekerjaan dimulai.

### E. `cookies.txt` (`backend/cookies.py`)
- Satu file per instalasi di `<app data>/cookies/cookies.txt` (endpoint `GET/POST/DELETE /api/settings/cookies`). Di Colab app data adalah `AUTO_CLIPPER_WORKSPACE`, jadi file berada di Google Drive pengguna (`AutoClipperData/cookies/`) dan bertahan antar sesi.
- Validasi sebelum disimpan: UTF-8, maks. 1 MiB, format Netscape, ada cookie `youtube.com`, belum semuanya kedaluwarsa, dan bisa dimuat `YoutubeDLCookieJar` milik yt-dlp terpasang. File disimpan dalam bentuk yang sudah dibersihkan, lewat `mkstemp` + `os.replace`.
- yt-dlp tidak pernah menerima file asli: `ytdlp_cookiefile()` memberi **salinan kerja** di `<tempdir>/auto-clipper-cookies/` (bukan di Drive, karena file terhapus di Drive tinggal di Sampah), karena yt-dlp menulis ulang cookie file saat ditutup. Salinan dikosongkan lalu dihapus setelah unduhan. Hapus cookies juga mengosongkan file sebelum menghapusnya dan membersihkan salinan sisa.
- **Isi cookie tidak pernah ditulis ke log, ke error, atau ke respons API.** `get_status()` hanya mengembalikan jumlah, status login, tanggal kedaluwarsa, dan waktu unggah.

### F. Urutan client yt-dlp, Deno, dan EJS (`backend/video_utils.py`)
- `PLAYER_CLIENT_ORDER = (None, "web_embedded", "android_vr")`: pilihan bawaan yt-dlp dulu (mengikuti client yang sedang dilayani YouTube), lalu dua cadangan, masing-masing **sekali**.
- Berhenti tanpa mencoba client lain untuk `VIDEO_UNAVAILABLE`, `YT_RATE_LIMITED`, `DISK_FULL`, dan untuk `YT_SIGNIN_REQUIRED` bila cookies sudah dikirim (melindungi akun). `android_vr` dijalankan tanpa cookies karena yt-dlp tidak mendukung cookies login di client itu. Error akhir selalu `AppError` dari kegagalan pertama yang punya kode dikenal.
- Deno dicari hanya dengan `shutil.which("deno")` (`preflight._deno_path`). Bila ada: `js_runtimes={'deno': {'path': ...}}` dan `remote_components=['ejs:github']`, sehingga yt-dlp mengunduh skrip pemecah tantangan (EJS) dari rilis GitHub `yt-dlp/ejs`, memeriksa hash-nya, lalu menyimpannya di cache. Tanpa Deno kedua opsi tidak diset dan yt-dlp memilih sendiri.
- Notebook Colab memasang Deno dengan skrip resmi `curl -fsSL https://deno.land/install.sh | DENO_INSTALL=/usr/local sh` ke `/usr/local/bin` (sudah di `PATH`). Gagal pasang tidak menghentikan notebook; preflight melaporkan `deno` sebagai `warn`.
- Format default dibatasi H.264 hingga 1080p (`quality_to_format`); 1440p/2160p tetap bisa diminta.

### G. Preflight dan laporan waktu
- `backend/preflight.py`: `run_preflight()` → daftar `{id, level: ok|warn|block, title, message, ...}` untuk FFmpeg, disk (pustaka dan work dir), RAM, GPU CUDA, NVENC, Drive, Deno, umur yt-dlp; endpoint `GET /api/preflight`. Pemeriksaan yang crash menjadi `warn`, tidak pernah `block`.
- Notebook menampilkan hasilnya sebelum server menyala lewat `scripts/colab_preflight.py` (memakai `run_preflight()` langsung, tanpa token API dan tanpa menunggu server).
- `backend/stage_timer.py` mencatat `{stage, seconds, rss_mb_peak}` per tahap ke `metadata["timings"]` dan log aplikasi, beserta `whisper_device`, `encoder`, `tracking_engine_used`. UI menampilkannya sebagai "Detail waktu".

---

## 3. Dampak & Konsekuensi

- **Positif**:
  - Hasil (klip, subtitle, riwayat) bertahan saat runtime Colab mati, tanpa file setengah jadi di Drive.
  - Satu job berat dalam satu waktu menutup jalur OOM karena job paralel.
  - Setiap kegagalan yang dikenali punya pesan awam dan tombol tindakan; fallback perangkat terlihat di preflight dan Detail waktu.
- **Negatif / biaya**:
  - Video sumber hilang bersama work dir; Resume di sesi baru mengunduh ulang (bisa kena verifikasi YouTube lagi), dan unggahan langsung harus diunggah ulang.
  - Snapshot menyalin seluruh database setiap kali (ukuran dan lamanya belum diukur). Perubahan tahap ±5 detik sebelum runtime dimatikan paksa bisa tidak masuk snapshot; job yang dihapus bisa muncul lagi bila proses mati ±5 detik setelah penghapusan.
  - `remote_components=['ejs:github']` membuat unduhan bergantung pada akses ke GitHub saat berjalan.
  - Antrean membuat job kedua menunggu walau mesin sanggup (dapat dinaikkan dengan `AUTO_CLIPPER_MAX_HEAVY_JOBS`).
- **Belum terbukti** (butuh sesi Colab nyata): kecepatan sebelum/sesudah (spec bagian 7 masih kosong), `os.replace` dan file `.part` di mount Drive, apakah Drive sempat mengunggah snapshot sebelum runtime mati, apakah Deno + EJS + client cadangan lolos pemeriksaan YouTube, dan apakah notebook berjalan dari awal sampai akhir di Colab bersih.
- **Verifikasi**: `backend/tests/` (`test_workspace.py`, `test_db.py`, `test_errors.py`, `test_error_integration.py`, `test_job_queue.py`, `test_jobs_queue_integration.py`, `test_cookies.py`, `test_video_utils.py`, `test_preflight.py`, `test_stage_timer.py`, `test_colab_api.py`, `test_colab_preflight_script.py`) lulus seluruhnya.

---

## 4. Pertanyaan Terbuka (belum diputuskan pemilik)

1. **Lokasi `cookies.txt` di Colab**: sekarang di Google Drive (bertahan antar sesi, tetapi bukan "lokal" seperti kata spec 4.6). Alternatif: simpan di work dir dan unggah ulang tiap sesi. Teks UI `cookies.privacy` menyebut "disimpan di server tempat aplikasi berjalan (Google Colab)", yang tidak menyebut Drive.
2. **Akses file lewat token API**: siapa pun yang memegang token bisa membaca file di app data lewat `POST /save_file` dan `/video`, termasuk `cookies.txt`. Perlu task pengerasan tersendiri.
3. **`android_vr` butuh PO Token** di yt-dlp terpasang (format di-403 sejak 2026.08.17), jadi cadangan ini lemah. `visionos` tidak butuh PO Token, tetapi spec menyebut `android_vr`.
4. **EJS dari GitHub vs paket `yt-dlp-ejs`**: alternatifnya memasang `yt-dlp-ejs` di `requirements.txt`, build PyInstaller, dan notebook agar tidak bergantung pada GitHub saat berjalan. Notebook masih `pip install -U yt-dlp` saja.
5. **Sign-in saat cookies terpasang** langsung berhenti tanpa mencoba ulang secara anonim; "HTTP Error 403" juga terklasifikasi sebagai sign-in sehingga ikut berhenti.
6. **Preflight di frontend**: hasil `GET /api/preflight` belum ditampilkan di UI mana pun (hanya di output notebook). Job AI ulang dan render ulang satu klip belum menampilkan timings/warnings secara langsung.
7. **Pemeriksaan Drive**: `preflight._drive_mounted` hanya memeriksa folder `/content/drive/MyDrive`, yang bisa ada di disk lokal bila backend membuat folder pustaka sebelum Drive di-mount. `scripts/colab_preflight.py` memeriksa titik mount, backend belum.
8. **Data lain yang masih di Drive**: log (`backend_error.log` dkk.), cache editor manual (`metadata.py`), dan `jobs.get_temp_dir()` masih di app data dir. Tidak rusak, hanya masih membayar lambatnya Drive.
9. **`backend/metadata.py`** masih membuat thread langsung (di luar antrean). Cakupan T0.4 hanya `jobs.py`.
10. **Pendekatan B** (pelacakan wajah satu-kali-baca) dan proxy 720p menunggu angka dari T0.14 (gerbang T0.15).
