# Serah terima untuk AI mana pun yang melanjutkan pekerjaan

Ditulis ulang 2026-11-20, posisi diperbarui 2026-11-26, untuk AI coding (Claude, Codex, Gemini, Cursor, dan lainnya) yang melanjutkan di repo ini. Baca seluruh file ini sebelum menyentuh kode. Tujuannya: kamu bekerja dengan aturan, keputusan, dan cara kerja yang sama dengan sesi sebelumnya.

## 1. Urutan membaca

1. File ini.
2. `.agents/AGENTS.md`: aturan repo. Wajib dipatuhi, terutama bagian E (invarian backend E.1–E.23), F (frontend dan i18n F.1–F.12), G.1–G.8 (PyInstaller/web lokal), H (ADR).
3. Entri terakhir `tasks/PROGRESS-LOG.md`: posisi terakhir dan langkah berikutnya. Ini selalu lebih baru dari file ini.
4. `tasks/sp4-ledger.md` (SP4 gelombang 1: pre-flight P1–P9, status tiap task, triase catatan tertunda), lalu `tasks/sp3-ledger.md` dan `tasks/sp2-ledger.md`: status tiap task SP3/SP2, keputusan (ruling), dan temuan yang ditunda.
5. Spec SP4 gelombang 1: `docs/superpowers/specs/2026-11-25-sp4-wave1-design.md`, rencananya `docs/superpowers/plans/2026-11-25-sp4-wave1.md`, dan ADR-016. Spec SP3: `docs/superpowers/specs/2026-11-24-sp3-lightweight-design.md` (dan SP2 `2026-11-20-sp2-ux-for-everyone-design.md`). Otoritas tertinggi bila rencana bertentangan dengan dirinya sendiri.
6. Rencana SP3: `docs/superpowers/plans/2026-11-24-sp3-lightweight.md`.
7. Konteks SP1 bila perlu: `tasks/sp1-ledger.md` dan spec SP1 `docs/superpowers/specs/2026-11-18-sp1-single-frontend-web-local-design.md`.

## 2. Gambaran besar

Roadmap: SP0 (pipeline andal, selesai) → SP1 (frontend tunggal + web lokal, selesai) → SP2 (UI/UX untuk orang awam, selesai secara kode) → SP3 (ringan, selesai secara kode) → **SP4 (fitur kreator; gelombang 1 selesai secara kode, menunggu review menyeluruh)**. Daftar task: `tasks/roadmap-todo.md`.

Branch bertumpuk (jangan membuka PR, push, atau merge ke `main` kecuali pemilik memintanya): `feat/sp0-pipeline-stability` → `feat/sp1-single-frontend-web-local` → `feat/sp2-ux-for-everyone` → `feat/sp3-lightweight` → **`feat/sp4-wave1` (kerja di sini)**.

Keputusan pemilik untuk SP2 (2026-11-20): desain **HP dulu** lalu melebar ke layar besar; jalur AI utama **AI manual dipandu** (salin perintah, buka ChatGPT/Gemini, tempel jawaban), API key hanya opsi lanjutan; gaya **bersih dan tenang** (latar netral, satu warna aksen); **alur 4 langkah** (Video → Siapkan → Pilih momen → Klip) dengan **tiga menu** (Buat klip, Riwayat, Pengaturan); sisanya ikut rekomendasi.

## 3. Posisi SP2, SP3 & SP4 saat ini (2026-11-26)

- **SP2 selesai dari sisi kode** (`dc3ba66..547531a`): Task 1–18 selesai, review menyeluruh independen (`dc3ba66..f7aba4d`), gelombang perbaikan akhir (`547531a`), dan re-review terbatas dinyatakan bersih.
- **SP3 (Ringan) selesai secara kode & dokumen di branch `feat/sp3-lightweight`** (`9ff373f..00642dc`): Task 0–6 + Teliti di Colab selesai, lolos review per-task dan **review menyeluruh SP3 independen (`Approved`, 0 Critical, 0 Important)**:
  - **Benchmark terukur (Windows `ac-venv`)**: `backend.exe` **248,99 MB → 198,68 MB** (bahkan sebelum CI bersih bebas `opencv-contrib-python`); startup `main+preflight+jobs` **3,77 dtk → 1,442 dtk** dan RSS **119,9 MB → 61,3 MB** (−48,9%, 0 modul berat di `sys.modules`).
  - **Verifikasi penuh terakhir**: `pytest` **1067 lulus, 7 dilewati**; Vitest **474 lulus** (66 file); `oxlint src` **0 error** (15 warning); `npm run build` & `npm run build:cloud` sukses; `npm audit` **0 kerentanan**. Rincian tiap task & minor deferred ada di `tasks/sp3-ledger.md` dan `tasks/PROGRESS-LOG.md`.
- **SP4 gelombang 1 selesai secara kode di `feat/sp4-wave1`** (`8b1e513` sampai commit dokumen Task 7, dari `113f8f6`): identitas aplikasi (`src/lib/appInfo.ts`, footer, "Tentang Auto Clipper"), splash semua platform, pilih ulang momen tanpa API key (`POST /jobs/{id}/rerun-manual`), pemberitahuan versi Auto Clipper Web (`GET /api/update-check`), dan 19 catatan tertunda SP2/SP3. Task 1–6 **Approved**; Task 7 (README, tutorial Colab + notebook, panduan, CHANGELOG, AGENTS.md E.22/E.23/F.11/F.12, ADR-016, perbaikan teks FAQ momen `a6f2b8e`) menunggu review. Verifikasi terakhir: `pytest` **1127 lulus, 7 dilewati**, Vitest **535 lulus (79 file)**, `oxlint` **0 error** (19 warning), `npm run build` & `build:cloud` OK, `npm audit` **0 kerentanan**; cek browser Edge headless 360/768/1280 terang/gelap (footer, Tentang, splash, dialog Pilih ulang momen, Pembaruan, gerbang cloud) bersih. **Berikutnya:** (1) review Task 7; (2) review menyeluruh gelombang 1 `git diff 113f8f6..HEAD` + satu gelombang perbaikan + re-review terbatas; (3) uji pemakaian pemilik, lalu `feat/sp3-lightweight` dimajukan (fast-forward) ke `feat/sp4-wave1` atas permintaan pemilik, tanpa push atau merge ke `main`.
- **Yang masih menunggu pemilik sebelum PR final ke `main`**:
  1. Uji pemakaian SP2 + SP3 (daftar cek SP2 di `tasks/PROGRESS-LOG.md`, plus unduh/hapus add-on `cuda` & `mediapipe` di Pengaturan Windows, dialog model Whisper CPU saat Mulai, pemutaran klip di folder hasil kustom Desktop, dan Teliti di Colab T4 nyata).
  2. Setelah uji pemakaian selesai, buka PR ke `main` hanya atas permintaan pemilik (draf SP0+SP1+SP2+SP3 di `tasks/pr-draft.md`).

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
- Draf deskripsi PR akhir gabungan SP0+SP1+SP2+SP3 ada di `tasks/pr-draft.md` (kelanjutan dari `tasks/pr-draft-sp0.md`).
