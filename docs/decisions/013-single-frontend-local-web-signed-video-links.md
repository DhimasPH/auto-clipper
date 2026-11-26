# ADR-013: Satu Frontend untuk Desktop, Web Lokal, dan Cloud; Alamat Video Bertanda Tangan

- **Status**: Accepted
- **Date**: 2026-11-18
- **Context**: SP1 "Frontend tunggal dan web lokal", rilis v1.19.0. Spec: `docs/superpowers/specs/2026-11-18-sp1-single-frontend-web-local-design.md`. Rencana: `docs/superpowers/plans/2026-11-18-sp1-single-frontend-web-local.md`

---

## 1. Konteks & Masalah

1. Ada dua frontend yang hampir kembar: `src/` (desktop, React 18) dan `web/` (Colab lewat Vercel, React 19). Komponen yang sama ditulis dua kali dan mulai berbeda; setiap perbaikan UI di SP0 dikerjakan dua kali.
2. Belum ada cara memakai Auto Clipper di browser tanpa memasang aplikasi desktop.
3. `GET /video` dikecualikan dari cek token (temuan T0.19): siapa pun yang tahu alamat tunnel Colab bisa mengambil `.mp4` apa pun di folder yang diizinkan.

## 2. Keputusan Arsitektur

### A. Satu frontend dengan lapisan platform (`src/platform/`)
- Semua yang berbeda antar platform ada di satu objek `Platform`: `kind`, `caps` (`apiKeys`, `localFilePicker`, `driveBrowser`, `openFolder`, `updater`, `preventSleep`), `backend()`, `pickVideo()`, `saveClip()`, `openFolder()`, `secrets`, `notify()`, ditambah `reconnect()`, `openExternal()`, `pickFolder()`, `pickImage()`, `setPreventSleep()` dan `updater` yang dibutuhkan untuk memindahkan semua panggilan Tauri.
- Pemilihan saat start: `window.__TAURI_INTERNALS__` ada → desktop; build `VITE_TARGET=cloud` → cloud; selain itu → local. Adapter dimuat dengan import dinamis, jadi build local dan cloud tidak menjalankan kode Tauri.
- `@tauri-apps/*` hanya diimpor di `src/platform/desktop/`; uji Vitest `src/platform/imports.test.ts` memindai sumber.
- Komponen memeriksa `caps`, bukan `kind`. Pengecualian: pilihan gerbang (`AuthGate` untuk cloud, `LocalGate` untuk web lokal) dan halaman pembuka di `App.tsx`.
- Toolchain `src/` disamakan dengan `web/`: React 19, Vite 8, TypeScript 6, `@vitejs/plugin-react` 6, oxlint, dan Vitest (baru). Teks hanya di `src/locales/{id,en}.json`.
- Cloud dibangun dari root repo: `npm run build:cloud` (`vite build --mode cloud`, `.env.cloud`) dengan setelan di `vercel.json`. `web/` dihapus.

### B. Alamat video bertanda tangan (`backend/video_sign.py`)
- `sig = HMAC_SHA256(kunci, path kanonik)`, tanpa waktu kedaluwarsa. Kunci 32 byte acak di `video_signing.key` dalam folder data aplikasi (di Colab ikut ke Drive; selama Drive belum ter-mount di `drive_mount.local_dir()`), dibuat sekali, dibaca dari file setiap dipakai. Link tetap berlaku setelah restart; menghapus file kunci membatalkan semua link.
- `GET /video` mewajibkan `sig` di ketiga platform. Urutan: `path_guard` → tanda tangan → folder yang diizinkan → file `.mp4`. Penolakan: 403 `Access denied`.
- Link dibuat saat data dibaca (`clips` di `GET /jobs/{id}`, `result_clips` di `GET /history`) dan lewat `POST /video-url` (bertoken) untuk path lain. Link tidak pernah disimpan di `history.db`. Pengecualian token di middleware persis `path == "/video"`.
- Frontend tidak menyusun URL `/video`. `ClipCard` meminta link baru sekali bila pemutar ditolak, lalu menampilkan kartu error.
- Konsekuensi yang diterima: link yang tersebar tetap membuka klip itu (hanya klip itu) selama server dan alamatnya sama.

