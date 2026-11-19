# SDD ledger — plan: docs/superpowers/plans/2026-11-18-sp1-single-frontend-web-local.md

> Ledger resmi SP1 sejak 2026-11-19 (disalin dari `.superpowers/sdd/.../progress.md`, yang tidak ikut git). AI mana pun yang melanjutkan SP1 memperbarui file INI setelah setiap task, fix round, dan keputusan. Cara kerja: `tasks/HANDOFF-AI.md`.

Spec: docs/superpowers/specs/2026-11-18-sp1-single-frontend-web-local-design.md
Branch: feat/sp1-single-frontend-web-local, start 2afbb42
Owner accepted all 15 plan defaults (2026-11-19). Implementers: fable, effort high (owner preference).

## Pre-flight scan
Table: preflight.md (90 rows; 2 Critical, 2 Important, 16 Minor). Rulings (spec is binding; each carried into the named task's dispatch):

- P1 [T5 S6, Critical] Ruling: in the copied AuthGate body replace `setErrorMsg(null)` with `if (errorKey) setErrorKey(null);` — otherwise tsc fails — cost if wrong: none, build proves it.
- P2 [T13 S8-9, Critical] Ruling: web-package.yml needs only `contents: read`; the release upload moves to a new job in build.yml that downloads the zip artifacts and runs `gh release upload --clobber` — a reusable workflow asking for write under a read caller makes GitHub reject PR Check — cost if wrong: zips not attached to releases (visible, easy fix).
- P3 [T10 S3, Important] Ruling: `web_ui._serve` calls `path_guard.is_protected()` before opening any file and answers 404; add a test — AGENTS.md E.14 — cost if wrong: none.
- P4 [T7/T8, Important] Ruling: read `video_signing.key` once per request (pass the key bytes into `sign`/`with_video_urls`), never cached across requests — Drive I/O per clip on Colab — cost if wrong: deleting the key still invalidates links at the next request.
- P5 [T3 S10, Minor] Ruling: Task 3's manual expectation allows the updater section in local Settings; Task 5 hides it — cost: none.
- P6 [T14 S1/6/9, Minor] Ruling: README "Opsi 3" (`cd web`, README.md:100) is updated in Task 14 and the grep widened to catch it.
- P7 [T11 ui_dir test, Minor] Ruling: normalise both sides (`os.path.normcase(os.path.realpath(...))`).
- P8 [T1 S2, Minor] Ruling: use `npx --no vitest run` wherever the plan expects a missing-binary failure.
- P9 [T5 literal table, Minor] Ruling: name the exact occurrences of "Discord Community"/"Community" and add `auth.*_alt` keys (id + en) for the two alt texts.
- P10 [T5 S8, Minor] Ruling: locate the App.tsx block by its text, not line numbers.
- P11 [dup code, Minor] Ruling: one shared `sourceFiles()` test helper; one shared atomic 0600 write helper in the backend; local and cloud adapters share their identical members through one browser module — cost: slightly different file layout than the plan's File Structure (record it there).
- P12 [T9 useSignedVideo, Minor] Ruling: reset/request only when path or link actually changes; no double POST in StrictMode beyond React's dev double-invoke guard.
- P13 [T2 isBackendRequest, Minor] Ruling: attach the token only when the request origin equals the backend origin (relative URLs resolve to the page origin, which equals the backend origin only in local mode) — avoids leaking the Colab token.
- P14 [T2/T4 S4, Minor] Ruling: add `npx oxlint src` to their check steps.
- P15 [T11 test_free_port, Minor] Ruling: add explicit asserts.
- P16 [T13 smoke script, Minor] Ruling: `TemporaryDirectory(ignore_cleanup_errors=True)`.
- P17 [T3 sidecar.ts, Minor] Ruling: drop the `window.apiToken` write if nothing reads it (grep first).
- P18 [T14 AGENTS.md, Minor] Ruling: add a cross-reference from E.12 to the F.7 / ADR-013 exception.
- P19 [T3 browserNotify, Minor] Ruling: request Notification permission once, on the user's first job start (a user gesture), never on page load — cost if wrong: no browser notifications, toasts still show.
- P20 [T5 AuthGate import, Minor] Ruling: split a side-effect-free `src/platform/cloud/token.ts` and import that from AuthGate.

Task 1: dispatched (BASE 2afbb42)
Task 1: implementer a5033413a47ce1d43
Task 1: implementer DONE_WITH_CONCERNS, commit 5652aec. Env note for every later dispatch: run vitest from `C:\...` (uppercase drive; lowercase `c:` loads vitest twice and fails). Versions resolve newer than web/ (react 19.3.1, vite 8.3.8, oxlint 1.94.0) — accepted. oxlint 29 warnings (new rules) — accepted, warnings allowed.
Task 1: minor (deferred): npm audit reports 7 vulnerabilities (2 moderate, 5 high) after the upgrade — triage at final review.
Task 1: minor (deferred): no `engines.node` in package.json (jsdom 31 needs Node ^22.22.2); CI uses node 22 latest.
Task 1: minor (deferred): CI does not run vitest/oxlint yet (added in Task 13 per plan).
Task 1: complete (commits 2afbb42..5652aec, review clean)
Task 2: dispatched (BASE 5652aec)
Task 2: implementer af9a5cf6130c5c367
Task 2: implementer DONE, commit 69366dc. Carry to Task 3: token attaches only when origin == backend origin (P13), so every backend call must build its URL from API_URL (no hard-coded host/port, localhost vs 127.0.0.1 counts as different).
Task 2: minor (deferred): auth interceptors use config.url only, ignore baseURL (latent; no baseURL/axios.create in src) — auth.ts:188,198.
Task 2: minor (deferred): relative-URL path not tested through wired fetch/axios; opaque "null" origin guard untested.
Task 2: minor (deferred, plan-mandated): localSecrets btoa throws on non-Latin1, localStorage access unguarded — localSecrets.ts:328-330.
Task 2: minor (deferred, plan-mandated): parentDir("/a.mp4") and parentDir("a.mp4") return "" — paths.ts:365-366 (carried to Task 3 openFolder).
Task 2: complete (commits 5652aec..69366dc, review clean)
Task 3: dispatched (BASE 69366dc)
Task 3: implementer ab01af1ebf0f9fde4
Task 3: implementer DONE, commit 3f7bd3b. New Platform member `askNotifyPermission()` (P19) — carry to Task 5: cloud adapter implements it with askBrowserNotifyPermission.
Ruling: useBackendHealth.ts:77 keeps building /health from the sidecar port (desktop-only, same origin the sidecar sets, /health needs no token; switching would change startup timing) — cost if wrong: none for auth.
Ruling: on local the updater button shows the existing "browser" warning toast instead of a silent return (P5 deviation) — harmless until Task 5 hides the section.
Task 3: review Needs fixes — Important (plan-mandated): startup failure text hard-coded in main.tsx:1107-1111, not in locales, no "why".
Ruling: plan-mandated startup text moves to src/locales/{id,en}.json via i18n.t with apa/kenapa/harus apa — global constraint F and the copy rule bind; the plan's literal text was wrong — cost if wrong: none.
Ruling: include review minors 1 (mocked sidecar handshake test: PORT/TOKEN split across chunks, token reaches auth, setApiUrl, timeout reject, respawn) and 2 (image picker: click the file input synchronously when !caps.localFilePicker, call pickImage only on desktop) in fix round 1 — desktop runtime cannot be run here, the handshake is the key risk; the gesture fix is a two-line correctness fix — cost: one slightly larger fix round.
Task 3: minor (deferred): askNotifyPermission not called on rerender/AI rerun/resume starts (useClipJobs.ts:309,354,398).
Task 3: minor (deferred): duplicated updater.browser_dev_warning i18n call (UpdaterSection.tsx:23,37); Task 5 hides the section.
Task 3: fix round 1 dispatched (FIX_BASE 3f7bd3b): startup text to locales; sidecar handshake test; image picker sync click
Task 3: fix round 1 implementer committed caf2406. Scoped re-review of 3f7bd3b..caf2406 Approved (all 3 items clean, vitest 51/51, build OK, oxlint 0 errors).
Task 3: complete (commits 69366dc..caf2406, review clean)
Task 4: dispatched (BASE bc2b2a8)
Task 4: DONE, commit 0909a0e (P14 oxlint 0 errors, vitest 52/52, 138/138 web texts in src/locales)
Task 4: complete (commits bc2b2a8..0909a0e, review clean)
Task 5: dispatched (BASE 0909a0e)
Task 5: DONE, commit 97716b3 (P1/P5/P9/P10/P11/P19/P20 applied, vitest 58/58, build + build:cloud OK, oxlint 0 errors, headless Edge cloud check passed)
Task 5: complete (commits 0909a0e..97716b3, review clean)
Task 6: dispatched (BASE 97716b3)
Task 6: DONE, commit ae835ed (vitest 63/63, build + build:cloud OK, oxlint 0 errors)
Task 6: complete (commits 97716b3..ae835ed, review clean)
Task 7: dispatched (BASE ae835ed)
Task 7: DONE, commit 092c907 (P4 batch key read + test, P11 path_guard.write_private_file, pytest 708 passed / 8 skipped)
Task 7: complete (commits ae835ed..092c907, review clean)
Task 8: dispatched (BASE 092c907)
Task 8: DONE, commit 2ac1b3a (P4 single key read across /history entries + test, pytest 723 passed / 8 skipped)
Task 8: minor (deferred): api_get_history checks clip path existence + load_key try/except before delegating to with_video_urls — main.py:842-849.
Task 8: complete (commits 092c907..2ac1b3a, review clean)
Task 9: dispatched (BASE 2ac1b3a)
Task 9: DONE, commit df54bef (P11 shared sourceFiles, P12 useSignedVideo no double POST under StrictMode + test, vitest 74/74, build + build:cloud OK, oxlint 0 errors, headless Edge playback + key-delete recovery check passed)
Task 9: complete (commits 2ac1b3a..df54bef, review clean)
Task 10: dispatched (BASE df54bef)
Task 10: DONE, commit cd7d065 (P3 path_guard.is_protected in web_ui._serve + test, pytest 747 passed / 8 skipped)
Task 10: complete (commits df54bef..cd7d065, review clean)
Task 11: dispatched (BASE cd7d065)
Task 11: DONE, commit 8fe5570 (P7 normalized ui_dir test, P11 path_guard.write_private_file, P15 explicit port assertions, pytest 763 passed / 9 skipped, manual --web two-instance check passed). Stopped on owner quota instruction before dispatching Task 11 reviewer. NEXT: review cd7d065..8fe5570 (brief: task-11-brief.md, report: task-11-report.md, diff: review-cd7d065..8fe5570.diff), then Task 12, 13, 14.
