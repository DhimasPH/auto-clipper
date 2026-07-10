# Auto Clipper — Roadmap & Backlog

> Dokumen hidup. Berisi fitur/perbaikan yang direncanakan, hasil dari sesi feedback.
> Belum dieksekusi kecuali yang ada di bagian "Sudah Selesai".
> Estimasi effort: **S** (kecil, <½ hari), **M** (sedang, ~1-2 hari), **L** (besar, butuh desain/beberapa hari).

---

## Sudah Selesai (baseline saat ini)

- Pipeline inti: download (yt-dlp) → AI highlight (OpenAI/Gemini) → multi-clip 9:16 face-crop → preview in-app.
- Extract audio sebelum Whisper (fix limit 25MB untuk video panjang).
- Multi-clip (bukan cuma highlight pertama).
- Burn subtitle deterministik via ASS (PlayRes dipatok ke ukuran clip, font proporsional).
- Subtitle untuk Gemini (dari transcript Gemini).
- Face framing: sampling median sepanjang clip + clamp anti kepotong.
- Padding timing 0.5s di ujung clip.
- Timestamp parser tahan format aneh (`MM:SS:mmm`), guard timestamp di luar durasi.
- Output H.264/yuv420p + faststart (bisa diputar di semua player).
- Retry otomatis untuk error transient (503/429/timeout).
- Fallback: kalau burn subtitle gagal, tetap hasilkan clip tanpa subtitle.
- In-app toast notifications + progress bar per-tahap.
- Backend status polling (auto-heal "Disconnected").
- Electron: kill Python child tree saat app close + uvicorn reload=False.
- HTTP status code yang benar (404/400/500/502).
- Toggle subtitle on/off: global sebelum generate + per-clip re-render setelah generate.
- `requirements.txt` di-pin (lower-bound floors).

---

## Backlog

### A. Kualitas Caption

- **[M] Perbaiki subtitle** — size masih bisa melebihi video, timing & kalimat meleset. Size: cek ulang skala font / kemungkinan libass abaikan PlayRes (butuh screenshot untuk tuning). Timing & kalimat: paling terbantu kalau transcript pakai Whisper (OpenAI) walau highlight dari Gemini.
- **[M] Caption gaya word-by-word / karaoke** (ala Hormozi/MrBeast) — kata muncul satu-satu, jauh lebih engaging.
- **[M] Styling caption** — ukuran, warna, posisi, font bisa diatur.
- **[M] Terjemahan subtitle** (mis. auto-translate) — nyambung ke multi-bahasa.

### B. Notifikasi

- **[S] Notifikasi OS-level** — pakai Electron `Notification` API, muncul di luar aplikasi biar user aware walau app nggak dipantengin. Barengan toast in-app yang sudah ada.

### C. History & Re-processing

- **[L] History clip** — daftar clip yang pernah dibuat (file-nya sudah ada di folder lokal). Perlu index metadata (source, start/end, subtitle path) di config/DB lokal + halaman History. Dari sini user bisa render ulang (with/without subtitle) & download ulang tanpa proses dari awal.
- **[L] AI koreksi/pertajam hasil sebelumnya** (video & subtitle) — depend ke History. Perlu simpan konteks job agar bisa "re-run dengan instruksi tambahan".

### D. Settings

- **[S–M] Simpan default AI provider + API key** — config persist. **PENTING: jangan simpan API key plaintext** — idealnya OS keychain, minimal terenkripsi.
- **[M] Multi-bahasa, default Indonesia** — setup i18n (mis. react-i18next), ekstrak semua teks UI.
- **[M] Tema dark / light / system, default light** — refactor warna hardcoded (sekarang inline semua) jadi CSS variable + toggle.

### E. Input & Download

