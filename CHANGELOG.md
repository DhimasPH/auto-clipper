# Changelog

Semua perubahan yang signifikan pada proyek ini akan didokumentasikan di file ini.

## [1.18.0] - 2026-11-18

Rilis SP0 (pipeline andal). Belum ada pengukuran kecepatan sebelum dan sesudah perubahan ini, jadi tidak ada klaim "lebih cepat" di bawah. Versi 1.17.2 sampai 1.17.4 tidak tercatat di file ini.

### Added
- **Kartu Error yang Bisa Ditindaklanjuti**: Kegagalan kini tampil sebagai kartu berisi judul dan penjelasan dalam bahasa awam (Indonesia dan Inggris) beserta tombol aksi, misalnya **Unggah cookies.txt**, **Pilih video dari Google Drive** (web), **Lanjutkan**, atau **Buka Pengaturan** (desktop). Pesan asli error tersimpan di **Detail teknis** yang tertutup secara bawaan, lengkap dengan tombol **Salin**. Berlaku di aplikasi desktop dan Web UI.
- **Unggah `cookies.txt` YouTube**: Saat YouTube meminta verifikasi, pengguna bisa mengunggah `cookies.txt` dari kartu error atau dari halaman Pengaturan. File diperiksa (format, cookie YouTube, masa berlaku, ukuran maks. 1 MB), statusnya ditampilkan ("Berlaku sampai ..."), dan bisa dihapus. Panduan 3 langkah dan peringatan "pakai akun cadangan, bukan akun utama" tampil di panel yang sama.
- **Detail Waktu**: Setiap job mencatat lama dan memori puncak tiap tahap (unduh, ambil audio, subtitle, analisis AI, pelacakan wajah, render per klip, simpan ke penyimpanan) serta perangkat yang benar-benar dipakai (GPU atau prosesor untuk subtitle dan render, mode pelacakan wajah). Ditampilkan sebagai **Detail waktu** di hasil job dan di Riwayat.
- **Antrean Job**: Hanya satu job berat yang berjalan dalam satu waktu (atur dengan `AUTO_CLIPPER_MAX_HEAVY_JOBS`). Job berikutnya menampilkan "Menunggu giliran" beserta urutannya, bisa dibatalkan selama menunggu, dan menekan Lanjutkan dua kali pada proyek yang masih diproses ditolak dengan pesan jelas.
- **Pemeriksaan Awal (Preflight)**: Backend memeriksa FFmpeg, ruang disk, memori, GPU, encoder GPU, Google Drive, Deno, dan umur pengunduh video (`GET /api/preflight`). FFmpeg yang hilang atau disk yang hampir penuh menghentikan job sebelum mulai dengan pesan jelas.
- **Halaman Pengaturan di Web UI** (`/settings`): Berisi panel Cookies YouTube dan pilihan bahasa untuk pesan error, panduan cookies, dan detail waktu.
- **Notebook Colab**: Memasang Deno (dengan skrip pemasangan resmi; bila gagal, notebook memberi tahu lalu tetap lanjut) dan menampilkan **Pemeriksaan awal** dalam bahasa Indonesia sebelum server menyala (`scripts/colab_preflight.py`).
- **Skrip Benchmark** (`scripts/benchmark_pipeline.py`): Menjalankan satu video lewat pipeline asli lalu mencetak tabel waktu dan memori per tahap.

