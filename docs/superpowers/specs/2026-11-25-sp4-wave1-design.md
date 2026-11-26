# Spec SP4 Gelombang 1: Identitas Aplikasi, AI Ulang Tanpa API Key, Pemberitahuan Update Web Lokal, dan Catatan Tertunda

Tanggal: 2026-11-25 · Status: rancangan disetujui pemilik di chat, menunggu review dokumen tertulis · Induk: `2026-11-12-enhancement-roadmap.md` (bagian 6) · Bergantung: SP1, SP2, SP3 (branch `feat/sp3-lightweight`)

Branch kerja: `feat/sp4-wave1` dari `feat/sp3-lightweight`. Setelah lolos review menyeluruh, `feat/sp3-lightweight` dimajukan (fast-forward) ke `feat/sp4-wave1` sehingga PR SP0–SP3 yang sudah hijau ikut membawa gelombang ini. Versi tetap `1.19.0` (belum dirilis).

---

## 1. Latar

SP0–SP3 selesai dan PR ke `main` sudah hijau. Sebelum merge, pemilik meminta gelombang pertama SP4 dikerjakan. Empat hal yang terasa langsung oleh pengguna masih kurang:

1. Aplikasi tidak menampilkan siapa pembuatnya, versi berapa, atau ke mana pengguna bisa mengikuti dan mendukung pembuatnya. Splash hanya ada di desktop dan di web langsung hilang (temuan audit SP2 Task 15).
2. "Pilih ulang momen dengan AI" hanya jalan dengan API key (`POST /jobs/{id}/rerun_ai` butuh provider dan key). Di HP (Colab) dan di mode AI manual menu itu tidak ada. Sebagian frontend lama juga memanggil `/rerun-ai` (tanda hubung) yang salah alamat (`tasks/roadmap-todo.md`, ditemukan 2026-11-18).
3. Auto Clipper Web (paket web lokal) tidak punya pemberitahuan versi baru (`caps.local.updater = false`). Pengguna tidak tahu ada perbaikan.
4. Ledger SP2 dan SP3 menyimpan sekitar 28 catatan minor yang ditunda, termasuk tiga celah path kecil yang butuh token.

## 2. Sasaran dan non-sasaran

Sasaran:
- Identitas aplikasi yang sama di desktop, web lokal, dan Vercel: baris ringkas hak cipta + versi di bawah setiap halaman, bagian "Tentang Auto Clipper" lengkap di Pengaturan → Bantuan, splash dengan logo, judul, tagline, dan versi.
- Pengguna tanpa API key (termasuk HP lewat Colab) bisa memilih ulang momen dari proyek lama tanpa unduh dan transkripsi ulang.
- Pengguna Auto Clipper Web tahu ada versi baru dan bisa mengunduhnya dengan satu tombol.
- Setiap catatan tertunda diputuskan: dikerjakan, atau ditulis alasannya.
- README GitHub dan tutorial Colab sesuai keadaan terbaru.

Non-sasaran:
- Update web lokal yang memasang sendiri (tahap 2, tetap di backlog SP4).
- Fitur kreator gelombang 2 (terjemahan subtitle, unggah otomatis, dan seterusnya).
- Mengubah updater desktop.

## 3. Keputusan pemilik (2026-11-25)

| Topik | Keputusan |
|---|---|
| Isi gelombang 1 | Keempatnya: identitas, AI ulang manual, update web lokal tahap 1, catatan tertunda. Ditambah README dan tutorial Colab. |
| Letak footer | Baris ringkas "© {tahun berjalan} Dhimas Panjie Herlambang · v{versi}" di bawah isi setiap halaman (ikut tergulir, tidak menempel). Ikon sosmed dan tombol dukung lengkap di Pengaturan → Bantuan → "Tentang Auto Clipper". |
| Splash di web | Tampil sekali per tab saat halaman pertama dibuka sampai cek sambungan selesai: minimal 0,8 detik, maksimal 2,5 detik. Desktop tetap seperti sekarang (isinya diperbarui). |
| Hasil AI ulang | Proyek baru di Riwayat, klip lama tetap utuh (sama dengan AI ulang versi API key). |
| Hak cipta | "© {tahun berjalan} Dhimas Panjie Herlambang", tahun dihitung saat dibuka. |

