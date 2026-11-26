# ADR-016: Identitas Aplikasi Satu Sumber, Pilih Ulang Momen Tanpa API Key, dan Pemberitahuan Versi Baru Auto Clipper Web

- **Status**: Accepted
- **Date**: 2026-11-25
- **Context**: SP4 gelombang 1, rilis v1.19.0. Spec: `docs/superpowers/specs/2026-11-25-sp4-wave1-design.md`. Rencana: `docs/superpowers/plans/2026-11-25-sp4-wave1.md`. Ledger dan keputusan per task: `tasks/sp4-ledger.md` (pre-flight P1 sampai P9).

---

## 1. Konteks

1. Aplikasi tidak menunjukkan pembuat, versi, dan tautan komunitas secara konsisten. Tautan media sosial hanya ada di halaman masuk cloud, versi ditulis tangan di `settingsLayout.ts`, dan splash di web langsung hilang (audit SP2 Task 15).
2. "Pilih ulang momen" hanya jalan dengan API key (`POST /jobs/{id}/rerun_ai`), padahal jalur bawaan sejak SP2 adalah AI manual (ADR-014). Di HP lewat Colab menu itu tidak ada. Selain itu `rerun_ai` memakai judul dan folder proyek lama, sehingga klip lama tertimpa.
3. Pengguna Auto Clipper Web (paket web lokal, ADR-013) tidak tahu ada versi baru, karena updater hanya ada di desktop (`caps.local.updater = false`).

---

## 2. Keputusan

### A. Satu sumber identitas (`src/lib/appInfo.ts`)
- `APP_NAME`, `COPYRIGHT_HOLDER`, `appVersion()` (dari `__APP_VERSION__`, diisi Vite `define` dari `package.json`), `SOCIAL_LINKS` (delapan tautan berurutan: TikTok, YouTube, Instagram, Threads, GitHub, Facebook, Discord `kind: "community"`, Trakteer `kind: "support"`, masing-masing dengan path ikon 24 × 24), `SUPPORT_LINK`, `REPO_URL`, dan `RELEASES_URL_PREFIX` hanya ada di file ini.
- `appInfo.test.ts` menolak salinan URL di file lain di `src/` dan menjaga versi `src-tauri/tauri.conf.json` dan `Cargo.toml` sama dengan `package.json`. `APP_VERSION` di `settingsLayout.ts` dihapus (P1).
- Tahun hak cipta dihitung saat halaman tampil (`copyrightLine()`). Baris itu dibuat di kode, bukan di locale, karena "©" tergolong `\p{Extended_Pictographic}` dan `plainWords.test.ts` menolak emoji di locale (P2).
- Tampilan: `AppFooter` (satu baris "© tahun pemegang · v<versi>" di bawah isi setiap halaman, ikut tergulir) di `AppLayout`; `AboutSection` ("Tentang Auto Clipper") paling atas di Pengaturan → Bantuan; `AuthGate` memakai `SOCIAL_LINKS` dan `copyrightLine` yang sama (P3). Tautan dibuka lewat `platform().openExternal()`.

### B. Splash per kemampuan platform (`caps.splash`)
- `"startup"` (desktop): tampil selama pengaturan dan sidecar dimuat, waktunya sama seperti sebelumnya.
- `"tab"` (web lokal dan cloud): sekali per tab (`sessionStorage` `ac_splash_seen` dalam `try/catch`), sampai `GET /health` pertama menjawab, minimal 0,8 detik, maksimal 2,5 detik (`src/lib/splash.ts`, `src/hooks/useWebSplash.ts`).
- Isi sama di semua platform: logo, nama, tagline (`app.tagline`), versi. Tanpa animasi bila `prefers-reduced-motion`.
- Pilihan lewat cap, bukan `platform().kind` (ADR-013, P4).

