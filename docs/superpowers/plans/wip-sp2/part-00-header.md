# SP2 Step-by-Step UI for Everyone Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A phone-first, four-step "Buat klip" flow (Video → Siapkan → Pilih momen → Klip) with three destinations (Buat klip, Riwayat, Pengaturan), an honest in-page progress screen fed by a new live `current` stage object from the backend, a guided manual-AI step, and plain-language results, history and settings, so a non-technical person gets from a video link to a downloaded clip without help on phone (Colab) and desktop.

**Architecture:** The backend keeps a per-job live stack of running stages inside `stage_timer` (never written to `timings` or `history.db`) and exposes it as `current` in `GET /jobs/{id}`; canvas background images are uploaded through a new `POST /upload-image` and every job endpoint refuses a protected `background_image_path` (E.14). The frontend replaces the six-menu desktop layout with one responsive shell (bottom navigation under 768 px, slim side navigation above), a single `CreatePage` whose step comes from pure functions over the job state (`src/lib/createFlow.ts`, `src/lib/progress.ts`, `src/lib/aiAnswer.ts`), and plain-language pages for Riwayat and Pengaturan. Platform differences stay behind `platform().caps` (one new cap, `keepOpen`) and one new member, `saveClips()`.

**Tech Stack:** React 19, TypeScript 6, Vite 8, Tailwind 3, react-router-dom 7 (`HashRouter`), i18next, lucide-react, Vitest 5 + jsdom, oxlint; Python 3.11, FastAPI, pytest, yt-dlp.

**Spec:** `docs/superpowers/specs/2026-11-20-sp2-ux-for-everyone-design.md` (binding). Parent: `docs/superpowers/specs/2026-11-12-enhancement-roadmap.md`. SP1 context: `docs/superpowers/specs/2026-11-18-sp1-single-frontend-web-local-design.md`, `tasks/sp1-ledger.md`.

## Global Constraints

