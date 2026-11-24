# Spec SP3: Aplikasi Ringan, Komponen Tambahan Opsional, dan Keamanan Folder Hasil

Tanggal: 2026-11-24 · Status: disetujui pemilik per bagian, menunggu review dokumen tertulis · Induk: `2026-11-12-enhancement-roadmap.md` · Bergantung: SP0 (`2026-11-12-pipeline-stability-design.md`), SP1 (`2026-11-18-sp1-single-frontend-web-local-design.md`), SP2 (`2026-11-20-sp2-ux-for-everyone-design.md`)

---

## 1. Masalah dan Angka Pengukuran Saat Ini

Setelah SP0 (pipeline andal dan cepat), SP1 (satu frontend + Auto Clipper Web), dan SP2 (UI/UX ramah awam), ada lima beban dan celah yang tersisa di produk:

1. **Ukuran bundel PyInstaller membengkak oleh paket yang jarang dipakai dan dependensi berantai (~260 MB data mentah):**
   Pengukuran isi `site-packages` di lingkungan Windows (`Python 3.12`) menunjukkan penyumbang terbesar:

   | Paket | Ukuran (mentah) | Penyebab |
   |---|---|---|
   | `cv2` | 176,5 MB | `mediapipe` menarik `opencv-contrib-python` (5.0) yang menimpa `opencv-python-headless` (4.14), menggandakan DLL videoio (`cv2.pyd` 107,7 MB + 2 DLL FFmpeg 58,5 MB) |
   | `mediapipe` | 70,3 MB | Paket berat (66,1 MB `libmediapipe.dll`) untuk mode opsional **Teliti**, padahal bawaan memakai **Standar (Haar)** |
   | `av.libs` + `ctranslate2` + `onnxruntime` + `numpy` | 219,0 MB | Inti subtitle Whisper dan audio (`av.libs` 64,1 MB, `ctranslate2` 61,9 MB, `onnxruntime` 45,5 MB, `numpy`+`numpy.libs` 51,3 MB) |
   | `matplotlib` + `fontTools` + `PIL` | 62,3 MB | Ditarik oleh `mediapipe` untuk helper visualisasi gambar (`drawing_utils`), tidak pernah dipakai oleh `crop_utils.py` |

   Selain itu, `backend.spec` memanggil `collect_all()` pada 19 paket (termasuk paket Python murni dan semua cascade XML OpenCV), padahal yang dipakai hanya `haarcascade_frontalface_default.xml`.

2. **Mode pelacakan wajah Teliti (MediaPipe) diam-diam gagal di versi `mediapipe >= 1.0`:**
   `backend/requirements.txt` mencantumkan `mediapipe>=0.10.0` tanpa batas atas. Pada versi terbaru di Windows dan Linux (`mediapipe 1.2.3`), modul `mediapipe.solutions` sudah dihapus Google. Akibatnya `_open_face_mesh()` di `backend/crop_utils.py` melempar `ImportError("MediaPipe 'solutions' attribute is missing")` dan jatuh kembali ke Haar — sementara bundel tetap membawa ~260 MB beban mati.

3. **Subtitle di Desktop Windows dengan kartu NVIDIA jatuh ke prosesor (`cublas64_12.dll` hilang):**
   Sesuai temuan pemilik di GTX 1650 (`tasks/PROGRESS-LOG.md` 2026-11-18): `ctranslate2.dll` di Windows sudah membawa `cudnn64_9.dll` (0,25 MB), tetapi membutuhkan `cublas64_12.dll` + `cublasLt64_12.dll` (~527,5 MB di wheel `nvidia-cublas-cu12` `win_amd64`). Membundelnya ke installer akan menggandakan ukuran unduhan untuk semua pengguna, termasuk yang tidak punya kartu NVIDIA. Di sisi lain, `backend/preflight.py` (`_whisper_gpu_libs_missing`) saat ini hanya memeriksa pustaka GPU di Linux, sehingga di Windows tanpa `cublas64_12.dll` pemeriksaan awal masih melaporkan `"GPU aktif"`.

