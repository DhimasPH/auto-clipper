# Daftar Task Peningkatan Auto Clipper

Terakhir diperbarui: 2026-11-12. Peta induk: `docs/superpowers/specs/2026-11-12-enhancement-roadmap.md`.

Cara pakai: kerjakan dari atas ke bawah, satu sub-proyek aktif pada satu waktu. Centang task saat kriteria selesai terpenuhi dan terverifikasi. Sebelum mulai sub-proyek, tulis rencana implementasi rinci lewat skill `writing-plans`. `tasks/todo.md` dan `tasks/plan.md` yang lama (Enhanced Face Crop) sudah selesai dan dibiarkan sebagai arsip.

Status: `[ ]` belum · `[~]` sedang dikerjakan · `[x]` selesai · `[!]` butuh aksi pemilik proyek

---

## SP0: Pipeline andal dan cepat (AKTIF)

Spec: `docs/superpowers/specs/2026-11-12-pipeline-stability-design.md`

### Fase 1: Ukur dulu

- [x] **T0.1 Instrumentasi waktu per tahap** (`stage_timer`)
  - Catat durasi dan RAM puncak untuk unduh, ekstrak audio, transkripsi, analisis AI, tracking, render per klip, publish. Simpan di `metadata["timings"]`, tulis ke log, sertakan `whisper_device`, `encoder`, `tracking_engine_used`.
  - Selesai bila: tidak ada perubahan perilaku pipeline, uji unit lulus, tidak ada `print()` ke stdout.
  - File: `backend/stage_timer.py` (baru), `backend/jobs.py`, `backend/tests/test_stage_timer.py`.
- [~] **T0.2 Skrip benchmark dan pengukuran dasar** · bergantung T0.1 · `[!]` butuh sesi Colab pemilik
  - `scripts/benchmark_pipeline.py` plus sel Colab opsional yang mencetak tabel waktu dan RAM.
  - Selesai bila: angka dasar video 30 menit tercatat di spec bagian 7 (kolom "Sebelum"), termasuk apakah GPU dan NVENC aktif di Colab.

### Fase 2: Stabilitas (tidak menunggu angka)

- [x] **T0.3 Error terstruktur** (`AppError`, `classify_download_error`)
  - Kode error awal sesuai spec 4.7, judul dan pesan i18n (id dan en) dalam bahasa awam, `job["error_info"]` terisi.
  - Selesai bila: setiap kode punya uji pemetaan dari contoh error yt-dlp nyata, dan pesan lolos cek "apa, kenapa, harus apa".
  - File: `backend/errors.py` (baru), `backend/video_utils.py`, `backend/jobs.py`, `backend/tests/test_errors.py`.
- [x] **T0.4 Antrean job** (`job_queue`) · bergantung T0.1
  - Satu slot berat, `AUTO_CLIPPER_MAX_HEAVY_JOBS`, `queue_position`, pembatalan saat mengantre, Resume ganda ditolak.
  - Selesai bila: dua job berurutan tidak pernah menjalankan tahap berat bersamaan (diuji), semua titik pembuatan thread di `jobs.py` melewati antrean.
  - File: `backend/job_queue.py` (baru), `backend/jobs.py`, `backend/tests/test_job_queue.py`.
- [x] **T0.5 Perbaikan mediapipe**
  - `FaceMesh` dibuat sekali dan ditutup di `finally`, fallback dicatat dengan alasan, `tracking_engine_used` tercatat, tidak ada pengulangan sampling tanpa alasan.
  - Selesai bila: uji membuktikan `close()` dipanggil saat exception, dan kegagalan mediapipe menghasilkan entri `log_error`.
  - File: `backend/crop_utils.py`, `backend/tests/test_crop_utils.py`.
