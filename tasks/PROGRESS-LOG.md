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

### 2026-11-19 · Berhenti sesuai instruksi kuota pemilik (sisa 30%)

- Selesai dan lolos review di sesi ini:
  - Re-review perbaikan Task 3 (`3f7bd3b..caf2406`) → Approved (`69366dc..caf2406`).
  - Task 4 (`0909a0e`) → Approved (`bc2b2a8..0909a0e`).
  - Task 5 (`97716b3`) → Approved (`0909a0e..97716b3`).
  - Task 6 (`ae835ed`) → Approved (`97716b3..ae835ed`).
  - Task 7 (`092c907`) → Approved (`ae835ed..092c907`).
  - Task 8 (`2ac1b3a`) → Approved (`092c907..2ac1b3a`).
  - Task 9 (`df54bef`) → Approved (`2ac1b3a..df54bef`).
  - Task 10 (`cd7d065`) → Approved (`df54bef..cd7d065`).
- Task 11 (`8fe5570`): kode selesai dan di-commit, semua tes hijau (`pytest` 763 lulus, 9 dilewati; Vitest 74 lulus di 20 file; `npm run build` & `npm run build:cloud` OK; `oxlint src` 0 error), tetapi review Task 11 belum dijalankan karena dihentikan sesuai instruksi kuota pemilik.
- Langkah berikutnya untuk sesi selanjutnya:
  1. Review Task 11 (`cd7d065..8fe5570`) mengikuti `tasks/sp1-reviewer-instructions.md` (brief `task-11-brief.md`, laporan `task-11-report.md`, dan diff `review-cd7d065..8fe5570.diff` sudah siap di `.superpowers/sdd/2026-11-18-sp1-single-frontend-web-local/`), lalu tandai Task 11 selesai di `tasks/sp1-ledger.md`.
  2. Lanjutkan Task 12 (adapter local token & `LocalGate`), Task 13 (paket web lokal & CI 4 target, bawa P2 dan P16), dan Task 14 (hapus `web/`, dokumen, ADR-013, versi 1.19.0, bawa P6 dan P18).

### 2026-11-19 · Lanjutan SP1

- Task 11 (`8fe5570`): lolos review (`cd7d065..8fe5570`, Approved, 2 minor ditunda ke ledger).
- Task 12 (adapter web lokal & `LocalGate`): `src/platform/local/token.ts` mengambil `#t=<token>` ke `sessionStorage` lalu mengubah hash ke `#/`; `src/platform/local/index.ts` memakai `browserPlatformParts` (P11/P19), `folderToOpen` (Task 3), dan memancarkan `ac_backend_lost` saat `reconnect()` gagal; `LocalGate` & `localErrors.ts` menangani `LOCAL_TOKEN_MISSING`, `LOCAL_TOKEN_EXPIRED`, `LOCAL_SERVER_CLOSED`.
- Vitest 86 lulus (21 file, termasuk `local.test.ts` +9 dan `localErrors.test.ts` 5), `npm run build` & `npm run build:cloud` lulus, `oxlint src` 0 error (30 peringatan).
- Cek browser web lokal penuh (Edge headless lewat CDP + `backend.main --web` & mode dev): `#t=` hilang menjadi `#/` dan "Terhubung"; Settings lokal tampilkan API key tanpa Pilih Folder/Updater; buka tanpa `#t=` tampilkan "Buka lewat \"Auto Clipper Web\""; peluncur kedua tampilkan "Auto Clipper sudah berjalan"; server dimatikan + focus tampilkan "Jendela Auto Clipper sudah ditutup" + Coba lagi tetap menampilkannya; mode dev `VITE_DEV_BACKEND=true` lulus `LocalGate`. Alur buat job/putar klip/Buka folder/Rerender All tetap di daftar cek manual pemilik (Task 14).
- Task 13 (pemaketan Auto Clipper Web & CI): menambah `scripts/web_launcher.py`, `scripts/assemble_web_package.py`, `scripts/smoke_web_package.py` (diterapkan P16 `ignore_cleanup_errors=True`, serta polling `_wait_stopped` + tangkap `http.client.HTTPException` setelah review), `packaging/web/{Auto Clipper Web.command,Auto Clipper Web.sh,BACA-SAYA.txt}`, `.gitattributes` (LF untuk skrip shell), serta workflow `.github/workflows/web-package.yml` (`contents: read` sesuai P2), `web-package` + `web-release` di `build.yml`, `checks` + `web-package` di `pr-check.yml`, dan entri `.gitignore`. Tes unit launcher (`test_web_launcher_script.py`: 17 lulus, 2 dilewati di Windows), `git ls-files --eol` menunjukkan `i/lf w/lf`, `pytest` 780 lulus / 11 dilewati, Vitest 86 lulus, `oxlint` 0 error, `npm run build` & `build:cloud` lulus, validasi YAML 3 workflow lulus; coba paket lokal PyInstaller di Windows dilewati (`skipped, no PyInstaller` di venv — mengandalkan CI).
- Task 14 (penghapusan `web/`, dokumentasi, ADR-013, `AGENTS.md`, `1.19.0`, roadmap): folder `web/` dan `scripts/check-web-strings.mjs` dihapus pada `f45b1d1` beserta pembaruan 3 komentar lama `web/src` di `src/`; ADR-013 ditulis; `.agents/AGENTS.md` diperbarui (P18); `README.md` (P6 Opsi 3 + Opsi 5 + Opsi 6), `docs/tutorial-auto-clipper-cloud.md`, `docs/panduan-penggunaan-awam.md`, dan `docs/cloud-architecture-plan.md` diperbarui sesuai label UI terverifikasi di `src/locales/id.json`; versi dinaikkan ke `1.19.0`; `CHANGELOG.md`, `docs/superpowers/specs/2026-11-12-enhancement-roadmap.md`, dan `tasks/roadmap-todo.md` diperbarui. Verifikasi akhir: `pytest` 780 lulus / 11 dilewati, Vitest 21 file / 86 lulus, `oxlint src` 0 error, `npm run build:cloud` & `npm run build` (v1.19.0) exit 0, grep sisa `web/` & versi `1.18.0` nihil.

