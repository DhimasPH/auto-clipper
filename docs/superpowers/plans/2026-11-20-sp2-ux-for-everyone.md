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
### Task 1: Backend: live stage stack in `stage_timer`

Spec 4.4 (first half). `stage_timer` already sees every stage start and end; it gains an optional per-job `live` dict holding the running stages, a `report()` for live-only facts, and `current_stage()` that turns the top of the stack into the spec's `current` object. Nothing is added to `timings`.

**Files:**
- Modify: `backend/stage_timer.py` (module docstring, `collect_timings`, `stage`; new `DEVICE_FIELDS`, `report`, `current_stage`)
- Test: `backend/tests/test_stage_timer.py` (append)
- Create: `tasks/sp2-ledger.md` (only if the pre-flight scan of `tasks/HANDOFF-AI.md` section 3 has not created it)
- Modify: `tasks/PROGRESS-LOG.md` (add the `## 2026-11-20 · SP2` heading once, then the entry)

**Interfaces:**
- Consumes: nothing new.
- Produces (used by Task 2):
  - `stage_timer.DEVICE_FIELDS: tuple[str, ...] = ("whisper_device", "encoder", "tracking_engine_used")`
  - `collect_timings(timings: list, live: dict | None = None)` (context manager; `live` is owned by the job)
  - `report(**fields) -> None` (`clips_total=<int>` for the run, `percent=<float>` for the running stage)
  - `current_stage(live: dict | None) -> dict | None` returning `{"stage": str, "started_at": float, "elapsed_seconds": float, "device"?: str, "clip"?: int, "clips_total"?: int, "percent"?: float}`

- [ ] **Step 1: Ledger and log heading**

If `tasks/sp2-ledger.md` does not exist yet, create it:

```markdown
# SDD ledger — plan: docs/superpowers/plans/2026-11-20-sp2-ux-for-everyone.md

> Ledger resmi SP2. AI mana pun yang melanjutkan SP2 memperbarui file INI setelah setiap task, fix round, dan keputusan. Cara kerja: `tasks/HANDOFF-AI.md`.

Spec: docs/superpowers/specs/2026-11-20-sp2-ux-for-everyone-design.md
Branch: feat/sp2-ux-for-everyone, start dc3ba66
Owner accepted all plan defaults (2026-11-20: "ikuti rekomendasi, yang penting UX-nya jelas untuk orang awam").

## Pre-flight scan
(one line per finding: `- P<n> [Task, step, level] Ruling: <what> — <why> — <cost if wrong>`)

## Tasks
```

At the very end of `tasks/PROGRESS-LOG.md`, add once:

```markdown

## 2026-11-20 · SP2
```

- [ ] **Step 2: Write the failing tests** (append to `backend/tests/test_stage_timer.py`)

```python
# --- live stage for the job status (SP2 spec 4.4) ---------------------------------------------

def test_current_stage_is_none_without_a_running_stage():
    live = {}
    assert stage_timer.current_stage(live) is None
    assert stage_timer.current_stage(None) is None
    with collect_timings([], live):
        assert stage_timer.current_stage(live) is None


def test_current_stage_shows_the_running_stage_and_clears_when_it_ends():
    live = {}
    with collect_timings([], live):
        before = time.time()
        with stage("download"):
            cur = stage_timer.current_stage(live)
            assert cur["stage"] == "download"
            assert before - 1 <= cur["started_at"] <= time.time() + 1
            assert cur["elapsed_seconds"] >= 0
        assert stage_timer.current_stage(live) is None


def test_nested_stage_shows_the_inner_one_then_the_outer_again():
    live = {}
    with collect_timings([], live):
        with stage("clip", clip=1):
            with stage("render"):
                assert stage_timer.current_stage(live)["stage"] == "render"
            assert stage_timer.current_stage(live)["stage"] == "clip"
        assert stage_timer.current_stage(live) is None


def test_device_comes_from_the_field_the_stage_records():
    live = {}
    with collect_timings([], live):
        with stage("transcribe", whisper_model="small") as rec:
            assert "device" not in stage_timer.current_stage(live)
            rec["whisper_device"] = "cpu"
            assert stage_timer.current_stage(live)["device"] == "cpu"


def test_clip_number_and_total_while_rendering():
    live = {}
    with collect_timings([], live):
        stage_timer.report(clips_total=3)
        stage_timer.set_context(clip=2)
        with stage("render") as rec:
            rec["encoder"] = "libx264"
            cur = stage_timer.current_stage(live)
    assert (cur["clip"], cur["clips_total"], cur["device"]) == (2, 3, "libx264")


def test_percent_is_rounded_and_clamped():
    live = {}
    with collect_timings([], live):
        with stage("download"):
            stage_timer.report(percent=42.1234)
            assert stage_timer.current_stage(live)["percent"] == 42.1
            stage_timer.report(percent=180)
            assert stage_timer.current_stage(live)["percent"] == 100.0


def test_live_data_never_reaches_timings():
    timings, live = [], {}
    with collect_timings(timings, live):
        stage_timer.report(clips_total=4)
        stage_timer.set_context(clip=1)
        with stage("download"):
            stage_timer.report(percent=50)
    assert set(timings[0]) == {"stage", "clip", "seconds", "rss_mb_peak", "ok"}


def test_report_without_a_live_dict_is_harmless():
    stage_timer.report(percent=10, clips_total=2)
    timings = []
    with collect_timings(timings):
        with stage("download"):
            stage_timer.report(percent=10)
    assert "percent" not in timings[0]


def test_a_failing_stage_still_leaves_the_live_stack():
    live = {}
    with collect_timings([], live):
        with pytest.raises(RuntimeError):
            with stage("render"):
                raise RuntimeError("ffmpeg died")
        assert stage_timer.current_stage(live) is None


def test_each_collector_block_has_its_own_live_dict():
    outer, inner = {}, {}
    with collect_timings([], outer):
        with collect_timings([], inner):
            with stage("render"):
                assert stage_timer.current_stage(outer) is None
                assert stage_timer.current_stage(inner)["stage"] == "render"
```

- [ ] **Step 3: Run them to verify they fail**

Run: `C:\Users\dhima\projects\ac-venv\Scripts\python.exe -m pytest backend/tests/test_stage_timer.py -q -p no:cacheprovider`
Expected: FAIL with `AttributeError: module 'backend.stage_timer' has no attribute 'current_stage'` and `TypeError: collect_timings() takes 1 positional argument but 2 were given`.

- [ ] **Step 4: Implement**

In `backend/stage_timer.py`, add to the end of the module docstring (before the closing `"""`):

```python
While a job runs, ``collect_timings(timings, live)`` also keeps the running stages
on a stack in ``live`` (a dict owned by the job). ``current_stage(live)`` turns the
innermost one into the ``current`` object of the job status (SP2 spec 4.4), and
``report()`` adds live-only facts (``percent``, ``clips_total``). None of this is
ever written to ``timings``.
```

Below `_local = threading.local()` add:

```python
# Fields that say which device really did the work (see jobs._finalize_job).
DEVICE_FIELDS = ("whisper_device", "encoder", "tracking_engine_used")
```

Replace `collect_timings` with:

```python
@contextmanager
def collect_timings(timings: list, live: dict = None):
    """Send every ``stage`` finished on this thread, inside the block, to ``timings``.

    ``live`` (optional, owned by the job) holds the stages that are running now,
    for the job status. It is never copied into ``timings``.
    """
    previous = getattr(_local, "timings", None)
    previous_fields = getattr(_local, "fields", {})
    previous_live = getattr(_local, "live", None)
    _local.timings = timings
    _local.fields = {}
    _local.live = live
    try:
        yield timings
    finally:
        _local.timings = previous
        _local.fields = previous_fields
        _local.live = previous_live
```

In `stage()`, replace the lines from `log_app(f"[timing] start stage=...` down to `yield rec` with:

```python
    log_app(f"[timing] start stage={name}" + "".join(f" {k}={v}" for k, v in merged.items()))
    sampler = _PeakSampler()
    sampler.start()
    started = time.monotonic()
    live = getattr(_local, "live", None)
    entry = None
    if live is not None:
        # Replaced, never mutated in place: the status request reads it from another thread.
        entry = {"rec": rec, "started": started, "started_at": time.time()}
        live["stack"] = [*(live.get("stack") or []), entry]
    ok = True
    try:
        yield rec
```

and at the start of the `finally:` block of `stage()` add:

```python
        if entry is not None:
            live["stack"] = [e for e in (live.get("stack") or []) if e is not entry]
```

Add after `stage()`:

```python
def report(**fields):
    """Live facts for the job status only: ``clips_total`` for the run, ``percent`` for the running stage."""
    live = getattr(_local, "live", None)
    if live is None:
        return
    if "clips_total" in fields:
        live["clips_total"] = fields.pop("clips_total")
    stack = live.get("stack") or []
    if stack and fields:
        stack[-1].update(fields)


def _is_int(value) -> bool:
    return isinstance(value, int) and not isinstance(value, bool)


def current_stage(live) -> dict:
    """The innermost running stage as the ``current`` object of the job status, or None.

    ``{stage, started_at, elapsed_seconds, device?, clip?, clips_total?, percent?}``.
    ``elapsed_seconds`` comes from this server's clock, so a phone with another time still
    shows the right running time.
    """
    if not isinstance(live, dict):
        return None
    stack = live.get("stack") or []
    if not stack:
        return None
    top = stack[-1]
    rec = top["rec"]
    out = {
        "stage": rec.get("stage"),
        "started_at": round(top["started_at"], 3),
        "elapsed_seconds": round(max(0.0, time.monotonic() - top["started"]), 1),
    }
    for field in DEVICE_FIELDS:
        value = rec.get(field)
        if isinstance(value, str) and value:
            out["device"] = value
            break
    if _is_int(rec.get("clip")):
        out["clip"] = rec["clip"]
        total = live.get("clips_total")
        if _is_int(total) and total > 0:
            out["clips_total"] = total
    percent = top.get("percent")
    if isinstance(percent, (int, float)) and not isinstance(percent, bool):
        out["percent"] = round(min(100.0, max(0.0, float(percent))), 1)
    return out
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `C:\Users\dhima\projects\ac-venv\Scripts\python.exe -m pytest backend/tests/test_stage_timer.py backend/tests/test_pipeline_timings.py -q -p no:cacheprovider`
Expected: all PASS.
Then the whole suite: `C:\Users\dhima\projects\ac-venv\Scripts\python.exe -m pytest backend/tests -q -p no:cacheprovider` → 815 passed, 12 skipped (805 + 10).

- [ ] **Step 6: Log and commit**

Append under `## 2026-11-20 · SP2` in `tasks/PROGRESS-LOG.md`:

```markdown
- Task 1 (`stage_timer` tahap berjalan): `collect_timings(timings, live)` menyimpan tahap yang sedang berjalan di tumpukan milik job; `current_stage(live)` membentuk objek `current` (spec 4.4) dengan `elapsed_seconds` dari jam server; `report()` untuk `percent` dan `clips_total`, tidak pernah masuk `timings`. pytest: 815 lulus, 12 dilewati (+10).
```

Add to `tasks/sp2-ledger.md` under `## Tasks`: `Task 1: complete (commits <base>..<head>, review clean)` after the review.

```bash
git add backend/stage_timer.py backend/tests/test_stage_timer.py tasks/PROGRESS-LOG.md tasks/sp2-ledger.md
git commit -m "feat(sp2): live stage stack in stage_timer for the job status

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Backend: `current` in the job status (clip count, download percent)

Spec 4.4 (second half). Each job run gets its own `live` dict; `GET /jobs/{id}` returns `current`; render loops report `clips_total`; downloads report `percent`; the manual-resume run shares its timings list so finished step-4 stages show while it runs (Spec gap 4).

**Files:**
- Modify: `backend/jobs.py` (imports; `_DEVICE_FIELDS`; `_with_timings`; new `live_stage`; `report(clips_total=…)` before the clip loops of `_render_video_clips`, `_run_manual_job`, `_run_rerender_job`, `_run_rerun_ai_job`; `_run_manual_resume_job`)
- Modify: `backend/video_utils.py` (import; new `download_percent`; `_download_youtube_video` hook)
- Modify: `backend/main.py` (`api_get_job`)
- Test: `backend/tests/test_job_current.py` (create)

**Interfaces:**
- Consumes: `stage_timer.DEVICE_FIELDS`, `collect_timings(timings, live)`, `report(**fields)`, `current_stage(live)` (Task 1).
- Produces:
  - `jobs.live_stage(job_id: str) -> dict | None`
  - `video_utils.download_percent(d: dict) -> float | None`
  - `GET /jobs/{id}` JSON gains `"current": null | {"stage", "started_at", "elapsed_seconds", "device"?, "clip"?, "clips_total"?, "percent"?}` (consumed by Tasks 9–10 as `LiveStage`).

- [ ] **Step 1: Write the failing tests** (`backend/tests/test_job_current.py`)

```python
"""The job status names the stage that is running now (SP2 spec 4.4), without changing timings."""
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from backend import jobs, main, stage_timer
from backend.stage_timer import collect_timings, stage

client = TestClient(main.app)


def _job(job_id, src, tmp_path, **extra):
    job = {
        "id": job_id, "url": f"local:{src}", "provider": "openai", "api_key": "k", "mode": "ai",
        "aspect_ratio": "9:16", "title": f"Current {job_id}", "caption_style": "standard",
        "burn_subs": False, "output_dir": str(tmp_path), "quality": "best", "whisper_model": "small",
        "max_clips": 0, "status": "PENDING", "progress": "", "cancelled": False, "clips": [],
        "failed": 0, "error": None,
    }
    job.update(extra)
    return job


def test_live_stage_is_none_for_unknown_and_finished_jobs():
    assert jobs.live_stage("no-such-job") is None
    jobs.active_jobs["test-current-done"] = {"id": "test-current-done", "status": "DONE", "_live": {}}
    try:
        assert jobs.live_stage("test-current-done") is None
    finally:
        jobs.active_jobs.pop("test-current-done", None)


def test_run_job_reports_each_running_stage_with_its_device(tmp_path, monkeypatch):
    src = tmp_path / "source.mp4"
    src.write_bytes(b"x")
    job_id = "test-current-run"
    jobs.active_jobs[job_id] = _job(job_id, src, tmp_path, provider="manual_ai", api_key="",
                                    metadata={"title": "Current run"})
    seen = {}

    def fake_extract_audio(video, audio, register_proc=None):
        with stage("extract_audio"):
            seen["extract_audio"] = jobs.live_stage(job_id)
        return audio

    def fake_transcribe(audio, karaoke=False, is_cancelled=None, model_size="small"):
        with stage("transcribe", whisper_model=model_size) as rec:
            rec["whisper_device"] = "cpu"
            seen["transcribe"] = jobs.live_stage(job_id)
        return {"segments": [{"start": 0.0, "end": 1.0, "text": "halo"}]}

    monkeypatch.setattr("backend.ai_utils.extract_audio", fake_extract_audio)
    monkeypatch.setattr("backend.ai_utils.transcribe_with_faster_whisper", fake_transcribe)
    monkeypatch.setattr("backend.video_utils.get_video_duration", lambda p: 60.0)
    monkeypatch.setattr("backend.db.save_history", lambda *a, **k: None)
    try:
        jobs._run_job(job_id)
        assert jobs.active_jobs[job_id]["status"] == "AWAITING_MANUAL"
        assert seen["extract_audio"]["stage"] == "extract_audio"
        assert seen["transcribe"]["stage"] == "transcribe"
        assert seen["transcribe"]["device"] == "cpu"
        assert jobs.live_stage(job_id) is None
    finally:
        jobs.active_jobs.pop(job_id, None)


def test_render_reports_clip_number_of_total_without_touching_timings(tmp_path, monkeypatch):
    src = tmp_path / "source.mp4"
    src.write_bytes(b"x")
    job_id = "test-current-render"
    seg = {"start_time": "00:00:01", "end_time": "00:00:11", "description": "s"}
    metadata = {"highlights": [dict(seg), dict(seg)], "title": "Current render"}
    job = _job(job_id, src, tmp_path, metadata=metadata)
    live = job["_live"] = {}
    jobs.active_jobs[job_id] = job
    seen = []

    def fake_crop(*a, **k):
        with stage("render") as rec:
            rec["encoder"] = "libx264"
            seen.append(jobs.live_stage(job_id))
        return "clip.mp4"

    monkeypatch.setattr(jobs, "crop_to_vertical", fake_crop)
    monkeypatch.setattr("backend.db.save_history", lambda *a, **k: None)
    timings = []
    try:
        with collect_timings(timings, live):
            jobs._render_video_clips(job, job_id, metadata, str(src), None, lambda: False, 0)
        assert [(c["clip"], c["clips_total"], c["device"]) for c in seen] == [(1, 2, "libx264"), (2, 2, "libx264")]
        assert all("clips_total" not in t and "percent" not in t for t in timings)
    finally:
        jobs.active_jobs.pop(job_id, None)


def test_manual_resume_shows_finished_stages_while_it_runs(tmp_path, monkeypatch):
    src = tmp_path / "source.mp4"
    src.write_bytes(b"x")
    history = {
        "id": "test-current-manual", "url": f"local:{src}", "status": "AWAITING_MANUAL", "result_clips": [],
        "metadata": {
            "source_video": str(src), "subtitle_path": str(src), "title": "Current manual",
            "aspect_ratio": "9:16", "burn_subs": False, "output_dir": str(tmp_path),
            "timings": [{"stage": "transcribe", "seconds": 3.0, "rss_mb_peak": 1.0, "ok": True}],
        },
    }
    monkeypatch.setattr("backend.db.get_history", lambda j: history)
    monkeypatch.setattr("backend.db.save_history", lambda *a, **k: None)
    monkeypatch.setattr("threading.Thread.start", lambda self: None)
    shared = []

    def fake_crop(*a, **k):
        job = jobs.active_jobs["test-current-manual"]
        shared.append(job["metadata"]["timings"] is job["timings"])
        return "clip.mp4"

    monkeypatch.setattr(jobs, "crop_to_vertical", fake_crop)
    payload = '[{"start_time": "00:00:00", "end_time": "00:00:04", "description": "x"}]'
    job_id = jobs.resume_manual_job("test-current-manual", payload)
    try:
        from backend.ai_utils import _parse_highlights
        jobs._run_manual_resume_job(job_id, _parse_highlights(payload))
        assert shared == [True]
    finally:
        jobs.active_jobs.pop(job_id, None)


@pytest.mark.parametrize("update, expected", [
    ({"status": "downloading", "downloaded_bytes": 50, "total_bytes": 200}, 25.0),
    ({"status": "downloading", "downloaded_bytes": 30, "total_bytes_estimate": 60}, 50.0),
    ({"status": "downloading", "downloaded_bytes": 90, "total_bytes": 60}, 100.0),
    ({"status": "downloading", "downloaded_bytes": 10}, None),
    ({"status": "downloading", "downloaded_bytes": 10, "total_bytes": 0}, None),
    ({"status": "finished", "downloaded_bytes": 10, "total_bytes": 10}, None),
    ("not a dict", None),
])
def test_download_percent(update, expected):
    from backend.video_utils import download_percent
    assert download_percent(update) == expected


@patch("backend.video_utils.yt_dlp.YoutubeDL")
def test_download_reports_percent_while_the_download_stage_runs(mock_ytdl, tmp_path):
    from backend.video_utils import download_youtube_video
    seen, live = [], {}

    def construct(opts):
        ydl = MagicMock()

        def download(urls):
            for hook in opts["progress_hooks"]:
                hook({"status": "downloading", "downloaded_bytes": 50, "total_bytes": 200})
            seen.append(stage_timer.current_stage(live))

        ydl.download.side_effect = download
        manager = MagicMock()
        manager.__enter__.return_value = ydl
        manager.__exit__.return_value = False
        return manager

    mock_ytdl.side_effect = construct
    with collect_timings([], live):
        download_youtube_video("https://youtu.be/x", str(tmp_path / "v.mp4"))
    assert seen[0]["stage"] == "download"
    assert seen[0]["percent"] == 25.0


def test_job_status_carries_current_while_a_stage_runs():
    job_id = "test-current-api"
    live = {}
    jobs.active_jobs[job_id] = {"id": job_id, "url": "local:x", "status": "TRANSCRIBING", "progress": "",
                                "clips": [], "failed": 0, "error": None, "metadata": {}, "_live": live}
    try:
        with collect_timings([], live):
            with stage("transcribe") as rec:
                rec["whisper_device"] = "cuda"
                body = client.get(f"/jobs/{job_id}").json()
        assert body["current"]["stage"] == "transcribe"
        assert body["current"]["device"] == "cuda"
        assert "_live" not in body
        jobs.active_jobs[job_id]["status"] = "DONE"
        assert client.get(f"/jobs/{job_id}").json()["current"] is None
    finally:
        jobs.active_jobs.pop(job_id, None)


def test_job_status_from_history_has_no_current(monkeypatch):
    monkeypatch.setattr("backend.db.get_history", lambda j: {"url": "u", "status": "DONE", "result_clips": [], "metadata": {}})
    assert client.get("/jobs/test-current-history").json()["current"] is None
```

- [ ] **Step 2: Run them to verify they fail**

Run: `C:\Users\dhima\projects\ac-venv\Scripts\python.exe -m pytest backend/tests/test_job_current.py -q -p no:cacheprovider`
Expected: FAIL with `AttributeError: module 'backend.jobs' has no attribute 'live_stage'`, `ImportError: cannot import name 'download_percent'`, and `KeyError: 'current'`.

- [ ] **Step 3: Implement `jobs.py`**

Import line 15 becomes:

```python
from backend.stage_timer import DEVICE_FIELDS, collect_timings, current_stage, report, set_context, stage
```

Replace the `_DEVICE_FIELDS = (...)` assignment (keep its comment) with:

```python
_DEVICE_FIELDS = DEVICE_FIELDS
```

In `_with_timings.wrapper`, replace `with collect_timings(timings):` with:

```python
        # The stages running now, for GET /jobs/{id} (spec 4.4). Never saved.
        live = job["_live"] = {}
        with collect_timings(timings, live):
```

Add after `_with_timings`:

```python
def live_stage(job_id: str):
    """The stage an active job is running now (the ``current`` of its status), or None."""
    job = active_jobs.get(job_id)
    if not job or job.get("status") in _FINISHED:
        return None
    return current_stage(job.get("_live"))
```

Directly before each of these loops add one line (same indentation as the `for`):
- `_render_video_clips`, before `for i, seg in enumerate(segments):` → `report(clips_total=len(segments))`
- `_run_manual_job`, before `for i, clip in enumerate(clips):` → `report(clips_total=len(clips))`
- `_run_rerender_job`, before `for i, seg in enumerate(segments):` → `report(clips_total=len(segments))`
- `_run_rerun_ai_job`, before `for i, seg in enumerate(segments):` → `report(clips_total=len(segments))`

In `_run_manual_resume_job`, after `job["metadata"] = metadata` add:

```python
    # Same list as job["timings"] (as _with_timings does for new jobs), so the status shows
    # the stages of this run as they finish; _finalize_job saves the same value as before.
    metadata["timings"] = job["timings"]
```

- [ ] **Step 4: Implement `video_utils.py`**

Import: `from backend.stage_timer import report, stage`. Add above `download_youtube_video`:

```python
def download_percent(d) -> float:
    """How far one yt-dlp progress update is, in percent, or None when yt-dlp does not know the size."""
    if not isinstance(d, dict) or d.get("status") != "downloading":
        return None
    done = d.get("downloaded_bytes")
    total = d.get("total_bytes") or d.get("total_bytes_estimate")
    if not isinstance(done, (int, float)) or not isinstance(total, (int, float)) or total <= 0:
        return None
    return min(100.0, done * 100.0 / total)
```

In `_download_youtube_video`, replace the block

```python
    if is_cancelled:
        def hook(d):
            if is_cancelled():
                raise DownloadCancelledError("Download cancelled by user")
        base_ydl_opts['progress_hooks'] = [hook]
```

with

```python
    def hook(d):
        if is_cancelled and is_cancelled():
            raise DownloadCancelledError("Download cancelled by user")
        percent = download_percent(d)
        if percent is not None:
            report(percent=percent)  # live status only (spec 4.4), not timings

    base_ydl_opts['progress_hooks'] = [hook]
```

- [ ] **Step 5: Implement `main.py`**

In `api_get_job`, after the `"metadata": job.get("metadata", {})` entry (add a comma to it) add:

```python
        # The stage running now (spec 4.4): {stage, started_at, elapsed_seconds, device?, clip?,
        # clips_total?, percent?}, or None. Built at read time, never stored.
        "current": jobs.live_stage(job_id),
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `C:\Users\dhima\projects\ac-venv\Scripts\python.exe -m pytest backend/tests/test_job_current.py backend/tests/test_pipeline_timings.py backend/tests/test_video_utils.py -q -p no:cacheprovider` → all PASS.
Then the whole suite → 829 passed, 12 skipped (815 + 14).

- [ ] **Step 7: Log and commit**

PROGRESS-LOG entry: what changed (`current` in `GET /jobs/{id}`, clip count, download percent, manual resume timings shared), pytest numbers. Ledger: `Task 2: complete (...)`.

```bash
git add backend/jobs.py backend/video_utils.py backend/main.py backend/tests/test_job_current.py tasks/PROGRESS-LOG.md tasks/sp2-ledger.md
git commit -m "feat(sp2): current stage, clip count and download percent in the job status

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 3: Canvas background image upload through `path_guard` (backend + picker)

Spec 4.7 first bullet and roadmap `T1.y` (both). Local web and cloud picked the image with a browser file input and sent a `blob:` address the backend cannot read. The image is now uploaded to `POST /upload-image` and its backend path is used; every job endpoint refuses a canvas image path that `path_guard` protects (E.14).

**Files:**
- Modify: `backend/main.py` (new `CANVAS_IMAGE_EXTENSIONS`, `api_upload_image`, `_canvas_image_refused`; calls in `api_create_job`, `api_create_manual_job`, `api_rerender_job`, `api_rerun_ai_job`, `api_rerender_clip`)
- Test: `backend/tests/test_canvas_image.py` (create)
- Modify: `src/api.ts` (import `API_URL` from `./platform/backendUrl`; new `uploadCanvasImage`)
- Modify: `src/components/ui/CanvasConfigControls.tsx` (`handleWebFileChange`, upload status and error line)
- Modify: `src/locales/{id,en}.json` (`canvas.uploading_image`, `canvas.upload_failed`)
- Test: `src/components/ui/CanvasConfigControls.test.tsx` (extend)

**Interfaces:**
- Consumes: `path_guard.is_protected`, `path_guard.denied`, `path_guard.safe_upload_name`, `workspace.uploads_dir`.
- Produces:
  - `POST /upload-image` (multipart `file`) → `200 {"status": "success", "path": "<abs path under uploads_dir()/images>"}`; `400` for a non-image name; `403 Access denied` for a protected destination.
  - `uploadCanvasImage(file: File): Promise<string>` in `src/api.ts`.

- [ ] **Step 1: Write the failing backend tests** (`backend/tests/test_canvas_image.py`)

```python
"""Canvas background images go to the backend (SP2 spec 4.7) and job requests cannot point the
canvas image at a private app file (AGENTS.md E.14)."""
import os

import pytest
from fastapi.testclient import TestClient

from backend import jobs, main

client = TestClient(main.app)
DENIED = {"status": "error", "message": "Access denied"}


@pytest.fixture
def library(tmp_path, monkeypatch):
    lib = tmp_path / "library"
    monkeypatch.setenv("AUTO_CLIPPER_WORKSPACE", str(lib))
    monkeypatch.delenv("AUTO_CLIPPER_WORK_DIR", raising=False)
    return lib


def _upload(name, data=b"\x89PNG data", kind="image/png"):
    return client.post("/upload-image", files={"file": (name, data, kind)})


def _images(library):
    return os.path.normcase(str(library / "temp_downloads" / "images")) + os.sep


def test_upload_image_stores_the_file_and_returns_its_backend_path(library):
    r = _upload("latar.png")

    assert r.status_code == 200
    path = r.json()["path"]
    assert os.path.normcase(os.path.abspath(path)).startswith(_images(library))
    assert path.endswith("latar.png")
    assert open(path, "rb").read() == b"\x89PNG data"


def test_two_uploads_with_the_same_name_keep_both_files(library):
    first = _upload("latar.jpg", b"one", "image/jpeg").json()["path"]
    second = _upload("latar.jpg", b"two", "image/jpeg").json()["path"]

    assert first != second
    assert open(first, "rb").read() == b"one"
    assert open(second, "rb").read() == b"two"


@pytest.mark.parametrize("name", ["notes.txt", "clip.mp4", "history.db", "no-extension"])
def test_upload_image_refuses_files_that_are_not_images(library, name):
    assert _upload(name, b"x", "application/octet-stream").status_code == 400


@pytest.mark.parametrize("name", ["../../history.db.png", "..\\..\\cookies\\x.png"])
def test_upload_image_name_cannot_climb_out_of_the_images_folder(library, name):
    r = _upload(name)

    assert r.status_code == 200
    assert os.path.normcase(os.path.abspath(r.json()["path"])).startswith(_images(library))


def test_upload_image_refuses_a_protected_destination(library, monkeypatch):
    monkeypatch.setattr("backend.path_guard.is_protected", lambda path: True)

    r = _upload("latar.png")

    assert r.status_code == 403
    assert r.json() == DENIED


_JOB_REQUESTS = [
    ("/jobs", {"url": "https://youtu.be/abc", "provider": "manual_ai", "api_key": "", "title": "t"}),
    ("/jobs/manual", {"url": "https://youtu.be/abc", "clips": [], "title": "t"}),
    ("/jobs/some-id/rerender", {"provider": "openai", "api_key": ""}),
    ("/jobs/some-id/rerun_ai", {"url": "", "provider": "openai", "api_key": ""}),
    ("/jobs/some-id/clips/0/rerender", {"words": [], "aspect_ratio": "9:16", "caption_style": "standard", "burn_subs": True}),
]
_CREATORS = ("create_job", "create_manual_job", "create_rerender_job", "create_rerun_ai_job", "create_rerender_clip_job")


@pytest.mark.parametrize("path, body", _JOB_REQUESTS)
def test_job_requests_refuse_a_protected_canvas_image(library, monkeypatch, path, body):
    started = []
    for name in _CREATORS:
        monkeypatch.setattr(jobs, name, lambda *a, **k: started.append(1) or "job-1")
    monkeypatch.setattr("backend.ai_utils.ping_provider", lambda *a, **k: None)
    canvas = {"enabled": True, "background_type": "image", "background_image_path": str(library / "history.db")}

    r = client.post(path, json={**body, "canvas_config": canvas})

    assert r.status_code == 403
    assert r.json() == DENIED
    assert started == []


def test_a_job_keeps_an_uploaded_canvas_image(library, monkeypatch):
    image = _upload("latar.png").json()["path"]
    seen = {}
    monkeypatch.setattr(jobs, "create_job", lambda *a, **k: seen.update(k) or "job-1")
    monkeypatch.setattr("backend.ai_utils.ping_provider", lambda *a, **k: None)
    canvas = {"enabled": True, "background_type": "image", "background_image_path": image}

    r = client.post("/jobs", json={**_JOB_REQUESTS[0][1], "canvas_config": canvas})

    assert r.status_code == 200
    assert seen["canvas_config"]["background_image_path"] == image
```

- [ ] **Step 2: Run them to verify they fail**

Run: `C:\Users\dhima\projects\ac-venv\Scripts\python.exe -m pytest backend/tests/test_canvas_image.py -q -p no:cacheprovider`
Expected: the upload tests FAIL with 404/405 (no route), the job tests FAIL with 200/400 instead of 403.

- [ ] **Step 3: Implement in `backend/main.py`**

Add `import secrets` to the top-level imports if it is not there. After `api_upload_video` add:

```python
CANVAS_IMAGE_EXTENSIONS = (".png", ".jpg", ".jpeg", ".webp")


