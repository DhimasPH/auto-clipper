# Log Progres dan Cara Melanjutkan

Dokumen ini dibaca pertama kali oleh sesi baru. Daftar task ada di `tasks/roadmap-todo.md`, spec di `docs/superpowers/specs/2026-11-12-pipeline-stability-design.md`.

## Protokol kuota sesi 5 jam

Preferensi pemilik: saat pemakaian sesi 5 jam mencapai sekitar 80%, pekerjaan berhenti, hasilnya di-commit, dan log ini diperbarui supaya bisa dilanjutkan setelah kuota reset.

Catatan teknis: Claude tidak bisa membaca persentase kuota. Pemilik yang menyebutkan angkanya ("sudah 80%"), atau mengetik `/usage` lalu memberi tahu. Sampai itu terjadi, aturan pengaman berlaku:

1. Setiap kali satu task selesai dan tesnya lulus, buat commit di branch kerja dan perbarui log ini.
2. Saat pemilik bilang kuota sudah 80% atau "stop dulu": hentikan agen yang berjalan, jalankan `pytest backend/tests`, commit sebagai `wip(sp0): ...` bila belum hijau, dan tulis entri baru di bawah.
3. Jangan pernah mencentang task di `roadmap-todo.md` tanpa hasil tes yang benar-benar dijalankan.

## Cara melanjutkan di sesi baru

1. `git checkout feat/sp0-pipeline-stability` lalu `git log --oneline -10` dan `git status`.
2. Baca entri terakhir di bawah, lalu `tasks/roadmap-todo.md`.
3. Jalankan `pytest backend/tests`. Catat hasilnya sebagai baseline sesi itu.
4. Lanjutkan task pertama yang belum `[x]`, dengan TDD dan aturan di `.agents/AGENTS.md`.
5. Python untuk tes: venv di `C:\Users\dhima\projects\ac-venv` (Python 3.12, di luar repo). Jalankan tes dengan `C:\Users\dhima\projects\ac-venv\Scripts\python.exe -m pytest backend/tests -q`. `python` di PATH hanya shortcut Microsoft Store, jangan dipakai.

## Entri

### 2026-11-12 · titik simpan pertama (WIP, belum diverifikasi)

Dikerjakan oleh agen Fable (effort high) di branch `feat/sp0-pipeline-stability`. Agen masih berjalan saat entri ini ditulis dan belum memberi laporan akhir.

Bukti dari repo saat commit ini dibuat:

| Task | Yang ada di repo | Yang belum diketahui |
|---|---|---|
| T0.1 `stage_timer` | `backend/stage_timer.py`, `test_stage_timer.py`, `test_pipeline_timings.py`, perubahan di `jobs.py` | Hasil tes |
| T0.2 skrip benchmark | `scripts/benchmark_pipeline.py`, `test_benchmark_script.py` | Hasil tes. Pengukuran di Colab belum dilakukan `[!]` |
| T0.3 error terstruktur | `backend/errors.py`, `test_errors.py`, `test_error_integration.py` | Hasil tes |
| T0.4 antrean job | `backend/job_queue.py`, `test_job_queue.py`, `test_jobs_queue_integration.py` | Hasil tes, cakupan semua titik pembuatan thread |
| T0.5 mediapipe | perubahan di `crop_utils.py` dan `test_crop_utils.py` | Hasil tes |
| T0.6 format unduhan | perubahan di `video_utils.py` dan `test_video_utils.py` | Hasil tes |
| T0.7 preflight | `backend/preflight.py` baru muncul, kemungkinan belum lengkap | Endpoint, tes, dan integrasi ke job |

Hal yang perlu diperiksa sesi berikutnya:

- **Tidak ada task yang dicentang** di `roadmap-todo.md`. Centang hanya setelah tes dijalankan dan lulus.
- `backend/crop_utils.py` menunjukkan ±478 baris berubah. Jalankan `git diff -w --stat backend/crop_utils.py` untuk memastikan itu bukan sekadar perubahan akhir baris (CRLF/LF). Jika iya, kembalikan agar riwayat diff bersih.
- Baseline tes sebelum perubahan agen belum kuketahui. Jika ada tes gagal, bandingkan dengan `git stash` atau commit `072164d`.
- Fase 3 sampai 5 (T0.8–T0.15) belum disentuh. T0.2 dan T0.14 butuh sesi Colab pemilik.

