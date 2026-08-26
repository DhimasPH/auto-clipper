# Auto Clipper Cloud - Dashboard UI/UX Revamp (Complete Spec)

## 1. Goal

Revamp the current 4-step wizard Cloud UI (located in `web/`) into a modern, enterprise-level, action-centric centralized Dashboard. **Semua 28 fitur yang ada saat ini WAJIB dipertahankan tanpa pengecualian.** Tidak ada fitur baru yang ditambahkan. Perubahan ini murni reorganisasi layout dan peningkatan estetika.

---

## 2. Global Layout & Architecture

### 2.1 Layout Utama
- **Single-page Dashboard** menggantikan wizard linier 4 langkah.
- Struktur vertikal: **Header → Hero Input → Job List (History)**.
- Semua interaksi detail (prompt, JSON, results, editing) ditangani melalui **Modal/Drawer**, bukan halaman terpisah.

### 2.2 Header (Navbar)
Elemen yang **wajib** ada di header:
- Logo + branding: "Auto Clipper Cloud" dengan badge "Mobile Web".
- **Colab Backend Health Indicator**: Pill badge real-time ("Colab Online" hijau berdenyut / "Colab Offline" merah). Polling `GET /health` setiap 15 detik.
- Tombol **"Logout"** (`LogOut` icon) dengan `window.confirm` yang memanggil `clearAuthToken()`.

### 2.3 Authentication Wall (AuthGate)
**Wajib dipertahankan 100% tanpa perubahan fungsional:**
- Login screen dengan input token (`AUTO_CLIPPER_WEB_TOKEN`).
- Toggle visibilitas password (show/hide).
- Verifikasi token terhadap backend (`GET /api/settings/whisper-models`).
- Session expiry listener (`ac_unauthorized` event).
- Error banner untuk token salah/expired.
- Badge "Saved locally in browser" dan "Encrypted Session".

### 2.4 Theme & Visual
- Dark Mode dipertahankan (Tailwind neutral/zinc palette).
- Desain lebih flat dan modern, menghilangkan elemen dekoratif berlebihan.
- Ikon dari `lucide-react`.
- Footer: "Colab GPU Acceleration • faster-whisper & FFmpeg", "Auto Clipper v1.0 Cloud", "Zero Local GPU Required".

---

## 3. Hero Input Component (Job Creation)

Area pembuatan job baru, menggantikan peran **Step 1 (StepInput)** wizard.

### 3.1 Input URL
- **Text input besar** untuk paste URL video.
- Mendukung **semua domain**: YouTube, TikTok, Instagram, X/Twitter.
- Mendukung **Google Drive path**: `local:<gdrive_path>`.
- Tombol aksi di samping input:
  - **"Drive"** (`HardDrive` icon) → membuka **Google Drive File Browser Modal**.
  - **"Paste"** (`Clipboard` icon) → paste dari clipboard.
  - **"Clear"** (`XCircle` icon) → kosongkan input.
- **Real-time URL validation** dengan error message jika domain/schema tidak valid.

### 3.2 Google Drive File Browser Modal
**Wajib dipertahankan 100%:**
- Navigasi hierarki folder di `/content/drive` (Colab filesystem).
- Breadcrumb navigation dengan tombol Up/Back.
- Diferensiasi ikon: folder (`Folder` biru), file video (`FileVideo` amber).
- Klik file video → otomatis isi input URL dengan `local:{filePath}`.
- API: `GET /gdrive-browser?dir_path={path}`.

### 3.3 Quick Configuration (Visible by Default)
Langsung terlihat di bawah input URL sebagai pill/card selector:
- **Output Style Selector** — 4 mode visual card (radio group):
  1. Face Crop (9:16, AI face tracking, badge "AI Powered")
  2. Canvas Blur (9:16, blurred background, badge "Full View")
  3. Landscape (16:9, original widescreen)
  4. Square (1:1, grid-optimized)
- **Subtitle Preset Bar** — 3 preset visual card (radio group):
  1. Viral Pop (`single_word`, Impact font, badge "Trending"/"Popular")
  2. Podcast (`karaoke`, Montserrat font, badge "Karaoke")
  3. Classic (`standard`, Arial font, badge "Clean")