@app.post("/upload-image")
def api_upload_image(file: UploadFile = File(...)):
    """A canvas background image from the browser (spec 4.7): the backend cannot read a blob: address."""
    from backend.path_guard import denied, is_protected, safe_upload_name
    from backend.workspace import uploads_dir
    name = safe_upload_name(file.filename)
    if not name.lower().endswith(CANVAS_IMAGE_EXTENSIONS):
        return JSONResponse(status_code=400, content={"status": "error", "message": "Only PNG, JPG or WEBP images."})
    folder = os.path.abspath(os.path.join(uploads_dir(), "images"))
    # A random part keeps two images with the same name apart.
    path = os.path.join(folder, f"bg_{secrets.token_hex(4)}_{name}")
    if is_protected(path):
        return denied("upload_image", path)
    os.makedirs(folder, exist_ok=True)
    with open(path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    return {"status": "success", "path": path}


def _canvas_image_refused(canvas_config, endpoint: str):
    """E.14: the canvas image is a path from the request like any other. Returns the 403 or None."""
    from backend.path_guard import denied, is_protected
    if canvas_config is None:
        return None
    if isinstance(canvas_config, dict):
        path = canvas_config.get("background_image_path") or ""
    else:
        path = getattr(canvas_config, "background_image_path", "") or ""
    if path and is_protected(path):
        return denied(endpoint, path)
    return None
```

Add as the **first lines** of each handler (before any other check):

```python
    refused = _canvas_image_refused(req.canvas_config, "jobs")                # api_create_job
    if refused:
        return refused
```

with the endpoint names `"jobs"`, `"jobs_manual"` (`api_create_manual_job`), `"jobs_rerender"` (`api_rerender_job`, before its `try:`), `"jobs_rerun_ai"` (`api_rerun_ai_job`, before its `try:`), `"clip_rerender"` (`api_rerender_clip`).

- [ ] **Step 4: Run the backend tests**

Run: `C:\Users\dhima\projects\ac-venv\Scripts\python.exe -m pytest backend/tests/test_canvas_image.py backend/tests/test_protected_paths.py -q -p no:cacheprovider` → PASS. Whole suite → 844 passed, 12 skipped (829 + 15).

- [ ] **Step 5: Write the failing frontend tests** (extend `src/components/ui/CanvasConfigControls.test.tsx`)

At the top, after the imports, add:

```tsx
import i18n from "../../i18n";
import { uploadCanvasImage } from "../../api";

vi.mock("../../api", () => ({ uploadCanvasImage: vi.fn() }));
```

(and drop the bare `import "../../i18n";` line, since `i18n` is now imported by name). Add inside the `describe` block:

```tsx
  async function chooseFile(file: File) {
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input, "files", { value: [file], configurable: true });
    await act(async () => {
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }

  it("without OS dialogs uploads the image and keeps the backend path, never a blob: address", async () => {
    vi.mocked(uploadCanvasImage).mockResolvedValue("/work/temp_downloads/images/bg_1a2b3c4d_latar.png");
    const createObjectURL = vi.fn(() => "blob:http://127.0.0.1/1");
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL }));
    setPlatform(fakePlatform(CAPS.local, vi.fn(async () => null)));
    const onChange = vi.fn();
    renderControls(onChange);
    const file = new File(["png"], "latar.png", { type: "image/png" });

    await chooseFile(file);

    expect(uploadCanvasImage).toHaveBeenCalledWith(file);
    expect(onChange).toHaveBeenCalledWith({
      ...imageConfig,
      background_type: "image",
      background_image_path: "/work/temp_downloads/images/bg_1a2b3c4d_latar.png",
    });
    expect(createObjectURL).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("says under the button that the upload failed and keeps the old image", async () => {
    vi.mocked(uploadCanvasImage).mockRejectedValue(new Error("offline"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    setPlatform(fakePlatform(CAPS.cloud, vi.fn(async () => null)));
    const onChange = vi.fn();
    renderControls(onChange);

    await chooseFile(new File(["png"], "latar.png", { type: "image/png" }));

    expect(onChange).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(i18n.t("canvas.upload_failed"));
  });
```

Run: `npx vitest run src/components/ui/CanvasConfigControls.test.tsx` → the two new tests FAIL (`uploadCanvasImage` not called; no alert).

- [ ] **Step 6: Implement the frontend**

`src/api.ts`: change the first import pair to

```ts
import axios from "axios";
import { API_URL } from "./platform/backendUrl";
```

and add:

```ts
/** Upload a canvas background image (spec 4.7); returns the path the backend reads it from. */
export const uploadCanvasImage = async (file: File): Promise<string> => {
  const form = new FormData();
  form.append("file", file);
  const res = await axios.post(`${API_URL}/upload-image`, form);
  if (res.data?.status !== "success" || typeof res.data.path !== "string") {
    throw new Error(res.data?.message || "upload-image failed");
  }
  return res.data.path;
};
```

`src/components/ui/CanvasConfigControls.tsx`: import `useState` with `useRef`, and `import { uploadCanvasImage } from "../../api";`. Inside the component add:

```tsx
  const [uploading, setUploading] = useState(false);
  const [uploadFailed, setUploadFailed] = useState(false);
```

Replace `handleWebFileChange` with:

```tsx
  // The backend cannot read a browser blob: address (spec 4.7): upload the image, keep its backend path.
  const handleWebFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    setUploadFailed(false);
    try {
      const path = await uploadCanvasImage(file);
      onChange({ ...config, background_type: "image", background_image_path: path });
    } catch (err) {
      console.error("Canvas image upload failed:", err);
      setUploadFailed(true);
    } finally {
      setUploading(false);
    }
  };
```

Directly after the `<div className="flex items-center gap-3">…</div>` that holds the image button, add:

```tsx
              {uploading && (
                <p role="status" className="text-body text-text-secondary">
                  {t("canvas.uploading_image")}
                </p>
              )}
              {uploadFailed && (
                <p role="alert" className="text-body text-error">
                  {t("canvas.upload_failed")}
                </p>
              )}
```

Locale keys (stdin of `node scripts/add-locale-keys.mjs`):

```json
{
  "id": { "canvas": {
    "uploading_image": "Mengunggah gambar…",
    "upload_failed": "Gambar belum terunggah. Periksa sambungan ke Auto Clipper, lalu pilih gambarnya lagi."
  } },
  "en": { "canvas": {
    "uploading_image": "Uploading the image…",
    "upload_failed": "The image was not uploaded. Check the connection to Auto Clipper, then pick the image again."
  } }
}
```

- [ ] **Step 7: Run all checks**

`npx vitest run` → 91 passing (89 + 2). `npx oxlint src` → 0 errors. `npm run build` and `npm run build:cloud` → exit 0. pytest whole suite → 844 passed, 12 skipped.

- [ ] **Step 8: Log, roadmap and commit**

PROGRESS-LOG entry (endpoint, guard on five job endpoints, picker uploads, test numbers). In `tasks/roadmap-todo.md` tick both `T1.y` lines with the commit hash and the note "canvas image: upload + path_guard (SP2 Task 3); `output_dir` stays a free path (SP3)" — leave `output_dir` explicitly open on the first line (split the line into a ticked canvas part and an open `output_dir` part). Ledger: `Task 3: complete (...)` plus `Ruling: output_dir free path not in spec SP2 — stays SP3 — cost if wrong: none new`.

```bash
git add backend/main.py backend/tests/test_canvas_image.py src/api.ts src/components/ui/CanvasConfigControls.tsx src/components/ui/CanvasConfigControls.test.tsx src/locales/id.json src/locales/en.json tasks/roadmap-todo.md tasks/PROGRESS-LOG.md tasks/sp2-ledger.md
git commit -m "fix(sp2): upload canvas background images instead of sending blob: addresses

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Visual base: colour tokens, type scale, focus, contrast and plain-words tests

Spec 4.6 (visual) and spec 7 step 2 (base style). New token values (Global Constraints table), defined missing colour classes (Spec gap 9), 16 px body text, 44 px controls, visible focus, reduced motion, `<html lang>` and a remembered language, plus two guard tests: WCAG AA over the tokens and banned words in main-screen text.

**Files:**
- Modify: `src/index.css`, `tailwind.config.js`, `src/i18n.ts`
- Modify: `src/components/ui/Button.tsx`, `ToggleSwitch.tsx`, `InputGroup.tsx`, `Select.tsx`, `SegmentedControl.tsx`, `ConfirmDialog.tsx`
- Modify: `src/locales/{id,en}.json` (`timing.stage_render`, `timing.device_encoder`, `common.close`)
- Create: `src/styles/contrast.test.ts`, `src/locales/plainWords.test.ts`, `src/i18n.test.ts`, `src/components/ui/ConfirmDialog.test.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - Tailwind colour classes used by every later task: `bg-bg-primary`, `bg-bg-secondary`, `bg-bg-surface`, `bg-bg-tertiary`, `text-text-primary`, `text-text-secondary`, `text-text-muted`, `border-border`, `border-border-active`, `bg-accent`, `hover:bg-accent-hover`, `text-on-accent`, `bg-accent-muted`, `bg-input-bg`, `bg-scrim`, `text-error`, `text-danger`, `text-warning`, `text-success`.
  - `MAIN_NAMESPACES` (exported from `src/locales/plainWords.test.ts`): `["nav", "create", "progress", "moment", "result", "projects", "banner"]`; Task 10 adds `"toast"`.
  - `ConfirmDialog` closes on Escape, has `role="dialog"`, focuses its cancel button.
  - `Button` sizes all at least 44 px tall; icon-only buttons 44 × 44.

- [ ] **Step 1: Write the failing tests**

`src/styles/contrast.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// WCAG 2.x contrast of the colour tokens in src/index.css (spec 4.6, antislop R-25).
const css = readFileSync("src/index.css", "utf8");

function tokens(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`No "${selector} {" block in src/index.css`);
  const body = css.slice(css.indexOf("{", start) + 1, css.indexOf("}", start));
  const out: Record<string, string> = {};
  for (const m of body.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) out[m[1]] = m[2];
  return out;
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
}

const TEXT: [string, string][] = [
  ["text-primary", "bg-primary"], ["text-primary", "bg-secondary"], ["text-primary", "bg-surface"],
  ["text-secondary", "bg-primary"], ["text-secondary", "bg-secondary"], ["text-secondary", "bg-surface"],
  ["text-tertiary", "bg-secondary"], ["accent", "bg-primary"], ["accent", "bg-secondary"],
  ["accent", "accent-muted"], ["text-primary", "accent-muted"], ["on-accent", "accent"],
  ["on-accent", "accent-hover"], ["error", "bg-primary"], ["error", "bg-secondary"],
  ["warning", "bg-secondary"], ["success", "bg-secondary"],
];
// Control edges and the focus ring (WCAG 1.4.11): 3:1.
const UI: [string, string][] = [
  ["border-active", "bg-primary"], ["border-active", "bg-secondary"], ["accent", "bg-primary"],
];

describe("contrast formula", () => {
  it("matches the antislop-human reference table", () => {
    expect(contrast("#777777", "#FFFFFF")).toBe(4.48);
    expect(contrast("#000000", "#FFFFFF")).toBe(21);
  });
});

describe.each([
  ["dark", ":root"],
  ["light", '[data-theme="light"]'],
])("%s theme tokens", (_name, selector) => {
  const t = tokens(selector);

  it.each(TEXT)("%s on %s is at least 4.5:1", (fg, bg) => {
    expect(t[fg], `--${fg} missing`).toBeDefined();
    expect(t[bg], `--${bg} missing`).toBeDefined();
    expect(contrast(t[fg], t[bg])).toBeGreaterThanOrEqual(4.5);
  });

  it.each(UI)("%s against %s is at least 3:1", (fg, bg) => {
    expect(contrast(t[fg], t[bg])).toBeGreaterThanOrEqual(3);
  });
});
```

`src/locales/plainWords.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import en from "./en.json";
import id from "./id.json";

// Spec 4.6: no technical words, no decorative emoji and no em dash in main-screen text.
// Each task that adds a main-screen namespace adds it here (Task 10 adds "toast").
export const MAIN_NAMESPACES = ["nav", "create", "progress", "moment", "result", "projects", "banner"];
const BANNED = [
  "transkripsi", "transcription", "render", "encoder", "json", "sidecar", "token",
  "prompt", "backend", "ffmpeg", "nvenc", "cuda", "whisper",
];
const EMOJI = /\p{Extended_Pictographic}/u;

type Entry = [path: string, text: string];

function texts(node: unknown, path: string): Entry[] {
  if (typeof node === "string") return [[path, node]];
  if (Array.isArray(node)) return node.flatMap((v, i) => texts(v, `${path}.${i}`));
  if (node && typeof node === "object") return Object.entries(node).flatMap(([k, v]) => texts(v, `${path}.${k}`));
  return [];
}

export function mainScreenTexts(locale: Record<string, unknown>): Entry[] {
  const out = MAIN_NAMESPACES.flatMap((ns) => (ns in locale ? texts(locale[ns], ns) : []));
  const timing = (locale.timing ?? {}) as Record<string, unknown>;
  for (const [key, value] of Object.entries(timing)) {
    if (key.startsWith("stage_")) out.push(...texts(value, `timing.${key}`));
  }
  return out;
}

describe.each([
  ["id", id],
  ["en", en],
])("main-screen text (%s)", (_lang, locale) => {
  const entries = mainScreenTexts(locale as Record<string, unknown>);

  it("has no technical words", () => {
    const hits = entries
      .filter(([, text]) => BANNED.some((word) => text.toLowerCase().includes(word)))
      .map(([path, text]) => `${path}: ${text}`);
    expect(hits).toEqual([]);
  });

  it("has no emoji and no em dash", () => {
    const hits = entries
      .filter(([, text]) => EMOJI.test(text) || text.includes("\u2014"))
      .map(([path, text]) => `${path}: ${text}`);
    expect(hits).toEqual([]);
  });
});
```

`src/i18n.test.ts`:

```ts
import { afterEach, describe, expect, it } from "vitest";
import i18n from "./i18n";

describe("language", () => {
  afterEach(() => i18n.changeLanguage("id"));

  it("sets <html lang> so screen readers read the right language", async () => {
    await i18n.changeLanguage("en");
    expect(document.documentElement.lang).toBe("en");
    await i18n.changeLanguage("id");
    expect(document.documentElement.lang).toBe("id");
  });

  it("remembers the chosen language for the next visit", async () => {
    await i18n.changeLanguage("en");
    expect(localStorage.getItem("ac_lang")).toBe("en");
  });
});
```

`src/components/ui/ConfirmDialog.test.tsx`:

```tsx
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../../i18n";
import { ConfirmDialog } from "./ConfirmDialog";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("ConfirmDialog", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  function open(onCancel = vi.fn(), onConfirm = vi.fn()) {
    act(() =>
      root.render(
        <ConfirmDialog isOpen title="Batalkan proses ini?" message="m" confirmLabel="Ya" cancelLabel="Tidak"
          onConfirm={onConfirm} onCancel={onCancel} />,
      ),
    );
    return { onCancel, onConfirm };
  }

  it("is a labelled modal dialog and focuses the safe choice", () => {
    open();
    const dialog = container.querySelector('[role="dialog"]')!;
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(document.getElementById(dialog.getAttribute("aria-labelledby")!)?.textContent).toBe("Batalkan proses ini?");
    expect(document.activeElement?.textContent).toBe("Tidak");
  });

  it("closes with Escape", () => {
    const { onCancel } = open();
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
```

Run: `npx vitest run src/styles src/locales src/i18n.test.ts src/components/ui/ConfirmDialog.test.tsx`
Expected: contrast tests FAIL (missing `--on-accent`, `--text-tertiary` dark fails, light `text-text-primary`-on-accent pair missing), plain-words FAIL on `timing.stage_render: Merender klip`, i18n FAIL (`lang` stays `en`), ConfirmDialog FAIL (no `role="dialog"`).

- [ ] **Step 2: Colour tokens and type scale** (`src/index.css`)

Replace the whole `@layer base { … }` block and the custom scrollbar rules with:

```css
@layer base {
  /* SP2 (spec 4.6): calm and neutral, one blue accent, light and dark. Dark is the default,
     light applies with data-theme="light" (useTheme). Every text/background pair is checked
     for WCAG AA by src/styles/contrast.test.ts; change a value only with that test green. */
  :root {
    color-scheme: dark;
    --bg-primary: #141517;
    --bg-secondary: #1C1D20;
    --bg-elevated: #1C1D20;
    --bg-surface: #26272B;

    --accent: #7EA8FF;
    --accent-hover: #A3C1FF;
    --accent-muted: #1E2A40;
    --on-accent: #0D1B33;

    --text-primary: #ECECEA;
    --text-secondary: #A6A8AD;
    --text-tertiary: #A6A8AD;

    --border: #2E3034;
    --border-active: #7A7D84;

    --success: #6FD39A;
    --error: #FF8A80;
    --warning: #F2B866;
    --info: #7EA8FF;
    --scrim: rgba(0, 0, 0, 0.6);
  }

  [data-theme="light"] {
    color-scheme: light;
    --bg-primary: #F6F6F4;
    --bg-secondary: #FFFFFF;
    --bg-elevated: #FFFFFF;
    --bg-surface: #ECECE9;

    --accent: #1F5FCC;
    --accent-hover: #194FAA;
    --accent-muted: #E8EEFB;
    --on-accent: #FFFFFF;

    --text-primary: #1C1D1F;
    --text-secondary: #55585E;
    --text-tertiary: #55585E;

    --border: #DCDDD9;
    --border-active: #85888E;

    --success: #1E7A3E;
    --error: #B42318;
    --warning: #9A5B00;
    --info: #1F5FCC;
    --scrim: rgba(0, 0, 0, 0.45);
  }

  body {
    @apply bg-[var(--bg-primary)] text-[var(--text-primary)] min-h-screen font-sans;
    margin: 0;
  }

  /* 16 px in form fields: readable on a phone, and iOS does not zoom in on focus. */
  input,
  select,
  textarea {
    font-size: 16px;
  }

  /* Visible keyboard focus everywhere (antislop R-32); components may add a ring on top. */
  :focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }
}

@layer utilities {
  .text-page-title {
    @apply text-[24px] leading-tight font-bold;
  }
  .text-section-title {
    @apply text-[20px] leading-snug font-semibold;
  }
  .text-card-title {
    @apply text-[18px] leading-snug font-semibold;
  }
  .text-body {
    @apply text-[16px] leading-relaxed font-normal;
  }
  .text-label {
    @apply text-[14px] font-medium;
  }
  .text-caption {
    @apply text-[14px] font-normal;
  }
  .text-overline {
    @apply text-[12px] font-semibold uppercase tracking-wide;
  }
}

::-webkit-scrollbar {
  width: 8px;
}
::-webkit-scrollbar-track {
  background: var(--bg-primary);
}
::-webkit-scrollbar-thumb {
  background: var(--border-active);
  border-radius: 4px;
}
```

`tailwind.config.js`, inside `theme.extend.colors`: add `tertiary: 'var(--bg-surface)'` to `bg`, `muted: 'var(--text-secondary)'` to `text`, and the top-level entries

```js
        'on-accent': 'var(--on-accent)',
        'input-bg': 'var(--bg-secondary)',
        scrim: 'var(--scrim)',
        danger: 'var(--error)',
```

- [ ] **Step 3: Language** (`src/i18n.ts`)

Replace the `i18n.use(...).init({...})` call with:

```ts
function savedLanguage(): string {
  try {
    const saved = localStorage.getItem("ac_lang");
    return saved === "en" || saved === "id" ? saved : "id";
  } catch {
    return "id";
  }
}

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: savedLanguage(),
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    }
  });

/** <html lang> follows the language (screen readers), and the choice is kept for the next visit. */
function applyLanguage(lng: string): void {
  const lang = lng.startsWith("en") ? "en" : "id";
  if (typeof document !== "undefined") document.documentElement.lang = lang;
  try {
    localStorage.setItem("ac_lang", lang);
  } catch {
    // Storage blocked: the language still applies for this visit.
  }
}

applyLanguage(i18n.language);
i18n.on("languageChanged", applyLanguage);
```

- [ ] **Step 4: Primitives**

`src/components/ui/Button.tsx`: replace `baseClasses`, `variants` and `sizes` and the icon rendering with:

```tsx
  const baseClasses =
    'inline-flex items-center justify-center gap-2 rounded-button text-label transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary disabled:opacity-50 disabled:cursor-not-allowed';

  const variants = {
    primary: 'bg-accent hover:bg-accent-hover text-on-accent font-semibold',
    outline: 'border border-border-active bg-bg-secondary hover:bg-bg-surface text-text-primary',
    ghost: 'hover:bg-bg-surface text-text-primary',
    danger: 'border border-error text-error bg-bg-secondary hover:bg-bg-surface',
  };

  // Every size keeps a 44 px touch target (spec 4.6); icon-only buttons are 44 × 44.
  const sizes = {
    sm: 'min-h-[44px] px-3',
    md: 'min-h-[44px] px-4',
    lg: 'min-h-[52px] px-6 text-body font-semibold',
  };
  const iconOnly = !children ? 'min-w-[44px] !px-0' : '';
```

use `${iconOnly}` in the class list, add `aria-busy={loading || undefined}` to the `<button>`, and render icons as `<Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />` / `<Icon className="w-5 h-5" aria-hidden="true" />` (no `mr-2`; the `gap-2` spaces them).

`src/components/ui/ToggleSwitch.tsx`: replace the returned JSX with:

```tsx
    <label className={`inline-flex min-h-[44px] items-center gap-3 cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}>
      <span className="relative inline-flex">
        <input
          type="checkbox"
          role="switch"
          aria-checked={checked}
          className="peer sr-only"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
        />
        <span
          aria-hidden="true"
          className={`block w-11 h-6 rounded-full border transition-colors duration-150 peer-focus-visible:ring-2 peer-focus-visible:ring-accent peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-bg-primary ${
            checked ? 'bg-accent border-accent' : 'bg-bg-surface border-border-active'
          }`}
        />
        <span
          aria-hidden="true"
          className={`absolute left-1 top-1 w-4 h-4 rounded-full transition-transform duration-150 ${
            checked ? 'translate-x-5 bg-on-accent' : 'bg-text-secondary'
          }`}
        />
      </span>
      {label && <span className="text-body text-text-primary">{label}</span>}
    </label>
```

(`bg-text-secondary` needs `text-secondary` as a colour: it already is one through `text.secondary`, so the class is `bg-text-secondary`.)

`src/components/ui/InputGroup.tsx`: use React's `useId` (`const autoId = useId(); const inputId = id || autoId; const helpId = \`${inputId}-help\`;`), give the input `aria-invalid={error || undefined}` and `aria-describedby={helperText ? helpId : undefined}`, give the helper `<p id={helpId}>`, and change the input classes to `w-full min-h-[44px] bg-bg-secondary border ${error ? 'border-error' : 'border-border-active focus:border-accent'} rounded-input py-2 … text-body …` (keep the rest).

`src/components/ui/Select.tsx`: the `<select>` gets `min-h-[44px] bg-bg-secondary border-border-active` in place of its current height, background and border classes.

`src/components/ui/SegmentedControl.tsx`: each option button gets `min-h-[44px]` and `aria-pressed={isActive}`; active style `bg-bg-secondary text-text-primary shadow-sm border border-border-active`.

`src/components/ui/ConfirmDialog.tsx`: replace the component body with:

```tsx
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Konfirmasi',
  cancelLabel = 'Batal',
  isDestructive = false,
  onConfirm,
  onCancel,
}) => {
  const { t } = useTranslation();
  const titleId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-scrim p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="bg-bg-secondary w-full max-w-md rounded-card border border-border shadow-dropdown"
      >
        <div className="flex justify-between items-start gap-3 p-5 border-b border-border">
          <h2 id={titleId} className="text-section-title text-text-primary">{title}</h2>
          <Button variant="ghost" icon={X} aria-label={t('common.close', 'Tutup')} onClick={onCancel} />
        </div>
        <p className="p-5 text-body text-text-primary">{message}</p>
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 p-5 border-t border-border">
          <Button ref={cancelRef} variant="outline" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant={isDestructive ? 'danger' : 'primary'} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
};
```

with imports `React, { useEffect, useId, useRef }`, `useTranslation`, `X` from lucide and `Button`. `Button` must forward the ref: wrap it as `export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({…}, ref) => (<button ref={ref} …>…</button>));` and set `Button.displayName = 'Button'`. (The `AlertTriangle` decoration goes: the destructive button already says what happens.)

- [ ] **Step 5: Locale texts**

Edit the values in place (the add script refuses changed texts):
- `timing.stage_render`: id `Membuat klip`, en `Making the clips` (question 3).
- `timing.device_encoder`: id `Pembuatan klip`, en `Making the clips`.

Add with `node scripts/add-locale-keys.mjs`:

```json
{ "id": { "common": { "close": "Tutup" } }, "en": { "common": { "close": "Close" } } }
```

- [ ] **Step 6: Contrast cross-check with the antislop-human script**

Run (Git Bash) and paste the output into the ledger entry of this task:

```bash
S="C:/Users/dhima/.claude/plugins/cache/anti-slop/antislop/3.2.17/skills/antislop-human/contrast-check.py"
P=/c/Users/dhima/projects/ac-venv/Scripts/python.exe
for pair in "#1C1D1F #F6F6F4" "#55585E #ECECE9" "#FFFFFF #1F5FCC" "#1F5FCC #F6F6F4" "#B42318 #FFFFFF" "#ECECEA #141517" "#A6A8AD #26272B" "#0D1B33 #7EA8FF" "#7EA8FF #141517" "#FF8A80 #1C1D20"; do set -- $pair; echo "$1 on $2: $($P "$S" "$1" "$2" | head -1)"; done
```

Expected: every ratio ≥ 4.5 (values from planning: 15.59, 6.03, 5.89, 5.44, 6.57, 15.45, 6.27, 7.31, 7.77, 7.38). If the plugin path is missing, the Vitest contrast test is the record.

- [ ] **Step 7: Run all checks**

`npx vitest run` → 91 + new (contrast: 1 + 2 × (17 + 3) = 41; plain words 4; i18n 2; ConfirmDialog 2) = 140 passing. `npx oxlint src` 0 errors. `npm run build`, `npm run build:cloud` exit 0. Open the built app once (`backend.main --web`) in light and dark: primary buttons are blue with white (light) / dark navy (dark) text; nothing lost its colour.

- [ ] **Step 8: Log and commit**

PROGRESS-LOG entry; ledger `Task 4: complete (...)` with the Step 6 output.

```bash
git add src/index.css tailwind.config.js src/i18n.ts src/i18n.test.ts src/styles/contrast.test.ts src/locales src/components/ui tasks/PROGRESS-LOG.md tasks/sp2-ledger.md
git commit -m "feat(sp2): calm colour tokens, 16 px body text, 44 px controls, focus and contrast tests

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 5: Shell: three destinations, bottom/side navigation, connection status, routes and redirects, `caps.keepOpen`

Spec 4.1 and 5 (disconnected banner). Six menus become three: **Buat klip** (`/`), **Riwayat** (`/riwayat`, `/riwayat/:id`), **Pengaturan** (`/pengaturan`). Phones get a bottom bar with three labelled icons; from 768 px a slim side bar with the same three. The connection status is a small labelled dot in the header; a lost backend shows a banner with "Hubungkan ulang" and a per-platform explanation. Old addresses redirect. `LandingPage` and `Sidebar` go. The existing pages are mounted at the new paths for now (Tasks 8, 13, 14 replace them), so the app works after this task.

**Files:**
- Modify: `src/platform/types.ts` (`KeepOpen`, `Caps.keepOpen`), `src/platform/caps.ts`, `src/platform/caps.test.ts`
- Create: `src/lib/routes.ts`, `src/components/nav/legacyRoutes.tsx`, `src/lib/routes.test.tsx`
- Create: `src/hooks/useBackendStatus.tsx`, `src/hooks/useScrollToHash.ts`
- Create: `src/components/nav/navItems.ts`, `BottomNav.tsx`, `SideNav.tsx`, `ConnectionStatus.tsx`, `BackendBanner.tsx`, `src/components/nav/nav.test.tsx`
- Modify: `src/layouts/AppLayout.tsx`, `src/App.tsx`, `src/hooks/useErrorActions.ts`, `src/hooks/useClipJobs.ts` (one line), `src/pages/SettingsPage.tsx` (temporary anchors)
- Delete: `src/components/sidebar/Sidebar.tsx`, `src/pages/LandingPage.tsx`
- Modify: `src/locales/{id,en}.json` (`nav.*`, `banner.*`)

**Interfaces:**
- Consumes: `useBackendHealth()` → `{ status: BackendStatusKey, reconnect(): Promise<void> }`; `platform().caps`.
- Produces:
  - `type KeepOpen = "app" | "window" | "none"`; `Caps.keepOpen` (`desktop: "app"`, `local: "window"`, `cloud: "none"`).
  - `ROUTES = { create: "/", projects: "/riwayat", settings: "/pengaturan" }`, `projectPath(id: string): string`, `SETTINGS_ANCHORS = { general: "umum", youtube: "youtube", advanced: "lanjutan", downloader: "pengunduh", help: "bantuan" }`, `LEGACY_REDIRECTS: Record<string, string>` (`src/lib/routes.ts`).
  - `legacyRouteElements(): React.ReactElement[]` (`src/components/nav/legacyRoutes.tsx`).
  - `BackendStatusProvider`, `BackendStatusContext`, `useBackendStatus(): { status: BackendStatusKey; reconnect: () => Promise<void> }` (`src/hooks/useBackendStatus.tsx`).
  - `useScrollToHash(): void` (`src/hooks/useScrollToHash.ts`).
  - `NAV_ITEMS` (`src/components/nav/navItems.ts`).

- [ ] **Step 1: Write the failing tests**

`src/platform/caps.test.ts`: in each of the three `toEqual` objects add the new field — desktop `keepOpen: "app"`, local `keepOpen: "window"`, cloud `keepOpen: "none"` — and add:

```ts
  it("says what must stay open while a job runs (spec 4.3)", () => {
    expect([CAPS.desktop.keepOpen, CAPS.local.keepOpen, CAPS.cloud.keepOpen]).toEqual(["app", "window", "none"]);
  });
```

`src/lib/routes.test.tsx`:

```tsx
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { legacyRouteElements } from "../components/nav/legacyRoutes";
import { LEGACY_REDIRECTS, projectPath } from "./routes";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function Where() {
  const location = useLocation();
  return <p>{location.pathname + location.hash}</p>;
}

describe("routes (spec 4.1)", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    root = createRoot(container);
  });

  afterEach(() => act(() => root.unmount()));

  it("keeps every old address working", () => {
    expect(LEGACY_REDIRECTS).toEqual({
      "/manual-ai": "/",
      "/downloader": "/pengaturan#pengunduh",
      "/history": "/riwayat",
      "/settings": "/pengaturan",
      "/help": "/pengaturan#bantuan",
    });
  });

  it.each(Object.entries(LEGACY_REDIRECTS))("%s opens %s", (from, to) => {
    act(() =>
      root.render(
        <MemoryRouter initialEntries={[from]}>
          <Routes>
            {legacyRouteElements()}
            <Route path="*" element={<Where />} />
          </Routes>
        </MemoryRouter>,
      ),
    );
    expect(container.textContent).toBe(to);
  });

  it("builds a project address that survives odd ids", () => {
    expect(projectPath("a b/c")).toBe("/riwayat/a%20b%2Fc");
  });
});
```

`src/components/nav/nav.test.tsx`:

```tsx
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../../i18n";
import { BackendStatusContext } from "../../hooks/useBackendStatus";
import { CAPS, setPlatform, type Platform } from "../../platform";
import { BackendBanner } from "./BackendBanner";
import { BottomNav } from "./BottomNav";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("navigation shell", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    setPlatform(null);
  });

  it("shows three labelled destinations and marks the current one", () => {
    act(() => root.render(<MemoryRouter initialEntries={["/riwayat/abc"]}><BottomNav /></MemoryRouter>));
    const links = [...container.querySelectorAll("a")];
    expect(links.map((a) => a.textContent)).toEqual([i18n.t("nav.create"), i18n.t("nav.projects"), i18n.t("nav.settings")]);
    expect(links.map((a) => a.getAttribute("aria-current"))).toEqual([null, "page", null]);
  });

  it("explains a lost connection per platform and reconnects on request", () => {
    setPlatform({ caps: CAPS.cloud } as Platform);
    const reconnect = vi.fn(async () => {});
    act(() =>
      root.render(
        <BackendStatusContext.Provider value={{ status: "disconnected", reconnect }}>
          <BackendBanner />
        </BackendStatusContext.Provider>,
      ),
    );
    expect(container.textContent).toContain(i18n.t("banner.lost_none"));
    act(() => container.querySelector("button")!.click());
    expect(reconnect).toHaveBeenCalledTimes(1);
  });

  it("shows no banner while connected", () => {
    setPlatform({ caps: CAPS.desktop } as Platform);
    act(() =>
      root.render(
        <BackendStatusContext.Provider value={{ status: "connected", reconnect: vi.fn(async () => {}) }}>
          <BackendBanner />
        </BackendStatusContext.Provider>,
      ),
    );
    expect(container.innerHTML).toBe("");
  });
});
```

Run: `npx vitest run src/platform/caps.test.ts src/lib/routes.test.tsx src/components/nav` → FAIL (missing modules and `keepOpen`).

- [ ] **Step 2: Platform cap**

`src/platform/types.ts`, above `export interface Caps`:

```ts
/**
 * What must stay open for a running job to continue (spec 4.3): the desktop app, the
 * "Auto Clipper Web" window, or nothing (cloud: the job runs on Colab).
 */
export type KeepOpen = "app" | "window" | "none";
```

and inside `Caps`, after `preventSleep`:

```ts
  /** See KeepOpen. Picks the "may I close this?" text and the disconnected-banner text. */
  keepOpen: KeepOpen;
```

`src/platform/caps.ts`: append `keepOpen: "app"` to desktop, `keepOpen: "window"` to local, `keepOpen: "none"` to cloud.

- [ ] **Step 3: Routes**

`src/lib/routes.ts`:

```ts
// The three destinations of the app (spec 4.1) and where the old addresses go. HashRouter paths.

export const ROUTES = {
  create: "/",
  projects: "/riwayat",
  settings: "/pengaturan",
} as const;

export function projectPath(id: string): string {
  return `${ROUTES.projects}/${encodeURIComponent(id)}`;
}

/** Sections of Pengaturan that other pages link to (`/pengaturan#<id>`). */
export const SETTINGS_ANCHORS = {
  general: "umum",
  youtube: "youtube",
  advanced: "lanjutan",
  downloader: "pengunduh",
  help: "bantuan",
} as const;

/** Addresses from before SP2 (guides, bookmarks) and where they open now. */
export const LEGACY_REDIRECTS: Record<string, string> = {
  "/manual-ai": ROUTES.create,
  "/downloader": `${ROUTES.settings}#${SETTINGS_ANCHORS.downloader}`,
  "/history": ROUTES.projects,
  "/settings": ROUTES.settings,
  "/help": `${ROUTES.settings}#${SETTINGS_ANCHORS.help}`,
};
```

`src/components/nav/legacyRoutes.tsx`:

```tsx
import { Navigate, Route } from "react-router-dom";
import { LEGACY_REDIRECTS } from "../../lib/routes";

/** One redirect route per old address; call inside <Routes>. */
export function legacyRouteElements() {
  return Object.entries(LEGACY_REDIRECTS).map(([from, to]) => (
    <Route key={from} path={from} element={<Navigate to={to} replace />} />
  ));
}
```

`src/hooks/useScrollToHash.ts`:

```ts
import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/** Scroll to `#bantuan` and friends: inside HashRouter the browser cannot do it by itself. */
export function useScrollToHash(): void {
  const { hash } = useLocation();
  useEffect(() => {
    if (!hash) return;
    const target = document.getElementById(decodeURIComponent(hash.slice(1)));
    if (!target) return;
    target.scrollIntoView({ block: "start" });
    target.focus({ preventScroll: true });
  }, [hash]);
}
```

- [ ] **Step 4: Shared backend status**

`src/hooks/useBackendStatus.tsx`:

```tsx
import React, { createContext, useContext } from "react";
import { useBackendHealth, type BackendStatusKey } from "./useBackendHealth";

export interface BackendStatus {
  status: BackendStatusKey;
  reconnect: () => Promise<void>;
}

/** One /health poller for the whole app (header dot, banner, preflight re-check). */
export const BackendStatusContext = createContext<BackendStatus | null>(null);

export const BackendStatusProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const value = useBackendHealth();
  return <BackendStatusContext.Provider value={value}>{children}</BackendStatusContext.Provider>;
};

export function useBackendStatus(): BackendStatus {
  const value = useContext(BackendStatusContext);
  if (!value) throw new Error("useBackendStatus needs <BackendStatusProvider>.");
  return value;
}
```

- [ ] **Step 5: Navigation components**

`src/components/nav/navItems.ts`:

```ts
import { History, Scissors, Settings, type LucideIcon } from "lucide-react";
import { ROUTES } from "../../lib/routes";

export interface NavItem {
  to: string;
  labelKey: string;
  icon: LucideIcon;
  /** Only the exact path counts as active ("/" would otherwise match everything). */
  end: boolean;
}

// The icons sit next to their labels: on a phone they let people tell the three apart at a glance.
export const NAV_ITEMS: NavItem[] = [
  { to: ROUTES.create, labelKey: "nav.create", icon: Scissors, end: true },
  { to: ROUTES.projects, labelKey: "nav.projects", icon: History, end: false },
  { to: ROUTES.settings, labelKey: "nav.settings", icon: Settings, end: false },
];
```

`src/components/nav/BottomNav.tsx`:

```tsx
import React from "react";
import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { NAV_ITEMS } from "./navItems";