### Changed
- **Disk Kerja Lokal di Colab**: Notebook kini menjalankan backend dengan `AUTO_CLIPPER_WORK_DIR=/content/work`. Video sumber, audio, dan render dikerjakan di disk lokal Colab, lalu setiap klip yang selesai beserta file subtitle disalin ke Google Drive dengan cara aman (nama sementara lalu rename, sehingga tidak pernah ada klip setengah jadi di Drive). Video sumber tidak lagi disimpan di Drive. Tanpa `AUTO_CLIPPER_WORK_DIR` (aplikasi desktop) perilakunya tidak berubah.
- **Riwayat (`history.db`) di Disk Lokal dengan Cadangan ke Drive**: Di Colab, database riwayat dibuka di disk kerja dan dicadangkan ke `AutoClipperData/history.db` di Drive (status akhir job langsung, perubahan lain paling sering sekali per 5 detik). Saat server dinyalakan di sesi baru, riwayat dipulihkan otomatis dari Drive. Database lama di Drive terbaca tanpa langkah migrasi.
- **Melanjutkan Proyek setelah Sesi Colab Berakhir**: Lanjutkan, render ulang, AI Koreksi, dan resume manual kini mengambil kembali video sumber yang hilang bersama disk kerja: video dari URL diunduh ulang, video dari Google Drive disalin ulang. Bila video unggahan sudah tidak ada, muncul pesan "File video yang diunggah sudah tidak ada" alih-alih error mentah.
- **Kualitas Unduhan Bawaan**: Pilihan "terbaik" kini berarti H.264 MP4 hingga 1080p (label "Otomatis (hingga 1080p)"), bukan AV1/VP9 hingga 4K yang berat di-decode. Resolusi 1440p dan 2160p tetap bisa dipilih.
- **Strategi Pengunduh YouTube**: yt-dlp mencoba pilihan client bawaannya, lalu `web_embedded`, lalu `android_vr`, masing-masing sekali. Bila Deno terpasang, yt-dlp memakainya untuk tantangan JavaScript YouTube beserta komponen EJS dari GitHub. Error yang tidak bisa ditolong client lain (video tidak tersedia, rate limit, disk penuh, verifikasi saat cookies sudah dipakai) langsung dihentikan.
- **Notebook Colab Lebih Jujur**: Notebook tidak lagi mengklaim render NVENC. FFmpeg dari Ubuntu dipakai apa adanya; render memakai GPU hanya bila runtime menyediakannya, dan hasilnya terlihat di Pemeriksaan awal.
- **Dokumentasi**: `docs/panduan-penggunaan-awam.md` dan `docs/tutorial-auto-clipper-cloud.md` diperbarui (verifikasi YouTube dan cookies, disk kerja sementara, apa yang aman saat sesi Colab mati, arti "Menunggu giliran", letak Detail waktu dan Detail teknis). ADR-012 mencatat keputusan arsitektur SP0.

### Fixed
- **Rotasi Client YouTube yang Tidak Pernah Bekerja**: Kode lama memakai bentuk `extractor_args` yang diabaikan yt-dlp, sehingga permintaan yang sama diulang sampai 12 kali tanpa berganti client. Kini setiap percobaan benar-benar memakai client yang berbeda.
- **Error Unduhan Mentah**: Pesan yt-dlp seperti "Sign in to confirm you're not a bot" atau "HTTP Error 403" tidak lagi tampil mentah; semuanya dipetakan ke kode error dengan pesan awam.
- **MediaPipe Face Tracking**: `FaceMesh` dibuat sekali per panggilan dan selalu ditutup, juga saat terjadi error. Kegagalan MediaPipe dicatat ke log beserta alasannya (sebelumnya ditelan diam-diam), bila MediaPipe gagal di tengah jalan OpenCV Haar melanjutkan dari frame itu tanpa mengulang sampling dari awal, dan mode yang benar-benar dipakai tercatat di Detail waktu.
- **Fallback GPU yang Diam-Diam**: Transkripsi yang jatuh ke CPU dan render yang jatuh ke `libx264` kini terlihat di Pemeriksaan awal dan Detail waktu.
- **Job Paralel yang Menghabiskan RAM**: Dua job (atau dua klik Lanjutkan) tidak lagi menjalankan dua transkripsi atau dua render bersamaan.
- **Penghalusan Gerak Kamera**: `smooth_trajectory`, `apply_deadband_filter`, dan `build_dynamic_crop_filter` kini menerima titik `(waktu, x, lebar wajah)` yang memang dihasilkan pelacak wajah.

## [1.17.1] - 2026-10-01

### Fixed
- **Robust Colab Transcriber**: Menambahkan penangkal (*monkey-patch*) pada kode internal `ai_utils` untuk memastikan `faster-whisper` kebal terhadap masalah `metadata_errors` di lingkungan (environment) Google Colab dengan versi PyAV (`av`) yang tertinggal atau terkunci di memori.
- **Colab Notebook Updater**: Menyesuaikan mekanisme Colab Notebook agar otomatis melakukan sinkronisasi (`git pull`) kode terbaru jika folder *repository* sudah eksis dari sesi sebelumnya, mencegah *stale code*.

## [1.17.0] - 2026-10-01

