# Task Tracker: Auto Clipper

Status:
`[ ]` Belum Dikerjakan
`[/]` Sebagian / perlu dilanjutkan
`[x]` Selesai (terverifikasi di kode)
`[!]` Diklaim selesai tapi BROKEN — perlu perbaikan (temuan audit)

> Diperbarui 2026-07-11 (sesi lanjutan) berdasarkan audit kode langsung + hasil `/build auto`.
> Fondasi besar solid; temuan broken Fase 7 sudah beres. Sesi terakhir menuntaskan
> T1–T4 (lihat "Log Sesi" di bawah). Verifikasi: **24 test pytest lolos**, `tsc` + `vite build` clean,
> plus check harness `scripts/check_i18n.mjs` & `scripts/check_history.mjs`.

---

## Log Sesi 2026-07-11 (`/build auto`)
Empat task dikerjakan test-driven, tiap task punya commit sendiri:
- [x] **T1 (todo 1.4):** Catatan `api_key_note` diperbaiki (EN/ID) → cerminkan safeStorage terenkripsi. `36bfaa4`
- [x] **T2 (todo 3.3):** `HistoryModal` full i18n (namespace `history.*`, key baru di en/id). `a46be8d`
- [x] **T3 (todo 1.5):** Backend hitung `failed` per job + ekspos di `GET /jobs/{id}`; FE tampilkan "X berhasil, Y gagal". `0bb79fe`
- [x] **T4 (Fase 7.2 FE):** Tombol "AI Koreksi" digate via `canRerunAI()` (`metadata.ai_job`). `0d6f198`
- [x] **T5 (todo 3.1):** Warna hardcoded → design token. `cb20cec`
- [x] **T6 (todo 3.4):** Pecah `App.tsx` 919→162 baris (hooks + komponen). `6332f1e`
- [x] **T7:** Opsi rasio **Landscape 16:9** (backend crop + FE selector + i18n).

Ditunda (butuh QA visual / keputusan): **Task 2.2** (kualitas subtitle), **Task 3.1** (inline color → token),
**Task 3.4** (pecah `App.tsx`), dan Backlog. Refactor FE besar sebaiknya didahului setup Vitest.

---

## Fase 1: Quick Wins (Effort S, Dampak Tinggi)
- [x] **Task 1.1:** Support Format URL YouTube Lain (E)
  - [x] Hapus validasi regex ketat URL di frontend.
  - [x] Test dengan URL `youtu.be/...` dan Shorts. → jalan.
- [/] **Task 1.2:** Notifikasi OS-Level (B)
  - [x] Implementasi notifikasi saat selesai/gagal. → pakai `Notification` renderer (bukan Electron main-process API).
  - [ ] Pastikan tidak muncul jika app sedang di-focus. → **belum**, notif muncul walau app aktif.
- [x] **Task 1.3:** Halaman FAQ / Tutorial (F) → `FAQModal.tsx` + tombol header, OK.
- [x] **Task 1.4:** Simpan Default Settings (D)
  - [x] Persist provider & API key. → **disempurnakan oleh Task 6.2**: key kini via safeStorage terenkripsi, bukan `localStorage`+`btoa` (itu tinggal fallback dev).
  - [x] Catatan i18n `settings.api_key_note` diperbaiki → kini mencerminkan penyimpanan terenkripsi (safeStorage), bukan "browser".
- [x] **Task 1.5:** Kalau 1 Clip Gagal, Lanjut Clip Lain (G)
  - [x] Loop crop per-klip pakai try/except mandiri (di backend `_run_job`).
  - [x] Tampilkan jumlah success/failed. → backend hitung `failed` per job & ekspos di `GET /jobs/{id}`; FE tampilkan "X berhasil, Y gagal" di toast, notifikasi OS, & header hasil.

### Checkpoint Fase 1
- [x] Build clean tanpa error. → diverifikasi sesi 2026-07-11: `tsc` + `vite build` lolos, 24 test pytest lolos.
- [x] Flow utama tidak terganggu.

---

## Fase 2: Polish Caption (A)
- [x] **Task 2.1:** Audit & Fix Subtitle Sizing → `crop_utils.srt_to_ass` pin PlayRes + font ratio, OK.
- [/] **Task 2.2:** Perbaiki Timing & Kalimat Subtitle
  - [x] Rebase timing SRT/ASS per klip.
  - [ ] Kualitas kalimat/timing masih dikeluhkan user → perlu evaluasi (transcript Whisper vs Gemini). Butuh screenshot.

### Checkpoint Fase 2
- [/] Subtitle terbaca & tidak overlap bounds. → ukuran OK; kualitas kalimat/timing belum tuntas.
- [ ] Timing akurat dengan suara.

---