/** Phones (< 768 px): the three destinations at the bottom, in reach of the thumb. */
export const BottomNav: React.FC = () => {
  const { t } = useTranslation();
  return (
    <nav
      aria-label={t("nav.label")}
      className="md:hidden fixed inset-x-0 bottom-0 z-30 border-t border-border bg-bg-secondary pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="grid grid-cols-3">
        {NAV_ITEMS.map(({ to, labelKey, icon: Icon, end }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex min-h-[56px] flex-col items-center justify-center gap-1 text-label ${
                  isActive ? "text-accent font-semibold" : "text-text-secondary hover:text-text-primary"
                }`
              }
            >
              <Icon className="w-6 h-6" aria-hidden="true" />
              <span>{t(labelKey)}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
};
```

`src/components/nav/SideNav.tsx`:

```tsx
import React from "react";
import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { NAV_ITEMS } from "./navItems";

/** From 768 px: a slim bar with the same three destinations (labels under the icon, beside it from 1024 px). */
export const SideNav: React.FC = () => {
  const { t } = useTranslation();
  return (
    <nav
      aria-label={t("nav.label")}
      className="hidden md:flex sticky top-0 h-dvh w-24 lg:w-56 shrink-0 flex-col gap-2 border-r border-border bg-bg-secondary px-2 py-4 lg:px-3"
    >
      <p className="hidden lg:block px-3 pb-4 text-card-title text-text-primary">Auto Clipper</p>
      {NAV_ITEMS.map(({ to, labelKey, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `flex min-h-[56px] flex-col lg:flex-row items-center lg:justify-start justify-center gap-1 lg:gap-3 rounded-button px-2 lg:px-3 text-label lg:text-body ${
              isActive ? "bg-accent-muted text-accent font-semibold" : "text-text-secondary hover:bg-bg-surface hover:text-text-primary"
            }`
          }
        >
          <Icon className="w-6 h-6 shrink-0" aria-hidden="true" />
          <span>{t(labelKey)}</span>
        </NavLink>
      ))}
    </nav>
  );
};
```

`src/components/nav/ConnectionStatus.tsx`:

```tsx
import React from "react";
import { useTranslation } from "react-i18next";
import { useBackendStatus } from "../../hooks/useBackendStatus";

const DOT: Record<string, string> = {
  connected: "bg-success",
  connecting: "bg-text-secondary",
  reconnecting: "bg-warning",
  disconnected: "bg-error",
};

/** Header: a small dot plus a word (the word carries the meaning, the dot only marks it). */
export const ConnectionStatus: React.FC = () => {
  const { t } = useTranslation();
  const { status } = useBackendStatus();
  return (
    <p role="status" className="flex items-center gap-2 text-label text-text-secondary">
      <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${DOT[status]}`} />
      {t(`banner.status_${status}`)}
    </p>
  );
};
```

`src/components/nav/BackendBanner.tsx`:

```tsx
import React from "react";
import { useTranslation } from "react-i18next";
import { RefreshCw } from "lucide-react";
import { useBackendStatus } from "../../hooks/useBackendStatus";
import { platform } from "../../platform";
import { Button } from "../ui/Button";

/** Spec 5: the backend is gone. What happened, why (per platform), and the one thing to try. */
export const BackendBanner: React.FC = () => {
  const { t } = useTranslation();
  const { status, reconnect } = useBackendStatus();
  if (status !== "disconnected" && status !== "reconnecting") return null;
  return (
    <div role="alert" className="border-b border-border bg-bg-surface px-4 py-3 md:px-8">
      <div className="mx-auto flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-body font-semibold text-text-primary">{t("banner.lost_title")}</p>
          <p className="text-body text-text-primary">{t(`banner.lost_${platform().caps.keepOpen}`)}</p>
        </div>
        <Button variant="outline" icon={RefreshCw} loading={status === "reconnecting"} onClick={() => void reconnect()}>
          {t("banner.reconnect")}
        </Button>
      </div>
    </div>
  );
};
```

- [ ] **Step 6: Layout and routes**

`src/layouts/AppLayout.tsx`:

```tsx
import React from "react";
import { Outlet } from "react-router-dom";
import BusyOverlay from "../components/BusyOverlay";
import { BackendBanner } from "../components/nav/BackendBanner";
import { BottomNav } from "../components/nav/BottomNav";
import { ConnectionStatus } from "../components/nav/ConnectionStatus";
import { SideNav } from "../components/nav/SideNav";
import { BackendStatusProvider } from "../hooks/useBackendStatus";

/** One responsive frame (spec 4.1): bottom bar under 768 px, slim side bar above. */
export const AppLayout: React.FC = () => (
  <BackendStatusProvider>
    <div className="min-h-dvh bg-bg-primary text-text-primary md:flex">
      <SideNav />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-border bg-bg-primary px-4 md:px-8">
          <span className="text-card-title text-text-primary md:invisible lg:visible">Auto Clipper</span>
          <ConnectionStatus />
        </header>
        <BackendBanner />
        <main className="w-full flex-1 px-4 pb-28 pt-4 md:px-8 md:pb-10 md:pt-6">
          <Outlet />
        </main>
      </div>
      <BottomNav />
      <BusyOverlay />
    </div>
  </BackendStatusProvider>
);
```

(`BusyOverlay` stays until Task 10.)

`src/App.tsx`:
- Remove the imports of `LandingPage`, `ManualDownloaderPage`, `HelpPage`, `Navigate`; import `legacyRouteElements` from `./components/nav/legacyRoutes`.
- Remove the `showLanding` state and the `showLanding ? … :` branch.
- Replace the `<Routes>` block with:

```tsx
  const routes = (
    <Routes>
      <Route path="/" element={<AppLayout />}>
        {/* Replaced by CreatePage in Task 8. Cloud has no API keys: the manual page. */}
        <Route index element={platform().caps.apiKeys ? <WorkspacePage /> : <ManualAIEditorPage />} />
        <Route path="riwayat" element={<HistoryPage />} />
        <Route path="riwayat/:id" element={<HistoryPage />} />
        <Route path="pengaturan" element={<SettingsPage />} />
        {legacyRouteElements()}
      </Route>
    </Routes>
  );
```

`src/pages/SettingsPage.tsx` (temporary, replaced in Task 14): import `ManualDownloaderPage`, `HelpPage`, `useScrollToHash`; call `useScrollToHash()` at the top of the component; append inside the column, after the updater section:

```tsx
        <section id="pengunduh" tabIndex={-1}><ManualDownloaderPage /></section>
        <section id="bantuan" tabIndex={-1}><HelpPage /></section>
```

`src/hooks/useErrorActions.ts`: `openSettings: () => navigate("/settings")` becomes `openSettings: () => navigate(\`${ROUTES.settings}#${SETTINGS_ANCHORS.advanced}\`)` (import both from `../lib/routes`).

`src/hooks/useClipJobs.ts`: `window.location.hash = "#/history";` becomes `window.location.hash = "#/riwayat";` (Task 11 removes the jump).

Delete `src/components/sidebar/Sidebar.tsx` and `src/pages/LandingPage.tsx`.

- [ ] **Step 7: Texts** (`node scripts/add-locale-keys.mjs`)

```json
{
  "id": {
    "nav": { "label": "Menu utama", "create": "Buat klip", "projects": "Riwayat", "settings": "Pengaturan" },
    "banner": {
      "status_connecting": "Menghubungkan…",
      "status_connected": "Terhubung",
      "status_disconnected": "Terputus",
      "status_reconnecting": "Menghubungkan ulang…",
      "lost_title": "Auto Clipper tidak tersambung",
      "lost_app": "Bagian aplikasi yang memproses video berhenti. Tekan Hubungkan ulang untuk menyalakannya lagi.",
      "lost_window": "Jendela Auto Clipper Web tidak menjawab. Pastikan jendela itu masih terbuka, lalu tekan Hubungkan ulang.",
      "lost_none": "Server di Google Colab tidak menjawab. Pastikan kotak server di Colab masih berjalan, lalu tekan Hubungkan ulang.",
      "reconnect": "Hubungkan ulang"
    }
  },
  "en": {
    "nav": { "label": "Main menu", "create": "Make clips", "projects": "History", "settings": "Settings" },
    "banner": {
      "status_connecting": "Connecting…",
      "status_connected": "Connected",
      "status_disconnected": "Disconnected",
      "status_reconnecting": "Reconnecting…",
      "lost_title": "Auto Clipper is not connected",
      "lost_app": "The part of the app that processes videos stopped. Press Reconnect to start it again.",
      "lost_window": "The Auto Clipper Web window is not answering. Make sure it is still open, then press Reconnect.",
      "lost_none": "The Google Colab server is not answering. Make sure the server cell in Colab is still running, then press Reconnect.",
      "reconnect": "Reconnect"
    }
  }
}
```

- [ ] **Step 8: Run all checks and look at it**

`npx vitest run` → 151 passing (140 + 1 caps + 7 routes + 3 nav; record the printed total). `npx oxlint src` 0 errors. `npm run build`, `npm run build:cloud` exit 0. In the browser (built app via `backend.main --web`): at 360 px wide the bottom bar shows three items and the page content is not hidden behind it (scroll to the very bottom of Settings); at 800 px the side bar shows icon over label; at 1280 px icon beside label; `#/help` lands on Pengaturan scrolled to the help section; Tab reaches the three nav links with a visible focus ring; stop the backend → banner with "Hubungkan ulang".

- [ ] **Step 9: Log and commit**

PROGRESS-LOG entry; ledger `Task 5: complete (...)`.

```bash
git add -A src/platform src/lib/routes.ts src/lib/routes.test.tsx src/components/nav src/hooks src/layouts src/App.tsx src/pages src/components/sidebar src/locales tasks/PROGRESS-LOG.md tasks/sp2-ledger.md
git commit -m "feat(sp2): three destinations with bottom and side navigation, redirects and connection banner

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Flow logic: active step, link check, auto title, remembered choices

Spec 4.2 (step order, link check, remembered choices) and Spec gaps 5, 12, 16. Pure functions only, so Tasks 8, 10 and 11 build on tested logic.

**Files:**
- Create: `src/lib/createFlow.ts`, `src/lib/createFlow.test.ts`
- Create: `src/lib/clipChoices.ts`, `src/lib/clipChoices.test.ts`

**Interfaces:**
- Consumes: `Caps` (`src/platform/types.ts`), `CanvasConfig`/`DEFAULT_CANVAS_CONFIG`, `SubtitleConfig`/`DEFAULT_SUBTITLE_CONFIG`.
- Produces (`src/lib/createFlow.ts`):
  - `PREPARE_STAGES = ["download", "extract_audio", "transcribe"]`, `CHOOSE_STAGES = ["ai_analysis"]`, `MAKE_STAGES = ["tracking", "render", "hook_concat", "publish"]` (readonly string tuples)
  - `type FlowStep = 1 | 2 | 3 | 4`; `type StepState = "done" | "active" | "todo"`
  - `interface FlowState { status: string; running: boolean; currentStage: string | null; awaitingAnswer: boolean; makePhase: boolean; hasClips: boolean }`
  - `activeStep(f: FlowState): FlowStep`; `stepStates(active: FlowStep, finished: boolean): StepState[]`
  - `type LinkProblem = "empty" | "unsupported"`; `linkProblem(text: string): LinkProblem | null`
  - `type VideoSourceName = { kind: "link"; url: string } | { kind: "file"; name: string }`; `sourceName(s): string`; `autoProjectTitle(s: VideoSourceName, now: Date): string`
  - `type AiMode = "manual" | "auto"`; `MANUAL_PROVIDER = "manual_ai"`; `effectiveProvider(caps: Pick<Caps, "apiKeys">, aiMode: AiMode, provider: string): string`
- Produces (`src/lib/clipChoices.ts`):
  - `type ShapeValue = "9:16" | "1:1" | "16:9"`; `interface ClipChoices { aspectRatio: ShapeValue; trackingMode: "auto" | "center"; burnSubtitles: boolean; subtitleConfig: SubtitleConfig; canvasConfig: CanvasConfig; enableHook: boolean; enableBroll: boolean; maxClips: number; isGamingVideo: boolean }`
  - `CLIP_CHOICES_KEY = "ac_clip_choices"`, `DEFAULT_CLIP_CHOICES: ClipChoices`, `MAX_CLIP_OPTIONS = [0, 3, 5, 10, 15, 20]`
  - `loadClipChoices(storage: Pick<Storage, "getItem"> | null): ClipChoices`; `saveClipChoices(storage: Pick<Storage, "setItem"> | null, c: ClipChoices): void`

- [ ] **Step 1: Write the failing tests**

`src/lib/createFlow.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { CAPS } from "../platform/caps";
import { activeStep, autoProjectTitle, effectiveProvider, linkProblem, stepStates, type FlowState } from "./createFlow";

const idle: FlowState = { status: "IDLE", running: false, currentStage: null, awaitingAnswer: false, makePhase: false, hasClips: false };

describe("activeStep (spec 4.2: Video, Siapkan, Pilih momen, Klip)", () => {
  it.each<[string, Partial<FlowState>, number]>([
    ["nothing started", {}, 1],
    ["upload or queue, no stage yet", { running: true, status: "GENERATING" }, 2],
    ["downloading", { running: true, status: "DOWNLOADING", currentStage: "download" }, 2],
    ["making subtitles", { running: true, status: "TRANSCRIBING", currentStage: "transcribe" }, 2],
    ["waiting for the AI answer", { awaitingAnswer: true }, 3],
    ["API key mode picking moments", { running: true, status: "TRANSCRIBING", currentStage: "ai_analysis" }, 3],
    ["tracking faces", { running: true, status: "CROPPING", currentStage: "tracking" }, 4],
    ["answer sent, job still queued", { running: true, status: "PENDING", makePhase: true }, 4],
    ["between two clips", { running: true, status: "CROPPING" }, 4],
    ["clips ready", { status: "DONE", hasClips: true }, 4],
    ["failed before any clip", { status: "ERROR" }, 1],
  ])("%s → step %i", (_name, patch, step) => {
    expect(activeStep({ ...idle, ...patch })).toBe(step);
  });
});

describe("stepStates", () => {
  it("ticks finished steps and marks the active one", () => {
    expect(stepStates(3, false)).toEqual(["done", "done", "active", "todo"]);
  });

  it("ticks every step once the clips are ready", () => {
    expect(stepStates(4, true)).toEqual(["done", "done", "done", "done"]);
  });
});

describe("linkProblem (same list as backend/main.py SUPPORTED_URL_RE)", () => {
  it.each([
    ["https://www.youtube.com/watch?v=abc", null],
    ["youtu.be/abc", null],
    ["https://m.youtube.com/shorts/abc", null],
    ["https://vt.tiktok.com/ZS123/", null],
    ["https://www.instagram.com/reel/abc/", null],
    ["https://x.com/user/status/1", null],
    ["  ", "empty"],
    ["https://vimeo.com/123", "unsupported"],
    ["youtube.com", "unsupported"],
    ["hello", "unsupported"],
  ])("%s → %s", (text, problem) => {
    expect(linkProblem(text)).toBe(problem);
  });
});

describe("autoProjectTitle (the backend needs a unique title)", () => {
  const now = new Date(2026, 10, 20, 14, 5, 9);

  it("names a link after its site and the time", () => {
    expect(autoProjectTitle({ kind: "link", url: "https://youtu.be/abc" }, now)).toBe("YouTube 2026-11-20 14.05.09");
    expect(autoProjectTitle({ kind: "link", url: "https://www.tiktok.com/@a/video/1" }, now)).toBe("TikTok 2026-11-20 14.05.09");
  });

  it("names a file after the file, without characters a folder name cannot hold", () => {
    expect(autoProjectTitle({ kind: "file", name: "Podcast: Radit #12?.mp4" }, now)).toBe("Podcast Radit 12 2026-11-20 14.05.09");
  });
});

describe("effectiveProvider (spec 4.2: manual AI unless API key mode is on)", () => {
  it("uses manual AI by default and on platforms without API keys", () => {
    expect(effectiveProvider(CAPS.desktop, "manual", "openai")).toBe("manual_ai");
    expect(effectiveProvider(CAPS.cloud, "auto", "openai")).toBe("manual_ai");
  });

  it("uses the chosen provider in API key mode", () => {
    expect(effectiveProvider(CAPS.local, "auto", "gemini")).toBe("gemini");
  });
});
```

`src/lib/clipChoices.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { DEFAULT_CANVAS_CONFIG } from "../types/canvas";
import { CLIP_CHOICES_KEY, DEFAULT_CLIP_CHOICES, loadClipChoices, saveClipChoices } from "./clipChoices";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (k: string) => (k in data ? data[k] : null),
    setItem: (k: string, v: string) => {
      data[k] = v;
    },
  };
}

describe("remembered clip choices (spec 4.2)", () => {
  it("starts from good defaults", () => {
    expect(loadClipChoices(null)).toEqual(DEFAULT_CLIP_CHOICES);
    expect(DEFAULT_CLIP_CHOICES.aspectRatio).toBe("9:16");
    expect(DEFAULT_CLIP_CHOICES.burnSubtitles).toBe(true);
  });

  it("keeps the last choices for the next video", () => {
    const storage = memoryStorage();
    const choices = { ...DEFAULT_CLIP_CHOICES, aspectRatio: "1:1" as const, enableHook: true, maxClips: 5 };
    saveClipChoices(storage, choices);
    expect(loadClipChoices(storage)).toEqual(choices);
  });

  it("ignores damaged or unknown values", () => {
    expect(loadClipChoices(memoryStorage({ [CLIP_CHOICES_KEY]: "{not json" }))).toEqual(DEFAULT_CLIP_CHOICES);
    const odd = JSON.stringify({ aspectRatio: "4:5", maxClips: 7, enableHook: "yes", trackingMode: "left" });
    expect(loadClipChoices(memoryStorage({ [CLIP_CHOICES_KEY]: odd }))).toEqual(DEFAULT_CLIP_CHOICES);
  });

  it("does not carry a canvas image to the next video (it lives on one backend's disk)", () => {
    const storage = memoryStorage();
    const canvasConfig = { ...DEFAULT_CANVAS_CONFIG, enabled: true, background_type: "image" as const, background_image_path: "/work/bg.png" };
    saveClipChoices(storage, { ...DEFAULT_CLIP_CHOICES, aspectRatio: "16:9", canvasConfig });
    const loaded = loadClipChoices(storage);
    expect(loaded.canvasConfig.enabled).toBe(true);
    expect(loaded.canvasConfig.background_type).toBe("blur");
    expect(loaded.canvasConfig.background_image_path).toBe("");
  });

  it("survives blocked storage", () => {
    const blocked = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
    expect(loadClipChoices(blocked)).toEqual(DEFAULT_CLIP_CHOICES);
    expect(() => saveClipChoices(blocked, DEFAULT_CLIP_CHOICES)).not.toThrow();
  });
});
```

Run: `npx vitest run src/lib/createFlow.test.ts src/lib/clipChoices.test.ts` → FAIL (modules missing).

- [ ] **Step 2: Implement `src/lib/createFlow.ts`**

```ts
import type { Caps } from "../platform/types";

// The "Buat klip" flow (spec 4.2): which step is active, plus small helpers for step 1. No React.

/** Stages per step, named as in backend/stage_timer.py and timing.stage_*. */
export const PREPARE_STAGES = ["download", "extract_audio", "transcribe"] as const;
export const CHOOSE_STAGES = ["ai_analysis"] as const;
export const MAKE_STAGES = ["tracking", "render", "hook_concat", "publish"] as const;

export type FlowStep = 1 | 2 | 3 | 4;
export type StepState = "done" | "active" | "todo";

export interface FlowState {
  /** Status from useClipJobs: IDLE, GENERATING, PENDING, DOWNLOADING, TRANSCRIBING, CROPPING, DONE, ERROR. */
  status: string;
  running: boolean;
  /** `current.stage` of the job status, or null between stages. */
  currentStage: string | null;
  /** A project waits for the pasted AI answer. */
  awaitingAnswer: boolean;
  /** The running job started at clip making (answer sent, re-render), so "no stage yet" means step 4. */
  makePhase: boolean;
  /** This flow's clips are on screen. */
  hasClips: boolean;
}

const isIn = (list: readonly string[], stage: string | null) => !!stage && list.includes(stage);

export function activeStep(f: FlowState): FlowStep {
  if (f.awaitingAnswer) return 3;
  if (f.running) {
    if (isIn(CHOOSE_STAGES, f.currentStage)) return 3;
    if (isIn(MAKE_STAGES, f.currentStage) || f.status === "CROPPING" || f.makePhase) return 4;
    return 2;
  }
  return f.hasClips ? 4 : 1;
}

export function stepStates(active: FlowStep, finished: boolean): StepState[] {
  return ([1, 2, 3, 4] as const).map((n) =>
    n < active || (finished && n === active) ? "done" : n === active ? "active" : "todo",
  );
}

// Same sites as SUPPORTED_URL_RE in backend/main.py; change both together.
const SUPPORTED_LINK =
  /^(https?:\/\/)?(www\.|m\.)?(youtube\.com|youtu\.be|tiktok\.com|vt\.tiktok\.com|instagram\.com|x\.com|twitter\.com)\/.+/i;

export type LinkProblem = "empty" | "unsupported";

export function linkProblem(text: string): LinkProblem | null {
  const link = text.trim();
  if (!link) return "empty";
  return SUPPORTED_LINK.test(link) ? null : "unsupported";
}

export type VideoSourceName = { kind: "link"; url: string } | { kind: "file"; name: string };

const SITES: [RegExp, string][] = [
  [/youtube\.com|youtu\.be/i, "YouTube"],
  [/tiktok\.com/i, "TikTok"],
  [/instagram\.com/i, "Instagram"],
  [/(^|[/.])(x|twitter)\.com/i, "X"],
];

export function sourceName(source: VideoSourceName): string {
  if (source.kind === "file") return source.name.replace(/\.[^.]+$/, "") || "Video";
  return SITES.find(([re]) => re.test(source.url))?.[1] ?? "Video";
}

const pad = (n: number) => String(n).padStart(2, "0");

/** A unique project name, e.g. "YouTube 2026-11-20 14.05.09" (the backend wants a unique title). */
export function autoProjectTitle(source: VideoSourceName, now: Date): string {
  // Same characters backend/jobs.py sanitize_title keeps, so the folder name matches.
  const base =
    sourceName(source)
      .replace(/[^\w\s\-.,()[\]]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 60) || "Video";
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}.${pad(now.getMinutes())}.${pad(now.getSeconds())}`;
  return `${base} ${date} ${time}`;
}

export type AiMode = "manual" | "auto";
export const MANUAL_PROVIDER = "manual_ai";

/** Manual AI (copy, ask ChatGPT or Gemini, paste) unless API key mode is on where keys exist. */
export function effectiveProvider(caps: Pick<Caps, "apiKeys">, aiMode: AiMode, provider: string): string {
  return caps.apiKeys && aiMode === "auto" && provider ? provider : MANUAL_PROVIDER;
}
```

- [ ] **Step 3: Implement `src/lib/clipChoices.ts`**

```ts
import { DEFAULT_CANVAS_CONFIG, type CanvasConfig } from "../types/canvas";
import { DEFAULT_SUBTITLE_CONFIG, type SubtitleConfig } from "../types/subtitle";

// "Atur tampilan klip" (spec 4.2): good defaults, and the last choices are kept for the next video.

export type ShapeValue = "9:16" | "1:1" | "16:9";

export interface ClipChoices {
  aspectRatio: ShapeValue;
  trackingMode: "auto" | "center";
  burnSubtitles: boolean;
  subtitleConfig: SubtitleConfig;
  canvasConfig: CanvasConfig;
  enableHook: boolean;
  enableBroll: boolean;
  maxClips: number;
  isGamingVideo: boolean;
}

export const CLIP_CHOICES_KEY = "ac_clip_choices";
export const MAX_CLIP_OPTIONS = [0, 3, 5, 10, 15, 20];
const SHAPES: ShapeValue[] = ["9:16", "1:1", "16:9"];

export const DEFAULT_CLIP_CHOICES: ClipChoices = {
  aspectRatio: "9:16",
  trackingMode: "auto",
  burnSubtitles: true,
  subtitleConfig: DEFAULT_SUBTITLE_CONFIG,
  canvasConfig: DEFAULT_CANVAS_CONFIG,
  enableHook: false,
  enableBroll: false,
  maxClips: 0,
  isGamingVideo: false,
};

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

function merged<T extends object>(value: unknown, fallback: T): T {
  return isObject(value) ? { ...fallback, ...value } : fallback;
}

export function loadClipChoices(storage: Pick<Storage, "getItem"> | null): ClipChoices {
  let saved: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(storage?.getItem(CLIP_CHOICES_KEY) || "null");
    if (isObject(parsed)) saved = parsed;
  } catch {
    // Damaged or blocked: the defaults.
  }
  const d = DEFAULT_CLIP_CHOICES;
  const flag = (key: keyof ClipChoices) => (typeof saved[key] === "boolean" ? (saved[key] as boolean) : (d[key] as boolean));
  return {
    // "4:5" from before SP2 is not offered any more: back to vertical.
    aspectRatio: SHAPES.includes(saved.aspectRatio as ShapeValue) ? (saved.aspectRatio as ShapeValue) : d.aspectRatio,
    trackingMode: saved.trackingMode === "center" ? "center" : "auto",
    burnSubtitles: flag("burnSubtitles"),
    subtitleConfig: merged(saved.subtitleConfig, d.subtitleConfig),
    canvasConfig: merged(saved.canvasConfig, d.canvasConfig),
    enableHook: flag("enableHook"),
    enableBroll: flag("enableBroll"),
    maxClips: MAX_CLIP_OPTIONS.includes(saved.maxClips as number) ? (saved.maxClips as number) : d.maxClips,
    isGamingVideo: flag("isGamingVideo"),
  };
}

export function saveClipChoices(storage: Pick<Storage, "setItem"> | null, choices: ClipChoices): void {
  // A canvas image lives on one backend's disk (plan Spec gap 16): not carried to the next video.
  const canvasConfig: CanvasConfig =
    choices.canvasConfig.background_type === "image"
      ? { ...choices.canvasConfig, background_type: "blur", background_image_path: "" }
      : choices.canvasConfig;
  try {
    storage?.setItem(CLIP_CHOICES_KEY, JSON.stringify({ ...choices, canvasConfig }));
  } catch {
    // Storage blocked: the choices still apply to this video.
  }
}
```

- [ ] **Step 4: Run the tests**

`npx vitest run src/lib/createFlow.test.ts src/lib/clipChoices.test.ts` → PASS (createFlow 11 + 2 + 10 + 2 + 2 = 27, clipChoices 5). Whole suite → 183 passing (151 + 32; record the printed total). `npx oxlint src` 0 errors. `npm run build` exit 0.

- [ ] **Step 5: Log and commit**

PROGRESS-LOG entry; ledger `Task 6: complete (...)`.

```bash
git add src/lib/createFlow.ts src/lib/createFlow.test.ts src/lib/clipChoices.ts src/lib/clipChoices.test.ts tasks/PROGRESS-LOG.md tasks/sp2-ledger.md
git commit -m "feat(sp2): flow logic for the four steps, link check, auto title and remembered choices

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 7: Preflight notices and blocking card

Spec 4.4 (last bullet) and spec 1 ("Hasil pemeriksaan awal SP0 belum ditampilkan"). The create screen calls `GET /api/preflight` when it opens and again when the connection comes back. `warn` results show as small notes; a `block` result shows as an error card with "Periksa lagi", and Mulai stays off until a check passes.

**Files:**
- Create: `src/lib/preflight.ts`, `src/lib/preflight.test.ts`
- Create: `src/hooks/usePreflight.ts`, `src/hooks/usePreflight.test.tsx`
- Create: `src/components/create/PreflightNotices.tsx`, `src/components/create/PreflightNotices.test.tsx`
- Modify: `src/locales/{id,en}.json` (`create.recheck`, `create.notes_label`)

**Interfaces:**
- Consumes: `GET /api/preflight` → `{status, checks: [{id, level: "ok"|"warn"|"block", title, message, title_en, message_en, code?, technical?}]}` (`backend/main.py api_preflight`); `ErrorCard`; `localizedText`, `toLang` (`src/lib/errorInfo.ts`); `JobWarning`, `ErrorInfo` (`src/types/errorInfo.ts`).
- Produces:
  - `splitPreflight(checks: unknown): { notes: JobWarning[]; blockers: ErrorInfo[] }`, `blockerInfo(check: JobWarning): ErrorInfo` (`src/lib/preflight.ts`)
  - `usePreflight(connected: boolean): { state: "loading" | "ready" | "unavailable"; notes: JobWarning[]; blockers: ErrorInfo[]; recheck: () => void }`
  - `<PreflightNotices notes blockers checking onRecheck />`

- [ ] **Step 1: Write the failing tests**

`src/lib/preflight.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { blockerInfo, splitPreflight } from "./preflight";

const check = (id: string, level: string, extra: Record<string, string> = {}) => ({
  id, level, title: `t-${id}`, message: `m-${id}`, title_en: `te-${id}`, message_en: `me-${id}`, ...extra,
});

describe("splitPreflight (spec 4.4)", () => {
  it("keeps warnings as notes and blocks as error cards, and drops passed checks", () => {
    const result = splitPreflight([check("disk", "ok"), check("gpu", "warn"), check("ffmpeg", "block", { code: "FFMPEG_MISSING", technical: "not on PATH" })]);
    expect(result.notes.map((n) => n.id)).toEqual(["gpu"]);
    expect(result.blockers).toEqual([
      { code: "FFMPEG_MISSING", title: "t-ffmpeg", message: "m-ffmpeg", title_en: "te-ffmpeg", message_en: "me-ffmpeg", actions: [], technical: "not on PATH" },
    ]);
  });

  it("survives a missing or odd answer", () => {
    expect(splitPreflight(undefined)).toEqual({ notes: [], blockers: [] });
    expect(splitPreflight([null, "x", 3])).toEqual({ notes: [], blockers: [] });
  });

  it("names a blocker by its check id when it has no error code", () => {
    expect(blockerInfo(check("drive", "block")).code).toBe("drive");
  });
});
```

`src/hooks/usePreflight.test.tsx`:

```tsx
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import axios from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePreflight } from "./usePreflight";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let latest: ReturnType<typeof usePreflight>;
function Probe({ connected }: { connected: boolean }) {
  latest = usePreflight(connected);
  return null;
}

describe("usePreflight", () => {
  let root: Root;

  beforeEach(() => {
    root = createRoot(document.createElement("div"));
  });

  afterEach(() => {
    act(() => root.unmount());
    vi.restoreAllMocks();
  });

  it("checks on open, again when the connection comes back, and on request", async () => {
    const get = vi.spyOn(axios, "get").mockResolvedValue({ data: { checks: [{ id: "gpu", level: "warn", title: "t", message: "m" }] } });
    await act(async () => root.render(<Probe connected />));
    expect(get).toHaveBeenCalledTimes(1);
    expect(String(get.mock.calls[0][0])).toMatch(/\/api\/preflight$/);
    expect(latest.state).toBe("ready");
    expect(latest.notes).toHaveLength(1);

    await act(async () => root.render(<Probe connected={false} />));
    await act(async () => root.render(<Probe connected />));
    expect(get).toHaveBeenCalledTimes(2);

    await act(async () => latest.recheck());
    expect(get).toHaveBeenCalledTimes(3);
  });

  it("does not block the start when the check itself cannot run", async () => {
    vi.spyOn(axios, "get").mockRejectedValue(new Error("offline"));
    await act(async () => root.render(<Probe connected />));
    expect(latest.state).toBe("unavailable");
    expect(latest.blockers).toEqual([]);
  });
});
```

`src/components/create/PreflightNotices.test.tsx`:

```tsx
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../../i18n";
import { CAPS, setPlatform, type Platform } from "../../platform";
import { PreflightNotices } from "./PreflightNotices";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const blocker = { code: "FFMPEG_MISSING", title: "FFmpeg tidak ada", message: "Pasang ulang.", title_en: "", message_en: "", actions: [], technical: "" };
const note = { id: "gpu", level: "warn", title: "Tanpa GPU", message: "Proses lebih lama." };

describe("PreflightNotices", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    setPlatform({ caps: CAPS.desktop } as Platform);
    container = document.createElement("div");
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    setPlatform(null);
  });

  it("shows a blocker as an error card with a check-again button", () => {
    const onRecheck = vi.fn();
    act(() => root.render(<PreflightNotices notes={[]} blockers={[blocker]} checking={false} onRecheck={onRecheck} />));
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("FFmpeg tidak ada");
    const button = [...container.querySelectorAll("button")].find((b) => b.textContent === i18n.t("create.recheck"))!;
    act(() => button.click());
    expect(onRecheck).toHaveBeenCalledTimes(1);
  });

  it("shows a warning as a small note and nothing when all is fine", () => {
    act(() => root.render(<PreflightNotices notes={[note]} blockers={[]} checking={false} onRecheck={vi.fn()} />));
    expect(container.textContent).toContain("Tanpa GPU");
    expect(container.querySelector('[role="alert"]')).toBeNull();
    act(() => root.render(<PreflightNotices notes={[]} blockers={[]} checking={false} onRecheck={vi.fn()} />));
    expect(container.innerHTML).toBe("");
  });
});
```

Run: `npx vitest run src/lib/preflight.test.ts src/hooks/usePreflight.test.tsx src/components/create` → FAIL (modules missing).

- [ ] **Step 2: Implement**

`src/lib/preflight.ts`:

```ts
import type { ErrorInfo, JobWarning } from "../types/errorInfo";

// GET /api/preflight results (backend/preflight.py) for the create screen (spec 4.4):
// "warn" becomes a small note, "block" an error card that keeps Mulai off.

export interface PreflightSplit {
  notes: JobWarning[];
  blockers: ErrorInfo[];
}

export function blockerInfo(check: JobWarning): ErrorInfo {
  return {
    code: check.code || check.id,
    title: check.title,
    message: check.message,
    title_en: check.title_en || "",
    message_en: check.message_en || "",
    actions: [],
    technical: check.technical || "",
  };
}

export function splitPreflight(checks: unknown): PreflightSplit {
  const result: PreflightSplit = { notes: [], blockers: [] };
  if (!Array.isArray(checks)) return result;
  for (const item of checks) {
    if (!item || typeof item !== "object") continue;
    const check = item as JobWarning;
    if (check.level === "warn") result.notes.push(check);
    else if (check.level === "block") result.blockers.push(blockerInfo(check));
  }
  return result;
}
```

`src/hooks/usePreflight.ts`:

```ts
import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { API_URL } from "../platform/backendUrl";
import { splitPreflight, type PreflightSplit } from "../lib/preflight";

export type PreflightState = "loading" | "ready" | "unavailable";

/** Runs the environment check when the create screen opens, when the connection comes back, and on request. */
export function usePreflight(connected: boolean) {
  const [state, setState] = useState<PreflightState>("loading");
  const [split, setSplit] = useState<PreflightSplit>({ notes: [], blockers: [] });
  const [round, setRound] = useState(0);
  const recheck = useCallback(() => setRound((n) => n + 1), []);

  useEffect(() => {
    if (!connected) return;
    let active = true;
    setState("loading");
    axios
      .get(`${API_URL}/api/preflight`, { timeout: 30000 })
      .then((res) => {
        if (!active) return;
        setSplit(splitPreflight(res.data?.checks));
        setState("ready");
      })
      .catch((err) => {
        if (!active) return;
        // The check could not run (backend gone): the connection banner explains it; nothing is blocked here.
        console.error("Preflight check failed:", err);
        setSplit({ notes: [], blockers: [] });
        setState("unavailable");
      });
    return () => {
      active = false;
    };
  }, [connected, round]);

  return { state, ...split, recheck };
}
```

`src/components/create/PreflightNotices.tsx`:

```tsx
import React from "react";
import { useTranslation } from "react-i18next";
import { RefreshCw } from "lucide-react";
import type { ErrorInfo, JobWarning } from "../../types/errorInfo";
import { localizedText, toLang } from "../../lib/errorInfo";
import { ErrorCard } from "../ErrorCard";
import { Button } from "../ui/Button";

interface PreflightNoticesProps {
  notes: JobWarning[];
  blockers: ErrorInfo[];
  checking: boolean;
  onRecheck: () => void;
}

