# Task Tracker: Auto Clipper

Status:
`[ ]` Belum Dikerjakan
`[/]` Sedang Dikerjakan
`[x]` Selesai

---

## Fase 1: Quick Wins (Effort S, Dampak Tinggi)
- [ ] **Task 1.1:** Support Format URL YouTube Lain (E)
  - [ ] Hapus validasi regex ketat URL di frontend.
  - [ ] Test dengan URL `youtu.be/...` dan Shorts.
- [ ] **Task 1.2:** Notifikasi OS-Level (B)
  - [ ] Implementasi Web Notification API / IPC Notification saat selesai atau gagal.
  - [ ] Pastikan tidak muncul jika app sedang di-focus.
- [ ] **Task 1.3:** Halaman FAQ / Tutorial (F)
  - [ ] Buat tombol "?" di header.
  - [ ] Buat modal komponen `FAQModal.tsx`.
- [ ] **Task 1.4:** Simpan Default Settings (D)
  - [ ] Persist provider & API key ke `localStorage`.
  - [ ] Obfuscasi API key (misal dengan `btoa()`).
  - [ ] Auto-load settings saat app dibuka.
- [ ] **Task 1.5:** Kalau 1 Clip Gagal, Lanjut Clip Lain (G)
  - [ ] Ubah loop crop di `App.tsx` agar menggunakan block try-catch mandiri.
  - [ ] Tampilkan notifikasi jumlah success/failed.

### Checkpoint Fase 1
- [ ] Build clean tanpa error.
- [ ] Flow utama tidak terganggu.

---

## Fase 2: Polish Caption (A)
- [ ] **Task 2.1:** Audit & Fix Subtitle Sizing
  - [ ] Sesuaikan resolusi ASS dan `font_size` ratio di `crop_utils.py`.
- [ ] **Task 2.2:** Perbaiki Timing & Kalimat Subtitle
  - [ ] Validasi edge case padding SRT/ASS.
  - [ ] (Opsional) uji coba kualitas prompt transkrip.

### Checkpoint Fase 2
- [ ] Subtitle terbaca dan tidak overlap bounds.
- [ ] Timing akurat dengan suara.

---

## Fase 3: Fondasi UI (Theme + i18n + Polish)
- [ ] **Task 3.1:** Refactor CSS ke Design Tokens
  - [ ] Buat custom variables di `index.css`.
  - [ ] Hapus inline colors di JSX.
- [ ] **Task 3.2:** Dark / Light / System Theme Toggle
  - [ ] Buat UI toggle dan persist state.
- [ ] **Task 3.3:** Setup i18n (ID + EN)
  - [ ] Install `react-i18next`.
  - [ ] Ekstrak strings ke file `locales/id.json` dan `en.json`.
- [ ] **Task 3.4:** UI/UX Polish
  - [ ] Ekstrak komponen dari `App.tsx` (`Header`, `MainPanel`, `ClipCard`).
  - [ ] Pastikan responsive layout rapi.

### Checkpoint Fase 3
- [ ] Tema berfungsi (Dark/Light/System).
- [ ] Ganti bahasa (ID/EN) berjalan realtime.
- [ ] Kode frontend lebih modular (< 300 line per file).

---

## Fase 4: Fitur Besar — Async Job + History
- [ ] **Task 4.1:** Async Job System di Backend
  - [ ] Setup in-memory job dictionary.
  - [ ] Buat endpoint `POST /jobs` dan `GET /jobs/{id}`.
  - [ ] Eksekusi task di thread terpisah.
- [ ] **Task 4.2:** Frontend Integrasi Async Job
  - [ ] Implementasi loop polling status.
  - [ ] Mapping UI bar progress mengikuti state server asli.
- [ ] **Task 4.3:** Cancel/Stop Proses
  - [ ] Buat endpoint batal job dan kill worker.
  - [ ] Tambahkan tombol "Cancel" di UI.
- [ ] **Task 4.4:** Handle App Di-close Mendadak
  - [ ] Bind event window close.
  - [ ] Tambahkan konfirmasi dialog.
  - [ ] Jalankan hook cleanup temp files.
- [ ] **Task 4.5:** History (SQLite)
  - [ ] Setup SQLite tabel history di python.
  - [ ] Endpoint `GET /history` dan `DELETE /history`.
  - [ ] Buat Tab "History" di UI frontend.

### Checkpoint Fase 4
- [ ] Progress berjalan mulus tanpa hang.
- [ ] Batal render bisa menghentikan ffmpeg.
- [ ] History clips tersimpan dan bisa dilihat lagi.

---

## Fase 5: Security Hardening (I)
- [ ] **Task 5.1:** Electron contextIsolation + Preload Script
  - [ ] Buat file `preload.cjs` (expose `electronAPI`).
  - [ ] Set `nodeIntegration: false`, `contextIsolation: true`.
- [ ] **Task 5.2:** API Key Storage via Electron safeStorage
  - [ ] Expose IPC channel enkripsi data.
  - [ ] Migrasikan key dari `localStorage`.
- [ ] **Task 5.3:** CORS & Input Validation Hardening
  - [ ] Setup regex whitelist domains YouTube.
  - [ ] Batasi origin FastAPI.

### Checkpoint Fase 5
- [ ] Aplikasi berjalan tanpa akses node secara direct di renderer.
- [ ] Siap release.