- [x] **T0.6 Batas format unduhan**
  - Default "terbaik" menjadi H.264 mp4 ≤1080p, opsi lebih tinggi tetap tersedia.
  - Selesai bila: uji `quality_to_format` mencakup semua label, dan UI tidak menyesatkan soal arti "terbaik".
  - File: `backend/video_utils.py`, `backend/tests/test_video_utils.py`.
- [x] **T0.7 Pengecekan awal** (`preflight`, `GET /api/preflight`)
  - GPU, NVENC, FFmpeg, disk, RAM, Drive, Deno, versi yt-dlp. Level `ok|warn|block` dengan pesan awam.
  - Selesai bila: tiap pemeriksaan diuji dengan mock, `block` menghentikan job dengan `AppError`, dan tidak ada fallback GPU/NVENC yang diam-diam.
  - File: `backend/preflight.py` (baru), `backend/main.py`, `backend/tests/test_preflight.py`.

### Fase 3: Colab dan downloader

- [x] **T0.8 Workspace lokal dan publish ke Drive** · bergantung T0.1
  - `AUTO_CLIPPER_WORK_DIR`, publish atomik (nama sementara lalu rename), peringatan bila Drive tidak ter-mount.
  - Selesai bila: seluruh file antara berada di work dir, klip akhir muncul di pustaka setelah sukses, dan uji memakai direktori sementara.
  - File: `backend/colab_api.py`, `backend/jobs.py`, `backend/workspace.py` (baru), `backend/tests/test_workspace.py`.
- [x] **T0.8b Video sumber dan unggahan saat work dir aktif** · bergantung T0.8 · wajib sebelum T0.13
  - Ditemukan saat T0.8: setelah work dir hilang (runtime Colab mati), "Rerender semua", render ulang per klip, AI Koreksi, resume-manual, dan Resume video unggahan gagal karena video sumber tidak ikut dipublikasikan. Unggahan (`/upload`) masih ditulis ke pustaka (Drive). `/video` tidak bisa menyajikan file di work dir.
  - Selesai bila: alur di atas memulihkan video sumber (unduh ulang untuk job URL) atau memberi pesan awam yang jelas bila tidak mungkin (video unggahan yang sudah hilang), unggahan ditulis ke work dir, dan semuanya diuji dengan direktori sementara. Tanpa work dir perilaku tidak berubah.
  - File: `backend/jobs.py`, `backend/main.py`, `backend/workspace.py`, `backend/tests/test_workspace.py`.
- [x] **T0.9 `history.db` lokal dengan snapshot ke Drive** · bergantung T0.8
  - Snapshot lewat API backup SQLite dengan pembatasan frekuensi, pemulihan saat startup.
  - Selesai bila: uji pemulihan lulus, termasuk skenario runtime mati di tengah job lalu Resume.
  - File: `backend/db.py`, `backend/colab_api.py`, `backend/tests/test_db.py`.
- [x] **T0.10 Dukungan `cookies.txt`**
  - Endpoint unggah, validasi (format Netscape, domain, masa berlaku), status, hapus. Dipakai oleh yt-dlp. File tidak pernah dikirim ke tempat lain.
  - Selesai bila: uji validasi untuk file valid, kosong, kedaluwarsa, dan bukan Netscape.
  - File: `backend/cookies.py` (baru), `backend/main.py`, `backend/video_utils.py`, `backend/tests/test_cookies.py`.
- [x] **T0.11 Strategi client yt-dlp dan Deno** · bergantung T0.3, T0.10
  - Hentikan rotasi buta, urutan default lalu `web_embedded` dan `android_vr`, aktifkan komponen EJS, `classify_download_error` terintegrasi.
  - Selesai bila: uji membangun opsi yt-dlp untuk skenario dengan dan tanpa cookies, dengan dan tanpa Deno.
  - File: `backend/video_utils.py`, `backend/tests/test_video_utils.py`.

### Fase 4: Antarmuka dan dokumentasi

