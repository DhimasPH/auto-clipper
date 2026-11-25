## Ringkasan

PR gabungan untuk empat sub-proyek bertumpuk (`feat/sp0-pipeline-stability` → `feat/sp1-single-frontend-web-local` → `feat/sp2-ux-for-everyone` → `feat/sp3-lightweight` → `main`), merangkum **SP0 (`v1.18.0`)**, **SP1 (`v1.19.0`)**, **SP2 (`v1.19.0`)**, dan **SP3 (`v1.19.0`)**:

1. **SP0 — Pipeline andal dan cepat (`v1.18.0`):** Video YouTube 30 menit dengan 10 klip di Google Colab T4 sebelumnya tidak pernah selesai (unduhan ditolak YouTube, subtitle jatuh ke prosesor, lalu runtime terputus). Sekarang job itu selesai dalam sekitar 12 menit waktu mesin.
2. **SP1 — Frontend tunggal & Auto Clipper Web lokal (`v1.19.0`):** Menyatukan aplikasi desktop Tauri dan aplikasi web cloud ke satu kode `src/` (React 19, Vite 8, TypeScript 6) lewat lapisan `src/platform/`, menghapus folder `web/`, menambahkan paket siap pakai **Auto Clipper Web** untuk 4 target OS (`backend --web`), serta mengamankan `/video` dengan link bertanda tangan HMAC (`video_signing.key`).
3. **SP2 — UI/UX untuk orang awam (`v1.19.0`):** Merancang ulang antarmuka dengan pendekatan HP dulu: tiga menu (**Buat klip**, **Riwayat**, **Pengaturan**), alur **Buat klip** empat langkah (**1 Video → 2 Siapkan → 3 Pilih momen → 4 Klip**), jalur bawaan **AI manual dipandu** (tanpa API key), layar progres jujur dari tahap berjalan `GET /jobs/{id}.current`, unggah gambar latar kanvas lewat `POST /upload-image`, serta penjaga bahasa awam dan kontras WCAG AA.
4. **SP3 — Aplikasi ringan, komponen opsional terkunci SHA-256 & keamanan folder hasil (`v1.19.0`):** Memangkas bundel desktop/web lokal dengan memisahkan `mediapipe` beserta dependensi transitifnya, menunda import library berat (`backend/_lazy.py`) sehingga startup sidecar 2,6× lebih cepat dengan RAM hampir separuhnya (`119,9 MB → 61,3 MB`), menyediakan pengunduh komponen opsional terkunci SHA-256 di Pengaturan (**Dukungan kartu grafis Windows** & **Pelacak wajah Teliti**) serta pemasangan otomatis **Teliti** di Colab Langkah 3, menambahkan dialog pilihan cepat model Whisper di prosesor, serta menutup celah `output_dir` (`T1.y`) sekaligus memperbaiki pemutaran/penyimpanan klip dari folder hasil kustom Desktop.

### Tolok ukur SP0 di Colab T4 (2026-11-18)

Rincian di `docs/superpowers/specs/2026-11-12-pipeline-stability-design.md` bagian 7:

| Tahap | Sebelum | Sesudah |
|---|---|---|
| Unduh | Gagal "Sign in to confirm you're not a bot" | 14 dtk (dengan `cookies.txt`) |
| Subtitle (Whisper `medium`) | Prosesor, belum selesai setelah 24 menit | 2 menit di GPU |
| Tracking wajah, 10 klip | 13,1 menit | 4,5 menit |
| Render, 10 klip | Prosesor (uji NVENC salah) | 5 menit di GPU (NVENC) |

### Tolok ukur SP3 di Windows 11 (Python 3.12 `ac-venv`, 2026-11-25)

Median 3 subproses Python bersih dan build PyInstaller `--onefile` (rincian di `docs/decisions/015-sp3-lightweight-addons-and-output-dir.md` bagian 3):

