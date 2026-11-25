# ADR-015: Bundel Ringan, Komponen Tambahan Terkunci SHA-256, Lazy Startup, dan Keamanan Folder Hasil (`T1.y`)

- **Status**: Accepted
- **Date**: 2026-11-25
- **Context**: SP3 "Ringan", rilis v1.19.0. Spec: `docs/superpowers/specs/2026-11-24-sp3-lightweight-design.md`. Rencana: `docs/superpowers/plans/2026-11-24-sp3-lightweight.md`. Ledger & keputusan per task: `tasks/sp3-ledger.md`.

---

## 1. Konteks & Masalah

1. **Bundel PyInstaller terlalu besar (~260 MB beban transitif):** `mediapipe>=0.10.0` di `backend/requirements.txt` menarik `opencv-contrib-python` 5.0 (menimpa `opencv-python-headless`, menggandakan DLL videoio menjadi `176,5 MB`) serta `matplotlib` + `fontTools` + `PIL` (`62,3 MB`), dan `backend.spec` memanggil `collect_all()` seragam pada 19 paket beserta seluruh XML cascade OpenCV. Selain itu, pada `mediapipe >= 1.0` (`1.2.3`), `mediapipe.solutions` sudah dihapus Google sehingga pelacakan **Teliti** diam-diam gagal dan jatuh ke Haar.
2. **Subtitle Desktop Windows dengan GPU NVIDIA jatuh ke prosesor:** `ctranslate2.dll` di Windows membutuhkan `cublas64_12.dll` + `cublasLt64_12.dll` (~527,5 MB di `nvidia-cublas-cu12`). Membundelnya ke installer menggandakan ukuran unduhan semua pengguna, sementara `preflight.py` sebelumnya hanya mengecek pustaka GPU di Linux sehingga preflight Windows diam-diam mengklaim GPU aktif.
3. **Model subtitle lambat di prosesor tanpa peringatan:** Memilih `medium` atau `large-v3` pada perangkat tanpa GPU dapat memakan waktu >1 jam untuk video 30 menit tanpa peringatan di Pengaturan maupun saat **Mulai**.
4. **Startup sidecar memuat library berat sejak awal (`119,9 MB` RSS / `3,77 dtk`):** `import backend.main` + `run_preflight()` + `import backend.jobs` ikut meng-import `yt_dlp`, `cv2`, `numpy`, `openai`, dan `google.genai` lewat import tingkat atas di `video_utils.py`, `crop_utils.py`, dan `ai_utils.py`.
5. **Celah keamanan `output_dir` (`T1.y`) dan `403` di folder kustom Desktop:** `output_dir` belum dijaga `path_guard` di semua platform, judul titik-titik seperti `..` bisa menunjuk ke folder induk, sementara di Desktop memilih `output_dir` di luar `AppData` membuat `/video` dan `/save_file` menolak dengan `403 Access denied`.

---

## 2. Keputusan Arsitektur

### A. Satu Aplikasi Lite + Pemangkasan Bundel (`backend/requirements.txt`, `backend.spec`)
- Tetap satu aplikasi utama (tidak memecah rilis Desktop/Web Lokal menjadi edisi Lite dan Biasa agar rilis CI dan updater `latest.json` tetap tunggal) dengan pemaketan Windows tetap `--onefile` dan macOS `--onedir` (ADR-010).
- `mediapipe` dikeluarkan dari `backend/requirements.txt`.
- `backend.spec` hanya memanggil `collect_all` untuk paket native yang membutuhkannya (`faster_whisper`, `ctranslate2`, `onnxruntime`, `av`, `numpy`, `certifi`, serta DLL/pyd `cv2` + hanya `haarcascade_frontalface_default.xml`), menghapus `tests/`, `test/`, header (`*.h`, `*.hpp`), `*.lib`, `*.pdb`, dan cascade XML lain, serta mendaftarkan `wave`, `csv`, `timeit`, `getpass`, `xml` di `hiddenimports` dan `copy_metadata('yt-dlp')` agar muat dinamis add-on MediaPipe (`mediapipe.tasks`) dan cek versi pengunduh tetap jalan di `.exe` terbekukan.

