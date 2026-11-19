# Serah terima untuk AI mana pun yang melanjutkan pekerjaan

Ditulis 2026-11-19 untuk AI coding (Claude, Codex, Gemini, Cursor, dan lainnya) yang melanjutkan pekerjaan di repo ini. Baca seluruh file ini sebelum menyentuh kode. Tujuannya: kamu bekerja dengan aturan, keputusan, dan cara kerja yang sama dengan sesi sebelumnya.

## 1. Urutan membaca

1. File ini.
2. `.agents/AGENTS.md`: aturan repo. Wajib dipatuhi, terutama bagian E (invarian backend E.1–E.16), F (i18n), H (ADR).
3. Entri terakhir `tasks/PROGRESS-LOG.md`: posisi terakhir dan langkah berikutnya.
4. `tasks/sp1-ledger.md`: status tiap task SP1, 20 keputusan pre-flight (P1–P20), dan temuan yang ditunda.
5. Spec SP1: `docs/superpowers/specs/2026-11-18-sp1-single-frontend-web-local-design.md`. Ini otoritas tertinggi bila rencana bertentangan dengan dirinya sendiri.
6. Rencana SP1: `docs/superpowers/plans/2026-11-18-sp1-single-frontend-web-local.md` (14 task). Baca bagian "Global Constraints", "Questions for the owner" (semua pilihan bawaan sudah DISETUJUI pemilik 2026-11-19), dan "Spec gaps". Baca isi task hanya untuk task yang sedang dikerjakan.

## 2. Gambaran besar

Roadmap: SP0 (pipeline andal, selesai) → SP1 (frontend tunggal + web lokal, sedang berjalan) → SP2 (UI/UX untuk orang awam) → SP3 (ringan) → SP4 (fitur kreator). Daftar task: `tasks/roadmap-todo.md`.

Branch bertumpuk, satu PR ke `main` setelah SP2 (keputusan pemilik 2026-11-18):
- `feat/sp0-pipeline-stability`: SP0, selesai.
- `feat/sp1-single-frontend-web-local`: SP1, bercabang dari SP0. Kerja di sini.
- SP2 nanti bercabang dari SP1.

Jangan membuka PR, jangan push, jangan merge ke `main` kecuali pemilik memintanya.

## 3. Posisi SP1 saat ini

| Task | Status |
|---|---|
| 1 Toolchain (React 19, Vite 8, TS 6, Vitest, oxlint) | selesai, lolos review (`5652aec`) |
| 2 Platform core | selesai, lolos review (`69366dc`) |
| 3 Desktop adapter, semua Tauri ke `src/platform/` | kode `3f7bd3b` + perbaikan `caf2406`; **re-review perbaikan belum dijalankan** |
| 4–14 | belum dimulai |

Langkah berikutnya:
1. Re-review terbatas atas `git diff 3f7bd3b..caf2406` untuk tiga temuan Task 3: (a) teks error startup di `src/main.tsx` pindah ke `src/locales/{id,en}.json` lewat `i18n.t` dengan isi "apa, kenapa, harus apa"; (b) tes Vitest handshake sidecar desktop (baris `PORT:`/`TOKEN:` terpotong antar chunk, token sampai ke `auth.ts`, `setApiUrl`, event `backend-port-found`, timeout 90 detik, respawn); (c) `CanvasConfigControls.tsx` mengklik input file secara sinkron bila `!caps.localFilePicker`. Bila ketiganya beres, tandai Task 3 selesai di `tasks/sp1-ledger.md`.
2. Lanjut Task 4, lalu 5, dan seterusnya, berurutan.

## 4. Cara mengerjakan setiap task

