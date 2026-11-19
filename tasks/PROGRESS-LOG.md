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

### 2026-11-12 · berhenti karena kuota sesi 5 jam mencapai 86%

Kedua agen dihentikan atas permintaan pemilik. Tidak ada yang memberi laporan akhir.

Keadaan saat berhenti:

| Bagian | Keadaan | Tes |
|---|---|---|
| Branch `feat/sp0-pipeline-stability` | T0.1, T0.3–T0.7, T0.10 selesai dan dicentang. T0.2 `[~]` | 411 lulus, 0 gagal |
| T0.8, worktree `C:\Users\dhima\projects\ac-t08`, branch `sp0/t0.8-workspace` | **WIP, belum selesai, belum direview.** Di-commit sebagai `wip(sp0): T0.8 ...`. Menyentuh `workspace.py` (baru), `jobs.py`, `colab_api.py`, `db.py`, `errors.py`, `preflight.py` dan tesnya | 374 lulus, 0 gagal (bercabang dari `a214104`, jadi belum memuat T0.10) |
| T0.11 | Agen baru sampai tahap membaca, **tidak ada perubahan**. Worktree dan branch-nya dihapus | - |

Hijau di worktree T0.8 tidak berarti selesai: agen berhenti di tengah jalan, jadi mungkin ada perilaku yang belum diimplementasi atau belum diuji.

Langkah sesi berikutnya, berurutan:

1. Di `ac-t08`: baca `git show --stat HEAD` dan diff terhadap `a214104`, cocokkan dengan kriteria T0.8 di `roadmap-todo.md` dan spec 4.1 (semua file antara di work dir, publish atomik, path riwayat menunjuk ke pustaka, peringatan Drive, tahap `publish` di timings, opsi work dir di `colab_api.py`). Agen juga mengubah `db.py`: pastikan itu tidak melebar ke T0.9.
2. Selesaikan yang kurang, lalu `git merge feat/sp0-pipeline-stability` ke dalam branch T0.8 (kemungkinan konflik kecil di `errors.py` dengan kode `COOKIES_*`), jalankan tes, baru merge ke branch utama dan centang T0.8.
3. Mulai ulang T0.11 dari awal (brief-nya: urutan default yt-dlp lalu `web_embedded`, `android_vr`; berhenti lebih awal untuk error yang tidak bisa diperbaiki client lain; opsi Deno/EJS dicek dari source yt-dlp terpasang di venv, bukan dari ingatan; tes untuk empat skenario cookies × Deno).
4. Setelah T0.8: T0.9 (`history.db` lokal + snapshot).

Catatan teknis: opsi `isolation: worktree` pada tool Agent gagal di mesin ini dan malah bercabang dari `072164d`. Buat worktree manual dengan `git worktree add -b <branch> ..\<nama> HEAD` lalu arahkan agen ke path itu.

Keputusan pemilik yang masih terbuka: lihat entri T0.10 di atas (lokasi cookies di Colab, celah `/save_file`, ADR cookies).

### 2026-11-13 · sesi dilanjutkan

Baseline sesi: 411 lulus, 0 gagal. Agen T0.8 dilanjutkan di `C:\Users\dhima\projects\ac-t08` (dari WIP `67b7814`). T0.11 dimulai ulang di `C:\Users\dhima\projects\ac-t11` (branch `sp0/t0.11-ytdlp-clients`, dari `9e67cb5`). Belum ada hasil. Jika terputus: periksa tiap worktree seperti entri sebelumnya.

### 2026-11-13 · T0.8 selesai dan di-merge

Tes setelah merge di branch utama: **454 lulus, 0 gagal**. T0.8 dicentang.

Ringkasan: `AUTO_CLIPPER_WORK_DIR` (kosong = perilaku lama). `get_project_workspace` mengembalikan `library_dir` dan mengarahkan semua folder kerja ke work dir. `workspace.publish` menyalin klip, subtitle hasil edit, dan transkrip ke pustaka secara atomik (nama `.part` lalu rename) setelah setiap klip dan di akhir, lalu menulis `metadata.json` tanpa API key. Riwayat tidak pernah menunjuk ke klip di disk kerja. Publish gagal membuat job berakhir `ERROR` (`PUBLISH_FAILED` atau `DISK_FULL`), Resume hanya menyalin ulang. `colab_api.py` punya opsi `--work-dir` (belum default). Preflight disk memeriksa kedua disk.

Belum terbukti tanpa Colab nyata: perilaku rename dan file `.part` di mount Drive, dan apakah work dir benar-benar mempercepat.

Celah yang ditemukan, dijadikan task baru **T0.8b** (wajib sebelum T0.13 menyalakan work dir): video sumber tidak dipublikasikan, sehingga rerender/AI Koreksi/resume-manual/Resume unggahan gagal setelah work dir hilang; `/upload` masih menulis ke pustaka; `/video` tidak menyajikan file work dir. Field baru `job["warnings"]`/`metadata["warnings"]` belum ditampilkan frontend (masuk T0.12).

Sedang berjalan: T0.11 di `C:\Users\dhima\projects\ac-t11`. Dimulai: T0.9 di `C:\Users\dhima\projects\ac-t09` (branch `sp0/t0.9-history-db`) dan T0.8b di `C:\Users\dhima\projects\ac-t08b` (branch `sp0/t0.8b-source-restore`).

### 2026-11-13 · T0.11 selesai dan di-merge

Tes setelah merge di branch utama: **486 lulus, 0 gagal**. T0.11 dicentang.

Ringkasan: urutan percobaan `default yt-dlp → web_embedded → android_vr`, masing-masing sekali (dulu sampai 12 kali). Berhenti langsung untuk `VIDEO_UNAVAILABLE`, `YT_RATE_LIMITED`, `DISK_FULL`, dan untuk error sign-in bila cookies sudah dipakai. Bila Deno ada: `js_runtimes={'deno': {'path': ...}}` dan `remote_components=['ejs:github']` (dicek dari source yt-dlp 2026.10.26 terpasang). Error yang keluar selalu `AppError` berkode.

Temuan penting: rotasi client lama **tidak pernah bekerja**. Bentuk `extractor_args` lama diabaikan yt-dlp, jadi kode lama mengulang permintaan default yang sama sampai 12 kali.

Belum terbukti (butuh unduhan YouTube sungguhan, Deno tidak terpasang di mesin ini): apakah Deno + EJS menyelesaikan tantangan, apakah client cadangan lolos bot check, dan kecocokan teks error YouTube terkini dengan pengklasifikasi.

Perlu keputusan pemilik `[!]`:

4. `android_vr` di yt-dlp terpasang ternyata butuh PO Token (format di-403 sejak 2026.08.17), jadi cadangan ini lemah. `visionos` tidak butuh PO Token. Mengganti hanya satu baris di `PLAYER_CLIENT_ORDER`, tetapi spec menyebut `android_vr`.
5. `remote_components=['ejs:github']` membuat yt-dlp mengunduh skrip solver dari GitHub saat berjalan (dicek hash, lalu di-cache). Alternatif: pasang paket `yt-dlp-ejs` di requirements, build PyInstaller, dan notebook (cocok di T0.13).
6. Error sign-in saat cookies terpasang langsung menghentikan unduhan tanpa mencoba ulang secara anonim. Pengguna harus mengunggah ulang atau menghapus cookies. "HTTP Error 403" juga terklasifikasi sebagai sign-in, jadi ikut berhenti.

Catatan untuk T0.13: Deno hanya dicari di PATH.

Masih berjalan: T0.9 (`ac-t09`) dan T0.8b (`ac-t08b`).

### 2026-11-13 · berhenti karena kuota sesi 5 jam mencapai 80%

Kedua agen dihentikan atas permintaan pemilik.

| Bagian | Keadaan | Tes |
|---|---|---|
| Branch `feat/sp0-pipeline-stability` | T0.1, T0.3–T0.8, T0.10, T0.11 selesai dan dicentang. T0.2 `[~]` | 486 lulus, 0 gagal |
| T0.8b, worktree `C:\Users\dhima\projects\ac-t08b`, branch `sp0/t0.8b-source-restore`, commit `28be378` | Agen sudah commit dengan pesan final tetapi **dihentikan sebelum melapor. Belum direview, belum di-merge, belum dicentang.** Bercabang dari `02f42de`, jadi belum memuat T0.11 | 470 lulus, 0 gagal |
| T0.9 | Agen baru tahap membaca, **tidak ada perubahan**. Worktree dan branch dihapus | - |

Langkah sesi berikutnya, berurutan:

1. T0.8b: di `ac-t08b` baca `git show --stat HEAD` dan diff terhadap `02f42de`. Cocokkan dengan kriteria T0.8b di `roadmap-todo.md` (pulihkan video sumber untuk job URL, pesan awam bila unggahan hilang, `/upload` ke work dir, `/video` menyajikan work dir tanpa melebarkan akses lain, tanpa work dir perilaku tetap). Lalu `git merge feat/sp0-pipeline-stability` di worktree itu, jalankan tes, merge ke branch utama, centang.
2. T0.9: mulai ulang dari awal. Brief: `history.db` di work dir hanya bila work dir aktif; snapshot ke pustaka lewat API backup SQLite, dibatasi frekuensinya tanpa kehilangan perubahan terakhir (terutama status DONE/ERROR); pulihkan saat startup; database lama di Drive harus terbaca tanpa langkah migrasi; kait di lapisan db agar `jobs.py` tidak berubah.
3. T0.12 (kartu error, unggah cookies, "Detail waktu", `warnings`) di `src/` dan `web/`. Node 22 dan `node_modules` kedua frontend tersedia. Lihat catatan T0.10 (`latest_expiry`, `logged_in`) dan T0.8 (`warnings`).
4. T0.13 (notebook, Deno, work dir, panduan, CHANGELOG, ADR cookies).

Keputusan pemilik yang masih terbuka: nomor 1–3 di entri T0.10 dan nomor 4–6 di entri T0.11.

### 2026-11-16 · T0.8b direview dan di-merge

Baseline sesi: 486 lulus. Setelah merge T0.8b: **502 lulus, 0 gagal** (dijalankan di branch utama). T0.8b dicentang.

Ringkasan: `jobs._restore_source_video` dipakai oleh rerender semua, render ulang per klip, AI Koreksi, resume-manual, dan Resume. Bila work dir aktif dan video sumber hilang: job URL mengunduh ulang, unggahan disalin ulang dari file unggahannya, dan bila file itu juga hilang muncul `UPLOAD_MISSING` (id dan en). `/upload` menulis ke work dir bila aktif. `/video` boleh menyajikan file di work dir. Cache editor manual di `metadata.py` tidak dipindah (agen dihentikan sebelum melapor, jadi alasan pastinya tidak tercatat).

Dimulai: T0.9 di `C:\Users\dhima\projects\ac-t09` (branch `sp0/t0.9-history-db`) dan T0.12 di `C:\Users\dhima\projects\ac-t12` (branch `sp0/t0.12-error-ui`).

### 2026-11-17 · sesi dilanjutkan setelah kuota habis (2026-11-16)

Kemarin kedua agen mati karena kuota 5 jam habis, tanpa titik simpan terencana. Keadaan yang ditemukan:

| Task | Worktree / branch | Keadaan | Tes |
|---|---|---|---|
| T0.9 | `C:\Users\dhima\projects\ac-t09`, `sp0/t0.9-history-db`, commit `9148834` | Agen sudah commit tetapi belum melapor. Belum direview, belum di-merge | 522 lulus, 0 gagal |
| T0.12 | `C:\Users\dhima\projects\ac-t12`, `sp0/t0.12-error-ui`, WIP `0c7089b` | Setengah jalan (komponen baru di `src/` dan `web/`). Build belum dijalankan | belum ada |

Branch utama: 502 lulus, 0 gagal. Kedua agen dilanjutkan dari konteksnya. Jika terputus lagi: T0.9 tinggal direview dan di-merge; T0.12 lanjutkan dari WIP, jalankan `npm run build` di root dan `web/`, `npm run lint` di `web/`.

### 2026-11-17 · T0.9 selesai dan di-merge

Tes setelah merge di branch utama: **522 lulus, 0 gagal** (dijalankan dua kali berturut-turut karena ada tes berbasis timer; keduanya hijau). T0.9 dicentang.

Ringkasan: bila work dir aktif, `history.db` ada di work dir dan snapshot ditulis ke `<pustaka>/history.db` (path lama, jadi database lama di Drive otomatis menjadi snapshot pertama, tanpa migrasi). Snapshot memakai API backup SQLite ke `.history.db.part` lalu rename. Perubahan tahap dibatasi sekali per 5 detik dengan satu penulisan susulan; status akhir (`DONE`, `ERROR`, `CANCELLED`, `AWAITING_MANUAL`) ditulis langsung. Gagal menulis hanya dicatat dan dicoba ulang. Saat startup: db lokal hilang → pulihkan dari snapshot; keduanya ada → lokal menang, job yang hanya ada di pustaka digabungkan. Tanpa work dir tidak ada yang berubah.

Batasan yang diketahui: perubahan tahap ≤5 detik sebelum proses dimatikan paksa bisa tidak masuk snapshot (job tetap pulih di tahap sebelumnya); job yang dihapus bisa muncul lagi bila proses mati dalam ±5 detik setelah penghapusan; tiap snapshot menyalin seluruh database (ukuran dan lamanya belum diukur).

Belum terbukti tanpa Colab nyata: `os.replace` dan file `.part` di mount Drive, apakah Drive sempat mengunggah snapshot sebelum runtime dimatikan, apakah `atexit` jalan saat uvicorn menerima SIGTERM, dan perilaku di Linux (semua tes dijalankan di Windows).

Ditemukan, belum diperbaiki: log (`backend_error.log` dkk.), cache editor manual (`metadata.py`), `jobs.get_temp_dir()`, dan cookies masih di Drive. Tidak rusak, hanya masih membayar lambatnya Drive. Kandidat task SP3 atau lanjutan SP0.

Masih berjalan: T0.12 di `ac-t12`. Dimulai: T0.13 di `C:\Users\dhima\projects\ac-t13` (branch `sp0/t0.13-notebook-docs`).

### 2026-11-17 · T0.12 di-merge, menunggu cek manual pemilik `[!]`

Dijalankan di branch utama setelah merge: `npm run build` (root) exit 0, `npm run build` (`web/`) exit 0, `npm run lint` (`web/`) exit 0 dengan peringatan lama saja. Tidak ada file backend yang berubah (terakhir 522 lulus). T0.12 ditandai `[~]`, **bukan `[x]`**: kriterianya "dicek manual di kedua frontend untuk tiap kode error", dan tampilan belum pernah dibuka di browser atau dijalankan dengan backend hidup. Tidak ada test runner frontend, jadi tidak ada tes otomatis.

Yang dibangun di `src/` dan `web/src/`: `ErrorCard` (judul dan pesan awam, tombol aksi, "Detail teknis" tertutup dengan tombol Salin), `CookiesPanel` + `CookiesModal` (peringatan akun cadangan, panduan 3 langkah, status "Berlaku sampai", hapus), `TimingDetails` ("Detail waktu" per tahap, total, perangkat), `JobWarnings`, posisi antrean di `BusyOverlay`. Web mendapat halaman Pengaturan baru (`/settings`) dan pemilih bahasa kecil yang hanya mencakup bagian baru.

Pemetaan aksi: `upload_cookies` → modal cookies; `upload_video` → desktop: form "Local Video", web: penjelajah Google Drive (label "Pilih video dari Google Drive"); `retry`/`resume` → lanjutkan job; `open_settings` → desktop: Pengaturan, web: disembunyikan (web tidak punya pengaturan API key).

Cek manual untuk pemilik:

1. Simulasikan kode error: sementara tambahkan `from backend.errors import AppError; raise AppError("KODE", technical="test")` di awal `download_youtube_video` (`backend/video_utils.py`), mulai job URL, lalu hapus lagi. Kode: `YT_SIGNIN_REQUIRED`, `YT_RATE_LIMITED`, `VIDEO_UNAVAILABLE`, `VIDEO_TOO_LONG`, `UPLOAD_MISSING`, `OUT_OF_MEMORY`, `DISK_FULL`, `PUBLISH_FAILED`, `AI_KEY_INVALID`, `UNKNOWN`. Tiap kartu harus menampilkan judul dan pesan awam, tombol sesuai pemetaan di atas, dan "Detail teknis" yang tertutup.
2. Panel cookies: unggah file kosong, JSON berganti nama `.txt`, cookies situs lain, cookies kedaluwarsa, file >1 MB (masing-masing harus muncul kartu error), lalu file valid (status hijau, "Berlaku sampai"), ekspor tanpa login (peringatan kuning), dan hapus.
3. Setelah unggah cookies valid dari kartu error, tombol "Coba lagi sekarang" harus melanjutkan job.
4. "Detail waktu" di hasil job dan di Riwayat. Job lama tanpa `error_info` harus tetap menampilkan teks mentah.
5. Keyboard: Tab ke "Detail teknis"/"Detail waktu", Enter/Spasi membuka, Escape menutup modal cookies.
6. Ganti bahasa sekali untuk memeriksa teks Inggris.