### B. Startup Lazy-Import (`backend/_lazy.py`)
- Menggunakan proxy `LazyModule` / `LazyAttr` (`yt_dlp`, `OpenAI`, `genai`, `types`, `cv2`, `np`) agar `backend.main`, `preflight.run_preflight()`, dan `backend.jobs` tidak memuat modul berat sampai fungsi pemakainya dipanggil, sekaligus menjaga kompatibilitas penuh dengan `@patch('backend.<mod>.<attr>')` di test suite.
- `preflight._downloader_version()` membaca versi via `importlib.metadata.version("yt-dlp")` tanpa meng-import `yt_dlp`.
- `crop_utils.sample_face_trajectory()` memanggil `gc.collect()` setelah pelacakan wajah untuk melepas memori frame sebelum render FFmpeg.

### C. Pengunduh Komponen Opsional Terkunci SHA-256 (`backend/addons.py`)
- Seluruh komponen opsional dikelola `backend/addons.py` dengan versi, URL HTTPS resmi (`pypi.org`, `files.pythonhosted.org`, `storage.googleapis.com`), panjang byte, dan digest SHA-256 yang dikunci keras di `PINNED_ADDONS` (never floating latest):
  1. `cuda` (Windows x64 NVIDIA, `nvidia-cublas-cu12==12.9.2.10`): mengekstrak `cublasLt64_12.dll` dan `cublas64_12.dll` ke `<app_data_dir>/addons/cuda/bin/`. `activate_installed()` memanggil `os.add_dll_directory()`, memperbarui `PATH`, dan mem-preload kedua DLL via path penuh saat startup dan sebelum transkripsi Faster-Whisper.
  2. `mediapipe` (`mediapipe==1.2.3` + `flatbuffers==25.12.19` + `absl-py==2.5.1` + `face_landmarker.task` float16 v1; nonaktif di macOS Intel karena wheel resmi `py3-none` tidak tersedia): mengekstrak paket yang dibutuhkan saja (menyaring `matplotlib` & `opencv-contrib-python`). `ensure_mediapipe_importable()` menambah folder add-on ke `sys.path` dan memasang stub minimal `matplotlib` / `sounddevice` bila tidak tersedia.
- Unduhan ditulis melalui folder `.part` lalu `os.replace`. Penghapusan yang tertahan kunci DLL Windows (`ADDON_IN_USE`) menulis penanda `.pending_remove_<id>` dan diselesaikan di awal `activate_installed()` pada startup berikutnya sebelum DLL dimuat.
- **Teliti di Colab (keputusan pemilik 2026-11-24):** Notebook Langkah 3 (`Auto_Clipper_Colab.ipynb`) memanggil `addons.install_colab_mediapipe()` untuk memasang wheel terkunci `linux_x86_64` + dependensi + `face_landmarker.task` ke `<repo>/bin/mediapipe_colab` (disk lokal Colab, tidak pernah menyentuh Google Drive atau `get_app_data_dir()`). Di mode Cloud, `_cloud_mediapipe_importable()` dan `_build_status()` membaca dari sana tanpa mutasi `sys.path`/`sys.modules` dan tetap menolak endpoint `POST`/`DELETE` dengan HTTP `400`.

