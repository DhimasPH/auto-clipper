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
- [x] **T0.2 Skrip benchmark dan pengukuran dasar** · bergantung T0.1 · `[!]` butuh sesi Colab pemilik · 2026-11-18: kolom "Sebelum" hanya terisi sebagian (versi `main` gagal mengunduh tanpa cookies, percobaan CPU dihentikan). Pemilik menerima ini sebagai cukup (2026-11-18).
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

- [x] **T0.14 Pengukuran sesudah** · bergantung semua di atas · `[!]` butuh sesi Colab pemilik · diukur 2026-11-18, lihat spec bagian 7. Laporan waktu tercatat di log dan `metadata["timings"]`; tampilannya di UI masuk cek manual T0.12.
  - Ulang benchmark pada video yang sama, isi kolom "Sesudah" di spec bagian 7.
  - Selesai bila: video 30 menit selesai di Colab gratis tanpa `-9`, laporan waktu muncul di setiap job.
- [x] **T0.15 Keputusan gerbang pendekatan B** · 2026-11-18: tracking wajah 64 % dari waktu mesin (spec bagian 7), jadi pendekatan B dijadwalkan di SP0 sebagai T0.16. Disetujui pemilik.
  - Jika tracking wajah masih mendominasi waktu, jadwalkan task pelacakan satu-kali-baca. Jika tidak, pindahkan ke SP3.
  - Selesai bila: keputusan dan alasannya dicatat di spec dan roadmap.
- [x] **T0.16 Pelacakan wajah satu-kali-baca (pendekatan B)** · bergantung T0.15 · kode di-merge `5f91e77` (598 tes lulus dengan FFmpeg). Benchmark lokal 1080p: 5,3× lebih cepat, hasil identik. Colab T4 (2026-11-18): tracking 10 klip 786 → 271 dtk (2,9×), lihat spec bagian 7.
  - `sample_face_trajectory` tidak lagi melompat (`cap.set(POS_MSEC)`) ke tiap titik sampel. Potongan klip dibaca sekali secara berurutan lewat FFmpeg (`-ss`/`-t`, `fps`, `scale` ke lebar 640), frame dialirkan ke Haar/MediaPipe tanpa ditampung semua di memori. Titik waktu sampel dan hasil trajektori tetap sama. Bila jalur FFmpeg gagal, jalur lama dipakai dan alasannya dicatat (`log_error`).
  - Selesai bila: uji membuktikan waktu sampel dan bentuk trajektori sama dengan jalur lama, pembatalan tetap bekerja, dan fallback tercatat; benchmark lokal pada video 1080p menunjukkan tracking jauh lebih cepat; diukur ulang di Colab oleh pemilik `[!]`.
  - File: `backend/crop_utils.py`, `backend/tests/test_crop_utils.py`.
- [x] **T0.17 Tolak job bila Drive pustaka belum ter-mount di Colab** · merge `ddcfb0e`, 693 tes lulus; perilaku `drive.mount` di Colab sungguhan dicek lewat daftar cek T0.13 no. 9 · keputusan pemilik 2026-11-18 (no. 11)
  - Backend tidak membuat folder di bawah `/content/drive` tanpa mount; `DRIVE_NOT_MOUNTED` menjadi `block`; pesan awam menyuruh menjalankan Langkah 1.
  - Selesai bila: uji membuktikan tidak ada folder dibuat dan job berhenti sebelum mulai; tanpa mode Colab perilaku tidak berubah.
- [x] **T0.18 Kunci API tidak disimpan di riwayat** · merge `25e1792`, 674 tes lulus, build desktop exit 0 · keputusan pemilik 2026-11-18
  - `api_key` dan `pexels_api_key` tidak masuk metadata `history.db`; data lama dibersihkan; Resume memakai kunci yang dikirim aplikasi.
  - Selesai bila: uji membuktikan kunci tidak tersimpan dan Resume tetap jalan di desktop dan web.
- [x] **T0.19 `/save_file` dan `/video` tidak bisa membaca cookies dan database** · merge `9eecd7b`, 653 tes lulus · keputusan pemilik 2026-11-18 (no. 2)
  - Folder cookies, `history.db` beserta snapshot dan file `-wal`/`-shm` ditolak; akses klip dan video yang sah tetap jalan.
  - Selesai bila: uji untuk setiap jalur yang ditolak dan yang tetap diizinkan.