Hal yang perlu dikonfirmasi pemilik:

7. Panduan ekspor menyebut ekstensi "Get cookies.txt LOCALLY" sebagai contoh. Itu pilihan agen.
8. Web: `upload_video` dipetakan ke penjelajah Google Drive, sementara pesan backend berkata "unggah filenya ke sini". Pesan `AI_KEY_INVALID` menyebut halaman Pengaturan yang di web tidak punya pengaturan API key.
9. Hasil preflight (`GET /api/preflight`) belum ditampilkan di frontend mana pun. Job AI ulang dan render ulang satu klip belum menampilkan timings/warnings secara langsung.
10. `ErrorCard` desktop memakai kelas palet (`bg-red-500/10`) karena kelas token tema (`bg-error/10`) tidak ter-compile di setup Tailwind ini; pemakaian lama kelas itu di tempat lain juga tidak menghasilkan latar.

Masih berjalan: T0.13 di `ac-t13`.

### 2026-11-17 · berhenti karena kuota sesi 5 jam mencapai 80%

Agen T0.13 dihentikan atas permintaan pemilik, tanpa laporan.

| Bagian | Keadaan | Tes |
|---|---|---|
| Branch `feat/sp0-pipeline-stability` | T0.1, T0.3–T0.11 (termasuk T0.8b) selesai dan dicentang. T0.2 `[~]` (menunggu Colab). T0.12 `[~]` (menunggu cek manual) | 522 lulus, 0 gagal; build `src/` dan `web/` exit 0 |
| T0.13, worktree `C:\Users\dhima\projects\ac-t13`, branch `sp0/t0.13-notebook-docs` | **WIP, belum selesai, belum direview.** Baru menyentuh `Auto_Clipper_Colab.ipynb` (JSON valid) dan `scripts/colab_preflight.py` (baru). Bercabang dari `2cdbfb2`, jadi belum memuat T0.12 | 522 lulus, 0 gagal |

Yang belum dikerjakan dari T0.13: tes notebook (work dir, Deno, preflight), `docs/panduan-penggunaan-awam.md`, `docs/tutorial-auto-clipper-cloud.md`, `CHANGELOG.md`, naik versi (sekarang `1.17.4`; CHANGELOG terakhir `1.17.1`, jangan mengarang entri yang hilang), ADR-012, pembaruan `.agents/AGENTS.md`. Belum diketahui apakah bagian notebook sudah lengkap.

Langkah sesi berikutnya:

1. Lanjutkan T0.13 di `ac-t13`: periksa diff notebook terhadap `2cdbfb2`, selesaikan sisanya, `git merge feat/sp0-pipeline-stability` di worktree (agar panduan bisa mengacu ke UI T0.12 yang sebenarnya), jalankan tes, merge, centang. Sel notebook tetap `[!]`: harus dijalankan pemilik di Colab bersih.
2. Setelah itu sisa SP0 semuanya butuh pemilik: T0.2 dan T0.14 (pengukuran Colab), cek manual T0.12, T0.15 (keputusan gerbang), dan keputusan terbuka nomor 1–10 di entri-entri di atas.

### 2026-11-18 · sesi dilanjutkan

Baseline sesi: 522 lulus, 0 gagal. Agen T0.13 dilanjutkan di `C:\Users\dhima\projects\ac-t13` dari WIP `ba23f7b`, diminta merge branch utama dulu agar panduan mengacu ke UI T0.12 yang sebenarnya. Belum ada hasil. Jika terputus: periksa `git -C ..\ac-t13 status` dan `log`, commit WIP bila ada perubahan, lanjutkan.

### 2026-11-18 · T0.13 di-merge; semua pekerjaan kode SP0 selesai

Dijalankan di branch utama: **557 lulus, 0 gagal**; build `src/` dan `web/` exit 0; notebook valid JSON (11 sel). Versi kini **1.18.0** di semua tempat (termasuk `Cargo.toml`, lockfile, `file_version_info.txt`). T0.13 ditandai `[~]`: kriterianya "sel notebook berjalan dari awal sampai akhir di Colab bersih", dan itu belum pernah dijalankan.

Isi T0.13: notebook memasang Deno (`curl -fsSL https://deno.land/install.sh | DENO_INSTALL=/usr/local sh`, aman diulang, tidak menghentikan notebook bila gagal), memakai `AUTO_CLIPPER_WORK_DIR=/content/work`, dan menampilkan hasil pemeriksaan awal lewat `scripts/colab_preflight.py` sebelum server jalan. Klaim NVENC dihapus. Panduan awam, tutorial cloud, `CHANGELOG.md` (entri 1.18.0; 1.17.2–1.17.4 memang tidak pernah dicatat), ADR-012, dan `.agents/AGENTS.md` diperbarui.

Diperbaiki sendiri setelah review (temuan agen T0.13):

- Pemeriksaan Drive di `preflight.py` dan `colab_api.py` memakai `os.path.ismount("/content/drive")`. Sebelumnya memeriksa folder `/content/drive/MyDrive`, yang dibuat sendiri oleh backend saat Drive tidak ter-mount, sehingga peringatan `DRIVE_NOT_MOUNTED` tidak pernah muncul. 3 tes baru, terbukti gagal tanpa perbaikan.
- Teks privasi cookies di web kini menyebut lokasi sebenarnya di Colab (Google Drive, `AutoClipperData/cookies`).

Masih terbuka dari temuan T0.13 `[!]`:

11. Bila backend dijalankan sebelum Drive di-mount, ia membuat folder `/content/drive/MyDrive/...` di disk lokal, dan `drive.mount` sesudahnya kemungkinan gagal karena titik mount tidak kosong. Belum diuji. Pilihan: backend menolak membuat folder di bawah `/content/drive` tanpa mount, atau cukup peringatan (sekarang sudah benar). Perlu keputusan karena spec bilang "job tetap berjalan".
12. Jalur Ngrok (4B) menjalankan uvicorn langsung, tanpa GPU keep-alive milik `colab_api.py`. Sudah begitu sebelum SP0.
13. `yt-dlp-ejs` tidak dipasang; Deno mengambil solver dari GitHub saat berjalan (terkait nomor 5).

## Sisa SP0: semuanya butuh pemilik

1. Jalankan notebook di Colab bersih (T4) mengikuti daftar cek di bawah, lalu ukur video 30 menit sebelum/sesudah (T0.2, T0.14) dan isi spec bagian 7.
2. Cek manual T0.12 (daftar di entri 2026-11-17 "T0.12 di-merge").
3. T0.15: keputusan gerbang pendekatan B berdasarkan angka T0.14.
4. Keputusan terbuka nomor 1–13 di entri-entri di atas.
5. Setelah itu: buka PR `feat/sp0-pipeline-stability` → `main`.

Daftar cek Colab (dari agen T0.13, runtime T4 baru):

1. Sel 1: Drive ter-mount, baris GPU "GPU T4 Aktif".
2. Sel 2: berakhir "Deno terpasang (deno 2.x ...)"; jalankan lagi → "Deno sudah terpasang"; sel baru `!which deno` → `/usr/local/bin/deno`.
3. Sel 3: isi `BRANCH` dengan `feat/sp0-pipeline-stability` (branch harus sudah di-push ke GitHub), lalu pip selesai. Baris "Versi yang dipakai" harus menunjukkan branch itu dan commit terakhirnya.
4. Sel 4A atau 4B: sebelum log server muncul "PEMERIKSAAN AWAL AUTO CLIPPER" dengan Drive, YouTube helper, GPU OK. **Catat** apakah "Render memakai GPU" atau "[PERHATIAN] Render memakai prosesor" (menjawab temuan F8).
5. Sel baru `!ls /content/work` → ada `history.db`; `AutoClipperData/history.db` di Drive tetap ada.
6. Satu job URL pendek: video sumber ada di `/content/work/projects/<judul>/source/`; setelah selesai klip ada di Drive `AutoClipperData/projects/<judul>/clips/`, tanpa file `.part`; "Detail waktu" tampil.
7. Job kedua saat yang pertama berjalan → "Menunggu giliran".
8. Runtime → Disconnect and delete runtime, sambung lagi, jalankan sel 1–4: riwayat dan klip lama muncul; render ulang mengunduh ulang video sumber.
9. Opsional: unggah `cookies.txt` akun cadangan di Pengaturan ("Berlaku sampai ..."); jalankan sel 4 tanpa sel 1 di runtime baru → pemeriksaan awal `[MASALAH] Google Drive belum terhubung`, job ditolak dengan kartu error, dan tidak ada folder di `/content/drive` (sejak T0.17). Lalu hentikan sel 4, jalankan sel 1: harus berhasil ter-mount.