/** Spec 4.4: notes above the start button; a blocking problem as an error card with "Periksa lagi". */
export const PreflightNotices: React.FC<PreflightNoticesProps> = ({ notes, blockers, checking, onRecheck }) => {
  const { t, i18n } = useTranslation();
  if (notes.length === 0 && blockers.length === 0) return null;
  const lang = toLang(i18n.language);
  return (
    <div className="flex flex-col gap-3">
      {blockers.map((info) => (
        <ErrorCard key={info.code} info={info} announce>
          <Button icon={RefreshCw} loading={checking} onClick={onRecheck}>
            {t("create.recheck")}
          </Button>
        </ErrorCard>
      ))}
      {notes.length > 0 && (
        <ul aria-label={t("create.notes_label")} className="flex flex-col gap-2">
          {notes.map((note) => {
            const { title, message } = localizedText(note, lang);
            return (
              <li key={note.id} className="rounded-card border border-border bg-bg-surface p-3">
                <p className="text-body font-semibold text-text-primary">{title}</p>
                {message && <p className="text-body text-text-primary">{message}</p>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
```

Texts (`node scripts/add-locale-keys.mjs`):

```json
{
  "id": { "create": { "recheck": "Periksa lagi", "notes_label": "Catatan sebelum mulai" } },
  "en": { "create": { "recheck": "Check again", "notes_label": "Notes before you start" } }
}
```

- [ ] **Step 3: Run the tests and checks**

`npx vitest run src/lib/preflight.test.ts src/hooks/usePreflight.test.tsx src/components/create` → PASS (3 + 2 + 2). Whole suite → 190 passing (record the total). `npx oxlint src` 0 errors (the `set-state-in-effect` warning in `usePreflight` is accepted, like `LocalGate`). `npm run build` exit 0.

- [ ] **Step 4: Log and commit**

PROGRESS-LOG entry; ledger `Task 7: complete (...)`.

```bash
git add src/lib/preflight.ts src/lib/preflight.test.ts src/hooks/usePreflight.ts src/hooks/usePreflight.test.tsx src/components/create src/locales tasks/PROGRESS-LOG.md tasks/sp2-ledger.md
git commit -m "feat(sp2): preflight notes and blocking card for the create screen

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Step 1 screen (`CreatePage`, `VideoStep`, `ClipOptions`, `pickVideo()`)

Spec 4.2 step 1, 4.7 (`pickVideo()` used, SP1 review M6) and 5 (field validation under the field). One page replaces Workspace and Manual AI Editor: a step indicator, the video choice (link checked as you type, "Pilih file video" through `platform().pickVideo()`, "Pilih dari Google Drive" on cloud), the always-visible "Bentuk klip", the collapsed "Atur tampilan klip" with remembered values, preflight notes, and Mulai. The provider is manual AI unless API key mode is on (Spec gap 12); the project name is made automatically when left empty (Spec gap 5). Steps 2–4 still use the old overlay and the History redirect until Tasks 10 and 11.

**Files:**
- Create: `src/components/create/StepIndicator.tsx`, `VideoStep.tsx`, `ClipOptions.tsx`, `VideoStep.test.tsx`, `ClipOptions.test.tsx`
- Create: `src/pages/CreatePage.tsx`
- Modify: `src/App.tsx` (clip choices state, `aiMode`, index route), `src/hooks/useUserSettings.ts` (`aiMode`), `src/hooks/useClipJobs.ts` (`handleGenerate(overrideProvider?, overrideTitle?)`)
- Delete: `src/pages/WorkspacePage.tsx`, `src/pages/ManualAIEditorPage.tsx`, `src/components/GenerateForm.tsx`
- Modify: `src/locales/{id,en}.json` (`create.*`)

**Interfaces:**
- Consumes: `activeStep`, `stepStates`, `linkProblem`, `autoProjectTitle`, `effectiveProvider`, `FlowState`, `FlowStep`, `VideoSourceName`, `AiMode` (Task 6); `ClipChoices`, `ShapeValue`, `loadClipChoices`, `saveClipChoices`, `MAX_CLIP_OPTIONS` (Task 6); `usePreflight`, `PreflightNotices` (Task 7); `useBackendStatus` (Task 5); `platform().pickVideo()`; `fileName` (`src/platform/paths.ts`); `ErrorCard`, `useErrorActions`, `ClipsResult`.
- Produces:
  - `<StepIndicator states={StepState[]} />`
  - `<VideoStep link onLinkChange chosenFile onClearFile onPickFile onPickDrive? shape onShapeChange pickButtonRef? />`
  - `<ClipOptions choices onChange={(patch: Partial<ClipChoices>) => void} title onTitleChange quality onQualityChange showQuality hasPexelsKey />`
  - App context (consumed by Tasks 10–14): `choices`, `patchChoices(patch)`, `aiMode`, `setAiMode(mode)`, plus the old setters (`setAspectRatio`, `setBurnSubtitles`, `setCanvasConfig`, `setSubtitleConfig`, `setCaptionStyle`, `setTrackingMode`, `setEnableHook`, `setEnableBroll`, `setMaxClips`, `setIsGamingVideo`) now writing into `choices`.
  - `useClipJobs.handleGenerate(overrideProvider?: string, overrideTitle?: string)`.
  - `CreatePage` reads, when present, `ctx.current` (Task 10), `ctx.awaiting` (Task 11), `ctx.makePhase` (Task 10), `ctx.resultJobId` (Task 12); absent values count as empty.

- [ ] **Step 1: Write the failing tests**

`src/components/create/VideoStep.test.tsx`:

```tsx
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../../i18n";
import { VideoStep } from "./VideoStep";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const base = {
  link: "", onLinkChange: vi.fn(), chosenFile: null, onClearFile: vi.fn(), onPickFile: vi.fn(),
  shape: "9:16" as const, onShapeChange: vi.fn(),
};

describe("VideoStep (spec 4.2 step 1)", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    root = createRoot(container);
  });

  afterEach(() => act(() => root.unmount()));

  const render = (props: Partial<typeof base> & { onPickDrive?: () => void }) =>
    act(() => root.render(<VideoStep {...base} {...props} />));
  const button = (label: string) => [...container.querySelectorAll("button")].find((b) => b.textContent === label)!;

  it("says under the field when a link cannot be used", () => {
    render({ link: "https://vimeo.com/1" });
    const input = container.querySelector("input[type='url']")!;
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(document.getElementById(input.getAttribute("aria-describedby")!)?.textContent ?? container.textContent).toContain(
      i18n.t("create.link_unsupported"),
    );
  });

  it("accepts a YouTube link without a message", () => {
    render({ link: "https://youtu.be/abc" });
    expect(container.textContent).not.toContain(i18n.t("create.link_unsupported"));
    expect(container.querySelector("input[type='url']")!.getAttribute("aria-invalid")).toBeNull();
  });

  it("picks a file, and offers Google Drive only where it exists", () => {
    const onPickFile = vi.fn();
    render({ onPickFile });
    act(() => button(i18n.t("create.pick_file")).click());
    expect(onPickFile).toHaveBeenCalledTimes(1);
    expect(container.textContent).not.toContain(i18n.t("create.pick_drive"));
    const onPickDrive = vi.fn();
    render({ onPickDrive });
    act(() => button(i18n.t("create.pick_drive")).click());
    expect(onPickDrive).toHaveBeenCalledTimes(1);
  });

  it("shows the chosen file instead of the link box, with a way to change it", () => {
    const onClearFile = vi.fn();
    render({ chosenFile: "podcast.mp4", onClearFile });
    expect(container.textContent).toContain(i18n.t("create.chosen_file", { name: "podcast.mp4" }));
    expect(container.querySelector("input[type='url']")).toBeNull();
    act(() => button(i18n.t("create.clear_file")).click());
    expect(onClearFile).toHaveBeenCalledTimes(1);
  });

  it("offers the three clip shapes, vertical first", () => {
    const onShapeChange = vi.fn();
    render({ onShapeChange });
    const radios = [...container.querySelectorAll<HTMLInputElement>("input[type='radio']")];
    expect(radios.map((r) => r.value)).toEqual(["9:16", "1:1", "16:9"]);
    expect(radios[0].checked).toBe(true);
    act(() => radios[1].click());
    expect(onShapeChange).toHaveBeenCalledWith("1:1");
  });
});
```

`src/components/create/ClipOptions.test.tsx`:

```tsx
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../../i18n";
import { DEFAULT_CLIP_CHOICES } from "../../lib/clipChoices";
import { CAPS, setPlatform, type Platform } from "../../platform";
import { ClipOptions } from "./ClipOptions";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const props = {
  choices: DEFAULT_CLIP_CHOICES, onChange: vi.fn(), title: "", onTitleChange: vi.fn(),
  quality: "best", onQualityChange: vi.fn(), showQuality: true, hasPexelsKey: false,
};

describe("ClipOptions (Atur tampilan klip)", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    setPlatform(null);
  });

  it("is closed by default and holds the advanced choices", () => {
    setPlatform({ caps: CAPS.desktop } as Platform);
    act(() => root.render(<ClipOptions {...props} />));
    const details = container.querySelector("details")!;
    expect(details.open).toBe(false);
    expect(details.querySelector("summary")!.textContent).toBe(i18n.t("create.options"));
    expect(container.textContent).toContain(i18n.t("create.hook"));
    expect(container.textContent).toContain(i18n.t("create.max_clips"));
  });

  it("hides B-roll where there are no API keys", () => {
    setPlatform({ caps: CAPS.cloud } as Platform);
    act(() => root.render(<ClipOptions {...props} />));
    expect(container.textContent).not.toContain(i18n.t("create.broll"));
  });
});
```

Run: `npx vitest run src/components/create` → the new files FAIL (modules missing).

- [ ] **Step 2: `aiMode` setting and `handleGenerate` title**

`src/hooks/useUserSettings.ts`: import `type AiMode` from `../lib/createFlow`; add

```ts
  const [aiMode, setAiMode] = useState<AiMode>(() => (localStorage.getItem("ac_ai_mode") === "auto" ? "auto" : "manual"));
```

an effect `useEffect(() => { localStorage.setItem("ac_ai_mode", aiMode); }, [aiMode]);`, and return `aiMode, setAiMode`.

`src/hooks/useClipJobs.ts`, `handleGenerate`:
- signature `const handleGenerate = async (overrideProvider?: string, overrideTitle?: string) => {`
- add as the first line `const title = (overrideTitle ?? p.title ?? "").trim();`
- the title check becomes `if (!title) {` (same toast)
- the request body uses `title,` instead of `title: p.title,`.

- [ ] **Step 3: Step indicator**

`src/components/create/StepIndicator.tsx`:

```tsx
import React from "react";
import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";
import type { StepState } from "../../lib/createFlow";

const STEP_KEYS = ["create.step_video", "create.step_prepare", "create.step_choose", "create.step_clips"];

/** 1 Video → 2 Siapkan → 3 Pilih momen → 4 Klip (spec 4.2). On a phone only the active step shows its name. */
export const StepIndicator: React.FC<{ states: StepState[] }> = ({ states }) => {
  const { t } = useTranslation();
  return (
    <ol aria-label={t("create.steps_label")} className="flex items-center gap-2">
      {STEP_KEYS.map((key, i) => {
        const state = states[i];
        return (
          <li key={key} aria-current={state === "active" ? "step" : undefined} className="flex min-w-0 items-center gap-2">
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-label ${
                state === "active"
                  ? "bg-accent text-on-accent"
                  : state === "done"
                    ? "bg-accent-muted text-accent"
                    : "border border-border-active text-text-secondary"
              }`}
            >
              {state === "done" ? <Check className="h-4 w-4" aria-hidden="true" /> : i + 1}
            </span>
            <span className={`text-label ${state === "active" ? "font-semibold text-text-primary" : "sr-only sm:not-sr-only text-text-secondary"}`}>
              {t(key)}
              {state === "done" && <span className="sr-only">{t("create.step_done_sr")}</span>}
            </span>
            {i < STEP_KEYS.length - 1 && <span aria-hidden="true" className="h-px w-4 shrink-0 bg-border-active sm:w-6" />}
          </li>
        );
      })}
    </ol>
  );
};
```

- [ ] **Step 4: Video step**

`src/components/create/VideoStep.tsx`:

```tsx
import React from "react";
import { useTranslation } from "react-i18next";
import { FileVideo, HardDrive } from "lucide-react";
import { linkProblem } from "../../lib/createFlow";
import type { ShapeValue } from "../../lib/clipChoices";
import { Button } from "../ui/Button";
import { InputGroup } from "../ui/InputGroup";

const SHAPES: { value: ShapeValue; key: string; box: string }[] = [
  { value: "9:16", key: "create.shape_vertical", box: "h-6 w-[14px]" },
  { value: "1:1", key: "create.shape_square", box: "h-5 w-5" },
  { value: "16:9", key: "create.shape_wide", box: "h-[14px] w-6" },
];

export interface VideoStepProps {
  link: string;
  onLinkChange: (value: string) => void;
  /** Name of the chosen file (upload or Drive), or null when a link is used. */
  chosenFile: string | null;
  onClearFile: () => void;
  onPickFile: () => void;
  /** Cloud only (caps.driveBrowser). */
  onPickDrive?: () => void;
  shape: ShapeValue;
  onShapeChange: (shape: ShapeValue) => void;
  pickButtonRef?: React.Ref<HTMLButtonElement>;
}

/** Step 1 (spec 4.2): which video, and which clip shape. */
export const VideoStep: React.FC<VideoStepProps> = ({
  link, onLinkChange, chosenFile, onClearFile, onPickFile, onPickDrive, shape, onShapeChange, pickButtonRef,
}) => {
  const { t } = useTranslation();
  const problem = link.trim() ? linkProblem(link) : null;

  return (
    <section className="flex flex-col gap-5 rounded-card border border-border bg-bg-secondary p-4 md:p-6">
      {chosenFile ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-body text-text-primary break-all">{t("create.chosen_file", { name: chosenFile })}</p>
          <Button variant="outline" onClick={onClearFile}>{t("create.clear_file")}</Button>
        </div>
      ) : (
        <InputGroup
          type="url"
          inputMode="url"
          autoComplete="off"
          label={t("create.link_label")}
          placeholder="https://youtube.com/…"
          value={link}
          onChange={(e) => onLinkChange(e.target.value)}
          error={problem !== null}
          helperText={problem ? t("create.link_unsupported") : undefined}
        />
      )}

      <div className="flex flex-col gap-3">
        <p className="text-label text-text-secondary">{t("create.or")}</p>
        <div className="flex flex-col gap-3 sm:flex-row">
          {/* Icons tell a file from Google Drive at a glance; the text says it. */}
          <Button ref={pickButtonRef} variant="outline" icon={FileVideo} onClick={onPickFile}>
            {t("create.pick_file")}
          </Button>
          {onPickDrive && (
            <Button variant="outline" icon={HardDrive} onClick={onPickDrive}>
              {t("create.pick_drive")}
            </Button>
          )}
        </div>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-label text-text-primary">{t("create.shape_label")}</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {SHAPES.map(({ value, key, box }) => (
            <label
              key={value}
              className={`flex min-h-[56px] cursor-pointer items-center gap-3 rounded-card border p-3 ${
                shape === value ? "border-accent bg-accent-muted" : "border-border-active bg-bg-secondary hover:bg-bg-surface"
              }`}
            >
              <input
                type="radio"
                name="clip-shape"
                value={value}
                checked={shape === value}
                onChange={() => onShapeChange(value)}
                className="h-5 w-5 shrink-0 accent-[var(--accent)]"
              />
              {/* The outline shows the shape itself: it is the meaning, not decoration. */}
              <span aria-hidden="true" className={`shrink-0 rounded-sm border-2 border-current text-text-secondary ${box}`} />
              <span className="text-body text-text-primary">{t(key)}</span>
            </label>
          ))}
        </div>
      </fieldset>
    </section>
  );
};
```

- [ ] **Step 5: Clip options**

`src/components/create/ClipOptions.tsx`:

```tsx
import React from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown } from "lucide-react";
import { MAX_CLIP_OPTIONS, type ClipChoices } from "../../lib/clipChoices";
import { platform } from "../../platform";
import { CanvasConfigControls } from "../ui/CanvasConfigControls";
import { InputGroup } from "../ui/InputGroup";
import { Select } from "../ui/Select";
import { SubtitleConfigControls } from "../ui/SubtitleConfigControls";
import { ToggleSwitch } from "../ui/ToggleSwitch";

export interface ClipOptionsProps {
  choices: ClipChoices;
  onChange: (patch: Partial<ClipChoices>) => void;
  title: string;
  onTitleChange: (title: string) => void;
  quality: string;
  onQualityChange: (quality: string) => void;
  /** Download quality only matters for links. */
  showQuality: boolean;
  hasPexelsKey: boolean;
}

const QUALITIES = ["2160p", "1440p", "1080p", "720p", "480p"];

function Row({ label, help, children }: { label?: string; help?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-t border-border pt-4">
      {label && <p className="text-label text-text-primary">{label}</p>}
      {children}
      {help && <p className="text-caption text-text-secondary">{help}</p>}
    </div>
  );
}

/** "Atur tampilan klip" (spec 4.2): closed by default, good defaults, remembered by App. */
export const ClipOptions: React.FC<ClipOptionsProps> = ({
  choices, onChange, title, onTitleChange, quality, onQualityChange, showQuality, hasPexelsKey,
}) => {
  const { t } = useTranslation();
  const caps = platform().caps;
  const wide = choices.aspectRatio === "16:9";

  return (
    <details className="group rounded-card border border-border bg-bg-secondary">
      <summary className="flex min-h-[52px] cursor-pointer list-none items-center justify-between gap-3 px-4 text-body font-semibold text-text-primary [&::-webkit-details-marker]:hidden">
        {t("create.options")}
        <ChevronDown className="h-5 w-5 shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="flex flex-col gap-4 px-4 pb-4">
        <InputGroup
          label={t("create.project_name")}
          helperText={t("create.project_name_help")}
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
        />

        <Row>
          <ToggleSwitch label={t("create.subtitles")} checked={choices.burnSubtitles} onChange={(v) => onChange({ burnSubtitles: v })} />
          {choices.burnSubtitles && (
            <SubtitleConfigControls
              config={choices.subtitleConfig}
              onChange={(subtitleConfig) => onChange({ subtitleConfig })}
              showModeSwitch={true}
              aspectRatio={choices.aspectRatio}
            />
          )}
        </Row>

        {wide ? (
          <Row>
            <CanvasConfigControls config={choices.canvasConfig} onChange={(canvasConfig) => onChange({ canvasConfig })} showModeSwitch={true} />
          </Row>
        ) : (
          <Row label={t("create.face_label")}>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {(["auto", "center"] as const).map((mode) => (
                <label key={mode} className="flex min-h-[44px] cursor-pointer items-center gap-3">
                  <input
                    type="radio"
                    name="tracking-mode"
                    checked={choices.trackingMode === mode}
                    onChange={() => onChange({ trackingMode: mode })}
                    className="h-5 w-5 accent-[var(--accent)]"
                  />
                  <span className="text-body">{t(mode === "auto" ? "create.face_follow" : "create.face_center")}</span>
                </label>
              ))}
            </div>
          </Row>
        )}

        <Row help={t("create.hook_help")}>
          <ToggleSwitch label={t("create.hook")} checked={choices.enableHook} onChange={(v) => onChange({ enableHook: v })} />
        </Row>

        {caps.apiKeys && (
          <Row help={t(hasPexelsKey ? "create.broll_help" : "create.broll_needs_key")}>
            <ToggleSwitch
              label={t("create.broll")}
              checked={choices.enableBroll && hasPexelsKey}
              disabled={!hasPexelsKey}
              onChange={(v) => onChange({ enableBroll: v })}
            />
          </Row>
        )}

        {choices.aspectRatio === "9:16" && (
          <Row help={t("create.game_help")}>
            <ToggleSwitch label={t("create.game")} checked={choices.isGamingVideo} onChange={(v) => onChange({ isGamingVideo: v })} />
          </Row>
        )}

        {showQuality && (
          <Select
            label={t("create.quality")}
            value={quality}
            onChange={(e) => onQualityChange(e.target.value)}
            options={[
              { label: t("create.quality_auto"), value: "best" },
              ...QUALITIES.map((q) => ({ label: q === "2160p" ? "2160p (4K)" : q === "1440p" ? "1440p (2K)" : q, value: q })),
            ]}
          />
        )}

        <Select
          label={t("create.max_clips")}
          value={String(choices.maxClips)}
          onChange={(e) => onChange({ maxClips: Number(e.target.value) })}
          options={MAX_CLIP_OPTIONS.map((n) => ({ label: n === 0 ? t("create.max_clips_auto") : String(n), value: String(n) }))}
        />
      </div>
    </details>
  );
};
```

- [ ] **Step 6: The page**

`src/pages/CreatePage.tsx`:

```tsx
import React, { useContext, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppContext } from "../App";
import ClipsResult from "../components/ClipsResult";
import { ErrorCard } from "../components/ErrorCard";
import { ClipOptions } from "../components/create/ClipOptions";
import { PreflightNotices } from "../components/create/PreflightNotices";
import { StepIndicator } from "../components/create/StepIndicator";
import { VideoStep } from "../components/create/VideoStep";
import { Button } from "../components/ui/Button";
import { useBackendStatus } from "../hooks/useBackendStatus";
import { useErrorActions } from "../hooks/useErrorActions";
import { usePreflight } from "../hooks/usePreflight";
import { activeStep, autoProjectTitle, effectiveProvider, linkProblem, stepStates, type FlowState, type FlowStep, type VideoSourceName } from "../lib/createFlow";
import { platform } from "../platform";
import { fileName } from "../platform/paths";

const LOCAL_PREFIX = "local:";

/** "Buat klip" (spec 4.2): one screen, four steps. */
export const CreatePage: React.FC = () => {
  const { t } = useTranslation();
  const ctx = useContext(AppContext);
  const caps = platform().caps;
  const { status: backend } = useBackendStatus();
  const connected = backend === "connected";
  const preflight = usePreflight(connected);
  const pickButton = useRef<HTMLButtonElement>(null);

  const flow: FlowState = {
    status: ctx.status,
    running: ctx.isRunning,
    currentStage: ctx.current?.stage ?? null,
    awaitingAnswer: !!ctx.awaiting,
    makePhase: !!ctx.makePhase,
    hasClips: (ctx.clips?.length ?? 0) > 0,
  };
  const step = activeStep(flow);
  const finished = ctx.status === "DONE" && flow.hasClips;

  // Spec 5: an error shows at the step where the job stopped.
  const [stoppedAt, setStoppedAt] = useState<FlowStep>(2);
  useEffect(() => {
    if (flow.running) setStoppedAt(step);
  }, [flow.running, step]);
  const failed = ctx.status === "ERROR" && !!ctx.errorMsg;
  const shownStep: FlowStep = failed ? stoppedAt : step;

  // "Unggah file video" on an error card elsewhere: bring the user to the file button.
  useEffect(() => {
    if (!ctx.pendingLocalUpload) return;
    pickButton.current?.focus();
    ctx.clearPendingLocalUpload();
  }, [ctx.pendingLocalUpload]);

  const localPath = ctx.inputType === "url" && ctx.url.startsWith(LOCAL_PREFIX) ? ctx.url.slice(LOCAL_PREFIX.length) : null;
  const chosenFile: string | null =
    ctx.inputType === "local" && ctx.localFile ? ctx.localFile.name : localPath ? fileName(localPath) : null;
  const hasVideo = !!chosenFile || linkProblem(ctx.url) === null;
  const canStart = hasVideo && connected && preflight.blockers.length === 0 && !ctx.isRunning;
  const jobErrorActions = useErrorActions({ jobId: ctx.failedJobId, origin: "workspace" });

  const setLink = (value: string) => {
    ctx.setInputType("url");
    ctx.setLocalFile(null);
    ctx.setUrl(value);
  };

  const clearFile = () => setLink("");

  // Called straight from the click, so the browser file dialog is allowed to open.
  const pickFile = async () => {
    const picked = await platform().pickVideo();
    if (!picked) return;
    if (picked.kind === "file") {
      ctx.setLocalFile(picked.file);
      ctx.setInputType("local");
    } else {
      setLink(`${LOCAL_PREFIX}${picked.path}`);
    }
  };

  const start = () => {
    const source: VideoSourceName = chosenFile ? { kind: "file", name: chosenFile } : { kind: "link", url: ctx.url };
    const title = ctx.title.trim() || autoProjectTitle(source, new Date());
    ctx.handleGenerate(effectiveProvider(caps, ctx.aiMode, ctx.provider), title);
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <h1 className="text-page-title text-text-primary">{t("create.title")}</h1>
      <StepIndicator states={stepStates(shownStep, finished)} />

      {failed && ctx.errorInfo && <ErrorCard info={ctx.errorInfo} handlers={jobErrorActions} announce />}

      {step === 1 && (
        <>
          <VideoStep
            link={localPath ? "" : ctx.url}
            onLinkChange={setLink}
            chosenFile={chosenFile}
            onClearFile={clearFile}
            onPickFile={() => void pickFile()}
            onPickDrive={caps.driveBrowser ? () => ctx.requestDriveBrowser() : undefined}
            shape={ctx.choices.aspectRatio}
            onShapeChange={(aspectRatio) => ctx.patchChoices({ aspectRatio })}
            pickButtonRef={pickButton}
          />
          <ClipOptions
            choices={ctx.choices}
            onChange={ctx.patchChoices}
            title={ctx.title}
            onTitleChange={ctx.setTitle}
            quality={ctx.quality}
            onQualityChange={ctx.setQuality}
            showQuality={!chosenFile}
            hasPexelsKey={!!ctx.apiKeys?.pexels}
          />
          <PreflightNotices
            notes={preflight.notes}
            blockers={preflight.blockers}
            checking={preflight.state === "loading"}
            onRecheck={preflight.recheck}
          />
          {!failed && ctx.errorInfo && <ErrorCard info={ctx.errorInfo} handlers={jobErrorActions} announce />}
          {/* A request that failed without error_info (old backend): its own words, as before SP2. */}
          {ctx.errorMsg && !ctx.errorInfo && (
            <p role="alert" className="text-body text-error break-words">{ctx.errorMsg}</p>
          )}
          <div className="flex flex-col gap-2">
            <Button size="lg" className="w-full sm:w-auto sm:self-start" disabled={!canStart} onClick={start}>
              {t("create.start")}
            </Button>
            {!hasVideo && <p className="text-body text-text-secondary">{t("create.start_hint")}</p>}
          </div>
        </>
      )}

      {finished && !ctx.isRunning && (
        <ClipsResult clips={ctx.clips} status={ctx.status} failedCount={ctx.failedCount} jobId={ctx.resultJobId ?? ""} />
      )}
    </div>
  );
};
```

- [ ] **Step 7: App wiring**

In `src/App.tsx`:
- Imports: remove `WorkspacePage`, `ManualAIEditorPage`, `DEFAULT_CANVAS_CONFIG`, `DEFAULT_SUBTITLE_CONFIG`; add `CreatePage` from `./pages/CreatePage`, `loadClipChoices`, `saveClipChoices`, `type ClipChoices`, `type ShapeValue` from `./lib/clipChoices`; keep `CanvasConfig`, `SubtitleConfig` types.
- Add above `export default function App()`:

```ts
function storageOrNull(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
```

- Take `aiMode, setAiMode` from `useUserSettings()`.
- Delete the `useState` lines for `aspectRatio`, `trackingMode`, `captionStyle`, `canvasConfig`, `subtitleConfig`, `burnSubtitles`, `enableBroll`, `enableHook`, `maxClips`, `isGamingVideo`, and add in their place:

```ts
  // "Atur tampilan klip" (spec 4.2): remembered for the next video.
  const [choices, setChoices] = useState<ClipChoices>(() => loadClipChoices(storageOrNull()));
  useEffect(() => saveClipChoices(storageOrNull(), choices), [choices]);
  const patchChoices = (patch: Partial<ClipChoices>) => setChoices((c) => ({ ...c, ...patch }));
  const { aspectRatio, trackingMode, burnSubtitles, canvasConfig, subtitleConfig, enableBroll, enableHook, maxClips, isGamingVideo } = choices;
```

- `handleResetWorkspace` becomes:

```ts
  const handleResetWorkspace = () => {
    setUrl("");
    setTitle("");
    setLocalFile(null);
    setInputType("url");
    resetJobState();
  };
```

- In `contextValue`, replace the old setter entries with:

```ts
    choices,
    patchChoices,
    aiMode,
    setAiMode,
    aspectRatio,
    setAspectRatio: (v: ShapeValue) => patchChoices({ aspectRatio: v }),
    trackingMode,
    setTrackingMode: (v: "auto" | "center") => patchChoices({ trackingMode: v }),
    captionStyle: subtitleConfig.style,
    setCaptionStyle: (style: SubtitleConfig["style"]) =>
      setChoices((c) => ({ ...c, subtitleConfig: { ...c.subtitleConfig, style } })),
    burnSubtitles,
    setBurnSubtitles: (v: boolean) => patchChoices({ burnSubtitles: v }),
    canvasConfig,
    setCanvasConfig: (v: CanvasConfig) => patchChoices({ canvasConfig: v }),
    subtitleConfig,
    setSubtitleConfig: (cfgOrFn: SubtitleConfig | ((prev: SubtitleConfig) => SubtitleConfig)) =>
      setChoices((c) => ({ ...c, subtitleConfig: typeof cfgOrFn === "function" ? cfgOrFn(c.subtitleConfig) : cfgOrFn })),
    enableBroll,
    setEnableBroll: (v: boolean) => patchChoices({ enableBroll: v }),
    enableHook,
    setEnableHook: (v: boolean) => patchChoices({ enableHook: v }),
    maxClips,
    setMaxClips: (v: number) => patchChoices({ maxClips: v }),
    isGamingVideo,
    setIsGamingVideo: (v: boolean) => patchChoices({ isGamingVideo: v }),
```

(the `useClipJobs({...})` call keeps passing `aspectRatio`, `trackingMode`, `burnSubtitles: burnSubtitles`, `canvasConfig`, `subtitleConfig`, `captionStyle: subtitleConfig.style`, `enableBroll`, `enableHook`, `maxClips`, `isGamingVideo` from the destructured `choices`).
- Index route: `<Route index element={<CreatePage />} />`.

Delete `src/pages/WorkspacePage.tsx`, `src/pages/ManualAIEditorPage.tsx`, `src/components/GenerateForm.tsx`. Run `npx tsc --noEmit` and fix any remaining import of them.

- [ ] **Step 8: Texts** (`node scripts/add-locale-keys.mjs`)

```json
{
  "id": { "create": {
    "title": "Buat klip",
    "steps_label": "Langkah membuat klip",
    "step_video": "Video", "step_prepare": "Siapkan", "step_choose": "Pilih momen", "step_clips": "Klip",
    "step_done_sr": " (selesai)",
    "link_label": "Tempel link YouTube, TikTok, atau Instagram",
    "link_unsupported": "Link ini belum bisa dipakai. Tempel link video dari YouTube, TikTok, atau Instagram.",
    "or": "Atau pakai video dari perangkat ini:",
    "pick_file": "Pilih file video",
    "pick_drive": "Pilih dari Google Drive",
    "chosen_file": "Video dipilih: {{name}}",
    "clear_file": "Ganti video",
    "shape_label": "Bentuk klip",
    "shape_vertical": "Vertikal untuk TikTok/Reels/Shorts",
    "shape_square": "Persegi",
    "shape_wide": "Lebar",
    "options": "Atur tampilan klip",
    "project_name": "Nama proyek (boleh kosong)",
    "project_name_help": "Kalau kosong, namanya dibuat dari video dan waktu sekarang.",
    "subtitles": "Tampilkan subtitle",
    "face_label": "Posisi gambar",
    "face_follow": "Ikuti wajah",
    "face_center": "Tetap di tengah",
    "hook": "Hook pembuka",
    "hook_help": "3–5 detik paling menarik diputar di awal klip.",
    "broll": "Video ilustrasi (B-roll)",
    "broll_help": "Menambah potongan video dari Pexels yang cocok dengan isi klip.",
    "broll_needs_key": "Butuh kunci Pexels. Isi di Pengaturan, bagian Lanjutan.",
    "game": "Video game dengan kamera wajah",
    "game_help": "Kamera wajah di atas, permainan di bawah.",
    "quality": "Kualitas unduhan",
    "quality_auto": "Otomatis (sampai 1080p)",
    "max_clips": "Jumlah klip",
    "max_clips_auto": "Otomatis (sesuai panjang video)",
    "start": "Mulai",
    "start_hint": "Tempel link atau pilih file video dulu."
  } },
  "en": { "create": {
    "title": "Make clips",
    "steps_label": "Steps to make clips",
    "step_video": "Video", "step_prepare": "Prepare", "step_choose": "Pick moments", "step_clips": "Clips",
    "step_done_sr": " (done)",
    "link_label": "Paste a YouTube, TikTok, or Instagram link",
    "link_unsupported": "This link cannot be used yet. Paste a video link from YouTube, TikTok, or Instagram.",
    "or": "Or use a video from this device:",
    "pick_file": "Choose a video file",
    "pick_drive": "Choose from Google Drive",
    "chosen_file": "Chosen video: {{name}}",
    "clear_file": "Change video",
    "shape_label": "Clip shape",
    "shape_vertical": "Vertical for TikTok/Reels/Shorts",
    "shape_square": "Square",
    "shape_wide": "Wide",
    "options": "Adjust how the clips look",
    "project_name": "Project name (optional)",
    "project_name_help": "Left empty, the name comes from the video and the current time.",
    "subtitles": "Show subtitles",
    "face_label": "Framing",
    "face_follow": "Follow the face",
    "face_center": "Keep it centred",
    "hook": "Opening hook",
    "hook_help": "The most gripping 3–5 seconds play at the start of the clip.",
    "broll": "Illustration footage (B-roll)",
    "broll_help": "Adds matching footage from Pexels.",
    "broll_needs_key": "Needs a Pexels key. Add it in Settings, Advanced.",
    "game": "Game video with a face camera",
    "game_help": "Face camera on top, game below.",
    "quality": "Download quality",
    "quality_auto": "Automatic (up to 1080p)",
    "max_clips": "Number of clips",
    "max_clips_auto": "Automatic (by video length)",
    "start": "Start",
    "start_hint": "Paste a link or choose a video file first."
  } }
}
```

- [ ] **Step 9: Run all checks and look at it**

`npx vitest run` → 197 passing (190 + 5 + 2; record the total). `npx oxlint src` 0 errors. `npm run build`, `npm run build:cloud` exit 0. In the browser at 360 px and 1280 px: link box with live message for `https://vimeo.com/1`; "Pilih file video" opens the system picker (desktop/local) and shows `Video dipilih: …`; on the cloud build the Drive button opens the Drive browser; Mulai is off until a video is chosen and while a preflight block is shown; "Atur tampilan klip" opens and its choices survive a page reload; a started job still shows the old overlay (replaced in Task 10). Keyboard: Tab order link → file → shape radios (arrow keys move) → options summary (Enter opens) → Mulai.

antislop checks for this screen (record PASS/FAIL lines in the ledger entry): one focal point (Mulai is the only filled button), no decorative icons (each icon has a written reason in code comments), no text below 16 px except labels/captions, touch targets ≥ 44 px, no horizontal scroll at 360 px.

- [ ] **Step 10: Log and commit**

PROGRESS-LOG entry; ledger `Task 8: complete (...)` plus the antislop lines.

```bash
git add -A src/components/create src/pages src/App.tsx src/hooks/useUserSettings.ts src/hooks/useClipJobs.ts src/components/GenerateForm.tsx src/locales tasks/PROGRESS-LOG.md tasks/sp2-ledger.md
git commit -m "feat(sp2): step 1 of the create flow with pickVideo, clip shape and remembered options

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 9: Progress logic (`src/lib/progress.ts`)

Spec 4.3 (stage list, real progress only, device note) as pure functions over `current` (Task 2) and `metadata.timings`. Rules: a stage is "done" only when it finished before the running one; a stage that never ran while a later one did is hidden (it is not used for this video); the running stage shows its own percent or clip number; a running stage outside the step's list (e.g. the source video downloaded again before re-rendering) is shown first.

**Files:**
- Create: `src/lib/progress.ts`, `src/lib/progress.test.ts`

**Interfaces:**
- Consumes: `PREPARE_STAGES`, `CHOOSE_STAGES` (Task 6); `summarizeTimings` (`src/lib/timings.ts`); the `current` object of `GET /jobs/{id}` (Task 2).
- Produces:
  - `interface LiveStage { stage: string; started_at: number; elapsed_seconds?: number; device?: string; clip?: number; clips_total?: number; percent?: number }`
  - `asLiveStage(value: unknown): LiveStage | null`
  - `stagesFor(step: 2 | 3 | 4, opts: { autoAi: boolean; tracking: boolean }): string[]`
  - `type RowState = "done" | "running" | "todo"`; `interface ProgressRow { stage: string; state: RowState; seconds: number | null; percent: number | null; clip: number | null; clipsTotal: number | null }`
  - `progressRows(stages: string[], timings: unknown, current: LiveStage | null): ProgressRow[]`
  - `type DeviceNote = "cpu_subtitle" | "cpu_render"`; `deviceNotes(current: LiveStage | null, timings: unknown, stages: string[]): DeviceNote[]`

- [ ] **Step 1: Write the failing tests** (`src/lib/progress.test.ts`)

```ts
import { describe, expect, it } from "vitest";
import { asLiveStage, deviceNotes, progressRows, stagesFor, type LiveStage } from "./progress";

const live = (stage: string, extra: Partial<LiveStage> = {}): LiveStage => ({ stage, started_at: 1, elapsed_seconds: 5, ...extra });
const timing = (stage: string, seconds: number, extra: Record<string, unknown> = {}) => ({ stage, seconds, rss_mb_peak: 1, ok: true, ...extra });
const states = (rows: { stage: string; state: string }[]) => rows.map((r) => `${r.stage}:${r.state}`);

describe("asLiveStage", () => {
  it("reads the current object of the job status", () => {
    expect(asLiveStage({ stage: "render", started_at: 3, elapsed_seconds: 2.5, clip: 2, clips_total: 4, device: "libx264", extra: 1 })).toEqual({
      stage: "render", started_at: 3, elapsed_seconds: 2.5, clip: 2, clips_total: 4, device: "libx264",
    });
  });

  it("is null for nothing or nonsense", () => {
    expect(asLiveStage(null)).toBeNull();
    expect(asLiveStage({ stage: "" })).toBeNull();
    expect(asLiveStage("render")).toBeNull();
  });
});

describe("stagesFor", () => {
  it("lists the stages of each step", () => {
    expect(stagesFor(2, { autoAi: false, tracking: true })).toEqual(["download", "extract_audio", "transcribe"]);
    expect(stagesFor(2, { autoAi: true, tracking: true })).toEqual(["download", "extract_audio", "transcribe", "ai_analysis"]);
    expect(stagesFor(4, { autoAi: false, tracking: true })).toEqual(["tracking", "render", "publish"]);
    expect(stagesFor(4, { autoAi: false, tracking: false })).toEqual(["render", "publish"]);
  });
});

describe("progressRows (spec 4.3: real progress only)", () => {
  const prepare = ["download", "extract_audio", "transcribe"];
  const make = ["tracking", "render", "publish"];

  it("shows every stage as waiting before anything runs", () => {
    expect(states(progressRows(prepare, [], null))).toEqual(["download:todo", "extract_audio:todo", "transcribe:todo"]);
  });

  it("shows the download percent while downloading", () => {
    const rows = progressRows(prepare, [], live("download", { percent: 42.5 }));
    expect(rows[0]).toEqual({ stage: "download", state: "running", seconds: 5, percent: 42.5, clip: null, clipsTotal: null });
    expect(states(rows).slice(1)).toEqual(["extract_audio:todo", "transcribe:todo"]);
  });

  it("ticks finished stages with how long they took", () => {
    const rows = progressRows(prepare, [timing("download", 10), timing("extract_audio", 3)], live("transcribe"));
    expect(states(rows)).toEqual(["download:done", "extract_audio:done", "transcribe:running"]);
    expect(rows[0].seconds).toBe(10);
  });

  it("hides a stage this video does not use", () => {
    expect(states(progressRows(prepare, [timing("download", 10)], live("transcribe")))).toEqual(["download:done", "transcribe:running"]);
  });

  it("says which clip of how many, and does not tick a stage that runs again for the next clip", () => {
    const rows = progressRows(make, [timing("tracking", 4, { clip: 1 }), timing("render", 20, { clip: 1 })], live("tracking", { clip: 2, clips_total: 3 }));
    expect(states(rows)).toEqual(["tracking:running", "render:todo", "publish:todo"]);
    expect([rows[0].clip, rows[0].clipsTotal]).toEqual([2, 3]);
  });

  it("counts adding the opening hook as making the clip", () => {
    expect(states(progressRows(make, [timing("tracking", 4)], live("hook_concat", { clip: 1 })))).toEqual([
      "tracking:done", "render:running", "publish:todo",
    ]);
  });

  it("shows a running stage from outside the list first", () => {
    expect(states(progressRows(make, [], live("download")))).toEqual(["download:running", "tracking:todo", "render:todo", "publish:todo"]);
  });
});

describe("deviceNotes (spec 4.3: the device really used)", () => {
  const prepare = ["download", "extract_audio", "transcribe"];

  it("notes subtitles made on the processor", () => {
    expect(deviceNotes(live("transcribe", { device: "cpu" }), [], prepare)).toEqual(["cpu_subtitle"]);
    expect(deviceNotes(null, [timing("transcribe", 30, { whisper_device: "cpu" })], prepare)).toEqual(["cpu_subtitle"]);
  });

  it("says nothing when the GPU did the work", () => {
    expect(deviceNotes(live("transcribe", { device: "cuda" }), [], prepare)).toEqual([]);
  });

  it("notes clips made on the processor, only on the step that makes them", () => {
    const timings = [timing("transcribe", 30, { whisper_device: "cpu" }), timing("render", 9, { encoder: "libx264" })];
    expect(deviceNotes(null, timings, ["tracking", "render", "publish"])).toEqual(["cpu_render"]);
  });
});
```

Run: `npx vitest run src/lib/progress.test.ts` → FAIL (module missing).

- [ ] **Step 2: Implement `src/lib/progress.ts`**

```ts
import { CHOOSE_STAGES, PREPARE_STAGES } from "./createFlow";
import { summarizeTimings } from "./timings";

// The progress screen (spec 4.3) from the live `current` stage (GET /jobs/{id}) and the finished
// `metadata.timings`. Only real facts: no time-based messages, no rotating texts. No React.

export interface LiveStage {
  stage: string;
  started_at: number;
  /** Seconds the stage has run, by the backend's clock (the phone's clock may differ). */
  elapsed_seconds?: number;
  device?: string;
  clip?: number;
  clips_total?: number;
  percent?: number;
}

const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

export function asLiveStage(value: unknown): LiveStage | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (typeof v.stage !== "string" || !v.stage) return null;
  const out: LiveStage = { stage: v.stage, started_at: num(v.started_at) ?? 0 };
  for (const key of ["elapsed_seconds", "clip", "clips_total", "percent"] as const) {
    const n = num(v[key]);
    if (n !== undefined) out[key] = n;
  }
  if (typeof v.device === "string" && v.device) out.device = v.device;
  return out;
}