### Added
- **Web Frontend**: Menginisialisasi antarmuka Web murni (Cloud UI) menggunakan ekosistem React 18, Vite, dan Tailwind CSS untuk melengkapi pengalaman pengguna di luar Desktop/Tauri.

### Fixed
- **Colab/Cloud Transcriber**: Memperbaiki masalah *crash* tak terduga (*TypeError*) pada `faster-whisper` di Google Colab dengan mengunci (pin) dependensi library PyAV (`av>=11.0.0`).

## [1.16.1] - 2026-09-27

### Fixed
- **Karaoke Pop Animation**: Memperbaiki animasi *zoom* (pop) pada mode teks *Karaoke* di *Live Preview* antarmuka pengguna agar selaras dengan hasil *render* backend. Animasi kini menggunakan CSS keyframes yang ringan, responsif, dan representatif. Latar belakang *Live Preview* juga diubah menjadi pola papan catur (*checkerboard*) agar terlihat kontras pada warna apa pun.
- **Backend ASS Generator**: Menambahkan efek tag ASS \t *scaling* spesifik pada kata yang di-highlight saat opsi animasi Pop diaktifkan pada mode *Karaoke*.


## [1.16.0] - 2026-09-26

### Added
- **AI Virality Score**: Menambahkan metrik potensi keterlibatan penonton / *virality score* (1-10) untuk setiap rekomendasi highlight dari AI. Skor ini juga ditampilkan secara visual (*badge*) di atas setiap kartu klip hasil.

### Changed
- **Antislop UI Refactor**: Mendesain ulang antarmuka (Web dan Desktop) untuk membersihkan gradien dekoratif (*slop*), bayangan berlebihan, perputaran animasi tanpa henti (seperti *ping* status), dan simbol *emoji* tidak penting di dalam komponen interaktif. Antarmuka kini tampil lebih datar (*flat*), solid, bersih, profesional, serta tata letak kata (copywriting) dibuat faktual sesuai panduan *antislop*.

## [1.15.6] - 2026-09-24

### Changed
- **Loading UI Refactor**: Menghapus bar persentase (progress slider) fiktif pada layar loading (BusyOverlay) yang sering disalahpahami berhenti (stuck) di 50%. Menggantinya dengan ikon loading berputar statis (*indeterminate spinner*) dengan detail langkah aktual dari backend dan timer durasi waktu berjalan.
- **Documentation**: Menambahkan buku panduan baru versi non-teknis / awam (`docs/panduan-penggunaan-awam.md`) untuk pengoperasian sistem Auto Clipper Cloud melalui perangkat *smartphone*, yang memuat dukungan dua tipe tunnel (Ngrok & Cloudflare) beserta panduan penanganan masalah (*troubleshooting*) yang lebih komprehensif.

## [1.15.5] - 2026-09-17

### Fixed
- **Google Colab Restart 404 & Loss of Job State**:
  - Mengimplementasikan *multi-stage milestone persistence* ke SQLite (`history.db`) seketika saat job dibuat (`PENDING`) dan di setiap fase transisi (`DOWNLOADING`, `TRANSCRIBING`, `ANALYZING`, `CROPPING`), sehingga backend tidak lagi mengembalikan status 404 saat Google Colab me-restart engine/session.
  - Memperbarui `fix_stuck_jobs` untuk mendeteksi seluruh proses terputus (termasuk status `ANALYZING`) dan menyuntikkan pesan error deskriptif pada metadata.
  - Menambahkan endpoint client `apiResumeJob` dan tombol aksi **"Lanjutkan (Resume)"** pada Web UI (`web/`) di kartu error Workspace dan halaman History agar pengguna dapat melanjutkan pemrosesan video yang terputus langsung dari artefak lokal/Drive tanpa mengulang dari awal.
  - Menambahkan fallback re-download otomatis pada fungsi resume jika file video belum selesai diunduh sebelum restart terjadi.
  - Menyelaraskan Desktop UI (`src/lib/history.ts`, `src/hooks/useClipJobs.ts`, `src/components/BusyOverlay.tsx`) dengan dukungan status `ANALYZING` dan aktivasi tombol resume berbasis URL jika file lokal belum tersimpan.
  - Memperbaiki `create_resume_job` agar mempertahankan provider `"manual"` (mode tanpa BYOK API Key) dan tidak memaksakan fallback ke `"gemini"` yang menyebabkan error `No API key was provided`. Alur resume manual kini otomatis melanjutkan transkripsi lokal dan beralih ke status `AWAITING_MANUAL`.