4. **Model subtitle `medium`/`large-v3` dipilih di perangkat tanpa GPU:**
   Pada perangkat tanpa GPU subtitle aktif, video 30 menit dengan `medium` memakan waktu lebih dari satu jam (angka SP0: belum selesai setelah 24 menit). Saat ini UI tidak memberi peringatan khusus di pilihan model maupun saat menekan **Mulai**.

5. **Startup dan RAM sidecar membengkak karena `import` tingkat atas, serta celah `output_dir` (`T1.y`):**
   Pengukuran startup Python di Windows (`read_rss_mb`, `time.perf_counter`):

   | Tahap | Waktu Tambahan | RAM (RSS) | Penyebab |
   |---|---|---|---|
   | Python mulai | — | 15,8 MB | Interpreter dasar |
   | `import backend.main` | 0,63 dtk | 43,5 MB | FastAPI, Starlette, Pydantic, SQLite |
   | `run_preflight()` (`GET /api/preflight`) | +1,90 dtk | 88,1 MB (+44,6 MB) | `get_ffmpeg_path()` meng-import `video_utils` → `yt_dlp` di baris 1; `is_nvenc_available()` meng-import `crop_utils` → `cv2` + `numpy` di baris 1 |
   | `import backend.jobs` | +1,24 dtk | 119,9 MB (+31,8 MB) | `jobs.py` meng-import `ai_utils` → SDK `openai` + `google.genai` di baris 1, padahal jalur bawaan SP2 adalah **AI manual** |

   Selain itu (`T1.y` dari SP1/SP2): `output_dir` belum dijaga `path_guard` dan masih diterima di mode Cloud/Web Lokal, sementara di Desktop sendiri memilih `output_dir` di luar `AppData` membuat `GET /video` dan `POST /save_file` menolak akses dengan `403 Access denied`.

> **Catatan Pendekatan B (`T0.15` / `T0.16`):** Pelacakan wajah satu-kali-baca lewat FFmpeg sudah selesai di SP0 (`5f91e77`, 2,9× lebih cepat di Colab T4 dan 5,3× di lokal), sehingga tidak perlu dijadwalkan ulang di SP3.

---

## 2. Sasaran dan Non-Sasaran

### Sasaran

- Satu aplikasi utama (Desktop dan Auto Clipper Web) menjadi lebih ringan: ukuran mentah bundel Python turun minimal **240 MB** dengan mengeluarkan `mediapipe` beserta dependensi transitifnya (`opencv-contrib-python`, `matplotlib`, `fontTools`, `PIL`).
- Pengguna Windows dengan kartu NVIDIA dapat memasang dukungan GPU untuk subtitle (~527,5 MB wheel resmi) langsung dari Pengaturan dalam satu klik tanpa Python/`pip`, dan pengguna yang ingin pelacakan wajah **Teliti** dapat memasang komponen MediaPipe (~25–42 MB) dengan mekanisme yang sama (sekaligus memperbaiki dukungan `mediapipe.tasks` versi terbaru).
- Pemilihan model subtitle `medium`/`large-v3` di perangkat tanpa GPU aktif memberi label anjuran di Pengaturan dan dialog konfirmasi cepat sebelum job berjalan.
- Startup layar awal (`import backend.main` + `GET /api/preflight` + `import backend.jobs`) tidak lagi memuat `yt_dlp`, `cv2`, `numpy`, `openai`, atau `google.genai` ke memori sebelum benar-benar dibutuhkan.
- Celah keamanan `output_dir` (`T1.y`) tertutup di semua platform, dan pengguna Desktop yang memilih folder hasil kustom tetap dapat memutar dan mengunduh klipnya tanpa error `403`.

### Non-Sasaran

- Memecah rilis menjadi 2 edisi installer terpisah (Lite dan Biasa) atau menggandakan jumlah paket CI dari 6 menjadi 12.
- Mengubah pemaketan PyInstaller Windows dari `--onefile` ke `--onedir` (tetap sesuai ADR-010 agar updater dan installer NSIS tidak berubah).
- Menambahkan fitur kreator baru (`SP4`).

---