### Daftar cek manual SP1 (pemilik)

Untuk setiap platform: buat job dari URL, buat job dari file, klip hasil terputar, simpan klip, buka folder (desktop dan web lokal), Pengaturan, cookies (unggah dan hapus), kartu error (mis. URL salah, video unggahan hilang), Riwayat, Rerender All.

- [ ] Desktop Windows (installer dari "PR Check" atau build lokal): semua butir di atas; pembaruan aplikasi masih terdeteksi; komputer tidak tidur saat render.
- [ ] Web lokal Windows (zip dari "Web Package"): semua butir; SmartScreen "Run anyway"; peluncur kedua membuka tab baru; tutup lalu buka lagi → port sama dan API key/pengaturan masih ada; menutup jendela → kartu "Jendela Auto Clipper sudah ditutup".
- [ ] Web lokal macOS (arm64 atau x64): pembukaan pertama lewat System Settings → Privacy & Security → Open Anyway (macOS 15+) atau klik kanan → Open (macOS 14 ke bawah); cek juga backend dan FFmpeg jalan tanpa peringatan lagi; semua butir.
- [ ] Web lokal Linux (bila ada mesin): semua butir.
- [ ] Cloud: proyek Vercel kedua dari branch ini (Root Directory kosong, Node 22.x, `VITE_API_URL`), Colab dengan branch ini: masuk dengan kode akses (kode salah → pesan "Kode akses ditolak", bukan "Server Colab tidak bisa dihubungi"), Manual AI Editor → Riwayat → Lanjut Manual, Drive, cookies, putar dan unduh klip dari HP.
- [ ] Saat PR akhir digabung: proyek Vercel produksi → Root Directory kosong, Node 22.x, Redeploy.

### 2026-11-20 · Perbaikan review akhir SP1

- Review akhir (Needs fixes: Important 2, Minor 8) diperbaiki dalam satu gelombang, 8 commit `3683d0a..6313443`: I1 web lokal memakai ulang port peluncuran sebelumnya (`web_port.json`, 0600) sehingga API key/pengaturan di browser tidak hilang; I2 panduan macOS 15+ "Open Anyway"; M1 `xfce4-terminal -x`; M2 pesan antivirus di peluncur Windows; M3 `web_instance.json` rusak tidak lagi menghentikan peluncuran; M4 tombol Drive di dua panduan; M5 401 cloud membawa header CORS; M7 Linux butuh glibc 2.35; M8 `npm audit fix` (0 kerentanan).
- Tes: `pytest` 805 lulus / 12 dilewati; Vitest 22 file / 89 lulus; `npm run build` & `build:cloud` OK; `oxlint src` 0 error (30 peringatan lama). Cek nyata: dua peluncuran `backend.main --web` (yang pertama dimatikan paksa) mendapat port yang sama dengan token baru.
- Tersisa: M6 (`pickVideo()` tak terpakai) ke SP2; daftar cek manual pemilik di atas (macOS 15+, Xfce, antivirus, cloud 401 dari HP).