- **Custom Font Override** (FontSelector) — Dropdown 9 font:
  - Preset Default, Impact, Arial, Montserrat, Bebas Neue, Poppins, Oswald, Anton, Permanent Marker.

### 3.4 Advanced Settings (Expandable Accordion/Drawer)
Tombol toggle "Advanced Settings" (`Sliders` icon) membuka drawer berisi:

1. **Project Title** — Input teks opsional.
2. **Transcription Language** — Select: Auto Detect, Indonesian (`id`), English (`en`), Spanish (`es`), Japanese (`ja`).
3. **Faster Whisper Model** — Select: `small` (Fastest), `medium` (Balanced), `large-v3` (Maximum Accuracy).
4. **Max Clips** — Select: Auto (0), 1, 3, 5, 10.
5. **Subtitle Highlight Accent Color** — 6 preset swatches (Yellow, Cyan, Green, Pink, White, Orange) + native `<input type="color">` custom picker.
6. **Watermark Text & Opacity** — Input teks + slider opacity (0%-100%) + **Live Video Watermark Preview** simulator box.
7. **Canvas Background Controls** (tampil kondisional saat Output Style = `canvas_blur`):
   - Blur Intensity: `light`, `medium`, `strong`.
   - Background Mode: `blur` (Blurred Video), `color` (Solid Color dengan color picker).
   - Video Zoom Scale slider: `1.0x` sampai `2.0x` (step 0.1).

### 3.5 Submit Button
- **"Generate Clips"** (atau "Transcribe & Generate AI Prompt") — tombol besar, aktif hanya jika URL valid.
- Mengirim `CreateJobPayload` lengkap via `POST /jobs`.

### 3.6 Draft State Persistence
- Auto-save dan auto-restore semua konfigurasi input ke `localStorage` key `ac_draft_step_input`.
- Dibersihkan secara **asinkron** (`setTimeout`) saat membuat job baru untuk menghindari race condition React unmount.

---

## 4. Job List / History (Menggantikan Wizard Step 2, 3, 4 & History Page)

Daftar semua pekerjaan ditampilkan di bawah Hero Input. **Tidak ada lagi pemisahan antara "wizard active view" dan "history view"** — semuanya jadi satu.

### 4.1 Job Card — Informasi per Job
Setiap job ditampilkan sebagai card/row dengan:
- **Status icon** dan **status pill** berwarna:
  - `DONE` → hijau (`CheckCircle2`)
  - `AWAITING_MANUAL` → amber (`Clock`)
  - `ERROR` / `CANCELLED` → merah (`AlertCircle`)
  - `DOWNLOADING` / `TRANSCRIBING` / `CROPPING` / `PROCESSING` → amber spinning (`Clock` animasi)
- **Judul** (title dari metadata).
- **Progress text/bar** real-time.
- **Metadata**: Duration (detik), Quality, Created At (formatted timestamp).
- **Live Processing Timer**: Elapsed timer MM:SS saat job sedang aktif (status non-terminal).

### 4.2 Job Card — Aksi per Status

#### Status: `DOWNLOADING` / `TRANSCRIBING` / `CROPPING` / `PROCESSING`
- **Cancel Processing** button (`Ban` icon) → memanggil `apiCancelJob(jobId)`.
- Live elapsed timer + progress indicator.

#### Status: `AWAITING_MANUAL`
- Card di-highlight (border amber) dengan tombol **"Action Required: Review AI Prompt & JSON"**.
- Klik tombol → membuka **Prompt & JSON Modal** (lihat Section 4.3).

#### Status: `ERROR` / `CANCELLED`
- Error message ditampilkan.
- Tombol **"Retry"** (`RotateCcw`).
- Tombol **"Delete"** (`Trash2`) → `DELETE /history/{jobId}` (optimistic delete + rollback on failure).

#### Status: `DONE`
- Tombol **"View Clips"** → membuka **Results Modal** (lihat Section 5).
- Tombol **"Rerender All"** (`Film`) → membuka **Rerender Panel** inline accordion (lihat Section 4.4).
- Tombol **"AI Correct"** (`Sparkles`) → membuka **AI Correction Panel** inline accordion (lihat Section 4.5).
- Tombol **"Delete"** (`Trash2`).

