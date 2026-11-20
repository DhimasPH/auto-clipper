# SDD ledger — plan: docs/superpowers/plans/2026-11-20-sp2-ux-for-everyone.md

> Ledger resmi SP2. AI mana pun yang melanjutkan SP2 memperbarui file INI setelah setiap task, fix round, dan keputusan. Cara kerja: `tasks/HANDOFF-AI.md`.

Spec: docs/superpowers/specs/2026-11-20-sp2-ux-for-everyone-design.md
Branch: feat/sp2-ux-for-everyone, start dc3ba66
Owner accepted all plan defaults (2026-11-20: "ikuti rekomendasi, yang penting UX-nya jelas untuk orang awam").

## Pre-flight scan
16 rulings (4 Critical, 6 Important, 6 Minor). Rulings carried forward into each task:

- P1 [T11 S4 / T10 S3, Critical] Ruling: add `"PENDING"` to the `status` union type in `src/hooks/useClipJobs.ts` (in Task 10) — Task 11 calls `setStatus("PENDING")` which is missing from the current union — cost if wrong: `tsc` fails in Task 11.
- P2 [T8/T11/T13 `useClipJobs.ts`, Critical] Ruling: pass `aiMode` into `useClipJobs` and send `provider: effectiveProvider(platform().caps, p.aiMode, p.provider)` in `handleResumeJob` (`handleRerunAI` keeps `p.provider`) — `backend/jobs.py` line 1853 overwrites `hist_provider` whenever `fallback_provider` is truthy, which would cause `AI_KEY_MISSING` for manual-AI and cloud users on Retry/Resume — cost if wrong: Retry/Resume fails on cloud and manual-AI desktop.
- P3 [T5 S5-6 `AppLayout.tsx`, Critical] Ruling: use `lg:invisible` (not `md:invisible lg:visible`) on the header `"Auto Clipper"` span — `SideNav` displays the brand at `lg:block`, so `md:invisible lg:visible` hides it on `md` tablets and duplicates it on `lg` desktops — cost if wrong: two visual defects.
- P4 [T4 S2 `Toasts.tsx`, Critical] Ruling: restyle `src/components/Toasts.tsx` with AA semantic tokens (`bg-bg-secondary border-border-active text-text-primary shadow-toast`, `role="status"`/`role="alert"`, clean semantic mark) instead of undefined `--toast-*-bg` CSS variables — white text on transparent background fails WCAG contrast in light mode — cost if wrong: illegible toasts in light mode.
- P5 [T2 S1 `test_job_current.py`, Important] Ruling: patch `jobs._start_job` (or call `jobs.job_queue.cancel(job_id)` in `finally:`) in `test_manual_resume_shows_finished_stages_while_it_runs` instead of only stubbing `threading.Thread.start` — leaves `job_id` stuck in `jobs.job_queue._waiting` across tests — cost if wrong: later queue/job tests see a phantom waiting job.
- P6 [T8 S6-7 `App.tsx`, Important] Ruling: in `src/App.tsx`, `requestLocalUpload` sets only `setPendingLocalUpload(true)` without `setInputType("local")`, and `GDriveBrowserModal` `onSelectFile` also clears `setLocalFile(null)` — cost if wrong: stale `inputType` or leftover file overrides selection.
- P7 [T3 S5 `CanvasConfigControls.test.tsx`, Important] Ruling: spy with `vi.spyOn(URL, "createObjectURL").mockReturnValue(...)` and restore via `afterEach` instead of mutating global `URL` with `Object.assign` — cost if wrong: polluted global `URL` in later Vitest tests.
- P8 [T10 S3-5 / T12 S5 `useClipJobs.ts`, Important] Ruling: remove hardcoded `⚠️ ` prefixes on `useClipJobs.ts` lines 83 & 123, replace `t('smartEditor.submitted', ...)` with `t('toast.starting_bg')`, update `t('toast.clip_failed', ...)` at line 267, and include `resultJobId` in the polling `useEffect` dependency array in Task 12 — cost if wrong: stale closure and plain-words leakage.
- P9 [T11 S4 `useClipJobs.ts`, Important] Ruling: in `AWAITING_MANUAL`, always call `notify(t("toast.manual_prompt_ready"), "success")`, and set `awaiting` when `jobOrigin === "workspace"` OR the current hash is `#/` or empty — cost if wrong: watching a history job on CreatePage stalls without transitioning to step 3.
- P10 [T12 S4 `ClipsResult.tsx`, Important] Ruling: render an inline `role="alert"` error (`result.download_failed`) if `saveAll()` rejects, and use `key={clip.path || i}` — cost if wrong: silent bulk-download failures.
- P11 [T15, Important] Ruling: audit and fix legacy gates/modals/controls (`AuthGate`, `LocalGate`, `GDriveBrowserModal`, `SocialKitModal`, `ClipEditModal`, `CookiesModal`, `CookiesPanel`, `SplashScreen`, `UpdateOverlay`, `CanvasConfigControls`, `SubtitleConfigControls`, `ProviderSection`, `TranscriptionSection`) for `bg-white`/`bg-bg-card`/`text-accent-fg`/white-on-accent contrast bugs, keyboard access, `aria-label`s, `alert()`/`confirm()`, and 360px overflow — cost if wrong: Contrast and a11y gaps remain outside new screens.
- P12 [T4 S4 `Select.tsx`, Minor] Ruling: replace `Math.random()` id in `Select.tsx` with `useId()` and update SVG chevron color `%237c8097` to `%237A7D84` — cost if wrong: low chevron contrast and unstable DOM ids.
- P13 [T4 S6, Minor] Ruling: run `contrast-check.py` from `C:\Users\dhima\.gemini\config\plugins\anti-slop\skills\antislop-human\contrast-check.py` (`.claude/plugins` path in the original snippet does not exist here) — cost if wrong: none.
- P14 [T6 S3 `clipChoices.ts`, Minor] Ruling: in `saveClipChoices`, always clear `background_image_path: ""` when persisting `canvasConfig` (and reset `background_type` to `"blur"` when `"image"`) — cost if wrong: stale path kept in localStorage.
- P15 [T7 S1 `usePreflight.test.tsx`, Minor] Ruling: stub/restore `console.error` in error-path unit tests (`usePreflight.test.tsx`, etc.) — cost if wrong: noisy stderr in clean test runs.
- P16 [Global / T10 / T12, Minor] Ruling: use `Co-Authored-By: Antigravity <noreply@anthropic.com>` on commits; render `<ProgressPanel>` above `<ClipsResult>` in `CreatePage.tsx` (using `liveMeta` tracking fallback cleanly); use `flex flex-wrap gap-2` + `variant="outline"` on `ClipCard` action buttons — cost if wrong: minor layout/credit mismatches.

## Tasks
- Task 1: complete (commits 0f315db..684a272, review clean) — pytest 815 passed, 12 skipped (+10). Deferred minors: direct assertions for negative-percent clamp / `clips_total <= 0` / `tracking_engine_used`, and `dict | None` annotation alignment.
- Task 2: complete (commits 00c7c20..6acf284, review clean) — pytest 829 passed, 12 skipped (+14, P5 applied). Deferred minors: `download_percent`/`live_stage` return type hints (`float | None`, `dict | None`), sibling loop runtime assertions, and mid-run HTTP check on manual resume.