## [1.15.4] - 2026-09-17

### Fixed
- **Google Colab OOM & Process Crash (-9)**:
  - Mengimplementasikan *explicit memory release* (`del model`, `gc.collect()`, `torch.cuda.empty_cache()`) seketika setelah transkripsi Whisper selesai, membebaskan 1-3 GB RAM/VRAM sebelum proses rendering klip dimulai.
  - Melakukan downscale resolusi frame (lebar 640px) pada deteksi wajah MediaPipe FaceMesh & OpenCV Haar Cascade, menghemat pemakaian RAM hingga 90% tanpa menurunkan akurasi tracking normalisasi.
  - Mengurangi pemakaian VRAM pada fungsi penjaga GPU (*GPU Keep-Alive*) dari 400 MB menjadi 4 MB.
  - Menambahkan siklus pembersihan memori (`gc.collect()`) di setiap iterasi rendering klip video.
- **Cloudflare Tunnel IPv6 Loopback Rejection**:
  - Memperbaiki kegagalan koneksi `dial tcp [::1]:8000: connect: connection refused` dengan memperbarui konfigurasi origin service Cloudflare Tunnel menjadi `127.0.0.1:8000`.
  - Menambahkan mekanisme *readiness probe* `wait_for_server_ready` di `backend/colab_api.py` agar Cloudflared hanya dijalankan setelah server FastAPI Uvicorn terverifikasi aktif membuka port.
- **Desktop Windows CUDA 12 DLL Fallback**:
  - Menambahkan pemindaian otomatis direktori instalasi standar NVIDIA CUDA Toolkit di Windows (`CUDA_PATH` dan `C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.x\bin`) ke `os.add_dll_directory()`.
  - Memisahkan error ketiadaan pustaka CUDA (`cublas64_12.dll is not found`) dari error VAD filter sehingga sistem tidak lagi mencoba retry VAD pada GPU yang rusak dan langsung beralih (*fallback*) ke mode CPU secara instan dan bersih.

## [1.15.0] - 2026-09-12

### Added
- **Clipper Cloud Web Architecture**: Merilis antarmuka Web UI murni (`web/`) untuk akses browser yang terintegrasi dengan Google Colab backend dan dukungan GPU Cloudflare tunnel.
- **Unified Dashboard & Job History**: Implementasi UI dashboard utama, sistem manajemen riwayat job via SQLite, serta History List interaktif untuk memonitor dan memutar ulang hasil klip.
- **Advanced Subtitle Editor (ClipEditModal)**: Fitur koreksi subtitle per-kata (word-level adjustments) langsung di dalam browser yang didukung dengan fitur koreksi tata bahasa berbasis AI.
- **Google Drive Integration**: Menambahkan antarmuka *GDrive Browser* untuk mengelola, memilih, dan mengunduh video sumber langsung dari Google Drive.
- **Custom Font Bundling**: Mem-bundle font kustom (seperti Roboto dan Bebas) ke dalam aset proyek dan integrasi FFmpeg secara otomatis yang dapat dipilih melalui komponen FontSelector baru.
- **AI Video Hook**: Fitur baru untuk secara otomatis menduplikasi momen paling menarik (3-5 detik) ke bagian paling awal video sebagai "Hook", lengkap dengan efek transisi *glitch* secara otomatis.
- **Hook Configuration**: Toggle untuk mengaktifkan AI Video Hook pada pengaturan Desktop dan Cloud UI.

### Changed
- **Backend Job Management**: Refaktor infrastruktur job backend untuk mengakomodasi mode Web/Cloud, pemrosesan unduhan asinkron `yt-dlp`, fitur *rerender* per-klip, dan API helper terpadu.

### Fixed
- **UI & Accessibility**: Perbaikan berbagai *bug* layout, *edge-case* parsing JSON/URL, pencegahan kebocoran *event listener* (Escape key), serta peningkatan aksesibilitas (a11y) di seluruh Modal antarmuka Web.


## [1.14.0] - 2026-08-13

