# ADR-014: Tahap Berjalan di Status Job, Unggah Gambar Kanvas, dan Alur Buat Klip Empat Langkah

- **Status**: Accepted
- **Date**: 2026-11-24
- **Context**: SP2 "UI/UX untuk orang awam", rilis v1.19.0 (bersama SP1). Spec: `docs/superpowers/specs/2026-11-20-sp2-ux-for-everyone-design.md`. Rencana: `docs/superpowers/plans/2026-11-20-sp2-ux-for-everyone.md`. Keputusan per task: `tasks/sp2-ledger.md`. Audit: `tasks/sp2-audit.md`.

---

## 1. Konteks & Masalah

1. Layar proses (`BusyOverlay`) menebak tahap dari waktu ("hampir siap", "sabar yaa") dan memutar pesan tahap palsu. Backend baru mencatat tahap di `metadata["timings"]` setelah tahap selesai, jadi frontend tidak tahu tahap mana yang sedang berjalan, di perangkat apa, dan klip ke berapa.
2. Gambar latar kanvas di web lokal dan cloud dikirim sebagai alamat `blob:`, yang tidak bisa dibaca backend. `canvas_config.background_image_path` juga diterima tanpa `path_guard` (sisa T0.19).
3. Enam menu berbahasa campuran, formulir 515 baris, dan alur AI manual yang terpisah dari alur utama. Di cloud, AI manual adalah satu-satunya jalur, dan penggunanya membuka aplikasi dari HP.
4. Tidak ada pemeriksaan otomatis untuk kata teknis, emoji, atau kontras di teks dan warna antarmuka.

## 2. Keputusan Arsitektur

### A. Tahap berjalan dari `stage_timer` (`backend/stage_timer.py`)
- `collect_timings(timings, live)` menerima dict `live` milik job (`job["_live"]`). Setiap `stage()` mendorong entri ke `live["stack"]` saat mulai dan membuangnya saat selesai. Tumpukan selalu diganti dengan list baru, tidak diubah di tempat, karena permintaan status membacanya dari thread lain.
- `report(**fields)` hanya untuk status: `clips_total` disimpan di tingkat job, `percent` (dan field lain) ditempel ke tahap paling dalam. `download_percent()` di `backend/video_utils.py` memanggil `report(percent=...)` dari progress hook yt-dlp.
- `current_stage(live)` mengubah tahap paling dalam menjadi `{stage, started_at, elapsed_seconds, device?, clip?, clips_total?, percent?}`. `device` diambil dari field yang sudah dicatat (`DEVICE_FIELDS`: `whisper_device`, `encoder`, `tracking_engine_used`). `elapsed_seconds` dihitung dari jam server, jadi HP dengan jam berbeda tetap menampilkan waktu berjalan yang benar. `percent` dibatasi 0 sampai 100.
- `GET /jobs/{id}` menambah `current: jobs.live_stage(job_id)`, dibangun saat dibaca. `job["_live"]` ada di dict job yang aktif, bukan di `metadata`, jadi tidak pernah masuk `history.db`. Tanpa tahap berjalan nilainya `null`.
- `timings` tidak berubah: tidak ada field baru, urutan, atau isi yang berbeda. Data hidup tidak pernah disalin ke sana.

### B. Unggah gambar kanvas dan `path_guard` untuk path kanvas (`backend/main.py`)
- `POST /upload-image` menerima PNG, JPG, JPEG, atau WEBP, membersihkan nama lewat `path_guard.safe_upload_name()`, menulis ke `<uploads_dir>/images/bg_<acak>_<nama>`, memeriksa `path_guard.is_protected()` sebelum menulis, lalu mengembalikan `path`. Bila `caps.localFilePicker` mati (web lokal, cloud), `CanvasConfigControls` membuka input file browser, mengunggah gambarnya, dan memakai path dari backend. Desktop tetap memakai path lokal dari `platform().pickImage()`. Unggahan yang lebih baru membatalkan hasil unggahan yang lebih lama.
- `_canvas_image_refused()` memeriksa `canvas_config.background_image_path` dengan `path_guard` di `POST /jobs`, `POST /jobs/manual`, `POST /jobs/{id}/rerender`, `POST /jobs/{id}/rerun_ai`, dan `POST /jobs/{id}/clips/{n}/rerender`, sebelum hal lain dikerjakan. Penolakan: 403 `Access denied`, sama dengan AGENTS.md E.14.
- Path gambar tidak disimpan di pilihan yang diingat (`saveClipChoices` mengosongkannya), jadi alamat lama tidak terbawa ke video berikutnya.
- `output_dir` tetap path bebas; dipindah ke SP3.

