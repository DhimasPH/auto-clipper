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
Task 11: DONE, commit 8fe5570 (P7 normalized ui_dir test, P11 path_guard.write_private_file, P15 explicit port assertions, pytest 763 passed / 9 skipped, manual --web two-instance check passed)
Task 11: minor (deferred): read_instance/_status does not reject bool/out-of-range port (InvalidURL in urlopen) — web_mode.py:77,108; unguarded sys.stderr.write on --web error fallback — main.py:1074.
Task 11: complete (commits cd7d065..8fe5570, review clean)
Task 12: dispatched (BASE 9841f30)
Task 12: DONE, commit 7c1838e (P11/P19 browserPlatformParts, folderToOpen preserved, vitest 86/86, build + build:cloud OK, oxlint 0 errors, headless Edge local-web + dev checks passed)
Task 12: minor (deferred): LocalGate.tsx:40 new react(set-state-in-effect) oxlint warning & missing unmount cleanup flag; LocalGate event/retry & online reconnect untested, local.test.ts missing setAuthToken(null) cleanup; unguarded decodeURIComponent in token.ts:19.
Task 12: complete (commits 9841f30..7c1838e, review clean)
Task 13: dispatched (BASE 7c1838e)
Task 13: DONE, commit 0e5da33 (P2 web-package read-only & web-release in build.yml, P16 ignore_cleanup_errors=True, packaging LF verified via git ls-files --eol, pytest 778->780, vitest 86/86, build + build:cloud OK, oxlint 0 errors, PyYAML OK; local PyInstaller smoke skipped: no PyInstaller)
Task 13: review found Important #1 (shutdown race on macOS/Linux + uncaught http.client.HTTPException in smoke_web_package.py); fixed in b207969 (_wait_stopped polling up to 5s, catch HTTPException, +2 tests -> pytest 780/11), re-review clean.
Task 13: minor (deferred): Auto Clipper Web.sh xfce4-terminal -e vs -x & smoke_web_package AUTO_CLIPPER_IN_TERMINAL=1 (Auto Clipper Web.sh:14, smoke_web_package.py:130); uncaught OSError if backend.exe fails to launch in web_launcher.py:46-52; smoke_web_package.main([]) IndexError + CLI main()/launcher_command() coverage (smoke_web_package.py:121, test_web_launcher_script.py:181-218); test_smoke_request_treats_remote_disconnected_as_stopped only tests RemoteDisconnected (OSError subclass) rather than pure HTTPException like BadStatusLine, and _wait_stopped uses default 30s timeout per poll (smoke_web_package.py:54,62-70).
Task 13: complete (commits 7c1838e..b207969, review clean)
Task 14: dispatched (BASE b207969)
Task 14: DONE, commits f45b1d1 & e9d3369 (web/ + check-web-strings.mjs deleted + 3 stale web/src comments cleaned, ADR-013 written, AGENTS.md updated w/ P18, README/tutorial/awam/cloud-plan updated w/ P6 + verified id.json labels, 1.19.0 across 5 version files, CHANGELOG + roadmap + owner manual checklist; pytest 780/11, vitest 86/86, oxlint 0 errors, build + build:cloud OK, zero remaining web/ or 1.18.0 refs)
Task 14: minor (deferred): untouched troubleshooting sections still mention Drive button near URL field — docs/tutorial-auto-clipper-cloud.md:424 & docs/panduan-penggunaan-awam.md:185; menu Riwayat/Manual AI Editor vs page header History/Manual AI Clipper left for SP2 — docs/ & src/pages/; untouched SP2 backlog T2.x mentions `web/` — tasks/roadmap-todo.md:118; condensed Task 14 PROGRESS-LOG bullet — tasks/PROGRESS-LOG.md:603; 30 pre-existing oxlint warnings.
Task 14: complete (commits b207969..e9d3369, review clean)
SP1: COMPLETE (Tasks 1-14 all complete and review-approved on feat/sp1-single-frontend-web-local; owner manual checklist in tasks/PROGRESS-LOG.md)