- [~] **T0.12 Kartu error generik dan unggah cookies** di `src/` dan `web/` · bergantung T0.3, T0.10
  - Render `error_info`, tombol aksi, panduan 3 langkah ekspor cookies, peringatan akun cadangan, "Detail teknis" dan "Detail waktu" yang bisa dibuka, i18n id dan en.
  - Selesai bila: dicek manual di kedua frontend untuk tiap kode error, tanpa istilah teknis di layar utama.
- [~] **T0.13 Notebook Colab dan dokumentasi** · bergantung T0.8, T0.11
  - Pasang Deno, atur `AUTO_CLIPPER_WORK_DIR`, tampilkan hasil preflight, perbarui `docs/panduan-penggunaan-awam.md` dan `CHANGELOG.md`, naikkan versi.
  - Selesai bila: sel notebook berjalan dari awal sampai akhir di Colab bersih `[!]`.

### Fase 5: Ukur ulang dan gerbang

- [ ] **T0.14 Pengukuran sesudah** · bergantung semua di atas · `[!]` butuh sesi Colab pemilik
  - Ulang benchmark pada video yang sama, isi kolom "Sesudah" di spec bagian 7.
  - Selesai bila: video 30 menit selesai di Colab gratis tanpa `-9`, laporan waktu muncul di setiap job.
- [ ] **T0.15 Keputusan gerbang pendekatan B**
  - Jika tracking wajah masih mendominasi waktu, jadwalkan task pelacakan satu-kali-baca. Jika tidak, pindahkan ke SP3.
  - Selesai bila: keputusan dan alasannya dicatat di spec dan roadmap.

---

## SP1: Fondasi frontend tunggal + web lokal (belum dimulai)

Brainstorming dan spec terpisah dimulai setelah SP0 selesai. Arah awal, belum final:

- [ ] T1.0 Brainstorm dan spec SP1 (satu paket UI dengan adapter Tauri/web lokal/Colab, atau `web/` sebagai satu-satunya frontend)
- [ ] T1.x Backend menyajikan UI sendiri sehingga cukup satu perintah lalu buka `localhost`
- [ ] T1.x Model token untuk akses localhost
- [ ] T1.x Hapus duplikasi `src/` dan `web/`, samakan versi React

## SP2: Revamp UI/UX untuk orang awam, bebas AI slop (belum dimulai)

- [ ] T2.0 Brainstorm dan spec SP2 (alur utama, onboarding, bahasa, antislop: skill `antislop-*`)
- [ ] T2.x Audit alur dan copy saat ini, sasaran: pengguna awam selesai dari link ke klip tanpa panduan

## SP3: Ringan (belum dimulai)

- [ ] T3.0 Brainstorm dan spec SP3, berdasarkan angka SP0
- [ ] T3.x Ukuran installer (mediapipe opsional, komponen berat sebagai unduhan terpisah)
- [ ] T3.x Startup dan RAM sidecar
- [ ] T3.x Pendekatan B bila diputuskan di T0.15
- [ ] T3.x Paket GPU opsional untuk desktop Windows: pustaka NVIDIA untuk Whisper (`cublas64_12.dll`, ratusan MB) diunduh terpisah hanya oleh pengguna dengan kartu NVIDIA, bukan dibundel di installer. Disetujui pemilik 2026-11-18. Latar: di GTX 1650 pemilik, Whisper jatuh ke prosesor karena DLL itu tidak ada (lihat PROGRESS-LOG 2026-11-18).
- [ ] T3.x Ukuran model Whisper menyesuaikan perangkat: tanpa GPU pilih model lebih kecil, atau peringatkan sebelum mulai bahwa `medium` di prosesor bisa lebih dari satu jam untuk video 30 menit.

## SP4: Fitur kreator dan penyempurnaan fitur lama (belum dimulai)

- [ ] T4.0 Brainstorm dan prioritaskan kandidat (daftar di roadmap bagian 6), kerjakan per gelombang
- [ ] T4.x Audit fitur yang ada untuk penyempurnaan (subtitle, canvas, hook, B-roll, re-render)