### D. Pelacakan Wajah Ganda, Peringatan Model CPU & UI Pengaturan
- `backend/crop_utils.py` menambahkan `_FaceLandmarkerAdapter` (dibantu kelas wrapper ber-`__slots__` `_LandmarkerFace` dan `_LandmarkerResult`) agar `mediapipe.tasks.vision.FaceLandmarker` (1.0+) dan `mp.solutions.face_mesh.FaceMesh` bekerja seragam. Saat **Teliti** gagal atau add-on belum terpasang, pipeline otomatis jatuh ke `haar` dengan mencatat `log_app` + `log_error`, mengirim status live `haar_fallback` via `stage_timer.report(device="haar_fallback")`, dan memperbarui metadata per klip melalui `jobs._sync_stage_metadata()` (sekaligus membersihkan `tracking_fallback_reason` basi pada resume/rerender baru; `create_resume_job` dan `create_rerender_job` mengawali `metadata["timings"] = []`).
- `backend/stage_timer.py` menjaga `DEVICE_FIELDS` khusus perangkat aktif dan memprioritaskan `top.get("device")` di `current_stage()`.
- `backend/preflight.py` mengecek `cublas64_12.dll` di Windows dengan teks awam yang mengarahkan ke Pengaturan → Lanjutan → Model subtitle. `GET /api/settings/whisper-models` menyertakan `gpu_ready` dan `processor_slow_models`.
- Frontend menambahkan `useAddons`, `AddonControls`, `FaceTrackingSection`, peningkatan `TranscriptionSection` (catatan prosesor + kartu dukungan kartu grafis + konfirmasi hapus untuk add-on GPU ~528 MB), catatan `fallback_tracking` / `fallback_tracking_failed` di `ProgressPanel` berbasis baris timing `tracking` run ini dan status hidup `current`, serta dialog konfirmasi `Dialog` di `CreatePage.tsx` saat memilih `medium`/`large-v3` sementara pemeriksaan `gpu` memberi peringatan (tombol utama mengganti ke `small`, tetap mempertahankan panggilan 2 argumen untuk start langsung sesuai Ruling P9).