## Final whole-branch review (2026-11-20, independent, opus; fable unavailable — needs usage credits)
Range 2afbb42..89fce4f. Verdict: Needs fixes — Critical 0, Important 2, Minor 8. No security holes found. Report: `.superpowers/sdd/2026-11-18-sp1-single-frontend-web-local/final-review-report.md` (local).
- I1 local web forgets browser settings/API keys every launch (random port → new origin). Owner decision 2026-11-20: reuse the last port when free, else random; token stays per launch. Spec 4.4 updated.
- I2 macOS first-launch docs ("klik kanan → Open") wrong for macOS 15+: add System Settings → Privacy & Security → "Open Anyway" (id + en).
- M1 xfce4-terminal `-e` arg; M2 uncaught OSError in Windows launcher; M3 bad port in web_instance.json crashes every launch; M4 stale Drive-button wording in two guides; M5 cloud 401 without CORS headers shows "server offline" instead of a token error.
- Ruling: fix I1, I2, M1–M5 in one fix wave — all small, M5 changes what a cloud user sees on a wrong token — cost: one fix wave.
- Ruling: M8 run `npm audit fix` (no --force), keep only if every check stays green — axios/react-router ship in the bundle — cost if wrong: reverted.
- Ruling: M6 `pickVideo()` unused → SP2 (UI rework decides the picker); M7 Linux zip needs glibc ≥ 2.35 → document in BACA-SAYA — cost: none.
- Final: I1 fixed in 698f9a3 (port kept in `web_port.json`, reused while free; BACA-SAYA, AGENTS.md E.14/E.18, ADR-013 C); docs on macOS/Linux in 612f479.
- Final: I2 fixed in 612f479 (BACA-SAYA id + en, README Opsi 6, CHANGELOG, ADR-013 D, spec 4.6, `.command` header, owner checklist). Needs owner check on a real macOS 15+ machine.
- Final: M1 fixed in 71c44ab (`xfce4-terminal -x`).
- Final: M2 fixed in 2fa6935 (OSError → bilingual antivirus message, window stays open).
- Final: M3 fixed in 3683d0a (`valid_port`, bool pid refused, `_status` catches every request error).
- Final: M4 fixed in 5da975b (both guides point to the Local Video (.mp4) tab button).
- Final: M5 fixed in c502f98 (CORSMiddleware registered after `verify_token`; ADR-011 regex unchanged; AGENTS.md A.4 notes the order; AuthGate Vitest pins 401 → token messages, no frontend change needed).
- Final: M6 not fixed — deferred to SP2 per ruling above.
- Final: M7 fixed in 612f479 (BACA-SAYA, README, CHANGELOG).
- Final: M8 fixed in 6313443 (`npm audit fix`, no --force: axios 1.21.1, react-router 7.18.6; `npm audit` 0; all checks green).
Final fix wave re-review (opus, 7cfacb6..247141c): all findings addressed (I1, I2, M1–M5, M7, M8; M6 deferred to SP2 by ruling). No new Critical/Important.
Final: parked — port_is_free() only test-binds 127.0.0.1, so on macOS/Windows a remembered port held by another program on 0.0.0.0 can be reused and shadow its loopback traffic — Ruling: fix before the final PR (also treat the port as taken when connect(("127.0.0.1", port)) succeeds); unlikely in practice — cost if wrong: another local program on that exact port loses loopback traffic while Auto Clipper runs.
Final: parked — docs/tutorial-auto-clipper-cloud.md:437-438 (Kendala 9) `$\rightarrow$` corrupted into two lines (old CR corruption) — Ruling: fix before the final PR (doc-only).
Final: parked — test comment in test_web_mode.py ("the real liveness check") is misleading after M3 — Ruling: fix with the port fix.
SP1: complete (code), review clean after one fix wave. Awaiting owner manual checklist (end of tasks/PROGRESS-LOG.md) and CI runs after push.
Resolved in SP2 Task 16 (2026-11-24, branch feat/sp2-ux-for-everyone): all three parked items above.
- Port: `port_is_free()` first tries `connect(("127.0.0.1", port))` (0.2 s timeout) and treats an answer as taken, then runs the bind test. Reproduced on Windows before the fix: a listener on 0.0.0.0 left `port_is_free` True. Tests: 0.0.0.0 listener, 127.0.0.1 listener, monkeypatched bind-succeeds/connect-answers.
- Tutorial: Kendala 9 arrow repaired, and the other 16 `$\rightarrow$` in `docs/tutorial-auto-clipper-cloud.md` replaced with a plain →.
- Test comment: `test_a_launch_after_a_damaged_instance_file_starts_a_new_server` now says what it pins (damaged file dropped, launch starts a new server instead of crashing).
