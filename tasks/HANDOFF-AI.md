# Serah terima untuk AI mana pun yang melanjutkan pekerjaan

Ditulis ulang 2026-11-20, posisi diperbarui 2026-11-24, untuk AI coding (Claude, Codex, Gemini, Cursor, dan lainnya) yang melanjutkan **SP2** di repo ini. Baca seluruh file ini sebelum menyentuh kode. Tujuannya: kamu bekerja dengan aturan, keputusan, dan cara kerja yang sama dengan sesi sebelumnya.

## 1. Urutan membaca

1. File ini.
2. `.agents/AGENTS.md`: aturan repo. Wajib dipatuhi, terutama bagian E (invarian backend E.1–E.20), F (frontend dan i18n F.1–F.10), G.8 (paket web lokal), H (ADR).
3. Entri terakhir `tasks/PROGRESS-LOG.md`: posisi terakhir dan langkah berikutnya. Ini selalu lebih baru dari file ini.
4. `tasks/sp2-ledger.md` (bila sudah ada): status tiap task SP2, keputusan, dan temuan yang ditunda.
5. Spec SP2: `docs/superpowers/specs/2026-11-20-sp2-ux-for-everyone-design.md`. Otoritas tertinggi bila rencana bertentangan dengan dirinya sendiri.
6. Rencana SP2: `docs/superpowers/plans/2026-11-20-sp2-ux-for-everyone.md`. Baca "Global Constraints", "Questions for the owner" (semua pilihan bawaan dianggap DISETUJUI: pemilik berkata "ikuti rekomendasi, yang penting UX-nya jelas untuk orang awam"), dan "Spec gaps". Baca isi task hanya untuk task yang sedang dikerjakan.
7. Konteks SP1 bila perlu: `tasks/sp1-ledger.md` dan spec SP1 `docs/superpowers/specs/2026-11-18-sp1-single-frontend-web-local-design.md`.

## 2. Gambaran besar

Roadmap: SP0 (pipeline andal, selesai) → SP1 (frontend tunggal + web lokal, selesai, lolos review akhir independen) → **SP2 (UI/UX untuk orang awam, sedang berjalan)** → SP3 (ringan) → SP4 (fitur kreator). Daftar task: `tasks/roadmap-todo.md`.

Branch bertumpuk, satu PR ke `main` setelah SP2 (keputusan pemilik 2026-11-18): `feat/sp0-pipeline-stability` → `feat/sp1-single-frontend-web-local` → **`feat/sp2-ux-for-everyone` (kerja di sini)**. Jangan membuka PR, push, atau merge ke `main` kecuali pemilik memintanya.

Keputusan pemilik untuk SP2 (2026-11-20): desain **HP dulu** lalu melebar ke layar besar; jalur AI utama **AI manual dipandu** (salin perintah, buka ChatGPT/Gemini, tempel jawaban), API key hanya opsi lanjutan; gaya **bersih dan tenang** (latar netral, satu warna aksen); **alur 4 langkah** (Video → Siapkan → Pilih momen → Klip) dengan **tiga menu** (Buat klip, Riwayat, Pengaturan); sisanya ikut rekomendasi.

## 3. Posisi SP2 saat ini (2026-11-24)

- **SP2 selesai dari sisi kode** (`dc3ba66..547531a`): Task 1–18 selesai, review menyeluruh independen (`dc3ba66..f7aba4d`), gelombang perbaikan akhir (`547531a`), dan re-review terbatas dinyatakan bersih (0 Critical, 0 Important tersisa); ditambah perbaikan fallback `node_modules/ffmpeg-static` di `get_ffmpeg_path()` saat tidak frozen.
- Angka verifikasi akhir: `pytest` **860 lulus, 6 dilewati**; Vitest **424 lulus** (64 file); `oxlint src` **0 error**; `npm run build` dan `npm run build:cloud` OK; `npm audit` **0 kerentanan**.
- **SP3 (Ringan) sedang berjalan di branch `feat/sp3-lightweight`** (berhenti 2026-11-24, kuota pemilik 80%, HEAD setelah commit ini). Rincian di akhir `tasks/sp3-ledger.md`. Langkah berikutnya, berurutan:
  1. **Task 5 fix round 2** (belum ada perubahan tersimpan): ikuti Ruling Task 5 terakhir di ledger. `src/lib/progress.ts` hanya membaca fakta pelacak dari baris timing run ini (hapus jalur `addFallback(meta)`, perbaiki tes "ignores tracking facts…" yang membenarkan kasus basi); `create_resume_job` dan `create_rerender_job` di `backend/jobs.py` memulai metadata job dengan `timings: []`; `TranscriptionSection` tidak menampilkan catatan prosesor selama status add-on belum diketahui. Lalu re-review terbatas.
  2. **Task 6**: bagian kode sudah di-commit (`ceef3e4`, dialog model CPU) tetapi belum diverifikasi dan belum direview. Sisa: benchmark sebelum/sesudah (startup + RSS `import backend.main` + `run_preflight()` + `import backend.jobs` di `9ff373f` vs HEAD, median beberapa run; ukuran `backend.spec` vs baseline 248,99 MB, PyInstaller sudah ada di ac-venv), ADR-015, `.agents/AGENTS.md` (T1.y, add-on terkunci, aturan path_guard teks-dulu untuk UNC/perangkat dan output_dir lokal saja), CHANGELOG, panduan bila tampilan berubah, roadmap (centang hanya yang "complete, review clean"), PROGRESS-LOG. Lalu review Task 6. Hapus juga prop `meta` yang tidak terpakai di ProgressPanel/CreatePage.
  3. **Teliti di Colab (keputusan pemilik 2026-11-24, lihat Ruling terakhir di `tasks/sp3-ledger.md`):** notebook memasang `mediapipe==1.2.3` + dependensi + `face_landmarker.task` versi terkunci; backend di cloud menganggap mediapipe tersedia bila bisa di-import; UI cloud menampilkan Teliti sebagai pilihan yang bisa dipakai. TDD, review oleh agen terpisah. Perbarui spec SP3 bagian add-on cloud.
  4. Review menyeluruh SP3 `git diff 9ff373f..HEAD`, satu gelombang perbaikan, re-review terbatas, catat di ledger dan log.
  Agen yang jalan bersamaan tidak boleh memakai `git stash` dan wajib stage per path.