### Added
- **Gaming Mode Auto-Detection**: Pipeline video secara otomatis dapat mendeteksi layout *gaming* dan mendukung *vertical split-screen cropping*.
- **Video Watermark Support**: Sistem sekarang mendukung penambahan watermark pada hasil render video akhir.
- **UI SubtitleConfigControls**: Menambahkan komponen khusus untuk manajemen tipografi dan gaya subtitle, mendukung *custom preset* visual seperti model font Alex Hormozi.
- **Landing Page**: Halaman utama aplikasi dengan integrasi navigasi tautan sosial dan akses ke workspace video.
- **Multi-language Support**: Menambahkan file pelokalan (i18n) untuk bahasa Inggris (`en.json`) dan Indonesia (`id.json`).

### Changed
- **Manual Downloader Enhancements**: Fitur downloader kini mendukung pengunduhan full video (tanpa memotong klip / *empty clips allowed*) dan memungkinkan pemilihan kualitas resolusi video saat mengunduh.

### Removed / Deprecated
- **Smart Editor**: Fitur eksperimental Smart Editor telah dihapus secara permanen, dan seluruh alur penyuntingan sepenuhnya mengandalkan pengaturan UI standar dan *Gaming Mode*.

## [1.13.0] - 2026-08-12

### Added

- **AI Subtitle Auto Correction**:
  - Implementasi koreksi ejaan dan tata bahasa pada subtitle secara otomatis dengan AI.
  - Tersedia opsi mode otomatis terintegrasi menggunakan penyedia AI API lokal atau mode penyalinan prompt templat untuk digunakan pada _chat platform_ eksternal (seperti ChatGPT atau Claude).
  - Penambahan antarmuka `SubtitleConfigControls` untuk fitur ini yang berada langsung pada fitur pengeditan kata manual.

## [1.12.0] - 2026-08-09
### Added

- **Per-Clip Subtitle Correction & Rerendering**:
  - Penambahan fitur edit subtitle spesifik untuk per-klip (`clip_N_custom.words.json`) langsung dari halaman history.
  - Rerender per-klip kini dapat dieksekusi secara individual untuk menimpa langsung video klip hasil editan tanpa perlu merender ulang keseluruhan video.

### Fixed

- **Custom Subtitle Persistence**: Memperbaiki masalah di mana *Rerender All Clips* menghapus/menimpa modifikasi teks kustom. Kini sistem memprioritaskan metadata `custom_subtitle_path` pada `result_clips` di _history database_.
- **Job Status Accuracy**: Memperbaiki hitungan _Progress_ pada proses rerender klip yang mengakibatkan notifikasi "0 klip berhasil" dengan memastikan _append_ `clip` baru ke metrik *job tracking*.
- **API Error Handling**: Mengatasi `KeyError: error` pada handler FastAPI Exception.

## [1.11.1] - 2026-08-07

### Fixed

- **Cross-Platform CORS Webview & Handshake Connectivity**:
  - Memperbaiki kegagalan koneksi sidecar (*backend disconnected*) pada Windows desktop dengan memperluas regex CORS FastAPI agar mengenali seluruh subdomain `localhost` (termasuk `http://tauri.localhost` dan `https://tauri.localhost` bawaan WebView2) serta scheme `tauri://*` / `app://*` macOS WKWebView.
- **Windows Installer File-Lock Prevention**:
  - Menambahkan script preinstall NSIS (`src-tauri/hooks.nsh`) untuk mematikan semua proses backend dan aplikasi (`backend.exe`, `backend-x86_64-pc-windows-msvc.exe`, `Auto Clipper.exe`, `app.exe`) sebelum instalasi, mencegah galat `WinError 32` saat memperbarui atau menurunkan versi.
- **FFmpeg Binary Path Discovery**:
  - Menambahkan kandidat pencarian path FFmpeg di direktori induk (`bin_dir.parent`) untuk menjamin binary FFmpeg terdeteksi dengan tepat di semua variasi struktur folder paket aplikasi.
- **PyInstaller Metadata & Dependency Bundling**:
  - Memperbaiki registrasi modul `backend.metadata` pada `hiddenimports` dan mengumpulkan paket runtime `numpy` secara komprehensif pada konfigurasi build `backend.spec`.

## [1.11.0] - 2026-08-06

### Added