Repo and process:
- Branch: `feat/sp2-ux-for-everyone` (SP2 starts at `dc3ba66`). Do not switch branches, push, open a PR or merge (owner's call).
- Every commit message ends with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Python: never `python` from PATH (Microsoft Store stub). Test command (PowerShell): `C:\Users\dhima\projects\ac-venv\Scripts\python.exe -m pytest backend/tests -q -p no:cacheprovider`. Git Bash form: `/c/Users/dhima/projects/ac-venv/Scripts/python.exe -m pytest backend/tests -q -p no:cacheprovider`. Baseline on this branch: **805 passed, 12 skipped**. Every task ends with all tests passing (baseline + the task's new tests).
- Frontend checks, run from the repo root **with an uppercase drive letter** (`C:\Users\dhima\projects\auto-clipper`; in Git Bash `cd 'C:/Users/dhima/projects/auto-clipper'`), because Vitest loads twice from `c:\...` and fails "Cannot read properties of undefined (reading 'config')": `npm run build`, `npm run build:cloud`, `npx vitest run` (baseline **89 passing**), `npx oxlint src` (0 errors; warnings allowed).
- No Rust toolchain: `npm run tauri build` cannot run here. Desktop is verified by Vitest with mocked plugins, the `PR Check` workflow and the owner's manual checklist.
- Seeing the UI without Tauri: `npm run build`, then `C:\Users\dhima\projects\ac-venv\Scripts\python.exe -m backend.main --web` (serves `dist/`, opens `http://127.0.0.1:<port>/#t=<token>`), or `npm run dev` with a dev backend (`AUTO_CLIPPER_DEV_TOKEN=dev-token`).
- After each task, append a 3–6 line entry (what changed, test counts, what is left) under the heading `## 2026-11-20 · SP2` at the end of `tasks/PROGRESS-LOG.md` (Task 1 adds the heading once), and update `tasks/sp2-ledger.md` (`Task N: complete (commits <base>..<head>, review clean)` or `Ruling: <what> — <why> — <cost if wrong>`). Both go in that task's commit. Work per task as `tasks/HANDOFF-AI.md` section 4 says (BASE, TDD, checks, commit, review with `tasks/sp1-reviewer-instructions.md`, ledger).
- If the owner says the session quota is near 80 %: stop, commit `wip(sp2): ...`, write a PROGRESS-LOG entry with the position and next step.

Backend invariants (`.agents/AGENTS.md` E, A, B):
- No `print()` to stdout in backend modules (A.2). Errors via `log_error(context, err)` (B.1). Never log cookies or API keys (E.13, E.15).
- Every endpoint that reads, writes or serves a file by a path from the request calls `path_guard.is_protected()` first and answers `path_guard.denied()` (403 `Access denied`); upload names go through `path_guard.safe_upload_name()` (E.14).
- All job threads start through `_start_job()` (E.10). Do not change what the pipeline does; SP2 only adds live stage data (spec 4.4) and the canvas image upload (spec 4.7).
- Spec 4.4, verbatim: "status job (`GET /jobs/{id}`) ditambah objek `current` = `{stage, started_at, device?, clip?, clips_total?, percent?}`. Diisi saat tahap dimulai oleh `stage_timer` (SP0), dikosongkan saat tahap selesai; `device` mengikuti nilai yang sudah dicatat (`whisper_device`, `encoder`, `tracking_engine_used`); `percent` hanya untuk unduhan bila yt-dlp melaporkan. Tidak ada perubahan pada `timings`." (This plan adds one field, `elapsed_seconds`; see Spec gap 2.)

Frontend invariants (`.agents/AGENTS.md` F):
- All UI text in `src/locales/id.json` **and** `src/locales/en.json`; new keys added with `node scripts/add-locale-keys.mjs` (stdin `{"id": {...}, "en": {...}}`); `src/locales/locales.test.ts` keeps id/en keys equal (F.1, F.8).
- Components check `platform().caps`, never `platform().kind`; the only `kind` check is the gate choice in `App.tsx` (F.6). `@tauri-apps/*` only under `src/platform/desktop/`.
- Every backend call builds its URL from `API_URL` (`src/platform/backendUrl.ts`, P13 from SP1).
- Frontend-made error cards only through `localErrorInfo()` (F.7); all failures render through `ErrorCard` with per-platform actions; frontend validation (unsupported link, malformed AI answer) shows under the field, not as a card (spec 5).
- Icons from `lucide-react` (F.5), used only where they make the meaning clearer (spec 4.6).

Copy rules (spec 4.6, verbatim where quoted):
- "Bahasa Indonesia sehari-hari plus bahasa Inggris"; "Kalimat pendek; tombol berupa kata kerja"; "Tanpa istilah teknis di layar utama (contoh terlarang: transkripsi, render, encoder, JSON, sidecar, token); istilah teknis hanya di "Detail teknis""; "Tanpa emoji dekoratif, tanpa basa-basi, tanpa klaim yang tidak bisa dibuktikan"; "Setiap pesan masalah menjawab apa, kenapa, harus apa".
- Banned words checked by `src/locales/plainWords.test.ts` (Task 4) in the main-screen namespaces `nav`, `create`, `progress`, `moment`, `result`, `projects`, `banner`, `toast` and the keys `timing.stage_*`: `transkripsi`, `transcription`, `render`, `encoder`, `json`, `sidecar`, `token`, `prompt`, `backend`, `ffmpeg`, `nvenc`, `cuda`, `whisper` (case-insensitive substrings), no emoji, no em dash (`—`).
- Exact texts from the spec that must appear (id): `Tempel link YouTube, TikTok, atau Instagram`; `Pilih file video`; `Pilih dari Google Drive`; `Bentuk klip`; `Vertikal untuk TikTok/Reels/Shorts`; `Persegi`; `Lebar`; `Atur tampilan klip`; `Mulai`; `Salin perintah`; `Teks ini berisi transkrip video dan petunjuk untuk AI.`; `Buka ChatGPT`; `Buka Gemini`; `Tempel perintah tadi, lalu kirim.`; `Tempel jawaban AI di sini`; `Buat klip`; `Jawaban belum lengkap. Salin seluruh jawaban AI, termasuk tanda kurung di awal dan akhir.`; `Subtitle dibuat dengan prosesor, bukan GPU. Untuk video panjang bisa jauh lebih lama.`; `Jangan tutup aplikasi sampai selesai.`; `Jangan tutup jendela Auto Clipper Web.`; `Halaman ini boleh ditutup. Proses tetap jalan selama Colab menyala; lihat hasilnya di Riwayat.`; `Menunggu giliran. Urutan ke-{{n}}.`; `Batalkan`; `Unduh`; `Bagikan`; `Unduh semua`; `Periksa lagi`; `Hubungkan ulang`; status words `Selesai`, `Gagal`, `Menunggu jawaban AI`, `Sedang diproses`, `Menunggu giliran`; buttons `Lihat klip`, `Tempel jawaban AI`, `Lanjutkan`, `Coba lagi`; menu names `Buat klip`, `Riwayat`, `Pengaturan`; settings sections `Umum`, `YouTube`, `Lanjutan`, `Bantuan`.

Visual rules (spec 4.6) and the design read (antislop R-37, from the owner's decisions in spec section 3):
- "Latar netral, satu warna aksen, mode terang dan gelap." "Ukuran huruf minimal 16 px untuk teks isi di HP; area sentuh minimal 44 × 44 px." "Kontras memenuhi WCAG AA"; "semua fungsi bisa dipakai dengan keyboard dan fokus terlihat." "Tanpa gradien dekoratif, efek kilau, atau kartu bertumpuk; ikon hanya bila memperjelas."
- Design read: "Reading this as: a step-by-step tool for non-technical creators on a phone, in a calm neutral style with one blue accent, dial ENERGY 1 / RHYTHM 1 / MOTION 1." Identity motif: the numbered step indicator. One focal point per screen: the single primary button. Motion: hover/focus/press states and the progress spinner only; no endless pulses, no fade-up stacks.
- Colour tokens (Task 4, all pairs checked with the antislop-human contrast script, results in Task 4):

| Token | Light | Dark |
|---|---|---|
| `--bg-primary` (page) | `#F6F6F4` | `#141517` |
| `--bg-secondary` / `--bg-elevated` (cards, inputs) | `#FFFFFF` | `#1C1D20` |
| `--bg-surface` (wells, selected rows) | `#ECECE9` | `#26272B` |
| `--text-primary` | `#1C1D1F` | `#ECECEA` |
| `--text-secondary` / `--text-tertiary` | `#55585E` | `#A6A8AD` |
| `--border` (decorative dividers) | `#DCDDD9` | `#2E3034` |
| `--border-active` (input and control edges, ≥ 3:1) | `#85888E` | `#7A7D84` |
| `--accent` | `#1F5FCC` | `#7EA8FF` |
| `--accent-hover` | `#194FAA` | `#A3C1FF` |
| `--on-accent` (text on accent) | `#FFFFFF` | `#0D1B33` |
| `--accent-muted` (selected backgrounds) | `#E8EEFB` | `#1E2A40` |
| `--error` | `#B42318` | `#FF8A80` |
| `--warning` | `#9A5B00` | `#F2B866` |
| `--success` | `#1E7A3E` | `#6FD39A` |

- Type scale (Task 4): `.text-body` 16 px, `.text-label` 14 px medium, `.text-caption` 14 px, `.text-card-title` 18 px semibold, `.text-section-title` 20 px semibold, `.text-page-title` 24 px bold; inputs 16 px (stops iOS zoom). Typeface stays Outfit (already loaded in `index.html`; question 2).
- Breakpoint: phone layout below 768 px (`md`), slim side navigation from 768 px, result grid 1 / 2 / 3 columns at `<768` / `md` / `xl`.

Platform texts (spec 4.3), chosen by the new cap `keepOpen`: desktop `"app"` → `Jangan tutup aplikasi sampai selesai.`; local web `"window"` → `Jangan tutup jendela Auto Clipper Web.`; cloud `"none"` → `Halaman ini boleh ditutup. Proses tetap jalan selama Colab menyala; lihat hasilnya di Riwayat.`

Routes (spec 4.1): `/` Buat klip, `/riwayat`, `/riwayat/:id`, `/pengaturan`; redirects `/manual-ai` → `/`, `/downloader` → `/pengaturan#pengunduh`, `/history` → `/riwayat`, `/settings` → `/pengaturan`, `/help` → `/pengaturan#bantuan`. Router stays `HashRouter`.

## Questions for the owner (defaults chosen; the owner said "ikuti rekomendasi, yang penting UX-nya jelas untuk orang awam", so every default counts as approved)

1. **Accent colour** (spec 9). **Default:** the neutral blue in the token table (`#1F5FCC` light, `#7EA8FF` dark), AA in both modes. Changing it is two lines in `src/index.css` plus a rerun of the contrast test.
2. **Typeface.** **Default:** keep Outfit (already shipped, readable, gives the app its own voice). No new font download.
3. **Words for "render".** The spec bans "render" on the main screen but also names "Merender klip" and a "Render ulang" menu item. **Default:** plain words: progress and Detail waktu say `Membuat klip` (`Membuat klip 3 dari 10`), menus say `Buat ulang semua klip`.
4. **Per-clip menu.** "Ubah subtitle" and "Render ulang" open the same editor (`ClipEditModal` changes words and layout, then makes the clip again). **Default:** one item `Ubah subtitle atau tampilan` plus `Buka folder`; the unused `ClipRerenderModal` is deleted.
5. **Quality check button.** "Cek kualitas tersedia" probes YouTube before starting. **Default:** removed from the main flow; `Kualitas unduhan` stays a simple choice under "Atur tampilan klip" (`Otomatis (sampai 1080p)` first). Download problems still show their error card in step 2.
6. **Version.** **Default:** SP1 and SP2 ship together as `1.19.0` (no bump); SP2 is added to the `## [1.19.0] - belum dirilis` section of `CHANGELOG.md`.
7. **antislop mode.** **Default:** "during" (rules applied while each UI task is written, each UI task ends with its own checks) plus one recorded audit with the Delivery Gate in Task 15.

## Spec gaps and contradictions found in the code

1. **"render" is banned but named.** Spec 4.6 bans "render"; spec 4.3 uses "Merender klip" (= `timing.stage_render`) and 4.5 "Render ulang". Resolved by question 3: `timing.stage_render` becomes `Membuat klip` (it is shown on the main progress screen), menus use "Buat ulang".
2. **`started_at` alone gives a wrong timer.** The phone and the Colab server have different clocks, so `Date.now() - started_at` can be off by minutes. `current` also carries `elapsed_seconds` (server monotonic clock); the frontend counts up from it between polls. `started_at` stays as the spec says.
3. **`clips_total` and `percent` have no source.** `set_context(clip=…)` tags timing records, so putting `clips_total` there would change `timings` (forbidden). yt-dlp progress hooks are installed only when `is_cancelled` is given. The plan adds `stage_timer.report(**fields)`, which writes only to the live stack, and always installs a yt-dlp hook that reports `percent`. yt-dlp downloads video and audio separately, so the percentage restarts once for the audio part; accepted (it is real progress).
4. **Manual-resume timings are stale while running.** `_run_manual_resume_job` puts the history metadata (with the old `timings` list) in `job["metadata"]` while new stages go to a fresh `job["timings"]`, so `GET /jobs/{id}` shows no finished step-4 stages until the end. Task 2 shares the list (`metadata["timings"] = job["timings"]`), as `_with_timings` already does for new jobs; the final saved value is unchanged.
5. **Project title is required and must be unique** (`create_job` raises "Judul Proyek wajib diisi.", `check_title_uniqueness`), but the 4-step flow has no title field. The app makes one (`YouTube 2026-11-20 14.05.09`, or the file name plus date) and offers an optional `Nama proyek` under "Atur tampilan klip".
6. **Per-platform "may close" text needs the platform** but F.6 forbids `kind` checks in components. New cap `keepOpen: "app" | "window" | "none"` (what must stay open for the job to continue). The same cap picks the disconnected-banner text.
7. **AWAITING_MANUAL jumps to History today** (`window.location.hash = "#/history"` in `useClipJobs`). The flow keeps the user on step 3 instead; the prompt comes from `metadata.manual_prompt` in the job status.
8. **"Unduh semua" on desktop** would open one save dialog per clip. New platform member `saveClips(clips)`: desktop asks for a folder once and copies through `/save_file`; browsers download one after another (some browsers ask once to allow several downloads).
9. **Undefined Tailwind classes** are used today (`bg-input-bg`, `text-on-accent`, `bg-scrim`, `text-danger`, `text-text-muted`, `bg-bg-tertiary`, `bg-brand-gradient`), so those elements have no colour. Task 4 defines the tokens; the primary button's `text-text-primary` on the accent fails contrast in light mode and becomes `text-on-accent`.
10. **`/riwayat/:id` has no single-project endpoint** besides `GET /jobs/{id}`, which already falls back to history and adds signed video links. The project page uses it.
11. **"Dibatalkan" is not in the spec's status list.** Added as a sixth status with primary button `Coba lagi`.
12. **API-key mode has no switch.** The app has providers and keys, but nothing says "use the API key instead of the manual steps". New setting `ac_ai_mode` (`manual` default, `auto`) under Pengaturan → Lanjutan, shown only with `caps.apiKeys`.
13. **"Mode pelacakan wajah" appears twice** (4.2 under "Atur tampilan klip", 4.5 under Lanjutan). Split: "Atur tampilan klip" has `Ikuti wajah` / `Tetap di tengah` (`tracking_mode`); Lanjutan has the engine (`haar` / `mediapipe`, `ac_face_engine`).
14. **AI Koreksi has no place in 4.5.** It exists for API-key users (`canRerunAI`). Kept in the project "⋯" menu as `Pilih ulang momen dengan AI` when `caps.apiKeys`, so no feature disappears.
15. **Supported links.** The backend accepts YouTube, TikTok, Instagram and X/Twitter (`SUPPORTED_URL_RE`); the spec names the first three. The frontend check mirrors the backend list; the placeholder names the three from the spec.
16. **Canvas image uploads live in the uploads folder.** On Colab that is the work disk, so after a runtime restart a re-render cannot find the image and `crop_utils` silently uses no image (existing behaviour). The image path is therefore not remembered between videos (Task 6).
17. **lucide-react vs antislop R-04.** AGENTS F.5 requires lucide; the repo rule wins. Icons are used only next to a text label where they add meaning (the reason is written in each task).
18. **One job at a time in the UI.** `useClipJobs` follows one `activeJobId`; the old overlay blocked the whole app. With an in-page progress screen the user can move around, so "Buat klip" shows the running job's progress (any origin) instead of step 1, and other pages show a slim "Sedang diproses · Lihat progres" bar.
19. **`html lang="en"` is fixed** in `index.html`; screen readers read Indonesian with English rules. Task 4 sets `document.documentElement.lang` from i18n.

## File Structure

Created:

| File | Responsibility |
|---|---|
| `tasks/sp2-ledger.md` | SP2 task ledger (format of `tasks/sp1-ledger.md`) |
| `tasks/sp2-audit.md` | Task 15 audit record (antislop Delivery Gate, contrast, keyboard, phone widths) |
| `backend/tests/test_job_current.py` | pytest: `current` in the job status |
| `backend/tests/test_canvas_image.py` | pytest: `POST /upload-image` and the canvas path guard |
| `src/lib/routes.ts` (+ `routes.test.tsx`) | route paths, legacy redirects |
| `src/lib/createFlow.ts` (+ test) | active step, step states, link check, auto title, effective provider |
| `src/lib/clipChoices.ts` (+ test) | remembered "Atur tampilan klip" choices |
| `src/lib/preflight.ts` (+ test) | preflight checks split into notes and blockers |
| `src/lib/progress.ts` (+ test) | live stage parsing, progress rows, device notes |
| `src/lib/aiAnswer.ts` (+ test) | AI answer validation |
| `src/lib/clipboard.ts` | copy text with a fallback for older browsers |
| `src/lib/projectStatus.ts` (+ test) | Riwayat status word and primary action |
| `src/lib/settingsLayout.ts` (+ test) | which Pengaturan rows show per `caps` |
| `src/lib/clipInfo.ts` (+ test) | clip title and duration for the result card |
| `src/styles/contrast.test.ts` | WCAG AA check of the colour tokens in `src/index.css` |
| `src/locales/plainWords.test.ts` | banned words, emoji and em dash in main-screen text |
| `src/hooks/useBackendStatus.tsx` | one `useBackendHealth` for the whole app, shared by context |
| `src/hooks/usePreflight.ts` | `GET /api/preflight` on open and after reconnect |
| `src/hooks/useNow.ts` | a once-per-second clock for running timers |
| `src/hooks/useScrollToHash.ts` | scroll to `#bantuan` etc. inside `HashRouter` |
| `src/components/nav/BottomNav.tsx`, `SideNav.tsx`, `navItems.ts` | the three destinations |
| `src/components/nav/ConnectionStatus.tsx`, `BackendBanner.tsx`, `RunningBar.tsx` | header status, disconnected banner, running-job bar |
| `src/components/create/StepIndicator.tsx` | `1 Video → 2 Siapkan → 3 Pilih momen → 4 Klip` |
| `src/components/create/VideoStep.tsx` (+ test) | step 1 |
| `src/components/create/ClipOptions.tsx` | "Atur tampilan klip" |
| `src/components/create/PreflightNotices.tsx` | preflight notes and blocking card |
| `src/components/create/ProgressPanel.tsx` (+ test) | steps 2 and 4 progress |
| `src/components/create/MomentStep.tsx` (+ test) | step 3 |
| `src/components/ui/OverflowMenu.tsx` (+ test) | the "⋯" menu |
| `src/components/projects/RerenderAllDialog.tsx`, `AiCorrectDialog.tsx` | project actions moved out of the old History page |
| `src/components/settings/AiModeSection.tsx`, `DownloaderPanel.tsx`, `HelpSection.tsx`, `LogViewer.tsx` | Pengaturan → Lanjutan and Bantuan |
| `src/pages/CreatePage.tsx`, `ProjectsPage.tsx`, `ProjectPage.tsx` | the new pages |
| `docs/decisions/014-sp2-live-stage-and-step-ui.md` | ADR |

Modified: `backend/stage_timer.py`, `backend/jobs.py`, `backend/video_utils.py`, `backend/main.py`, `backend/web_mode.py`, `backend/tests/{test_stage_timer,test_web_mode}.py`, `src/App.tsx`, `src/api.ts`, `src/index.css`, `tailwind.config.js`, `src/i18n.ts`, `src/platform/{types,caps,browser}.ts`, `src/platform/desktop/index.ts`, platform tests, `src/hooks/{useClipJobs,useUserSettings,useErrorActions}.ts`, `src/layouts/AppLayout.tsx`, `src/components/{ClipCard,ClipsResult,ErrorCard,JobReport,TimingDetails,SocialKitModal,ClipEditModal}.tsx`, `src/components/ui/{Button,ToggleSwitch,SegmentedControl,ConfirmDialog,InputGroup,Select,CanvasConfigControls}.tsx`, `src/components/settings/{AppearanceSection,OutputSection}.tsx`, `src/pages/SettingsPage.tsx`, `src/locales/{id,en}.json`, docs, `CHANGELOG.md`, `.agents/AGENTS.md`, `tasks/*`.

Deleted: `src/pages/{WorkspacePage,ManualAIEditorPage,ManualDownloaderPage,HistoryPage,HelpPage,LandingPage}.tsx`, `src/components/{GenerateForm,BusyOverlay,ManualResumeModal,ClipRerenderModal}.tsx`, `src/components/sidebar/Sidebar.tsx`.

## Task order

| # | Task | Spec 7 step |
|---|---|---|
| 1 | Backend: live stage stack in `stage_timer` | 1 |
| 2 | Backend: `current` in the job status (clip count, download percent) | 1 |
| 3 | Canvas background image upload through `path_guard` (backend + picker) | 1 |
| 4 | Visual base: colour tokens, type scale, focus, contrast and plain-words tests | 2 |
| 5 | Shell: three destinations, bottom/side navigation, connection status, routes and redirects, `caps.keepOpen` | 2 |
| 6 | Flow logic: active step, link check, auto title, remembered choices | 3 |
| 7 | Preflight notices and blocking card | 3 |
| 8 | Step 1 screen (`CreatePage`, `VideoStep`, `ClipOptions`, `pickVideo()`) | 3 |
| 9 | Progress logic (`src/lib/progress.ts`) | 4 |
| 10 | Progress screen replaces `BusyOverlay` | 4 |
| 11 | Step 3: guided manual AI with answer validation | 5 |
| 12 | Results: `saveClips`, "⋯" menu, result cards, `Unduh semua` | 6 |
| 13 | Riwayat list and project page | 6 |
| 14 | Pengaturan in four sections, downloader and help moved | 7 |
| 15 | antislop audit: copy, UI, phone layout, contrast, keyboard | 8 |
| 16 | Parked SP1 items: port check, tutorial arrow, test comment | 8 |
| 17 | Docs, CHANGELOG, ADR-014, AGENTS.md | 8 |
| 18 | Final verification and the owner's usability test | 8 |

---