## 3. Keputusan Pemilik (2026-11-24)

| Pertanyaan | Keputusan | Alasan |
|---|---|---|
| Edisi aplikasi & MediaPipe | **1 aplikasi utama yang Lite**; mode **Teliti (MediaPipe)** dipasang terpisah sebagai komponen opsional dari dalam Pengaturan. | Menghindari rilis ganda (12 paket) dan bentrok auto-updater `latest.json`, sementara pengguna baru langsung mendapat installer ringan. |
| Model subtitle di prosesor (CPU) | Label anjuran dengan GPU di Pengaturan + dialog pilihan cepat saat menekan **Mulai** (*Pakai model Cepat (disarankan)* vs *Tetap pakai model Akurat*). | Melindungi pengguna awam dari menunggu >1 jam tanpa menghalangi pengguna video pendek yang memang sengaja memilih akurasi tinggi. |
| Pemaketan PyInstaller Windows | Tetap `--onefile` + pemangkasan ~260 MB bundel dan lazy-import di kode Python. | Ekstraksi `--onefile` sudah jauh lebih cepat setelah beban ~260 MB keluar, tanpa risiko merusak `tauri.conf.json`, `hooks.nsh`, dan updater Windows. |
| Keamanan & perilaku `output_dir` (`T1.y`) | `output_dir` hanya diterima di **Desktop** (diabaikan di Cloud & Web Lokal), wajib lolos `path_guard.is_protected()`, dan diizinkan oleh `/video` serta `/save_file` untuk proyek yang sah. | Menutup celah penulisan path bebas sekaligus memperbaiki bug `403` saat pengguna Desktop memakai folder hasil pilihan sendiri. |

---

## 4. Desain

### 4.1 Pemangkasan Bundel (`backend/requirements.txt` & `backend.spec`)

1. **Pisahkan dependensi inti dan opsional:**
   - Hapus `mediapipe>=0.10.0` dari `backend/requirements.txt` (desktop & paket Auto Clipper Web).
   - Catatan untuk Colab notebook: `Auto_Clipper_Colab.ipynb` atau pengguna dari source tetap dapat memasang `mediapipe` secara terpisah bila membutuhkan mode Teliti, atau memakai pengunduh komponen di aplikasi.
2. **Rapikan `backend.spec`:**
   - Hapus `'mediapipe'` dari daftar paket `collect_all(...)`.
   - Ganti pemanggilan `collect_all()` seragam pada 19 paket dengan pengumpulan selektif:
     - Paket native yang membutuhkan binary/data khusus: `faster_whisper`, `ctranslate2`, `onnxruntime`, `av`, `numpy`, `certifi`, serta `cv2` (khusus DLL/pyd + **hanya** `haarcascade_frontalface_default.xml`, bukan puluhan XML cascade/model lain).
     - Paket Python murni (`fastapi`, `uvicorn`, `starlette`, `anyio`, `h11`, `pydantic`, `openai`, `google.genai`, `yt_dlp`, `requests`, `httpx`) cukup lewat `hiddenimports` / analisis modul normal PyInstaller tanpa `collect_all` agar file tes dan metadata berlebih tidak ikut masuk.
   - Tambahkan filter pasca-`Analysis` di `backend.spec` untuk membuang berkas yang tidak dipakai saat runtime dari `a.datas` / `a.binaries` (folder `tests/`, `test/`, `*.h`, `*.hpp`, `*.lib`, `*.pdb`, serta file `cv2/data/*.xml` selain `haarcascade_frontalface_default.xml`).
3. **Invarian PyInstaller tetap berlaku:**
   - Windows tetap `--onefile`, macOS tetap `--onedir` (`ADR-010`, `AGENTS.md` G.1), dan `backend.metadata` tetap masuk `hiddenimports` (`AGENTS.md` G.6).

---

### 4.2 Pengunduh Komponen Tambahan Opsional (`backend/addons.py`)

Satu modul backend terpadu `backend/addons.py` mengelola komponen opsional di bawah `<get_app_data_dir()>/addons/` agar tetap bertahan saat aplikasi diperbarui dan terisolasi dari disk kerja sementara (`AUTO_CLIPPER_WORK_DIR`).