---

## 2026-11-18 · Uji Colab pertama oleh pemilik (sedang berjalan)

Pemilik menjalankan notebook dengan `BRANCH = feat/sp0-pipeline-stability` (kolom baru di sel 3, commit `2a747eb`). Web yang dipakai masih Vercel produksi (`main`), jadi kartu error baru belum terlihat.

Yang sudah terbukti di Colab sungguhan:

- Dengan versi `main`, URL YouTube gagal "Sign in to confirm you're not a bot".
- Dengan versi branch dan `cookies.txt` diletakkan manual di Drive `AutoClipperData/cookies/cookies.txt`, job yang sama di-Resume dan lolos tahap unduh.
- Pemeriksaan awal: FFmpeg, disk 105,9 GB, RAM 11,1 GB, GPU (subtitle), Drive, Deno, yt-dlp 2026.10.26 semuanya OK. Render: `[PERHATIAN] Render memakai prosesor` (temuan F8).

Perbaikan setelah temuan F8 (tes 558 lulus):

- `is_nvenc_available` menguji `h264_nvenc` dengan bingkai 128×128. GPU Turing (T4) menolak lebar di bawah 145 piksel, jadi uji itu gagal di T4 walaupun encoder-nya mungkin bisa dipakai. Bingkai uji sekarang 256×256, dan alasan kegagalan ditulis ke log aplikasi. Belum diverifikasi di Colab: bisa jadi encoder tetap tidak tersedia (misalnya pustaka encoder NVIDIA tidak ada di runtime Colab).
- Teks peringatan render tidak lagi hanya berkata "normal di komputer tanpa kartu grafis NVIDIA", yang bertentangan dengan baris "GPU aktif" di atasnya.

Temuan kedua, lebih berat: `backend_app.log` menunjukkan unduh 19,7 dtk dan ambil suara 18,2 dtk normal, lalu `transcribe whisper_model=medium` → "Library libcublas.so.12 is not found ... falling back to CPU transcription". Setelah 24 menit `.srt` belum ada. Pemeriksaan awal tetap berkata "GPU aktif, subtitle memakai GPU" karena hanya menghitung perangkat CUDA.

Perbaikan (tes 564 lulus):

- Notebook sel 3 memasang `nvidia-cublas-cu12` dan `nvidia-cudnn-cu12==9.*` (cara yang dianjurkan README faster-whisper untuk ctranslate2 4.5+).
- `colab_api.setup_environment` menambahkan folder cuBLAS dan cuDNN ke `LD_LIBRARY_PATH` masing-masing; dulu satu paket yang hilang membuang keduanya. Memakai `__path__`, bukan `__file__`.
- Pemeriksaan awal: bila ada GPU tetapi `libcublas.so.12`/`libcudnn.so.9` tidak bisa dimuat (Linux saja), cek `gpu` menjadi `[PERHATIAN] Subtitle memakai prosesor` dengan langkah perbaikan.
- Belum diverifikasi di Colab. Pemilik diminta menjalankan sel diagnosis (daftar paket nvidia/torch, pasang paket, muat pustaka, uji `h264_nvenc`). Risiko: bila torch Colab memakai CUDA 13, `nvidia-cudnn-cu12` bisa bertabrakan dengan cuDNN milik torch; output `pip list` dari pemilik akan menjawabnya.

Hasil sel diagnosis pemilik (Colab T4, 2026-11-18), sebelum perintah pasang dijalankan:

```
ctranslate2          4.9.0
nvidia-cublas        13.1.1.3
nvidia-cublas-cu12   12.9.3.13
nvidia-cudnn-cu12    9.28.0.42
nvidia-cudnn-cu13    9.24.0.43
torch                2.14.1+cu130
PUSTAKA GPU SUBTITLE OK   (dimuat lewat __path__ paket nvidia.*.lib)
RENDER GPU BISA           (h264_nvenc 256x256)
```

Kesimpulan: paket CUDA 12 sudah ada di Colab. Akar masalah Whisper adalah kode lama `colab_api` yang memakai `nvidia.cublas.lib.__file__`; gagal, lalu `LD_LIBRARY_PATH` jatuh ke `/usr/local/cuda/lib64` (CUDA 13, torch cu130). Dugaan: `__file__` kosong karena paket itu namespace package; belum dicek langsung. Perbaikan `__path__` di `b3cce93` terbukti memuat pustakanya. Render GPU terbukti bisa di T4, jadi kegagalan sebelumnya murni karena bingkai uji 128×128 (`08504f4`). Baris `pip install nvidia-*-cu12` di notebook tidak mengubah apa pun di Colab saat ini; dibiarkan sebagai pengaman.

Langkah berikutnya: pemilik push, jalankan sel 3–4, pastikan pemeriksaan awal "Render memakai GPU" tanpa peringatan subtitle, lalu Resume. Catat waktu per tahap sebagai angka T0.14.

### Desktop Windows (PC pemilik: GTX 1650 + AMD Radeon terintegrasi, diuji langsung)

- Aplikasi hanya mengenal NVIDIA (NVENC untuk render, CUDA untuk Whisper). Kartu AMD diabaikan, tidak bentrok.
- Render: FFmpeg yang dibundel rilis Windows (`@ffmpeg-installer/ffmpeg`, build 2018 `N-92722`) punya `h264_nvenc`, tetapi gagal dengan driver sekarang: "Cannot get the preset configuration: unsupported param (12)", di ukuran berapa pun. Jadi di desktop render selalu memakai prosesor. `ffmpeg-static@5` (FFmpeg 6.1.1 gyan.dev, sudah dipakai build macOS) lolos uji `h264_nvenc` dan perintah gaya `crop_to_vertical` (preset `p4`, 1080×1920). Fitur yang dipakai aplikasi (libass, freetype, fontconfig, libx264, subtitles/ass/drawtext/overlay/zoompan) ada di keduanya. `build.yml` dan `pr-check.yml` sekarang memakai `ffmpeg-static@5` untuk Windows (+18 MB). Belum dijalankan di CI.
- Subtitle: `ctranslate2` melihat 1 GPU dan membawa `cudnn64_9.dll`, tetapi `cublas64_12.dll` tidak ada di PC maupun di bundle PyInstaller. Whisper di desktop jatuh ke prosesor (jalur fallback yang sama dengan Colab). Membundel cuBLAS menambah ratusan MB; usul jadi keputusan SP3 (paket GPU opsional).
- Belum diukur: seberapa cepat render NVENC dibanding libx264 di klip sungguhan. Uji sintetis 60 dtk tidak bermakna (pembangkit gambar uji yang dominan).

Langkah lama (sudah terjawab di atas): setelah job selesai, pemilik menjalankan sel uji `h264_nvenc` 256×256, lalu push ulang dan jalankan sel 3–4 untuk melihat apakah pemeriksaan awal berubah menjadi "Render memakai GPU". Catat waktu job pertama ini (render CPU) sebagai pembanding.

---

## 2026-11-18 · Job 30 menit selesai di Colab; T0.14 terukur

Job `ccc39a30` (branch di `1f65023`, Whisper `medium`, AI manual, 10 klip, Haar) selesai `DONE` tanpa `-9`. Kesepuluh klip ada di Drive `AutoClipperData/projects/tirtapengpengpeng/clips/` (`/video` → `Exists: True`). Angka lengkap ada di spec bagian 7. Ringkas: unduh 13,9 dtk, transkripsi 119,8 dtk di GPU, tracking rata-rata 78,6 dtk per klip (0,96 × panjang klip), render NVENC rata-rata 29,3 dtk per klip, total mesin 20,4 menit, RAM puncak 3,09 GB.

Status:

- T0.14 `[x]`: video 30 menit selesai di Colab tanpa `-9`, `timings` lengkap di log.
- T0.2 tetap `[~]`: "Sebelum" hanya sebagian. Pemilik memutuskan apakah cukup.
- T0.13 tetap `[~]`: notebook terbukti jalan, tetapi bukan di runtime bersih (sel 3 dijalankan ulang di runtime yang sama untuk menarik `b3cce93`). Daftar cek yang sudah terbukti: 1, 2 (Deno OK di pemeriksaan awal), 3, 4, 6. Belum: 5 (`history.db` di work dir), 7 (antrean), 8 (runtime dihapus lalu sambung ulang), 9.
- T0.15: tracking wajah 64 % dari waktu mesin. Menurut aturan gerbang di spec, pendekatan B (tracking satu-kali-baca) dijadwalkan. Menunggu keputusan pemilik.