### C. `POST /jobs/{id}/rerun-manual`
- Sinkron, tanpa thread dan tanpa antrean: `create_rerun_manual_job` membaca teks ucapan proyek lama, menyusun perintah dengan `generate_manual_prompt` (fungsi yang sama dengan alur manual biasa), lalu menyimpan proyek baru berstatus `AWAITING_MANUAL` dengan `history_ref`, `timings: []`, dan judul `repick_title()` ("<judul> (pilihan ulang)", diberi nomor bila sudah dipakai). Jawaban yang ditempel lewat `resume-manual` seperti proyek manual lain.
- Validasi sama dengan `rerun_ai`: `_canvas_image_refused`, `_resolve_safe_output_dir`, `path_guard`. Instruksi tambahan maksimal 500 huruf (`REPICK_EXTRA_MAX`), dimasukkan ke perintah sebagai teks biasa.
- Teks ucapan wajib masih ada. Video sumber boleh hilang hanya bila `_restore_source_video` bisa mengembalikannya (work dir Colab: link diunduh ulang, file Drive disalin ulang). Selain itu ditolak dengan `RERUN_SOURCE_MISSING` (aksi `new_project`, tombol **Buat proyek baru**) (P6).
- `rerun_ai` memakai `repick_title()` yang sama, sehingga hasil AI ulang dengan API key juga menjadi proyek baru dan klip lama tidak tertimpa (P5).
- Frontend: menu **Pilih ulang momen** di Riwayat untuk proyek selesai yang punya teks ucapan (`canRepick`), dialog `RepickDialog`, dan `repickMode()` yang memakai aturan provider E.20: AI manual memanggil `rerun-manual` lalu membuka langkah 3, mode API key memanggil `rerun_ai`. Alamat lama `/rerun-ai` (tanda hubung) dihapus dan dijaga tes (P7).

### D. `GET /api/update-check` (tahap 1, hanya `--web`)
- `backend/update_check.py` hanya memakai stdlib dan di-import saat endpoint dipanggil. Satu GET ke `https://api.github.com/repos/DhimasPH/auto-clipper/releases/latest` dengan User-Agent `AutoClipper-UpdateCheck`, tanpa query dan tanpa data pengguna, batas 5 detik dan 1 MB.
- Cache 24 jam di app data (`update_check.json`); `force=1` (tombol **Periksa pembaruan**) melewati cache; kegagalan tidak di-cache dan dijawab sebagai `error` ringan, tidak pernah kartu error.
- Versi berjalan dikirim aplikasi (`current`) dan dibandingkan dengan tag `app-v<versi>`. Aset dipilih per OS dan arsitektur (`Auto-Clipper-Web-<windows|macos-arm64|macos-x64|linux>.zip`). Tautan hanya diteruskan bila berawalan `https://github.com/DhimasPH/auto-clipper/releases/`; backend dan frontend sama-sama memeriksa (termasuk menolak `..` dan spasi).
- Di luar mode `--web` endpoint menjawab 404; tetap butuh token.
- Frontend: `caps.updateNotice` (web lokal saja; `caps.updater` tetap untuk desktop), `useUpdateNotice` dipanggil di dalam gerbang (`WithUpdateNotice` di `App.tsx`, sesudah `LocalGate`), bagian **Pembaruan** di Bantuan (`UpdateNoticeSection`, `role="status"`), tanpa pop-up (P8).

---

## 3. Konsekuensi

- Menambah tautan atau mengganti versi cukup di satu tempat; uji menjaga tidak ada salinan.
- Pilih ulang momen tanpa API key tidak memakai GPU atau antrean. Di Colab sesi baru, video dari link diunduh ulang saat jawaban ditempel; subtitle tidak dibuat ulang.
- Proyek ulang menambah folder baru di pustaka. Klip lama tetap ada sampai pengguna menghapus proyeknya.
- Pemberitahuan versi bergantung pada API GitHub tanpa token (batas 60 permintaan per jam per IP); cache 24 jam menjaga pemakaian jauh di bawahnya.
- Tahap 2 (Auto Clipper Web memasang versi baru sendiri, dengan tanda tangan) tetap di backlog SP4.