#### A. Lokasi dan Perlindungan Disk
- Direktori penyimpanan: `<get_app_data_dir()>/addons/<addon_id>/` (file penanda kesiapan: `manifest.json`).
- **Keamanan unduhan:**
  - Sumber unduhan divalidasi (`https://pypi.org/...`, `https://files.pythonhosted.org/...`, dan host resmi Google Storage `https://storage.googleapis.com/mediapipe-models/...` untuk model `face_landmarker.task`).
  - Unduhan ditulis ke folder sementara `.part` dan baru dipindahkan ke folder akhir lewat `os.replace` setelah integritas SHA-256 (dari metadata JSON PyPI) dan ekstraksi `zipfile` lolos.
  - Tidak memerlukan `python` maupun `pip` di komputer pengguna.
- Di mode Cloud (`AUTO_CLIPPER_CLOUD_MODE`), pengunduh komponen tambahan dinonaktifkan (`available: false`, karena lingkungan Colab sudah dikelola notebook di Langkah 3).

#### B. Komponen 1: Dukungan GPU Subtitle Windows (`addon_id = "cuda"`)
- **Kapan relevan (`available: true`):** hanya ketika `sys.platform == "win32"`, bukan cloud mode, dan `_cuda_device_count() >= 1`.
- **Apa yang diunduh:** backend mengambil metadata PyPI `https://pypi.org/pypi/nvidia-cublas-cu12/json`, mencari rilis terbaru yang memiliki wheel `win_amd64`, lalu mengunduh wheel tersebut (~527,5 MB) dan mengekstrak **hanya** file DLL runtime (`cublas64_12.dll` dan `cublasLt64_12.dll`) ke `<app_data_dir>/addons/cuda/bin/` (tidak perlu `nvidia-cudnn-cu12` karena `ctranslate2.dll` sudah membawanya).
- **Aktivasi saat runtime:** fungsi `addons.activate_installed()` dipanggil saat startup `backend/main.py` dan di awal `_transcribe_with_faster_whisper()` (`backend/ai_utils.py`): mendaftarkan `<app_data_dir>/addons/cuda/bin/` lewat `os.add_dll_directory()` dan menambahkannya ke `PATH`.
- **Perbaikan `backend/preflight.py`:** `_whisper_gpu_libs_missing()` diperluas agar juga memeriksa Windows (`sys.platform == "win32"`): mencoba `ctypes.WinDLL("cublas64_12.dll")` setelah mengaktifkan folder add-on/CUDA. Jika kartu NVIDIA terdeteksi tetapi `cublas64_12.dll` gagal dimuat:
  - Di **Windows** (lokal/desktop): cek `gpu` berlevel `warn` dengan pesan awam yang memberi tahu bahwa subtitle memakai prosesor dan mengarahkan pengguna ke **Pengaturan → Lanjutan → Model subtitle** untuk mengunduh dukungan GPU (tanpa menyebut istilah teknis terlarang di `title`/`message` sesuai `MAIN_SCREEN_BANNED`).
  - Di **Linux** (Colab): perilaku dan teks yang sudah ada tetap sama.

