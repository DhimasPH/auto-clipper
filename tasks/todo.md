# Task Tracker: Auto Clipper

Status:
`[ ]` Belum Dikerjakan
`[/]` Sedang Dikerjakan
`[x]` Selesai

---

## Fase 1: Quick Wins (Effort S, Dampak Tinggi)
- [x] **Task 1.1:** Support Format URL YouTube Lain (E)
  - [x] Hapus validasi regex ketat URL di frontend.
  - [x] Test dengan URL `youtu.be/...` dan Shorts.
- [x] **Task 1.2:** Notifikasi OS-Level (B)
  - [x] Implementasi Web Notification API / IPC Notification saat selesai atau gagal.
  - [x] Pastikan tidak muncul jika app sedang di-focus.
- [x] **Task 1.3:** Halaman FAQ / Tutorial (F)
  - [x] Buat tombol "?" di header.
  - [x] Buat modal komponen `FAQModal.tsx`.
- [x] **Task 1.4:** Simpan Default Settings (D)
  - [x] Persist provider & API key ke `localStorage`.
  - [x] Obfuscasi API key (misal dengan `btoa()`).
  - [x] Auto-load settings saat app dibuka.
- [x] **Task 1.5:** Kalau 1 Clip Gagal, Lanjut Clip Lain (G)
  - [x] Ubah loop crop di `App.tsx` agar menggunakan block try-catch mandiri.
  - [x] Tampilkan notifikasi jumlah success/failed.

### Checkpoint Fase 1
- [ ] Build clean tanpa error.
- [ ] Flow utama tidak terganggu.

---

## Fase 2: Polish Caption (A)
- [x] **Task 2.1:** Audit & Fix Subtitle Sizing
  - [x] Sesuaikan resolusi ASS dan `font_size` ratio di `crop_utils.py`.
- [x] **Task 2.2:** Perbaiki Timing & Kalimat Subtitle
  - [x] Validasi edge case padding SRT/ASS.
  - [x] (Opsional) uji coba kualitas prompt transkrip.

### Checkpoint Fase 2
- [ ] Subtitle terbaca dan tidak overlap bounds.
- [ ] Timing akurat dengan suara.

---

## Fase 3: Fondasi UI (Theme + i18n + Polish)
- [x] **Task 3.1:** Refactor CSS ke Design Tokens
  - [x] Buat custom variables di `index.css`.
  - [x] Hapus inline colors di JSX.
- [x] **Task 3.2:** Dark / Light / System Theme Toggle
  - [x] Buat UI toggle dan persist state.
- [x] **Task 3.3:** Setup i18n (ID + EN)
  - [x] Install `react-i18next`.
  - [x] Ekstrak strings ke file `locales/id.json` dan `en.json`.
- [x] **Task 3.4:** UI/UX Polish
  - [x] Ekstrak komponen dari `App.tsx` (`Header`, `MainPanel`, `ClipCard`).
  - [x] Pastikan responsive layout rapi.

### Checkpoint Fase 3
- [ ] Tema berfungsi (Dark/Light/System).
- [ ] Ganti bahasa (ID/EN) berjalan realtime.
- [ ] Kode frontend lebih modular (< 300 line per file).

---

## Fase 3.5: Advanced Features & Resilience
- [x] **Task 3.5.1:** Implementasi *Save to Folder*
  - [x] Beri opsi ke *user* untuk memilih *output directory* untuk klip.
- [x] **Task 3.5.2:** OS-level Notification
  - [x] Gunakan Electron Notification API saat generate selesai.
- [x] **Task 3.5.3:** Lanjut Klip Berikutnya
  - [x] Struktur *try-catch* per-klip di *backend* agar 1 gagal tidak mematikan semua.
- [x] **Task 3.5.4:** Dukungan URL Multi-Platform
  - [x] Longgarkan validasi frontend, pastikan backend yt-dlp menerima TikTok/IG.

### Checkpoint Fase 3.5
- [x] Proses klip tangguh (resilient) walau ada 1 segmen error.
- [x] Hasil output bisa disimpan di folder pilihan (Bukan cuma temp/download browser).
- [x] Notifikasi OS muncul jika aplikasi sedang di background.

---

## Fase 4: Fitur Besar — Async Job + History
- [x] **Task 4.1:** Async Job System di Backend
  - [x] Setup in-memory job dictionary.
  - [x] Buat endpoint `POST /jobs` dan `GET /jobs/{id}`.
  - [x] Eksekusi task di thread terpisah.
- [x] **Task 4.2:** Frontend Integrasi Async Job
  - [x] Implementasi loop polling status.
  - [x] Mapping UI bar progress mengikuti state server asli.
- [x] **Task 4.3:** Cancel/Stop Proses
  - [x] Buat endpoint batal job dan kill worker.
  - [x] Tambahkan tombol "Cancel" di UI.
- [x] **Task 4.4:** Handle App Di-close Mendadak
  - [x] Bind event window close.
  - [x] Tambahkan konfirmasi dialog.
  - [x] Jalankan hook cleanup temp files.
- [x] **Task 4.5:** History (SQLite)
  - [x] Setup SQLite tabel history di python.
  - [x] Endpoint `GET /history` dan `DELETE /history`.
  - [x] Buat Tab "History" di UI frontend.

### Checkpoint Fase 4
- [x] Progress berjalan mulus tanpa hang.
- [x] Batal render bisa menghentikan ffmpeg.
- [x] History clips tersimpan dan bisa dilihat lagi.

---

## Fase 5: AI & Video Polish
- [x] **Task 5.1:** Caption bergaya *Karaoke/Word-by-word*.
- [x] **Task 5.2:** Opsi *Aspect Ratio* (1:1, 4:5) pada saat manual crop/AI.
- [x] **Task 5.3:** Upload file lokal (.mp4).

---

## Fase 6: Security Hardening (I)
- [x] **Task 6.1:** Electron contextIsolation + Preload Script
  - [x] Buat file `preload.cjs` (expose `electronAPI`).
  - [x] Set `nodeIntegration: false`, `contextIsolation: true`.
- [x] **Task 6.2:** API Key Storage via Electron safeStorage
  - [x] Expose IPC channel enkripsi data.
  - [x] Migrasikan key dari `localStorage`.
- [x] **Task 6.3:** CORS & Input Validation Hardening
  - [x] Setup regex whitelist domains YouTube.
  - [x] Batasi origin FastAPI.

### Checkpoint Fase 6
- [x] Aplikasi berjalan tanpa akses node secara direct di renderer.
- [x] Siap release.