### 4.3 Prompt & JSON Modal (Menggantikan Step 2 & Step 3)

Modal/Drawer yang muncul saat pengguna mengklik "Action Required" pada job `AWAITING_MANUAL`. **Wajib mengandung semua fitur dari StepPrompt dan StepPaste:**

**Bagian Prompt (eks-Step 2):**
- Menampilkan AI prompt lengkap dalam `<pre>` box scrollable.
- Tombol **"Copy Prompt"** → copy ke clipboard dengan feedback visual "Copied!".
- Tombol **"Share Prompt"** → `navigator.share` native sharing.
- **Quick Launch LLM Buttons** — 3 card berwarna:
  1. Google Gemini (biru) → `https://gemini.google.com`
  2. ChatGPT (hijau) → `https://chatgpt.com`
  3. Claude (amber) → `https://claude.ai`
  - Klik → otomatis copy prompt ke clipboard, lalu buka link di tab baru.
- Character count dan short Job ID.
- Info tip box.

**Bagian JSON Input (eks-Step 3):**
- `<textarea>` untuk paste JSON response dari LLM.
- **JSON Sanitizer** otomatis: strip markdown code blocks, handle array/object root (`highlights`/`clips`/`segments`).
- **Real-time validation**: banner hijau (valid + jumlah highlights) atau banner merah (error detail).
- **"Paste from Clipboard"** button.
- **Interactive JSON Example** (collapsible):
  - Toggle "View/Hide Example".
  - Contoh format JSON yang benar.
  - Tombol **"Insert Example Data"** untuk testing.

**Footer Modal:**
- Tombol **"Resume / Render Video Clips"** → memanggil `resumeJobWithJson(cleanJson)`.
- Tombol **"Cancel"** → tutup modal.

### 4.4 Full-Job Rerender Panel (Inline Accordion)
**Wajib dipertahankan 100%.** Panel accordion pada job card `DONE`:
- **Output Style Selector** (4 mode).
- **Subtitle Preset Bar** (3 preset).
- **Font Selector** (9 font).
- Tombol **"Submit Rerender"** → `POST /jobs/{jobId}/rerender`.
- Disabled state saat submitting.

### 4.5 Full-Job AI Correction Panel (Inline Accordion)
**Wajib dipertahankan 100%.** Panel accordion pada job card `DONE`:
- `<textarea>` untuk extra prompt/instruksi tambahan.
- Tombol **"Submit AI Correction"** → `POST /jobs/{jobId}/rerun-ai`.

### 4.6 Job Fetching & Polling
- History di-fetch via `GET /history` saat komponen mount.
- Job aktif di-poll setiap 1.8 detik via `apiGetJob(id)`.
- Auto-stop polling pada terminal states (`DONE`, `ERROR`, `CANCELLED`, `AWAITING_MANUAL`).
- Active job ID persisted di `localStorage` key `ac_active_job_id`.
- 404 handling → error message "Pekerjaan tidak ditemukan".

---

## 5. Results Modal (Menggantikan Step 4 Done State)

Modal/Drawer besar yang muncul saat klik "View Clips" pada job `DONE`. **Wajib mengandung semua fitur dari StepResult dan HistoryList clips section:**

### 5.1 Clips Grid
Setiap clip ditampilkan sebagai card dengan:
- **Video Player** — `<video>` element 9:16 aspect ratio, `controls`, `playsInline`, `preload="metadata"`.
- **Clip Badge** — "Clip #N".
- **Deskripsi** clip.
- **Duration Badge** (`Clock` icon).
- **"Subtitles Embedded"** tag.

### 5.2 Bilingual Social Kit Display
Per-clip, tampilkan scrollable social kit box:
- **Thumbnail Layout Idea** (`thumbnail_layout`).
- **[ID VERSION]**: Titles (`titles_id`), Caption (`description_id`), Hashtags biru (`hashtags_id`), Best Time to Post (`best_time_to_post_id`), Backsound (`backsound_id`).
- **[EN VERSION]**: Titles (`titles_en`), Caption (`description_en`), Hashtags biru (`hashtags_en`), Best Time to Post (`best_time_to_post_en`), Backsound (`backsound_en`).