#### C. Komponen 2: Pelacak Wajah Teliti (`addon_id = "mediapipe"`)
- **Kapan relevan (`available: true`):** semua platform desktop dan web lokal (Windows, macOS arm64/x64, Linux) kecuali cloud mode.
- **Apa yang diunduh:** wheel `mediapipe` universal (`py3-none-<platform_tag>`) beserta 2 dependensi inti kecilnya (`flatbuffers`, `absl-py`) yang dipilih otomatis dari JSON PyPI agar cocok dengan OS/arsitektur (`win_amd64`, `macosx_11_0_arm64`/`macosx_*_x86_64`, `manylinux_*`), plus model `face_landmarker.task` (~3,7 MB) dari URL resmi Google Storage. File non-esensial di dalam wheel (`matplotlib`, `opencv-contrib-python`, `sounddevice`, dokumentasi, stub) tidak diunduh atau disaring saat ekstraksi. Total footprint di disk sekitar 35–48 MB (tidak termasuk OpenCV headless yang sudah ada di aplikasi).
- **Aktivasi & dukungan API ganda di `backend/crop_utils.py`:**
  - `addons.ensure_mediapipe_importable()` menyisipkan `<app_data_dir>/addons/mediapipe/` ke `sys.path` (jika belum ada di `sys.path`), dan sebelum meng-import `mediapipe` memastikan stub ringan untuk `matplotlib`, `matplotlib.pyplot`, dan `sounddevice` tersedia di `sys.modules` bila modul asli tidak terpasang (karena `mediapipe.tasks.python.vision.__init__` melakukan top-level `import matplotlib.pyplot` untuk fungsi gambar yang tidak pernah dipakai `auto-clipper`).
  - `_open_face_mesh()` dan `_mediapipe_faces()` mendukung **dua API secara transparan**:
    1. `mp.solutions.face_mesh.FaceMesh` (kompatibel mundur jika pengguna memakai `mediapipe <= 0.10.x` di macOS/Colab/venv lama).
    2. `mediapipe.tasks.python.vision.FaceLandmarker` (standar `mediapipe >= 1.0`) yang memakai model `<addon_dir>/face_landmarker.task` dengan mode `IMAGE`/`VIDEO` dan tetap mengekstrak indeks landmark wajah yang sama (`13, 14, 78, 308, 234, 454`) serta `close()` di blok `finally`.
  - Jika mode `teliti` dipilih tetapi komponen belum terpasang (mis. job dari riwayat lama atau pengaturan tersimpan), pipeline tetap jatuh aman ke `haar`, mencatat alasannya lewat `log_app`, dan mencatat `tracking_engine_used = "haar"`.

#### D. Kontrak API dan UI Pengaturan
- **Endpoint backend (`backend/main.py`):**
  - `GET /api/settings/addons` → mengembalikan status tiap komponen (`cuda`, `mediapipe`):
    `{ id, available, installed, downloading, percent, downloaded_mb, total_mb, size_hint_mb, disk_mb, error_info? }`
  - `POST /api/settings/addons/{addon_id}/download` → memulai unduhan di thread latar belakang (satu unduhan per komponen dalam satu waktu; menolak 404 untuk `addon_id` tidak dikenal dan 400 bila `available: false`), mengembalikan status `202`/`200` sehingga UI bisa melakukan polling ringan `GET /api/settings/addons` setiap 0,5 detik sampai selesai.
  - `DELETE /api/settings/addons/{addon_id}` → menghapus folder komponen dari `<app_data_dir>/addons/<addon_id>/` untuk menghemat ruang penyimpanan.
- **UI Pengaturan (`Pengaturan → Lanjutan`):**
  - Pada **`TranscriptionSection.tsx` (Model subtitle):** bila `gpu_addon.available && !gpu_addon.installed` (artinya pengguna memakai Windows dengan kartu NVIDIA tanpa `cublas64_12.dll`), tampilkan kartu/baris opsional *"Percepat pembuatan subtitle dengan GPU"* berisi perkiraan ukuran (~530 MB), tombol **"Pasang dukungan GPU"**, progres persen saat mengunduh, serta tombol **"Hapus dukungan GPU"** saat sudah terpasang. Setelah terpasang, panggil ulang `preflight` agar status GPU di Buat klip langsung berubah menjadi hijau.
  - Pada **`TrackingSection` / pemilih Cara mengikuti wajah di `SettingsPage.tsx`:** jika pengguna memilih **Teliti** sedangkan komponen `mediapipe` belum terpasang (`available && !installed`), tampilkan keterangan ukuran (~30–45 MB) dan tombol **"Pasang pelacak teliti"** (beserta progres & tombol **"Hapus komponen"** saat terpasang).
  - Seluruh teks wajib mengikuti aturan `plainWords.test.ts` dan kontras WCAG AA (`contrast.test.ts`).

---

### 4.3 Penyesuaian Model Subtitle Whisper pada Prosesor (CPU)