- **Subtitle Word-by-Word Anti-Overlap Engine**:
  - Implementasi algoritma *flat-list anti-overlap* (`end_i <= start_{i+1}`) pada `words_to_karaoke_ass` untuk mengeliminasi flicker dan glitch tumpang tindih waktu antar kata/chunk pada subtitle karaoke vertikal (single-word pop).
  - Penambahan fungsi `words_to_standard_ass` untuk rekonstruksi kalimat penuh secara natural dari daftar kata ber-timestamp.
- **Custom Subtitle Typography & Interactive Live Preview**:
  - Kustomisasi tipografi subtitle: pemilihan *font family* (Montserrat, Impact, Arial, Roboto, Oswald, Arial Black), skala *font size*, *font weight* (`normal` / `bold`), huruf kapital (*uppercase*), palet warna preset + hex code kustom, dan penyesuaian posisi vertikal (*top*, *middle*, *bottom*).
  - Komponen antarmuka `SubtitleConfigControls` dilengkapi kotak simulator *Live Preview* interaktif dan dukungan multibahasa (Bahasa Indonesia & Inggris).
- **Universal Word-Level Transcription & Mode Dispatch**:
  - Whisper selalu mengekstrak *word-level timestamps* (`words.json`) di semua alur transkripsi.
  - Mode subtitle (`karaoke` vs `standard`) dikontrol langsung via preferensi pengguna (`subtitle_config`), bukan oleh ekstensi file input.
  - Propagasi dan persistensi `subtitle_config` di seluruh alur pembuatan job (`create_job`, `create_manual_job`, `create_rerender_job`, `create_rerun_ai_job`, `resume`).
- **Cross-Platform Packaging & Auto-Updater Support**:
  - Pemisahan arsitektur packaging: Windows menggunakan PyInstaller `--onefile`, sedangkan macOS menggunakan `--onedir` via `src-tauri/tauri.macos.conf.json` untuk menghilangkan *cold-start delay* dan memfasilitasi *codesigning*.
  - Menambahkan skrip rilis manual `release-mac-intel.sh` dan panduan `docs/release-macos-intel.md` untuk meng-generate bundel installer DMG beserta artifact in-app updater (`.tar.gz.sig`, `updater.json`).
  - Penambahan workflow CI/CD GitHub Actions untuk otomasi build lintas platform.

## [1.10.0] - 2026-08-05

### Added

- **macOS Build Script**: Menambahkan skrip `build-mac-local.sh` untuk otomasi *build* di lingkungan macOS beserta dokumentasinya.
- **Intelligent Face-Tracking & Video Layout Analysis**: Menambahkan modul `crop_utils.py` untuk mendeteksi wajah dan melacak tata letak video secara pintar.
- **Backend Auto-Recovery**: Mengimplementasikan sistem pemulihan otomatis (auto-recovery) pada sisi *frontend* dengan mekanisme *health polling* reguler, opsi *manual reconnection*, dan manajemen siklus hidup *sidecar* yang tangguh tanpa harus me-restart seluruh aplikasi.

## [1.9.0] - 2026-08-03

### Added

- **Landscape-to-Portrait Canvas Background Styling**: Memungkinkan konversi video landscape (16:9) ke format kanvas vertikal (9:16) tanpa memotong sisi video, dengan 3 mode latar belakang:
  - *Blurred Background*: Efek Gaussian blur pada latar belakang dengan 3 pilihan intensitas (*Light*, *Medium*, *Heavy*).
  - *Solid Color Background*: Latar belakang warna solid elegan dengan preset tema dan kustomisasi hex code.
  - *Custom Image Background*: Pemilihan berkas gambar lokal (.jpg, .png, .webp) sebagai latar kanvas 9:16.
- **Foreground Zoom / Enlarge Control**: Pengaturan pembesaran skala video di tengah kanvas (1.0x, 1.2x, 1.5x, 1.8x, 2.0x) secara proporsional.
- **Adaptive Subtitle Positioning**: Penyesuaian margin vertikal subtitle karaoke secara otomatis agar teks muncul di ruang kosong bawah video tanpa menutupi visual utama saat mode kanvas aktif.
- **Canvas Config Controls Component**: Komponen UI modular terintegrasi pada form Generate, Manual Downloader, dan Re-render di halaman History.

### Fixed