## Fase 3: Fondasi UI (Theme + i18n + Polish)
- [/] **Task 3.1:** Refactor CSS ke Design Tokens
  - [x] Buat custom variables di `index.css`.
  - [x] **Warna hardcoded di JSX dihapus.** Semua `#hex`/`rgba`/`white`/gradient di `.tsx` (45 titik, 6 file) diganti ke token semantik baru di `index.css` (nilai identik → pixel sama). Dijaga `scripts/check_colors.mjs`.
  - [ ] Sisa: styling layout/spacing masih inline (bukan warna) — masuk ranah Task 3.4 polish.
- [x] **Task 3.2:** Dark / Light / System Theme Toggle → jalan, TAPI default `system` (roadmap minta `light`).
- [/] **Task 3.3:** Setup i18n (ID + EN)
  - [x] `react-i18next` + `locales/id.json` & `en.json`, default ID.
  - [/] **Banyak string masih hardcoded** — `HistoryModal.tsx` kini full i18n (semua string via `t('history.*')`, key baru di en/id). Sisa: sebagian App.tsx & SettingsModal masih hardcoded.
- [/] **Task 3.4:** UI/UX Polish
  - [x] Ekstrak komponen (`Header`, `ClipCard`, `SettingsModal`, `HistoryModal`, `FAQModal`).
  - [/] App.tsx dipecah **919 → 162 baris**: logika ke hooks (`useUserSettings`, `useTheme`, `useToasts`, `useBackendHealth`, `useClipJobs`) + UI ke komponen (`Toasts`, `GenerateForm`, `ClipsResult`). Behavior-preserving (JSX dipindah verbatim, props bertipe). Dijaga `scripts/check_file_size.mjs` (App.tsx ≤300).
    - [ ] Sisa: `GenerateForm.tsx` (453) & `SettingsModal.tsx` (332) masih >300 (mayoritas inline style verbose) — soft-warn. Responsive belum dicek menyeluruh (butuh QA visual).

### Checkpoint Fase 3
- [x] Tema berfungsi (Dark/Light/System).
- [/] Ganti bahasa (ID/EN) realtime → jalan tapi belum menyeluruh (ada teks hardcoded).
- [/] Kode frontend modular (<300 line/file). → App.tsx & mayoritas file sudah <300; `GenerateForm`/`SettingsModal` masih di atas (inline style), belum kritis.

---

## Fase 3.5: Advanced Features & Resilience
- [x] **Task 3.5.1:** Save to Folder → IPC `select-folder`/`open-folder`, OK.
- [/] **Task 3.5.2:** OS-level Notification → sama dengan Task 1.2 (tanpa cek focus).
- [x] **Task 3.5.3:** Lanjut Klip Berikutnya → try/except per-klip di backend, OK.
- [/] **Task 3.5.4:** Dukungan URL Multi-Platform
  - [x] Longgarkan validasi frontend.
  - [ ] **IG & X/Twitter masih DITOLAK** whitelist backend (`main.py` cuma izinkan youtube/youtu.be/tiktok). TikTok OK.

### Checkpoint Fase 3.5
- [x] Proses klip resilient walau 1 segmen error.
- [x] Output bisa disimpan di folder pilihan.
- [/] Notifikasi OS muncul di background → muncul, tapi tanpa cek focus.

---

## Fase 4: Fitur Besar — Async Job + History
- [x] **Task 4.1:** Async Job System di Backend → `POST /jobs`, `GET /jobs/{id}`, worker thread. OK.
- [x] **Task 4.2:** Frontend Integrasi Async Job → polling status + progress dari server. OK.
- [!] **Task 4.3:** Cancel/Stop Proses
  - [x] Endpoint cancel + tombol "Batal" di UI.
  - [ ] **Tidak benar-benar menghentikan ffmpeg.** Cancel cuma set flag yang dicek antar-langkah; render clip yang sedang jalan tetap selesai (`_run_ffmpeg` pakai `subprocess.run` blocking tanpa simpan PID).
- [/] **Task 4.4:** Handle App Di-close Mendadak
  - [x] Bind event window close + dialog konfirmasi.
  - [ ] **Cleanup temp files → BELUM.** Close juga tidak memanggil cancel job; file partial numpuk di `temp_downloads`.
- [x] **Task 4.5:** History (SQLite)
  - [x] Tabel history (`db.py`), endpoint `GET/DELETE /history`, tab History di UI.
  - [ ] Catatan: re-render dari history rusak untuk **upload lokal** (bug path `source_video`, lihat Fase 7).

### Checkpoint Fase 4
- [x] Progress berjalan mulus tanpa hang.
- [!] Batal render bisa menghentikan ffmpeg → **TIDAK** (lihat 4.3).
- [x] History clips tersimpan & bisa dilihat lagi.

---