### C. Mode web lokal (`backend/web_ui.py`, `backend/web_mode.py`)
- `backend --web`: bind `127.0.0.1` saja, token acak per peluncuran. Port: port peluncuran sebelumnya dipakai ulang bila masih kosong (`web_port.json`, mode 0600, ditolak `path_guard`), selain itu port acak yang kosong (keputusan pemilik 2026-11-20). Browser menyimpan pengaturan dan API key per alamat termasuk port, jadi port acak setiap kali membuat semuanya hilang. Backend menyajikan `/` (`index.html`), `/assets/*`, dan file gambar di root folder UI. Navigasi memakai `HashRouter`, jadi tidak ada fallback SPA yang bisa menutupi endpoint API.
- Tanpa token di mode ini: `/`, `/assets/*`, file gambar root UI, `/health`; `/video` memakai `sig`. Semua yang lain, termasuk `/heartbeat`, wajib token.
- Satu instance per komputer: `web_instance.json` (`{port, pid, token}`, mode 0600, ditolak `path_guard`). Instance dianggap hidup bila `/` menjawab 200 dan `POST /heartbeat` dengan tokennya menjawab 200; peluncur kedua hanya membuka tab baru.
- Peluncur membuka `http://127.0.0.1:<port>/#t=<token>` dan menulis "Auto Clipper berjalan. Jangan tutup jendela ini selama memakai aplikasi." (id + en) beserta alamatnya. Frontend menyimpan token di `sessionStorage` dan menghapusnya dari alamat; `LocalGate` menangani token hilang, token lama, dan jendela yang ditutup.
- Tidak ada watchdog di mode web: jendela konsol adalah pemilik server.

### D. Paket "Auto Clipper Web"
- `.github/workflows/web-package.yml` membangun `Auto-Clipper-Web-<windows|macos-arm64|macos-x64|linux>.zip` dari `backend.spec` yang sama dengan desktop (onefile di Windows/Linux, onedir di macOS), `ffmpeg-static@5`, dan build UI; uji asap di CI; zip dilampirkan ke rilis `app-v<versi>`.
- Peluncur: `Auto Clipper Web.exe` (`scripts/web_launcher.py`), `Auto Clipper Web.command` (macOS), `Auto Clipper Web.sh` (Linux). Tidak ditandatangani; `BACA-SAYA.txt` menjelaskan SmartScreen dan, untuk macOS, System Settings → Privacy & Security → **Open Anyway** (macOS 15 ke atas; klik kanan → Open tidak lagi melewati Gatekeeper) atau klik kanan → Open (macOS 14 ke bawah). Paket Linux dibangun di Ubuntu 22.04, jadi butuh glibc 2.35 ke atas.
- Folder data sama dengan aplikasi desktop.

### E. Kartu error buatan frontend
- Kegagalan yang tidak bisa dilaporkan backend (link video ditolak, token lokal hilang atau lama, server lokal ditutup) memakai `localErrorInfo()` (`src/lib/localErrors.ts`) dengan teks id/en di `src/locales` (`local_error.*`) dan dirender `ErrorCard`. Ini pengecualian sempit dari AGENTS.md E.12.

## 3. Konsekuensi

- Satu kode frontend; perbaikan UI cukup sekali.
- Pengguna tanpa instalasi bisa memakai Auto Clipper di browser.
- `/video` tidak lagi terbuka tanpa token atau tanda tangan.
- Pengguna cloud mendapat halaman desktop (Manual AI Editor, Riwayat), yang kurang nyaman di layar HP: dicatat untuk SP2.
- Paket web lokal tidak ditandatangani: Windows SmartScreen dan macOS Gatekeeper memperingatkan.
- Setelan Vercel (Root Directory kosong, Node 22.x) harus diubah pemilik saat PR akhir digabung.
- Desktop dan web lokal memakai folder data yang sama (riwayat, cookies, kunci video).

## 4. Pertanyaan Terbuka

Lihat bagian "Questions for the owner" di rencana SP1. Keputusan bawaan yang dipakai tercatat di sana.