1. Catat BASE: `git rev-parse --short HEAD`.
2. Ambil teks task dari rencana (bagian `### Task N: ...` sampai sebelum `### Task N+1`). Itu kebutuhanmu, termasuk nilai persis yang harus dipakai.
3. Terapkan keputusan pre-flight untuk task itu (tabel di bagian 5). Keputusan mengalahkan teks rencana bila berbeda.
4. TDD: tulis tes yang gagal dulu, jalankan dan pastikan gagal karena alasan yang benar, baru implementasi, lalu jalankan lagi sampai lulus.
5. Jalankan semua pemeriksaan (bagian 6). Semua harus hijau sebelum commit.
6. Commit. Pesan commit diakhiri dengan baris `Co-Authored-By:` sesuai attribution AI yang kamu pakai (sesi sebelumnya: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`).
7. Tambahkan entri 3–6 baris di bawah heading `## 2026-11-18 · SP1` di akhir `tasks/PROGRESS-LOG.md` (apa yang berubah, jumlah tes, yang tersisa), ikut dalam commit task itu.
8. **Review sebelum lanjut.** Ikuti `tasks/sp1-reviewer-instructions.md` atas `git diff <BASE>..HEAD` dengan pikiran segar (sebaiknya sesi atau agen terpisah). Perbaiki semua temuan Critical/Important, lalu review ulang khusus bagian yang diperbaiki. Temuan Minor dicatat di ledger sebagai "minor (deferred)". Pengalaman sesi ini: Task 3 lolos semua tes tetapi reviewer tetap menemukan masalah, jadi jangan lewati langkah ini.
9. Perbarui `tasks/sp1-ledger.md`: `Task N: complete (commits <base>..<head>, review clean)` atau keputusan yang kamu ambil, dengan format `Ruling: <apa> — <kenapa> — <akibat bila salah>`.

Jangan menunggu persetujuan pemilik di antara task. Putuskan sendiri hal yang ambigu (spec adalah otoritas), catat sebagai Ruling, lalu lanjut. Berhenti dan tanya pemilik hanya untuk: operasi yang tidak bisa dibatalkan atau destruktif, tindakan sensitif keamanan, push/merge/publish, atau rencana yang rusak sehingga semua jalan hanya tebakan.

## 5. Keputusan pre-flight per task (isi lengkap di `tasks/sp1-ledger.md`)

| Task | Keputusan |
|---|---|
| 4 | P14: jalankan `npx oxlint src` juga di langkah pemeriksaan. |
| 5 | P1: di salinan `AuthGate.tsx` ganti `setErrorMsg(null)` dengan `if (errorKey) setErrorKey(null);`. P9: sebut kemunculan persis "Discord Community"/"Community"; tambah kunci `auth.*_alt` (id + en). P10: cari blok di `App.tsx` dari teksnya, bukan nomor baris. P20: pisahkan `src/platform/cloud/token.ts` yang bebas efek samping dan import itu dari AuthGate. Dari Task 3: adapter cloud wajib mengimplementasikan `askNotifyPermission()` dengan `askBrowserNotifyPermission`; anggota browser yang sama dengan local diambil dari `src/platform/browser.ts`; sembunyikan bagian updater di Pengaturan bila tidak ada updater (P5). |
| 7, 8 | P4: baca `video_signing.key` sekali per request lalu teruskan byte kunci ke `sign`/`with_video_urls`; jangan disimpan antar request. |
| 9 | P11: pakai helper bersama `src/test/sourceFiles.ts` untuk tes pemindai sumber. P12: `useSignedVideo` meminta link baru hanya bila path atau link benar-benar berubah. |
| 10 | P3: `web_ui._serve` memanggil `path_guard.is_protected()` sebelum membuka file apa pun, jawab 404, dan beri tes. |
| 11 | P7: tes `ui_dir` menormalkan kedua sisi (`os.path.normcase(os.path.realpath(...))`). P15: `test_free_port` diberi assert eksplisit. |
| 13 | P2: `web-package.yml` cukup `contents: read`; unggah ke rilis dipindah ke job baru di `build.yml` (unduh artefak zip, `gh release upload --clobber`). P16: `TemporaryDirectory(ignore_cleanup_errors=True)` di skrip smoke. |
| 14 | P6: README "Opsi 3" (`cd web`, sekitar baris 100) ikut diperbarui dan grep diperluas. P18: tambahkan rujukan silang dari AGENTS.md E.12 ke pengecualian F.7 / ADR-013. |
| semua | P11: logika yang sama jangan disalin; satu helper penulisan atomik 0600 di backend dipakai bersama. P13 (sudah di Task 2): token hanya dikirim bila origin request sama dengan origin backend, jadi setiap panggilan backend wajib membangun URL dari `API_URL`. |

## 6. Lingkungan (Windows, mesin pemilik)

- Tes Python: `C:\Users\dhima\projects\ac-venv\Scripts\python.exe -m pytest backend/tests -q -p no:cacheprovider`. Jangan pakai `python` dari PATH (hanya pintasan Microsoft Store). Baseline branch SP1: 694 lulus, 7 dilewati.
- Frontend (dari root repo): `npm run build`, `npx vitest run`, `npx oxlint src` (0 error; warning boleh). Mulai Task 5 juga `npm run build:cloud`.
- **Vitest harus dijalankan dari path dengan huruf drive besar** (`C:\Users\...`). Dari `c:\...` (misalnya Git Bash `/c/...`) Vitest termuat dua kali dan gagal "Cannot read properties of undefined (reading 'config')". Di Git Bash: `cd 'C:/Users/dhima/projects/auto-clipper'`.
- Tidak ada Rust: `npm run tauri build` tidak bisa dijalankan. Desktop diverifikasi lewat tes dengan plugin di-mock, workflow PR Check, dan daftar cek manual pemilik.
- FFmpeg untuk eksperimen: `C:\Users\dhima\projects\auto-clipper\node_modules\ffmpeg-static\ffmpeg.exe`.

## 7. Aturan kerja dan preferensi pemilik

- Semua teks yang dilihat pengguna: bahasa Indonesia yang mudah dipahami orang awam, plus bahasa Inggris, menjawab "apa yang terjadi, kenapa, harus apa". Istilah teknis hanya di "Detail teknis". Tanpa gaya tulisan AI yang berlebihan.
- Backend: tidak boleh `print()` ke stdout di modul backend (handshake sidecar desktop bergantung pada stdout), kecuali entry point CLI. Error lewat `log_error(...)`. Jangan pernah mencatat isi cookies atau kunci API.
- Jangan mencentang task di `tasks/roadmap-todo.md` tanpa hasil tes yang benar-benar dijalankan.
- **Protokol kuota:** bila pemilik bilang kuota sesinya hampir habis ("80%"), hentikan pekerjaan, pastikan semua tersimpan (commit `wip(sp1): ...` bila belum hijau), dan tulis entri baru di `tasks/PROGRESS-LOG.md` berisi posisi terakhir dan langkah berikutnya, supaya sesi berikutnya bisa melanjutkan.
- Laporan ke pemilik ditulis dalam bahasa Indonesia, singkat, berisi hasil nyata (angka tes, commit), dan jujur soal yang belum diverifikasi.
- Setelah SP1 selesai: SP2 dimulai dengan brainstorm + spec yang disetujui pemilik sebelum kode apa pun. Cek manual tampilan T0.12 dan uji notebook Colab T0.13 dari SP0 masih menunggu pemilik dan dilakukan sebelum PR akhir.