1. **`GET /api/settings/whisper-models`:**
   Menambahkan informasi kesiapan perangkat:
   - `gpu_ready`: `bool` (`True` hanya bila `_cuda_device_count() >= 1` dan `_whisper_gpu_libs_missing() == []`).
   - `processor_slow_models`: `["medium", "large-v3"]`.
2. **Tampilan di `Pengaturan → Lanjutan → Model subtitle` (`TranscriptionSection.tsx`):**
   - Untuk model `medium` dan `large-v3`, tampilkan catatan yang jelas ketika `gpu_ready` bernilai `false`: bahwa model ini disarankan bersama GPU dan di prosesor video 30 menit bisa memakan waktu lebih dari satu jam (catatan tetap sopan dan tidak memblokir unduhan jika pengguna memang menginginkannya untuk klip/video pendek).
3. **Konfirmasi cepat di `Buat klip` (`CreatePage.tsx`):**
   - Ketika pengguna menekan **Mulai** dan:
     - langkah subtitle akan berjalan (membuat klip seperti biasa), **dan**
     - `whisperModel` yang aktif adalah `medium` atau `large-v3`, **dan**
     - hasil pemeriksaan awal `gpu` berlevel `warn` (memakai prosesor, termasuk saat kartu NVIDIA belum memasang komponen GPU),
     tampilkan dialog `Dialog` singkat sebelum mengirim permintaan `/jobs`:
     - Judul & isi awam: menjelaskan bahwa pilihan model **Akurat** berjalan di prosesor (untuk video 30 menit bisa lebih dari 1 jam), sementara model **Cepat** (`small`) selesai jauh lebih cepat.
     - Tombol utama (terisi): **"Pakai model Cepat (disarankan)"** → mengubah pilihan `whisperModel` sesi/job ini menjadi `small` dan langsung memulai job.
     - Tombol kedua (garis): **"Tetap pakai model Akurat"** → langsung memulai job dengan model pilihan pengguna tanpa mengubah pengaturan.
   - Pengunduh video di Pengaturan (`DownloaderPanel`) dengan saklar "Tambahkan subtitle" mati tidak memicu dialog ini karena tidak menjalankan tahap subtitle.

---

### 4.4 Startup Cepat & Penghematan RAM Sidecar

Target terukur: menekan waktu muat awal (`import backend.main` + `GET /api/preflight` + `import backend.jobs`) dan memangkas ~60–75 MB RAM awal dengan menghilangkan top-level import modul berat yang belum dibutuhkan saat aplikasi dibuka:

1. **`backend/video_utils.py`:**
   - Pindahkan `import yt_dlp` ke dalam fungsi yang membutuhkannya (`probe_formats`, `download_youtube_video`, `_download_with_opts`, dll.).
   - Dengan demikian, memanggil `get_ffmpeg_path()` (di startup/preflight atau di `crop_utils.py`) tidak lagi meng-import `yt_dlp`.
2. **`backend/ai_utils.py`:**
   - Pindahkan `from openai import OpenAI` dan `from google import genai` (+ `types`) ke dalam fungsi pemanggil API (`ping_provider`, `fetch_provider_models`, `process_with_*`, `correct_subtitle_words_with_ai`, `generate_social_kit_only`).
   - Pengguna jalur bawaan **AI manual** tidak akan pernah memuat SDK `openai` dan `google.genai` ke memori.
3. **`backend/crop_utils.py` & `backend/preflight.py`:**
   - Pindahkan fungsi pengecekan `is_nvenc_available()` (atau implementasi FFmpeg probe-nya menggunakan `get_ffmpeg_path()` + `subprocess.run`) sehingga `preflight.check_gpu_render()` dan `import backend.crop_utils` tidak langsung meng-import `cv2` dan `numpy` di tingkat modul apabila hanya melakukan cek encoder atau utilitas timestamp (`to_seconds`).
   - Pastikan `cv2` dan `numpy` baru di-import saat fungsi video/pelacakan wajah (`detect_primary_face_center`, `sample_face_trajectory`, `crop_to_vertical`, dll.) dipanggil.
   - Catatan kompatibilitas tes: periksa semua monkeypatch di `backend/tests/test_crop_utils.py` dan `test_preflight.py` agar atribut modul `crop_utils.is_nvenc_available` dan `crop_utils.cv2` (jika ada tes yang me-mock-nya) tetap kompatibel atau diperbarui bersama.