- **Manual AI Resume Metadata Persistence**: Memperbaiki bug di mana konfigurasi kanvas (`canvas_config`), judul (`title`), dan kualitas (`quality`) tidak termuat saat melanjutkan perenderan klip manual dari histori (`resume_manual_job`).

## [1.8.0] - 2026-08-02

### Added

- **AI Provider Registry**: Model LLM tidak lagi di-hardcode. Pengguna dapat mengonfigurasi API Key secara mandiri.
- **Manual AI Editor**: Penambahan alur kerja untuk menentukan bagian video secara manual.
- **Project Workspaces**: Manajemen aset diisolasi dalam direktori khusus per proyek.
- **Video Layout Classification**: Deteksi otomatis tata letak video (Landscape vs Portrait).
- **NVENC Fallback**: Dukungan *hardware encoding* otomatis dengan *fallback* aman ke CPU.

### Changed

- Mengembangkan *Job Pipeline* yang mendukung percabangan otomatis (AI-Driven) dan manual.
- Pembaruan dokumen arsitektur dan persyaratan proyek.

## [1.7.0] - 2026-08-01

### Added

- **Native OS Notifications**: Notifikasi kini menggunakan sistem notifikasi bawaan sistem operasi (native) yang mendukung multi-bahasa, menggantikan notifikasi web konvensional.
- **System Sleep Prevention**: Menambahkan antarmuka _BusyOverlay_ dan mekanisme pencegahan OS _sleep_ saat aplikasi merender video, memastikan proses tidak gagal di tengah jalan.
- **Internationalization (i18n)**: Menambahkan dukungan multi-bahasa (Bahasa Inggris dan Indonesia) pada antarmuka pengguna aplikasi.

### Changed

- **FastAPI Architecture**: Beralih dari penggunaan standar I/O (IPC) ke peladen backend berbasis FastAPI untuk stabilitas _Job Management_ (antrean kliping, translasi, render) yang jauh lebih tangguh.
- Memperbarui dokumentasi teknis, PRD, dan BRD agar sejalan dengan kapabilitas dan arsitektur baru.

## [1.6.11] - 2026-07-31

### Fixed

- Memperbaiki parser JSON untuk data hasil respon AI agar lebih tangguh (robust) ketika AI berhalusinasi atau memberikan format JSON yang tidak valid di bagian terbawah teks, sehingga klip tetap berhasil diproses tanpa terhenti karena _error_.

## [1.6.10] - 2026-07-30

### Fixed

- Memperbaiki bug di mana video gagal dipotong (muncul pesan "Semua klip gagal dirender") karena sistem lupa meneruskan data _highlights_ dari AI ke fungsi _cropping_.
- Memperbaiki kegagalan proses _Resume/Retry_ dari halaman History yang disebabkan oleh data _highlights_ yang tidak tersimpan ke database.

## [1.6.9] - 2026-07-30

### Fixed

- Memperbaiki bug aplikasi crash (Converting circular structure to JSON) saat klik tombol "Generate Viral Clips" dengan mencegah pengiriman object Event React ke backend.

## [1.6.8] - 2026-07-30

### Added

- Menambahkan panduan langkah demi langkah penggunaan fitur "Manual AI Editor (Gratis)" di halaman Help / FAQ (mendukung bahasa Indonesia dan Inggris).

### Fixed

- Memperbaiki alur navigasi fitur "Manual AI" agar tetap berada di halaman History saat melajutkan proses kliping, tidak lagi terlempar ke layar utama.
- Memperbaiki sistem _parser_ JSON (di sisi _frontend_ dan _backend_) agar lebih kebal (_robust_) terhadap respons dari AI yang menyertakan teks narasi pengantar atau terbungkus oleh _Markdown code blocks_.
- Memperbaiki _error_ layar putih (_blank white screen_) di halaman Help / FAQ akibat kegagalan muat _icon_.

## [1.6.7] - 2026-07-29

### Fixed