export function stagesFor(step: 2 | 3 | 4, opts: { autoAi: boolean; tracking: boolean }): string[] {
  if (step === 4) return opts.tracking ? ["tracking", "render", "publish"] : ["render", "publish"];
  return opts.autoAi ? [...PREPARE_STAGES, ...CHOOSE_STAGES] : [...PREPARE_STAGES];
}

export type RowState = "done" | "running" | "todo";

export interface ProgressRow {
  stage: string;
  state: RowState;
  /** Finished: total seconds. Running: seconds so far. Waiting: null. */
  seconds: number | null;
  percent: number | null;
  clip: number | null;
  clipsTotal: number | null;
}

/** Adding the opening hook is part of making the clip. */
const SHOWN_AS: Record<string, string> = { hook_concat: "render" };
const shownAs = (stage: string) => SHOWN_AS[stage] ?? stage;

export function progressRows(stages: string[], timings: unknown, current: LiveStage | null): ProgressRow[] {
  const finished = new Map<string, number>();
  for (const row of summarizeTimings(timings)) {
    const stage = shownAs(row.stage);
    finished.set(stage, (finished.get(stage) ?? 0) + row.seconds);
  }
  const running = current ? shownAs(current.stage) : null;
  const list = running && !stages.includes(running) ? [running, ...stages] : stages;
  const runningAt = running ? list.indexOf(running) : -1;

  const rows: ProgressRow[] = list.map((stage, i) => {
    if (current && stage === running) {
      return {
        stage,
        state: "running",
        seconds: current.elapsed_seconds ?? null,
        percent: current.percent ?? null,
        clip: current.clip ?? null,
        clipsTotal: current.clips_total ?? null,
      };
    }
    // Finished, and not a stage that runs again later (tracking and render repeat per clip).
    const done = finished.has(stage) && (runningAt < 0 || i < runningAt);
    return { stage, state: done ? "done" : "todo", seconds: done ? finished.get(stage)! : null, percent: null, clip: null, clipsTotal: null };
  });

  // A stage that did not run while a later one did is not used for this video: leave it out.
  const lastStarted = rows.reduce((last, row, i) => (row.state !== "todo" ? i : last), -1);
  return rows.filter((row, i) => row.state !== "todo" || i > lastStarted);
}

export type DeviceNote = "cpu_subtitle" | "cpu_render";

export function deviceNotes(current: LiveStage | null, timings: unknown, stages: string[]): DeviceNote[] {
  const notes = new Set<DeviceNote>();
  const look = (stage: unknown, device: unknown) => {
    if (typeof stage !== "string" || !stages.includes(shownAs(stage))) return;
    if (stage === "transcribe" && device === "cpu") notes.add("cpu_subtitle");
    if (shownAs(stage) === "render" && device === "libx264") notes.add("cpu_render");
  };
  if (current) look(current.stage, current.device);
  if (Array.isArray(timings)) {
    for (const entry of timings) {
      if (!entry || typeof entry !== "object") continue;
      const e = entry as Record<string, unknown>;
      look(e.stage, e.whisper_device);
      look(e.stage, e.encoder);
    }
  }
  return [...notes];
}
```

- [ ] **Step 3: Run the tests**

`npx vitest run src/lib/progress.test.ts` → PASS (2 + 1 + 7 + 3 = 13). Whole suite → 210 passing (record the total). `npx oxlint src` 0 errors. `npm run build` exit 0.

- [ ] **Step 4: Log and commit**

PROGRESS-LOG entry; ledger `Task 9: complete (...)`.

```bash
git add src/lib/progress.ts src/lib/progress.test.ts tasks/PROGRESS-LOG.md tasks/sp2-ledger.md
git commit -m "feat(sp2): progress rows and device notes from the live stage

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Progress screen replaces `BusyOverlay`

Spec 4.3 in full: the progress screen is part of the page (navigation stays usable), lists the stages with real durations, shows percent / "Membuat klip 3 dari 10", the device note, the per-platform "may I close this?" line, the queue position, and "Batalkan" with a confirmation. `useClipJobs` keeps `current`, the live metadata and `makePhase`. Other pages show a slim "Sedang diproses · Lihat progres" bar (Spec gap 18). Toast texts lose their emoji and technical words, and `toast` joins the plain-words test.

**Files:**
- Create: `src/hooks/useNow.ts`, `src/components/create/ProgressPanel.tsx`, `src/components/create/ProgressPanel.test.tsx`, `src/components/nav/RunningBar.tsx`
- Modify: `src/hooks/useClipJobs.ts`, `src/App.tsx` (context), `src/pages/CreatePage.tsx`, `src/layouts/AppLayout.tsx`
- Delete: `src/components/BusyOverlay.tsx`
- Modify: `src/locales/{id,en}.json` (`progress.*`, `toast.*` values), `src/locales/plainWords.test.ts` (`"toast"`)

**Interfaces:**
- Consumes: `LiveStage`, `asLiveStage`, `stagesFor`, `progressRows`, `deviceNotes` (Task 9); `effectiveProvider`, `MANUAL_PROVIDER`, `FlowStep` (Task 6); `formatDuration` (`src/lib/timings.ts`); `ConfirmDialog` (Task 4); `caps.keepOpen` (Task 5).
- Produces:
  - `useNow(intervalMs?: number): number`
  - `<ProgressPanel step={2 | 3 | 4} autoAi tracking localSource current timings queuePosition onCancel />`
  - `useClipJobs` returns, in addition: `current: LiveStage | null`, `liveMeta: Record<string, unknown> | null`, `makePhase: boolean`, `jobOrigin: "workspace" | "history"`; App context exposes the same names.
  - `<RunningBar />` in `AppLayout`.

- [ ] **Step 1: Write the failing tests** (`src/components/create/ProgressPanel.test.tsx`)

```tsx
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../../i18n";
import { CAPS, setPlatform, type Platform } from "../../platform";
import { ProgressPanel } from "./ProgressPanel";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const base = { autoAi: false, tracking: true, localSource: false, timings: [], queuePosition: null, onCancel: vi.fn() };

describe("ProgressPanel (spec 4.3)", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    setPlatform({ caps: CAPS.desktop } as Platform);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    setPlatform(null);
  });

  it("names the stages like Detail waktu and says which clip of how many", () => {
    act(() =>
      root.render(
        <ProgressPanel {...base} step={4} timings={[{ stage: "tracking", seconds: 4, ok: true }]}
          current={{ stage: "render", started_at: 1, elapsed_seconds: 3, clip: 3, clips_total: 10, device: "h264_nvenc" }} />,
      ),
    );
    const text = container.textContent!;
    expect(text).toContain(i18n.t("timing.stage_tracking"));
    expect(text).toContain(`${i18n.t("timing.stage_render")} ${i18n.t("progress.clip_of", { clip: 3, total: 10 })}`);
    expect(text).not.toContain(i18n.t("progress.cpu_render"));
  });

  it("shows the download percent and the processor note", () => {
    act(() =>
      root.render(
        <ProgressPanel {...base} step={2} timings={[{ stage: "download", seconds: 8, ok: true }, { stage: "extract_audio", seconds: 2, ok: true }]}
          current={{ stage: "transcribe", started_at: 1, elapsed_seconds: 30, device: "cpu" }} />,
      ),
    );
    expect(container.textContent).toContain(i18n.t("progress.cpu_subtitle"));
    act(() => root.render(<ProgressPanel {...base} step={2} current={{ stage: "download", started_at: 1, percent: 42 }} />));
    expect(container.textContent).toContain("42%");
  });

  it("tells cloud users they may close the page, and shows the queue position", () => {
    setPlatform({ caps: CAPS.cloud } as Platform);
    act(() => root.render(<ProgressPanel {...base} step={2} current={null} queuePosition={2} />));
    expect(container.textContent).toContain(i18n.t("progress.keep_open_none"));
    expect(container.textContent).toContain(i18n.t("progress.queue", { n: 2 }));
  });

  it("asks before cancelling", () => {
    const onCancel = vi.fn();
    act(() => root.render(<ProgressPanel {...base} step={2} current={null} onCancel={onCancel} />));
    const button = (label: string) => [...document.querySelectorAll("button")].find((b) => b.textContent === label)!;
    act(() => button(i18n.t("progress.cancel")).click());
    expect(onCancel).not.toHaveBeenCalled();
    act(() => button(i18n.t("progress.cancel_keep")).click());
    expect(onCancel).not.toHaveBeenCalled();
    act(() => button(i18n.t("progress.cancel")).click());
    act(() => button(i18n.t("progress.cancel_confirm")).click());
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
```

In `src/locales/plainWords.test.ts` change `MAIN_NAMESPACES` to `["nav", "create", "progress", "moment", "result", "projects", "banner", "toast"]`.

Run: `npx vitest run src/components/create/ProgressPanel.test.tsx src/locales` → FAIL (module missing; plain words lists the old `toast.*` texts with emoji and "API Key"/"prompt"/"re-render").

- [ ] **Step 2: `useNow` and `ProgressPanel`**

`src/hooks/useNow.ts`:

```ts
import { useEffect, useState } from "react";

/** The time, updated once a second (running timers). */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
```

`src/components/create/ProgressPanel.tsx`:

```tsx
import React, { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Circle, CircleCheck, LoaderCircle, X } from "lucide-react";
import { useNow } from "../../hooks/useNow";
import { deviceNotes, progressRows, stagesFor, type LiveStage, type ProgressRow } from "../../lib/progress";
import { formatDuration } from "../../lib/timings";
import { platform } from "../../platform";
import { Button } from "../ui/Button";
import { ConfirmDialog } from "../ui/ConfirmDialog";

export interface ProgressPanelProps {
  step: 2 | 3 | 4;
  autoAi: boolean;
  /** Face tracking runs (vertical/square with "Ikuti wajah"). */
  tracking: boolean;
  /** The video came from this device or Drive: "download" is only a copy. */
  localSource: boolean;
  current: LiveStage | null;
  timings: unknown;
  queuePosition: number | null;
  onCancel: () => void;
}

const TITLE: Record<2 | 3 | 4, string> = { 2: "progress.title_prepare", 3: "progress.title_choose", 4: "progress.title_make" };

/** Steps 2 and 4 (spec 4.3): part of the page, not an overlay, so the menu stays usable. */
export const ProgressPanel: React.FC<ProgressPanelProps> = ({
  step, autoAi, tracking, localSource, current, timings, queuePosition, onCancel,
}) => {
  const { t } = useTranslation();
  const headingId = useId();
  const now = useNow();
  const [confirming, setConfirming] = useState(false);

  // Count up from the backend's elapsed time between two polls (the phone's clock may differ).
  const [base, setBase] = useState({ at: Date.now(), elapsed: 0 });
  useEffect(() => {
    setBase({ at: Date.now(), elapsed: current?.elapsed_seconds ?? 0 });
  }, [current?.stage, current?.elapsed_seconds, current?.clip]);

  const stages = stagesFor(step, { autoAi, tracking });
  const rows = progressRows(stages, timings, current);
  const notes = deviceNotes(current, timings, stages);
  const units = { hour: t("timing.unit_hour"), minute: t("timing.unit_minute"), second: t("timing.unit_second") };

  const label = (row: ProgressRow) => {
    const name = row.stage === "download" && localSource ? t("progress.stage_copy") : t(`timing.stage_${row.stage}`, { defaultValue: row.stage });
    if (row.clip === null) return name;
    const clip = row.clipsTotal ? t("progress.clip_of", { clip: row.clip, total: row.clipsTotal }) : t("progress.clip_n", { clip: row.clip });
    return `${name} ${clip}`;
  };

  const detail = (row: ProgressRow) => {
    if (row.state === "done" && row.seconds !== null) return t("progress.took", { time: formatDuration(row.seconds, units) });
    if (row.state !== "running") return "";
    const elapsed = base.elapsed + Math.max(0, (now - base.at) / 1000);
    const parts = [t("progress.running_for", { time: formatDuration(elapsed, units) })];
    if (row.percent !== null) parts.unshift(`${Math.round(row.percent)}%`);
    return parts.join(" · ");
  };

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-4 rounded-card border border-border bg-bg-secondary p-4 md:p-6">
      <div className="flex items-center gap-3">
        {/* The spinner says "working"; prefers-reduced-motion stops it (index.css). */}
        <LoaderCircle className="h-6 w-6 shrink-0 animate-spin text-accent" aria-hidden="true" />
        <h2 id={headingId} className="text-section-title text-text-primary">{t(TITLE[step])}</h2>
      </div>

      {queuePosition ? (
        <p role="status" className="text-body text-text-primary">{t("progress.queue", { n: queuePosition })}</p>
      ) : null}

      <ol className="flex flex-col gap-1" aria-live="polite">
        {rows.map((row) => (
          <li key={row.stage} className="flex min-h-[44px] items-start gap-3 py-1">
            {row.state === "done" ? (
              <CircleCheck className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-label={t("progress.state_done")} />
            ) : row.state === "running" ? (
              <Circle className="mt-0.5 h-5 w-5 shrink-0 fill-accent text-accent" aria-label={t("progress.state_running")} />
            ) : (
              <Circle className="mt-0.5 h-5 w-5 shrink-0 text-text-secondary" aria-label={t("progress.state_todo")} />
            )}
            <div className="min-w-0">
              <p className={`text-body ${row.state === "todo" ? "text-text-secondary" : "text-text-primary"} ${row.state === "running" ? "font-semibold" : ""}`}>
                {label(row)}
              </p>
              {detail(row) && <p className="text-caption text-text-secondary">{detail(row)}</p>}
            </div>
          </li>
        ))}
      </ol>

      {notes.map((note) => (
        <p key={note} className="rounded-card border border-border bg-bg-surface p-3 text-body text-text-primary">
          {t(`progress.${note}`)}
        </p>
      ))}

      <p className="text-body text-text-secondary">{t(`progress.keep_open_${platform().caps.keepOpen}`)}</p>

      <Button variant="outline" icon={X} className="self-start" onClick={() => setConfirming(true)}>
        {t("progress.cancel")}
      </Button>
      <ConfirmDialog
        isOpen={confirming}
        title={t("progress.cancel_title")}
        message={t("progress.cancel_body")}
        confirmLabel={t("progress.cancel_confirm")}
        cancelLabel={t("progress.cancel_keep")}
        isDestructive
        onConfirm={() => {
          setConfirming(false);
          onCancel();
        }}
        onCancel={() => setConfirming(false)}
      />
    </section>
  );
};
```

- [ ] **Step 3: `useClipJobs`**

In `src/hooks/useClipJobs.ts`:
- import `asLiveStage, type LiveStage` from `../lib/progress`.
- New state after `historyVersion`:

```ts
  // Spec 4.3/4.4: the stage running now and the job's live metadata (finished stage timings).
  const [current, setCurrent] = useState<LiveStage | null>(null);
  const [liveMeta, setLiveMeta] = useState<Record<string, unknown> | null>(null);
  // The running job started at clip making (answer sent, re-render): "no stage yet" means step 4.
  const [makePhase, setMakePhase] = useState(false);
```

- In the polling `else` ("In progress") branch add `setCurrent(asLiveStage(job.current));` and `setLiveMeta(job.metadata || null);`.
- In the `DONE`, `ERROR`, `CANCELLED` and `AWAITING_MANUAL` branches and in `cancelJob` add `setCurrent(null);`. In `DONE` also `setLiveMeta(job.metadata || null);`.
- `handleGenerate` and `handleManualGenerate`, next to `setJobOrigin("workspace")`: `setMakePhase(false); setLiveMeta(null);`.
- `handleRerender`, `handleRerenderClip`, `startManualResumePolling`: `setMakePhase(true); setLiveMeta(null);`. `handleRerunAI`, `handleResumeJob`: `setMakePhase(false); setLiveMeta(null);`.
- `resetJobState`: add `setCurrent(null); setLiveMeta(null); setMakePhase(false);`.
- Replace every `t('toast.clip_failed', { num: '', msg: t('toast.X', '…') })` with `t('toast.clip_failed', { msg: t('toast.X') })`, and drop the default-text second argument of every other `t('toast.…', '…')` call in this file (the keys exist in both locale files; defaults carried emoji).
- Return additionally `current, liveMeta, makePhase, jobOrigin`.

`src/App.tsx`: take `current, liveMeta, makePhase, jobOrigin` from `useClipJobs` and add them to `contextValue`.

- [ ] **Step 4: Page, bar, layout**

`src/pages/CreatePage.tsx`: import `ProgressPanel` and `MANUAL_PROVIDER`; after the `{finished && …}` block add (and keep partial clips visible while clips are being made):

```tsx
      {flow.running && step !== 1 && (
        <ProgressPanel
          step={step as 2 | 3 | 4}
          autoAi={effectiveProvider(caps, ctx.aiMode, ctx.provider) !== MANUAL_PROVIDER}
          tracking={ctx.choices.trackingMode === "auto" && ctx.choices.aspectRatio !== "16:9"}
          localSource={!!chosenFile}
          current={ctx.current}
          timings={ctx.liveMeta?.timings}
          queuePosition={ctx.queuePosition}
          onCancel={ctx.cancelJob}
        />
      )}
```

`src/components/nav/RunningBar.tsx`:

```tsx
import React, { useContext } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AppContext } from "../../App";
import { ROUTES } from "../../lib/routes";

/** A job runs and this page is not "Buat klip": say so, and link to the progress. */
export const RunningBar: React.FC = () => {
  const { t } = useTranslation();
  const ctx = useContext(AppContext);
  const { pathname } = useLocation();
  if (!ctx?.isRunning || pathname === ROUTES.create) return null;
  return (
    <div role="status" className="border-b border-border bg-accent-muted px-4 md:px-8">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
        <p className="text-body text-text-primary">{t("progress.running_bar")}</p>
        <Link to={ROUTES.create} className="inline-flex min-h-[44px] items-center text-body font-semibold text-accent underline">
          {t("progress.running_bar_link")}
        </Link>
      </div>
    </div>
  );
};
```

`src/layouts/AppLayout.tsx`: remove `BusyOverlay` (import and element); add `<RunningBar />` right after `<BackendBanner />`. Delete `src/components/BusyOverlay.tsx`.

- [ ] **Step 5: Texts**

Add with `node scripts/add-locale-keys.mjs`:

```json
{
  "id": { "progress": {
    "title_prepare": "Menyiapkan video",
    "title_choose": "Memilih momen terbaik",
    "title_make": "Membuat klip",
    "queue": "Menunggu giliran. Urutan ke-{{n}}.",
    "stage_copy": "Menyiapkan video",
    "clip_of": "{{clip}} dari {{total}}",
    "clip_n": "ke-{{clip}}",
    "took": "selesai dalam {{time}}",
    "running_for": "berjalan {{time}}",
    "state_done": "Selesai",
    "state_running": "Sedang berjalan",
    "state_todo": "Belum mulai",
    "cpu_subtitle": "Subtitle dibuat dengan prosesor, bukan GPU. Untuk video panjang bisa jauh lebih lama.",
    "cpu_render": "Klip dibuat dengan prosesor, bukan GPU. Untuk video panjang bisa jauh lebih lama.",
    "keep_open_app": "Jangan tutup aplikasi sampai selesai.",
    "keep_open_window": "Jangan tutup jendela Auto Clipper Web.",
    "keep_open_none": "Halaman ini boleh ditutup. Proses tetap jalan selama Colab menyala; lihat hasilnya di Riwayat.",
    "cancel": "Batalkan",
    "cancel_title": "Batalkan proses ini?",
    "cancel_body": "Klip yang belum jadi tidak akan dibuat. Proyek ini tetap ada di Riwayat.",
    "cancel_confirm": "Ya, batalkan",
    "cancel_keep": "Lanjutkan proses",
    "running_bar": "Ada proses yang sedang berjalan.",
    "running_bar_link": "Lihat progres"
  }, "toast": {
    "starting_resume": "Melanjutkan proses.",
    "resume_fail": "Proses belum bisa dilanjutkan."
  } },
  "en": { "progress": {
    "title_prepare": "Preparing the video",
    "title_choose": "Picking the best moments",
    "title_make": "Making the clips",
    "queue": "Waiting for a turn. Number {{n}} in line.",
    "stage_copy": "Preparing the video",
    "clip_of": "{{clip}} of {{total}}",
    "clip_n": "no. {{clip}}",
    "took": "took {{time}}",
    "running_for": "running for {{time}}",
    "state_done": "Done",
    "state_running": "Running",
    "state_todo": "Not started",
    "cpu_subtitle": "Subtitles are made on the processor, not the GPU. Long videos can take much longer.",
    "cpu_render": "Clips are made on the processor, not the GPU. Long videos can take much longer.",
    "keep_open_app": "Keep the app open until it finishes.",
    "keep_open_window": "Keep the Auto Clipper Web window open.",
    "keep_open_none": "You can close this page. The work continues while Colab is running; see the result in History.",
    "cancel": "Cancel",
    "cancel_title": "Cancel this process?",
    "cancel_body": "Clips that are not finished will not be made. The project stays in History.",
    "cancel_confirm": "Yes, cancel",
    "cancel_keep": "Keep going",
    "running_bar": "A job is running.",
    "running_bar_link": "See progress"
  }, "toast": {
    "starting_resume": "Continuing.",
    "resume_fail": "Could not continue."
  } }
}
```

("Membuat klip 3 dari 10" is `timing.stage_render` + `progress.clip_of`.)

Then replace the existing `toast.*` values (the add script refuses changed texts). Run once from the repo root:

```bash
node --input-type=module -e '
import { readFileSync, writeFileSync } from "node:fs";
const texts = {
  id: {
    clip_failed: "Belum bisa mulai: {{msg}}", title_required: "Nama proyek belum diisi.",
    api_key_req: "Kunci API belum diisi. Isi di Pengaturan, bagian Lanjutan.",
    done_partial: "Selesai. {{count}} klip jadi, {{failed}} gagal.", done_all: "Selesai. {{count}} klip siap diunduh.",
    os_notify_title: "Auto Clipper selesai", cancelled: "Proses dibatalkan.", url_empty: "Link video belum diisi.",
    local_file_empty: "File video belum dipilih.", uploading: "Mengunggah video…", starting_bg: "Mulai memproses video.",
    starting_rerender: "Mulai membuat ulang klip.", rerender_fail: "Pembuatan ulang klip belum bisa dimulai.",
    starting_ai_correct: "Mulai memilih ulang momen dengan AI.", ai_correct_fail: "Pemilihan ulang momen belum bisa dimulai.",
    custom_config_req: "Alamat dan nama model untuk AI kustom belum diisi. Isi di Pengaturan, bagian Lanjutan.",
    manual_prompt_ready: "Video siap. Lanjutkan di langkah Pilih momen."
  },
  en: {
    clip_failed: "Cannot start yet: {{msg}}", title_required: "The project name is empty.",
    api_key_req: "The API key is empty. Add it in Settings, Advanced.",
    done_partial: "Done. {{count}} clips made, {{failed}} failed.", done_all: "Done. {{count}} clips are ready to download.",
    os_notify_title: "Auto Clipper is done", cancelled: "Cancelled.", url_empty: "The video link is empty.",
    local_file_empty: "No video file chosen yet.", uploading: "Uploading the video…", starting_bg: "Started processing the video.",
    starting_rerender: "Started making the clips again.", rerender_fail: "Could not start making the clips again.",
    starting_ai_correct: "Started picking moments again with AI.", ai_correct_fail: "Could not start picking moments again.",
    custom_config_req: "The custom AI address and model name are empty. Add them in Settings, Advanced.",
    manual_prompt_ready: "The video is ready. Continue at Pick moments."
  }
};
for (const lang of ["id", "en"]) {
  const file = `src/locales/${lang}.json`;
  const data = JSON.parse(readFileSync(file, "utf8"));
  Object.assign(data.toast, texts[lang]);
  writeFileSync(file, JSON.stringify(data, null, 2));
}'
```

- [ ] **Step 6: Run all checks and look at it**

`npx vitest run` → 214 passing (210 + 4; record the total). `npx oxlint src` 0 errors. `npm run build`, `npm run build:cloud` exit 0. With a short real video through `backend.main --web`: step 2 lists Mengunduh video (with %), Mengambil suara dari video, Membuat subtitle, each ticked with its time; on a machine without a GPU the processor note appears; the menu stays usable during the job and Riwayat shows the "Lihat progres" bar; Batalkan asks first; at 360 px nothing overflows. No message ever changes because of time alone (search `ProgressPanel.tsx` for `setTimeout`/time thresholds: none).

- [ ] **Step 7: Log and commit**

PROGRESS-LOG entry; ledger `Task 10: complete (...)`; roadmap `T2.x Teks layar proses (BusyOverlay) jujur` ticked with the hash.

```bash
git add -A src/hooks src/components/create src/components/nav src/components/BusyOverlay.tsx src/pages/CreatePage.tsx src/layouts/AppLayout.tsx src/App.tsx src/locales tasks/PROGRESS-LOG.md tasks/sp2-ledger.md tasks/roadmap-todo.md
git commit -m "feat(sp2): honest in-page progress screen replaces the busy overlay

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 11: Step 3: guided manual AI with answer validation

Spec 4.2 step 3 and 5 (validation under the field). When the job reaches `AWAITING_MANUAL` the user stays on "Buat klip" (no jump to Riwayat, Spec gap 7): ① copy the instructions, ② open ChatGPT or Gemini, ③ paste the answer and press "Buat klip". The answer is checked before it is sent and the message says what is missing. The checked JSON (not the raw paste) is sent, so text around the answer does not trip the backend parser. A project waiting for an answer stays in Riwayat; its button "Tempel jawaban AI" brings the user back to this step. API key mode skips the step (the provider is not `manual_ai`, Task 8) and shows "Memilih momen terbaik" in the progress list (Task 10).

**Files:**
- Create: `src/lib/aiAnswer.ts`, `src/lib/aiAnswer.test.ts`, `src/lib/clipboard.ts`
- Create: `src/components/create/MomentStep.tsx`, `src/components/create/MomentStep.test.tsx`
- Modify: `src/hooks/useClipJobs.ts`, `src/App.tsx` (context), `src/pages/CreatePage.tsx`, `src/pages/HistoryPage.tsx` ("Lanjut Manual" button)
- Delete: `src/components/ManualResumeModal.tsx`
- Modify: `src/locales/{id,en}.json` (`moment.*`)

**Interfaces:**
- Consumes: `POST /jobs/{id}/resume-manual {json_payload, pexels_api_key}` → `{status: "success", job_id}` (the same id; `backend/jobs.py resume_manual_job`); `metadata.manual_prompt` and `metadata.title` of the job status; `requestError` (`src/lib/errorInfo.ts`); `platform().openExternal`.
- Produces:
  - `type AiAnswerProblem = "empty" | "cut_off" | "not_answer" | "no_moments" | "missing_times"`
  - `type AiAnswerCheck = { ok: true; moments: number; payload: string } | { ok: false; problem: AiAnswerProblem; moment?: number }`
  - `stripCodeFence(text: string): string`, `checkAiAnswer(text: string): AiAnswerCheck`
  - `copyText(text: string): Promise<boolean>` (`src/lib/clipboard.ts`)
  - `interface AwaitingAnswer { jobId: string; prompt: string; title: string }`; `useClipJobs` returns `awaiting: AwaitingAnswer | null`, `sendingAnswer: boolean`, `answerError: { message: string; info: ErrorInfo | null } | null`, `submitAiAnswer(payload: string): Promise<void>`, `openAwaiting(job: { id: string; metadata?: { manual_prompt?: string; title?: string } | null }): void`, `leaveAwaiting(): void` (all in App context)
  - `<MomentStep prompt projectTitle submitting error onSubmit onLater />`
  - `CHATGPT_URL = "https://chatgpt.com/"`, `GEMINI_URL = "https://gemini.google.com/app"` (exported from `MomentStep.tsx`)

- [ ] **Step 1: Write the failing tests**

`src/lib/aiAnswer.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { checkAiAnswer, stripCodeFence } from "./aiAnswer";

const moment = (extra: Record<string, unknown> = {}) => ({ start_time: "00:01:05.200", end_time: "00:01:50.000", description_id: "Lucu", ...extra });
const answer = JSON.stringify({ highlights: [moment(), moment({ start_time: "00:03:00", end_time: "00:03:40" })] });

describe("checkAiAnswer (spec 4.2 step 3)", () => {
  it("accepts a whole answer and sends clean JSON", () => {
    const result = checkAiAnswer(answer);
    expect(result).toMatchObject({ ok: true, moments: 2 });
    if (result.ok) expect(JSON.parse(result.payload).highlights).toHaveLength(2);
  });

  it("accepts the answer inside a code block or with chat text around it", () => {
    expect(checkAiAnswer("```json\n" + answer + "\n```")).toMatchObject({ ok: true, moments: 2 });
    expect(checkAiAnswer("Berikut jawabannya:\n" + answer + "\nSemoga membantu!")).toMatchObject({ ok: true, moments: 2 });
    expect(checkAiAnswer(JSON.stringify([moment()]))).toMatchObject({ ok: true, moments: 1 });
  });

  it("says an answer is cut off", () => {
    expect(checkAiAnswer(answer.slice(0, answer.length - 20))).toEqual({ ok: false, problem: "cut_off" });
  });

  it("says a pasted text is not the answer", () => {
    expect(checkAiAnswer("Maaf, saya tidak bisa membantu dengan permintaan ini.")).toEqual({ ok: false, problem: "not_answer" });
  });

  it("says the box is empty", () => {
    expect(checkAiAnswer("   \n ")).toEqual({ ok: false, problem: "empty" });
  });

  it("says an answer has no moments", () => {
    expect(checkAiAnswer('{"highlights": []}')).toEqual({ ok: false, problem: "no_moments" });
    expect(checkAiAnswer('{"note": "nothing"}')).toEqual({ ok: false, problem: "no_moments" });
  });

  it("names the moment without a start or end time", () => {
    const bad = JSON.stringify({ highlights: [moment(), moment({ end_time: undefined }), moment()] });
    expect(checkAiAnswer(bad)).toEqual({ ok: false, problem: "missing_times", moment: 2 });
    expect(checkAiAnswer(JSON.stringify([moment({ start_time: "soon" })]))).toEqual({ ok: false, problem: "missing_times", moment: 1 });
  });
});

describe("stripCodeFence (same as backend/ai_utils.py _clean_json_response)", () => {
  it("takes the inside of a code block", () => {
    expect(stripCodeFence("Ini:\n```json\n[1]\n```\nSelesai")).toBe("[1]");
    expect(stripCodeFence("```\n[1]")).toBe("[1]");
  });
});
```

`src/components/create/MomentStep.test.tsx`:

```tsx
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../../i18n";
import { setPlatform, type Platform } from "../../platform";
import { CHATGPT_URL, GEMINI_URL, MomentStep } from "./MomentStep";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const good = JSON.stringify({ highlights: [{ start_time: "00:00:10", end_time: "00:00:40" }] });

describe("MomentStep (spec 4.2 step 3)", () => {
  let container: HTMLDivElement;
  let root: Root;
  let openExternal: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    openExternal = vi.fn(async () => {});
    setPlatform({ openExternal } as unknown as Platform);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    setPlatform(null);
    vi.unstubAllGlobals();
  });

  const render = (props: Partial<React.ComponentProps<typeof MomentStep>> = {}) =>
    act(() =>
      root.render(
        <MomentStep prompt="PERINTAH" projectTitle="YouTube 2026" submitting={false} error={null} onSubmit={vi.fn()} onLater={vi.fn()} {...props} />,
      ),
    );
  const button = (label: string) => [...container.querySelectorAll("button")].find((b) => b.textContent === label)!;
  const typeAnswer = (value: string) => {
    const area = container.querySelector("textarea:not([readonly])") as HTMLTextAreaElement;
    const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
    act(() => {
      setValue.call(area, value);
      area.dispatchEvent(new Event("input", { bubbles: true }));
    });
    return area;
  };

  it("copies the instructions in one tap", async () => {
    const writeText = vi.fn(async () => {});
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    render();
    await act(async () => button(i18n.t("moment.copy")).click());
    expect(writeText).toHaveBeenCalledWith("PERINTAH");
    expect(container.textContent).toContain(i18n.t("moment.copied"));
  });

  it("opens ChatGPT and Gemini in a new tab", () => {
    render();
    act(() => button(i18n.t("moment.open_chatgpt")).click());
    act(() => button(i18n.t("moment.open_gemini")).click());
    expect(openExternal.mock.calls).toEqual([[CHATGPT_URL], [GEMINI_URL]]);
  });

  it("explains under the box what is wrong, and sends nothing", () => {
    const onSubmit = vi.fn();
    render({ onSubmit });
    act(() => button(i18n.t("moment.submit")).click());
    let area = container.querySelector("textarea:not([readonly])")!;
    expect(area.getAttribute("aria-invalid")).toBe("true");
    expect(document.getElementById(area.getAttribute("aria-describedby")!)!.textContent).toBe(i18n.t("moment.problem_empty"));
    area = typeAnswer(good.slice(0, 30));
    act(() => button(i18n.t("moment.submit")).click());
    expect(document.getElementById(area.getAttribute("aria-describedby")!)!.textContent).toBe(i18n.t("moment.problem_cut_off"));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("sends a good answer", () => {
    const onSubmit = vi.fn();
    render({ onSubmit });
    typeAnswer("```json\n" + good + "\n```");
    act(() => button(i18n.t("moment.submit")).click());
    expect(onSubmit).toHaveBeenCalledWith(good);
  });

  it("says when the instructions are missing instead of offering an empty copy", () => {
    render({ prompt: "" });
    expect(container.textContent).toContain(i18n.t("moment.prompt_missing"));
    expect(button(i18n.t("moment.copy"))).toBeUndefined();
  });
});
```

Run: `npx vitest run src/lib/aiAnswer.test.ts src/components/create/MomentStep.test.tsx` → FAIL (modules missing).

- [ ] **Step 2: Implement `src/lib/aiAnswer.ts`**

```ts
// Step 3 (spec 4.2): check the answer pasted from ChatGPT or Gemini before it is sent,
// and say what is missing. Mirrors backend/ai_utils.py _clean_json_response/_parse_highlights.