| Pengukuran | Sebelum (`9ff373f`) | Sesudah (`feat/sp3-lightweight`) | Perubahan |
|---|---|---|---|
| `import backend.main` + `preflight.run_preflight()` + `import backend.jobs` | 3,77 dtk · 119,9 MB RSS | 1,442 dtk · 61,3 MB RSS | **2,6× lebih cepat · −48,9% RAM** (`preflight+jobs`: 3,14 dtk → 0,598 dtk) |
| Modul berat di `sys.modules` saat startup | `yt_dlp`, `cv2`, `numpy`, `openai`, `google.genai` termuat | `[]` (**0** modul berat termuat) | Diuji di subproses terisolasi (`test_startup_lazy.py`) |
| Ukuran `backend.exe` (`backend.spec --clean` lokal) | 248,99 MB | 198,68 MB (`208.326.098` byte) | **−50,31 MB (−20,2%)** meski `opencv-contrib-python` masih ada di `ac-venv` lokal; build CI bersih tanpa paket itu lebih kecil lagi |

---

## Perubahan Utama per Tahap

### Bagian 1: SP0 — Pipeline Andal dan Cepat (`v1.18.0`)

- **Error yang bisa ditindaklanjuti:** `AppError` dengan kode terstruktur dan pesan awam (`id` + `en`), kartu error (`ErrorCard`) dengan tombol aksi di desktop dan web, serta **Detail teknis** tertutup bawaan.
- **Cookies YouTube:** unggah, validasi (format Netscape, cookie `youtube.com`, belum kedaluwarsa, maks. 1 MB), status, dan hapus `cookies.txt`; strategi client yt-dlp (`default` → `web_embedded` → `android_vr`) dengan Deno/EJS.
- **Detail waktu:** pencatatan waktu dan memori puncak per tahap serta perangkat yang benar-benar dipakai (`metadata["timings"]`).
- **Antrean job:** satu slot job berat dalam satu waktu (`AUTO_CLIPPER_MAX_HEAVY_JOBS`, bawaan 1), job berikutnya tampil "Menunggu giliran" dan bisa dibatalkan.
- **Pemeriksaan awal:** `GET /api/preflight` dan `scripts/colab_preflight.py` (FFmpeg, ruang disk, RAM, GPU, pustaka GPU Whisper, encoder GPU, Google Drive, Deno, umur yt-dlp).
- **Colab:** disk kerja lokal `/content/work` dengan publish atomik ke Google Drive, `history.db` lokal dengan snapshot ke Drive, job ditolak (`DRIVE_NOT_MOUNTED`) dan tidak membuat file apa pun bila Drive belum ter-mount, serta notebook dengan Deno, pustaka GPU Whisper, dan kolom `BRANCH`.
- **Pelacakan wajah satu kali baca** lewat FFmpeg (2,9× lebih cepat di T4, hasil identik).
- **Unduhan bawaan:** H.264 ≤ 1080p ("Otomatis (hingga 1080p)"); FFmpeg 6.1 di installer Windows agar `h264_nvenc` jalan; perbaikan `Rerender All` di web dan pelestarian `face_tracking_engine` saat rerender.

### Bagian 2: SP1 — Frontend Tunggal & Auto Clipper Web (`v1.19.0`)