4. **Pembersihan memori setelah tahap berat:**
   - Setelah pelacakan wajah di `crop_utils.py` selesai (baik Haar maupun MediaPipe), pastikan referensi detector dan frame dibersihkan dan `gc.collect()` dipanggil sebelum tahap render FFmpeg dimulai.

---

### 4.5 Penjagaan `output_dir` (`T1.y`) dan Putar/Simpan Klip di Folder Kustom Desktop

Menutup temuan `T1.y` yang tertunda dari SP1 & SP2 sekaligus memperbaiki bug pemutaran/penyimpanan klip saat pengguna Desktop memilih folder hasil di luar `AppData`:

1. **Pembatasan per platform dan `path_guard` di backend (`backend/main.py` & `backend/jobs.py`):**
   - Tambahkan helper `_resolve_safe_output_dir(output_dir: str, endpoint: str) -> tuple[str, Optional[JSONResponse]]`:
     - Jika berjalan dalam mode **Cloud** (`AUTO_CLIPPER_CLOUD_MODE`) atau **Web Lokal** (`web_ui.is_web_mode()`): abaikan dan kosongkan `output_dir` dari request (selalu gunakan pustaka bawaan `<get_app_data_dir()>/projects`), sehingga klien web atau tunnel tidak pernah bisa menulis ke path bebas di server.
     - Jika berjalan di mode **Desktop**: bila `output_dir` tidak kosong, normalisasi ke `os.path.abspath(output_dir.strip())` lalu periksa dengan `path_guard.is_protected(resolved)`. Jika menyentuh folder/file terproteksi aplikasi (`cookies/`, `history.db*`, `backend_*.log`, `video_signing.key`, `web_*.json`), tolak segera dengan `path_guard.denied(endpoint, output_dir)` (`403 Access denied`).
   - Terapkan `_resolve_safe_output_dir` pada **semua** endpoint pembuat/pengulang job yang menerima `output_dir`: `POST /jobs`, `POST /jobs/manual`, `POST /jobs/{job_id}/rerender`, dan `POST /jobs/{job_id}/rerun_ai`.
   - Di `jobs.get_project_workspace(title, output_dir, job_id)`: bila `output_dir` diberikan, pastikan `library_dir` yang sudah digabungkan dengan `safe_title` tidak pernah keluar sebagai path terproteksi (`path_guard.is_protected(library_dir)` → lempar `AppError` / tolak).

2. **Mengizinkan `/video` dan `/save_file` membaca folder hasil proyek Desktop yang sah:**
   - Saat ini `GET /video` hanya mengizinkan path di dalam `get_app_data_dir()`, `os.getcwd()`, atau `get_work_dir()`, dan `POST /save_file` hanya mengizinkan `is_within(req.src, get_app_data_dir())`.
   - Tambahkan fungsi helper terpusat (mis. di `backend/workspace.py` atau `backend/path_guard.py`) `allowed_project_output_dirs() -> list[str]` yang mengumpulkan `output_dir` tidak kosong yang masih lolos `not is_protected(...)` dari:
     - `active_jobs` (proyek yang sedang berjalan / baru selesai di sesi ini), dan
     - `db.get_all_history()` (kolom `metadata.output_dir` dan parent proyek dari `result_clips`).
   - Perbarui `GET /video` dan `POST /save_file`:
     - Urutan pemeriksaan keamanan **wajib** tetap: (1) `path_guard.is_protected(path)` → 403, (2) untuk `/video`, `video_sign.verify(path, sig)` → 403, (3) `is_within(path, dir)` terhadap daftar direktori sah `[get_app_data_dir(), get_work_dir(), ...allowed_project_output_dirs()]` (dan `os.getcwd()` khusus `/video` sesuai perilaku lama).
     - Hasilnya: file sembarang di disk (misalnya `C:\Windows\...` atau `D:\Rahasia\...`) tetap ditolak `403`, sedangkan klip di folder hasil pilihan pengguna Desktop (`D:\KlipSaya\JudulProyek\clips\clip_01.mp4`) dapat diputar di `<video>` dan disalin lewat **Unduh semua** (`/save_file`).