### 2026-11-20 · SP1 diverifikasi independen

- Review menyeluruh independen (opus; fable butuh kredit) atas `2afbb42..89fce4f`: 0 Critical, 2 Important, 8 Minor, tanpa celah keamanan. Satu gelombang perbaikan `7cfacb6..247141c` (port web lokal dipakai ulang sesuai keputusan pemilik, dokumen macOS 15+, header CORS pada 401, peluncur Linux/Windows, `npm audit` 0). Re-review: semua tertangani.
- Pemeriksaan controller: pytest 805 lulus / 12 dilewati, Vitest 89, build desktop dan cloud OK, `npm audit` 0.
- Diparkir untuk dikerjakan sebelum PR akhir: cek port bebas juga menguji `connect` ke 127.0.0.1; panah LaTeX `\rightarrow` yang rusak di tutorial Kendala 9; komentar tes yang menyesatkan. Detail di `tasks/sp1-ledger.md`.
- Berikutnya: pemilik menjalankan daftar cek manual SP1 dan memicu CI setelah push; lalu SP2 dimulai dengan brainstorm + spec.

---

## 2026-11-20 · SP2 dimulai: spec selesai

- Branch `feat/sp2-ux-for-everyone`, bercabang dari SP1 di `dc3ba66`.
- Spec: `docs/superpowers/specs/2026-11-20-sp2-ux-for-everyone-design.md` (`4bed222`). Keputusan pemilik: HP dulu; AI manual dipandu sebagai jalur utama (API key opsi lanjutan); gaya bersih dan tenang; alur 4 langkah (Video → Siapkan → Pilih momen → Klip) dengan tiga menu (Buat klip, Riwayat, Pengaturan); diskusi lewat chat; sisanya ikut rekomendasi dengan patokan UX jelas untuk orang awam.
- Berikutnya: pemilik membaca spec, lalu rencana implementasi (skill writing-plans) dan eksekusi task per task dengan review. Agen memakai opus (fable butuh kredit).

### 2026-11-20 · Berhenti di ~80% kuota: rencana SP2 setengah jadi

- Agen penyusun rencana SP2 dihentikan. Tersimpan dan ter-commit di `docs/superpowers/plans/wip-sp2/`: `part-00-header.md` (header, Global Constraints, pertanyaan pemilik, celah spec, struktur file, urutan 18 task) dan Task 1–12 (`part-01` sampai `part-06`, commit terakhir `78350e5`).
- Belum ditulis: Task 13 (Riwayat), 14 (Pengaturan empat bagian), 15 (audit antislop), 16 (tiga item SP1 yang diparkir), 17 (dokumen, CHANGELOG, ADR-014, AGENTS.md), 18 (verifikasi akhir dan uji pemakaian pemilik).
- Langkah berikutnya (untuk AI mana pun, lihat `tasks/HANDOFF-AI.md` bagian 3): baca `part-00` dan task terakhir yang sudah ada untuk nama dan antarmuka, tulis Task 13–18 dengan format yang sama ke `wip-sp2/part-07-...`, gabungkan semua menjadi `docs/superpowers/plans/2026-11-20-sp2-ux-for-everyone.md` (header + tabel cakupan spec di akhir), hapus `wip-sp2/`, commit; lalu pemindaian pre-flight dan Task 1.
- Belum ada kode SP2 yang berubah; tes masih seperti akhir SP1 (pytest 805/12, Vitest 89).

## 2026-11-20 · SP2