- **Frontend tunggal `src/`:** React 19, Vite 8, TypeScript 6, Vitest, dan oxlint; seluruh perbedaan `desktop` / `local` / `cloud` diisolasi di `src/platform/` (`Platform`, `caps`, `browserPlatformParts`), sementara `web/` dan `scripts/check-web-strings.mjs` dihapus.
- **i18n tunggal & aksi error per platform:** seluruh teks `AuthGate` dan `GDriveBrowserModal` masuk `src/locales/{id,en}.json` dengan uji paritas kunci (`src/locales/locales.test.ts`); `ErrorCard` memilih aksi lewat `platform().caps` (**Pilih video dari Google Drive** di cloud, pemilih file di desktop/lokal, **Buka Pengaturan** disembunyikan di cloud).
- **Mode web lokal (`backend --web`):** `backend/web_ui.py` dan `backend/web_mode.py` melayani UI di `127.0.0.1` dengan satu instance per komputer (`web_instance.json`), memakai ulang port peluncuran sebelumnya bila bebas (`web_port.json`, termasuk pengecekan `connect` pada `127.0.0.1` di SP2 Task 16 agar pendengar `0.0.0.0` ikut terdeteksi), token acak per peluncuran, `LocalGate` (`LOCAL_TOKEN_MISSING`, `LOCAL_TOKEN_EXPIRED`, `LOCAL_SERVER_CLOSED`), serta konsol dwibahasa.
- **Paket `Auto Clipper Web` & CI 4 target:** peluncur `scripts/web_launcher.py`, skrip perakitan & uji asap (`assemble_web_package.py`, `smoke_web_package.py`), skrip macOS/Linux + `BACA-SAYA.txt` (termasuk panduan macOS 15+ *Open Anyway* dan syarat glibc 2.35), serta workflow `.github/workflows/web-package.yml` untuk Windows, macOS Apple Silicon, macOS Intel, dan Linux di `PR Check` dan rilis `app-v*`.
- **Pembersihan & keamanan dependensi:** `npm audit fix` (0 kerentanan), dan `CORSMiddleware` ditempatkan di lapisan terluar agar respons `401` cloud membawa header CORS (membedakan token salah dari server offline).

### Bagian 3: SP2 — UI/UX untuk Orang Awam (`v1.19.0`)

- **Navigasi tiga menu & tata letak HP dulu:** **Buat klip** (`/`), **Riwayat** (`/riwayat`, `/riwayat/:id`), dan **Pengaturan** (`/pengaturan`), dengan navigasi bawah di `< 768 px`, sidebar ramping di `>= 768 px`, titik status koneksi di header, `BackendBanner`, `RunningBar`, serta pengalihan rute lama (`LEGACY_REDIRECTS`). `LandingPage`, `WorkspacePage`, `ManualAIEditorPage`, `ManualDownloaderPage`, `HistoryPage`, `HelpPage`, `GenerateForm`, `Sidebar`, `BusyOverlay`, `ManualResumeModal`, dan `ClipRerenderModal` dihapus.
- **Alur Buat klip 4 langkah (`CreatePage` + fungsi murni `src/lib/`):**
  - **1 Video:** tempel link (pemeriksaan langsung YouTube/TikTok/Instagram/X), **Pilih file video** (`platform().pickVideo()`), **Pilih dari Google Drive** (cloud), **Bentuk klip** (Vertikal, Persegi, Lebar), **Atur tampilan klip** (tertutup bawaan, pilihan diingat di `ac_clip_choices`), judul proyek otomatis, serta catatan dan kartu pemblokir **Pemeriksaan awal** (`GET /api/preflight`).
  - **2 Siapkan & 4 Klip (`ProgressPanel`):** tahap berjalan nyata dari `GET /jobs/{id}.current` (`backend/stage_timer.py` + `download_percent()` di `backend/video_utils.py`) tanpa mengubah `timings`; menampilkan waktu berjalan server, persen unduhan, `Membuat klip X dari Y`, catatan perangkat bila memakai CPU, pesan boleh/tidaknya halaman ditutup per `caps.keepOpen`, urutan antrean, dan **Batalkan** dengan konfirmasi.
  - **3 Pilih momen (`MomentStep`):** jalur bawaan **AI manual dipandu** (`Salin perintah`, `Buka ChatGPT` / `Buka Gemini`, `Tempel jawaban AI di sini` dengan pemeriksaan format `checkAiAnswer`), serta dukungan kembali lewat Riwayat (`Tempel jawaban AI`). Mode API key (`ac_ai_mode = "auto"`) tersedia sebagai opsi lanjutan bila `caps.apiKeys`.