### 5.3 Aksi per Clip
- **"Edit Subtitles"** (`Pencil`) → membuka **ClipEditModal** (lihat Section 6).
- **"Download"** (`Download`) → Direct blob download `.mp4` dengan filename format `${cleanName}_${jobId.slice(0,6)}.mp4`. Fallback: buka video di tab baru.
- **"Share"** (`Share2`) → `navigator.share` native mobile/desktop sharing.
- **"Open in New Tab"** (`ExternalLink`) → buka video stream URL di tab baru.

---

## 6. Per-Clip Subtitle Editor Modal (ClipEditModal)

**Wajib dipertahankan 100% tanpa perubahan fungsional.**

### 6.1 Word Grid
- Fetch word timestamps via `GET /jobs/{jobId}/clips/{clipIndex}/words`.
- Grid editable per kata (2-5 kolom responsif, scrollable).
- Setiap word card: timestamp label (`start` - `end`) + text input editable.
- **Search** — input pencarian yang highlight kata matching (amber).
- **Change Tracking** — kata yang dimodifikasi di-highlight kuning.
- **Reset** — tombol `RotateCcw` untuk revert semua perubahan ke transkrip asli.
- **Word count badge**.

### 6.2 AI Auto-Correction (2-Step Accordion)
1. **Step 1: Prompt Generator** — readonly `<textarea>` berisi prompt terstruktur + tombol "Copy".
2. **Step 2: Paste AI Result** — editable `<textarea>` + tombol "Apply Changes" yang memvalidasi dan menerapkan koreksi.

### 6.3 Per-Clip Output Override
- **Output Style Selector** (4 mode).
- **Subtitle Preset Bar** (3 preset).
- **Font Selector** (9 font).

### 6.4 Footer
- Tombol **"Cancel"**.
- Tombol **"Save & Rerender"** → `POST /jobs/{jobId}/clips/{clipIndex}/rerender`.

---

## 7. API Layer (Tidak Ada Perubahan)

Semua 20 API endpoint dan mekanisme di `api.ts` dipertahankan tanpa modifikasi:
- Dynamic Base URL resolution (env → production fallback → localhost).
- Dual token storage keys (`AUTO_CLIPPER_WEB_TOKEN` + legacy `ac_web_token`).
- Event-driven auth (`ac_auth_changed`, `ac_unauthorized`).
- 404 fallback (`/endpoint` → `/api/endpoint`).
- Custom `ApiError` class.

---

## 8. Type Definitions (Tidak Ada Perubahan)

Semua type/interface di `web/src/types/` dipertahankan tanpa modifikasi:
- `CanvasConfig` + `DEFAULT_CANVAS_CONFIG`
- `SubtitleConfig` + `DEFAULT_SUBTITLE_CONFIG`
- `SubtitlePresetKey` + `SUBTITLE_PRESETS`
- `JobStatus`, `ClipSocialKit`, `Clip`, `JobMetadata`, `JobResponse`, `CreateJobPayload`

---

## 9. Technical Implementation Notes

### 9.1 Yang Dihapus (Hanya Mekanisme Wizard)
- State machine `currentStep: WizardStep` (1|2|3|4) di `App.tsx`.
- `currentView: "wizard" | "history"` toggle — tidak perlu lagi karena sudah unified.
- `STORAGE_STEP_KEY` (`ac_wizard_current_step`) localStorage key.
- Step navigation bar (`<nav>` 4-step stepper UI).
- Automatic step synchronization based on job status (digantikan oleh job card status-based actions).

### 9.2 Yang Dipertahankan
- `useJobPolling` hook — tetap handle satu active job; job lain direpresentasikan via HistoryList periodic refetch.
- `ac_active_job_id` localStorage key.
- `ac_draft_step_input` localStorage key + async cleanup.
- `resetKey` counter pattern untuk force re-mount.
- Semua komponen: `AuthGate`, `OutputStyleSelector`, `SubtitlePresetBar`, `FontSelector`, `ClipEditModal`.