Catatan: klip 9 memakai crop statis di tengah (`iw*0.5`), kemungkinan wajah tidak terdeteksi. Ekspresi `crop` per klip sangat panjang (fungsi `if(lte(t,…))` bertingkat tiap 0,5 dtk); render tetap 0,36 × panjang klip, jadi bukan hambatan sekarang.

---

## 2026-11-18 · Keputusan gerbang; T0.16 dimulai

- Pemilik menyetujui: T0.2 dianggap cukup (`[x]`), pendekatan B dijadwalkan (T0.15 `[x]`). Task baru **T0.16 Pelacakan wajah satu-kali-baca** ditambahkan di roadmap (`eee5978`).
- T0.16 dikerjakan agen (fable, effort high) di worktree `C:\Users\dhima\projects\ac-t16`, branch `sp0/t0.16-single-read-tracking`, dari `eee5978`. Brief: ganti lompatan `POS_MSEC` per sampel dengan satu pipa FFmpeg berurutan (`-ss`/`-t`, pilih frame di titik sampel lama, skala 640, `rawvideo bgr24`), kontrak `info`/pembatalan/fallback MediaPipe tetap, fallback ke jalur lama bila FFmpeg gagal (dicatat), uji TDD + uji integrasi dengan FFmpeg bila ada, benchmark 1080p lokal lama vs baru.
- Bila sesi terputus: cek `git -C ..\ac-t16 log --oneline -5` dan jalankan tes di worktree itu. Bila agen belum commit, lanjutkan dari isi worktree atau mulai ulang dengan brief yang sama.
- Setelah merge, pemilik perlu mengukur ulang tracking di Colab (video yang sama), lalu `git push`.

---

## 2026-11-18 · T0.16 di-merge

- Merge `5f91e77` (commit `96f84a5`, `9099326`, `a06bd0c`). `sample_face_trajectory` membaca potongan klip dengan satu proses FFmpeg (`-ss`/`-t`, `setpts` + `fps=…:round=up:start_time=0` agar frame terpilih sama dengan frame terdekat yang dulu diberikan seek OpenCV, `scale` 640, `rawvideo bgr24` ke pipa). Bila FFmpeg tidak ada, gagal, atau mengirim frame terpotong: sisa sampel dibaca dengan seek lama dan alasannya dicatat `log_error("crop_utils.sample_face_trajectory_ffmpeg_fallback")`. Klip yang sampai akhir video tercatat di `log_app` saja (perubahan saya, `a06bd0c`).
- Tes: 592 lulus + 6 dilewati tanpa FFmpeg, 598 lulus dengan FFmpeg 6.1.1 (6 uji integrasi membandingkan jalur lama dan baru pada video sintetis 1080p, indeks frame sama).
- Benchmark `scripts/benchmark_face_tracking.py` (saya ulang sendiri, video 1080p30 H.264 `-g 150`, jendela 80 dtk, Haar): lama 17,4 dtk, baru 3,3 dtk, 5,3×, sampel dan trajektori identik. Agen dengan 2 core: 74,0 dtk → 13,8 dtk (0,93 → 0,17 × panjang klip).
- Belum diverifikasi: Colab/Linux dengan FFmpeg 4.4 dari apt (opsi yang dipakai seharusnya ada di 4.4; bila tidak, log berisi `sample_face_trajectory_ffmpeg_fallback` dan tracking selambat dulu, tidak rusak), MediaPipe dengan wajah sungguhan lewat jalur baru, build desktop.
- Pemilik: `git push`, jalankan sel 3–4 di Colab, proses ulang video yang sama, kirim baris `[timing] ... stage=tracking` dan cari `ffmpeg_fallback` di `backend_error.log`. Sasaran: tracking jauh di bawah 0,96 × panjang klip.

---

## 2026-11-18 · Bug "Rerender All" di web (422)

- Pemilik mencoba "Rerender All" di web untuk mengukur ulang T0.16: 422 `body.url Field required`. Penyebab: `POST /jobs/{id}/rerender` memakai `CreateJobRequest` yang mewajibkan `url`. Desktop mengakali dengan `url: "dummy"` (`src/hooks/useClipJobs.ts:321`), web tidak mengirimnya, jadi Rerender All di web tidak pernah berfungsi. Perbaikan: `RerenderJobRequest` dengan `url` opsional, uji `test_rerender_all_does_not_need_a_url` (gagal sebelum perbaikan). Tes 593 lulus + 6 dilewati.
- Temuan terkait, belum diperbaiki: web memanggil `/jobs/{id}/rerun-ai` (tanda hubung), backend `/jobs/{id}/rerun_ai` (garis bawah), lalu fallback ke `/api/jobs/{id}/rerun-ai` yang juga tidak ada. "AI ulang" dari web kemungkinan 404. `rerun_ai` juga memakai `CreateJobRequest` (wajib `url`). Endpoint rerender juga tidak meneruskan `face_tracking_engine` ke `create_rerender_job` (selalu Haar).

---

## 2026-11-18 · T0.16 terukur di Colab; "Rerender All" web berfungsi

- Pemilik menjalankan "Rerender All" proyek tirtapengpengpeng di web (versi `4f440b7`), job `91c1eeae` `DONE`, 10 klip di Drive. Perbaikan 422 terbukti.
- Tracking 10 klip: 786,4 → 271,0 dtk (2,9×; per klip 2,8–3,0×), 0,33 × panjang klip. Render NVENC tetap ~298 dtk. Fase klip 18:04 → 9:33. Perkiraan job penuh 20,4 → ~11,9 menit. Rinciannya di spec bagian 7. Waktu yang turun tiga kali lipat menunjukkan jalur FFmpeg dipakai di FFmpeg apt Colab; `backend_error.log` belum diperiksa untuk `ffmpeg_fallback`.
- Posisi x awal trajektori sedikit berbeda dari job pertama (misalnya klip 1: 0,4477 → 0,4469), sesuai perbedaan frame seri/≤1 frame yang sudah diuji.
- T0.16 `[x]`.

Sisa SP0 (semua butuh pemilik):
1. T0.12: cek manual tampilan di kedua frontend (daftar di entri 2026-11-17).
2. T0.13: satu kali jalan notebook di runtime baru dari awal, plus daftar cek 5 (`history.db` di `/content/work`), 7 (job kedua menunggu giliran), 8 (hapus runtime lalu sambung lagi).
3. Keputusan terbuka 1–13 dan temuan baru (`rerun-ai` vs `rerun_ai` di web, `face_tracking_engine` tidak diteruskan saat rerender).
4. Lalu PR `feat/sp0-pipeline-stability` → `main`.

---

## 2026-11-18 · Mesin pelacakan proyek dipakai saat rerender; "AI ulang" web ke backlog

- Bug: `tracking_mode` dan `face_tracking_engine` tidak pernah masuk metadata proyek (`_finalize_job`), dan `create_rerender_job`/`create_rerun_ai_job` menerima `face_tracking_engine` tapi tidak menyimpannya ke job, jadi rerender dan AI ulang selalu Haar. Perbaikan: keduanya disimpan di metadata; rerender/AI ulang memakai mesin yang diminta aplikasi bila dikirim (`model_fields_set`), selain itu mesin proyek, selain itu Haar (proyek lama). Desktop dan web tidak mengirimnya, jadi mesin proyek yang dipakai. Uji baru `backend/tests/test_tracking_engine.py` (6, semuanya gagal sebelum perbaikan). Tes 599 lulus + 6 dilewati.
- "AI ulang" di web bukan bug kecil: web selalu `provider: "manual"` tanpa API key, backend `rerun_ai` butuh provider + key, dan web memanggil `/rerun-ai`. Dicatat sebagai task SP4 di roadmap.
- Temuan keamanan (lama, bukan dari SP0): `_finalize_job` menyimpan `api_key` dan `pexels_api_key` ke metadata di `history.db`. `metadata.json` di pustaka menyaringnya (`workspace._SECRET_KEYS`), tetapi snapshot `history.db` (T0.9) ikut ke Drive, seperti `history.db` di Drive sebelum SP0. Masuk keputusan terbuka: simpan key di tempat lain atau saring dari metadata DB (fitur Resume BYOK memakainya).

---

## 2026-11-18 · Keputusan terbuka dijawab pemilik