- **Hasil, Riwayat & Pengaturan 4 bagian:**
  - **Hasil (`ClipsResult`, `ClipCard`):** 1/2/3 kolom, pemutar bertanda tangan, judul AI, durasi, **Unduh**, **Bagikan** (`SocialKitModal`), menu `⋯` (**Ubah subtitle atau tampilan** via `ClipEditModal`, **Buka folder**), **Unduh semua** (`platform().saveClips()`), dan **Detail waktu** tertutup bawaan.
  - **Riwayat (`ProjectsPage`, `ProjectPage`):** status awam (*Selesai*, *Gagal*, *Menunggu jawaban AI*, *Sedang diproses*, *Menunggu giliran*, *Dibatalkan*), satu tombol utama per status, kartu error untuk proyek gagal, serta menu `⋯` (**Buat ulang semua klip**, **Pilih ulang momen dengan AI** bila `caps.apiKeys`, **Hapus** dengan konfirmasi).
  - **Pengaturan:** empat bagian (**Umum**, **YouTube**, **Lanjutan** termasuk saklar **Pakai API key**, kunci Pexels, cara mengikuti wajah Standar/Teliti, folder & kualitas, model subtitle, dan pengunduh video tanpa klip dengan kontrol bentuk/subtitle sendiri, serta **Bantuan** dengan langkah singkat, FAQ, versi, pembaruan desktop, dan **Detail teknis**).
- **Aksesibilitas, teks awam & gambar kanvas:** token warna netral + satu aksen biru mode terang/gelap dengan kontras WCAG AA (`src/styles/contrast.test.ts`), huruf isi 16 px, area sentuh minimal 44 × 44 px, satu bingkai `Dialog` dengan focus trap, fokus kembali, dan penjaga isian, pemeriksaan kata terlarang/emoji/em dash di `plainWords.test.ts` dan `test_preflight.py`, serta unggahan gambar latar kanvas lewat `POST /upload-image` menggantikan `blob:`.
- **Perbaikan review akhir SP2 (`547531a`):** sinkronisasi `active_jobs` dan pembatalan bersih pada rerender satu klip (`backend/jobs.py`), penayangan `ErrorCard` gagal permintaan di Riwayat dan pemantauan job Riwayat di `CreatePage` (`useClipJobs.ts`, `ProjectsPage.tsx`, `ProjectPage.tsx`), pembatasan `save_refused` hanya untuk 4xx non-404 dan tombol eksternal `openExternal` di `ClipEditModal.tsx`, fallback `errorMsg` di langkah 4 `CreatePage.tsx`, serta penghapusan sisa state Smart Editor di `App.tsx`.

### Bagian 4: SP3 — Aplikasi Ringan, Komponen Opsional Terkunci SHA-256 & Keamanan Folder Hasil (`v1.19.0`)