- Rencana SP2 selesai digabung (`docs/superpowers/plans/2026-11-20-sp2-ux-for-everyone.md`, Task 1–18 + tabel cakupan spec) dan `wip-sp2/` dihapus. Pemindaian pra-kerja selesai: 16 keputusan P1–P16 (4 Kritis, 6 Penting, 6 Kecil) dicatat di `tasks/sp2-ledger.md`. Siap mulai Task 1.
- Task 1 (`stage_timer` tahap berjalan): `collect_timings(timings, live)` menyimpan tahap yang sedang berjalan di tumpukan milik job; `current_stage(live)` membentuk objek `current` (spec 4.4) dengan `elapsed_seconds` dari jam server; `report()` untuk `percent` dan `clips_total`, tidak pernah masuk `timings`. pytest: 815 lulus, 12 dilewati (+10).
- Task 2 (`current` di status job): menambah `live_stage()` di `backend/jobs.py`, `report(clips_total=...)` di keempat loop render, `metadata["timings"] = job["timings"]` pada `_run_manual_resume_job`, `download_percent()` dan hook persentase di `backend/video_utils.py`, serta field `current` di `GET /jobs/{id}` (`backend/main.py`). pytest: 829 lulus, 12 dilewati (+14).
- Task 3 (gambar latar kanvas lewat `path_guard`): menambah `POST /upload-image` dan `_canvas_image_refused` di kelima endpoint job (`backend/main.py`), `uploadCanvasImage()` (`src/api.ts`), dan unggahan di `CanvasConfigControls.tsx` (status + alert error tanpa `blob:`, kunci unggahan ganda + `configRef` anti-stale); checklist `T1.y` gambar kanvas dicentang (`output_dir` tetap terbuka untuk SP3). pytest: 844 lulus, 12 dilewati (+15); Vitest: 92 lulus (+3); oxlint: 0 error; `build` dan `build:cloud` sukses.
- Task 4 (basis visual dan aksesibilitas): memperbarui token warna WCAG AA (`src/index.css`, `tailwind.config.js`), skala huruf 16 px isi, `:focus-visible`, kontrol 44 px (`Button`, `ToggleSwitch`, `InputGroup`, `Select`, `SegmentedControl`, `ConfirmDialog`), `Toasts.tsx` memakai token semantik AA (P4), `<html lang>` + simpan `ac_lang` (`src/i18n.ts`), teks `timing.stage_render`/`device_encoder` menjadi bahasa awam (`Membuat klip`/`Pembuatan klip`), serta tes kontras & `plainWords`. Skrip `contrast-check.py`: seluruh 10 pasangan utama ≥ 5,44:1. Vitest: 142 lulus (+50); oxlint: 0 error (28 warning); `build` dan `build:cloud` sukses.
- Task 5 (kerangka tiga menu dan rute): menambah `caps.keepOpen` (`src/platform/types.ts`, `caps.ts`), `ROUTES` / `SETTINGS_ANCHORS` / `LEGACY_REDIRECTS` (`src/lib/routes.ts`, `legacyRoutes.tsx`), `useBackendStatus` + `useScrollToHash`, komponen navigasi responsif (`BottomNav`, `SideNav`, `ConnectionStatus`, `BackendBanner`), `AppLayout` (`lg:invisible` per P3), rute baru + pengalihan di `App.tsx`, serta menghapus `Sidebar.tsx` dan `LandingPage.tsx`. Vitest: 153 lulus (+11); oxlint: 0 error (28 warning); `build` dan `build:cloud` sukses.
- Task 6 (logika alur empat langkah, cek tautan, judul otomatis, dan pilihan tersimpan): menambah `src/lib/createFlow.ts` (`activeStep`, `stepStates`, `linkProblem`, `sourceName`, `autoProjectTitle`, `effectiveProvider` + konstanta tahap `PREPARE_STAGES`/`CHOOSE_STAGES`/`MAKE_STAGES`) dan `src/lib/clipChoices.ts` (`loadClipChoices`, `saveClipChoices` dengan Ruling P14 menghapus `background_image_path` saat menyimpan). Vitest: 186 lulus (+33); oxlint: 0 error (28 warning); `build` dan `build:cloud` sukses.
- Task 7 (catatan dan kartu pemblokir preflight): menambah `src/lib/preflight.ts` (`splitPreflight`, `blockerInfo`), `src/hooks/usePreflight.ts` (cek `GET /api/preflight` saat layar dibuka, koneksi pulih, dan `recheck`), `src/components/create/PreflightNotices.tsx` (catatan `warn` dan `ErrorCard` `block` dengan tombol `Periksa lagi`), serta tes unit/komponen (P15 diterapkan di `usePreflight.test.tsx`) dan kunci `create.recheck`/`create.notes_label`. Vitest: 193 lulus (+7); oxlint: 0 error (29 warning, termasuk 1 `set-state-in-effect` terrencana di `usePreflight.ts`); `build` dan `build:cloud` sukses.
- Task 8 (langkah 1 layar Buat klip & penyambungan pilihan tersimpan): menambah `src/components/create/StepIndicator.tsx`, `VideoStep.tsx`, `ClipOptions.tsx`, `src/pages/CreatePage.tsx` (termasuk judul proyek otomatis & `platform().pickVideo()`), `aiMode` di `useUserSettings.ts` (`ac_ai_mode`), `overrideTitle`/`aiMode`/P2 lengkap (`handleResumeJob` memakai `effectiveProvider`) di `useClipJobs.ts` & `App.tsx` (P2/P6, `choices`, rute `/`), menghapus `WorkspacePage.tsx`, `ManualAIEditorPage.tsx`, `GenerateForm.tsx`, menambah teks `create.*`, serta tes `useClipJobs.test.tsx` dan `CreatePage.test.tsx`. Vitest: 206 lulus (+13); oxlint: 0 error (28 warning); `build` dan `build:cloud` sukses.
- Task 9 (logika progres tahap nyata & catatan perangkat): menambah `src/lib/progress.ts` (`asLiveStage`, `stagesFor`, `progressRows`, `deviceNotes` termasuk penyembunyian tahap yang terlewati dan pelabelan `hook_concat` sebagai `render`) beserta `src/lib/progress.test.ts`. Vitest: 219 lulus (+13); oxlint: 0 error (28 warning); `build` dan `build:cloud` sukses.
- Task 10 (layar progres menggantikan BusyOverlay): menambah `src/hooks/useNow.ts`, `src/components/create/ProgressPanel.tsx` (`ProgressPanel.test.tsx`), dan `src/components/nav/RunningBar.tsx` (`RunningBar.test.tsx`), memperbarui `useClipJobs.ts` (status `PENDING` P1, hapus awalan `⚠️ ` & teks `smartEditor.submitted` P8, tambah `current`/`liveMeta`/`makePhase`/`jobOrigin`), `App.tsx`, `CreatePage.tsx` (P16: `<ProgressPanel>` di atas `<ClipsResult>` & fallback `liveMeta` untuk `tracking`), `AppLayout.tsx`, menghapus `BusyOverlay.tsx`, membersihkan `toast.*`, serta memasukkan `"toast"` ke `plainWords.test.ts` (+ tes fallback `liveMeta` di `CreatePage.test.tsx`). Vitest: 225 lulus (+6); oxlint: 0 error (28 warning); `build` dan `build:cloud` sukses.
- Task 11 (langkah 3 AI manual terpandu & validasi jawaban): menambah `src/lib/aiAnswer.ts` (`stripCodeFence`, `checkAiAnswer` beserta `aiAnswer.test.ts`), `src/lib/clipboard.ts` (`copyText` dengan fallback), dan `src/components/create/MomentStep.tsx` (`MomentStep.test.tsx`), memperbarui `useClipJobs.ts` (P9 di cabang `AWAITING_MANUAL`, `beginJob` pembersih `awaiting`/`answerError` di semua jalur mulai/lanjut, `submitAiAnswer`, `openAwaiting`, `leaveAwaiting`, hapus `startManualResumePolling`), `App.tsx`, `CreatePage.tsx` (`key={ctx.awaiting.jobId}`), `HistoryPage.tsx` (tombol `Tempel jawaban AI`), menghapus `ManualResumeModal.tsx`, serta menambah teks `moment.*` dan `projects.action_paste_answer` (+ tes P9/`submitAiAnswer`/`beginJob` di `useClipJobs.test.tsx`). Vitest: 243 lulus (+18); oxlint: 0 error (27 warning); `build` dan `build:cloud` sukses.
- Task 12 (kartu hasil, menu titik tiga, dan Unduh semua): menambah `saveClips` (`src/platform/types.ts`, `browser.ts`, `desktop/index.ts`, tes unit platform), `src/lib/clipInfo.ts` (`clipInfo.test.ts`), `src/components/ui/OverflowMenu.tsx` (`OverflowMenu.test.tsx`, termasuk ring `:focus-visible` & `onBlur`), memperbarui `ClipCard.tsx` (P16 `flex-wrap`/`outline`, drop badge skor AI, `editedSocial ?? clip.social`), `ClipsResult.tsx` (P10 alert inline + key stabil, `ClipsResult.test.tsx`), `useClipJobs.ts` (P8 `resultJobId` + `reloadResult` + `finishCancelled` untuk batal saat rerender klip maupun partial job + tes), `App.tsx`, `CreatePage.tsx` (P16 `<ProgressPanel>` di atas `<ClipsResult>`, `ctx.resultJobId ?? ctx.jobId`, `ClipEditModal`), menghapus `ClipRerenderModal.tsx`, serta menambah teks `result.*`. Vitest: 262 lulus (+19); oxlint: 0 error (25 warning, 0/0 di file Task 12); `build` dan `build:cloud` sukses; review Task 12 Approved.
- Task 13 (Riwayat: daftar proyek dan halaman proyek): menambah `src/lib/projectStatus.ts` (status awam + satu tombol utama per status, termasuk `QUEUED` → `Menunggu giliran`), `src/pages/ProjectsPage.tsx` (`/riwayat`: judul, tanggal, status, jumlah klip, kartu error proyek gagal, menu "⋯" Buat ulang semua klip / Pilih ulang momen dengan AI bila `caps.apiKeys` / Hapus dengan konfirmasi) dan `src/pages/ProjectPage.tsx` (`/riwayat/:id`: klip, laporan, pesan "tidak ditemukan" untuk 404, pemutar dilepas dulu sebelum hapus), dialog `RerenderAllDialog`/`AiCorrectDialog` (dipasang hanya saat terbuka, Escape menutup, isian tidak tereset saat polling), `ProjectStatusBadge`, dan teks `projects.*` (+ `clip_count_one`); `App.tsx` memasang kedua halaman, `HistoryPage.tsx` dihapus. P2 sudah ada sejak Task 8 (`handleResumeJob` memakai `effectiveProvider`), `useClipJobs.ts` tidak berubah. Vitest: 279 lulus (+17); oxlint: 0 error (26 warning, 2 `set-state-in-effect` pada efek muat data); `build` dan `build:cloud` sukses; pytest 844/12 tetap. Tersisa: review Task 13, lalu Task 14 (Pengaturan).
- Task 13 perbaikan review 1: gagal hapus proyek kini memunculkan peringatan `role="alert"` (`projects.delete_failed` + tombol `Coba hapus lagi`) di baris daftar dan di halaman proyek; `Lihat klip` jadi tombol garis (hanya `Tempel jawaban AI` yang terisi); tes baru untuk baris antre (`ctx.jobId` + `queuePosition`), gagal-hapus-lalu-ulang, dan dialog yang tetap menyimpan isian saat halaman dirender ulang. Vitest: 283 lulus (+4); oxlint: 0 error (26 warning); `build` dan `build:cloud` sukses.
- Task 14 (Pengaturan empat bagian): `src/pages/SettingsPage.tsx` kini Umum / YouTube / Lanjutan / Bantuan (`#umum`, `#youtube`, `#lanjutan`, `#bantuan`, `scroll-mt-16`); `src/lib/settingsLayout.ts` (`settingsVisibility` + `showPexelsKey`, `APP_VERSION` dibaca dari `package.json`); komponen baru `AiModeSection` (saklar `ac_ai_mode`, hanya bila `caps.apiKeys`), `PexelsKeySection` (kunci Pexels dipisah dari `ProviderSection` agar B-roll tetap bisa diatur di mode AI manual), `DownloaderPanel` (`#pengunduh`, terbuka bila datang lewat tautan itu, judul otomatis, kartu error hanya untuk unduhan yang dimulai di sini, tautan `Lihat progres`), `HelpSection` (4 langkah, FAQ awam, versi, updater) dan `LogViewer` (Detail teknis, dimuat saat dibuka, pesan gagal muat/salin terlihat); pilihan mesin wajah Standar/Teliti (`ac_face_engine`) di Lanjutan; `AppearanceSection`/`OutputSection` tanpa emoji dan berteks lokal; `handleManualGenerate` menerima `overrideTitle`/`overrideQuality`; `ManualDownloaderPage.tsx` dan `HelpPage.tsx` dihapus beserta kunci `help.*`/`faq.*`.
- Task 14 angka: Vitest 312 lulus (+29); oxlint 0 error (24 warning, 0 di file Task 14); `build` dan `build:cloud` sukses; pytest 844/12 tetap. Tersisa: review Task 14, lalu Task 15 (audit antislop termasuk `ProviderSection`/`TranscriptionSection`/`CookiesSection` lama).
- Task 14 perbaikan review 1: pengunduh di Pengaturan kini punya pilihan sendiri, tidak memakai pilihan Buat klip: Bentuk (Lebar 16:9 bawaan, Vertikal 9:16) dan saklar Tambahkan subtitle (bawaan mati, jadi tidak ada penulisan ucapan); `downloaderLook()` (`settingsLayout.ts`) dikirim lewat parameter baru `overrideLook` (`ManualLook`) di `handleManualGenerate`, teks panel menjelaskan hasilnya. `OutputSection` memakai `vis.showOutputFolder` dan menampilkan pesan bila jendela folder gagal dibuka; `PexelsKeySection` memakai `API_URL` dari `platform/backendUrl`, pesan gagal awam (alasan mentah di Detail teknis), kunci lama `pexels_api_key*`/`test_pexels_*` dihapus; kalimat soal API key di Bantuan (langkah 3, FAQ gratis dan momen) hanya tampil bila `caps.apiKeys`. Vitest: 325 lulus (+13); oxlint 0 error (24 warning, 0 di file Task 14); `build` dan `build:cloud` sukses.