- **No. 11 (Drive belum ter-mount):** tolak job. Backend tidak membuat folder di bawah `/content/drive` tanpa mount; setiap job berhenti sebelum mulai dengan pesan "jalankan Langkah 1". → task T0.17.
- **API key di `history.db`:** jangan simpan. `api_key`/`pexels_api_key` tidak masuk metadata; Resume memakai kunci yang dikirim aplikasi. → task T0.18.
- **No. 2 (`/save_file`, `/video` bisa membaca app data termasuk cookies):** tutup sekarang di SP0. → task T0.19.
- Sisanya disetujui sesuai rekomendasi:
  - No. 1: cookies tetap di Drive saat di Colab.
  - No. 3: tercakup ADR-012, ditutup.
  - No. 4: `PLAYER_CLIENT_ORDER` tidak diubah (unduhan dengan cookies terbukti jalan 2026-11-18).
  - No. 5 dan 13: tetap `remote_components=['ejs:github']`, `yt-dlp-ejs` tidak dipasang; ditinjau ulang bila pengambilan dari GitHub gagal.
  - No. 6: tetap berhenti saat cookies ditolak.
  - No. 7: ekstensi "Get cookies.txt LOCALLY" tetap di panduan.
  - No. 8 (teks error web) dan no. 9 (preflight belum tampil): backlog SP2, bersama task teks layar proses.
  - No. 10: kelas palet di `ErrorCard` desktop dibiarkan.
  - No. 12 (Ngrok tanpa GPU keep-alive): backlog SP1.

Pelaksanaan (2026-11-18): tiga agen (fable, effort high) bekerja paralel, masing-masing di worktree sendiri dari `6c04901`:
- T0.17 di `C:\Users\dhima\projects\ac-t17`, branch `sp0/t0.17-drive-block`.
- T0.18 di `C:\Users\dhima\projects\ac-t18`, branch `sp0/t0.18-no-keys-in-history`.
- T0.19 di `C:\Users\dhima\projects\ac-t19`, branch `sp0/t0.19-protect-app-data`.
Bila sesi terputus: `git -C ..\ac-t1X log --oneline -3` dan jalankan tes di tiap worktree, lalu review dan merge satu per satu (kemungkinan konflik kecil di `backend/errors.py` dan `backend/main.py`).

### T0.19 di-merge (`9eecd7b`)

- Modul baru `backend/path_guard.py` (`is_protected`, `is_within`, `denied`, `safe_upload_name`). Ditolak 403 "Access denied" sebelum cek keberadaan file: folder cookies dan salinan kerjanya, nama berawalan `history.db` (termasuk `-wal`/`-shm`/`-journal`, snapshot, `.part`), dan `backend_*.log`. Path di-`realpath`, prefiks perangkat Windows dibuang, dibandingkan huruf kecil.
- Celah yang ternyata ada: `/upload` memakai nama file dari klien apa adanya, sehingga di Windows bisa menimpa `cookies.txt` atau menulis ke mana pun; `/save_file` tidak memeriksa tujuan dan memakai cek awalan string untuk sumber; `/video` menyajikan `.mp4` di folder cookies; `/api/thumbnails` dan `/api/extract-metadata` menerima path terlindung. Semua ditutup, 55 tes baru di `backend/tests/test_protected_paths.py` (41 gagal sebelum perbaikan). Invarian E.14 ditambahkan di `.agents/AGENTS.md`.
- Belum ditutup, masuk backlog SP1: `/video` tidak memerlukan token; `canvas_config.background_image_path` dan `output_dir` menerima path bebas.

### T0.18 di-merge (`25e1792`)

- `db.save_history` membuang `api_key`/`pexels_api_key` (`workspace.SECRET_KEYS`); `init_db` dan sinkronisasi snapshot membersihkan baris lama lalu `VACUUM` (agar teks kunci tidak tersisa di halaman kosong file yang disalin ke Drive) dan menulis snapshot baru. Resume dan resume-manual memakai kunci dari request; provider yang butuh kunci tanpa kunci → `AI_KEY_MISSING` (kode baru, id + en). B-roll tanpa kunci Pexels dilewati dengan catatan log. Desktop kini mengirim `pexels_api_key` saat Resume (`useClipJobs.ts`, `ManualResumeModal.tsx`). Web tidak berubah (selalu manual).
- Konflik `AGENTS.md`: T0.19 dan T0.18 sama-sama menambah E.14; aturan T0.18 menjadi E.15.
- Tes 674 lulus + 7 dilewati; `npm run build` desktop exit 0.
- Risiko di luar jangkauan kode: Google Drive bisa menyimpan versi lama `history.db` (riwayat versi, sampah) yang masih berisi kunci. Saran ke pemilik: ganti (rotate) kunci API yang pernah dipakai di desktop dengan workspace di Drive.
- Belum ada ADR untuk perubahan aliran data ini; dicatat di ADR-012 saat PR bila pemilik setuju.

### T0.17 di-merge (`ddcfb0e`); semua kode SP0 selesai

- Modul baru `backend/drive_mount.py`: di mode cloud dengan pustaka di bawah `/content/drive` yang belum ter-mount, `refuse_unmounted` melempar `AppError("DRIVE_NOT_MOUNTED")` alih-alih membuat folder; log dan `history.db` memakai `local_dir()` (work dir `/content/work`), snapshot dimatikan sampai Drive ter-mount lalu digabung. `check_drive` menjadi `block` dan masuk `_BLOCKING_CHECKS`. `colab_api.setup_environment` tidak membuat folder Drive. `scripts/colab_preflight.py` tidak lagi punya cek Drive sendiri. Handler `AppError` global di `main.py` (400 + `error_info`). Teks `DRIVE_NOT_MOUNTED` (id + en) menyuruh hentikan server, jalankan Langkah 1, dan bila Langkah 1 gagal karena folder berisi file: Runtime → "Disconnect and delete runtime". Agen memeriksa sumber `google/colab/drive.py`: `ValueError('Mountpoint must not already contain files')` memang dilempar. Panduan, tutorial (Kendala 9), dan ADR-012 diperbarui.
- Konflik merge: import `db.py` (gabungan) dan `AGENTS.md` (aturan T0.17 menjadi E.16). Interaksi dicek: saat Drive belum ter-mount, snapshot `None` sehingga pembersihan kunci T0.18 tidak menulis ke Drive; `path_guard` T0.19 gagal tertutup dengan `DRIVE_NOT_MOUNTED`.
- Tes 693 lulus + 7 dilewati.
- Sisa kecil: `workspace.library_warnings()` kini hanya membersihkan peringatan Drive lama; bisa disederhanakan nanti.

Sisa SP0 (semua butuh pemilik): cek manual T0.12, satu jalan notebook di runtime baru (T0.13, daftar cek 5, 7, 8, 9), `git push`, lalu PR ke `main`.

---

## 2026-11-18 · Antrean job ternyata tidak pernah dipakai

- Pemilik bertanya apakah fitur "Menunggu giliran" benar-benar ada. Ternyata tidak pernah terjadi: ketujuh fungsi `create_*` di `jobs.py` masih punya penjaga lama `if is_any_job_running(): raise HTTPException(409, "Ada proses lain yang sedang berjalan...")`, jadi job kedua selalu ditolak sebelum sampai ke `job_queue` (T0.4). Tes T0.4 menutupinya dengan menandai job sebelumnya `DONE` sebelum membuat job berikutnya. ADR-012 dan UI T0.12 mengharapkan job kedua mengantre.
- Perbaikan: ketujuh penjaga dihapus; antrean T0.4 tetap membatasi satu job berat. Penolakan Resume ganda untuk proyek yang sama (`_reject_if_still_processing`) tetap. Uji baru `test_second_job_waits_in_line_instead_of_being_refused` (gagal 409 sebelum perbaikan). Tes 694 lulus + 7 dilewati.
- Dicek di Colab lewat daftar cek T0.13 no. 7 (job kedua dari tab/perangkat lain → "Menunggu giliran").

---

## 2026-11-18 · Keputusan: satu PR setelah SP1 dan SP2

- Pemilik memilih tidak membuka PR SP0 sekarang. Draf deskripsi bagian SP0 ada di `tasks/pr-draft-sp0.md`. SP1 dan SP2 diselesaikan dulu, lalu satu PR ke `main`.
- Cara kerja: branch bertumpuk. SP1 di `feat/sp1-...` yang bercabang dari `feat/sp0-pipeline-stability`; SP2 bercabang dari SP1. PR akhir dari branch SP2 ke `main`. Deskripsi PR SP0 yang sudah disiapkan (ringkasan, tabel ukur, keamanan, belum diverifikasi) dipakai sebagai bagian pertama deskripsi PR akhir.
- Selama itu: Colab diuji lewat kolom `BRANCH`; web produksi Vercel tetap `main` (versi lama).
- T0.12 (cek manual UI) dan T0.13 (notebook di runtime baru) tetap terbuka dan dicek sebelum PR akhir; SP2 akan mengubah UI, jadi T0.12 sebaiknya dicek terhadap UI hasil SP2.