- **Pemangkasan bundel & lazy-import startup:** `mediapipe` dikeluarkan dari `backend/requirements.txt` dan masuk `excludes` `backend.spec` (`backend.spec` hanya mengumpulkan paket native yang dibutuhkan + `haarcascade_frontalface_default.xml`, menyaring `tests/` dan header, serta menjaga `copy_metadata('yt-dlp')` dan stdlib `wave`/`csv`/`timeit`/`getpass`/`xml`). `backend/_lazy.py` (`LazyModule`/`LazyAttr`) menunda import `yt_dlp`, `cv2`, `numpy`, `openai`, dan `google.genai` sampai benar-benar dipakai tanpa mematahkan mock test `@patch`, dan `crop_utils.py` memanggil `gc.collect()` setelah pelacakan wajah.
- **Komponen tambahan opsional terkunci SHA-256 (`backend/addons.py`):** mengelola `cuda` (`nvidia-cublas-cu12==12.9.2.10` berisi `cublas64_12.dll` + `cublasLt64_12.dll` untuk GPU Windows) dan `mediapipe` (`1.2.3` + `flatbuffers==25.12.19` + `absl-py==2.5.1` + `face_landmarker.task` float16 v1; nonaktif di macOS Intel `x86_64`) via endpoint `/api/settings/addons` (`GET`, `POST .../download`, `DELETE`), dengan `PINNED_ADDONS` & `ALLOWED_HOSTS`, aktivasi `os.add_dll_directory()`/`PATH`/preload DLL saat startup dan sebelum transkripsi, serta penghapusan tertunda `.pending_remove_<id>` bila DLL Windows masih terkunci (`ADDON_IN_USE`).
- **Pelacakan Teliti ganda & Teliti di Colab:** `backend/crop_utils.py` menambah `_FaceLandmarkerAdapter` (dengan wrapper `__slots__` `_LandmarkerFace`/`_LandmarkerResult`) di samping `solutions.face_mesh.FaceMesh` agar `mediapipe 1.2.3` berjalan normal; jika **Teliti** tidak terpasang atau gagal saat berjalan, job jatuh aman ke `haar`, mencatat `log_app` + `log_error`, mengirim `report(device="haar_fallback")` (`stage_timer.py` menjaga `DEVICE_FIELDS` khusus perangkat aktif dan memprioritaskan `top.get("device")`), serta menyinkronkan/membersihkan `tracking_fallback_reason` lewat `jobs._sync_stage_metadata()` (`create_rerender_job` & `create_resume_job` mengawali `timings: []`). Di Colab, Langkah 3 `Auto_Clipper_Colab.ipynb` memanggil `install_colab_mediapipe()` ke `<repo>/bin/mediapipe_colab` (di luar Drive); backend Cloud membaca kesiapan **Teliti** dari folder tersebut tanpa menyentuh `get_app_data_dir()` dan tetap menolak `POST`/`DELETE` add-on (`400`).
- **Preflight GPU Windows, UI Pengaturan & dialog Whisper CPU:** `backend/preflight.py` memeriksa `cublas64_12.dll` di Windows dengan pesan awam ke **Pengaturan → Lanjutan → Model subtitle**; `GET /api/settings/whisper-models` menyertakan `gpu_ready` dan `processor_slow_models`. Frontend menambah `useAddons.ts`, `lib/addons.ts`, `AddonControls.tsx`, `FaceTrackingSection.tsx` (termasuk pemilihan **Teliti** di Cloud tanpa pesan tidak tersedia), peningkatan `TranscriptionSection.tsx` (catatan prosesor disembunyikan saat status add-on belum diketahui, kartu GPU dengan konfirmasi hapus), catatan `fallback_tracking`/`fallback_tracking_failed` di `ProgressPanel.tsx` berbasis timing run ini dan `current`, serta dialog konfirmasi `Dialog` di `CreatePage.tsx` (`overrideWhisperModel`, mempertahankan start langsung 2 argumen sesuai Ruling P9) saat `medium`/`large-v3` dipilih di perangkat tanpa GPU aktif.
- **Putar & simpan klip folder kustom Desktop:** `GET /video` dan `POST /save_file` mengizinkan klip di folder proyek hasil Desktop pilihan pengguna lewat `workspace.allowed_project_output_dirs(active_jobs)` (per proyek, bukan seluruh folder induk), serta `/save_file` menerima work dir sesuai spec.

---

## Keamanan (SP0 + SP1 + SP2 + SP3)