### E. Penjagaan `output_dir` (`T1.y`) dan Keamanan Path Jaringan/Perangkat
- **Platform split & normalisasi (`backend/main.py`, `backend/jobs.py`):** `_resolve_safe_output_dir()` di `backend/main.py` mengabaikan/mengosongkan **request** `output_dir` di mode **Cloud** dan **Web Lokal** (`web_ui.is_web_mode()`); di **Cloud** saja helper workspace (`_usable_output_dir`, `allowed_project_output_dirs`) serta fallback `output_dir` dari histori lama (`rerender`, `rerun_ai`, `resume`, `resume_manual`) juga diabaikan ke pustaka bawaan, sedangkan Web Lokal/Desktop tetap melanjutkan proyek dari histori lokalnya. Di **Desktop**, `_resolve_safe_output_dir()` hanya menerima path absolut huruf drive lokal (Windows) atau absolut POSIX, menolaknya jika berupa UNC/perangkat/stream NTFS, menyimpannya dalam bentuk `realpath` (atau `abspath` huruf drive untuk drive jaringan yang dipetakan bila `realpath` berubah ke UNC), dan menolak `403 Access denied` bila `output_dir` maupun `<output_dir>/<safe_title>` terproteksi `path_guard`. `jobs.refuse_protected_project_dir()` juga menolak folder proyek yang sama dengan atau mengandung folder internal (`projects/`, `addons/`, `temp_downloads/`, `cookies/`) atau berada di dalam `addons/`/`temp_downloads/`. `sanitize_title()` menolak nama titik-saja (`..`) serta memangkas titik/spasi di akhir nama folder pada semua platform.
- **Hardening `path_guard` & `/assets` (`backend/path_guard.py`, `backend/web_ui.py`):** Semua bentuk path perangkat NT yang tidak diawali drive canonical (`\\?\GLOBALROOT\...`, `\\?\Volume{...}\`, `\\.\...`, `\??\...`) dan NTFS alternate data stream (`:` di luar huruf drive) dipastikan gagal tertutup (`is_protected() == True`, `is_within() == False`). `/video`, `/save_file`, dan `/assets/` menolak path UNC (`\\`, `//`) dan prefiks perangkat **secara teks lebih dulu** sebelum memanggil `os.path.realpath` / `os.path.join` sehingga permintaan ke share jaringan tidak pernah memicu koneksi SMB/NTLM.
- **Akses klip folder kustom Desktop:** `workspace.allowed_project_output_dirs(active_jobs)` mengembalikan daftar folder proyek per item (`<output_dir>/<safe_title>`, bukan seluruh folder parent) dari job aktif dan riwayat yang tidak terproteksi (kosong di Cloud mode). `GET /video` (sesudah `is_protected` → `video_sign.verify`) dan `POST /save_file` (termasuk work dir untuk menyimpan klip sementara) memeriksa `path_guard.is_within()` terhadap daftar folder sah tersebut.

---

## 3. Hasil Benchmark (Terukur di Windows 11, Python 3.12 `ac-venv`)

### A. Waktu Muat Awal & RAM Sidecar (Median 3 subproses Python bersih)
Mengukur: `import backend.main` → `preflight.run_preflight()` → `import backend.jobs`:

| Tahap | Sebelum (`9ff373f`, spec 1.5) | Sesudah (`feat/sp3-lightweight`) | Perubahan |
|---|---|---|---|
| `import backend.main` | 0,63 dtk · 43,5 MB RSS | 0,844 dtk · 44,4 MB RSS | — |
| `preflight.run_preflight()` | +1,90 dtk · 88,1 MB RSS | +0,592 dtk · 61,1 MB RSS | **−27,0 MB RSS**, 3,2× lebih cepat |
| `import backend.jobs` | +1,24 dtk · 119,9 MB RSS | +0,006 dtk · 61,3 MB RSS | **~200× lebih cepat**, −58,6 MB RSS akhir |
| **Total (`main + preflight + jobs`)** | **3,77 dtk · 119,9 MB** | **1,442 dtk · 61,3 MB** | **2,6× lebih cepat · −48,9% RAM** |
| Modul berat di `sys.modules` | `yt_dlp`, `cv2`, `numpy`, `openai`, `google.genai` termuat | `[]` (**0** modul berat termuat) | Terbukti lewat tes subproses terisolasi |

### B. Ukuran `.exe` PyInstaller (`backend.spec --clean`, Windows `--onefile`)
- **Baseline `9ff373f` (`backend.exe`):** **248,99 MB**
- **Sesudah SP3 (`backend.exe`, dibangun di `ac-venv` lokal):** **198,68 MB** (`208.326.098` byte, **−50,31 MB / −20,2%**).
- *Catatan lingkungan:* Venv lokal `ac-venv` masih memiliki `opencv-contrib-python` 5.0 bekas sebelum SP3 (di spec 1.1 paket `cv2` itu berjumlah `176,5 MB` mentah, vs `opencv-python-headless` yang lebih ramping). Pada build CI bersih dari `backend/requirements.txt`, `opencv-contrib-python` tidak pernah terpasang sehingga ukuran akhir installer lebih kecil lagi.

---

## 4. Konsekuensi

- Pengguna baru mendapat aplikasi lebih ringan (~50–260 MB lebih kecil tergantung lingkungan build) dengan startup 2,6× lebih cepat dan pemakaian RAM awal hampir setengahnya, tanpa mengubah alur utama Desktop, Web Lokal, maupun Colab.
- Pengguna Windows dengan GPU NVIDIA atau pengguna Desktop/Web Lokal yang memilih **Teliti** dapat memasang komponen opsional dari Pengaturan dengan verifikasi SHA-256 terkunci; di Colab hal ini otomatis siap dari Langkah 3 notebook.
- Pengaturan `PINNED_ADDONS` perlu diperbarui bersama digest SHA-256-nya bila di masa depan versi `nvidia-cublas-cu12`, `mediapipe`, `flatbuffers`, `absl-py`, atau model `face_landmarker.task` dinaikkan.
- Folder proyek di jaringan UNC pada Desktop tidak didukung (pengguna NAS harus memetakan ke huruf drive lokal agar lolos aturan path lokal absolut).