### 2026-11-23 · SP2 Task 15 dihentikan (kuota 98%)
- Task 15 (audit antislop, P11, item "deferred → Task 15", uji browser 360/768/1280) dihentikan di tengah jalan. Perubahan kerjanya di-commit sebagai `wip(sp2)` dan BELUM diverifikasi (tes, build, dan review belum dijalankan).
- BASE Task 15: a068ee6. Sudah ada commit 88f8540 (dialog shell) dan 031a6da (audit layar lama) dari implementer.
- Langkah berikutnya: baca `.superpowers/sdd/2026-11-20-sp2-ux-for-everyone/task-15-brief.md` dan laporan bila ada, cek `git diff a068ee6..HEAD`, selesaikan sisa audit, jalankan pytest, Vitest (path C:\ besar), build, build:cloud, oxlint, lalu review Task 15. Setelah itu Task 16 (brief siap), 17, 18, dan review akhir.

### 2026-11-24 · SP2 Task 15 selesai diverifikasi (audit antislop)
- Commit wip `2eb263a` diperiksa dan semua pemeriksaan hijau; audit dilengkapi. Perbaikan baru: `Badge` memakai latar padat (teks hijau/kuning di latar tipis hanya 4,36/4,38:1 di halaman terang), namespace locale lama yang tidak dipakai dan berisi emoji/em dash dihapus, teks pemeriksaan awal dan FFMPEG_MISSING di backend tanpa "FFmpeg"/"render" (dokumen ikut disesuaikan), tes fokus setelah tombol coba lagi hilang dan tes dialog ProjectPage saat dimuat ulang.
- Penjaga otomatis baru: emoji/em dash di semua teks locale, `timing.device_*` di daftar kata layar utama, 16 pasangan kontras tambahan per tema, larangan latar transparan di `Badge`, kata terlarang di semua keadaan pemeriksaan awal (pytest).
- Browser (Edge headless, data tiruan): 75 pemeriksaan di 360/768/1280 terang dan gelap, 0 overflow, 0 kontrol < 44 px, 0 error console; Tab, focus trap, Escape, dan penjaga isian lulus di keenam kombinasi. Hasil lengkap dan yang belum diverifikasi: `tasks/sp2-audit.md`.
- Angka: pytest 845 lulus, 12 dilewati (+1); Vitest 378 lulus (+37 sejak wip); oxlint 0 error (17 warning); `build` dan `build:cloud` sukses. Tersisa: review Task 15, lalu Task 16.