---

## SP1: Fondasi frontend tunggal + web lokal (selesai, menunggu PR bersama SP2)

- [x] T1.0 Brainstorm dan spec SP1 (satu paket UI dengan adapter Tauri/web lokal/Colab, atau `web/` sebagai satu-satunya frontend) · `e531bbc` (`03f19bb`)
- [x] T1.x Backend menyajikan UI sendiri sehingga cukup satu perintah lalu buka `localhost` · `cd7d065`
- [x] T1.x Model token untuk akses localhost · `8fe5570`, `7c1838e`, `0e5da33`, `b207969`
- [x] T1.x `/video` dikecualikan dari cek token: siapa pun yang tahu URL tunnel Colab bisa mengambil `.mp4` apa pun di app data, work dir, atau folder kerja proses. Perlu token atau URL bertanda tangan untuk pemutar video · `092c907`, `2ac1b3a`, `df54bef`. (Sisa `canvas_config.background_image_path` dan `output_dir` dicatat sebagai `T1.y` di bawah.)
- [x] T1.x Hapus duplikasi `src/` dan `web/`, samakan versi React · `5652aec`, `3f7bd3b`, `97716b3`, `f45b1d1`
- [x] T1.y (dari T0.19) `canvas_config.background_image_path` kini lewat `/upload-image` + `path_guard` (SP2 Task 3, `960768d`).
- [ ] T1.y (dari T0.19, tidak dicakup spec SP1) `output_dir` masih menerima path bebas (tujuan tulis). Pindah ke SP3 (`output_dir` stays a free path).
- [x] T1.y Gambar latar kanvas di web lokal dan cloud tidak lagi memakai `blob:`, diunggah lewat `POST /upload-image` (SP2 Task 3, `960768d`).

## SP2: Revamp UI/UX untuk orang awam, bebas AI slop (belum dimulai)

- [ ] T2.0 Brainstorm dan spec SP2 (alur utama, onboarding, bahasa, antislop: skill `antislop-*`)
- [ ] T2.x Audit alur dan copy saat ini, sasaran: pengguna awam selesai dari link ke klip tanpa panduan
- [x] T2.x Teks layar proses (BusyOverlay) jujur, di `src/` dan `web/`. Diminta pemilik 2026-11-18 setelah uji Colab: di menit ke-24 layar menampilkan teks generik padahal subtitle masih dibuat dengan prosesor. (SP2 Task 1–2 + Task 9–10, `bd48e0d..6afd704`; `BusyOverlay.tsx` digantikan `ProgressPanel.tsx` dengan tahap & perangkat nyata, `web/` sudah dihapus di SP1). Masalah yang ada sebelumnya:
  - Setelah 10/20/40 menit, pesan berdasarkan waktu menggantikan tahap sebenarnya ("Sedang diproses di GPU Cloud...", "Sabar yaa, lagi proses nih...", "Video kamu hampir siap!").
  - Web selalu mengklaim GPU ("Menyiapkan proses di Google Colab GPU…", catatan "Video sedang diproses di GPU Colab"), juga saat jatuh ke prosesor.
  - Status `TRANSCRIBING` memutar empat pesan tiap 4,5 detik, termasuk "Menganalisis momen-momen terbaik" sebelum AI mulai.

  Arah: tampilkan tahap sebenarnya dengan nama yang sama seperti "Detail waktu" (`timing.stage_*`), perangkat yang benar-benar dipakai ("Membuat subtitle dengan prosesor, bisa lama"), progres nyata ("Merender klip 3 dari 10"), dan tanpa "hampir siap" kecuali berdasarkan progres. Backend mungkin perlu mengirim tahap dan perangkat yang sedang berjalan di status job (sekarang baru tercatat di `timings` setelah tahap selesai). Terkait keputusan terbuka nomor 9 (preflight belum tampil di frontend).

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
- [ ] T4.x "AI ulang" (AI Koreksi) untuk mode AI manual di web. Web selalu memakai `provider: "manual"` tanpa API key, sedangkan `POST /jobs/{id}/rerun_ai` butuh provider dan key; web juga memanggil `/rerun-ai` (tanda hubung). Perlu alur manual: susun ulang prompt dengan instruksi tambahan, lalu `AWAITING_MANUAL`. Ditemukan 2026-11-18.
