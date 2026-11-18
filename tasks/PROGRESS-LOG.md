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
9. Opsional: unggah `cookies.txt` akun cadangan di Pengaturan ("Berlaku sampai ..."); jalankan sel 4 tanpa sel 1 di runtime baru → "Google Drive belum terhubung".

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

Langkah berikutnya: setelah job selesai, pemilik menjalankan sel uji `h264_nvenc` 256×256, lalu push ulang dan jalankan sel 3–4 untuk melihat apakah pemeriksaan awal berubah menjadi "Render memakai GPU". Catat waktu job pertama ini (render CPU) sebagai pembanding.