- **Perlindungan path aplikasi (`backend/path_guard.py`):** `/upload`, `/save_file`, `/video`, `/api/thumbnails`, `/api/extract-metadata`, `web_ui._serve`, `POST /upload-image`, serta `canvas_config.background_image_path` di kelima endpoint job (`/jobs`, `/jobs/manual`, `/jobs/{id}/rerender`, `/jobs/{id}/rerun_ai`, `/jobs/{id}/clips/{n}/rerender`) menolak akses ke folder cookies, `history.db*`, `backend_*.log`, `video_signing.key`, `web_instance.json`, dan `web_port.json` (403 `Access denied`). Nama file unggahan selalu dibersihkan via `safe_upload_name()`.
- **Kunci API tidak pernah disimpan di riwayat:** `api_key` dan `pexels_api_key` disaring dari `history.db` dan `metadata.json` (`VACUUM` pembersih data lama saat startup/snapshot).
- **Alamat video bertanda tangan (`backend/video_sign.py`):** `GET /video` mewajibkan tanda tangan `HMAC-SHA256` (`sig`) dari `video_signing.key` di semua platform; link dibuat saat dibaca atau via `POST /video-url` dan tidak pernah disimpan di `history.db`.
- **Isolasi token web & lokal:** frontend hanya melampirkan token ke origin backend (`isBackendRequest`); mode `--web` bind ke `127.0.0.1`, menyimpan file instance/port dengan mode `0600`, dan `CORSMiddleware` dipasang terluar agar `401` cloud membawa header CORS.
- **Perlindungan `output_dir` (`T1.y`), path perangkat NT & UNC teks-dulu (SP3):**
  - `_resolve_safe_output_dir()` mengosongkan **request** `output_dir` di mode Cloud dan Web Lokal (`web_ui.is_web_mode()`); helper workspace dan fallback histori lama mengabaikan `output_dir` di mode **Cloud**. Di Desktop, `output_dir` hanya menerima path absolut huruf drive lokal (Windows) atau absolut POSIX dalam bentuk `realpath` (atau `abspath` huruf drive untuk mapped drive), menolak folder/file terproteksi (`path_guard.is_protected()`), menolak folder proyek yang berada di dalam `addons/`/`temp_downloads/` atau menampung folder kerja internal (`jobs.refuse_protected_project_dir()`), serta menolak nama proyek titik-saja (`..`) dan memangkas titik/spasi akhir di `sanitize_title()`.
  - `path_guard` gagal tertutup atas semua path perangkat NT non-drive (`\\?\GLOBALROOT\...`, `\\?\Volume{...}\`, `\??\...`) dan stream NTFS (`:`), serta `/video`, `/save_file`, dan `/assets/*` menolak path UNC (`\\`, `//`) dan prefiks perangkat (`\\?\`, `\\.\`, `\??\`) secara teks-dulu sebelum panggilan filesystem agar tidak memicu SMB/NTLM.
- **Integritas & rantai pasok komponen tambahan (`backend/addons.py`):** pengunduhan hanya ke `ALLOWED_HOSTS` HTTPS, memeriksa URL seluruh hop redirect, panjang byte eksak, SHA-256 lowercase terkunci di `PINNED_ADDONS`, perlindungan *zip-slip* (`is_relative_to`), serta penulisan atomik via `.part`. Mode Cloud tidak pernah memanggil `get_app_data_dir()` saat mengecek status add-on.

---

## Catatan Deploy & Migrasi

- **Vercel (cloud):** Proyek Vercel lama yang memakai Root Directory `web` harus mengosongkan **Root Directory** (build dari root repo via `vercel.json`: `npm run build:cloud`) dan memakai **Node.js `22.x`**, lalu **Redeploy**.
- **Rilis & CI:** Workflow `.github/workflows/web-package.yml` membangun 4 paket `Auto-Clipper-Web-<os>.zip` di setiap `PR Check` dan melampirkannya ke rilis `app-v*`.

---

## Pengujian & Audit

- **Backend (`C:\Users\dhima\projects\ac-venv\Scripts\python.exe -m pytest backend/tests -q -p no:cacheprovider`):** **1067 lulus, 7 dilewati** (naik dari 694 di SP0, 805 di SP1, dan 860 di SP2; mencakup tes subproses `test_startup_lazy.py`, `test_addons.py`, `test_output_dir.py`, `test_protected_paths.py`, dan `test_colab_api.py`).
- **Spike PyInstaller (`backend.spec` + add-on runtime, Windows `--onefile`):** `.exe` terbekukan (`sys.frozen=True`) terbukti mengimpor wheel terkunci `mediapipe==1.2.3` + menjalankan `FaceLandmarker` dari folder add-on serta memuat `cublas64_12.dll` untuk `WhisperModel("medium", device="cuda")`.
- **Frontend (`npx vitest run` dari `C:\Users\dhima\projects\auto-clipper`):** **66 file, 474 lulus** (naik dari 424 di SP2; mencakup `addons.test.ts`, `FaceTrackingSection.test.tsx`, `TranscriptionSection.test.tsx`, `ProgressPanel.test.tsx`, `CreatePage.test.tsx`, `locales.test.ts`, `plainWords.test.ts`, `contrast.test.ts`, `imports.test.ts`, `videoUrl.test.ts`).
- **Lint & Build:** `npx oxlint src` (**0 error**, 15 warning lama); `npm run build` dan `npm run build:cloud` (**exit 0**); `npm audit` (**0 kerentanan**).
- **Audit browser headless (Edge CDP, SP2 Task 15):** pemeriksaan di `360×780`, `768×1024`, dan `1280×800` mode terang & gelap (75 + 84 layar/keadaan): 0 overflow horizontal, 0 kontrol `< 44 px`, navigasi keyboard/focus trap/Escape lulus (rincian di `tasks/sp2-audit.md`).
- **Review independen per branch:** SP1 (`tasks/sp1-ledger.md`), SP2 (`tasks/sp2-ledger.md`, laporan lokal `.superpowers/sdd/2026-11-20-sp2-ux-for-everyone/final-review-report.md`), dan SP3 (`tasks/sp3-ledger.md`, review menyeluruh `9ff373f..00642dc` pada 67 file tanpa lockfile: `Approved`, 0 Critical, 0 Important) masing-masing lolos review menyeluruh independen.

---

## Belum Diverifikasi (Menunggu Daftar Cek Pemilik)

- **SP0:** uji notebook Colab di runtime baru dari awal (`T0.13`: pulihnya riwayat setelah runtime dihapus, antrean dua tab, penolakan saat Drive belum ter-mount) dan build installer Windows lewat GitHub Actions dengan FFmpeg 6.1.
- **SP1:** daftar cek manual per platform di `tasks/PROGRESS-LOG.md` (installer desktop Windows, 4 zip `Auto Clipper Web` termasuk SmartScreen, macOS 15+ *Open Anyway*, Linux glibc 2.35, dan proyek Vercel kedua dari branch ini).
- **SP2:** uji pemakaian dengan 1 orang awam tanpa panduan di HP lewat Colab (360 px) dan di desktop/Auto Clipper Web dari link sampai klip terunduh, kembali dari `AWAITING_MANUAL`, tema terang/gelap, banner terputus, serta tampilan `SplashScreen` & `UpdateOverlay` pada build Tauri desktop nyata (daftar cek di akhir `tasks/PROGRESS-LOG.md`).
- **SP3:** uji nyata Langkah 3 notebook + pelacakan **Teliti** di Google Colab GPU T4; unduhan dan penghapusan komponen opsional (`cuda` ~528 MB, `mediapipe`) serta putar/simpan klip dari folder hasil kustom di aplikasi Desktop Windows nyata (`npm run tauri build` di mesin ber-Rust/CI); serta uji browser langsung untuk dialog konfirmasi model Whisper CPU di **Buat klip**.

---

## Referensi

- ADR: `docs/decisions/012-sp0-reliable-pipeline-colab-workdir-errors-queue-downloader.md`, `docs/decisions/013-single-frontend-local-web-signed-video-links.md`, `docs/decisions/014-sp2-live-stage-and-step-ui.md`, `docs/decisions/015-sp3-lightweight-addons-and-output-dir.md`
- Spec & Rencana: `docs/superpowers/specs/2026-11-12-pipeline-stability-design.md`, `docs/superpowers/specs/2026-11-18-sp1-single-frontend-web-local-design.md`, `docs/superpowers/specs/2026-11-20-sp2-ux-for-everyone-design.md`, `docs/superpowers/specs/2026-11-24-sp3-lightweight-design.md`, `docs/superpowers/plans/2026-11-24-sp3-lightweight.md`
- Ledger & Log: `tasks/sp1-ledger.md`, `tasks/sp2-ledger.md`, `tasks/sp2-audit.md`, `tasks/sp3-ledger.md`, `tasks/PROGRESS-LOG.md`, `tasks/roadmap-todo.md`, `CHANGELOG.md`