Langkah berikutnya yang disarankan: verifikasi T0.1–T0.7 dengan tes nyata, centang yang valid, lalu mulai Fase 3 (T0.8 workspace lokal).

### 2026-11-12 · berhenti karena kuota sesi 5 jam mencapai 81%

Agen Fable dihentikan oleh Claude atas permintaan pemilik. Agen tidak sempat memberi laporan akhir.

Koreksi terhadap entri sebelumnya:

- Dugaan bahwa agen "di T0.6 menuju T0.7" **tidak bisa dipegang**. Pesan terakhir agen: "Now the failing tests for the new T0.5 behavior." Artinya T0.5 mungkin sedang dalam tahap tes-gagal-dulu (TDD merah) dan belum selesai, sementara `preflight.py` dan `test_preflight.py` (T0.7) sudah ada. Pengerjaan tidak tentu berurutan.
- Perubahan setelah commit pertama hanya 2 file kecil: `backend/jobs.py` (1 baris) dan `backend/tests/test_preflight.py` (+13 baris).
- **Tes belum pernah dijalankan oleh siapa pun.** Di mesin ini `python` hanya berupa shortcut Microsoft Store (`WindowsApps\python.exe`), `py` tidak ada, dan tidak ditemukan venv. Tidak ada task yang boleh dicentang sebelum ada interpreter Python sungguhan.
- Tidak ada task di `roadmap-todo.md` yang dicentang. Itu memang benar adanya.

Status per task: semuanya **tidak terverifikasi**. Anggap T0.1–T0.7 sebagai "kode awal ada, kemungkinan tidak lengkap".

Langkah pertama sesi berikutnya, berurutan:

1. Pasang Python 3.11+ sungguhan (misalnya dari python.org atau `winget install Python.Python.3.12`), buat venv di luar repo, `pip install -r backend/requirements.txt`. Jika mediapipe atau faster-whisper sulit dipasang, tes harus memakai mock seperti tes yang sudah ada.
2. Jalankan baseline: `git stash` tidak perlu, cukup `git checkout 072164d -- backend` di worktree terpisah (`git worktree add ../ac-baseline 072164d`) lalu `pytest backend/tests`. Catat tes yang sudah gagal sebelum perubahan agen.
3. Kembali ke branch ini, jalankan `pytest backend/tests`, dan bandingkan dengan baseline.
4. Periksa T0.5 lebih dulu (`backend/crop_utils.py`, `backend/tests/test_crop_utils.py`): pastikan ada tes yang membuktikan `FaceMesh.close()` dipanggil saat exception dan ada `log_error` saat mediapipe gagal.
5. Setelah itu selesaikan T0.7, lalu centang task yang benar-benar hijau satu per satu.

### 2026-11-12 · T0.1–T0.7 diverifikasi dengan tes nyata

Lingkungan: Python 3.12.10 dipasang lewat winget (lingkup pengguna), venv di `C:\Users\dhima\projects\ac-venv`, `pip install -r backend/requirements.txt` berhasil (mediapipe dan faster-whisper ikut terpasang).

Hasil tes:

| Kondisi | Hasil |
|---|---|
| Baseline `072164d` (sebelum SP0) | 150 lulus, 5 gagal |
| Branch saat sesi dimulai (`b3e08dd`) | 326 lulus, 6 gagal |
| Branch setelah perbaikan sesi ini | **332 lulus, 0 gagal** |

Yang diperbaiki di sesi ini:

- 5 kegagalan lama di `test_crop_utils.py` (sudah ada di baseline, bukan dari SP0): `smooth_trajectory`, `apply_deadband_filter`, dan `build_dynamic_crop_filter` sekarang menerima titik `(t, x, lebar)` yang memang dihasilkan `sample_face_trajectory`, dan lebar wajah ikut diteruskan.
- 1 tes merah T0.7 yang ditinggalkan agen: job yang dibatalkan saat mengantre tidak lagi diberi `error_info` preflight (`jobs._run_queued`).
- T0.6: label UI "Best (Otomatis)" diganti "Otomatis (hingga 1080p)" (id dan en) agar sesuai arti barunya.