---

## 2026-11-18 · Berhenti di 80% kuota: SP1 spec selesai, rencana setengah jadi

Branch aktif: `feat/sp1-single-frontend-web-local` (bercabang dari `feat/sp0-pipeline-stability` di `ed990c6`). Tidak ada perubahan kode sejak tes terakhir hijau (694 lulus, 7 dilewati).

Selesai:
- Spec SP1 disetujui per bagian dan ditulis: `docs/superpowers/specs/2026-11-18-sp1-single-frontend-web-local-design.md` (`e531bbc`, `87f1553`). Keputusan: web lokal untuk pengguna tanpa desktop di `localhost`; Colab tetap lewat Vercel; desktop `src/` jadi basis dengan lapisan platform, `web/` dihapus; paket web lokal siap pakai per OS (Windows, macOS arm64 dan x64, Linux); link video bertanda tangan tanpa kedaluwarsa dengan kunci permanen `video_signing.key` di app data. Pemilik belum memberi review akhir atas spec tertulis, tetapi berkata "oke lanjut" ke tahap rencana.

Setengah jadi:
- Agen penyusun rencana (skill `superpowers:writing-plans`) dihentikan karena kuota. Potongan yang sudah ada disimpan di `docs/superpowers/plans/wip/2026-11-18-sp1-plan-part1.md` (header, Global Constraints, pertanyaan untuk pemilik, celah spec, struktur file, urutan 14 task, Task 1–3) dan `...-part2.md` (Task 4–6; Task 6 mungkin belum lengkap). Task 7–14 belum ditulis: backend kunci dan tanda tangan video, `/video` wajib `sig` + `POST /video-url`, link bertanda tangan di frontend, mode web menyajikan UI + aturan token, peluncur `--web`, adapter local + LocalGate, paket dan CI 4 target, hapus `web/` + dokumen + ADR-013 + versi 1.19.0.

Langkah berikutnya:
1. Baca kedua file WIP, cek apakah Task 6 lengkap, lalu tulis Task 7–14 dengan format yang sama (bisa lewat agen baru dengan brief: lanjutkan rencana dari file WIP, jangan tulis ulang Task 1–6).
2. Gabungkan menjadi `docs/superpowers/plans/2026-11-18-sp1-single-frontend-web-local.md`, hapus folder `wip/`, lakukan self-review terhadap spec, commit.
3. Sampaikan ke pemilik: daftar task, bagian "Questions for the owner" dan "Spec gaps" dari part1, lalu tanya cara eksekusi (subagent per task, model fable effort high).

---

## 2026-11-19 · Rencana implementasi SP1 selesai

- `docs/superpowers/plans/2026-11-18-sp1-single-frontend-web-local.md` (`03f19bb`), 14 task, tabel cakupan spec di akhir; folder `wip/` dihapus. Task 3 dibetulkan (import `API_URL` lokal yang hilang akan membuat `tsc` gagal).
- 15 pertanyaan untuk pemilik dengan pilihan bawaan (bagian "Questions for the owner" di rencana), 17 celah spec/kode (bagian "Spec gaps"). Baru di Task 7–14: paket web memakai folder data yang sama dengan desktop; karantina macOS dihapus oleh `.command`; peluncur Linux membuka terminal sendiri; PR Check membangun 4 paket di setiap PR; zip dilampirkan ke rilis `app-v<versi>`.
- Perkiraan jumlah tes setelah semua task: 775 lulus, 11 dilewati (dihitung dari rencana, belum dijalankan).
- Berikutnya: pemilik menyetujui pilihan bawaan, lalu eksekusi task demi task dengan subagen (fable, effort high), review di antara task.

---

## 2026-11-18 · SP1

- Task 1 (toolchain `src/`): React 19, Vite 8, TypeScript 6, plugin-react 6, oxlint, Vitest 5 + jsdom; skrip `npm test` dan `npm run lint`; `tsconfig` dengan `types: ["vite/client", "node"]`; `workflow_dispatch` di PR Check. Tes Vitest pertama: `src/lib/errorInfo.test.ts` (4 lulus).
- `npm run build` lulus tanpa perubahan kode; `oxlint src` 0 error, 29 peringatan (oxlint 1.94 terpasang menambah aturan `immutability`/`purity`/`set-state-in-effect`; 1.78 milik `web/` memberi 14). Backend tetap 694 lulus, 7 dilewati.
- Catatan: jalankan Vitest dari folder dengan huruf drive besar (`C:\...`). Dari cwd `c:\...` (huruf kecil, misalnya Git Bash di `/c/...`) suite gagal dengan `Cannot read properties of undefined (reading 'config')` karena vitest termuat dua kali.
- Task 2 (inti platform): `src/platform/` berisi `types`, `caps`, `select`, `backendUrl`, `auth`, `paths`, `localSecrets`; `src/env.d.ts` mendeklarasikan `VITE_TARGET`, `VITE_API_URL`, `VITE_DEV_BACKEND`. Modul belum dipakai aplikasi (Task 3).
- Token backend hanya dikirim bila origin permintaan (URL relatif diresolusi terhadap halaman) sama dengan origin backend; tidak lagi karena URL berisi `localhost`/`127.0.0.1` atau diawali `/` (ruling P13).
- Vitest 21 lulus (6 file); `npm run build` lulus; `oxlint src` 0 error, 29 peringatan (tetap). Backend tidak disentuh.
- Task 3 (adapter desktop + lokal dasar): `src/platform/index.ts` (`loadPlatform`/`platform()`), `browser.ts` (bersama untuk local dan nanti cloud), `desktop/` (sidecar, Stronghold, dialog, shell, notifikasi, updater, `prevent_sleep`), `local/` (dasar: backend `127.0.0.1:8000`, token hanya dengan `VITE_DEV_BACKEND=true`), `cloud/` stub. Tidak ada lagi `@tauri-apps/*` atau `__TAURI_INTERNALS__` di komponen/hook; `main.tsx` memuat platform sebelum render.
- Tes pemindai `src/platform/imports.test.ts` memakai helper bersama `src/test/sourceFiles.ts` (P11). `window.apiToken` dihapus (tak ada pembaca, P17). Notifikasi browser: izin diminta sekali saat pengguna pertama kali memulai job (member baru `Platform.askNotifyPermission`, P19). `folderToOpen()` mencegah `open_folder` dengan path kosong.
- Vitest 41 lulus (12 file); `npm run build` lulus (adapter dipecah jadi chunk sendiri); `oxlint src` 0 error, 27 peringatan. Backend tidak disentuh.
- Cek browser (Edge headless lewat CDP, backend dev-token + `VITE_DEV_BACKEND=true npm run dev`): landing → app, sidebar "Terhubung", Riwayat termuat (`/history` membawa `Bearer dev-token`), Settings tanpa baris "Pilih Folder", izin notifikasi tetap `default` saat halaman dimuat, tanpa error konsol. Bagian updater masih tampil di Settings lokal (P5, disembunyikan di Task 5). Cek Tauri: checklist pemilik (Task 14).
- Task 3 perbaikan review: pesan gagal mulai pindah ke `startup.*` di `id.json`/`en.json` (`src/startupError.ts`, detail teknis di `<details>`); tes handshake sidecar (`desktop/sidecar.test.ts`); pemilih gambar latar membuka input file secara sinkron bila tak ada dialog OS. Vitest 51 lulus (15 file), build lulus, oxlint 0 error.

### 2026-11-19 · Berhenti di 80% kuota (SP1 eksekusi)

- Eksekusi rencana SP1 dengan subagent-driven-development. Ledger lengkap (status per task, keputusan, temuan yang ditunda) ada di `.superpowers/sdd/2026-11-18-sp1-single-frontend-web-local/progress.md` (diabaikan git lewat `.git/info/exclude`; kalau hilang, pulihkan dari `git log`).
- Selesai dan lolos review: Task 1 (`5652aec`), Task 2 (`69366dc`). Task 3 (`3f7bd3b`) + putaran perbaikan 1 (`caf2406`): perbaikan sudah di-commit, tetapi re-review terbatas belum dijalankan. Cek terakhir: Vitest 51/51, build desktop OK, oxlint 0 error.
- Lanjutkan: re-review `3f7bd3b..caf2406` untuk 3 temuan (teks error startup ke locale, tes handshake sidecar, klik pemilih gambar sinkron), tandai Task 3 selesai, lalu Task 4 (brief siap di folder ledger). 20 keputusan pre-flight (P1–P20) ada di ledger dan harus dibawa ke task terkait (P1, P9, P10, P20 → Task 5; P2, P16 → Task 13; P3 → Task 10; P4 → Task 7/8; P6, P18 → Task 14; P7, P15 → Task 11; P11, P12 → Task 9; P14 → Task 4).
- Catatan lingkungan: jalankan Vitest dari `C:\...` (huruf drive besar).