### 2026-11-24 · SP2 Task 16 (item terbawa dari SP1)
- `backend/web_mode.py` `port_is_free()`: port dianggap terpakai bila `connect(("127.0.0.1", port))` berhasil (batas waktu 0,2 detik), baru setelah itu uji bind. Sebelum perbaikan, di Windows port yang didengar program lain di 0.0.0.0 tetap dianggap kosong (direproduksi oleh tes baru).
- Tes baru di `backend/tests/test_web_mode.py`: pendengar 0.0.0.0, pendengar 127.0.0.1, dan dua tes dengan socket tiruan (bind berhasil tetapi connect dijawab, serta connect ditolak lalu bind berhasil). Komentar "the real liveness check" diganti penjelasan yang benar.
- `docs/tutorial-auto-clipper-cloud.md`: panah Kendala 9 yang terpecah dua baris diperbaiki, dan 16 panah LaTeX `\rightarrow` lain di file itu diganti `→`. `README.md` masih punya 4 di 2 baris (di luar cakupan task ini).
- Angka: pytest 849 lulus, 12 dilewati (+4). Tersisa: review Task 16, lalu Task 17 dan 18.

### 2026-11-24 · SP2 Task 17 (dokumen)
- `docs/panduan-penggunaan-awam.md` Langkah 3 ditulis ulang untuk alur empat langkah Buat klip (Salin perintah, Buka ChatGPT/Gemini, Tempel jawaban AI di sini, Buat klip), layar progres, Unduh semua, Riwayat, dan Pengaturan empat bagian; nama menu lama (History, Local Video, Cookies YouTube) diganti. Tutorial cloud bagian 6 disamakan dengan layar SP2. `README.md`: 4 panah LaTeX (`\rightarrow` di antara tanda dolar) diganti `→`, ringkasan fitur menyebut alur empat langkah dan AI tanpa API key.
- `CHANGELOG.md`: SP2 di bawah `## [1.19.0] - belum dirilis` (Added, Changed, Fixed, Security, Removed). ADR-014 baru (`docs/decisions/014-sp2-live-stage-and-step-ui.md`). `.agents/AGENTS.md`: E.14 (path kanvas, `/upload-image`), E.18 (cek `connect`), E.19 (`current`), E.20 (`effectiveProvider`), F.5 (desain), F.8–F.10 (penjaga teks dan kontras, `caps.keepOpen`/`saveClips`, fungsi murni), daftar file penting.
- `tasks/roadmap-todo.md`: item SP2 per task dengan rentang commit dari ledger; audit Task 15 dan uji pemakaian (Task 18) belum dicentang. Tidak ada kode yang diubah, jadi tes tidak dijalankan ulang. Tersisa: review Task 15 dan 17, lalu Task 18.