---

## 5. Pengujian dan Verifikasi

### Backend (`pytest`)
- **Uji `addons.py` (dengan mock HTTP/PyPI JSON + zip wheel sintetis):**
  - Pengunduhan & ekstraksi atomik `cuda` (`cublas64_12.dll` + `cublasLt64_12.dll` saja, melewati file lain, menulis via `.part`), serta verifikasi SHA-256 menolak file rusak dan tidak menimpa instalasi yang sudah ada.
  - Pengunduhan & ekstraksi `mediapipe` (`mediapipe`, `flatbuffers`, `absl-py`, `face_landmarker.task` tanpa `matplotlib`/`opencv-contrib`), serta penghapusan via `DELETE /api/settings/addons/{id}`.
  - Endpoint `GET /api/settings/addons`, `POST /api/settings/addons/{id}/download`, `DELETE /api/settings/addons/{id}` (termasuk penolakan `404` id tidak dikenal, `400` di cloud mode, dan kebutuhan token di mode web lokal/cloud).
- **Uji `preflight.py` & `crop_utils.py`:**
  - `_whisper_gpu_libs_missing()` di Windows saat GPU NVIDIA ada tetapi `cublas64_12.dll` belum ada → cek `gpu` berlevel `warn` dengan teks tanpa kata terlarang (`MAIN_SCREEN_BANNED`).
  - `crop_utils` mendukung `FaceLandmarker` (mocked) maupun `FaceMesh` lama, menutup instance di `finally`, dan jatuh aman ke `haar` bila add-on belum terpasang.
- **Uji lazy-import startup:**
  - Subproses Python terisolasi memastikan meng-import `backend.main`, memanggil `run_preflight()`, dan meng-import `backend.jobs` tidak memuat modul `yt_dlp`, `cv2`, `openai`, maupun `google.genai` ke `sys.modules`.
- **Uji `output_dir` (`T1.y`):**
  - Mode Cloud dan Web Lokal mengabaikan/mengosongkan `output_dir` bebas pada `/jobs`, `/jobs/manual`, `/jobs/{id}/rerender`, `/jobs/{id}/rerun_ai`.
  - Mode Desktop menolak `output_dir` yang menunjuk path terproteksi (`403 Access denied`), sementara `output_dir` kustom yang sah diizinkan untuk `GET /video` (dengan `sig` valid) dan `POST /save_file` (tetap menolak path bebas yang bukan folder proyek).

### Frontend (`Vitest`, `oxlint`, build)
- Uji komponen `TranscriptionSection.tsx` untuk kartu dukungan GPU Windows (state siap, belum terpasang, mengunduh dengan persen, gagal, hapus) dan label anjuran model `medium`/`large-v3` saat `gpu_ready === false`.
- Uji pemilih pelacakan wajah di Pengaturan untuk pemasangan/penghapusan komponen mode **Teliti**.
- Uji `CreatePage.tsx` untuk dialog konfirmasi model Whisper pada prosesor (**Pakai model Cepat (disarankan)** vs **Tetap pakai model Akurat**).
- Uji penjaga otomatis yang sudah ada: `locales.test.ts` (kesamaan kunci `id`/`en`), `plainWords.test.ts` (bebas istilah teknis/emoji/em dash), `contrast.test.ts`, `oxlint src` (0 error), `npm run build`, dan `npm run build:cloud`.

### Tolok Ukur Akhir (Sebelum Selesai SP3)
- Catat perbandingan **sebelum vs sesudah SP3**: ukuran total paket/PyInstaller (`dist/backend.exe` / folder `site-packages`), waktu + RAM startup (`import backend.main` + `run_preflight()` + `import backend.jobs`), serta uji asap pada mesin Windows ber-GPU NVIDIA setelah memasang komponen GPU.