### C. Satu layar Buat klip yang digerakkan fungsi murni
- `src/pages/CreatePage.tsx` menampilkan empat langkah (1 Video, 2 Siapkan, 3 Pilih momen, 4 Klip) di satu rute (`/`). Keputusan tampilan ada di fungsi tanpa React yang diuji Vitest:
  - `src/lib/createFlow.ts`: langkah aktif dari status job (`activeStep`, `stepStates`), tahap per langkah (`PREPARE_STAGES`, `CHOOSE_STAGES`, `MAKE_STAGES`), pemeriksaan link (`linkProblem`), judul otomatis (`autoProjectTitle`), dan provider yang dipakai (`effectiveProvider`).
  - `src/lib/progress.ts`: baris progres dari `current` dan `timings` (`progressRows`, `stagesFor`) dan catatan perangkat (`deviceNotes`). Nama tahap memakai kunci `timing.stage_*` yang sama dengan Detail waktu.
  - `src/lib/aiAnswer.ts`: pemeriksaan jawaban AI sebelum dikirim (`checkAiAnswer`, `checkWordsAnswer`) dengan masalah bernama (`empty`, `cut_off`, `not_answer`, `no_moments`, `missing_times`).
  - `src/lib/clipChoices.ts`: pilihan klip yang diingat di `localStorage` (`ac_clip_choices`).
  - Pendukung: `src/lib/projectStatus.ts` (status Riwayat dan satu tombol utama), `src/lib/preflight.ts` (catatan `warn` dan kartu `block`), `src/lib/routes.ts` (`ROUTES`, `SETTINGS_ANCHORS`, `LEGACY_REDIRECTS`), `src/lib/settingsLayout.ts` (bagian Pengaturan yang tampil per `caps`).
- Navigasi tiga tujuan: Buat klip (`/`), Riwayat (`/riwayat`, `/riwayat/:id`), Pengaturan (`/pengaturan` dengan anchor `#umum`, `#youtube`, `#lanjutan`, `#pengunduh`, `#bantuan`). Rute lama dialihkan lewat `LEGACY_REDIRECTS`. Router tetap `HashRouter`.
- Layar progres (`ProgressPanel`) adalah bagian dari halaman, bukan overlay, sehingga navigasi tetap bisa dipakai; `RunningBar` mengingatkan proses yang berjalan saat pengguna di menu lain.

### D. AI manual sebagai jalur bawaan
- `ac_ai_mode` di `localStorage` bernilai `"manual"` kecuali pengguna menyalakan **Pakai API key** (`"auto"`) di Pengaturan → Lanjutan. Saklar ini hanya tampil bila `caps.apiKeys` (desktop dan web lokal); cloud selalu manual.
- `effectiveProvider(caps, aiMode, provider)` mengirim provider pilihan hanya bila `caps.apiKeys && aiMode === "auto"`; selain itu `"manual_ai"`. Fungsi yang sama dipakai saat mulai dan saat `handleResumeJob` (ledger Ruling P2), karena backend mengganti provider tersimpan dengan provider dari request, dan provider ber-API key tanpa kunci akan gagal dengan `AI_KEY_MISSING` di cloud.
- Alur manual: job berhenti di `AWAITING_MANUAL`, layar pindah ke langkah 3 (`MomentStep`), jawaban diperiksa `checkAiAnswer` lalu dikirim ke `POST /jobs/{id}/resume-manual`. Proyek yang belum dijawab dibuka lagi dari Riwayat lewat `openAwaiting`.

### E. Kemampuan platform baru, token warna, dan penjaga teks
- `caps.keepOpen` (`"app"` desktop, `"window"` web lokal, `"none"` cloud) memilih teks "boleh ditutup atau tidak" di layar progres dan teks banner saat backend terputus. Komponen tetap memeriksa `caps`, bukan `kind` (AGENTS.md F.6).
- `platform().saveClips(clips)` untuk **Unduh semua**: desktop meminta satu folder lalu menyalin lewat `/save_file`; web lokal dan cloud mengunduh satu per satu dengan jeda pendek (`browserDownloadAll`).
- Warna hanya lewat token CSS di `src/index.css` (dipakai `tailwind.config.js`): latar netral, satu aksen biru, mode terang dan gelap. `src/styles/contrast.test.ts` menghitung rasio WCAG pasangan token teks (minimal 4,5:1) dan non-teks (minimal 3:1) di kedua tema, dan menolak latar transparan di `Badge`.
- `src/locales/plainWords.test.ts` menolak kata teknis (`MAIN_NAMESPACES` dan `timing.device_*`), emoji, dan em dash di teks locale. Backend punya tes kata terlarang untuk teks pemeriksaan awal yang tampil di Buat klip.
- Semua dialog memakai `src/components/ui/Dialog.tsx`: focus trap, fokus kembali ke pembuka, dan penjaga isian sebelum menutup.

## 3. Konsekuensi

- Layar progres hanya menampilkan data nyata. Tahap yang lupa dibungkus `stage()` tidak muncul sebagai tahap berjalan; tes backend memeriksa tahap utama.
- `current` hanya ada selama job hidup di proses ini. Setelah server dinyalakan ulang, job lama tidak punya `current` dan layar memakai `timings`.
- Gambar latar kanvas di web lokal dan cloud ikut tersimpan di folder unggahan (di Colab: disk kerja, yang hilang saat sesi berakhir).
- Pengguna cloud dan pengguna baru di desktop tidak butuh API key. Biayanya satu langkah salin-tempel per video.
- Logika alur bisa diuji tanpa merender halaman; komponen hanya menampilkan hasil fungsi murni.
- Teks dan warna baru harus lolos `plainWords.test.ts` dan `contrast.test.ts`, jadi pelanggaran aturan spec 4.6 gagal di CI.
- Yang belum diverifikasi saat ADR ini ditulis: uji pemakaian oleh orang awam (Task 18) dan pemeriksaan di desktop Tauri sungguhan (lihat `tasks/sp2-audit.md`, bagian "Belum diverifikasi").

## 4. Pertanyaan Terbuka

- Warna aksen biru boleh diganti pemilik (spec bagian 9).
- "AI ulang" untuk mode manual dan `output_dir` sebagai path bebas: SP4 dan SP3.