export type AiAnswerProblem = "empty" | "cut_off" | "not_answer" | "no_moments" | "missing_times";

export type AiAnswerCheck =
  | { ok: true; moments: number; payload: string }
  | { ok: false; problem: AiAnswerProblem; moment?: number };

export function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fenced) return fenced[1].trim();
  return trimmed.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "").trim();
}

/** JSON.parse, or the part from the first bracket to the last (chat text around the answer). */
function parseLoose(body: string): unknown {
  try {
    return JSON.parse(body);
  } catch {
    // Text around the JSON: try the bracketed part.
  }
  const start = body.search(/[[{]/);
  const end = Math.max(body.lastIndexOf("}"), body.lastIndexOf("]"));
  if (start < 0 || end <= start) return undefined;
  try {
    return JSON.parse(body.slice(start, end + 1));
  } catch {
    return undefined;
  }
}

/** Starts like JSON but a bracket or a quote is still open at the end. */
function looksCutOff(body: string): boolean {
  const start = body.search(/[[{]/);
  if (start < 0) return false;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (const ch of body.slice(start)) {
    if (escaped) {
      escaped = false;
    } else if (ch === "\\") {
      escaped = true;
    } else if (ch === '"') {
      inString = !inString;
    } else if (!inString && (ch === "{" || ch === "[")) {
      depth++;
    } else if (!inString && (ch === "}" || ch === "]")) {
      depth--;
    }
  }
  return depth > 0 || inString;
}

function momentsOf(parsed: unknown): unknown[] | null {
  if (Array.isArray(parsed)) return parsed;
  if (!parsed || typeof parsed !== "object") return null;
  const object = parsed as Record<string, unknown>;
  if ("highlights" in object) return Array.isArray(object.highlights) ? object.highlights : null;
  return (Object.values(object).find(Array.isArray) as unknown[] | undefined) ?? null;
}

const TIME = /^\d{1,2}(:\d{1,2}){1,2}([.,]\d+)?$/;

function isTime(value: unknown): boolean {
  return (typeof value === "number" && value >= 0) || (typeof value === "string" && TIME.test(value.trim()));
}

export function checkAiAnswer(text: string): AiAnswerCheck {
  if (!text.trim()) return { ok: false, problem: "empty" };
  const body = stripCodeFence(text);
  const parsed = parseLoose(body);
  if (parsed === undefined) return { ok: false, problem: looksCutOff(body) ? "cut_off" : "not_answer" };
  const moments = momentsOf(parsed);
  if (!moments || moments.length === 0) return { ok: false, problem: "no_moments" };
  const bad = moments.findIndex((m) => {
    const item = m as Record<string, unknown> | null;
    return !item || typeof item !== "object" || !isTime(item.start_time) || !isTime(item.end_time);
  });
  if (bad >= 0) return { ok: false, problem: "missing_times", moment: bad + 1 };
  // The checked JSON is what goes to the backend, so chat text around it cannot trip its parser.
  return { ok: true, moments: moments.length, payload: JSON.stringify(parsed) };
}
```

`src/lib/clipboard.ts`:

```ts
/**
 * Copy text; true when it worked. Falls back to a hidden text area where the Clipboard API is
 * missing (older phone browsers, pages that are not https or localhost).
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Refused: try the old way below.
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const copied = document.execCommand("copy");
    area.remove();
    return copied;
  } catch {
    return false;
  }
}
```

- [ ] **Step 3: Implement `src/components/create/MomentStep.tsx`**

```tsx
import React, { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Copy, ExternalLink } from "lucide-react";
import { checkAiAnswer, type AiAnswerProblem } from "../../lib/aiAnswer";
import { copyText } from "../../lib/clipboard";
import { platform } from "../../platform";
import type { ErrorInfo } from "../../types/errorInfo";
import { ErrorCard } from "../ErrorCard";
import { Button } from "../ui/Button";

export const CHATGPT_URL = "https://chatgpt.com/";
export const GEMINI_URL = "https://gemini.google.com/app";

export interface MomentStepProps {
  /** metadata.manual_prompt of the waiting project. */
  prompt: string;
  projectTitle: string;
  submitting: boolean;
  error: { message: string; info: ErrorInfo | null } | null;
  onSubmit: (payload: string) => void;
  onLater: () => void;
}

function StepNumber({ n }: { n: number }) {
  return (
    <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-muted text-label font-semibold text-accent">
      {n}
    </span>
  );
}

/** Step 3 (spec 4.2): copy, ask ChatGPT or Gemini, paste the answer. */
export const MomentStep: React.FC<MomentStepProps> = ({ prompt, projectTitle, submitting, error, onSubmit, onLater }) => {
  const { t } = useTranslation();
  const headingId = useId();
  const answerId = useId();
  const problemId = useId();
  const [answer, setAnswer] = useState("");
  const [problem, setProblem] = useState<{ kind: AiAnswerProblem; moment?: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  const copy = async () => {
    const ok = await copyText(prompt);
    setCopied(ok);
    setCopyFailed(!ok);
    if (ok) setTimeout(() => setCopied(false), 3000);
  };

  const submit = () => {
    const result = checkAiAnswer(answer);
    if (!result.ok) {
      setProblem({ kind: result.problem, moment: result.moment });
      return;
    }
    setProblem(null);
    onSubmit(result.payload);
  };

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-5 rounded-card border border-border bg-bg-secondary p-4 md:p-6">
      <div className="flex flex-col gap-1">
        <h2 id={headingId} className="text-section-title text-text-primary">{t("moment.title")}</h2>
        <p className="text-body text-text-secondary">{t("moment.intro")}</p>
      </div>

      <ol className="flex flex-col gap-6">
        <li className="flex gap-3">
          <StepNumber n={1} />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            {prompt ? (
              <>
                <Button className="self-start" icon={copied ? Check : Copy} onClick={() => void copy()}>
                  {copied ? t("moment.copied") : t("moment.copy")}
                </Button>
                <p className="text-body text-text-secondary">{t("moment.copy_help")}</p>
                {copyFailed && (
                  <>
                    <p role="alert" className="text-body text-error">{t("moment.copy_failed")}</p>
                    <textarea
                      readOnly
                      aria-label={t("moment.copy_box_label")}
                      value={prompt}
                      className="min-h-[120px] w-full rounded-input border border-border-active bg-bg-surface p-3 text-body text-text-primary"
                    />
                  </>
                )}
              </>
            ) : (
              <p role="alert" className="text-body text-error">{t("moment.prompt_missing")}</p>
            )}
          </div>
        </li>

        <li className="flex gap-3">
          <StepNumber n={2} />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="flex flex-col gap-2 sm:flex-row">
              {/* The icon says "opens a new tab". */}
              <Button variant="outline" icon={ExternalLink} onClick={() => void platform().openExternal(CHATGPT_URL)}>
                {t("moment.open_chatgpt")}
              </Button>
              <Button variant="outline" icon={ExternalLink} onClick={() => void platform().openExternal(GEMINI_URL)}>
                {t("moment.open_gemini")}
              </Button>
            </div>
            <p className="text-body text-text-secondary">{t("moment.open_help")}</p>
          </div>
        </li>

        <li className="flex gap-3">
          <StepNumber n={3} />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <label htmlFor={answerId} className="text-label text-text-primary">{t("moment.answer_label")}</label>
            <textarea
              id={answerId}
              value={answer}
              onChange={(e) => {
                setAnswer(e.target.value);
                setProblem(null);
              }}
              aria-invalid={problem ? true : undefined}
              aria-describedby={problem ? problemId : undefined}
              className={`min-h-[160px] w-full rounded-input border bg-bg-secondary p-3 text-body text-text-primary ${problem ? "border-error" : "border-border-active"}`}
            />
            {problem && (
              <p id={problemId} className="text-body text-error">
                {t(`moment.problem_${problem.kind}`, { n: problem.moment })}
              </p>
            )}
            {error && (error.info ? <ErrorCard info={error.info} announce /> : <p role="alert" className="text-body text-error">{error.message}</p>)}
            <Button size="lg" className="w-full sm:w-auto sm:self-start" loading={submitting} onClick={submit}>
              {t("moment.submit")}
            </Button>
          </div>
        </li>
      </ol>

      <div className="flex flex-col gap-2 border-t border-border pt-4">
        <p className="text-body text-text-secondary">{t("moment.saved", { title: projectTitle })}</p>
        <Button variant="ghost" className="self-start" onClick={onLater}>{t("moment.later")}</Button>
      </div>
    </section>
  );
};
```

- [ ] **Step 4: `useClipJobs`, App, CreatePage, HistoryPage**

`src/hooks/useClipJobs.ts`:
- `import type { ErrorInfo } from "../types/errorInfo";` already exists; add:

```ts
export interface AwaitingAnswer {
  jobId: string;
  prompt: string;
  title: string;
}
```

- State:

```ts
  // Step 3 (spec 4.2): a project waits for the pasted AI answer.
  const [awaiting, setAwaiting] = useState<AwaitingAnswer | null>(null);
  const [sendingAnswer, setSendingAnswer] = useState(false);
  const [answerError, setAnswerError] = useState<{ message: string; info: ErrorInfo | null } | null>(null);
```

- Replace the `AWAITING_MANUAL` branch with:

```ts
          } else if (job.status === "AWAITING_MANUAL") {
            setStatus("IDLE");
            setCurrent(null);
            setHistoryVersion((v) => v + 1);
            if (jobOrigin === "workspace") {
              // Stay on "Buat klip", step 3; the project also waits in Riwayat.
              setAwaiting({ jobId: activeJobId, prompt: job.metadata?.manual_prompt || "", title: job.metadata?.title || "" });
              setAnswerError(null);
              notify(t("toast.manual_prompt_ready"), "success");
            }
            setActiveJobId(null);
            setProgress("");
            setQueuePosition(null);
```

- Add the actions:

```ts
  const submitAiAnswer = async (payload: string) => {
    if (!awaiting) return;
    setSendingAnswer(true);
    setAnswerError(null);
    try {
      // History keeps no API keys: B-roll needs the Pexels key from Settings.
      const res = await axios.post(`${API_URL}/jobs/${awaiting.jobId}/resume-manual`, {
        json_payload: payload,
        pexels_api_key: p.pexelsApiKey,
      });
      if (res.data.status !== "success") throw new Error(res.data.message || "resume-manual failed");
      platform().askNotifyPermission();
      clearError();
      setAwaiting(null);
      setClips([]);
      setFailedCount(0);
      setJobMeta(null);
      setLiveMeta(null);
      setJobOrigin("workspace");
      setMakePhase(true);
      setStatus("PENDING");
      setActiveJobId(res.data.job_id);
    } catch (err) {
      console.error(err);
      setAnswerError(requestError(err, t("moment.send_failed")));
    } finally {
      setSendingAnswer(false);
    }
  };

  /** "Tempel jawaban AI" in Riwayat: back to step 3 for that project. */
  const openAwaiting = (job: { id: string; metadata?: { manual_prompt?: string; title?: string } | null }) => {
    resetJobState();
    setAwaiting({ jobId: job.id, prompt: job.metadata?.manual_prompt || "", title: job.metadata?.title || "" });
  };

  const leaveAwaiting = () => {
    setAwaiting(null);
    setAnswerError(null);
  };
```

- `resetJobState` also does `setAwaiting(null); setAnswerError(null);` (placed before the `setAwaiting` in `openAwaiting`, so the later call wins).
- Return `awaiting, sendingAnswer, answerError, submitAiAnswer, openAwaiting, leaveAwaiting`.

`src/App.tsx`: add those six names to the destructuring of `useClipJobs` and to `contextValue`.

`src/pages/CreatePage.tsx`: import `MomentStep`; after the error card add:

```tsx
      {ctx.awaiting && (
        <MomentStep
          prompt={ctx.awaiting.prompt}
          projectTitle={ctx.awaiting.title}
          submitting={ctx.sendingAnswer}
          error={ctx.answerError}
          onSubmit={(payload) => void ctx.submitAiAnswer(payload)}
          onLater={() => {
            ctx.leaveAwaiting();
            ctx.handleResetWorkspace();
          }}
        />
      )}
```

`src/pages/HistoryPage.tsx` (replaced in Task 13): remove `ManualResumeModal` (import, `activeManualJob` state, the modal block); import `useNavigate` and `ROUTES`; the `AWAITING_MANUAL` button becomes:

```tsx
                  <Button variant="primary" icon={Play} onClick={() => { ctx.openAwaiting(job); navigate(ROUTES.create); }}>
                    {t("projects.action_paste_answer")}
                  </Button>
```

Delete `src/components/ManualResumeModal.tsx`.

- [ ] **Step 5: Texts** (`node scripts/add-locale-keys.mjs`)

```json
{
  "id": {
    "moment": {
      "title": "Pilih momen terbaik dengan bantuan AI",
      "intro": "Tiga langkah di bawah memakai ChatGPT atau Gemini. Tidak perlu kunci API.",
      "copy": "Salin perintah",
      "copied": "Tersalin",
      "copy_help": "Teks ini berisi transkrip video dan petunjuk untuk AI.",
      "copy_failed": "Perintah belum tersalin otomatis. Tekan lama teks di bawah, pilih semua, lalu salin.",
      "copy_box_label": "Teks perintah",
      "open_chatgpt": "Buka ChatGPT",
      "open_gemini": "Buka Gemini",
      "open_help": "Tempel perintah tadi, lalu kirim.",
      "answer_label": "Tempel jawaban AI di sini",
      "submit": "Buat klip",
      "problem_empty": "Kotak jawaban masih kosong. Tempel jawaban dari ChatGPT atau Gemini di sini.",
      "problem_cut_off": "Jawaban belum lengkap. Salin seluruh jawaban AI, termasuk tanda kurung di awal dan akhir.",
      "problem_not_answer": "Teks ini bukan jawaban untuk perintah tadi. Salin jawaban AI yang dimulai dengan tanda kurung { atau [.",
      "problem_no_moments": "Jawaban AI tidak berisi momen apa pun. Kirim ulang perintah ke AI, lalu salin jawabannya lagi.",
      "problem_missing_times": "Momen ke-{{n}} tidak punya waktu mulai dan selesai. Minta AI mengirim ulang jawabannya, lalu salin lagi.",
      "prompt_missing": "Teks perintah untuk proyek ini tidak ditemukan. Buka proyek ini dari Riwayat, atau mulai lagi dari video.",
      "send_failed": "Jawaban belum terkirim. Periksa sambungan, lalu tekan Buat klip lagi.",
      "saved": "Proyek ini tersimpan di Riwayat. Kamu bisa menempel jawabannya nanti.",
      "later": "Buat klip dari video lain"
    },
    "projects": { "action_paste_answer": "Tempel jawaban AI" }
  },
  "en": {
    "moment": {
      "title": "Pick the best moments with an AI chat",
      "intro": "The three steps below use ChatGPT or Gemini. No API key needed.",
      "copy": "Copy the instructions",
      "copied": "Copied",
      "copy_help": "This text holds the video transcript and instructions for the AI.",
      "copy_failed": "The instructions were not copied automatically. Press and hold the text below, select all, then copy.",
      "copy_box_label": "Instructions text",
      "open_chatgpt": "Open ChatGPT",
      "open_gemini": "Open Gemini",
      "open_help": "Paste the instructions, then send.",
      "answer_label": "Paste the AI's answer here",
      "submit": "Make clips",
      "problem_empty": "The answer box is empty. Paste the answer from ChatGPT or Gemini here.",
      "problem_cut_off": "The answer is not complete. Copy the AI's whole answer, including the brackets at the start and end.",
      "problem_not_answer": "This text is not the answer to the instructions. Copy the AI's answer that starts with a { or [ bracket.",
      "problem_no_moments": "The AI's answer has no moments in it. Send the instructions to the AI again, then copy the new answer.",
      "problem_missing_times": "Moment {{n}} has no start and end time. Ask the AI to send its answer again, then copy it.",
      "prompt_missing": "The instructions for this project were not found. Open it from History, or start again from the video.",
      "send_failed": "The answer was not sent. Check the connection, then press Make clips again.",
      "saved": "This project is saved in History. You can paste the answer later.",
      "later": "Make clips from another video"
    },
    "projects": { "action_paste_answer": "Paste the AI answer" }
  }
}
```

- [ ] **Step 6: Run all checks and walk the flow**

`npx vitest run` → 230 passing (214 + 8 + 5 + plain-words unchanged; record the total). `npx oxlint src` 0 errors. `npm run build`, `npm run build:cloud` exit 0. Real walk (web local or cloud build against a dev backend): start with a short YouTube link → step 2 progress → step 3 appears on the same page; "Salin perintah" copies; "Buka ChatGPT" opens a new tab; pasting half the answer shows the cut-off message under the box; the full answer starts step 4 on the same project id; Riwayat shows the project as "Menunggu jawaban AI" before the answer, and its button brings back step 3. At 360 px the three numbered steps fit without horizontal scroll.

- [ ] **Step 7: Log and commit**

PROGRESS-LOG entry; ledger `Task 11: complete (...)`.

```bash
git add -A src/lib/aiAnswer.ts src/lib/aiAnswer.test.ts src/lib/clipboard.ts src/components/create src/components/ManualResumeModal.tsx src/hooks/useClipJobs.ts src/App.tsx src/pages src/locales tasks/PROGRESS-LOG.md tasks/sp2-ledger.md
git commit -m "feat(sp2): guided manual AI step with answer checks on the create screen

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Results: `saveClips`, "⋯" menu, result cards, `Unduh semua`

Spec 4.5 (Hasil): one column on a phone, a grid on large screens; per clip the player (signed link), the AI title, the duration, **Unduh** and **Bagikan** (Social Kit), and a "⋯" menu with "Ubah subtitle atau tampilan" (question 4) and "Buka folder" (`caps.openFolder`); **Unduh semua** above the list; "Detail waktu" collapsed. New platform member `saveClips` (Spec gap 8). After a single-clip edit the result reloads from `GET /jobs/{id}`.

**Files:**
- Modify: `src/platform/types.ts` (`saveClips`), `src/platform/browser.ts` (`browserDownloadAll`, `browserPlatformParts`), `src/platform/desktop/index.ts`, `src/platform/browser.test.ts`, `src/platform/desktop/index.test.ts`
- Create: `src/components/ui/OverflowMenu.tsx`, `src/components/ui/OverflowMenu.test.tsx`
- Create: `src/lib/clipInfo.ts`, `src/lib/clipInfo.test.ts`
- Modify: `src/components/ClipCard.tsx`, `src/components/ClipsResult.tsx`, `src/components/ClipsResult.test.tsx` (create)
- Modify: `src/hooks/useClipJobs.ts` (`resultJobId`, reload after a clip edit), `src/App.tsx`, `src/pages/CreatePage.tsx`
- Delete: `src/components/ClipRerenderModal.tsx` (unused)
- Modify: `src/locales/{id,en}.json` (`result.*`)

**Interfaces:**
- Consumes: `ClipRef` (`src/platform/types.ts`), `browserDownload`, `useSignedVideo`, `videoHref`, `fileName`, `SocialKitModal`, `ClipEditModal`, `JobWarnings`, `TimingDetails`.
- Produces:
  - `Platform.saveClips(clips: ClipRef[]): Promise<void>`; `browserDownloadAll(clips: ClipRef[], gapMs?: number): Promise<void>`
  - `interface OverflowItem { id: string; label: string; onSelect: () => void; danger?: boolean }`; `<OverflowMenu label items />` (used by Task 13)
  - `timeToSeconds(v: unknown): number | null`, `clipSeconds(clip: { start?: unknown; end?: unknown }): number | null`, `formatClock(seconds: number): string`, `clipTitle(clip: Clip, lang: "id" | "en"): string | null`
  - `<ClipsResult clips status failedCount jobId metadata? onEditClip? onNew? />` (Task 13 uses it on the project page)
  - `useClipJobs` returns `resultJobId: string | null`; context exposes it.

- [ ] **Step 1: Write the failing tests**

`src/lib/clipInfo.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { clipSeconds, clipTitle, formatClock, timeToSeconds } from "./clipInfo";

describe("clip info for the result card (spec 4.5)", () => {
  it("reads the times the AI wrote", () => {
    expect(timeToSeconds("00:01:05.500")).toBe(65.5);
    expect(timeToSeconds("1:05")).toBe(65);
    expect(timeToSeconds("00:00:07,250")).toBe(7.25);
    expect(timeToSeconds(12)).toBe(12);
    expect(timeToSeconds("soon")).toBeNull();
  });

  it("gives the clip length, or nothing when it is unknown", () => {
    expect(clipSeconds({ start: "00:01:00", end: "00:01:45" })).toBe(45);
    expect(clipSeconds({ start: "00:01:00" })).toBeNull();
    expect(formatClock(45)).toBe("0:45");
    expect(formatClock(3725)).toBe("1:02:05");
  });

  it("takes the AI title in the app language, then the description", () => {
    const clip = { path: "a", description: "desc", start: "", end: "", subs: true, v: 0, social: { titles_id: ["Judul"], titles_en: ["Title"] } };
    expect(clipTitle(clip, "id")).toBe("Judul");
    expect(clipTitle(clip, "en")).toBe("Title");
    expect(clipTitle({ ...clip, social: undefined, description_id: "Deskripsi" }, "id")).toBe("Deskripsi");
    expect(clipTitle({ ...clip, social: undefined, description: "" }, "id")).toBeNull();
  });
});
```

`src/components/ui/OverflowMenu.test.tsx`:

```tsx
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../../i18n";
import { OverflowMenu } from "./OverflowMenu";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("OverflowMenu", () => {
  let container: HTMLDivElement;
  let root: Root;
  const edit = vi.fn();
  const folder = vi.fn();

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() =>
      root.render(
        <OverflowMenu label="Pilihan lain" items={[{ id: "edit", label: "Ubah", onSelect: edit }, { id: "folder", label: "Folder", onSelect: folder }]} />,
      ),
    );
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.clearAllMocks();
  });

  const toggle = () => container.querySelector<HTMLButtonElement>('button[aria-haspopup="menu"]')!;
  const items = () => [...container.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')];

  it("is a labelled button that opens a menu and focuses its first item", () => {
    expect(toggle().getAttribute("aria-label")).toBe("Pilihan lain");
    expect(toggle().getAttribute("aria-expanded")).toBe("false");
    act(() => toggle().click());
    expect(toggle().getAttribute("aria-expanded")).toBe("true");
    expect(items().map((i) => i.textContent)).toEqual(["Ubah", "Folder"]);
    expect(document.activeElement).toBe(items()[0]);
  });

  it("moves with the arrow keys and closes with Escape, back on the button", () => {
    act(() => toggle().click());
    act(() => {
      items()[0].dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    });
    expect(document.activeElement).toBe(items()[1]);
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(items()).toHaveLength(0);
    expect(document.activeElement).toBe(toggle());
  });

  it("runs the chosen item and closes", () => {
    act(() => toggle().click());
    act(() => items()[1].click());
    expect(folder).toHaveBeenCalledTimes(1);
    expect(items()).toHaveLength(0);
  });

  it("draws nothing without items", () => {
    act(() => root.render(<OverflowMenu label="x" items={[]} />));
    expect(container.innerHTML).toBe("");
  });
});
```

`src/components/ClipsResult.test.tsx`:

```tsx
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../i18n";
import { CAPS, setPlatform, type Platform } from "../platform";
import { setApiUrl } from "../platform/backendUrl";
import ClipsResult from "./ClipsResult";

vi.mock("./SocialKitModal", () => ({ SocialKitModal: () => null }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const clip = (n: number) => ({
  path: `C:\\lib\\clip_${n}.mp4`, video_url: `/video?p=clip_${n}&sig=s`, description: `Momen ${n}`,
  start: "00:00:10", end: "00:00:40", subs: true, v: 0,
});

describe("ClipsResult (spec 4.5)", () => {
  let container: HTMLDivElement;
  let root: Root;
  const saveClips = vi.fn(async () => {});

  beforeEach(() => {
    setApiUrl("http://127.0.0.1:5123");
    setPlatform({ caps: CAPS.local, saveClips, saveClip: vi.fn(), openFolder: vi.fn() } as unknown as Platform);
    container = document.createElement("div");
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    setPlatform(null);
  });

  it("downloads every clip with one button above the list", async () => {
    act(() => root.render(<ClipsResult clips={[clip(1), clip(2)]} status="DONE" failedCount={0} jobId="j1" />));
    const all = [...container.querySelectorAll("button")].find((b) => b.textContent === i18n.t("result.download_all"))!;
    await act(async () => all.click());
    expect(saveClips).toHaveBeenCalledWith([
      { path: "C:\\lib\\clip_1.mp4", filename: "clip_1.mp4", videoUrl: "http://127.0.0.1:5123/video?p=clip_1&sig=s&dl=1" },
      { path: "C:\\lib\\clip_2.mp4", filename: "clip_2.mp4", videoUrl: "http://127.0.0.1:5123/video?p=clip_2&sig=s&dl=1" },
    ]);
  });

  it("gives every clip Unduh, Bagikan and its duration", () => {
    act(() => root.render(<ClipsResult clips={[clip(1)]} status="DONE" failedCount={0} jobId="j1" />));
    const text = container.textContent!;
    expect(text).toContain(i18n.t("result.download"));
    expect(text).toContain(i18n.t("result.share"));
    expect(text).toContain("0:30");
  });
});
```

(`videoHref` in `src/lib/videoUrl.ts` appends `&dl=1` to a link that already has a query.)

Append to `src/platform/browser.test.ts`:

```ts
describe("browserDownloadAll", () => {
  it("downloads the clips one after another", async () => {
    const { browserDownloadAll } = await import("./browser");
    const names: string[] = [];
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      names.push(this.download);
    });
    await browserDownloadAll(
      [
        { path: "a", filename: "clip_1.mp4", videoUrl: "http://x/video?p=1" },
        { path: "b", filename: "clip_2.mp4", videoUrl: "http://x/video?p=2" },
      ],
      0,
    );
    expect(names).toEqual(["clip_1.mp4", "clip_2.mp4"]);
    click.mockRestore();
  });
});
```

In `src/platform/desktop/index.test.ts` change the dialog mock to a named mock:

```ts
const openDialog = vi.fn(async (_opts: unknown): Promise<string | null> => null);
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: openDialog, save: saveDialog }));
```

and add:

```ts
  it("saves all clips into one chosen folder, or nothing when cancelled", async () => {
    setApiUrl("http://127.0.0.1:5123");
    const post = vi.spyOn(axios, "post").mockResolvedValue({ data: {} });
    openDialog.mockResolvedValueOnce("D:\\out").mockResolvedValueOnce(null);
    const p = createPlatform();
    const clips = [
      { path: "C:\\app\\clip_1.mp4", filename: "clip_1.mp4" },
      { path: "C:\\app\\clip_2.mp4", filename: "clip_2.mp4" },
    ];
    await p.saveClips(clips);
    await p.saveClips(clips);
    expect(post.mock.calls).toEqual([
      ["http://127.0.0.1:5123/save_file", { src: "C:\\app\\clip_1.mp4", dest: "D:\\out" }],
      ["http://127.0.0.1:5123/save_file", { src: "C:\\app\\clip_2.mp4", dest: "D:\\out" }],
    ]);
  });
```

Run: `npx vitest run src/lib/clipInfo.test.ts src/components/ui/OverflowMenu.test.tsx src/components/ClipsResult.test.tsx src/platform` → FAIL.

- [ ] **Step 2: Platform**

`src/platform/types.ts`, in `Platform` after `saveClip`:

```ts
  /** Save several clips at once ("Unduh semua"): desktop asks for one folder, browsers download one by one. */
  saveClips(clips: ClipRef[]): Promise<void>;
```

`src/platform/browser.ts`: after `browserDownload` add

```ts
/** Several clips one after another; the short pause lets the browser start each download. */
export async function browserDownloadAll(clips: ClipRef[], gapMs = 400): Promise<void> {
  for (const [i, clip] of clips.entries()) {
    if (i > 0) await new Promise((resolve) => setTimeout(resolve, gapMs));
    await browserDownload(clip);
  }
}
```

add `| "saveClips"` to the `Pick<…>` of `browserPlatformParts` and `saveClips: (clips) => browserDownloadAll(clips),` to its object.

`src/platform/desktop/index.ts`, after `saveClip`:

```ts
    async saveClips(clips) {
      // One folder for all clips, not one save dialog per clip (plan Spec gap 8).
      const folder = await openDialog({ directory: true, multiple: false });
      if (typeof folder !== "string") return;
      for (const clip of clips) await axios.post(`${API_URL}/save_file`, { src: clip.path, dest: folder });
    },
```

- [ ] **Step 3: `clipInfo` and `OverflowMenu`**

`src/lib/clipInfo.ts`:

```ts
import type { Clip } from "../components/ClipCard";

// What the result card says about a clip (spec 4.5): its AI title and its length.

/** "00:01:05.500", "1:05", "00:00:07,250" or a number of seconds. */
export function timeToSeconds(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) && value >= 0 ? value : null;
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^(\d{1,2}:)?(\d{1,2}):(\d{1,2})([.,]\d+)?$/);
  if (!match) return null;
  const hours = match[1] ? Number(match[1].slice(0, -1)) : 0;
  const fraction = match[4] ? Number(`0.${match[4].slice(1)}`) : 0;
  return hours * 3600 + Number(match[2]) * 60 + Number(match[3]) + fraction;
}

export function clipSeconds(clip: { start?: unknown; end?: unknown }): number | null {
  const start = timeToSeconds(clip.start);
  const end = timeToSeconds(clip.end);
  return start !== null && end !== null && end > start ? Math.round((end - start) * 10) / 10 : null;
}

/** "0:45", "1:02:05". */
export function formatClock(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

export function clipTitle(clip: Clip, lang: "id" | "en"): string | null {
  const titles = lang === "en" ? clip.social?.titles_en : clip.social?.titles_id;
  const description = lang === "en" ? clip.description_en : clip.description_id;
  return titles?.find((x) => x?.trim()) || description?.trim() || clip.description?.trim() || null;
}
```

`src/components/ui/OverflowMenu.tsx`:

```tsx
import React, { useEffect, useId, useRef, useState } from "react";
import { Ellipsis } from "lucide-react";
import { Button } from "./Button";

export interface OverflowItem {
  id: string;
  label: string;
  onSelect: () => void;
  danger?: boolean;
}

/** The "⋯" menu (spec 4.5): a labelled 44 px button, arrow keys inside, Escape closes. */
export const OverflowMenu: React.FC<{ label: string; items: OverflowItem[] }> = ({ label, items }) => {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    const onPointer = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!menuRef.current?.contains(target) && !buttonRef.current?.contains(target)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [open]);

  if (items.length === 0) return null;

  const move = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const list = [...(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])];
    const at = list.indexOf(document.activeElement as HTMLButtonElement);
    const next = e.key === "ArrowDown" ? (at + 1) % list.length : (at - 1 + list.length) % list.length;
    list[next]?.focus();
  };

  return (
    <div className="relative shrink-0">
      <Button
        ref={buttonRef}
        variant="ghost"
        icon={Ellipsis}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((o) => !o)}
      />
      {open && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={label}
          onKeyDown={move}
          className="absolute right-0 z-20 mt-1 min-w-[240px] rounded-card border border-border bg-bg-secondary py-1 shadow-dropdown"
        >
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
              className={`flex min-h-[44px] w-full items-center px-4 text-left text-body hover:bg-bg-surface focus:bg-bg-surface focus:outline-none ${
                item.danger ? "text-error" : "text-text-primary"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
```

- [ ] **Step 4: Result card and list**

`src/components/ClipCard.tsx`: keep the `SocialData`, `Clip` exports and the `useSignedVideo`/`ErrorCard` player; replace the component body's returned JSX and handlers with:

```tsx
export default function ClipCard({ clip, index, jobId, onEdit }: ClipCardProps) {
  const { t, i18n } = useTranslation();
  const [showModal, setShowModal] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [localSocial, setLocalSocial] = useState<SocialData | undefined>(clip.social);
  const video = useSignedVideo(clip.path, clip.video_url);
  const caps = platform().caps;
  const lang = toLang(i18n.language);
  const title = clipTitle({ ...clip, social: localSocial }, lang) ?? t("result.clip_n", { n: index + 1 });
  const seconds = clipSeconds(clip);
  const description = lang === "en" ? clip.description_en || clip.description : clip.description_id || clip.description;

  const save = async () => {
    setSaveFailed(false);
    try {
      await platform().saveClip({
        path: clip.path,
        filename: fileName(clip.path),
        videoUrl: videoHref(video.src, API_URL, { dl: true }) || undefined,
      });
    } catch (err) {
      console.error("Save failed", err);
      setSaveFailed(true);
    }
  };

  const items: OverflowItem[] = [
    ...(onEdit ? [{ id: "edit", label: t("result.edit"), onSelect: onEdit }] : []),
    ...(caps.openFolder
      ? [{ id: "folder", label: t("result.open_folder"), onSelect: () => void platform().openFolder(clip.path).catch((err) => console.error("Open folder failed", err)) }]
      : []),
  ];

  return (
    <article className="flex flex-col gap-3 rounded-card border border-border bg-bg-secondary p-3">
      <div className="mx-auto aspect-[9/16] w-full max-w-[360px] overflow-hidden rounded-input bg-black">
        {video.failed ? (
          <ErrorCard info={localErrorInfo("VIDEO_LINK_REFUSED")} handlers={{ retry: video.retry }} className="h-full overflow-y-auto rounded-none border-0" />
        ) : (
          <video
            key={`${clip.v}-${video.src}`}
            src={videoHref(video.src, API_URL, { v: clip.v }) || undefined}
            onError={video.onError}
            controls
            playsInline
            preload="metadata"
            className="h-full w-full object-contain"
          />
        )}
      </div>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-card-title text-text-primary break-words">{title}</h3>
          <p className="text-caption text-text-secondary">
            {t("result.clip_n", { n: index + 1 })}
            {seconds !== null && ` · ${formatClock(seconds)}`}
          </p>
        </div>
        <OverflowMenu label={t("result.more", { n: index + 1 })} items={items} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" icon={Download} onClick={() => void save()}>{t("result.download")}</Button>
        {(description || localSocial) && (
          <Button variant="ghost" icon={Share2} onClick={() => setShowModal(true)}>{t("result.share")}</Button>
        )}
      </div>
      {saveFailed && <p role="alert" className="text-body text-error">{t("result.download_failed")}</p>}
      {(description || localSocial) && (
        <SocialKitModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          social={localSocial}
          clip={clip}
          jobId={jobId}
          clipIndex={index}
          onUpdate={(next) => setLocalSocial(next)}
        />
      )}
    </article>
  );
}
```

with imports `Download, Share2` from lucide, `Button`, `OverflowMenu, type OverflowItem`, `clipSeconds, clipTitle, formatClock` from `../lib/clipInfo`, `toLang` from `../lib/errorInfo`, and `useState` moved to the top import (drop `Folder`, `Sparkles`, `Pencil`, `Star`).

`src/components/ClipsResult.tsx`:

```tsx
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Download, Plus } from "lucide-react";
import ClipCard, { type Clip } from "./ClipCard";
import { Button } from "./ui/Button";
import { JobWarnings } from "./JobWarnings";
import { TimingDetails } from "./TimingDetails";
import { platform } from "../platform";
import { fileName } from "../platform/paths";
import { API_URL } from "../platform/backendUrl";
import { videoHref } from "../lib/videoUrl";

interface ClipsResultProps {
  clips: Clip[];
  status: string;
  failedCount: number;
  jobId: string;
  /** Job metadata: warnings and timings. */
  metadata?: Record<string, unknown> | null;
  onEditClip?: (index: number) => void;
  onNew?: () => void;
}

/** The clips of one project (spec 4.5): one column on a phone, a grid on large screens. */
export default function ClipsResult({ clips, status, failedCount, jobId, metadata, onEditClip, onNew }: ClipsResultProps) {
  const { t } = useTranslation();
  const headingId = useId();
  const [saving, setSaving] = useState(false);
  if (clips.length === 0) return null;
  const done = status === "DONE";

  const saveAll = async () => {
    setSaving(true);
    try {
      await platform().saveClips(
        clips.map((clip) => ({
          path: clip.path,
          filename: fileName(clip.path),
          videoUrl: videoHref(clip.video_url || "", API_URL, { dl: true }) || undefined,
        })),
      );
    } catch (err) {
      console.error("Save all failed", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id={headingId} className="text-section-title text-text-primary">
            {done ? t("result.title_done", { count: clips.length }) : t("result.title_partial", { count: clips.length })}
          </h2>
          {failedCount > 0 && <p className="text-body text-error">{t("result.failed", { count: failedCount })}</p>}
        </div>
        {done && clips.length > 1 && (
          <Button size="lg" icon={Download} loading={saving} onClick={() => void saveAll()}>
            {t("result.download_all")}
          </Button>
        )}
      </div>
      {done && <JobWarnings warnings={metadata?.warnings} />}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {clips.map((clip, i) => (
          <ClipCard key={clip.path} clip={clip} index={i} jobId={jobId} onEdit={onEditClip ? () => onEditClip(i) : undefined} />
        ))}
      </div>
      {done && <TimingDetails metadata={metadata} />}
      {done && onNew && (
        <Button variant="outline" icon={Plus} className="self-start" onClick={onNew}>
          {t("result.new")}
        </Button>
      )}
    </section>
  );
}
```

- [ ] **Step 5: Result project id and the page**

`src/hooks/useClipJobs.ts`:
- `const [resultJobId, setResultJobId] = useState<string | null>(null);`
- In the `DONE` branch for `jobOrigin === "workspace"`: `setResultJobId(activeJobId);`. For the history branch: after `setHistoryVersion`, `if (resultJobId) void reloadResult(resultJobId);`.
- `handleGenerate`, `handleManualGenerate`, `resetJobState`: `setResultJobId(null);`.
- Add:

```ts
  /** After a single clip was made again from the results: show the new clip files. */
  const reloadResult = async (jobId: string) => {
    try {
      const res = await axios.get(`${API_URL}/jobs/${jobId}`);
      const stamp = Date.now();
      setClips((res.data.clips || []).map((clip: Clip) => ({ ...clip, v: stamp })));
      setJobMeta(res.data.metadata || null);
    } catch (e) {
      console.error("Reloading the result failed", e);
    }
  };
```

- Return `resultJobId`; App puts it in context.

`src/pages/CreatePage.tsx`: import `ClipEditModal` and add `const [editClip, setEditClip] = useState<number | null>(null);`. Replace the `{finished && …}` block with:

```tsx
      {flow.hasClips && (finished || flow.running) && (
        <ClipsResult
          clips={ctx.clips}
          status={ctx.status}
          failedCount={ctx.failedCount}
          jobId={ctx.resultJobId ?? ""}
          metadata={ctx.jobMeta}
          onEditClip={finished && ctx.resultJobId ? setEditClip : undefined}
          onNew={ctx.handleResetWorkspace}
        />
      )}
      {editClip !== null && ctx.resultJobId && (
        <ClipEditModal
          jobId={ctx.resultJobId}
          clipIndex={editClip}
          clipTitle={t("result.clip_n", { n: editClip + 1 })}
          initialAspectRatio={ctx.jobMeta?.aspect_ratio || "9:16"}
          initialTrackingMode={ctx.jobMeta?.tracking_mode || "auto"}
          initialFaceTrackingEngine={ctx.jobMeta?.face_tracking_engine || "haar"}
          initialBurnSubs={ctx.jobMeta?.burn_subs ?? true}
          initialCanvasConfig={ctx.jobMeta?.canvas_config}
          initialSubtitleConfig={ctx.jobMeta?.subtitle_config}
          onClose={() => setEditClip(null)}
          onRerenderStart={(newJobId) => {
            setEditClip(null);
            ctx.handleRerenderClip(newJobId);
          }}
        />
      )}
```

Delete `src/components/ClipRerenderModal.tsx` (no importer: `git grep ClipRerenderModal` shows only the file).

- [ ] **Step 6: Texts** (`node scripts/add-locale-keys.mjs`)

```json
{
  "id": { "result": {
    "title_done": "{{count}} klip siap",
    "title_partial": "{{count}} klip sudah jadi, sisanya sedang dibuat",
    "failed": "{{count}} klip gagal dibuat.",
    "download_all": "Unduh semua",
    "download": "Unduh",
    "download_failed": "Klip belum terunduh. Tekan Unduh sekali lagi.",
    "share": "Bagikan",
    "more": "Pilihan lain untuk klip {{n}}",
    "edit": "Ubah subtitle atau tampilan",
    "open_folder": "Buka folder",
    "clip_n": "Klip {{n}}",
    "new": "Buat klip dari video lain"
  } },
  "en": { "result": {
    "title_done": "{{count}} clips ready",
    "title_partial": "{{count}} clips done, the rest are being made",
    "failed": "{{count}} clips could not be made.",
    "download_all": "Download all",
    "download": "Download",
    "download_failed": "The clip was not downloaded. Press Download once more.",
    "share": "Share",
    "more": "More for clip {{n}}",
    "edit": "Change subtitles or look",
    "open_folder": "Open folder",
    "clip_n": "Clip {{n}}",
    "new": "Make clips from another video"
  } }
}
```

- [ ] **Step 7: Run all checks and look at it**

`npx vitest run` → 245 passing (230 + 3 clipInfo + 4 menu + 2 result + 1 browser + 1 desktop + plain words; record the total). `npx oxlint src` 0 errors. `npm run build`, `npm run build:cloud` exit 0. In the browser: 360 px one column, 800 px two, 1280 px three; "⋯" opens with Enter, arrows move, Escape closes; Bagikan opens the Social Kit and its copy buttons copy in one tap; Unduh semua downloads every clip (web) or asks for one folder (desktop, owner checklist). antislop lines for the ledger: the only filled button on the result screen is "Unduh semua" (or none with one clip), no star/sparkle icons left, the score badge is gone.

- [ ] **Step 8: Log and commit**

PROGRESS-LOG entry; ledger `Task 12: complete (...)` plus `Ruling: the AI score badge is dropped from the card (decoration, not in spec 4.5) — cost if wrong: one line to add back`.

```bash
git add -A src/platform src/components/ui/OverflowMenu.tsx src/components/ui/OverflowMenu.test.tsx src/lib/clipInfo.ts src/lib/clipInfo.test.ts src/components/ClipCard.tsx src/components/ClipsResult.tsx src/components/ClipsResult.test.tsx src/components/ClipRerenderModal.tsx src/hooks/useClipJobs.ts src/App.tsx src/pages/CreatePage.tsx src/locales tasks/PROGRESS-LOG.md tasks/sp2-ledger.md
git commit -m "feat(sp2): result cards with Unduh, Bagikan, a menu and Unduh semua

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 13: Riwayat list and project page

Spec 4.5 (Riwayat), 4.2 (returning to step 3 via "Tempel jawaban AI"), and 5 (failed project error card). Replace the single long scroll in `HistoryPage` with a clean list of projects (`ProjectsPage` at `/riwayat`) and a dedicated project detail view (`ProjectPage` at `/riwayat/:id`), plus accessible dialogs for "Buat ulang semua klip" (`RerenderAllDialog`) and "Pilih ulang momen dengan AI" (`AiCorrectDialog`). Statuses and buttons use plain language from `src/lib/projectStatus.ts`.

**Files:**
- Create: `src/lib/projectStatus.ts`, `src/lib/projectStatus.test.ts`
- Create: `src/components/projects/RerenderAllDialog.tsx`, `src/components/projects/AiCorrectDialog.tsx`
- Create: `src/pages/ProjectsPage.tsx`, `src/pages/ProjectPage.tsx`, `src/pages/ProjectsPage.test.tsx`
- Modify: `src/hooks/useClipJobs.ts` (if `origin === "history"` reload triggers, pass `aiMode` for P2), `src/App.tsx` (pass `aiMode` to `useClipJobs`, mount `ProjectsPage` and `ProjectPage` on `/riwayat` and `/riwayat/:id`)
- Delete: `src/pages/HistoryPage.tsx`
- Modify: `src/locales/{id,en}.json` (`projects.*`)

**Interfaces:**
- Consumes: `GET /history` (`id, url, status, created_at, result_clips, metadata`), `GET /jobs/{id}` (`id, status, progress, queue_position, clips, failed, error, error_info, metadata`), `DELETE /history/{id}`, `canRerunAI` & `canResumeJob` (`src/lib/history.ts`), `effectiveProvider` (`src/lib/createFlow.ts`), `OverflowMenu` (`src/components/ui/OverflowMenu.tsx`), `ConfirmDialog` (`src/components/ui/ConfirmDialog.tsx`), `ClipsResult`, `JobReport`, `ErrorCard`.
- Produces:
  - `type ProjectStatusKey = "done" | "failed" | "awaiting" | "running" | "queued" | "cancelled"`
  - `type ProjectPrimaryAction = "view_clips" | "paste_answer" | "resume" | "retry" | "view_progress"`
  - `projectStatusKey(job: { status?: string; queue_position?: number | null }, isQueued?: boolean): ProjectStatusKey`
  - `projectPrimaryAction(job: HistoryJobLike & { status?: string; queue_position?: number | null }, isQueued?: boolean): ProjectPrimaryAction | null`
  - `<RerenderAllDialog isOpen initialMeta onClose onConfirm />`, `<AiCorrectDialog isOpen onClose onConfirm />`
  - `<ProjectsPage />`, `<ProjectPage />`

- [ ] **Step 1: Write the failing tests**

`src/lib/projectStatus.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { formatProjectDate, projectPrimaryAction, projectStatusKey } from "./projectStatus";

describe("projectStatus (spec 4.5)", () => {
  it("maps backend statuses to plain status keys", () => {
    expect(projectStatusKey({ status: "DONE" })).toBe("done");
    expect(projectStatusKey({ status: "completed" })).toBe("done");
    expect(projectStatusKey({ status: "ERROR" })).toBe("failed");
    expect(projectStatusKey({ status: "failed" })).toBe("failed");
    expect(projectStatusKey({ status: "AWAITING_MANUAL" })).toBe("awaiting");
    expect(projectStatusKey({ status: "CANCELLED" })).toBe("cancelled");
    expect(projectStatusKey({ status: "PENDING" })).toBe("queued");
    expect(projectStatusKey({ status: "DOWNLOADING", queue_position: 2 })).toBe("queued");
    expect(projectStatusKey({ status: "TRANSCRIBING", queue_position: 0 })).toBe("running");
    expect(projectStatusKey({ status: "GENERATING" }, true)).toBe("queued");
  });

  it("picks the one primary action matching status and source availability", () => {
    expect(projectPrimaryAction({ status: "DONE" })).toBe("view_clips");
    expect(projectPrimaryAction({ status: "AWAITING_MANUAL" })).toBe("paste_answer");
    expect(projectPrimaryAction({ status: "ERROR", url: "https://youtu.be/a" })).toBe("resume");
    expect(projectPrimaryAction({ status: "ERROR" })).toBeNull();
    expect(projectPrimaryAction({ status: "CANCELLED", metadata: { source_video: "x.mp4" } })).toBe("retry");
    expect(projectPrimaryAction({ status: "CANCELLED" })).toBeNull();
    expect(projectPrimaryAction({ status: "CROPPING" })).toBe("view_progress");
    expect(projectPrimaryAction({ status: "PENDING" })).toBe("view_progress");
  });

  it("formats dates cleanly without crashing on missing values", () => {
    expect(formatProjectDate("invalid", "id")).toBe("");
    expect(formatProjectDate(undefined, "id")).toBe("");
    expect(formatProjectDate("2026-11-20T14:05:00Z", "id")).toContain("2026");
  });
});
```

`src/pages/ProjectsPage.test.tsx`:

```tsx
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import axios from "axios";
import i18n from "../i18n";
import { AppContext } from "../App";
import { CAPS, setPlatform, type Platform } from "../platform";
import { ProjectsPage } from "./ProjectsPage";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("axios", () => ({ default: { get: vi.fn(), delete: vi.fn() } }));

function Where() {
  const { pathname } = useLocation();
  return <p data-testid="where">{pathname}</p>;
}

const makeCtx = (overrides: Record<string, unknown> = {}) =>
  ({
    historyVersion: 0,
    isRunning: false,
    activeJobId: null,
    queuePosition: null,
    provider: "manual_ai",
    apiKeys: {},
    selectedModel: "",
    aiMode: "manual",
    handleRerender: vi.fn(),
    handleRerunAI: vi.fn(),
    handleResumeJob: vi.fn(),
    openAwaiting: vi.fn(),
    openCookies: vi.fn(),
    requestLocalUpload: vi.fn(),
    requestDriveBrowser: vi.fn(),
    ...overrides,
  }) as unknown as React.ContextType<typeof AppContext>;

describe("ProjectsPage (spec 4.5)", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    await i18n.changeLanguage("id");
    setPlatform({ caps: CAPS.cloud } as unknown as Platform);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    setPlatform(null);
    vi.clearAllMocks();
  });

  it("shows status words, clip counts, one primary action, and error card for failed jobs", async () => {
    vi.mocked(axios.get).mockResolvedValueOnce({
      data: {
        status: "success",
        history: [
          {
            id: "j1",
            url: "https://youtu.be/abc",
            status: "DONE",
            created_at: "2026-11-20T10:00:00Z",
            result_clips: [{ path: "c1.mp4", description: "a", start: "0", end: "10", subs: true, v: 0 }],
            metadata: { title: "Podcast Pagi", ai_job: true },
          },
          {
            id: "j2",
            url: "https://youtu.be/def",
            status: "AWAITING_MANUAL",
            created_at: "2026-11-20T09:00:00Z",
            result_clips: [],
            metadata: { title: "Tutorial Masak", manual_prompt: "PROMPT" },
          },
          {
            id: "j3",
            url: "https://youtu.be/ghi",
            status: "ERROR",
            created_at: "2026-11-20T08:00:00Z",
            result_clips: [],
            metadata: {
              title: "Video Gagal",
              error_info: {
                code: "DOWNLOAD_FAILED",
                title: "Video belum bisa diunduh",
                message: "Cek link video lalu coba lagi.",
                title_en: "Could not download",
                message_en: "Try again.",
                actions: ["retry"],
              },
            },
          },
        ],
      },
    });

    await act(async () => {
      root.render(
        <AppContext.Provider value={makeCtx()}>
          <MemoryRouter initialEntries={["/riwayat"]}>
            <Routes>
              <Route path="/riwayat" element={<ProjectsPage />} />
              <Route path="/" element={<Where />} />
              <Route path="/riwayat/:id" element={<Where />} />
            </Routes>
          </MemoryRouter>
        </AppContext.Provider>,
      );
    });

    expect(container.textContent).toContain("Podcast Pagi");
    expect(container.textContent).toContain(i18n.t("projects.status_done"));
    expect(container.textContent).toContain(i18n.t("projects.action_view_clips"));
    expect(container.textContent).toContain("Tutorial Masak");
    expect(container.textContent).toContain(i18n.t("projects.status_awaiting"));
    expect(container.textContent).toContain(i18n.t("projects.action_paste_answer"));
    expect(container.textContent).toContain("Video belum bisa diunduh");

    // In cloud (apiKeys=false), "Pilih ulang momen dengan AI" stays hidden in the menu.
    const menus = [...container.querySelectorAll<HTMLButtonElement>('button[aria-haspopup="menu"]')];
    act(() => menus[0].click());
    expect(container.textContent).toContain(i18n.t("projects.menu_rerender"));
    expect(container.textContent).not.toContain(i18n.t("projects.menu_ai_rerun"));
  });

  it("brings awaiting projects back to step 3 when Tempel jawaban AI is clicked", async () => {
    const openAwaiting = vi.fn();
    vi.mocked(axios.get).mockResolvedValueOnce({
      data: {
        status: "success",
        history: [
          {
            id: "j2",
            url: "https://youtu.be/def",
            status: "AWAITING_MANUAL",
            created_at: "2026-11-20T09:00:00Z",
            result_clips: [],
            metadata: { title: "Tutorial Masak", manual_prompt: "PROMPT" },
          },
        ],
      },
    });

    await act(async () => {
      root.render(
        <AppContext.Provider value={makeCtx({ openAwaiting })}>
          <MemoryRouter initialEntries={["/riwayat"]}>
            <Routes>
              <Route path="/riwayat" element={<ProjectsPage />} />
              <Route path="/" element={<Where />} />
            </Routes>
          </MemoryRouter>
        </AppContext.Provider>,
      );
    });

    const btn = [...container.querySelectorAll("button")].find((b) => b.textContent?.includes(i18n.t("projects.action_paste_answer")))!;
    act(() => btn.click());
    expect(openAwaiting).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[data-testid="where"]')?.textContent).toBe("/");
  });
});
```

Run: `npx vitest run src/lib/projectStatus.test.ts src/pages/ProjectsPage.test.tsx` → FAIL (modules missing).

- [ ] **Step 2: Implement `src/lib/projectStatus.ts`**

```ts
import { canResumeJob, type HistoryJobLike } from "./history";

export type ProjectStatusKey = "done" | "failed" | "awaiting" | "running" | "queued" | "cancelled";
export type ProjectPrimaryAction = "view_clips" | "paste_answer" | "resume" | "retry" | "view_progress";

export function projectStatusKey(
  job: { status?: string | null; queue_position?: number | null },
  isQueued = false,
): ProjectStatusKey {
  const s = (job.status || "").toUpperCase();
  if (s === "DONE" || s === "COMPLETED") return "done";
  if (s === "ERROR" || s === "FAILED") return "failed";
  if (s === "AWAITING_MANUAL") return "awaiting";
  if (s === "CANCELLED") return "cancelled";
  if (isQueued || s === "PENDING" || (typeof job.queue_position === "number" && job.queue_position > 0)) {
    return "queued";
  }
  return "running";
}

export function projectPrimaryAction(
  job: HistoryJobLike & { status?: string | null; queue_position?: number | null },
  isQueued = false,
): ProjectPrimaryAction | null {
  const key = projectStatusKey(job, isQueued);
  if (key === "done") return "view_clips";
  if (key === "awaiting") return "paste_answer";
  if (key === "failed") return canResumeJob(job) ? "resume" : null;
  if (key === "cancelled") return canResumeJob(job) ? "retry" : null;
  return "view_progress";
}

export function formatProjectDate(value: string | undefined | null, lang: "id" | "en"): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(lang === "en" ? "en-US" : "id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
```

- [ ] **Step 3: Implement `RerenderAllDialog.tsx` and `AiCorrectDialog.tsx`**

`src/components/projects/RerenderAllDialog.tsx`:

```tsx
import React, { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { Button } from "../ui/Button";
import { Select } from "../ui/Select";
import { ToggleSwitch } from "../ui/ToggleSwitch";
import { CanvasConfigControls } from "../ui/CanvasConfigControls";
import { SubtitleConfigControls } from "../ui/SubtitleConfigControls";
import { DEFAULT_CANVAS_CONFIG, type CanvasConfig } from "../../types/canvas";
import { DEFAULT_SUBTITLE_CONFIG, type SubtitleConfig } from "../../types/subtitle";

export interface RerenderOptions {
  aspectRatio: string;
  burnSubs: boolean;
  canvasConfig: CanvasConfig;
  subtitleConfig: SubtitleConfig;
}

interface RerenderAllDialogProps {
  isOpen: boolean;
  initialMeta?: Record<string, unknown> | null;
  onClose: () => void;
  onConfirm: (opts: RerenderOptions) => void;
}

/** Re-make every clip in a project with updated look settings (spec 4.5). */
export const RerenderAllDialog: React.FC<RerenderAllDialogProps> = ({ isOpen, initialMeta, onClose, onConfirm }) => {
  const { t } = useTranslation();
  const titleId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);

  const meta = (initialMeta || {}) as Record<string, any>;
  const [aspectRatio, setAspectRatio] = useState<string>(meta.aspect_ratio || "9:16");
  const [burnSubs, setBurnSubs] = useState<boolean>(meta.burn_subs ?? true);
  const [canvasConfig, setCanvasConfig] = useState<CanvasConfig>(meta.canvas_config || DEFAULT_CANVAS_CONFIG);
  const [subtitleConfig, setSubtitleConfig] = useState<SubtitleConfig>(() => {
    if (meta.subtitle_config) return meta.subtitle_config;
    return { ...DEFAULT_SUBTITLE_CONFIG, style: meta.caption_style === "karaoke" ? "karaoke" : "standard" };
  });

  useEffect(() => {
    if (!isOpen) return;
    setAspectRatio(meta.aspect_ratio || "9:16");
    setBurnSubs(meta.burn_subs ?? true);
    setCanvasConfig(meta.canvas_config || DEFAULT_CANVAS_CONFIG);
    setSubtitleConfig(
      meta.subtitle_config || {
        ...DEFAULT_SUBTITLE_CONFIG,
        style: meta.caption_style === "karaoke" ? "karaoke" : "standard",
      },
    );
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, initialMeta, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-scrim p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="max-h-[90dvh] w-full max-w-xl overflow-y-auto rounded-card border border-border bg-bg-secondary shadow-dropdown"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border p-5">
          <h2 id={titleId} className="text-section-title text-text-primary">{t("projects.rerender_title")}</h2>
          <Button variant="ghost" icon={X} aria-label={t("common.close")} onClick={onClose} />
        </div>

        <div className="flex flex-col gap-4 p-5">
          <Select
            label={t("create.shape_label")}
            value={aspectRatio}
            onChange={(e) => setAspectRatio(e.target.value)}
            options={[
              { label: t("create.shape_vertical"), value: "9:16" },
              { label: t("create.shape_square"), value: "1:1" },
              { label: t("create.shape_wide"), value: "16:9" },
              ...(meta.aspect_ratio === "4:5" ? [{ label: "4:5", value: "4:5" }] : []),
            ]}
          />

          <ToggleSwitch checked={burnSubs} onChange={setBurnSubs} label={t("create.subtitles")} />

          {burnSubs && (
            <div className="border-t border-border pt-4">
              <SubtitleConfigControls
                config={subtitleConfig}
                onChange={setSubtitleConfig}
                showModeSwitch={true}
                aspectRatio={aspectRatio}
              />
            </div>
          )}

          {aspectRatio === "16:9" && (
            <div className="border-t border-border pt-4">
              <CanvasConfigControls config={canvasConfig} onChange={setCanvasConfig} showModeSwitch={true} />
            </div>
          )}
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-border p-5 sm:flex-row sm:justify-end">
          <Button ref={cancelRef} variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
          <Button onClick={() => onConfirm({ aspectRatio, burnSubs, canvasConfig, subtitleConfig })}>
            {t("projects.rerender_start")}
          </Button>
        </div>
      </div>
    </div>
  );
};
```

`src/components/projects/AiCorrectDialog.tsx`:

```tsx
import React, { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { Button } from "../ui/Button";

interface AiCorrectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (extraPrompt: string) => void;
}

/** Re-pick highlights using an extra instruction for API-key users (Plan Spec gap 14). */
export const AiCorrectDialog: React.FC<AiCorrectDialogProps> = ({ isOpen, onClose, onConfirm }) => {
  const { t } = useTranslation();
  const titleId = useId();
  const inputId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [extra, setExtra] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setExtra("");
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-scrim p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md rounded-card border border-border bg-bg-secondary shadow-dropdown"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border p-5">
          <h2 id={titleId} className="text-section-title text-text-primary">{t("projects.ai_title")}</h2>
          <Button variant="ghost" icon={X} aria-label={t("common.close")} onClick={onClose} />
        </div>
        <div className="flex flex-col gap-3 p-5">
          <label htmlFor={inputId} className="text-body text-text-primary">{t("projects.ai_desc")}</label>
          <textarea
            id={inputId}
            value={extra}
            onChange={(e) => setExtra(e.target.value)}
            placeholder={t("projects.ai_placeholder")}
            rows={4}
            className="w-full rounded-input border border-border-active bg-bg-primary p-3 text-body text-text-primary placeholder:text-text-secondary focus:border-accent focus:outline-none"
          />
        </div>
        <div className="flex flex-col-reverse gap-3 border-t border-border p-5 sm:flex-row sm:justify-end">
          <Button ref={cancelRef} variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
          <Button onClick={() => onConfirm(extra.trim())}>{t("projects.ai_start")}</Button>
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 4: Ruling P2 in `useClipJobs.ts` and implement `ProjectsPage.tsx` + `ProjectPage.tsx`**

In `src/hooks/useClipJobs.ts`:
- Import `effectiveProvider` and `type AiMode` from `../lib/createFlow`.
- Add `aiMode: AiMode;` to `ClipJobParams`.
- In `handleResumeJob` (`backend/jobs.py` line 1853 overwrites `hist_provider` whenever `fallback_provider` is set — **Pre-flight Ruling P2**):
  change `provider: p.provider,` to `provider: effectiveProvider(platform().caps, p.aiMode, p.provider),` (`handleRerunAI` keeps `p.provider` because AI Koreksi only appears when `caps.apiKeys`).
- In `src/App.tsx`, pass `aiMode` into `useClipJobs({...})` and mount `<Route path="riwayat" element={<ProjectsPage />} />` + `<Route path="riwayat/:id" element={<ProjectPage />} />`. Delete `src/pages/HistoryPage.tsx`.

`src/pages/ProjectsPage.tsx`:

```tsx
import React, { useCallback, useContext, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { useTranslation } from "react-i18next";
import { RefreshCw } from "lucide-react";
import { AppContext } from "../App";
import { ErrorCard } from "../components/ErrorCard";
import { RerenderAllDialog } from "../components/projects/RerenderAllDialog";
import { AiCorrectDialog } from "../components/projects/AiCorrectDialog";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { OverflowMenu, type OverflowItem } from "../components/ui/OverflowMenu";
import { useErrorActions } from "../hooks/useErrorActions";
import { asErrorInfo, localizedText, toLang } from "../lib/errorInfo";
import { canRerunAI } from "../lib/history";
import { formatProjectDate, projectPrimaryAction, projectStatusKey, type ProjectStatusKey } from "../lib/projectStatus";
import { projectPath, ROUTES } from "../lib/routes";
import { platform } from "../platform";
import { API_URL } from "../platform/backendUrl";

const BADGE_VARIANT: Record<ProjectStatusKey, "success" | "error" | "neutral"> = {
  done: "success",
  failed: "error",
  awaiting: "neutral",
  running: "neutral",
  queued: "neutral",
  cancelled: "neutral",
};

interface FailedRowCardProps {
  job: { id: string; metadata?: Record<string, unknown> | null };
}

const FailedRowError: React.FC<FailedRowCardProps> = ({ job }) => {
  const { i18n } = useTranslation();
  const meta = (job.metadata || {}) as Record<string, unknown>;
  const info = asErrorInfo(meta.error_info);
  const raw = typeof meta.error === "string" ? meta.error : "";
  const handlers = useErrorActions({ jobId: job.id });
  if (info) return <ErrorCard info={info} handlers={handlers} />;
  if (raw) return <p className="text-body text-error break-words m-0">{raw}</p>;
  return null;
};

/** Riwayat list (spec 4.5): project name, date, plain status, clip count, one primary action and a "⋯" menu. */
export const ProjectsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const ctx = useContext(AppContext);
  const navigate = useNavigate();
  const caps = platform().caps;
  const lang = toLang(i18n.language);

  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [rerenderTarget, setRerenderTarget] = useState<any | null>(null);
  const [aiTarget, setAiTarget] = useState<any | null>(null);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
    try {
      const res = await axios.get(`${API_URL}/history`);
      setProjects(Array.isArray(res.data?.history) ? res.data.history : []);
    } catch (err) {
      console.error("Failed to load projects", err);
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchProjects();
  }, [fetchProjects, ctx?.historyVersion]);

  const confirmDelete = async () => {
    const id = deleteTarget;
    setDeleteTarget(null);
    if (!id) return;
    try {
      await axios.delete(`${API_URL}/history/${id}`);
      await fetchProjects();
    } catch (err) {
      console.error("Failed to delete project", err);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-page-title text-text-primary">{t("projects.title")}</h1>
        <Button variant="outline" icon={RefreshCw} onClick={() => void fetchProjects()} disabled={loading}>
          {t("projects.refresh")}
        </Button>
      </div>

      {loading && projects.length === 0 ? (
        <p role="status" className="text-body text-text-secondary">{t("projects.loading")}</p>
      ) : loadFailed ? (
        <div role="alert" className="flex flex-col items-start gap-3 rounded-card border border-border bg-bg-secondary p-5">
          <p className="text-body text-error">{t("projects.load_failed")}</p>
          <Button variant="outline" icon={RefreshCw} onClick={() => void fetchProjects()}>{t("projects.retry_load")}</Button>
        </div>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-card border border-border bg-bg-secondary p-6">
          <p className="text-body text-text-secondary">{t("projects.empty")}</p>
          <Link to={ROUTES.create} className="inline-flex min-h-[44px] items-center rounded-button bg-accent px-4 py-2 text-body font-semibold text-on-accent hover:bg-accent-hover">
            {t("nav.create")}
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-4 p-0 m-0 list-none">
          {projects.map((job) => {
            const isQueuedHere = ctx?.activeJobId === job.id && (ctx?.queuePosition ?? 0) > 0;
            const statusKey = projectStatusKey(job, isQueuedHere);
            const action = projectPrimaryAction(job, isQueuedHere);
            const clips: any[] = Array.isArray(job.result_clips) ? job.result_clips : [];
            const title = (job.metadata?.title || "").trim() || job.url || t("projects.untitled");
            const dateText = formatProjectDate(job.created_at, lang);
            const failed = statusKey === "failed";
            const metaErrorInfo = asErrorInfo(job.metadata?.error_info);
            const errorCardOffersResume = !!metaErrorInfo?.actions?.some((a) => a === "resume" || a === "retry");

            const menuItems: OverflowItem[] = [
              ...(clips.length > 0
                ? [{ id: "rerender", label: t("projects.menu_rerender"), onSelect: () => setRerenderTarget(job) }]
                : []),
              ...(caps.apiKeys && canRerunAI(job)
                ? [{ id: "ai_rerun", label: t("projects.menu_ai_rerun"), onSelect: () => setAiTarget(job) }]
                : []),
              { id: "delete", label: t("projects.menu_delete"), danger: true, onSelect: () => setDeleteTarget(job.id) },
            ];

            const runPrimary = () => {
              if (action === "view_clips") navigate(projectPath(job.id));
              else if (action === "paste_answer") {
                ctx.openAwaiting(job);
                navigate(ROUTES.create);
              } else if (action === "resume" || action === "retry") {
                void ctx.handleResumeJob(job.id, "history");
              } else if (action === "view_progress") {
                navigate(ROUTES.create);
              }
            };

            const primaryLabel =
              action === "view_clips"
                ? t("projects.action_view_clips")
                : action === "paste_answer"
                  ? t("projects.action_paste_answer")
                  : action === "resume"
                    ? t("projects.action_resume")
                    : action === "retry"
                      ? t("projects.action_retry")
                      : t("projects.action_view_progress");

            return (
              <li key={job.id} className="flex flex-col gap-3 rounded-card border border-border bg-bg-secondary p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-card-title text-text-primary break-words">
                      <Link to={projectPath(job.id)} className="hover:text-accent hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded">
                        {title}
                      </Link>
                    </h2>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-caption text-text-secondary">
                      <Badge variant={BADGE_VARIANT[statusKey]}>{t(`projects.status_${statusKey}`)}</Badge>
                      {clips.length > 0 && <span>· {t("projects.clip_count", { count: clips.length })}</span>}
                      {dateText && <span>· {dateText}</span>}
                    </div>
                  </div>
                  <OverflowMenu label={t("projects.menu_label", { title })} items={menuItems} />
                </div>

                {failed && <FailedRowError job={job} />}

                {action && !(failed && errorCardOffersResume) && (
                  <div>
                    <Button variant={action === "paste_answer" || action === "view_clips" ? "primary" : "outline"} onClick={runPrimary}>
                      {primaryLabel}
                    </Button>
                  </div>
                )}

                {failed && metaErrorInfo && lang && !errorCardOffersResume && (
                  <p className="sr-only">{localizedText(metaErrorInfo, lang).title}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title={t("projects.delete_title")}
        message={t("projects.delete_body")}
        confirmLabel={t("projects.delete_confirm")}
        cancelLabel={t("common.cancel")}
        isDestructive
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleteTarget(null)}
      />

      <RerenderAllDialog
        isOpen={!!rerenderTarget}
        initialMeta={rerenderTarget?.metadata}
        onClose={() => setRerenderTarget(null)}
        onConfirm={(opts) => {
          const target = rerenderTarget;
          setRerenderTarget(null);
          if (target) {
            void ctx.handleRerender(
              target.id,
              opts.aspectRatio,
              opts.subtitleConfig.style,
              opts.burnSubs,
              opts.canvasConfig,
              opts.subtitleConfig,
            );
          }
        }}
      />

      <AiCorrectDialog
        isOpen={!!aiTarget}
        onClose={() => setAiTarget(null)}
        onConfirm={(extra) => {
          const target = aiTarget;
          setAiTarget(null);
          if (target) void ctx.handleRerunAI(target.id, extra);
        }}
      />
    </div>
  );
};
```

`src/pages/ProjectPage.tsx`:

```tsx
import React, { useCallback, useContext, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { useTranslation } from "react-i18next";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { AppContext } from "../App";
import { ClipEditModal } from "../components/ClipEditModal";
import ClipsResult from "../components/ClipsResult";
import { JobReport } from "../components/JobReport";
import { AiCorrectDialog } from "../components/projects/AiCorrectDialog";
import { RerenderAllDialog } from "../components/projects/RerenderAllDialog";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { OverflowMenu, type OverflowItem } from "../components/ui/OverflowMenu";
import { canRerunAI } from "../lib/history";
import { projectPrimaryAction, projectStatusKey, type ProjectStatusKey } from "../lib/projectStatus";
import { ROUTES } from "../lib/routes";
import { platform } from "../platform";
import { API_URL } from "../platform/backendUrl";

const BADGE_VARIANT: Record<ProjectStatusKey, "success" | "error" | "neutral"> = {
  done: "success",
  failed: "error",
  awaiting: "neutral",
  running: "neutral",
  queued: "neutral",
  cancelled: "neutral",
};

/** Single-project detail page at /riwayat/:id (Spec gap 10): clips, report, timings and actions. */
export const ProjectPage: React.FC = () => {
  const { id = "" } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const ctx = useContext(AppContext);
  const navigate = useNavigate();
  const caps = platform().caps;

  const [job, setJob] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [editClip, setEditClip] = useState<number | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [rerenderOpen, setRerenderOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);

  const fetchJob = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setLoadFailed(false);
    try {
      const res = await axios.get(`${API_URL}/jobs/${encodeURIComponent(id)}`);
      setJob(res.data);
    } catch (err) {
      console.error("Failed to load project", err);
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void fetchJob();
  }, [fetchJob, ctx?.historyVersion]);

  const handleDelete = async () => {
    setConfirmDeleteOpen(false);
    if (!job?.id) return;
    try {
      await axios.delete(`${API_URL}/history/${job.id}`);
      navigate(ROUTES.projects);
    } catch (err) {
      console.error("Failed to delete project", err);
    }
  };

  if (loading && !job) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <p role="status" className="text-body text-text-secondary">{t("projects.loading")}</p>
      </div>
    );
  }

  if (loadFailed || !job) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <Link to={ROUTES.projects} className="inline-flex min-h-[44px] items-center gap-2 self-start text-body text-accent hover:underline">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {t("projects.back")}
        </Link>
        <div role="alert" className="flex flex-col items-start gap-3 rounded-card border border-border bg-bg-secondary p-5">
          <p className="text-body text-error">{t("projects.load_failed")}</p>
          <Button variant="outline" icon={RefreshCw} onClick={() => void fetchJob()}>{t("projects.retry_load")}</Button>
        </div>
      </div>
    );
  }

  const meta = (job.metadata || {}) as Record<string, any>;
  const clips: any[] = Array.isArray(job.clips) ? job.clips : [];
  const statusKey = projectStatusKey(job);
  const title = (meta.title || "").trim() || meta.url || t("projects.untitled");
  const reportJob = {
    id: job.id,
    url: meta.url || "",
    status: job.status,
    metadata: {
      ...meta,
      ...(job.error ? { error: job.error } : {}),
      ...(job.error_info ? { error_info: job.error_info } : {}),
    },
  };
  const primary = projectPrimaryAction(reportJob);

  const menuItems: OverflowItem[] = [
    ...(clips.length > 0 ? [{ id: "rerender", label: t("projects.menu_rerender"), onSelect: () => setRerenderOpen(true) }] : []),
    ...(caps.apiKeys && canRerunAI(reportJob) ? [{ id: "ai_rerun", label: t("projects.menu_ai_rerun"), onSelect: () => setAiOpen(true) }] : []),
    { id: "delete", label: t("projects.menu_delete"), danger: true, onSelect: () => setConfirmDeleteOpen(true) },
  ];

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <Link to={ROUTES.projects} className="inline-flex min-h-[44px] items-center gap-2 self-start text-body text-accent hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {t("projects.back")}
      </Link>

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-page-title text-text-primary break-words">{title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-caption text-text-secondary">
            <Badge variant={BADGE_VARIANT[statusKey]}>{t(`projects.status_${statusKey}`)}</Badge>
            {clips.length > 0 && <span>· {t("projects.clip_count", { count: clips.length })}</span>}
          </div>
        </div>
        <OverflowMenu label={t("projects.menu_label", { title })} items={menuItems} />
      </div>

      {primary === "paste_answer" && (
        <div>
          <Button onClick={() => { ctx.openAwaiting(job); navigate(ROUTES.create); }}>
            {t("projects.action_paste_answer")}
          </Button>
        </div>
      )}

      {primary === "retry" && (
        <div>
          <Button variant="outline" onClick={() => void ctx.handleResumeJob(job.id, "history")}>
            {t("projects.action_retry")}
          </Button>
        </div>
      )}

      <JobReport job={reportJob} />

      {clips.length > 0 && (
        <ClipsResult
          clips={clips}
          status={job.status}
          failedCount={job.failed || 0}
          jobId={job.id}
          metadata={null}
          onEditClip={setEditClip}
        />
      )}

      {editClip !== null && (
        <ClipEditModal
          jobId={job.id}
          clipIndex={editClip}
          clipTitle={t("result.clip_n", { n: editClip + 1 })}
          initialAspectRatio={meta.aspect_ratio || "9:16"}
          initialTrackingMode={meta.tracking_mode || "auto"}
          initialFaceTrackingEngine={meta.face_tracking_engine || "haar"}
          initialBurnSubs={meta.burn_subs ?? true}
          initialCanvasConfig={meta.canvas_config}
          initialSubtitleConfig={meta.subtitle_config}
          onClose={() => setEditClip(null)}
          onRerenderStart={(newJobId) => {
            setEditClip(null);
            ctx.handleRerenderClip(newJobId);
          }}
        />
      )}

      <ConfirmDialog
        isOpen={confirmDeleteOpen}
        title={t("projects.delete_title")}
        message={t("projects.delete_body")}
        confirmLabel={t("projects.delete_confirm")}
        cancelLabel={t("common.cancel")}
        isDestructive
        onConfirm={() => void handleDelete()}
        onCancel={() => setConfirmDeleteOpen(false)}
      />

      <RerenderAllDialog
        isOpen={rerenderOpen}
        initialMeta={meta}
        onClose={() => setRerenderOpen(false)}
        onConfirm={(opts) => {
          setRerenderOpen(false);
          void ctx.handleRerender(job.id, opts.aspectRatio, opts.subtitleConfig.style, opts.burnSubs, opts.canvasConfig, opts.subtitleConfig);
        }}
      />

      <AiCorrectDialog
        isOpen={aiOpen}
        onClose={() => setAiOpen(false)}
        onConfirm={(extra) => {
          setAiOpen(false);
          void ctx.handleRerunAI(job.id, extra);
        }}
      />
    </div>
  );
};
```

- [ ] **Step 5: Texts** (`node scripts/add-locale-keys.mjs`)

Note: `projects.action_paste_answer` already exists from Task 11; omit it from `add-locale-keys.mjs` stdin so the add script does not refuse an existing key.

```json
{
  "id": {
    "projects": {
      "title": "Riwayat",
      "refresh": "Muat ulang",
      "loading": "Memuat riwayat…",
      "load_failed": "Riwayat belum bisa dimuat. Periksa sambungan lalu coba lagi.",
      "retry_load": "Coba lagi",
      "empty": "Belum ada proyek. Mulai dari Buat klip.",
      "untitled": "Proyek tanpa nama",
      "clip_count": "{{count}} klip",
      "back": "Kembali ke Riwayat",
      "status_done": "Selesai",
      "status_failed": "Gagal",
      "status_awaiting": "Menunggu jawaban AI",
      "status_running": "Sedang diproses",
      "status_queued": "Menunggu giliran",
      "status_cancelled": "Dibatalkan",
      "action_view_clips": "Lihat klip",
      "action_resume": "Lanjutkan",
      "action_retry": "Coba lagi",
      "action_view_progress": "Lihat progres",
      "menu_label": "Pilihan lain untuk {{title}}",
      "menu_rerender": "Buat ulang semua klip",
      "menu_ai_rerun": "Pilih ulang momen dengan AI",
      "menu_delete": "Hapus",
      "delete_title": "Hapus proyek ini?",
      "delete_body": "Semua klip dari proyek ini akan dihapus permanen.",
      "delete_confirm": "Ya, hapus",
      "rerender_title": "Buat ulang semua klip",
      "rerender_start": "Buat ulang klip",
      "ai_title": "Pilih ulang momen dengan AI",
      "ai_desc": "Tulis petunjuk tambahan supaya AI mencari bagian lain dari video ini.",
      "ai_placeholder": "Contoh: fokus cari bagian tentang cara mulai bisnis saja",
      "ai_start": "Pilih ulang momen"
    }
  },
  "en": {
    "projects": {
      "title": "History",
      "refresh": "Refresh",
      "loading": "Loading history…",
      "load_failed": "History could not be loaded. Check the connection and try again.",
      "retry_load": "Try again",
      "empty": "No projects yet. Start at Make clips.",
      "untitled": "Untitled project",
      "clip_count": "{{count}} clips",
      "back": "Back to History",
      "status_done": "Done",
      "status_failed": "Failed",
      "status_awaiting": "Waiting for AI answer",
      "status_running": "In progress",
      "status_queued": "Waiting in line",
      "status_cancelled": "Cancelled",
      "action_view_clips": "See clips",
      "action_resume": "Continue",
      "action_retry": "Try again",
      "action_view_progress": "See progress",
      "menu_label": "More for {{title}}",
      "menu_rerender": "Make all clips again",
      "menu_ai_rerun": "Pick moments again with AI",
      "menu_delete": "Delete",
      "delete_title": "Delete this project?",
      "delete_body": "Every clip from this project will be deleted permanently.",
      "delete_confirm": "Yes, delete",
      "rerender_title": "Make all clips again",
      "rerender_start": "Make clips again",
      "ai_title": "Pick moments again with AI",
      "ai_desc": "Write an extra instruction so AI looks for different moments in this video.",
      "ai_placeholder": "For example: focus only on tips for getting started",
      "ai_start": "Pick moments again"
    }
  }
}
```

- [ ] **Step 6: Run all checks**

`npx vitest run` → PASS (all previous + projectStatus + ProjectsPage tests + plainWords; record total). `npx oxlint src` 0 errors. `npm run build` and `npm run build:cloud` exit 0.

- [ ] **Step 7: Log and commit**

PROGRESS-LOG entry; ledger `Task 13: complete (...)`.

```bash
git add -A src/lib/projectStatus.ts src/lib/projectStatus.test.ts src/components/projects src/pages/ProjectsPage.tsx src/pages/ProjectPage.tsx src/pages/ProjectsPage.test.tsx src/pages/HistoryPage.tsx src/hooks/useClipJobs.ts src/App.tsx src/locales tasks/PROGRESS-LOG.md tasks/sp2-ledger.md
git commit -m "feat(sp2): plain-language Riwayat list and single project page

Co-Authored-By: Antigravity <noreply@anthropic.com>"
```

---

### Task 14: Pengaturan in four sections, downloader and help moved

Spec 4.5 (Pengaturan in four sections: **Umum**, **YouTube**, **Lanjutan**, **Bantuan**), moving `ManualDownloaderPage` (`#pengunduh` inside Lanjutan) and `HelpPage` (`#bantuan`), adding `ac_ai_mode` (Spec gap 12: manual AI default, automatic API key toggle only where `caps.apiKeys`), and splitting `ac_face_engine` into Lanjutan (Spec gap 13). Remove decorative flag/weather emojis from `AppearanceSection`.

**Files:**
- Create: `src/lib/settingsLayout.ts`, `src/lib/settingsLayout.test.ts`
- Create: `src/components/settings/AiModeSection.tsx`, `src/components/settings/DownloaderPanel.tsx`, `src/components/settings/HelpSection.tsx`, `src/components/settings/LogViewer.tsx`
- Modify: `src/components/settings/AppearanceSection.tsx`, `src/components/settings/OutputSection.tsx`, `src/pages/SettingsPage.tsx`, `src/hooks/useClipJobs.ts` (optional `overrideTitle`/`overrideQuality` parameters on `handleManualGenerate`)
- Delete: `src/pages/ManualDownloaderPage.tsx`, `src/pages/HelpPage.tsx`
- Modify: `src/locales/{id,en}.json` (`settings.*` additions & updates)

**Interfaces:**
- Consumes: `SETTINGS_ANCHORS` (`src/lib/routes.ts`), `useScrollToHash` (`src/hooks/useScrollToHash.ts`), `CookiesSection`, `ProviderSection`, `TranscriptionSection`, `UpdaterSection`, `platform().caps`, `GET /logs/{app|error|ai}`, `POST /jobs/manual` (via `ctx.handleManualGenerate`).
- Produces:
  - `settingsVisibility(caps: Pick<Caps, "apiKeys" | "localFilePicker" | "updater">, aiMode: AiMode): { showAiMode: boolean; showProviderKeys: boolean; showOutputFolder: boolean; showUpdater: boolean }` (`src/lib/settingsLayout.ts`)
  - `APP_VERSION` (`"1.19.0"`, synced with `package.json`)

- [ ] **Step 1: Write the failing test** (`src/lib/settingsLayout.test.ts`)

```ts
import { describe, expect, it } from "vitest";
import { CAPS } from "../platform/caps";
import { settingsVisibility } from "./settingsLayout";

describe("settingsVisibility (spec 4.5 & Spec gaps 12-13)", () => {
  it("hides API key mode, provider keys, output folder and updater on cloud", () => {
    expect(settingsVisibility(CAPS.cloud, "manual")).toEqual({
      showAiMode: false,
      showProviderKeys: false,
      showOutputFolder: false,
      showUpdater: false,
    });
    // Even stale "auto" in storage never exposes keys when caps.apiKeys is false.
    expect(settingsVisibility(CAPS.cloud, "auto").showProviderKeys).toBe(false);
  });

  it("shows API key switch on local web but hides local folder picker and updater", () => {
    expect(settingsVisibility(CAPS.local, "manual")).toEqual({
      showAiMode: true,
      showProviderKeys: false,
      showOutputFolder: false,
      showUpdater: false,
    });
    expect(settingsVisibility(CAPS.local, "auto").showProviderKeys).toBe(true);
  });

  it("shows folder picker and updater on desktop", () => {
    expect(settingsVisibility(CAPS.desktop, "auto")).toEqual({
      showAiMode: true,
      showProviderKeys: true,
      showOutputFolder: true,
      showUpdater: true,
    });
  });
});
```

Run: `npx vitest run src/lib/settingsLayout.test.ts` → FAIL (module missing).

- [ ] **Step 2: Implement `src/lib/settingsLayout.ts` and `useClipJobs.handleManualGenerate` overrides**

`src/lib/settingsLayout.ts`:

```ts
import type { Caps } from "../platform/types";
import type { AiMode } from "./createFlow";

export interface SettingsVisibility {
  showAiMode: boolean;
  showProviderKeys: boolean;
  showOutputFolder: boolean;
  showUpdater: boolean;
}

/** Filters Advanced and Help rows by platform capabilities (AGENTS F.6). */
export function settingsVisibility(
  caps: Pick<Caps, "apiKeys" | "localFilePicker" | "updater">,
  aiMode: AiMode,
): SettingsVisibility {
  return {
    showAiMode: caps.apiKeys,
    showProviderKeys: caps.apiKeys && aiMode === "auto",
    showOutputFolder: caps.localFilePicker,
    showUpdater: caps.updater,
  };
}
```

In `src/hooks/useClipJobs.ts`, update `handleManualGenerate` signature to:

```ts
  const handleManualGenerate = async (
    sourceUrl: string,
    manualClips: { start: number; end: number }[],
    allowEmptyClips: boolean = false,
    overrideTitle?: string,
    overrideQuality?: string,
  ) => {
    const resolvedTitle = (overrideTitle ?? p.title ?? "").trim();
    const resolvedQuality = overrideQuality || p.quality;
```

and validate/send `resolvedTitle` and `resolvedQuality` inside `handleManualGenerate` (so `DownloaderPanel` works immediately without relying on queued React state updates).

- [ ] **Step 3: Clean `AppearanceSection.tsx` and `OutputSection.tsx`, add `AiModeSection.tsx`**

`src/components/settings/AppearanceSection.tsx`: keep props `{ theme, setTheme }`; use `t("settings.sec_general")`, `t("settings.theme_dark")` / `t("settings.theme_light")` / `t("settings.theme_system")` (NO `🌙`/`☀️`/`💻`), `SegmentedControl` options `Bahasa Indonesia` (`id`) and `English` (`en`) (NO `🇮🇩`/`🇬🇧`), and `min-h-[44px]` + semantic focus styles on theme buttons.

`src/components/settings/OutputSection.tsx`: localize labels using `t("settings.output_title")`, `t("settings.folder_label")`, `t("settings.folder_default")`, `t("settings.pick_folder")`, `t("settings.quality_label")` (defaulting to `t("create.quality_auto")` for `"best"`). Keep `caps.localFilePicker` check (`AGENTS.md F.6`) and add `aria-label={t("settings.folder_reset")}` on the clear button.

`src/components/settings/AiModeSection.tsx`:

```tsx
import React from "react";
import { useTranslation } from "react-i18next";
import { ToggleSwitch } from "../ui/ToggleSwitch";
import type { AiMode } from "../../lib/createFlow";

interface AiModeSectionProps {
  aiMode: AiMode;
  setAiMode: (mode: AiMode) => void;
}

/** Switch between guided manual AI (default) and API-key automatic AI (Spec gap 12). */
export const AiModeSection: React.FC<AiModeSectionProps> = ({ aiMode, setAiMode }) => {
  const { t } = useTranslation();
  return (
    <div className="rounded-card border border-border bg-bg-secondary p-5">
      <h3 className="text-card-title text-text-primary">{t("settings.ai_mode_title")}</h3>
      <p className="mt-1 text-caption text-text-secondary">{t("settings.ai_mode_desc")}</p>
      <div className="mt-4">
        <ToggleSwitch
          checked={aiMode === "auto"}
          onChange={(checked) => setAiMode(checked ? "auto" : "manual")}
          label={t("settings.ai_mode_toggle")}
        />
      </div>
    </div>
  );
};
```

- [ ] **Step 4: Implement `DownloaderPanel.tsx`, `LogViewer.tsx`, and `HelpSection.tsx`**

`src/components/settings/DownloaderPanel.tsx` (replaces `ManualDownloaderPage.tsx` inside Lanjutan `#pengunduh`; removes pre-start quality probe button per plan Question 5, validates link via `linkProblem`, auto-generates title if blank, calls `ctx.handleManualGenerate(url.trim(), [], true, resolvedTitle, quality)` and shows `ErrorCard` if failed):

```tsx
import React, { useContext, useState } from "react";
import { useTranslation } from "react-i18next";
import { Download } from "lucide-react";
import { AppContext } from "../../App";
import { ErrorCard } from "../ErrorCard";
import { Button } from "../ui/Button";
import { InputGroup } from "../ui/InputGroup";
import { Select } from "../ui/Select";
import { useErrorActions } from "../../hooks/useErrorActions";
import { autoProjectTitle, linkProblem } from "../../lib/createFlow";
import { SETTINGS_ANCHORS } from "../../lib/routes";

/** Download a full video without cutting clips (moved from old ManualDownloaderPage, Spec 4.5). */
export const DownloaderPanel: React.FC = () => {
  const { t } = useTranslation();
  const ctx = useContext(AppContext);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [quality, setQuality] = useState(ctx.quality || "best");
  const problem = url.trim() ? linkProblem(url) : null;
  const errorActions = useErrorActions({ jobId: ctx.failedJobId, origin: "workspace" });

  const startDownload = () => {
    if (linkProblem(url) !== null) return;
    const resolvedTitle = title.trim() || autoProjectTitle({ kind: "link", url }, new Date());
    ctx.setTitle(resolvedTitle);
    ctx.setQuality(quality);
    void ctx.handleManualGenerate(url.trim(), [], true, resolvedTitle, quality);
  };

  return (
    <details id={SETTINGS_ANCHORS.downloader} className="group rounded-card border border-border bg-bg-secondary p-5">
      <summary className="cursor-pointer select-none text-card-title text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded">
        {t("settings.downloader_title")}
      </summary>
      <p className="mt-1 text-caption text-text-secondary">{t("settings.downloader_subtitle")}</p>
      <div className="mt-4 flex flex-col gap-4">
        <InputGroup
          label={t("create.link_label")}
          placeholder="https://youtube.com/watch?v=..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          error={problem === "unsupported"}
          helperText={problem === "unsupported" ? t("create.link_unsupported") : undefined}
        />
        <InputGroup
          label={t("create.project_name")}
          placeholder={t("create.project_name_placeholder")}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          helperText={t("create.project_name_help")}
        />
        <Select
          label={t("create.quality")}
          value={quality}
          onChange={(e) => setQuality(e.target.value)}
          options={[
            { label: t("create.quality_auto"), value: "best" },
            { label: "2160p (4K)", value: "2160p" },
            { label: "1440p (2K)", value: "1440p" },
            { label: "1080p", value: "1080p" },
            { label: "720p", value: "720p" },
            { label: "480p", value: "480p" },
          ]}
        />
        {ctx.errorMsg && ctx.errorInfo && <ErrorCard info={ctx.errorInfo} handlers={errorActions} announce />}
        <div>
          <Button variant="outline" icon={Download} disabled={ctx.isRunning || linkProblem(url) !== null} onClick={startDownload}>
            {t("settings.downloader_btn")}
          </Button>
        </div>
      </div>
    </details>
  );
};
```

`src/components/settings/LogViewer.tsx` (collapsed technical log viewer inside Bantuan, using `copyText` from `src/lib/clipboard.ts`, `API_URL` from `src/platform/backendUrl.ts`, and WCAG AA styling).

`src/components/settings/HelpSection.tsx`: displays 4 short plain-language steps (`1 Video → 2 Siapkan → 3 Pilih momen → 4 Klip`), plain FAQ items (`settings.help_faqs`), app version `1.19.0`, `<UpdaterSection />` when `showUpdater`, and `<LogViewer />` inside a collapsed `<details>`.

- [ ] **Step 5: Assemble `SettingsPage.tsx` in 4 sections + locales**

`src/pages/SettingsPage.tsx` uses `useScrollToHash()`, `settingsVisibility(caps, ctx.aiMode)`, and renders:
1. `<section id={SETTINGS_ANCHORS.general}>` (**Umum**): `<AppearanceSection />`
2. `<section id={SETTINGS_ANCHORS.youtube}>` (**YouTube**): `<CookiesSection />`
3. `<section id={SETTINGS_ANCHORS.advanced}>` (**Lanjutan**):
   - `<AiModeSection />` (when `vis.showAiMode`) + `<ProviderSection />` (when `vis.showProviderKeys`)
   - Face tracking engine `<Select>` (`ac_face_engine`: Standar vs Teliti, Spec gap 13)
   - `<OutputSection />` (download folder when `vis.showOutputFolder` + default download quality)
   - `<TranscriptionSection />` (Whisper speech model selection)
   - `<DownloaderPanel />` (id `pengunduh`)
4. `<section id={SETTINGS_ANCHORS.help}>` (**Bantuan**): `<HelpSection showUpdater={vis.showUpdater} />`

Delete `src/pages/ManualDownloaderPage.tsx` and `src/pages/HelpPage.tsx`. Add locale keys with `node scripts/add-locale-keys.mjs` for `settings.*` (four section headings `sec_general`, `sec_youtube`, `sec_advanced`, `sec_help`, AI mode strings, face engine strings, downloader strings, output strings, clean `AppearanceSection` strings, and updated `help_*` guides/FAQs without outdated jargon or emojis).

- [ ] **Step 6: Run checks**

`npx vitest run` → PASS (all previous + `settingsLayout.test.ts` + plainWords + locales). `npx oxlint src` 0 errors. `npm run build`, `npm run build:cloud` exit 0.

- [ ] **Step 7: Log and commit**

PROGRESS-LOG entry; ledger `Task 14: complete (...)`.

```bash
git add -A src/lib/settingsLayout.ts src/lib/settingsLayout.test.ts src/components/settings src/pages/SettingsPage.tsx src/pages/ManualDownloaderPage.tsx src/pages/HelpPage.tsx src/hooks/useClipJobs.ts src/locales tasks/PROGRESS-LOG.md tasks/sp2-ledger.md
git commit -m "feat(sp2): four-section Settings with AI mode, face engine, downloader and help

Co-Authored-By: Antigravity <noreply@anthropic.com>"
```

---

### Task 15: antislop audit: copy, UI, phone layout, contrast, keyboard

Spec 4.6, 6, and 7 step 8. Perform the formal audit across EVERY file in `src/` (including legacy gates, modals, and advanced panels per Pre-flight Ruling **P11**) using the five antislop skills (`antislop`, `antislop-copywriting`, `antislop-ui`, `antislop-layoutmobile`, `antislop-human`), expand automated guards if any loophole exists, fix every defect found, inspect rendered builds in a headless browser at `360px`, `768px`, `1280px` in both light and dark modes, and write `tasks/sp2-audit.md`.

**Files:**
- Modify: `src/locales/plainWords.test.ts` (verify `timing.device_*` / `timing.stage_*` and all main-screen namespaces), `src/locales/{id,en}.json` (remove any leftover emojis/jargon in settings/errors/gates caught in audit)
- Modify (audit fixes for P11 & contrast/a11y/mobile overflow): `src/components/{AuthGate,LocalGate,GDriveBrowserModal,SocialKitModal,ClipEditModal,CookiesModal,CookiesPanel,SplashScreen,Toasts}.tsx`, `src/components/settings/{ProviderSection,TranscriptionSection,UpdaterSection,UpdateOverlay}.tsx`, `src/components/ui/{CanvasConfigControls,SubtitleConfigControls,Badge}.tsx` (wherever hardcoded `bg-white`, `bg-bg-card`, `text-accent-fg`, `text-white` on semantic colors, `<div onClick>`, missing `aria-label`, `alert()`/`confirm()`, or `<44px` tap targets exist)
- Create: `tasks/sp2-audit.md`

- [ ] **Step 1: Search for undefined tokens, anti-patterns, and hardcoded colors**

Check `src/` with `rg`:
1. Undefined or raw colors (`bg-bg-card`, `text-accent-fg`, `bg-white\b`, `bg-error\b`, `bg-success\b`, `text-red-400`, `text-green-500`, `text-amber-`, `animate-pulse`, `bg-brand-gradient`, emojis on interactive UI buttons).
2. Raw `alert(` / `window.confirm(` / `<div onClick` without button role in `src/` (`ClipEditModal.tsx`, `TranscriptionSection.tsx`, `AuthGate.tsx`, etc.).
3. Icon-only `<button>` elements missing `aria-label` or smaller than `min-h-[44px] min-w-[44px]`.

- [ ] **Step 2: Fix every issue found**

- Update any legacy modals/controls (`AuthGate`, `LocalGate`, `GDriveBrowserModal`, `SocialKitModal`, `ClipEditModal`, `CookiesModal`, `CookiesPanel`, `SplashScreen`, `ProviderSection`, `TranscriptionSection`, `CanvasConfigControls`, `SubtitleConfigControls`, `UpdateOverlay`) so ALL buttons/dialogs meet:
  - WCAG AA contrast in both light and dark themes (no `text-white` on `bg-accent`, no `bg-bg-card`, no `bg-white` + `text-text-primary`)
  - Keyboard reachability (`Escape` on modals, `<button type="button">` instead of `<div onClick>`, visible focus ring, `aria-label` on icon buttons, inline status/error instead of `window.alert()`)
  - Phone fit (`360px` with zero horizontal overflow, wrapped flex/grid rows, `min-h-[44px]` touch targets).

- [ ] **Step 3: Verify contrast script, tests, builds, and browser viewport walkthrough**

1. Run antislop contrast checker:

```powershell
$script = "C:\Users\dhima\.gemini\config\plugins\anti-slop\skills\antislop-human\contrast-check.py"
$py = "C:\Users\dhima\projects\ac-venv\Scripts\python.exe"
foreach ($pair in @(
  "#1C1D1F #F6F6F4", "#55585E #ECECE9", "#FFFFFF #1F5FCC", "#1F5FCC #F6F6F4", "#B42318 #FFFFFF",
  "#ECECEA #141517", "#A6A8AD #26272B", "#0D1B33 #7EA8FF", "#7EA8FF #141517", "#FF8A80 #1C1D20"
)) {
  $fg, $bg = $pair.Split(" ")
  "$pair -> $(& $py $script $fg $bg | Select-Object -First 1)"
}
```

2. Run `npx vitest run`, `npx oxlint src`, `npm run build`, `npm run build:cloud`.
3. Inspect the rendered app through `backend.main --web` at `360×780`, `768×1024`, and `1280×800` in both light and dark modes (via Chrome DevTools / Edge headless), testing keyboard navigation across navigation, Create steps, OverflowMenu, Settings accordions, and dialogs.

- [ ] **Step 4: Write `tasks/sp2-audit.md` and commit**

Record the four-part Delivery Gate report (Copywriting, UI, Layout/Mobile, Human/Contrast + keyboard walkthrough results) in `tasks/sp2-audit.md`, update `tasks/PROGRESS-LOG.md` and `tasks/sp2-ledger.md`.

```bash
git add -A src tasks/sp2-audit.md tasks/PROGRESS-LOG.md tasks/sp2-ledger.md
git commit -m "chore(sp2): complete antislop copy, contrast, mobile layout and keyboard audit

Co-Authored-By: Antigravity <noreply@anthropic.com>"
```

---

### Task 16: Parked SP1 items: port check, tutorial arrow, test comment

Spec 4.7 (carried over from `tasks/sp1-ledger.md`). Complete the three small items parked at the end of SP1.

**Files:**
- Modify: `backend/web_mode.py` (`port_is_free`)
- Modify: `backend/tests/test_web_mode.py` (test for occupied connecting listener + fix misleading comment at line 241)
- Modify: `docs/tutorial-auto-clipper-cloud.md` (`$\rightarrow$` in Kendala 9)
- Modify: `tasks/sp1-ledger.md` (note carried items fixed in SP2)

- [ ] **Step 1: Write the failing test** (append to `backend/tests/test_web_mode.py`)

Add a test proving `port_is_free` returns `False` when another socket is already listening on `127.0.0.1:<port>` (including when `SO_REUSEADDR` / Windows dual-socket conditions occur), AND update line 241's misleading comment `# the real liveness check` to explain clearly what the test verifies.

Run: `C:\Users\dhima\projects\ac-venv\Scripts\python.exe -m pytest backend/tests/test_web_mode.py -q -p no:cacheprovider`

- [ ] **Step 2: Fix `backend/web_mode.py` and `docs/tutorial-auto-clipper-cloud.md`**

In `backend/web_mode.py` `port_is_free(port: int) -> bool`:
Before attempting `s.bind((HOST, port))`, try connecting to `(HOST, port)` (`with socket.socket(...) as c: c.settimeout(0.2); if c.connect_ex((HOST, port)) == 0: return False`). Then run the existing bind check.
In `docs/tutorial-auto-clipper-cloud.md` lines 437–438, replace the broken split `$\n\rightarrow$` / `$\rightarrow$` with plain arrow `→` (`**Runtime** → **Disconnect and delete runtime**`).

- [ ] **Step 3: Run tests and commit**

Run `C:\Users\dhima\projects\ac-venv\Scripts\python.exe -m pytest backend/tests -q -p no:cacheprovider`.
Update `tasks/sp1-ledger.md` (annotate the three parked items as resolved in SP2 Task 16), `tasks/PROGRESS-LOG.md`, and `tasks/sp2-ledger.md`.

```bash
git add backend/web_mode.py backend/tests/test_web_mode.py docs/tutorial-auto-clipper-cloud.md tasks/sp1-ledger.md tasks/PROGRESS-LOG.md tasks/sp2-ledger.md
git commit -m "fix(sp2): complete SP1 parked port connect check, tutorial arrow and test comment

Co-Authored-By: Antigravity <noreply@anthropic.com>"
```

---

### Task 17: Docs, CHANGELOG, ADR-014, AGENTS.md

Spec 7 step 8. Update user guides for the 4-step SP2 UI, record architectural decisions in ADR-014, append SP2 under `## [1.19.0] - belum dirilis` in `CHANGELOG.md` (Question 6), update `.agents/AGENTS.md` architecture & file references, and mark `T2.0`/`T2.x` in `tasks/roadmap-todo.md`.

**Files:**
- Modify: `docs/panduan-penggunaan-awam.md`, `docs/tutorial-auto-clipper-cloud.md`, `README.md`
- Modify: `CHANGELOG.md` (add SP2 under `## [1.19.0] - belum dirilis`, keeping version `1.19.0`)
- Create: `docs/decisions/014-sp2-live-stage-and-step-ui.md`
- Modify: `.agents/AGENTS.md` (add Task 1–14 backend/frontend invariants & file directory entries)
- Modify: `tasks/roadmap-todo.md` (`T2.*` entries)

- [ ] **Step 1: Update user docs and `README.md`**

- `docs/panduan-penggunaan-awam.md`: rewrite Langkah 3 to match the 4-step `Buat klip` flow (`1 Video → 2 Siapkan → 3 Pilih momen → 4 Klip`), manual AI default (`Salin perintah`, `Buka ChatGPT`/`Buka Gemini`, `Tempel jawaban AI di sini`, `Buat klip`), real progress rows, `Unduh semua`, Riwayat (`Tempel jawaban AI`), and Pengaturan 4 sections (Umum, YouTube, Lanjutan, Bantuan).
- `docs/tutorial-auto-clipper-cloud.md`: sync screen/button names with SP2 (`Buat klip`, `Pilih momen`, `Riwayat`, `Pengaturan`).
- `README.md`: update feature summary where needed to match v1.19.0 SP1+SP2.

- [ ] **Step 2: Write ADR-014 and update `CHANGELOG.md` + `.agents/AGENTS.md`**

- `docs/decisions/014-sp2-live-stage-and-step-ui.md`: document:
  1. `stage_timer` live stack (`report()`, `current_stage()`, `GET /jobs/{id}.current` with `elapsed_seconds`) without altering `timings`.
  2. Canvas image upload (`/upload-image`) + `path_guard` validation on job creation/rerender endpoints.
  3. Single 4-step `CreatePage` flow driven by pure functions (`createFlow.ts`, `progress.ts`, `aiAnswer.ts`, `clipChoices.ts`).
  4. Manual-first AI (`ac_ai_mode = "manual"` default) and optional API key mode in Pengaturan → Lanjutan.
  5. `caps.keepOpen`, `platform().saveClips()`, token & accessibility system (`contrast.test.ts`, `plainWords.test.ts`).
- `CHANGELOG.md`: add SP2 `Added`, `Changed`, `Fixed`, `Removed` items clearly under existing `## [1.19.0] - belum dirilis`.
- `.agents/AGENTS.md`: document `/upload-image` & canvas `path_guard`, `current` live stage rules, `caps.keepOpen` / `saveClips()`, `src/locales/plainWords.test.ts`, and updated key files.
- `tasks/roadmap-todo.md`: tick `T2.0` and `T2.x` items with verified commit references.

- [ ] **Step 3: Check markdown links/prose and commit**

Verify no broken markdown syntax or banned `$\rightarrow$` in docs.

```bash
git add docs CHANGELOG.md README.md .agents/AGENTS.md tasks/roadmap-todo.md tasks/PROGRESS-LOG.md tasks/sp2-ledger.md
git commit -m "docs(sp2): update guides, changelog, AGENTS.md and add ADR-014

Co-Authored-By: Antigravity <noreply@anthropic.com>"
```

---

### Task 18: Final verification and the owner's usability test

Spec 6 and 7 step 8. Run the complete verification gate over the entire branch (`dc3ba66..HEAD`), execute a whole-branch independent code review + any fix round, record final test/build/audit numbers, and log the owner's manual usability checklist in `tasks/PROGRESS-LOG.md` & `tasks/sp2-ledger.md`.

**Files:**
- Modify: `tasks/PROGRESS-LOG.md`, `tasks/sp2-ledger.md` (+ any fix-round files if the whole-branch review finds Critical/Important items)

- [ ] **Step 1: Full verification suite**

Run every check cleanly and capture exact outputs:
1. `C:\Users\dhima\projects\ac-venv\Scripts\python.exe -m pytest backend/tests -q -p no:cacheprovider`
2. From `C:\Users\dhima\projects\auto-clipper`: `npx vitest run`, `npx oxlint src`, `npm run build`, `npm run build:cloud`, `npm audit --omit=dev` (and full `npm audit`).
3. Verify deleted files (`WorkspacePage`, `ManualAIEditorPage`, `ManualDownloaderPage`, `HelpPage`, `LandingPage`, `BusyOverlay`, `ManualResumeModal`, `ClipRerenderModal`, `GenerateForm`, `Sidebar`) have zero remaining imports or references across `src/`.

- [ ] **Step 2: Whole-branch independent review**

Invoke `code-reviewer` subagent on `git diff dc3ba66..HEAD -- ':!package-lock.json'` following `tasks/sp1-reviewer-instructions.md` (`docs/superpowers/specs/2026-11-20-sp2-ux-for-everyone-design.md`, `docs/superpowers/plans/2026-11-20-sp2-ux-for-everyone.md`, `.agents/AGENTS.md`, `tasks/sp2-ledger.md`). Fix every Critical or Important finding and run a scoped re-review before closing.

- [ ] **Step 3: Owner's usability checklist & final log entry**

Add a structured manual verification checklist to `tasks/PROGRESS-LOG.md` covering Spec 6 (phone Colab 360px + desktop/local web walk from link to downloaded clip, AWAITING_MANUAL return, light/dark modes, offline/disconnected banner) and record final passing numbers in `tasks/sp2-ledger.md`. Do NOT switch branches, push, or open a PR.

```bash
git add tasks/PROGRESS-LOG.md tasks/sp2-ledger.md
git commit -m "docs(sp2): record final verification and owner usability checklist

Co-Authored-By: Antigravity <noreply@anthropic.com>"
```

---

## Spec Coverage Table

| Spec Section | Requirement | Plan Task |
|---|---|---|
| 4.1 | Mobile-first single UI, 3 destinations (`Buat klip`, `Riwayat`, `Pengaturan`), bottom/side nav, connection indicator, routes & legacy redirects | Task 5, Task 13, Task 14 |
| 4.2 | Step 1 Video (paste link + check, pick file/Drive, 3 shapes vertical/square/wide, collapsed `Atur tampilan klip` with remembered choices) | Task 6, Task 7, Task 8 |
| 4.2 | Step 2–3 Guided manual AI (`Salin perintah`, `Buka ChatGPT`/`Gemini`, answer paste + specific validation, Riwayat return via `Tempel jawaban AI`) | Task 11, Task 13 |
| 4.2 & Gap 12 | Automatic AI key mode in `Pengaturan → Lanjutan` (`ac_ai_mode`) skipped on cloud | Task 6, Task 8, Task 14 |
| 4.3 | In-page progress replacing `BusyOverlay`, stage list using `timing.stage_*`, real % / clip X of Y, device note when CPU, per-platform `keepOpen`, queue position, Cancel confirm | Task 5, Task 9, Task 10 |
| 4.4 | Backend `GET /jobs/{id}.current` via `stage_timer` live stack without changing `timings`; `GET /api/preflight` notes & blocking card | Task 1, Task 2, Task 7 |
| 4.5 | Results 1/2/3 cols, signed video player, AI title & duration, `Unduh`, `Bagikan`, `⋯` menu, `Unduh semua` (`saveClips`), collapsed `Detail waktu` | Task 12 |
| 4.5 | Riwayat list (plain status, 1 primary button, `⋯`, failed error card) + single-project view (`/riwayat/:id`) + dialogs | Task 13 |
| 4.5 | Pengaturan in 4 sections (`Umum`, `YouTube`, `Lanjutan` incl. downloader + face engine, `Bantuan` incl. help + updater + logs) | Task 14 |
| 4.6 | Plain-words rules (`plainWords.test.ts`), WCAG AA tokens, 16px body, 44px touch targets, focus/keyboard, contrast script, 5-skill antislop audit | Task 4, Task 15 |
| 4.7 | Canvas background image upload (`POST /upload-image` + `path_guard`), `pickVideo()`, 3 parked SP1 items | Task 3, Task 8, Task 16 |
| 5 | Error handling: `ErrorCard` per-platform actions, inline validation under fields, disconnected banner | Task 5, Task 7, Task 8, Task 11, Task 13 |
| 6 & 7 | Unit/component tests (`pytest`, `Vitest`), contrast & plain-words tests, docs, CHANGELOG v1.19.0, ADR-014, AGENTS.md, whole-branch review, owner usability checklist | Task 1–18 |