## Fase 5: AI & Video Polish
- [x] **Task 5.1:** Caption Karaoke/Word-by-word → `words_to_karaoke_ass` (OpenAI/Whisper saja; Gemini di-disable di UI).
- [x] **Task 5.2:** Opsi Aspect Ratio (1:1, 4:5, 9:16, **16:9 Landscape**) → filter crop + subtitle width, OK. Landscape memotong tinggi dari lebar penuh (kebalikan mode vertikal); logika diekstrak ke `build_crop_filter`/`output_width` + diuji.
- [/] **Task 5.3:** Upload file lokal (.mp4)
  - [x] Endpoint `/upload` + toggle input + skip download untuk `local:`.
  - [x] `python-multipart` sudah di `requirements.txt` (dipakai `/upload`); bug path `source_video` untuk upload lokal sudah diperbaiki di 7.4. Re-render/koreksi upload lokal jalan.

---

## Fase 6: Security Hardening (I)
- [x] **Task 6.1:** Electron contextIsolation + Preload → `nodeIntegration:false`, `contextIsolation:true`, `preload.cjs` expose API terbatas. OK.
- [x] **Task 6.2:** API Key via safeStorage → enkripsi `secrets.enc`, migrasi dari localStorage. OK.
- [/] **Task 6.3:** CORS & Input Validation Hardening
  - [x] Batasi origin FastAPI (bukan `*` lagi) + guard path-traversal `/video`.
  - [ ] Whitelist URL belum lengkap (IG/X hilang — lihat Task 3.5.4).

### Checkpoint Fase 6
- [x] Renderer tanpa akses node langsung.
- [ ] "Siap release" → belum, masih ada fitur broken (Fase 7).

---

## Fase 7: Bug & Utang Teknis (temuan audit — PRIORITAS)

- [x] **7.1 Toggle subtitle per-clip mati DIHAPUS.** Keputusan: dihapus dari UI (kapabilitas dicakup toggle global pra-generate + re-render di History). Dibuang: tombol di `ClipCard`, props `subtitlePath/reRendering/onToggleSubs`, state `subtitlePath/sourcePath/reRendering`, fungsi `toggleClipSubs` (yang manggil `/crop` terhapus). `ClipCard` di-tsc bersih; nol dangling reference di `src/`.
- [x] **7.2 AI Koreksi (re-run AI) diperbaiki.** Import `crop_to_vertical` dibenerin ke `crop_utils`; `get_history(id)` dipakai benar (bukan no-arg/list); stub dobel `create_rerun_ai_job` dihapus; `metadata["ai_job"]` ditulis di `_finalize_job` agar tombol bisa muncul (FE gating perlu disesuaikan — lihat catatan FE).
- [x] **7.3 Cancel benar-benar hentikan ffmpeg.** `_run_ffmpeg` pakai `subprocess.Popen` + register handle; `cancel_job` mem-`kill()` proses yang sedang jalan; crop cek `should_cancel` sebelum fallback. Diuji di `test_jobs.py`.
- [x] **7.4 Bug path `source_video` diperbaiki.** `_run_job` simpan `job["source_path"]` (download & upload lokal); `_finalize_job` pakai itu, tidak lagi hardcode.
- [x] **7.5 IG & X didukung.** Whitelist backend diperluas (youtube/youtu.be/tiktok/instagram/x/twitter) + diekstrak ke `is_valid_source_url`. Diuji di `test_main.py`.
- [x] **7.6 Cleanup temp selektif saat app ditutup.** `cleanupTempIntermediates()` di `main.cjs` (dipanggil di `will-quit`) hanya menghapus intermediate transient (`.ass`, `.srt`, `_audio.mp3`), TIDAK menyentuh `source_*`/`upload_*`/clip mp4 yang dipakai History re-render. Render dihentikan oleh `killBackend` (taskkill /T).
- [x] **7.7 Test suite di-refresh.** `test_main.py` ditulis ulang untuk endpoint async (/jobs, /history, /video, validasi URL). Tambah `test_db.py` (round-trip SQLite) & `test_jobs.py` (cancel kill proc + should_cancel). Tambah `python-multipart` ke requirements. **22 test lolos.**

> [SELESAI] Catatan FE 7.2: Tombol "AI Koreksi" kini digate via helper `canRerunAI()` (`src/lib/history.ts`) yang cek `metadata.ai_job`, bukan `metadata.transcript` yang tak pernah ditulis. Diuji di `scripts/check_history.mjs`.

---

## Backlog belum tersentuh (dari ROADMAP)

- [ ] Kualitas download 4K/2K/480p + **probing format** (sekarang cuma 3 opsi statis, tanpa cek format tersedia).
- [ ] Perbanyak opsi AI provider (baru OpenAI & Gemini).
- [ ] Notif OS: cek focus + pindah ke Electron main-process `Notification` + IPC.
- [ ] Auto-update (electron-updater) — disebut di roadmap, belum ada.