## 4. Rancangan

### 4.1 Satu sumber identitas: `src/lib/appInfo.ts`

- `APP_NAME = "Auto Clipper"`, `COPYRIGHT_HOLDER = "Dhimas Panjie Herlambang"`, `appVersion()` dari `__APP_VERSION__` yang diisi Vite `define` dari `package.json` (`src-tauri/tauri.conf.json` menyimpan versinya sendiri, saat ini sama `1.19.0`; sebuah tes memastikan keduanya selalu sama).
- `SOCIAL_LINKS`: daftar berurutan `{ id, name, href, iconPath, kind }` untuk TikTok, YouTube, Instagram, Threads, GitHub, Facebook, Discord (komunitas), dan Trakteer (`kind: "support"`). URL:
  - TikTok https://www.tiktok.com/@auto_clippers
  - YouTube https://www.youtube.com/@autoclipperss
  - Instagram https://www.instagram.com/auto_clipperss/
  - Threads https://www.threads.com/@auto_clipperss
  - GitHub https://github.com/DhimasPH/auto-clipper
  - Facebook https://www.facebook.com/people/Auto-Clipper/61592220556873/
  - Discord https://discord.gg/5AvvA682UN
  - Trakteer https://trakteer.id/dhiimsph
- `AuthGate.tsx` (baris 23–29 sekarang) memakai daftar ini. Tidak ada salinan URL lain di `src/`.
- Tagline lewat i18n: `app.tagline` = en "The smartest way to automate your video clips." dan id dengan arti sama dalam bahasa sehari-hari.
- Tautan dibuka lewat `platform().openExternal()`.

### 4.2 Footer ringkas dan "Tentang Auto Clipper"

- `AppFooter`: satu baris teks kecil (tetap ≥ 14 px, kontras AA) di bawah isi halaman pada tiga menu. Bukan `position: fixed`; di HP berada di atas navigasi bawah dengan jarak aman (`padding-bottom` mengikuti tinggi navigasi dan safe area).
- `AboutSection` di Pengaturan → Bantuan, paling atas: logo `public/logo.png` (dengan `alt`), "Auto Clipper", tagline, versi, deretan 8 ikon sosmed (masing-masing tombol ≥ 44 × 44 px dengan `aria-label` nama platform, ikon `aria-hidden`), tombol **"Dukung pembuat aplikasi"** (Trakteer) dengan satu kalimat penjelas bahwa ini donasi sukarela, lalu baris hak cipta.
- Aturan SP2 tetap: satu tombol terisi per layar (tombol dukung bergaya garis bila layar sudah punya tombol terisi), tanpa emoji, tanpa gradien.

### 4.3 Splash

- Isi sama di semua platform: logo, "Auto Clipper", tagline, versi.
- Desktop: perilaku waktu tetap seperti sekarang.
- Web (local dan cloud): tampil saat pemuatan pertama di tab itu (`sessionStorage` sebagai penanda, dibungkus try/catch; bila tidak bisa dibaca, splash tetap tampil sekali), hilang saat cek sambungan pertama selesai (berhasil atau gagal), dengan batas bawah 0,8 detik dan batas atas 2,5 detik. Tidak muncul lagi saat pindah menu atau kembali dari Pengaturan.
- `prefers-reduced-motion`: tanpa animasi masuk/keluar.
- Splash tidak menunda gerbang: di cloud, `AuthGate` tampil setelah splash selesai; bila cek sambungan lebih lama dari 2,5 detik, aplikasi lanjut dengan status yang ada (banner terputus bila perlu).

### 4.4 AI ulang tanpa API key