### 2026-11-19 · Serah terima untuk AI lain

- `tasks/HANDOFF-AI.md`: urutan membaca, posisi SP1, cara mengerjakan setiap task (TDD, pemeriksaan, commit, review sebelum lanjut), keputusan pre-flight per task, lingkungan mesin, aturan dan preferensi pemilik.
- `tasks/sp1-ledger.md` kini ledger resmi SP1 (ikut git); `tasks/sp1-reviewer-instructions.md` panduan review per task.
- Penunjuk di root untuk berbagai AI: `AGENTS.md` (Codex, Cursor, dll.), `CLAUDE.md` (Claude Code), `GEMINI.md` (Gemini CLI); `.agents/AGENTS.md` diberi catatan di bagian atas.
- Task 4 (i18n tunggal): kunci `action.pick_from_drive` dan `cookies.privacy_cloud` ditambahkan ke `src/locales/{id,en}.json` lewat `scripts/add-locale-keys.mjs`; `scripts/check-web-strings.mjs` membuktikan semua 138 teks `web/src/lib/strings.ts` yang dipindah SP1 sudah ada di `src/locales`.
- Uji paritas kunci id/en ditambahkan di `src/locales/locales.test.ts`. Vitest 52 lulus (16 file), `npm run build` lulus, `oxlint src` 0 error (27 peringatan). Backend tidak disentuh.
- Task 5 (adapter cloud, `AuthGate`, `GDriveBrowserModal`, `build:cloud`): `src/platform/cloud/` (`index.ts` + `token.ts` bebas efek samping sesuai P20; anggota browser bersama di `browserPlatformParts` di `src/platform/browser.ts` sesuai P11 dan `askNotifyPermission` sesuai P19).
- `AuthGate` dan `GDriveBrowserModal` dipindah ke `src/components/` dengan teks `auth.*` (termasuk `character_alt` dan `logo_alt`, P9) dan `drive.*` di `src/locales/{id,en}.json`; cloud dimulai di `/manual-ai`, menyembunyikan "AI Clipper", bagian provider, dan updater (P5), serta memakai `cookies.privacy_cloud`.
- `.env.cloud`, `vercel.json`, dan skrip `npm run build:cloud` ditambahkan. Vitest 58 lulus (17 file), `npm run build` dan `npm run build:cloud` lulus, `oxlint src` 0 error (29 peringatan).
- Cek browser cloud (Edge headless lewat CDP, backend `AUTO_CLIPPER_CLOUD_MODE=1` + `VITE_API_URL` + `vite --mode cloud`): AuthGate tampil tanpa landing page, token salah ditolak (backend 401 lintas-origin tertahan di luar `CORSMiddleware` → `auth.error_offline`), token `test-token` membuka `#/manual-ai`, sidebar tanpa "AI Clipper", modal Drive menampilkan `drive.empty`, Settings menyembunyikan Provider & Updater dan menampilkan `cookies.privacy_cloud`.
- Task 6 (aksi kartu error per platform): `src/lib/errorActions.ts` (`errorActionHandlers`, `actionLabels`) + `src/lib/errorActions.test.ts` (5 tes); `useErrorActions.ts` dan `ErrorCard.tsx` memakai `platform().caps`.
- Di cloud, `upload_video` membuka penjelajah Google Drive dengan label `action.pick_from_drive` dan `open_settings` disembunyikan; di desktop/local perilaku tetap sama. Menyelesaikan keputusan terbuka SP0 no. 8. Vitest 63 lulus (18 file), `npm run build` dan `npm run build:cloud` lulus, `oxlint src` 0 error.
- Task 7 (kunci dan tanda tangan video di backend): `backend/video_sign.py` (`load_key`, `sign`, `verify`, `signed_url`, `with_video_urls`); `video_signing.key` (32 byte acak) dibuat sekali di folder data aplikasi (atau `drive_mount.local_dir()` bila Drive Colab belum ter-mount, E.16) dan dilindungi `path_guard` (`_PRIVATE_FILE_PREFIXES`).
- `with_video_urls` membaca kunci sekali per batch klip (P4) tanpa menyimpannya di memori antar request; penulisan file privat 0600 atomik memakai satu helper bersama `path_guard.write_private_file` (P11). `pytest`: 708 lulus, 8 dilewati (+14 lulus, +1 dilewati di `test_video_sign.py`).
- Task 8 (`/video` wajib `sig`, `POST /video-url`, link di data klip): `GET /video` menolak (403) permintaan tanpa `sig` atau dengan `sig` salah di semua platform (menutup temuan T0.19); `verify_token` mengecualikan tepat `path == "/video"` sehingga `POST /video-url` tetap wajib token.
- `GET /jobs/{id}` dan `GET /history` menambahkan `video_url` bertanda tangan saat dibaca (tidak pernah disimpan di `history.db`), dengan pembacaan `video_signing.key` sekali per request `/history` lintas seluruh entri (P4). `pytest`: 723 lulus, 8 dilewati (+15 di `test_video_links.py`).
- Task 9 (link video bertanda tangan di frontend): `src/lib/videoUrl.ts` (`videoHref`, `requestVideoUrl`, `recoverVideoLink`), `src/lib/localErrors.ts` (`VIDEO_LINK_REFUSED`), dan `src/hooks/useSignedVideo.ts` (meminta `POST /video-url` sekali saja saat link kosong atau ditolak tanpa request ganda di StrictMode, P12).
- `ClipCard` memakai `clip.video_url` dari backend dan menampilkan `ErrorCard` bila pembaruan link tetap ditolak; `videoSrc` dihapus dari `App.tsx`, `ClipsResult.tsx`, `HistoryPage.tsx`, `ManualAIEditorPage.tsx`, dan `WorkspacePage.tsx`. Tes pemindai sumber di `videoUrl.test.ts` memakai `src/test/sourceFiles.ts` (P11).
- Vitest 74 lulus (20 file), `npm run build` dan `npm run build:cloud` lulus, `oxlint src` 0 error (29 peringatan). Cek browser (Edge headless lewat CDP): klip di Riwayat memakai `/video?path=...&sig=...&v=...`, tombol Download mengarah ke `...&dl=1`, dan setelah `video_signing.key` dihapus pemutar meminta `POST /video-url` lalu memutar klip dengan `sig` baru (HTTP 206).
- Task 10 (mode web menyajikan UI + aturan token): `backend/web_ui.py` menyajikan `/` (`index.html`), `/assets/*`, dan file gambar root tanpa token saat `AUTO_CLIPPER_WEB_MODE` aktif, dengan MIME type eksplisit dan pemeriksaan `path_guard.is_protected` terlebih dulu sebelum akses file (P3, E.14).
- `verify_token` di `backend/main.py` mewajibkan token peluncuran untuk semua path non-publik di mode web (termasuk `/heartbeat`), tanpa mengubah aturan desktop maupun cloud. `pytest`: 747 lulus, 8 dilewati (+24 di `test_web_ui.py`).
- Task 11 (peluncur `backend --web`): `backend/web_mode.py` mengikat server ke `127.0.0.1` pada port kosong acak dengan token baru per peluncuran, menyimpan `web_instance.json` (`{port, pid, token}`, mode 0600 lewat helper bersama `path_guard.write_private_file` sesuai P11, dilindungi `path_guard`), dan mencetak teks konsol dwibahasa.
- Peluncuran kedua mendeteksi instance aktif lewat `/` dan `POST /heartbeat` bertoken, lalu hanya membuka tab baru ke server yang sedang berjalan dan keluar (exit 0). Tes `ui_dir` menormalkan kedua sisi path (P7) dan `test_free_port` diberi assert eksplisit (P15). `pytest`: 763 lulus, 9 dilewati (+16 lulus, +1 dilewati di `test_web_mode.py`); uji jalankan langsung `python -m backend.main --web` lulus (server pertama melayani `dist/index.html`, peluncuran kedua menyerahkan ke port/token yang sama).