### 9.3 Komponen Baru yang Diperlukan
- **`PromptJsonModal`** — menggabungkan fungsionalitas `StepPrompt` + `StepPaste` dalam satu modal.
- **`ResultsModal`** — menampilkan clips grid + social kit + actions (refactored dari `StepResult`).
- **`JobCard`** — komponen card untuk setiap job di history list.

### 9.4 Komponen yang Di-retire (Kode Dihapus)
- `StepInput.tsx` → fungsionalitasnya pindah ke Hero Input component baru.
- `StepPrompt.tsx` → fungsionalitasnya pindah ke `PromptJsonModal`.
- `StepPaste.tsx` → fungsionalitasnya pindah ke `PromptJsonModal`.
- `StepResult.tsx` → fungsionalitasnya pindah ke `ResultsModal` + `JobCard`.

---

## 10. Feature Parity Verification Matrix

| # | Fitur | Lokasi di Dashboard Baru | Status |
|---|-------|--------------------------|--------|
| 1 | Authentication Wall (AuthGate) | Tetap sebagai wrapper `<AuthGate>` | ✅ Retained |
| 2 | Backend Health Indicator | Header pill | ✅ Retained |
| 3 | Wizard → Dashboard | **Perubahan yang disengaja** | 🔄 Changed |
| 4 | Job State Auto-Sync | Job card status-based actions | ✅ Adapted |
| 5 | Draft State Persistence | Hero Input `ac_draft_step_input` | ✅ Retained |
| 6 | Google Drive File Browser | Hero Input → Drive button → Modal | ✅ Retained |
| 7 | Multi-Domain URL Support | Hero Input (YouTube, TikTok, IG, X) | ✅ Retained |
| 8 | Output Style Selector (4 modes) | Hero Input Quick Config + Rerender + ClipEdit | ✅ Retained |
| 9 | Subtitle Presets (3 presets) | Hero Input Quick Config + Rerender + ClipEdit | ✅ Retained |
| 10 | Custom Font Override (9 fonts) | Hero Input Quick Config + Rerender + ClipEdit | ✅ Retained |
| 11 | Advanced Settings (7 sub-fitur) | Hero Input → Advanced accordion | ✅ Retained |
| 12 | Watermark + Live Preview | Hero Input → Advanced accordion | ✅ Retained |
| 13 | Canvas Blur Customization | Hero Input → Advanced accordion | ✅ Retained |
| 14 | AI Prompt Display | PromptJsonModal → Prompt section | ✅ Retained |
| 15 | Quick Launch LLM Buttons | PromptJsonModal → Gemini/ChatGPT/Claude | ✅ Retained |
| 16 | JSON Sanitizer & Validator | PromptJsonModal → JSON section | ✅ Retained |
| 17 | Interactive JSON Example | PromptJsonModal → Collapsible example | ✅ Retained |
| 18 | Live Processing Timer | Job card → elapsed MM:SS | ✅ Retained |
| 19 | Result Video Players | ResultsModal → `<video>` per clip | ✅ Retained |
| 20 | Bilingual Social Kit | ResultsModal → Social Kit box | ✅ Retained |
| 21 | Direct Blob Download | ResultsModal → Download button | ✅ Retained |
| 22 | Native Web Share | ResultsModal → Share button | ✅ Retained |
| 23 | History List & Deletion | Job List + Delete button (optimistic) | ✅ Retained |
| 24 | Full-Job Rerender Panel | Job card `DONE` → Rerender accordion | ✅ Retained |
| 25 | Full-Job AI Correction Panel | Job card `DONE` → AI Correct accordion | ✅ Retained |
| 26 | Per-Clip Subtitle Editor | ClipEditModal (unchanged) | ✅ Retained |
| 27 | 1.8s Polling Lifecycle | useJobPolling hook (unchanged) | ✅ Retained |
| 28 | API 404 Fallbacks | api.ts (unchanged) | ✅ Retained |
| - | Cancel Processing | Job card → Cancel button | ✅ Retained |