Backend:
- Endpoint baru `POST /jobs/{id}/rerun-manual` dengan body `{ extra_prompt?: string, max_clips?: int }` plus pilihan tampilan yang sama dengan rerender (bentuk, subtitle, kanvas, pelacak) bila dikirim; bila tidak dikirim memakai metadata proyek lama.
- Membuat job baru (`history_ref` ke proyek lama, judul "{judul lama} (pilihan ulang)"), memakai video sumber dan transkrip proyek lama, menyusun perintah AI baru dengan instruksi tambahan (fungsi penyusun perintah yang sama dengan alur manual biasa), lalu langsung `AWAITING_MANUAL` dengan perintah itu. Setelah pengguna menempel jawaban, alur `resume-manual` yang sudah ada membuat klip.
- Validasi dan keamanan sama dengan `rerun_ai`: `_canvas_image_refused`, `_resolve_safe_output_dir`, `path_guard`, `timings: []` di metadata job baru (ruling SP3 Task 5).
- Bila video sumber atau transkrip tidak ada lagi (mis. sesi Colab habis), menolak dengan kode error baru yang jelas (apa yang terjadi, kenapa, harus apa: buat proyek baru dari link) dan aksi yang sesuai.
- `instruksi tambahan` dibatasi panjangnya (mis. 500 karakter) dan diperlakukan sebagai teks biasa di dalam perintah.

Frontend:
- Menu ⋯ proyek di Riwayat: **"Pilih ulang momen"** tampil untuk proyek selesai yang punya transkrip, di semua platform.
- Dialog: kotak "Apa yang mau diubah?" (boleh kosong, contoh di placeholder), jumlah klip opsional, tombol **Lanjut**. Mode manual → buat job lewat `rerun-manual` lalu buka langkah 3 (Pilih momen) dengan perintah baru. Mode **Pakai API key** (desktop/web lokal) → alur `rerun_ai` yang sudah ada.
- Semua pemanggilan memakai alamat yang benar (`/rerun_ai`, `/rerun-manual`); sisa pemanggilan `/rerun-ai` dihapus.
- Teks layar mengikuti aturan SP2 (bahasa sehari-hari, tanpa istilah teknis).

### 4.5 Pemberitahuan update Auto Clipper Web (tahap 1)

Backend (hanya mode `--web`):
- `GET /api/update-check` (butuh token seperti endpoint lain) mengambil `https://api.github.com/repos/DhimasPH/auto-clipper/releases/latest` dengan User-Agent generik dan batas waktu singkat, tanpa data pengguna. Hasil di-cache di app data paling lama 24 jam; parameter `force=1` dari tombol **Periksa pembaruan**.
- Mengembalikan `{ current, latest, update_available, download_url, release_url, checked_at }`. `download_url` dipilih dari aset `Auto-Clipper-Web-<windows|macos-arm64|macos-x64|linux>.zip` sesuai OS dan arsitektur yang berjalan; hanya URL di `github.com/DhimasPH/auto-clipper/releases/` yang diterima.
- Gagal (offline, rate limit) → `update_available: false` + `error` ringan; tidak pernah melempar ke layar sebagai error besar.
- Perbandingan versi semver sederhana dari tag `app-v<versi>`.

Frontend:
- `caps.local.updater` tetap `false` (updater desktop). Kemampuan baru `caps.updateNotice` (`local: true`, lainnya `false`).
- Pengaturan → Bantuan: "Versi X sudah tersedia" + tombol **Unduh** (membuka `download_url` di browser) + tiga langkah singkat (unduh, tutup Auto Clipper Web, ekstrak ke folder baru lalu buka) + kalimat bahwa proyek dan pengaturan tidak hilang. Bila sudah terbaru: "Anda memakai versi terbaru". Bila gagal memeriksa: "Belum bisa memeriksa sekarang" + **Coba lagi**.
- Pemeriksaan otomatis sekali saat aplikasi dibuka (memakai cache 24 jam); tidak ada pop-up.

### 4.6 Catatan tertunda SP2 dan SP3