Status task: T0.1, T0.3, T0.4, T0.5, T0.6, T0.7 dicentang `[x]`. T0.2 `[~]`: skrip dan tesnya lulus, pengukuran di Colab masih menunggu pemilik `[!]`.

Catatan jujur:

- Perubahan ±478 baris di `crop_utils.py` bukan soal CRLF. Tanpa whitespace tinggal ±212 baris, sisanya indentasi karena kode dibungkus `try/finally`.
- Kriteria T0.7 "tidak ada fallback GPU/NVENC yang diam-diam" dipenuhi lewat peringatan preflight dan `whisper_device`/`encoder` di timings. Tampilannya di UI baru ada di T0.12.
- Build frontend (`src/`, `web/`) belum dijalankan di sesi ini. Perubahan frontend hanya teks label.
- `pip` memasang `opencv-contrib-python` 5.x (dibawa mediapipe) berdampingan dengan `opencv-python-headless` 4.x. Tes lulus, tetapi perlu diperhatikan saat build PyInstaller.
- `backend/metadata.py:211` masih membuat thread langsung. Itu di luar cakupan T0.4 (hanya `jobs.py`), dicatat untuk ditinjau.

Langkah berikutnya: Fase 3, mulai T0.8 (workspace lokal dan publish ke Drive).

### 2026-11-12 · Fase 3 dimulai: T0.8 dan T0.10 dikerjakan paralel

Dua agen Fable (effort high) bekerja di worktree terpisah, keduanya bercabang dari `a214104`:

| Task | Worktree | Branch |
|---|---|---|
| T0.8 workspace lokal + publish | `C:\Users\dhima\projects\ac-t08` | `sp0/t0.8-workspace` |
| T0.10 `cookies.txt` | `C:\Users\dhima\projects\ac-t10` | `sp0/t0.10-cookies` |

Jika sesi terputus sebelum entri berikutnya ditulis: periksa `git -C <worktree> status` dan `git log` di tiap worktree, jalankan tes di sana, lalu merge ke `feat/sp0-pipeline-stability` hanya jika hijau. Setelah merge, hapus worktree dengan `git worktree remove`. Belum ada task Fase 3 yang dicentang.

### 2026-11-12 · T0.10 selesai dan di-merge (`0890bb0`)

Tes setelah merge: **411 lulus, 0 gagal** (dijalankan ulang di branch utama, bukan hanya laporan agen). T0.10 dicentang.

Ringkasan: `backend/cookies.py` menyimpan satu `cookies.txt` di `<app data>/cookies/cookies.txt`, memvalidasi (format Netscape, ada cookie youtube.com, belum kedaluwarsa, maksimal 1 MiB), dan memberi yt-dlp salinan sementara, bukan file aslinya. Endpoint: `GET/POST/DELETE /api/settings/cookies`. Lima kode error `COOKIES_*` (id dan en).

Belum terbukti: unduhan sungguhan dengan cookies belum pernah dijalankan. Tes hanya membuktikan opsi diteruskan dan yt-dlp bisa memuat filenya.

Perlu keputusan pemilik `[!]`:

1. Di Colab, app data adalah Google Drive, jadi `cookies.txt` tersimpan di Drive pengguna (`AutoClipperData/cookies/`). Praktis karena bertahan antar sesi, tetapi bukan "lokal" seperti kata spec. Alternatif: simpan di work dir T0.8 dan unggah ulang tiap sesi.
2. Celah lama di luar task ini: siapa pun yang memegang token API bisa membaca file di app data lewat `POST /save_file` dan `/video` (termasuk cookies). Perlu task pengerasan tersendiri.
3. Belum ada ADR untuk cookies (AGENTS.md bagian H). Disarankan ditulis bersama T0.13.

Catatan untuk T0.12: tampilkan `latest_expiry` (bukan `earliest_expiry`) dan beri peringatan bila `logged_in` bernilai false.

T0.8 masih dikerjakan di `C:\Users\dhima\projects\ac-t08`. T0.11 dimulai di `C:\Users\dhima\projects\ac-t11` (branch `sp0/t0.11-ytdlp-clients`).