- Memperbaiki isu proses rendering klip yang gagal karena respons dari model AI terbungkus oleh blok _Markdown_ (e.g. ` ```json `).
- Memperbaiki fitur **Retry** pada riwayat gagal karena hilangnya API Key; sekarang _frontend_ mengirimkan API Key yang tersimpan sebagai _fallback real-time_.

## [1.6.6] - 2026-07-28

### Fixed

- Memperbaiki fitur Retry agar tidak crash saat terjadi network timeout (`getaddrinfo failed`).
- Menambahkan fallback _retry delay_ yang lebih sabar (hingga 8 attempts / ~4 menit) pada integrasi API Gemini untuk mengatasi isu `503 UNAVAILABLE` (server overloaded).
- Mencegah fitur Retry/AI Koreksi dari proses _re-transcribing_ dan mengekstrak ulang audio yang sudah ada, sehingga membuat _retry_ dan koreksi AI secara signifikan lebih cepat.
- Menghapus _placeholder_ `ffmpeg.exe` (berukuran 0 byte) bawaan Tauri pada folder _target_ yang menyebabkan `[WinError 193]` saat sistem memanggil `ffmpeg`.
- Memperbaiki halaman Riwayat (History Page) yang tidak merender tombol "Retry" akibat perbedaan _string_ status `"ERROR"` pada backend dengan `"failed"` pada frontend.

## [1.6.5] - 2026-07-27

### Fixed

- Memperbaiki izin eksekusi _sidecar_ pada Tauri v2 dengan menyelaraskan string `"bin/backend"` di `src-tauri/capabilities/default.json` agar _backend_ dapat berjalan di hasil rilis.

## [1.6.4] - 2026-07-27

### Fixed

- Memperbaiki isu "disconnected" pada frontend dengan menyelaraskan nama string pemanggilan _sidecar_ agar sesuai dengan path `externalBin` terbaru di `tauri.conf.json`.

## [1.6.3] - 2026-07-27

### Fixed

- Memperbaiki isu "ffmpeg is not installed" pada rilis GitHub Actions dengan menyesuaikan path executable ffmpeg agar disertakan dengan benar saat _bundling_ oleh Tauri.

## [1.6.2] - 2026-07-27

### Fixed

- Menambahkan fallback loop cookie untuk browser pada `yt-dlp` guna menyelesaikan isu kegagalan unduhan video YouTube yang diblokir oleh bot protection/age restriction.

## [1.6.1] - 2026-07-25

### Changed

- Refactoring arsitektur backend menjadi berbasis FastAPI untuk stabilitas yang lebih baik.
- Integrasi Tauri Sidecar dan perbaikan background job processing.
- Penambahan fungsi Stronghold Storage untuk token.

## [1.6.0] - 2026-07-24

### Added

- Fitur **Multi-Stage Resume (Retry Cerdas)**: Proses retry kini hanya mensyaratkan ketersediaan file video lokal. Jika gagal di tengah jalan (misal: saat transkripsi Whisper), pengguna tidak perlu _download_ ulang videonya, sistem akan secara cerdas melanjutkan tahap transkripsi dari video yang sudah ada.

## [1.5.0] - 2026-07-22

### Added

- Fitur Social Kit Modal yang lebih rapi (menampilkan judul, deskripsi, hashtag, dan ide thumbnail).
- Rekomendasi Waktu Posting (Best Time to Post) yang menyesuaikan zona waktu lokal pengguna.
- Saran Backsound Musik yang spesifik (lagu, artis, dan genre) sesuai suasana klip.
- Durasi klip yang lebih dinamis (20-120 detik) untuk mengakomodasi narasi panjang atau klip singkat yang _punchy_.

### Fixed

- Memperbaiki bug di `HistoryPage` di mana data social kit baru tidak terlempar (forwarded) ke komponen `ClipCard`.

## [1.4.0] - 2026-07-21

### Added

- Fitur AI Content Generation untuk pembuatan konten otomatis.
- Pencarian dan integrasi B-Roll otomatis dari Pexels.
- Implementasi sistem logging terpusat untuk semua proses.

### Fixed

- Perbaikan masalah OpenAI 524 Error.

## [1.3.3] - 2026-07-21

### Added

- Dokumen Architecture Decision Records (ADR) di folder `docs/decisions`.
- Dokumentasi `AGENTS.md` untuk membantu AI AI Agent memahami konteks proyek.
- File `CHANGELOG.md` untuk melacak riwayat pembaruan aplikasi.

### Changed

- Refactoring dokumentasi internal.

## [1.3.2] - Previous Version

_(Catatan historis untuk versi sebelumnya sebelum changelog ini diinisiasi)_


