# Implementation Plan: Auto Clipper — Saran Prioritas Roadmap

Dokumen ini memecah 5 poin dari bagian **Saran Prioritas** di `docs/ROADMAP.md` menjadi fase-fase implementasi yang terurut, lengkap dengan task breakdown, acceptance criteria, dan verification step.

## Keputusan Arsitektur Berdasarkan Diskusi
1. **API Key Storage:** Menggunakan `localStorage` + obfuscasi sementara, akan dimigrasi ke OS Keychain (`safeStorage`) di Fase 5.
2. **i18n:** Cukup menggunakan 2 bahasa untuk rilis awal: Indonesia (ID) dan English (EN).
3. **Async Job Store:** Menggunakan in-memory store untuk queue management (simple & cepat).
4. **History Storage:** Menggunakan **SQLite** untuk menyimpan metadata riwayat clip agar lebih robust.

---

## Fase 1: Quick Wins (Effort S, Dampak Tinggi)
Semua task di fase ini effort kecil dan bisa di-paralel.

### Task 1.1: Support Format URL YouTube Lain (E)
- **Description:** Pastikan frontend tidak menolak URL valid (`youtu.be`, Shorts, parameter).
- **Files:** `src/App.tsx`

### Task 1.2: Notifikasi OS-Level (B)
- **Description:** Tambahkan notifikasi desktop (Electron `Notification` API) saat proses selesai/gagal.
- **Files:** `electron/main.cjs`, `src/App.tsx`

### Task 1.3: Halaman FAQ / Tutorial (F)
- **Description:** Modal/dialog sederhana bantuan cara mendapatkan link video.
- **Files:** `src/App.tsx`, `src/components/FAQModal.tsx`

### Task 1.4: Simpan Default Settings (D)
- **Description:** Persist API key dan AI provider ke `localStorage` (dengan obfuscation).
- **Files:** `src/App.tsx`

### Task 1.5: Kalau 1 Clip Gagal, Lanjut Clip Lain (G)
- **Description:** Ubah loop crop dari throw ke try/catch per-clip agar sisa clip tetap di-render.
- **Files:** `src/App.tsx`

---

## Fase 2: Polish Caption (A)

### Task 2.1: Audit & Fix Subtitle Sizing
- **Description:** Tweak ASS properties agar ukuran subtitle proporsional dan tidak terpotong.
- **Files:** `backend/crop_utils.py`

### Task 2.2: Perbaiki Timing & Kalimat Subtitle
- **Description:** Tweak logic split SRT / uji prompt untuk akurasi timing.
- **Files:** `backend/ai_utils.py`, `backend/crop_utils.py`

---

## Fase 3: Fondasi UI (Theme + i18n + Polish)

### Task 3.1: Refactor CSS ke Design Tokens
- **Description:** Pindahkan inline style hardcoded ke CSS variables.
- **Files:** `src/index.css`, `src/App.tsx`

### Task 3.2: Dark / Light / System Theme Toggle
- **Description:** Implementasi CSS var theme toggle.
- **Files:** `src/index.css`, `src/App.tsx`

### Task 3.3: Setup i18n (ID + EN)
- **Description:** Setup `react-i18next` untuk Indonesia dan Inggris.
- **Files:** `package.json`, `src/App.tsx`, `src/locales/*`

### Task 3.4: UI/UX Polish
- **Description:** Pecah `App.tsx` menjadi komponen-komponen terpisah, tambah animasi.
- **Files:** `src/App.tsx`, `src/components/*`

---

## Fase 4: Fitur Besar — Async Job + History

### Task 4.1: Async Job System di Backend
- **Description:** Implementasi in-memory job store & background worker.
- **Files:** `backend/main.py`, `backend/job_manager.py`, `backend/worker.py`

### Task 4.2: Frontend Integrasi Async Job
- **Description:** Refactor frontend untuk polling status job.
- **Files:** `src/App.tsx`

### Task 4.3: Cancel/Stop Proses
- **Description:** UI cancel button + backend kill subprocess.
- **Files:** `backend/job_manager.py`, `backend/main.py`, `src/App.tsx`

### Task 4.4: Handle App Di-close Mendadak
- **Description:** Konfirmasi sebelum keluar app saat job berjalan + cleanup.
- **Files:** `electron/main.cjs`, `src/App.tsx`, `backend/main.py`

### Task 4.5: History (SQLite)
- **Description:** Setup database SQLite untuk mencatat riwayat render & buat UI History.
- **Files:** `backend/history.py`, `backend/main.py`, `src/components/History.tsx`, `src/App.tsx`

---

## Fase 5: Security Hardening (I)

### Task 5.1: Electron contextIsolation + Preload Script
- **Description:** Matikan `nodeIntegration`, setup context bridge.
- **Files:** `electron/main.cjs`, `electron/preload.cjs`, `src/App.tsx`

### Task 5.2: API Key Storage via Electron safeStorage
- **Description:** Migrasi dari `localStorage` ke `safeStorage` (OS keychain).
- **Files:** `electron/preload.cjs`, `electron/main.cjs`, `src/App.tsx`

### Task 5.3: CORS & Input Validation Hardening
- **Description:** Batasi CORS dan tingkatkan regex URL validation.
- **Files:** `backend/main.py`