### 2026-11-24 · SP2 Task 15 perbaikan review 1
- Batal di dialog ubah klip, buat ulang semua, pilih ulang momen, dan server sendiri kini lewat penjaga isian (`Dialog` `footer` berupa fungsi `requestClose`); Escape di kotak Cari kata hanya mengosongkan pencarian. Dialog Google Drive dibuka lagi di folder terakhir dan Muat lagi mengulang folder yang gagal; fokus setelah hapus cookies ke tombol unggah; "Tersalin" diumumkan; pesan gagal buat ulang klip menurut sebabnya; `common.technical_details`; ikon mata bawaan Edge disembunyikan.
- Tes perilaku baru untuk permintaan `ClipEditModal`, `SocialKitModal`, `ProviderSection`, `TranscriptionSection`, `UpdaterSection`, plus `GDriveBrowserModal`, `CookiesPanel`, dialog Riwayat, dan `Dialog`.
- Browser: enam layar yang tertunda (LocalGate, AuthGate, splash, dialog Drive, dialog cookies, overlay pembaruan) diperiksa di 360/768/1280 terang dan gelap: 84 halaman, 0 overflow, 0 kontrol < 44 px, 0 huruf < 14 px; fokus, Tab, dan Escape lulus. Rincian di `tasks/sp2-audit.md`.
- Angka: Vitest 419 lulus (+41); pytest 849 lulus, 12 dilewati; oxlint 0 error (15 warning); `build` dan `build:cloud` sukses. Tersisa: review ulang perbaikan Task 15.

### 2026-11-24 · SP2 berhenti di Task 18 (kuota ~78%)
- Selesai hari ini: Task 15 (audit antislop + fix round 1, Vitest 419), Task 16 (cek port connect, panah tutorial, komentar tes; pytest 849), Task 17 (panduan, tutorial, README, CHANGELOG, ADR-014, AGENTS.md E.19–E.20/F.9–F.10, plus minor review). Semua lolos review.
- Task 18 langkah 1 selesai di `f7aba4d`: pytest 849/12, Vitest 419, oxlint 0 error, build + build:cloud OK, npm audit 0.
- Review menyeluruh SP2 sudah dimulai tetapi dihentikan sebelum ada hasil. Lanjutkan dari `tasks/HANDOFF-AI.md` bagian 3: review menyeluruh `dc3ba66..HEAD`, satu gelombang perbaikan, review ulang terbatas, lalu daftar cek uji pemakaian pemilik.