- **Yang tersisa (menunggu pemilik):**
  1. Jalankan daftar cek uji pemakaian SP2 di akhir `tasks/PROGRESS-LOG.md` (HP Colab 360 px bersama orang awam tanpa panduan, desktop Windows / Auto Clipper Web, kembali lewat `AWAITING_MANUAL`, mode terang/gelap, banner terputus, serta `SplashScreen` & `UpdateOverlay` di build desktop nyata) bersama sisa cek manual SP1 & SP0 (bagian 7).
  2. Setelah pemilik menyatakan uji pemakaian selesai, buka satu PR gabungan ke `main` dari branch `feat/sp2-ux-for-everyone` atas permintaan pemilik (draf lengkap SP0+SP1+SP2 ada di `tasks/pr-draft.md`, kelanjutan dari `tasks/pr-draft-sp0.md`).

## 4. Cara mengerjakan setiap task

1. Catat BASE: `git rev-parse --short HEAD`.
2. Ambil teks task dari rencana (`### Task N: ...` sampai sebelum `### Task N+1`). Itu kebutuhanmu, termasuk nilai persis yang harus dipakai.
3. Terapkan keputusan pre-flight untuk task itu (dari `tasks/sp2-ledger.md`). Keputusan mengalahkan teks rencana bila berbeda.
4. TDD: tulis tes yang gagal dulu, pastikan gagal karena alasan yang benar, baru implementasi, lalu jalankan lagi sampai lulus.
5. Task yang menyentuh teks atau tampilan: jalankan audit yang diminta rencana (skill `antislop`, `antislop-copywriting`, `antislop-ui`, `antislop-layoutmobile`, `antislop-human`). AI tanpa skill itu menerapkan aturan spec bagian 4.6: kalimat pendek, tombol berupa kata kerja, tanpa istilah teknis di layar utama, tanpa emoji dekoratif, tanpa gradien atau kilau, huruf isi minimal 16 px di HP, area sentuh minimal 44 × 44 px, kontras WCAG AA, bisa dipakai dengan keyboard.
6. Jalankan semua pemeriksaan (bagian 6). Semua harus hijau sebelum commit.
7. Commit. Pesan commit diakhiri dengan baris `Co-Authored-By:` sesuai attribution AI yang kamu pakai (sesi sebelumnya: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`).
8. Tambahkan entri 3–6 baris di bawah heading `## 2026-11-20 · SP2` di akhir `tasks/PROGRESS-LOG.md` (apa yang berubah, jumlah tes, yang tersisa), ikut dalam commit task itu.
9. **Review sebelum lanjut.** Ikuti `tasks/sp1-reviewer-instructions.md` (berlaku juga untuk SP2) atas `git diff <BASE>..HEAD` dengan pikiran segar (sebaiknya sesi atau agen terpisah). Perbaiki semua temuan Critical/Important, lalu review ulang khusus bagian yang diperbaiki. Temuan Minor dicatat di ledger sebagai "minor (deferred)". Pengalaman SP1: task yang lolos semua tes tetap bisa punya masalah yang hanya ditemukan reviewer.
10. Perbarui `tasks/sp2-ledger.md`: `Task N: complete (commits <base>..<head>, review clean)` atau keputusan yang kamu ambil (`Ruling: <apa> — <kenapa> — <akibat bila salah>`).
11. Setelah semua task: satu review menyeluruh independen atas seluruh perubahan SP2 (`git diff dc3ba66..HEAD`, tanpa lockfile; `dc3ba66` adalah awal SP2), satu gelombang perbaikan, satu review ulang terbatas, lalu catat di ledger dan log (contoh: akhir `tasks/sp1-ledger.md`).

Jangan menunggu persetujuan pemilik di antara task. Putuskan sendiri hal yang ambigu (spec adalah otoritas), catat sebagai Ruling, lalu lanjut. Berhenti dan tanya pemilik hanya untuk: operasi yang tidak bisa dibatalkan atau destruktif, tindakan sensitif keamanan, push/merge/publish, atau rencana yang rusak sehingga semua jalan hanya tebakan.

## 5. Hal terbawa dari SP1 yang harus selesai di SP2 (spec 4.7)

- Cek port bebas web lokal (`backend/web_mode.py` `port_is_free`/`choose_port`) juga menganggap port terpakai bila `connect(("127.0.0.1", port))` berhasil.
- `docs/tutorial-auto-clipper-cloud.md` sekitar baris 437–438 (Kendala 9): `$\rightarrow$` rusak menjadi dua baris; perbaiki.
- Komentar menyesatkan di `backend/tests/test_web_mode.py` (`test_a_launch_after_a_damaged_instance_file_starts_a_new_server`, "the real liveness check").
- `platform().pickVideo()` dipakai di langkah 1; gambar latar kanvas di web lokal/cloud diunggah ke backend (bukan `blob:`).

## 6. Lingkungan (Windows, mesin pemilik)

- Tes Python: `C:\Users\dhima\projects\ac-venv\Scripts\python.exe -m pytest backend/tests -q -p no:cacheprovider`. Jangan pakai `python` dari PATH (hanya pintasan Microsoft Store). Baseline awal SP2: 805 lulus, 12 dilewati.
- Frontend (dari root repo): `npm run build`, `npm run build:cloud`, `npx vitest run` (baseline awal SP2: 89 lulus), `npx oxlint src` (0 error; warning boleh).
- **Vitest harus dijalankan dari path dengan huruf drive besar** (`C:\Users\...`). Dari `c:\...` (misalnya Git Bash `/c/...`) Vitest termuat dua kali dan gagal "Cannot read properties of undefined (reading 'config')". Di Git Bash, pindah dulu ke `C:/Users/dhima/projects/auto-clipper` (huruf C besar).
- Tidak ada Rust: `npm run tauri build` tidak bisa dijalankan. Desktop diverifikasi lewat tes dengan plugin di-mock, workflow PR Check, dan daftar cek manual pemilik.
- FFmpeg untuk eksperimen: `C:\Users\dhima\projects\auto-clipper\node_modules\ffmpeg-static\ffmpeg.exe`.
- Melihat UI di browser tanpa Tauri: `npm run build`, lalu backend mode web (`C:\Users\dhima\projects\ac-venv\Scripts\python.exe -m backend.main --web`, lihat `backend/web_mode.py`), atau `npm run dev` bersama backend dev.

## 7. Aturan kerja dan preferensi pemilik

- Semua teks yang dilihat pengguna: bahasa Indonesia sehari-hari yang mudah dipahami orang awam, plus bahasa Inggris, menjawab "apa yang terjadi, kenapa, harus apa". Istilah teknis hanya di "Detail teknis". Tanpa gaya tulisan AI yang berlebihan.
- Backend: tidak boleh `print()` ke stdout di modul backend (handshake sidecar desktop bergantung pada stdout), kecuali entry point CLI. Error lewat `log_error(...)`. Jangan pernah mencatat isi cookies atau kunci API. Akses file dari path request wajib lewat `path_guard` (E.14).
- Jangan mencentang task di `tasks/roadmap-todo.md` tanpa hasil tes yang benar-benar dijalankan.
- **Protokol kuota:** bila pemilik bilang kuota sesinya hampir habis ("80%"), hentikan pekerjaan, pastikan semua tersimpan (commit `wip(sp2): ...` bila belum hijau), dan tulis entri baru di `tasks/PROGRESS-LOG.md` berisi posisi terakhir dan langkah berikutnya.
- Laporan ke pemilik ditulis dalam bahasa Indonesia, singkat, berisi hasil nyata (angka tes, commit), dan jujur soal yang belum diverifikasi.
- Masih menunggu pemilik, dilakukan sebelum PR akhir: daftar cek manual SP1 (di `tasks/PROGRESS-LOG.md`, termasuk CI setelah push dan proyek Vercel kedua), cek manual tampilan T0.12 dan uji notebook Colab T0.13 dari SP0, dan uji pemakaian SP2 oleh orang awam (langkah terakhir rencana SP2).
- Draf deskripsi PR akhir gabungan SP0+SP1+SP2 ada di `tasks/pr-draft.md` (kelanjutan dari `tasks/pr-draft-sp0.md`).