- Task khusus menelusuri setiap baris "minor (deferred)" di `tasks/sp2-ledger.md` dan `tasks/sp3-ledger.md`, mengecek apakah masih berlaku di kode sekarang, lalu mengerjakan atau menulis Ruling alasannya. Hasilnya tabel di ledger SP4.
- Wajib dikerjakan (keamanan, dari SP3):
  - `/api/thumbnails`, `/api/extract-metadata`, `/video-url`, `/upload-image` menolak path jaringan/perangkat dari teksnya sebelum menyentuh disk (`path_guard.is_network_or_device_path`).
  - `temp_downloads` di bawah `AUTO_CLIPPER_WORK_DIR` (`workspace.uploads_dir()`) ikut `_NO_PROJECTS_INSIDE`.
  - Status add-on membawa `pending_remove` sehingga "akan dihapus saat dibuka ulang" tetap tampil setelah Pengaturan ditutup.
- Wajib dikerjakan (perilaku, dari SP3): `CreatePage` tidak mengganti model subtitle sebelum pengecekan API key yang hilang; `resume_manual_job` tidak menyalin timing lama.

### 4.7 Dokumen

- `README.md`: bagian "Tentang Auto Clipper" (tagline, apa yang dilakukan, tiga cara memakai: desktop, Auto Clipper Web, HP lewat Colab), daftar sosmed, ajakan dukung lewat Trakteer, hak cipta; fitur SP1–SP4 gelombang 1 diperbarui; cara update Auto Clipper Web.
- `docs/tutorial-auto-clipper-cloud.md` dan `Auto_Clipper_Colab.ipynb`: disamakan dengan keadaan sekarang (Langkah 3 memasang pelacak Teliti, `BRANCH`, nama tombol SP2–SP4, AI ulang tanpa API key, bagian Vercel Root Directory kosong).
- `docs/panduan-penggunaan-awam.md`: AI ulang, Tentang, pemberitahuan update.
- `CHANGELOG.md` di bawah `1.19.0`, `.agents/AGENTS.md` (aturan `appInfo.ts` sebagai satu sumber identitas, endpoint baru), ADR-016 bila ada keputusan arsitektur (endpoint `rerun-manual`, `update-check`).

## 5. Penanganan error

- Semua error backend baru lewat `AppError` + kode di `backend/errors.py` (judul dan pesan id/en, aksi) dan tampil lewat `ErrorCard` (aturan F.12).
- `update-check` tidak pernah menghasilkan kartu error; hanya teks status kecil.
- `rerun-manual` menolak dengan 404 untuk proyek yang tidak ada dan kode error khusus untuk sumber yang hilang.

## 6. Pengujian

- pytest: `rerun-manual` (job baru berstatus `AWAITING_MANUAL`, perintah memuat instruksi tambahan, transkrip dipakai ulang tanpa unduh, `timings: []`, sumber hilang → error, output_dir di cloud/web dijepit, batas panjang instruksi), `update-check` (pemilihan aset per OS/arsitektur, cache 24 jam, `force`, offline, host aset di luar repo ditolak, hanya mode web), path text-first di empat endpoint dengan fixture `no_filesystem_for_the_server`, `pending_remove`.
- Vitest: `appInfo` (versi dari `__APP_VERSION__`, tahun berjalan, 8 tautan unik, tidak ada URL sosmed di luar `appInfo.ts`), `AppFooter`, `AboutSection` (ikon 44 px + `aria-label`, `openExternal`), splash web (min/maks, sekali per tab, reduced motion), menu dan dialog "Pilih ulang momen" (manual vs API key, alamat endpoint benar), bagian update (tersedia/terbaru/gagal), plainWords dan contrast untuk kunci baru.
- Cek browser 360/768/1280 terang dan gelap untuk footer, Tentang, splash, dialog pilih ulang, dan bagian update.

## 7. Urutan task usulan

1. `appInfo.ts` + footer + Tentang + AuthGate memakai satu sumber.
2. Splash semua platform.
3. Backend `rerun-manual` + kode error.
4. Frontend "Pilih ulang momen" (manual dan API key) + perbaikan alamat endpoint.
5. Pemberitahuan update web lokal (backend + Pengaturan).
6. Catatan tertunda SP2/SP3 (triase + perbaikan wajib).
7. Dokumen (README, tutorial Colab + notebook, panduan, CHANGELOG, AGENTS.md, ADR), verifikasi penuh, uji browser, review menyeluruh.