- **[S] Format URL YouTube lain** (`youtu.be/...`, shorts, dll) — hampir gratis, yt-dlp sudah support; cukup jangan over-validate URL di frontend.
- **[M] Upload video lokal** — skip step download, feed file langsung ke pipeline.
- **[M] Platform lain** (X / TikTok / Instagram) — yt-dlp support banyak, tapi reliabilitas variatif (auth/rate-limit). Best effort.
- **[M] Pilihan kualitas download** (4K/2K/1080p/720p/480p) sesuai yang tersedia — 2 langkah: probe format (yt-dlp) → user pilih → download. Opsi dibatasi ke kualitas yang benar-benar ada.

### F. Providers & Onboarding

- **[M] Perbanyak opsi AI provider** — bikin abstraksi provider (adapter pattern) dulu; sekarang masih if/else OpenAI/Gemini.
- **[S] FAQ / tutorial** cara dapetin link video dari tiap platform — konten statis + halaman help.

### G. Arsitektur & Reliability

- **[L] Async job + background processing + progress asli** — fondasi untuk History, re-AI, cancel, dan progress % beneran. (Sebelumnya ditunda karena berisiko menjelang demo.)
- **[S–M] Cancel/stop proses** yang sedang jalan — depend ke async job.
- **[M] Handle app di-close mendadak saat proses jalan** — konfirmasi keluar ("proses lagi jalan, yakin keluar?"), plus cleanup file temp/partial yang belum kelar biar nggak ada sampah/korup di folder.
- **[S] Kalau 1 clip gagal, lanjut clip lain** (sekarang error di 1 clip nge-stop semua).
- **[M] Aspect ratio lain** (1:1, 4:5) selain 9:16.
- **[M] Packaging/installer** (electron-builder) + auto-update — biar bisa dibagikan sebagai app jadi.
- **[S] Simpan hasil ke folder pilihan user + tombol "buka folder".**

### H. UI / UX

- **[M] Percantik UI & UX** — polish keseluruhan tampilan dan alur. Sebaiknya dikerjakan barengan tema (D) dan i18n karena sama-sama menyentuh seluruh UI.

### I. Security / Hardening

- **[L] Perketat keamanan aplikasi.** Poin konkret:
  - **Electron renderer** saat ini `nodeIntegration: true` + `contextIsolation: false` → renderer punya akses penuh ke Node. Ini risiko terbesar (kalau ada konten/skrip jahat termuat, bisa jadi RCE). Harusnya `contextIsolation: true` + preload script + IPC.
  - **API key**: sekarang dikirim di body tiap request & disimpan di state; kalau nanti di-persist (D), wajib enkripsi/keychain, jangan plaintext.
  - **Validasi input URL** sebelum diteruskan ke yt-dlp (whitelist skema/host yang didukung).
  - **`/video` endpoint**: sudah dibatasi ke folder temp (anti path-traversal) — review ulang saat nambah fitur file.
  - **CORS** `allow_origins=["*"]` — aman untuk desktop localhost, tapi bisa dipersempit.
  - **API lokal tanpa auth** (siapa pun proses lokal bisa akses `:8000`) — pertimbangkan token lokal kalau perlu.
  - Subprocess sudah pakai list-args (bukan shell) → aman dari command injection; pertahankan.

---

## Saran Prioritas

1. **Quick wins:** E-URL format, B-notif OS, F-FAQ, D-simpan settings, G-"1 clip gagal lanjut". (Effort S, kerasa cepat.)
2. **Polish caption (A):** benerin size/timing lebih awal karena keluhan berulang — cepat kalau ada screenshot.
3. **Fondasi UI:** D-tema + D-i18n + H-UI polish dikerjakan sekali jalan (sama-sama nyentuh seluruh UI).
4. **Fitur besar (pasca-demo):** G-async job → lalu C-history & re-AI, cancel, handle close mendadak. Saling bergantung, jadikan satu fase.
5. **Security (I):** contextIsolation Electron sebaiknya dinaikkan prioritasnya sebelum aplikasi didistribusikan ke user luar.
