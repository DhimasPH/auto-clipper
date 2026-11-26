# SP1 Single Frontend and Local Web Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One frontend (`src/`) that runs as the Tauri desktop app, as a local web app served by the backend (`--web`), and as the Vercel cloud app for Colab, with `/video` protected by signed links on all three, and `web/` deleted.

**Architecture:** A platform layer (`src/platform/`) hides everything that differs per platform behind one `Platform` object chosen at startup (`desktop` inside Tauri, `cloud` for a `VITE_TARGET=cloud` build, `local` otherwise); components ask `platform().caps`, never `@tauri-apps/*`. The backend gains a local web mode (serves the built UI on `127.0.0.1`, random port, per-launch token, one instance per computer) and HMAC-signed `/video` links with a persistent key in app data. CI builds a zip per OS (Windows, macOS arm64, macOS x64, Linux) from the same PyInstaller backend, `ffmpeg-static@5` and the built UI.

**Tech Stack:** React 19, Vite 8, TypeScript 6, `@vitejs/plugin-react` 6, Tailwind 3, i18next, Vitest 5 + jsdom, oxlint, Tauri 2; Python 3.11, FastAPI, uvicorn, pytest, PyInstaller; GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-11-18-sp1-single-frontend-web-local-design.md` (approved). Extra owner decision 2026-11-18: build the local web package for macOS arm64 **and** x64, plus Windows and Linux (closes spec section 9).

## Global Constraints

- Branch: `feat/sp1-single-frontend-web-local`. Do not switch branches. Do not push (pushing is the owner's call).
- Every commit message ends with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Python: never use `python` from PATH (Microsoft Store stub). Test command (PowerShell): `C:\Users\dhima\projects\ac-venv\Scripts\python.exe -m pytest backend/tests -q -p no:cacheprovider`. Git Bash form: `/c/Users/dhima/projects/ac-venv/Scripts/python.exe -m pytest backend/tests -q -p no:cacheprovider`. Baseline on this branch: **694 passed, 7 skipped**. Every task must end with all tests passing (baseline + the task's new tests).
- Frontend checks (repo root): `npm run build` (desktop build, `tsc && vite build`), from Task 1 on also `npx vitest run` and `npx oxlint src` (warnings allowed, errors not), from Task 5 on also `npm run build:cloud`.
- FFmpeg for local experiments: `C:\Users\dhima\projects\auto-clipper\node_modules\ffmpeg-static\ffmpeg.exe`.
- No Rust toolchain on this machine: `npm run tauri dev/build` cannot run here. Desktop (Tauri) builds are verified by `.github/workflows/pr-check.yml` (the owner triggers it, Task 1 adds `workflow_dispatch`) and by the owner's manual checklist (Task 14).
- `.agents/AGENTS.md` rules apply: no `print()` to stdout in backend modules except CLI entry points (`backend/main.py` `__main__`, `backend/web_mode.launch` writing to the stream it is given, `scripts/*.py`); errors via `log_error(context, err)`; path_guard before any file access by a request path (E.14); no secrets in logs, responses or `history.db` (E.15); nothing under an unmounted `/content/drive` (E.16); ADR for architecture changes (section H); all UI text in `src/locales/{id,en}.json` (section F).
- New user-facing text: Indonesian **and** English, plain words, "apa, kenapa, harus apa" (what happened, why, what to do). Every new key goes into both `src/locales/id.json` and `src/locales/en.json` (Task 4 adds a parity test that fails otherwise).
- Components check `platform().caps`, not `platform().kind`. The only allowed `kind` checks are the gate choice in `App.tsx` (AuthGate / LocalGate) and the landing page choice.
- `@tauri-apps/*` may be imported only under `src/platform/desktop/`; `__TAURI_INTERNALS__` may appear only under `src/platform/` (Task 3 adds a test that scans `src/`).
- Signed video links: `sig = HMAC_SHA256(key, canonical_path)`, no expiry, 32-byte key in `video_signing.key` in app data, key file protected by path_guard, `/video` refuses a missing or wrong `sig` on every platform. Links are added when clip data is read, never stored in `history.db`.
- Local web mode: bind `127.0.0.1` only, random free port, per-launch token, token required for everything except `/`, `/assets/*`, `/health` (and the UI's root image files, and `/video` which uses `sig`).
- Version for this work: **1.19.0** (Task 14).
- After each task, append a short entry (3-6 lines: what changed, test counts, anything left) under a `## 2026-11-18 · SP1` heading at the end of `tasks/PROGRESS-LOG.md` (create the heading once) and include it in that task's commit. This keeps the work resumable if a session stops.

## Questions for the owner (defaults chosen, easy to change)

1. **Vercel project timing.** Root Directory is a project-wide Vercel setting, not per branch. Changing it from `web` to the repo root now makes the next production deploy from `main` (which still has `web/`) build the wrong app. **Default:** leave the production project as it is until the final PR is merged; for testing SP1, create a second Vercel project from the same repo (e.g. `auto-clipper-sp1`), Root Directory empty, Node 22.x, env `VITE_API_URL`; build settings come from `vercel.json` (Task 5). At merge time, change the production project's Root Directory to empty. Task 14 documents both.
2. **"Pengaturan alamat backend" for cloud.** `web/` has no UI for the backend address: it reads `VITE_API_URL` at build time, else `localStorage` `AUTO_CLIPPER_API_URL` / `ac_api_url`, else `http://localhost:8000`. **Default:** keep exactly that lookup (no new input field). Adding a field to AuthGate is a small follow-up if wanted.
3. **Desktop `pickVideo()`.** Spec 4.1 says desktop uses `plugin-dialog`, but today the desktop app picks a video with a browser `<input type=file>` and `POST /upload` (copy into app data). **Default:** keep today's behaviour (spec goal "desktop unchanged"); `pickVideo()` exists on every platform and returns `{kind: "file"}` on desktop and local. Switching desktop to an OS path without copying is an SP2/SP3 decision.
4. **Onefile vs onedir in the web package.** Spec 4.6 says "the same PyInstaller backend as desktop (onedir)", but `backend.spec` builds onedir only on macOS; Windows (and Linux, not built today) are onefile. **Default:** reuse what the spec file builds (onefile on Windows/Linux, onedir on macOS). Onefile unpacks itself at every start (slower first window). Switching Windows/Linux to onedir later is a `backend.spec` change only.
5. **Cloud start page.** Cloud has no API-key providers (`caps.apiKeys = false`), so the "AI Clipper" page (`/`, needs a key) is useless there. **Default:** in cloud the index route redirects to `/manual-ai` and the sidebar hides "AI Clipper".
6. **Output folder and canvas background image in local/cloud.** There is no OS dialog in a browser. **Default:** hide the "Pilih Folder" row in Settings when `!caps.localFilePicker` (output goes to the default folder); keep the canvas image fallback as it is today (browser file input with an object URL, which the backend cannot read: an existing bug, recorded for SP2, not fixed in SP1).
7. **Instance file content.** Spec 4.4 writes `{port, pid}`, but reopening a running instance must open `#t=<token>` (spec section 5 says the launcher opens a tab "with the token"). **Default:** `web_instance.json` holds `{port, pid, token}`, file mode 0600 on POSIX, and its name is added to path_guard's protected names.
8. **`/heartbeat` in web mode.** It is token-free today on desktop and cloud. **Default:** token required in web mode (spec 4.4 lists only `/`, `/assets/*`, `/health` as open); unchanged elsewhere.
9. **macOS Intel runner label.** The plan uses `macos-15-intel` (GitHub's Intel image after `macos-13` was retired). If the owner's account shows a different Intel label, change one line in `.github/workflows/web-package.yml`.
10. **Version and changelog.** **Default:** bump to 1.19.0 in Task 14 with a `## [1.19.0] - belum dirilis` section; the owner sets the date (or folds SP2 into it) at the final PR.
11. **macOS quarantine flag.** Files from a downloaded zip are quarantined; after the user opens `Auto Clipper Web.command` with right-click → Open, macOS can still block the unsigned backend and FFmpeg inside it. **Default:** the `.command` removes the quarantine flag from its own folder (`xattr -dr com.apple.quarantine "$DIR"`) before starting the backend (Task 13). Alternative: explain `xattr -cr` in `BACA-SAYA.txt` and leave it to the user.
12. **Shared data folder.** The web package uses the same app data folder as the desktop app (`%APPDATA%\AutoClipper`, `~/Library/Application Support/AutoClipper`, `~/.local/share/AutoClipper`): one history, one `cookies.txt`, one `video_signing.key`. **Default:** shared, so a user who moves between desktop and web keeps the history. Running both at once works, but each process has its own job queue, so two heavy jobs can run at the same time (note for SP3).
13. **Linux launcher without a terminal.** A `.sh` started from a file manager often gets no window, so the user cannot see or close the server. **Default:** the script reopens itself in the first terminal it finds (`x-terminal-emulator`, `gnome-terminal`, `konsole`, `xfce4-terminal`, `xterm`); without one it runs without a window and the browser still opens.
14. **CI cost.** PR Check also builds the four web packages and runs Vitest, oxlint, the cloud build and pytest on every PR (spec 6). That is roughly 20-30 runner minutes per OS in parallel; macOS minutes count ten times on private repositories. **Default:** run on every PR as the spec says; making `web-package` manual-only is a one-job change in `pr-check.yml`.
15. **Where the zips go.** **Default:** attached to the `app-v<version>` release that tauri-action creates in `build.yml`, by a job that runs after the desktop build (`gh release upload --clobber`). `web-package.yml` can also be run by hand (`workflow_dispatch`); then the zips are workflow artifacts only.

## Spec gaps and contradictions found in the code

1. **Interface members missing from spec 4.1.** Moving all Tauri calls needs more than the listed members: external links (`LandingPage`, `Sidebar` use `plugin-shell open`), folder picker (`OutputSection`), image picker (`CanvasConfigControls`), updater (`UpdaterSection`, `useStartupUpdateCheck`), prevent-sleep (`useClipJobs`), and sidecar respawn (`useBackendHealth` → `resetAndRespawnBackend`). The plan adds `reconnect()`, `openExternal()`, `pickFolder()`, `pickImage()`, `setPreventSleep()` and `updater` (null off desktop). The spec members are kept exactly.
2. **Spec 7 says 9 files import `@tauri-apps/*`; the code has 10**: `LandingPage`, `useStartupUpdateCheck`, `useToasts`, `ClipCard`, `OutputSection`, `UpdaterSection`, `CanvasConfigControls`, `Sidebar`, `useUserSettings`, `useClipJobs` (13 import lines), plus `__TAURI_INTERNALS__` checks in 6 files. All move.
3. **Root files of the UI.** `index.html` links `/logo.svg`; `LandingPage`/`AuthGate` use `/character.png` and `/logo.png`. Serving only `/` and `/assets/*` breaks them. The plan also serves image files that sit directly in the UI folder (`.svg .png .ico .jpg .jpeg .webp` only, so no API route can be shadowed), without token.
4. **`/video-url` would inherit the `/video` exemption.** The middleware exempts `path.startswith("/video")`; that also matches `/video-url`. The plan changes it to `path == "/video"`.
5. **Clip URLs are built by the frontends today** (`src/App.tsx:167`, `src/pages/HistoryPage.tsx:175`, `web/src/api.ts:231`); the backend never returns URLs. The plan adds `video_url` (relative, signed) to every clip in `GET /jobs/{id}` (`clips`) and `GET /history` (`result_clips`) at read time, and `POST /video-url` for any other path. Both frontends' URL builders go away.
6. **Key under an unmounted Drive (E.16).** `get_app_data_dir()` raises `DRIVE_NOT_MOUNTED` on Colab before Drive is mounted, which would break `GET /history`. The key therefore follows the logger rule: `drive_mount.local_dir()` while the library is unavailable. Links signed with that temporary key fail after mounting; the frontend's "ask for a new link once" covers it.
7. **web/ strings.** `web/src/lib/strings.ts` has 74 keys per language: 67 already exist with identical text in `src/locales`, `cookies.privacy` differs (the web text names Google Drive), and 6 are missing. Of the missing ones only `action.pick_from_drive` is used by code that moves; `error.start_over`, `nav.settings`, `settings.subtitle`, `settings.language_title`, `settings.language_note` belong to web pages that spec 4.2 does not move. The Drive wording of `cookies.privacy` becomes `cookies.privacy_cloud`.
8. **Cloud UI changes shape.** Cloud users get the desktop pages (Manual AI Editor → Riwayat → "Lanjut Manual") instead of the web wizard. `docs/panduan-penggunaan-awam.md` Langkah 3 must be rewritten (Task 14). The desktop layout has a fixed 240 px sidebar, awkward on a phone: recorded as an SP2 finding (spec section 8 accepts this).
9. **No Linux build exists today** (desktop CI builds Windows and macOS arm64 only). The Linux web package is the first Linux PyInstaller build; failures there are expected to need small fixes.
10. **Backlog item not in this spec.** `tasks/roadmap-todo.md` lists free paths in `canvas_config.background_image_path` and `output_dir` next to the `/video` finding. Spec SP1 does not cover them; they stay in the backlog.
11. **`web/` bug that disappears.** `web/src/api.ts` calls `/jobs/{id}/rerun-ai`, the backend route is `/rerun_ai`. Moot once `web/` is deleted; the SP4 note in the roadmap stays.
12. **The spec does not say which data folder the web package uses.** See question 12 (default: the desktop app's folder).
13. **"Ask once for a new link" covers the player only.** A browser download is an `<a download>` click, and the page cannot see a 403 there. The download uses the link the player last loaded or refreshed, so it is refused only if the key was deleted after the clip was shown. Accepted; playing the clip first refreshes the link.
14. **Closed launcher window is noticed late.** `useBackendHealth` polls `/health` every 3 s but calls `platform().reconnect()` only on focus, visibility change or the Reconnect button, so the "Jendela Auto Clipper sudah ditutup" card appears when the user comes back to the tab, not at once. Accepted.
15. **pytest has never run on Linux.** The new `checks` job in PR Check is the first Linux run of `backend/tests` (and the Linux package the first Linux PyInstaller build, gap 9). Failures that only happen there are fixed in Task 13, or skipped with a reason, and recorded in the progress log.
16. **UI catch-all route.** The `GET /{name}` route that serves the UI's root image files (gap 3) turns a GET on a POST-only one-segment path (e.g. `GET /jobs`) from 405 into 404. No client relies on the 405.
17. **Frontend-made error texts vs AGENTS.md E.12.** E.12 says the frontend never writes error text itself, but the backend cannot send `error_info` when it cannot be reached or when it refused a video link. `src/lib/localErrors.ts` builds `ErrorInfo` from `src/locales` for exactly these cases (Tasks 9 and 12); ADR-013 and AGENTS.md F.7 record the exception.

## File Structure

Created:

| File | Responsibility |
|---|---|
| `.oxlintrc.json` | oxlint rules (copied from `web/`) |
| `.env.cloud` | `VITE_TARGET=cloud` for `vite build --mode cloud` |
| `vercel.json` | Vercel install/build/output settings for the cloud build |
| `.gitattributes` | LF endings for `.sh` / `.command` launchers |
| `src/platform/types.ts` | `Platform`, `PlatformKind`, `Caps`, `BackendInfo`, `VideoSource`, `ClipRef`, `UpdaterApi`, `UpdateHandle` |
| `src/platform/caps.ts` | `CAPS` table per platform |
| `src/platform/select.ts` | `detectPlatformKind()` |
| `src/platform/index.ts` | `loadPlatform()`, `platform()`, `setPlatform()` |
| `src/platform/backendUrl.ts` | live `API_URL` + `setApiUrl()` (moved out of `App.tsx`) |
| `src/platform/auth.ts` | token holder, axios/fetch Authorization wiring, 401 event |
| `src/platform/paths.ts` | `parentDir()`, `fileName()` |
| `src/platform/browser.ts` | browser helpers shared by local and cloud (file pick, download, notification, health check) |
| `src/platform/localSecrets.ts` | `localStorage` secrets in the existing `ac_api_keys` format |
| `src/platform/desktop/index.ts` | desktop adapter (only place with `@tauri-apps/*`) |
| `src/platform/desktop/sidecar.ts` | sidecar spawn, PORT/TOKEN handshake, heartbeat, respawn (moved from `useUserSettings.ts`) |
| `src/platform/desktop/secrets.ts` | Stronghold secrets with `localStorage` backup (moved) |
| `src/platform/local/index.ts` | local web adapter |
| `src/platform/local/token.ts` | `#t=` token → `sessionStorage`, gate decision |
| `src/platform/cloud/index.ts` | cloud adapter (Vercel + Colab) |
| `src/platform/*.test.ts`, `src/platform/**/**.test.ts` | Vitest tests |
| `src/lib/errorActions.ts` (+ test) | error-card actions per platform |
| `src/lib/videoUrl.ts` (+ test) | absolute URL from a signed `video_url` |
| `src/hooks/useSignedVideo.ts` | the signed link of one clip; asks `POST /video-url` once when the player is refused |
| `src/lib/localErrors.ts` | `ErrorInfo` for frontend-only failures (backend unreachable, video link refused) |
| `src/lib/errorInfo.test.ts` | first Vitest test (existing logic) |
| `src/locales/locales.test.ts` | id/en key parity |
| `src/components/AuthGate.tsx` | cloud token gate (moved from `web/`) |
| `src/components/GDriveBrowserModal.tsx` | Drive browser (moved from `web/`) |
| `src/components/LocalGate.tsx` | local web gate (token missing/expired, server closed) |
| `backend/video_sign.py` | signing key, `sign`, `verify`, `signed_url`, `with_video_urls` |
| `backend/web_ui.py` | serving the built UI in web mode, public-path rules |
| `backend/web_mode.py` | local web launcher: instance file, browser, console text, `launch()` |
| `backend/tests/test_video_sign.py`, `test_video_links.py`, `test_web_ui.py`, `test_web_mode.py`, `test_web_launcher_script.py` | pytest |
| `scripts/add-locale-keys.mjs` | adds keys to both locale files, refuses a key that exists with another text |
| `scripts/check-web-strings.mjs` | one-off proof that `web/` strings are in `src/locales` (deleted with `web/`) |
| `scripts/web_launcher.py` | source of `Auto Clipper Web.exe` (Windows) |
| `scripts/assemble_web_package.py` | package layout per OS (used by `web-package.yml`) |
| `scripts/smoke_web_package.py` | CI smoke test of an assembled package |
| `packaging/web/Auto Clipper Web.command`, `packaging/web/Auto Clipper Web.sh`, `packaging/web/BACA-SAYA.txt` | launchers and readme inside the zips |
| `.github/workflows/web-package.yml` | reusable workflow building the four zips |
| `docs/decisions/013-single-frontend-local-web-signed-video-links.md` | ADR |

Modified: `package.json`, `package-lock.json`, `tsconfig.json`, `vite.config.ts`, `src/env.d.ts`, `src/main.tsx`, `src/App.tsx`, `src/api.ts`, `src/hooks/{useUserSettings,useBackendHealth,useClipJobs,useStartupUpdateCheck,useToasts,useErrorActions}.ts`, `src/components/{ClipCard,ClipsResult,ErrorCard,GenerateForm,CookiesPanel}.tsx`, `src/components/settings/{OutputSection,UpdaterSection}.tsx`, `src/components/ui/CanvasConfigControls.tsx`, `src/components/sidebar/Sidebar.tsx`, `src/pages/{LandingPage,HistoryPage,SettingsPage,ManualAIEditorPage,WorkspacePage}.tsx`, `src/locales/{id,en}.json`, `backend/main.py`, `backend/path_guard.py`, `backend/tests/{test_main,test_workspace,test_protected_paths}.py`, `.github/workflows/{build,pr-check}.yml`, `.gitignore`, `.agents/AGENTS.md`, `README.md`, docs, version files.

Deleted: `web/` (Task 14), `scripts/check-web-strings.mjs` (Task 14).

## Task order

| # | Task | Spec 7 step |
|---|---|---|
| 1 | Toolchain: React 19, Vite 8, TS 6, plugin-react 6, oxlint, Vitest | 1 |
| 2 | Platform core (types, caps, selection, backend URL, auth wiring) | 2 |
| 3 | Desktop adapter, baseline local adapter, all Tauri usage moved | 2 |
| 4 | Single i18n (web strings into `src/locales`) | 3 |
| 5 | Cloud adapter, AuthGate, Drive browser, cloud build, Vercel config | 3 |
| 6 | Error-card actions per platform | 3 |
| 7 | Backend: video signing key and signatures | 4 |
| 8 | Backend: `/video` requires `sig`, `POST /video-url`, signed links in clip data | 4 |
| 9 | Frontend: signed video links, ask once for a new link | 4 |
| 10 | Backend: web mode serves the UI, token rules | 4 |
| 11 | Backend: `--web` launcher (one instance, browser, console text) | 4/5 |
| 12 | Frontend: local adapter token and LocalGate | 5 |
| 13 | Packaging: launchers, smoke test, CI zips for 4 targets, CI checks | 5 |
| 14 | Delete `web/`, docs, ADR-013, AGENTS.md, 1.19.0, roadmap | 6 |

---

### Task 1: Toolchain upgrade of `src/`

**Files:**
- Modify: `package.json` (scripts, devDependencies), `package-lock.json` (by npm)
- Modify: `tsconfig.json`, `vite.config.ts`
- Create: `.oxlintrc.json`, `src/lib/errorInfo.test.ts`
- Modify: `.github/workflows/pr-check.yml` (add `workflow_dispatch`)

**Interfaces:**
- Consumes: nothing.
- Produces: `npm test` (= `vitest run`), `npm run lint` (= `oxlint src`), Vitest with jsdom picking up `src/**/*.test.{ts,tsx}`; `tsc` with `types: ["vite/client", "node"]`. Later tasks add test files next to the code.

Versions are the ones `web/package.json` already builds with (installed there: react 19.2.8, vite 8.2.1, @vitejs/plugin-react 6.0.5, typescript 6.0.3, oxlint 1.78.0). Vitest 5.1.1 is the current release and accepts Vite 8 (peer `^6.4.0 || ^7.0.0 || ^8.0.0`); jsdom 31 needs Node `^22.22.2` (this machine: 22.22.3; CI uses Node 22).

- [ ] **Step 1: Write the first Vitest test (it cannot run yet)**

Create `src/lib/errorInfo.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { asErrorInfo, localizedText, visibleActions } from "./errorInfo";

const RAW = {
  code: "YT_BOT_CHECK",
  title: "YouTube meminta verifikasi",
  message: "Unggah cookies.txt lalu coba lagi.",
  title_en: "YouTube asked for verification",
  message_en: "Upload cookies.txt and try again.",
  actions: [
    { id: "upload_cookies", label: "Unggah cookies.txt", label_en: "Upload cookies.txt" },
    { id: "open_settings", label: "Buka Pengaturan", label_en: "Open Settings" },
  ],
  technical: "Sign in to confirm you're not a bot",
};

describe("errorInfo", () => {
  it("reads a backend error_info", () => {
    const info = asErrorInfo(RAW);
    expect(info?.code).toBe("YT_BOT_CHECK");
    expect(info?.actions.map((a) => a.id)).toEqual(["upload_cookies", "open_settings"]);
  });

  it("returns null for something that is not an error_info", () => {
    expect(asErrorInfo(null)).toBeNull();
    expect(asErrorInfo({ code: "X" })).toBeNull();
  });

  it("shows the English text in English and falls back to Indonesian", () => {
    const info = asErrorInfo(RAW)!;
    expect(localizedText(info, "en").title).toBe("YouTube asked for verification");
    expect(localizedText({ ...info, title_en: "" }, "en").title).toBe("YouTube meminta verifikasi");
  });

  it("draws a button only for actions this app can carry out, with an optional label override", () => {
    const info = asErrorInfo(RAW)!;
    const actions = visibleActions(info, { upload_cookies: () => {} }, "id", { upload_cookies: "Pilih file" });
    expect(actions.map((a) => [a.id, a.label])).toEqual([["upload_cookies", "Pilih file"]]);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run`
Expected: fails to start (`vitest` is not installed: "could not determine executable to run" or npx asks to install). Answer "no" if npx prompts.

- [ ] **Step 3: Upgrade the packages**

Run (one line):

```bash
npm install --save-dev react@^19.2.8 react-dom@^19.2.8 @types/react@^19.2.17 @types/react-dom@^19.2.3 @types/node@^24.13.3 @vitejs/plugin-react@^6.0.4 typescript@~6.0.2 vite@^8.2.0 oxlint@^1.75.0 vitest@^5.1.1 jsdom@^31.0.1
```

Then edit the `scripts` block of `package.json` to exactly:

```json
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "tauri": "tauri",
    "test": "vitest run",
    "lint": "oxlint src"
  },
```

Check: `node -p "require('./node_modules/react/package.json').version"` prints `19.2.x`; same for `vite` → `8.x`, `typescript` → `6.0.x`. The other dependencies (`i18next ^26`, `react-i18next ^17` (peer `react >= 16.8`), `lucide-react ^1.24` (peer includes `^19`), `react-router-dom ^7.18` (peer `>=18`), all `@tauri-apps/*`) stay as they are.

- [ ] **Step 4: Replace `tsconfig.json`**

TypeScript 6 no longer loads every `@types/*` package by default (`types` defaults to `[]`), and `SplashScreen.tsx` uses `NodeJS.Timeout`, so `node` must be listed. Do not turn on `verbatimModuleSyntax` / `erasableSyntaxOnly` (the desktop code imports types without `import type`).

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "useDefineForClassFields": true,
    "lib": ["ES2023", "DOM"],
    "module": "ESNext",
    "types": ["vite/client", "node"],
    "skipLibCheck": true,

    /* Bundler mode */
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",

    /* Linting */
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}
```

- [ ] **Step 5: Replace `vite.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Relative asset URLs: the same build is loaded by Tauri, by the backend at "/" and by Vercel.
  base: "./",
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
```

- [ ] **Step 6: Add `.oxlintrc.json` (same rules as `web/`)**

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

- [ ] **Step 7: Let the owner run the desktop CI on this branch**

In `.github/workflows/pr-check.yml` change the `on:` block to:

```yaml
on:
  pull_request:
    branches: [main]
  workflow_dispatch:
```

- [ ] **Step 8: Run the checks**

Run: `npx vitest run`
Expected: `src/lib/errorInfo.test.ts` 4 passed.

Run: `npm run build`
Expected: exit 0. A scan of the current code found none of the React 19 breaking patterns (`JSX.` global namespace, `useRef<T>()` without argument, `defaultProps`, `ReactDOM.render`, `RefObject` props). If `tsc` still reports errors, fix each one minimally in place (typical: add `null` to a `useRef` type, replace a global `JSX.Element` with `React.JSX.Element`) and list the files in the commit message. Do not change behaviour.

Run: `npx oxlint src`
Expected: exit 0 with about 14 warnings (unused catch parameters, `exhaustive-deps`, `only-export-components` in `App.tsx`), 0 errors. Leave the warnings.

Run: `C:\Users\dhima\projects\ac-venv\Scripts\python.exe -m pytest backend/tests -q -p no:cacheprovider`
Expected: 694 passed, 7 skipped (backend untouched; sanity check).

Check that the Tauri config is unchanged: `git diff --stat src-tauri` prints nothing.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts .oxlintrc.json src/lib/errorInfo.test.ts .github/workflows/pr-check.yml tasks/PROGRESS-LOG.md
git commit -m "$(cat <<'EOF'
build(sp1): React 19, Vite 8, TypeScript 6, oxlint and Vitest for src/

Same toolchain as web/ so the two frontends can become one. Adds the first
Vitest test (errorInfo) and workflow_dispatch on PR Check so the desktop
build can be run on this branch.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Platform core

**Files:**
- Create: `src/platform/types.ts`, `src/platform/caps.ts`, `src/platform/select.ts`, `src/platform/backendUrl.ts`, `src/platform/auth.ts`, `src/platform/paths.ts`, `src/platform/localSecrets.ts`
- Test: `src/platform/select.test.ts`, `src/platform/caps.test.ts`, `src/platform/auth.test.ts`, `src/platform/paths.test.ts`, `src/platform/localSecrets.test.ts`
- Modify: `src/env.d.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces (exact names used by later tasks):
  - `types.ts`: `PlatformKind = "desktop" | "local" | "cloud"`; `Caps { apiKeys; localFilePicker; driveBrowser; openFolder; updater; preventSleep }` (all `boolean`); `BackendInfo { url: string; token: string }`; `VideoSource`; `ClipRef { path: string; videoUrl?: string; filename: string }`; `UpdateHandle`; `UpdaterApi`; `Platform`.
  - `caps.ts`: `CAPS: Record<PlatformKind, Caps>`.
  - `select.ts`: `detectPlatformKind(env: { hasTauri: boolean; target?: string }): PlatformKind`.
  - `backendUrl.ts`: `let API_URL: string` (live binding), `setApiUrl(url: string): void`.
  - `auth.ts`: `setAuthToken(t: string | null)`, `getAuthToken(): string | null`, `isBackendRequest(url: string, apiUrl: string): boolean`, `wireAuthOnce(): void`, `UNAUTHORIZED_EVENT = "ac_unauthorized"`.
  - `paths.ts`: `parentDir(p: string): string`, `fileName(p: string, fallback?: string): string`.
  - `localSecrets.ts`: `localSecretKey(name)`, `readLocalSecret(name): string | null`, `writeLocalSecret(name, value): void`, `localStorageSecrets: Platform["secrets"]`.

- [ ] **Step 1: Write the failing tests**

`src/platform/select.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { detectPlatformKind } from "./select";

describe("detectPlatformKind", () => {
  it("is desktop inside Tauri, whatever the build target", () => {
    expect(detectPlatformKind({ hasTauri: true })).toBe("desktop");
    expect(detectPlatformKind({ hasTauri: true, target: "cloud" })).toBe("desktop");
  });

  it("is cloud for a VITE_TARGET=cloud build in a browser", () => {
    expect(detectPlatformKind({ hasTauri: false, target: "cloud" })).toBe("cloud");
  });

  it("is local for any other browser build", () => {
    expect(detectPlatformKind({ hasTauri: false })).toBe("local");
    expect(detectPlatformKind({ hasTauri: false, target: "" })).toBe("local");
    expect(detectPlatformKind({ hasTauri: false, target: "something-else" })).toBe("local");
  });
});
```

`src/platform/caps.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { CAPS } from "./caps";

describe("CAPS (spec 4.1)", () => {
  it("desktop can do everything except browse Google Drive", () => {
    expect(CAPS.desktop).toEqual({
      apiKeys: true, localFilePicker: true, driveBrowser: false, openFolder: true, updater: true, preventSleep: true,
    });
  });

  it("local web keeps API keys and opening folders, has no OS dialogs, updater or sleep control", () => {
    expect(CAPS.local).toEqual({
      apiKeys: true, localFilePicker: false, driveBrowser: false, openFolder: true, updater: false, preventSleep: false,
    });
  });

  it("cloud is manual AI only, browses Drive, cannot open folders", () => {
    expect(CAPS.cloud).toEqual({
      apiKeys: false, localFilePicker: false, driveBrowser: true, openFolder: false, updater: false, preventSleep: false,
    });
  });
});
```

`src/platform/paths.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { fileName, parentDir } from "./paths";

describe("paths", () => {
  it("finds the folder of a Windows or POSIX path and keeps its separators", () => {
    expect(parentDir("C:\\Users\\a\\clips\\clip_1.mp4")).toBe("C:\\Users\\a\\clips");
    expect(parentDir("/content/drive/MyDrive/x/clip_1.mp4")).toBe("/content/drive/MyDrive/x");
  });

  it("finds the file name, with a fallback for an empty path", () => {
    expect(fileName("C:\\a\\clip_1.mp4")).toBe("clip_1.mp4");
    expect(fileName("/a/b/clip_2.mp4")).toBe("clip_2.mp4");
    expect(fileName("", "clip.mp4")).toBe("clip.mp4");
  });
});
```

`src/platform/localSecrets.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { localSecretKey, localStorageSecrets, readLocalSecret, writeLocalSecret } from "./localSecrets";

describe("localSecrets", () => {
  beforeEach(() => localStorage.clear());

  it("keeps API keys under the key and format the desktop app already uses", () => {
    expect(localSecretKey("apiKeys")).toBe("ac_api_keys");
    localStorage.setItem("ac_api_keys", btoa(JSON.stringify({ openai: "sk-old" })));
    expect(JSON.parse(readLocalSecret("apiKeys")!)).toEqual({ openai: "sk-old" });
  });

  it("round-trips a value and returns null when nothing or garbage is stored", async () => {
    writeLocalSecret("apiKeys", '{"gemini":"g"}');
    expect(await localStorageSecrets.get("apiKeys")).toBe('{"gemini":"g"}');
    expect(await localStorageSecrets.get("other")).toBeNull();
    localStorage.setItem("ac_api_keys", "%%% not base64 %%%");
    expect(readLocalSecret("apiKeys")).toBeNull();
  });
});
```

`src/platform/auth.test.ts` (one file on purpose: `wireAuthOnce` patches globals once per module instance):

```ts
import axios from "axios";
import { describe, expect, it, vi } from "vitest";
import { getAuthToken, isBackendRequest, setAuthToken, UNAUTHORIZED_EVENT, wireAuthOnce } from "./auth";
import { setApiUrl } from "./backendUrl";

describe("isBackendRequest", () => {
  it("matches the backend URL, same-origin paths and loopback hosts", () => {
    expect(isBackendRequest("https://be.example.com/jobs", "https://be.example.com")).toBe(true);
    expect(isBackendRequest("/history", "http://127.0.0.1:5000")).toBe(true);
    expect(isBackendRequest("http://127.0.0.1:5123/health", "http://127.0.0.1:5000")).toBe(true);
    expect(isBackendRequest("http://localhost:8000/health", "https://be.example.com")).toBe(true);
  });

  it("does not send the token anywhere else", () => {
    expect(isBackendRequest("https://fonts.googleapis.com/css2", "https://be.example.com")).toBe(false);
    expect(isBackendRequest("", "https://be.example.com")).toBe(false);
  });
});

describe("wireAuthOnce", () => {
  it("adds the token to backend requests (axios and fetch) and reports a 401 once per response", async () => {
    const seen: (string | null)[] = [];
    const fakeFetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      seen.push(new Headers(init?.headers).get("Authorization"));
      return new Response("{}", { status: 401 });
    });
    window.fetch = fakeFetch as typeof window.fetch;
    setApiUrl("https://be.example.com");
    setAuthToken("tok-1");
    wireAuthOnce();
    wireAuthOnce(); // second call is a no-op

    const unauthorized = vi.fn();
    window.addEventListener(UNAUTHORIZED_EVENT, unauthorized);

    const echoed = await axios.get("https://be.example.com/history", {
      adapter: async (config) => ({ data: (config.headers as any).Authorization, status: 200, statusText: "OK", headers: {}, config }),
    });
    expect(echoed.data).toBe("Bearer tok-1");

    const other = await axios.get("https://example.org/x", {
      adapter: async (config) => ({ data: (config.headers as any).Authorization ?? null, status: 200, statusText: "OK", headers: {}, config }),
    });
    expect(other.data).toBeNull();

    await expect(
      axios.get("https://be.example.com/history", {
        adapter: async (config) => Promise.reject(Object.assign(new Error("401"), { config, response: { status: 401 } })),
      }),
    ).rejects.toThrow();

    await window.fetch("https://be.example.com/jobs");
    expect(seen).toEqual(["Bearer tok-1"]);
    expect(unauthorized).toHaveBeenCalledTimes(2); // axios 401 + fetch 401
    expect(getAuthToken()).toBe("tok-1");
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/platform`
Expected: FAIL, "Failed to resolve import ./select" (and the others).

- [ ] **Step 3: Write the modules**

`src/platform/types.ts`:

```ts
// Everything that differs between the desktop app, the local web app and the
// cloud app (Vercel + Colab) goes through one Platform object (spec 4.1).

export type PlatformKind = "desktop" | "local" | "cloud";

export interface Caps {
  /** AI providers that need an API key. Cloud: false (manual AI only). */
  apiKeys: boolean;
  /** OS file and folder dialogs. Local and cloud upload through the browser instead. */
  localFilePicker: boolean;
  /** Google Drive browser. Cloud only. */
  driveBrowser: boolean;
  /** Open the result folder on this computer. Desktop and local. */
  openFolder: boolean;
  /** App updater. Desktop only. */
  updater: boolean;
  /** Keep the computer awake while rendering. Desktop only. */
  preventSleep: boolean;
}

export interface BackendInfo {
  url: string;
  token: string;
}

export type VideoSource =
  | { kind: "file"; file: File }
  | { kind: "path"; path: string }
  | { kind: "drive"; path: string };

export interface ClipRef {
  /** Path of the clip on the machine that runs the backend. */
  path: string;
  /** Absolute download URL (a signed /video link with dl=1) for browser downloads. */
  videoUrl?: string;
  /** Suggested file name, e.g. "clip_1.mp4". */
  filename: string;
}

export interface UpdateEvent {
  event: string;
  data?: { contentLength?: number; chunkLength?: number };
}

export interface UpdateHandle {
  version: string;
  body?: string;
  downloadAndInstall(onEvent: (event: UpdateEvent) => void): Promise<void>;
}

export interface UpdaterApi {
  check(): Promise<UpdateHandle | null>;
  relaunch(): Promise<void>;
}

export interface Platform {
  kind: PlatformKind;
  caps: Caps;
  backend(): Promise<BackendInfo>;
  pickVideo(): Promise<VideoSource | null>;
  saveClip(clip: ClipRef): Promise<void>;
  openFolder(path: string): Promise<void>;
  secrets: { get(name: string): Promise<string | null>; set(name: string, value: string): Promise<void> };
  notify(title: string, body: string): void;

  // Not in spec 4.1, needed to move every Tauri call (see "Spec gaps" 1 in the plan).
  /** Find the backend again (desktop: respawn the sidecar). Null when it cannot be reached. */
  reconnect(): Promise<BackendInfo | null>;
  openExternal(url: string): Promise<void>;
  /** OS folder dialog; null when cancelled or not available. */
  pickFolder(): Promise<string | null>;
  /** OS image dialog; null when cancelled or not available. */
  pickImage(): Promise<string | null>;
  setPreventSleep(on: boolean): Promise<void>;
  /** Null where caps.updater is false. */
  updater: UpdaterApi | null;
}
```

`src/platform/caps.ts`:

```ts
import type { Caps, PlatformKind } from "./types";

/** What each platform can do (spec 4.1 table). Components check these, not the platform kind. */
export const CAPS: Record<PlatformKind, Caps> = {
  desktop: { apiKeys: true, localFilePicker: true, driveBrowser: false, openFolder: true, updater: true, preventSleep: true },
  local: { apiKeys: true, localFilePicker: false, driveBrowser: false, openFolder: true, updater: false, preventSleep: false },
  cloud: { apiKeys: false, localFilePicker: false, driveBrowser: true, openFolder: false, updater: false, preventSleep: false },
};
```

`src/platform/select.ts`:

```ts
import type { PlatformKind } from "./types";

/** Tauri present → desktop; a VITE_TARGET=cloud build → cloud; anything else → local (spec 4.1). */
export function detectPlatformKind(env: { hasTauri: boolean; target?: string }): PlatformKind {
  if (env.hasTauri) return "desktop";
  if (env.target === "cloud") return "cloud";
  return "local";
}
```

`src/platform/backendUrl.ts`:

```ts
// The backend address. A live binding: modules that import API_URL always read the current value.
// App.tsx re-exports both names so existing `import { API_URL } from "../App"` keeps working.

export let API_URL = "http://127.0.0.1:8000";

export function setApiUrl(url: string): void {
  API_URL = url.replace(/\/+$/, "");
}
```

`src/platform/auth.ts`:

```ts
import axios from "axios";
import { API_URL } from "./backendUrl";

// The backend token, attached to every request that goes to the backend.
// Moved from useUserSettings.ts (desktop) and web/src/api.ts (cloud).

let token: string | null = null;
let wired = false;

/** Fired on window when the backend answers 401 (token missing, wrong or from an older launch). */
export const UNAUTHORIZED_EVENT = "ac_unauthorized";

export function setAuthToken(value: string | null): void {
  token = value || null;
}

export function getAuthToken(): string | null {
  return token;
}

/** True when a request goes to our backend and must carry the token. */
export function isBackendRequest(url: string, apiUrl: string): boolean {
  if (!url) return false;
  if (url.startsWith("/")) return true;
  if (apiUrl && url.startsWith(apiUrl)) return true;
  return url.includes("127.0.0.1") || url.includes("localhost");
}

function requestUrl(resource: RequestInfo | URL): string {
  if (typeof resource === "string") return resource;
  if (resource instanceof URL) return resource.href;
  return resource.url;
}

/** Register the axios interceptors and the fetch wrapper once. They read the latest token. */
export function wireAuthOnce(): void {
  if (wired) return;
  wired = true;

  axios.interceptors.request.use((config) => {
    if (token && config.url && isBackendRequest(config.url, API_URL)) {
      (config.headers as any)["Authorization"] = `Bearer ${token}`;
    }
    return config;
  });

  axios.interceptors.response.use(
    (response) => response,
    (error) => {
      const url: string = error?.config?.url || "";
      if (error?.response?.status === 401 && isBackendRequest(url, API_URL)) {
        window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
      }
      return Promise.reject(error);
    },
  );

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (resource: RequestInfo | URL, init?: RequestInit) => {
    const url = requestUrl(resource);
    const toBackend = isBackendRequest(url, API_URL);
    if (token && toBackend) {
      const headers = new Headers(init?.headers || (resource instanceof Request ? resource.headers : undefined));
      headers.set("Authorization", `Bearer ${token}`);
      init = { ...init, headers };
    }
    const response = await originalFetch(resource, init);
    if (response.status === 401 && toBackend) {
      window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
    }
    return response;
  };
}
```

`src/platform/paths.ts`:

```ts
/** The folder part of a Windows or POSIX path, keeping its separators. */
export function parentDir(p: string): string {
  const lastSlash = p.replace(/\\/g, "/").lastIndexOf("/");
  return p.substring(0, lastSlash);
}

/** The last part of a path. */
export function fileName(p: string, fallback = "clip.mp4"): string {
  return p.replace(/\\/g, "/").split("/").pop() || fallback;
}
```

`src/platform/localSecrets.ts`:

```ts
import type { Platform } from "./types";

// Secrets in localStorage, base64 encoded, in the format the desktop app has
// always used as its backup ("ac_api_keys" = btoa(JSON of all API keys)).

export function localSecretKey(name: string): string {
  return name === "apiKeys" ? "ac_api_keys" : `ac_secret_${name}`;
}

export function readLocalSecret(name: string): string | null {
  const raw = localStorage.getItem(localSecretKey(name));
  if (!raw) return null;
  try {
    return atob(raw);
  } catch {
    return null;
  }
}

export function writeLocalSecret(name: string, value: string): void {
  localStorage.setItem(localSecretKey(name), btoa(value));
}

export const localStorageSecrets: Platform["secrets"] = {
  get: async (name) => readLocalSecret(name),
  set: async (name, value) => writeLocalSecret(name, value),
};
```

Replace `src/env.d.ts` with:

```ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "cloud" for the Vercel build (.env.cloud). */
  readonly VITE_TARGET?: string;
  /** Cloud: the Colab tunnel address, set in Vercel. */
  readonly VITE_API_URL?: string;
  /** "true": use a backend started by hand on 127.0.0.1:8000 with token "dev-token". */
  readonly VITE_DEV_BACKEND?: string;
  readonly VITE_ENABLE_EXPERIMENTAL_FEATURES?: string;
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx vitest run`
Expected: all pass (errorInfo 4 + select 3 + caps 3 + paths 2 + localSecrets 2 + auth 3).

Run: `npm run build` → exit 0 (the modules are not imported by the app yet; `tsc` still checks them).

- [ ] **Step 5: Commit**

```bash
git add src/platform src/env.d.ts tasks/PROGRESS-LOG.md
git commit -m "$(cat <<'EOF'
feat(sp1): platform core (types, caps, selection, backend URL, auth wiring)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Desktop adapter, baseline local adapter, every Tauri call moved

Desktop behaviour must not change. The local adapter in this task only reproduces what `npm run dev` in a plain browser does today (backend at `127.0.0.1:8000`, no token unless `VITE_DEV_BACKEND=true`); Task 12 adds the real local web behaviour.

**Files:**
- Create: `src/platform/index.ts`, `src/platform/browser.ts`, `src/platform/desktop/index.ts`, `src/platform/desktop/sidecar.ts`, `src/platform/desktop/secrets.ts`, `src/platform/local/index.ts`
- Test: `src/platform/imports.test.ts`
- Modify: `src/main.tsx`, `src/App.tsx:24-27`, `src/hooks/useUserSettings.ts` (rewrite), `src/hooks/useBackendHealth.ts:4,58,107`, `src/hooks/useClipJobs.ts:3,457-463`, `src/hooks/useStartupUpdateCheck.ts`, `src/hooks/useToasts.ts`, `src/components/ClipCard.tsx`, `src/components/settings/OutputSection.tsx`, `src/components/settings/UpdaterSection.tsx`, `src/components/sidebar/Sidebar.tsx:14,176`, `src/components/ui/CanvasConfigControls.tsx:5,37-57`, `src/pages/LandingPage.tsx:2,9-19`

**Interfaces:**
- Consumes (Task 2): `Platform`, `CAPS`, `detectPlatformKind`, `API_URL`/`setApiUrl`, `setAuthToken`/`wireAuthOnce`, `parentDir`/`fileName`, `localStorageSecrets`/`readLocalSecret`/`writeLocalSecret`.
- Produces:
  - `src/platform/index.ts`: `loadPlatform(): Promise<Platform>`, `platform(): Platform` (throws before load), `setPlatform(p: Platform | null): void`, re-exports `CAPS` and all types.
  - `src/platform/browser.ts`: `pickBrowserFile(accept: string): Promise<File | null>`, `pickBrowserVideo(): Promise<VideoSource | null>`, `browserDownload(clip: ClipRef): Promise<void>`, `browserNotify(title: string, body: string): void`, `openInBrowser(url: string): Promise<void>`, `checkBackend(url: string): Promise<boolean>`.
  - each adapter module exports `createPlatform(): Platform`.
  - `src/platform/desktop/sidecar.ts`: `startSidecar(): Promise<BackendInfo>`, `resetAndRespawnBackend(): Promise<number | null>`, `currentBackend(): BackendInfo | null`.

- [ ] **Step 1: Write the failing scan test**

`src/platform/imports.test.ts`:

```ts
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { describe, expect, it } from "vitest";

// Like the SP0 thread test: the rule is checked on the source, so a new file cannot slip past it.
const SRC = resolve(process.cwd(), "src");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name) ? [full] : [];
  });
}

const rel = (file: string) => relative(SRC, file).split(sep).join("/");
const STATIC_TAURI_IMPORT = /^\s*(import|export)\s[^;]*?from\s+["']@tauri-apps\/|^\s*import\s+["']@tauri-apps\//m;

describe("platform boundaries", () => {
  it("imports @tauri-apps/* statically only in src/platform/desktop", () => {
    const offenders = sourceFiles(SRC)
      .filter((file) => !rel(file).startsWith("platform/desktop/"))
      .filter((file) => STATIC_TAURI_IMPORT.test(readFileSync(file, "utf8")))
      .map(rel);
    expect(offenders).toEqual([]);
  });

  it("checks for Tauri (__TAURI_INTERNALS__) only inside src/platform", () => {
    const offenders = sourceFiles(SRC)
      .filter((file) => !rel(file).startsWith("platform/"))
      .filter((file) => readFileSync(file, "utf8").includes("__TAURI_INTERNALS__"))
      .map(rel);
    expect(offenders).toEqual([]);
  });

  it("loads the desktop adapter only through src/platform/index.ts", () => {
    const offenders = sourceFiles(SRC)
      .filter((file) => !rel(file).startsWith("platform/"))
      .filter((file) => /platform\/desktop/.test(readFileSync(file, "utf8")))
      .map(rel);
    expect(offenders).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/platform/imports.test.ts`
Expected: FAIL, first test lists 10 files (`components/ClipCard.tsx`, `components/settings/OutputSection.tsx`, `components/settings/UpdaterSection.tsx`, `components/sidebar/Sidebar.tsx`, `components/ui/CanvasConfigControls.tsx`, `hooks/useClipJobs.ts`, `hooks/useStartupUpdateCheck.ts`, `hooks/useToasts.ts`, `hooks/useUserSettings.ts`, `pages/LandingPage.tsx`); second test lists 6 files (`ClipCard`, `OutputSection`, `UpdaterSection`, `CanvasConfigControls`, `useStartupUpdateCheck`, `useUserSettings`).

- [ ] **Step 3: Write the shared browser helpers**

`src/platform/browser.ts`:

```ts
import axios from "axios";
import type { ClipRef, VideoSource } from "./types";

// Browser implementations shared by the local and cloud adapters (and the desktop video picker).

export function pickBrowserFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.addEventListener("change", () => resolve(input.files?.[0] ?? null), { once: true });
    input.addEventListener("cancel", () => resolve(null), { once: true });
    input.click();
  });
}

export async function pickBrowserVideo(): Promise<VideoSource | null> {
  const file = await pickBrowserFile("video/mp4,video/x-m4v,video/*");
  return file ? { kind: "file", file } : null;
}

/** Let the browser download a clip from its signed link. */
export async function browserDownload(clip: ClipRef): Promise<void> {
  if (!clip.videoUrl) throw new Error("This clip has no download link.");
  const a = document.createElement("a");
  a.href = clip.videoUrl;
  a.download = clip.filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** A browser notification when the user allowed them; the toast is shown by useToasts either way. */
export function browserNotify(title: string, body: string): void {
  try {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, { body });
    }
  } catch (e) {
    console.error("Browser notification failed:", e);
  }
}

export async function openInBrowser(url: string): Promise<void> {
  window.open(url, "_blank", "noopener");
}

export async function checkBackend(url: string): Promise<boolean> {
  try {
    await axios.get(`${url}/health`, { timeout: 15000 });
    return true;
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: Move the sidecar code**

Create `src/platform/desktop/sidecar.ts` with the code moved from `src/hooks/useUserSettings.ts` lines 23-189 (spawn, handshake, heartbeat, respawn). Only the token handling changes: it goes through `auth.ts` instead of a private `wireAuthOnce`.

```ts
import axios from "axios";
import { Command } from "@tauri-apps/plugin-shell";
import { setApiUrl } from "../backendUrl";
import { setAuthToken, wireAuthOnce } from "../auth";
import type { BackendInfo } from "../types";

let backendPortPromise: Promise<number | null> | null = null;
// Tracked at module scope so the sidebar Reconnect button and the sleep/wake
// auto-heal can respawn the backend and re-wire auth without a full app reload.
let currentPort: number | null = null;
let currentToken: string | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let lateListenerAdded = false;

// Not named use…: oxlint's rules-of-hooks would treat it as a React hook.
function applyToken(token: string) {
  (window as any).apiToken = token;
  currentToken = token;
  setAuthToken(token);
  wireAuthOnce();
}

/** (Re)start the heartbeat loop against a given port, clearing any prior one. */
function startHeartbeat(port: number) {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  heartbeatTimer = setInterval(() => {
    fetch(`http://127.0.0.1:${port}/heartbeat`, { method: "POST" }).catch(() => {});
  }, 5000);
}

export function currentBackend(): BackendInfo | null {
  return currentPort ? { url: `http://127.0.0.1:${currentPort}`, token: currentToken || "" } : null;
}

async function spawnBackend(): Promise<number | null> {
  if (backendPortPromise) return backendPortPromise;
  backendPortPromise = new Promise((resolve) => {
    let resolved = false;
    const finish = (port: number | null) => {
      if (!resolved) {
        resolved = true;
        resolve(port);
      }
    };

    // The backend is a large one-file PyInstaller bundle; on a cold start
    // (first launch, CI runners, slower disks, macOS Gatekeeper scanning) it can
    // take over 60s to self-extract and import heavy deps. The
    // "backend-port-found" listener still connects late if the process
    // eventually starts, so this is only the pessimistic fallback.
    setTimeout(() => {
      if (!resolved) {
        console.error("Backend spawn timed out after 90 seconds.");
        finish(null);
      }
    }, 90000);

    // Bypass sidecar if VITE_DEV_BACKEND is true
    if (import.meta.env.VITE_DEV_BACKEND === "true") {
      console.log("Bypassing sidecar, using dev backend at 127.0.0.1:8000");
      const port = 8000;
      applyToken("dev-token");
      setApiUrl(`http://127.0.0.1:${port}`);
      currentPort = port;
      finish(port);
      return;
    }

    try {
      const cmd = Command.sidecar("bin/backend");
      let outBuffer = "";
      cmd.stdout.on("data", (data) => {
        console.log("Backend stdout chunk:", data);
        outBuffer += data;
        const lines = outBuffer.split(/\r?\n/);
        outBuffer = lines.pop() || "";
        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (line.startsWith("TOKEN:")) {
            applyToken(line.replace("TOKEN:", "").trim());
          }
          if (line.startsWith("PORT:")) {
            const p = parseInt(line.replace("PORT:", "").trim(), 10);
            if (!isNaN(p)) {
              currentPort = p;
              finish(p);
              window.dispatchEvent(new CustomEvent("backend-port-found", { detail: p }));
            }
          }
        }
      });
      cmd.stderr.on("data", (line) => console.error("Backend stderr:", line));
      cmd.on("close", (data) => {
        console.log("Backend closed:", data.code);
        finish(null);
      });
      cmd.on("error", (e) => {
        console.error("Backend error:", e);
        finish(null);
      });
      cmd.spawn().then((child) => {
        console.log("Backend spawned with pid:", child.pid);
      }).catch((e) => {
        console.error("Failed to spawn backend:", e);
        finish(null);
      });
    } catch (e) {
      console.error(e);
      finish(null);
    }
  });
  return backendPortPromise;
}

/** Start the sidecar (once) and point the app at it. Rejects when it does not start within 90 s. */
export async function startSidecar(): Promise<BackendInfo> {
  if (!lateListenerAdded) {
    lateListenerAdded = true;
    window.addEventListener("backend-port-found", ((e: CustomEvent) => {
      console.log("Late backend connection established!");
      const port = e.detail as number;
      currentPort = port;
      setApiUrl(`http://127.0.0.1:${port}`);
      startHeartbeat(port);
    }) as EventListener);
  }
  const port = await spawnBackend();
  if (!port) throw new Error("The backend sidecar did not start.");
  setApiUrl(`http://127.0.0.1:${port}`);
  startHeartbeat(port);
  return { url: `http://127.0.0.1:${port}`, token: currentToken || "" };
}

/**
 * Recover the backend connection without restarting the whole app.
 *
 * Used by the sidebar's Reconnect button and by the sleep/wake auto-heal. If a
 * backend is already alive we simply re-point at it and make sure the heartbeat
 * is running (no duplicate process). Otherwise we clear the memoised spawn
 * promise and launch a fresh sidecar.
 */
export async function resetAndRespawnBackend(): Promise<number | null> {
  if (currentPort) {
    try {
      await axios.get(`http://127.0.0.1:${currentPort}/health`, { timeout: 15000 });
      setApiUrl(`http://127.0.0.1:${currentPort}`);
      startHeartbeat(currentPort);
      window.dispatchEvent(new CustomEvent("backend-reconnected", { detail: currentPort }));
      return currentPort;
    } catch {
      // Current backend is genuinely gone — fall through to respawn.
    }
  }

  backendPortPromise = null;
  const port = await spawnBackend();
  if (port) {
    setApiUrl(`http://127.0.0.1:${port}`);
    startHeartbeat(port);
    window.dispatchEvent(new CustomEvent("backend-reconnected", { detail: port }));
  }
  return port;
}
```

Intentional difference from today: the old late-port listener also called `setApiKey("dummy", "trigger-re-render")`, which saved a junk `dummy` entry into the API keys only to force a re-render. Components read `API_URL` at call time and `useBackendHealth` already listens to `backend-port-found`, so the hack is dropped.

`src/platform/desktop/secrets.ts` (moved from `useUserSettings.ts` `safeSaveKeys`/`safeGetKeys`, same vault, client and store key):

```ts
import { Stronghold } from "@tauri-apps/plugin-stronghold";
import { readLocalSecret, writeLocalSecret } from "../localSecrets";
import type { Platform } from "../types";

async function openStore() {
  const sh = await Stronghold.load("ac_vault", "ac_pass");
  const client = await sh.createClient("ac_client").catch(() => sh.loadClient("ac_client"));
  const store = await client.getStore();
  return { sh, store };
}

/** Stronghold, with localStorage as the reliable backup (unchanged from before SP1). */
export const strongholdSecrets: Platform["secrets"] = {
  async get(name) {
    try {
      const { store } = await openStore();
      const val = await store.get(name);
      if (val) return new TextDecoder().decode(new Uint8Array(val));
    } catch (e) {
      console.error("Stronghold load error", e);
    }
    // Fallback to localStorage if Stronghold failed or was empty
    return readLocalSecret(name);
  },
  async set(name, value) {
    writeLocalSecret(name, value);
    try {
      const { sh, store } = await openStore();
      await store.insert(name, Array.from(new TextEncoder().encode(value)));
      await sh.save();
    } catch (e) {
      console.error("Stronghold save error", e);
    }
  },
};
```

- [ ] **Step 5: Write the desktop adapter**

`src/platform/desktop/index.ts`:

```ts
import axios from "axios";
import { invoke } from "@tauri-apps/api/core";
import { open as openDialog, save as saveDialog } from "@tauri-apps/plugin-dialog";
import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";
import { relaunch } from "@tauri-apps/plugin-process";
import { open as shellOpen } from "@tauri-apps/plugin-shell";
import { check } from "@tauri-apps/plugin-updater";
import { API_URL } from "../backendUrl";
import { pickBrowserVideo } from "../browser";
import { CAPS } from "../caps";
import { parentDir } from "../paths";
import type { Platform, UpdateHandle } from "../types";
import { strongholdSecrets } from "./secrets";
import { currentBackend, resetAndRespawnBackend, startSidecar } from "./sidecar";

// The only module (with its siblings) that talks to Tauri. Loaded with a dynamic
// import from ../index.ts, so local and cloud builds never run Tauri code.

async function askNotificationPermission(): Promise<void> {
  try {
    if (!(await isPermissionGranted())) await requestPermission();
  } catch (e) {
    console.error("Failed to request notification permission:", e);
  }
}

export function createPlatform(): Platform {
  // Asked at startup, as useToasts did before SP1.
  void askNotificationPermission();

  return {
    kind: "desktop",
    caps: CAPS.desktop,
    backend: startSidecar,
    // Spec 4.1 says plugin-dialog; the desktop app has always uploaded through
    // the browser file input. Kept as is (plan question 3).
    pickVideo: pickBrowserVideo,
    async saveClip(clip) {
      const dest = await saveDialog({
        defaultPath: clip.filename,
        filters: [{ name: "Video", extensions: ["mp4"] }],
      });
      if (dest) await axios.post(`${API_URL}/save_file`, { src: clip.path, dest });
    },
    async openFolder(path) {
      const dir = parentDir(path);
      try {
        await axios.post(`${API_URL}/open_folder`, { path: dir });
      } catch (err) {
        console.error("Open folder API failed", err);
        // fallback to old tauri open
        try {
          await shellOpen(dir);
        } catch {
          await shellOpen(path);
        }
      }
    },
    secrets: strongholdSecrets,
    notify(title, body) {
      (async () => {
        try {
          if (await isPermissionGranted()) sendNotification({ title, body });
        } catch (e) {
          console.error("Failed to send OS notification:", e);
        }
      })();
    },
    async reconnect() {
      const port = await resetAndRespawnBackend();
      return port ? currentBackend() : null;
    },
    async openExternal(url) {
      await shellOpen(url);
    },
    async pickFolder() {
      const folder = await openDialog({ directory: true, multiple: false });
      return typeof folder === "string" ? folder : null;
    },
    async pickImage() {
      const selected = await openDialog({
        multiple: false,
        filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp"] }],
      });
      return typeof selected === "string" ? selected : null;
    },
    async setPreventSleep(on) {
      await invoke(on ? "prevent_sleep" : "allow_sleep");
    },
    updater: {
      async check() {
        const update = await check();
        if (!update) return null;
        const handle: UpdateHandle = {
          version: update.version,
          body: update.body,
          downloadAndInstall: (onEvent) => update.downloadAndInstall((event) => onEvent(event as Parameters<typeof onEvent>[0])),
        };
        return handle;
      },
      relaunch,
    },
  };
}
```

- [ ] **Step 6: Write the baseline local adapter**

`src/platform/local/index.ts`:

```ts
import axios from "axios";
import { API_URL } from "../backendUrl";
import { setAuthToken, wireAuthOnce } from "../auth";
import { browserDownload, browserNotify, checkBackend, openInBrowser, pickBrowserVideo } from "../browser";
import { CAPS } from "../caps";
import { localStorageSecrets } from "../localSecrets";
import { parentDir } from "../paths";
import type { BackendInfo, Platform } from "../types";

// Task 3 baseline: the same as running the desktop UI in a plain browser before
// SP1 (backend on 127.0.0.1:8000, token only with VITE_DEV_BACKEND=true).
// Task 12 adds the real local web mode (page origin + #t= token).

function connect(): BackendInfo {
  const token = import.meta.env.VITE_DEV_BACKEND === "true" ? "dev-token" : "";
  setAuthToken(token || null);
  wireAuthOnce();
  return { url: API_URL, token };
}

export function createPlatform(): Platform {
  return {
    kind: "local",
    caps: CAPS.local,
    backend: async () => connect(),
    pickVideo: pickBrowserVideo,
    saveClip: browserDownload,
    async openFolder(path) {
      await axios.post(`${API_URL}/open_folder`, { path: parentDir(path) });
    },
    secrets: localStorageSecrets,
    notify: browserNotify,
    reconnect: async () => ((await checkBackend(API_URL)) ? connect() : null),
    openExternal: openInBrowser,
    pickFolder: async () => null,
    pickImage: async () => null,
    setPreventSleep: async () => {},
    updater: null,
  };
}
```

- [ ] **Step 7: Write the platform loader**

`src/platform/index.ts`:

```ts
import { detectPlatformKind } from "./select";
import type { Platform } from "./types";

export type * from "./types";
export { CAPS } from "./caps";

let current: Platform | null = null;

/** The platform of this run. Call loadPlatform() before rendering (main.tsx does). */
export function platform(): Platform {
  if (!current) throw new Error("Platform not loaded: call loadPlatform() before rendering.");
  return current;
}

/** For tests. */
export function setPlatform(next: Platform | null): void {
  current = next;
}

/** Choose and load the adapter. Tauri modules are only loaded on desktop. */
export async function loadPlatform(): Promise<Platform> {
  const kind = detectPlatformKind({
    hasTauri: typeof window !== "undefined" && "__TAURI_INTERNALS__" in window,
    target: import.meta.env.VITE_TARGET,
  });
  const adapter =
    kind === "desktop" ? await import("./desktop") : kind === "cloud" ? await import("./cloud") : await import("./local");
  current = adapter.createPlatform();
  return current;
}
```

`./cloud` does not exist until Task 5. Until then create `src/platform/cloud/index.ts` as a stub so the build resolves:

```ts
import type { Platform } from "../types";

// Replaced in Task 5.
export function createPlatform(): Platform {
  throw new Error("The cloud build is added in SP1 Task 5.");
}
```

Replace `src/main.tsx`:

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./i18n";
import { loadPlatform } from "./platform";

const root = document.getElementById("root")!;

loadPlatform()
  .then(() => {
    ReactDOM.createRoot(root).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    );
  })
  .catch((err) => {
    console.error("Platform failed to load:", err);
    root.textContent =
      "Auto Clipper tidak bisa dimulai. Muat ulang halaman ini. / Auto Clipper could not start. Reload this page.";
  });
```

- [ ] **Step 8: Move each Tauri call to the platform**

`src/App.tsx` lines 24-27, replace

```ts
export let API_URL = "http://127.0.0.1:8000";
export function setApiUrl(url: string) {
  API_URL = url;
}
```

with

```ts
// videoSrc below still reads API_URL; a re-export alone does not bring it into scope (removed in Task 9).
import { API_URL } from "./platform/backendUrl";
export { API_URL, setApiUrl } from "./platform/backendUrl";
```

`src/hooks/useUserSettings.ts`, replace the whole file:

```ts
import { useState, useEffect } from "react";
import { platform } from "../platform";

export type Quality = "best" | "2160p" | "1440p" | "1080p" | "720p" | "480p";

// All API keys are stored as one JSON string under this secret name
// (desktop: Stronghold + localStorage backup; local: localStorage; cloud: none).
const API_KEYS_SECRET = "apiKeys";

function decodeLegacy(): Record<string, string> {
  const m: Record<string, string> = {};
  try {
    const lsApi = localStorage.getItem("ac_api_key");
    const lsOpenai = localStorage.getItem("ac_openai_key");
    if (lsApi) m.gemini = atob(lsApi);
    if (lsOpenai) m.openai = atob(lsOpenai);
  } catch {
    // Old values that are not base64: ignore them.
  }
  return m;
}

async function saveKeys(keys: Record<string, string>): Promise<void> {
  await platform().secrets.set(API_KEYS_SECRET, JSON.stringify(keys));
}

async function loadKeys(): Promise<Record<string, string> | null> {
  const raw = await platform().secrets.get(API_KEYS_SECRET);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function useUserSettings() {
  const [isInitializing, setIsInitializing] = useState(true);
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [outputFolder, setOutputFolder] = useState(() => localStorage.getItem("ac_output_folder") || "");
  const [quality, setQuality] = useState<Quality>(() => (localStorage.getItem("ac_quality") as Quality) || "best");
  const [whisperModel, setWhisperModel] = useState(() => localStorage.getItem("ac_whisper_model") || "small");

  const setApiKey = (id: string, value: string) =>
    setApiKeys((prev) => ({ ...prev, [id]: value }));

  useEffect(() => {
    async function init() {
      try {
        await platform().backend();
      } catch (e) {
        // The sidebar shows "Terputus" and offers Reconnect; the app still opens.
        console.error("Backend not available at startup:", e);
      }

      const stored = await loadKeys();
      if (stored) {
        setApiKeys(stored);
      } else {
        const legacy = decodeLegacy();
        if (Object.keys(legacy).length) {
          setApiKeys(legacy);
          await saveKeys(legacy);
        }
      }
      setIsInitializing(false);
    }
    init();
  }, []);

  useEffect(() => {
    if (isInitializing) return;
    saveKeys(apiKeys);
  }, [apiKeys, isInitializing]);

  useEffect(() => {
    localStorage.setItem("ac_output_folder", outputFolder);
  }, [outputFolder]);

  useEffect(() => {
    localStorage.setItem("ac_quality", quality);
  }, [quality]);

  useEffect(() => {
    localStorage.setItem("ac_whisper_model", whisperModel);
  }, [whisperModel]);

  return {
    isInitializing,
    apiKeys, setApiKey,
    outputFolder, setOutputFolder,
    quality, setQuality,
    whisperModel, setWhisperModel,
  };
}
```

`src/hooks/useBackendHealth.ts`: replace line 4 `import { resetAndRespawnBackend } from "./useUserSettings";` with `import { platform } from "../platform";`, and both calls `await resetAndRespawnBackend();` (lines 58 and 107) with `await platform().reconnect();`.

`src/hooks/useClipJobs.ts`: delete line 3 `import { invoke } from "@tauri-apps/api/core";`, add `import { platform } from "../platform";` after the `API_URL` import, and replace lines 457-463

```ts
  useEffect(() => {
    if (isRunning) {
      invoke('prevent_sleep').catch(console.error);
    } else {
      invoke('allow_sleep').catch(console.error);
    }
  }, [isRunning]);
```

with

```ts
  useEffect(() => {
    if (!platform().caps.preventSleep) return;
    platform().setPreventSleep(isRunning).catch(console.error);
  }, [isRunning]);
```

`src/hooks/useToasts.ts`, replace the whole file:

```ts
import { useState } from "react";
import { platform } from "../platform";

export type ToastKind = "info" | "success" | "error";
export type Toast = { id: number; text: string; kind: ToastKind };

/** Ephemeral toast notifications (auto-dismiss), plus an OS/browser notification where allowed. */
export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const notify = (text: string, kind: ToastKind = "info") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, text, kind }]);
    const ttl = kind === "error" ? 8000 : 4000;
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), ttl);
    platform().notify("Auto Clipper", text);
  };

  return { toasts, notify };
}
```

`src/hooks/useStartupUpdateCheck.ts`: delete the `@tauri-apps/plugin-updater` import, add `import { platform } from "../platform";`, and replace

```ts
    // Only run when within Tauri environment
    const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
    if (!isTauri) return;

    const performUpdateCheck = async () => {
      try {
        // Wrap check() in a timeout to prevent hanging if network stalls
        const checkPromise = check();
```

with

```ts
    // Only the desktop app has an updater.
    const updater = platform().updater;
    if (!updater) return;

    const performUpdateCheck = async () => {
      try {
        // Wrap check() in a timeout to prevent hanging if network stalls
        const checkPromise = updater.check();
```

`src/components/settings/UpdaterSection.tsx`: replace lines 6-7 (`check`, `relaunch` imports) with `import { platform } from '../../platform';` and `import type { UpdateHandle } from '../../platform';`. Then:
- `const [updateAvailable, setUpdateAvailable] = useState<any>(null);` → `useState<UpdateHandle | null>(null);`
- add `const updater = platform().updater;` after the `useToasts()` line;
- in `checkForUpdates`: first line inside the function `if (!updater) return;`, and `const update = await check();` → `const update = await updater.check();`;
- replace the condition `if (errMsg.includes('missing Tauri-Invoke-Key') || errMsg.includes('not supported in browser') || !window.__TAURI_INTERNALS__) {` and the `// @ts-ignore` line above it with `if (errMsg.includes('missing Tauri-Invoke-Key') || errMsg.includes('not supported in browser')) {`;
- in `installUpdate`: `if (!updateAvailable) return;` → `if (!updateAvailable || !updater) return;`, `await updateAvailable.downloadAndInstall((event: any) => {` → `await updateAvailable.downloadAndInstall((event) => {`, and `await relaunch();` → `await updater.relaunch();`.

`src/components/settings/OutputSection.tsx`: replace line 2 with `import { platform } from '../../platform';`, replace `handleSelectFolder` with

```tsx
  const handleSelectFolder = async () => {
    const folder = await platform().pickFolder();
    if (folder) setOutputFolder(folder);
  };
```

and wrap the whole "Folder Penyimpanan" block (`<div className="space-y-2">` … its closing `</div>`, the first child of `<div className="space-y-6">`) in `{platform().caps.localFilePicker && ( … )}`. Off desktop the folder row is hidden (plan question 6); the quality selector stays.

`src/components/ui/CanvasConfigControls.tsx`: replace line 5 `import { open } from "@tauri-apps/plugin-dialog";` with `import { platform } from "../../platform";` and `handleSelectImage` with

```tsx
  const handleSelectImage = async () => {
    try {
      const selected = await platform().pickImage();
      if (selected) {
        onChange({
          ...config,
          background_type: "image",
          background_image_path: selected,
        });
        return;
      }
      // No OS dialog here (local/cloud): fall back to the browser file input as before.
      if (!platform().caps.localFilePicker) fileInputRef.current?.click();
    } catch (err) {
      console.error("Error opening file dialog:", err);
      fileInputRef.current?.click();
    }
  };
```

`src/components/sidebar/Sidebar.tsx`: replace line 14 with `import { platform } from "../../platform";` and line 176 `onClick={() => open("https://auto-clipper.dhims.web.id")}` with `onClick={() => platform().openExternal("https://auto-clipper.dhims.web.id")}`.

`src/pages/LandingPage.tsx`: replace line 2 with `import { platform } from "../platform";` and `await open(url);` with `await platform().openExternal(url);`.

`src/components/ClipCard.tsx`: replace lines 4-5 (shell `open`, dialog `save`) with

```tsx
import { platform } from "../platform";
import { fileName } from "../platform/paths";
```

remove the now unused `axios` and `API_URL` imports (lines 6-7), and replace the download `<button onClick={async (e) => { … }}` handler (lines 114-135) with

```tsx
            onClick={async (e) => {
              e.preventDefault();
              try {
                await platform().saveClip({
                  path: clip.path,
                  filename: fileName(clip.path),
                  videoUrl: videoSrc(clip.path, clip.v),
                });
              } catch (err) {
                console.error("Save failed", err);
              }
            }}
```

and the folder `Button`'s `onClick` (lines 146-166) with

```tsx
            onClick={async () => {
              try {
                await platform().openFolder(clip.path);
              } catch (err) {
                console.error("Open folder failed", err);
              }
            }}
```

and render that folder `Button` only when `platform().caps.openFolder` (wrap it in `{platform().caps.openFolder && ( … )}`).

- [ ] **Step 9: Run the checks**

Run: `npx vitest run`
Expected: all pass, including the 3 tests of `imports.test.ts`.

Run: `npm run build` → exit 0. Run: `npx oxlint src` → 0 errors.

Run: `git grep -n "@tauri-apps/" -- src ":!src/platform/desktop"` → no output.

- [ ] **Step 10: Browser check of the baseline local adapter**

In one PowerShell window (backend with the dev token, app data in a temp folder):

```powershell
$env:AUTO_CLIPPER_DEV_TOKEN = "dev-token"; $env:AUTO_CLIPPER_WORKSPACE = "$env:TEMP\ac-sp1-dev"
C:\Users\dhima\projects\ac-venv\Scripts\python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

In a second window: `$env:VITE_DEV_BACKEND = "true"; npm run dev`, open `http://localhost:5173`. Expected: splash → landing page → app; sidebar says "Terhubung"; Riwayat loads; Settings shows no "Pilih Folder" row and no updater (local caps). Stop both with Ctrl+C. Record the result in the progress log.

Desktop (Tauri) check is in the owner checklist (Task 14), and the owner can run "PR Check" on this branch (Task 1 Step 7).

- [ ] **Step 11: Commit**

```bash
git add src tasks/PROGRESS-LOG.md
git commit -m "$(cat <<'EOF'
refactor(sp1): platform layer with desktop adapter; Tauri only in src/platform/desktop

Moves sidecar spawn, Stronghold, dialogs, shell, notifications, updater and
prevent_sleep behind platform(). A Vitest scan fails on any static
@tauri-apps import outside src/platform/desktop. Desktop behaviour unchanged.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Single i18n (web strings into `src/locales`)

**Files:**
- Create: `scripts/add-locale-keys.mjs` (kept: later tasks use it), `scripts/check-web-strings.mjs` (deleted in Task 14), `src/locales/locales.test.ts`
- Modify: `src/locales/id.json`, `src/locales/en.json`

**Interfaces:**
- Consumes: nothing.
- Produces: locale keys `action.pick_from_drive` and `cookies.privacy_cloud` (used in Tasks 5 and 6); `node scripts/add-locale-keys.mjs` reading `{"id": {...}, "en": {...}}` (nested objects) from stdin, adding new keys to both files and refusing (exit 1, nothing written) when a key already exists with another text.

Facts this task relies on (checked against the code): `web/src/lib/strings.ts` has 74 keys per language. 67 exist in `src/locales` with the same text. `cookies.privacy` differs (web names Google Drive). Missing: `action.pick_from_drive` (used by the error-card mapping that moves), and `error.start_over`, `nav.settings`, `settings.subtitle`, `settings.language_title`, `settings.language_note`, which belong to web pages that spec 4.2 does not move (desktop has its own Settings page with a language switch). `web/src/lib/lang.ts` (language store) is replaced by the i18next language setting that desktop already has; nothing to port.

The locale files are stored with LF in git and CRLF in this working copy, without a final newline; `id.json` has one line written `"aiClipper" : {`. Rewriting them with `JSON.stringify(data, null, 2)` changes only that line and the endings, which git normalizes.

- [ ] **Step 1: Write the failing check**

`scripts/check-web-strings.mjs`:

```js
// SP1 one-off proof: every text of web/src/lib/strings.ts that SP1 moves exists in
// src/locales/{id,en}.json with the same wording. Delete together with web/ (Task 14).
import { readFileSync } from "node:fs";

// Keys of web pages that SP1 does not move (spec 4.2); desktop has its own Settings page.
const NOT_MOVED = new Set(["error.start_over", "nav.settings", "settings.subtitle", "settings.language_title", "settings.language_note"]);
// The web wording names Google Drive, so it lives under its own key, shown only on Colab.
const RENAMED = { "cookies.privacy": "cookies.privacy_cloud" };

const source = readFileSync("web/src/lib/strings.ts", "utf8");
const literal = source.slice(source.indexOf("= {") + 2, source.lastIndexOf("};") + 1);
const STRINGS = Function(`return (${literal});`)();

const get = (obj, key) => key.split(".").reduce((node, part) => (node == null ? undefined : node[part]), obj);
const failures = [];
let checked = 0;
for (const lang of ["id", "en"]) {
  const locale = JSON.parse(readFileSync(`src/locales/${lang}.json`, "utf8"));
  for (const [key, text] of Object.entries(STRINGS[lang])) {
    if (NOT_MOVED.has(key)) continue;
    const target = RENAMED[key] ?? key;
    const actual = get(locale, target);
    checked += 1;
    if (actual !== text) failures.push(`${lang}: ${target} = ${JSON.stringify(actual)}, web has ${JSON.stringify(text)}`);
  }
}
if (failures.length) {
  console.error(`${failures.length} of ${checked} web texts are missing or different:\n${failures.join("\n")}`);
  process.exit(1);
}
console.log(`All ${checked} web texts that SP1 moves are in src/locales.`);
```

`src/locales/locales.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import en from "./en.json";
import id from "./id.json";

function keys(obj: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(obj)
    .flatMap(([key, value]) =>
      value && typeof value === "object" ? keys(value as Record<string, unknown>, `${prefix}${key}.`) : [`${prefix}${key}`],
    )
    .sort();
}

describe("locales", () => {
  it("Indonesian and English have the same keys", () => {
    expect(keys(en as Record<string, unknown>)).toEqual(keys(id as Record<string, unknown>));
  });
});
```

`scripts/add-locale-keys.mjs`:

```js
// Adds keys to src/locales/id.json and src/locales/en.json.
// Input on stdin: {"id": {...nested keys...}, "en": {...}}. A key that already exists with the
// same text is left alone; one that exists with another text stops the script before anything
// is written (exit 1).
import { readFileSync, writeFileSync } from "node:fs";

const input = JSON.parse(readFileSync(0, "utf8"));
const conflicts = [];

function merge(target, source, path) {
  for (const [key, value] of Object.entries(source)) {
    const here = `${path}.${key}`;
    if (value && typeof value === "object") {
      if (target[key] === undefined) target[key] = {};
      if (typeof target[key] !== "object") {
        conflicts.push(here);
        continue;
      }
      merge(target[key], value, here);
    } else if (target[key] === undefined) {
      target[key] = value;
    } else if (target[key] !== value) {
      conflicts.push(`${here}: has ${JSON.stringify(target[key])}`);
    }
  }
}

const updated = {};
for (const lang of ["id", "en"]) {
  if (!input[lang]) {
    console.error(`The input has no "${lang}" object.`);
    process.exit(1);
  }
  const file = `src/locales/${lang}.json`;
  const data = JSON.parse(readFileSync(file, "utf8"));
  merge(data, input[lang], lang);
  updated[file] = data;
}
if (conflicts.length) {
  console.error(`Not written. These keys already exist with another text:\n${conflicts.join("\n")}`);
  process.exit(1);
}
for (const [file, data] of Object.entries(updated)) writeFileSync(file, JSON.stringify(data, null, 2));
console.log(`Updated ${Object.keys(updated).join(" and ")}.`);
```

- [ ] **Step 2: Run the check to see it fail**

Run: `node scripts/check-web-strings.mjs`
Expected: exit 1, "4 of 138 web texts are missing or different", listing `action.pick_from_drive` and `cookies.privacy_cloud` for `id` and `en` (138 = 2 × (74 − 5 not moved)).

Run: `npx vitest run src/locales` → PASS (parity already holds; it guards the next steps).

- [ ] **Step 3: Add the two keys (Git Bash)**

```bash
node scripts/add-locale-keys.mjs <<'JSON'
{
  "id": {
    "action": { "pick_from_drive": "Pilih video dari Google Drive" },
    "cookies": { "privacy_cloud": "File disimpan di folder data aplikasi (di Google Colab: Google Drive Anda, folder AutoClipperData/cookies) dan hanya dipakai saat mengunduh video." }
  },
  "en": {
    "action": { "pick_from_drive": "Choose a video from Google Drive" },
    "cookies": { "privacy_cloud": "The file is stored in the app's data folder (on Google Colab: your Google Drive, folder AutoClipperData/cookies) and is only used when downloading videos." }
  }
}
JSON
```

- [ ] **Step 4: Run the checks to see them pass**

Run: `node scripts/check-web-strings.mjs`
Expected: `All 138 web texts that SP1 moves are in src/locales.`

Run: `npx vitest run` → all pass. Run: `npm run build` → exit 0.

Run: `git diff --stat src/locales` → only `id.json` and `en.json`, a handful of lines each (plus the `"aiClipper" : {` line in `id.json`).

- [ ] **Step 5: Commit**

```bash
git add scripts/add-locale-keys.mjs scripts/check-web-strings.mjs src/locales tasks/PROGRESS-LOG.md
git commit -m "$(cat <<'EOF'
feat(sp1): one set of UI texts in src/locales

The web texts SP1 moves are now in src/locales (checked by
scripts/check-web-strings.mjs); the Drive wording of the cookies privacy note
becomes cookies.privacy_cloud. Adds an id/en key parity test and
scripts/add-locale-keys.mjs.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Cloud adapter, AuthGate, Drive browser, cloud build

**Files:**
- Modify (replace stub): `src/platform/cloud/index.ts`
- Test: `src/platform/cloud/cloud.test.ts`
- Create: `src/components/AuthGate.tsx` (from `web/src/components/AuthGate.tsx`), `src/components/GDriveBrowserModal.tsx` (from `web/src/components/GDriveBrowserModal.tsx`), `.env.cloud`, `vercel.json`
- Modify: `package.json` (script `build:cloud`), `src/api.ts`, `src/App.tsx`, `src/components/GenerateForm.tsx`, `src/components/sidebar/Sidebar.tsx`, `src/pages/SettingsPage.tsx`, `src/components/CookiesPanel.tsx:218-220`, `src/locales/{id,en}.json`

**Interfaces:**
- Consumes: Task 2 (`setApiUrl`, `API_URL`, `setAuthToken`, `getAuthToken`, `wireAuthOnce`, `UNAUTHORIZED_EVENT`, `CAPS`), Task 3 (`platform()`, `browser.ts` helpers), Task 4 (`action.pick_from_drive`, `cookies.privacy_cloud`).
- Produces:
  - `src/platform/cloud/index.ts`: `createPlatform()`, `resolveCloudBackend(envUrl: string | undefined, storage: Pick<Storage, "getItem">): BackendInfo`, `saveCloudToken(token: string, storage?: Storage): void`, `CLOUD_URL_KEYS`, `CLOUD_TOKEN_KEYS`, `AUTH_CHANGED_EVENT = "ac_auth_changed"`.
  - `src/api.ts`: `GDriveItem`, `GDriveListing`, `apiBrowseGDrive(dirPath?: string): Promise<GDriveListing>`.
  - App context: `requestDriveBrowser(): void` (Task 6 uses it).
  - `npm run build:cloud`.

- [ ] **Step 1: Write the failing test**

`src/platform/cloud/cloud.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAuthToken } from "../auth";
import { API_URL } from "../backendUrl";
import { AUTH_CHANGED_EVENT, createPlatform, resolveCloudBackend, saveCloudToken } from "./index";

const storage = (values: Record<string, string>) => ({ getItem: (key: string) => values[key] ?? null });

describe("resolveCloudBackend", () => {
  it("prefers the address built into the app (VITE_API_URL)", () => {
    const info = resolveCloudBackend("https://be.example.com", storage({ AUTO_CLIPPER_API_URL: "https://other" }));
    expect(info.url).toBe("https://be.example.com");
  });

  it("falls back to the address saved in this browser, new key first", () => {
    expect(resolveCloudBackend("", storage({ ac_api_url: "https://old", AUTO_CLIPPER_API_URL: "https://new" })).url).toBe("https://new");
    expect(resolveCloudBackend(undefined, storage({ ac_api_url: "https://old" })).url).toBe("https://old");
  });

  it("uses localhost:8000 when nothing is set, and drops a trailing slash", () => {
    expect(resolveCloudBackend(undefined, storage({})).url).toBe("http://localhost:8000");
    expect(resolveCloudBackend("https://be.example.com/", storage({})).url).toBe("https://be.example.com");
  });

  it("reads the token AuthGate saved, new key first", () => {
    expect(resolveCloudBackend(undefined, storage({ ac_web_token: "old", AUTO_CLIPPER_WEB_TOKEN: "new" })).token).toBe("new");
    expect(resolveCloudBackend(undefined, storage({ ac_web_token: "old" })).token).toBe("old");
    expect(resolveCloudBackend(undefined, storage({})).token).toBe("");
  });
});

describe("cloud platform", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.unstubAllEnvs();
  });

  it("uses the stored address and token, has no API keys and no updater", async () => {
    vi.stubEnv("VITE_API_URL", "");
    localStorage.setItem("AUTO_CLIPPER_API_URL", "https://be.example.com/");
    localStorage.setItem("AUTO_CLIPPER_WEB_TOKEN", "tok-9");

    const p = createPlatform();

    expect(await p.backend()).toEqual({ url: "https://be.example.com", token: "tok-9" });
    expect(API_URL).toBe("https://be.example.com");
    expect(getAuthToken()).toBe("tok-9");
    expect(p.kind).toBe("cloud");
    expect(p.caps.apiKeys).toBe(false);
    expect(p.caps.driveBrowser).toBe(true);
    expect(p.updater).toBeNull();
    expect(await p.secrets.get("apiKeys")).toBeNull();
  });

  it("saveCloudToken keeps the token under both keys and tells AuthGate", () => {
    const seen = vi.fn();
    window.addEventListener(AUTH_CHANGED_EVENT, seen);

    saveCloudToken("  abc  ");
    expect(localStorage.getItem("AUTO_CLIPPER_WEB_TOKEN")).toBe("abc");
    expect(localStorage.getItem("ac_web_token")).toBe("abc");
    expect(getAuthToken()).toBe("abc");

    saveCloudToken("");
    expect(localStorage.getItem("AUTO_CLIPPER_WEB_TOKEN")).toBeNull();
    expect(getAuthToken()).toBeNull();
    expect(seen).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/platform/cloud`
Expected: FAIL ("resolveCloudBackend is not a function" / the stub throws "The cloud build is added in SP1 Task 5.").

- [ ] **Step 3: Write the cloud adapter**

Replace `src/platform/cloud/index.ts`:

```ts
import { API_URL, setApiUrl } from "../backendUrl";
import { setAuthToken, wireAuthOnce } from "../auth";
import { browserDownload, browserNotify, checkBackend, openInBrowser, pickBrowserVideo } from "../browser";
import { CAPS } from "../caps";
import type { BackendInfo, Platform } from "../types";

// The Vercel app for a backend on Google Colab (spec 4.7). Same lookup as web/src/api.ts:
// VITE_API_URL from the build, else the address saved in this browser, else localhost:8000;
// the token is the one the user typed into AuthGate.

export const CLOUD_URL_KEYS = ["AUTO_CLIPPER_API_URL", "ac_api_url"] as const;
export const CLOUD_TOKEN_KEYS = ["AUTO_CLIPPER_WEB_TOKEN", "ac_web_token"] as const;
/** Fired on window when the saved token changes (detail: { token }). */
export const AUTH_CHANGED_EVENT = "ac_auth_changed";
const DEFAULT_URL = "http://localhost:8000";

type Reader = Pick<Storage, "getItem">;

function firstStored(storage: Reader, keys: readonly string[]): string {
  for (const key of keys) {
    try {
      const value = storage.getItem(key);
      if (value) return value;
    } catch {
      // Storage blocked: same as not set.
    }
  }
  return "";
}

export function resolveCloudBackend(envUrl: string | undefined, storage: Reader): BackendInfo {
  const url = (envUrl || firstStored(storage, CLOUD_URL_KEYS) || DEFAULT_URL).trim().replace(/\/+$/, "");
  return { url, token: firstStored(storage, CLOUD_TOKEN_KEYS).trim() };
}

/** Save (or with "" forget) the access token and tell AuthGate. */
export function saveCloudToken(token: string, storage: Storage = localStorage): void {
  const clean = token.trim();
  for (const key of CLOUD_TOKEN_KEYS) {
    if (clean) storage.setItem(key, clean);
    else storage.removeItem(key);
  }
  setAuthToken(clean || null);
  window.dispatchEvent(new CustomEvent(AUTH_CHANGED_EVENT, { detail: { token: clean } }));
}

function connect(): BackendInfo {
  const info = resolveCloudBackend(import.meta.env.VITE_API_URL, localStorage);
  setApiUrl(info.url);
  setAuthToken(info.token || null);
  wireAuthOnce();
  return info;
}

export function createPlatform(): Platform {
  // Before the first render, so AuthGate already sees a saved token.
  connect();
  return {
    kind: "cloud",
    caps: CAPS.cloud,
    backend: async () => connect(),
    pickVideo: pickBrowserVideo,
    saveClip: browserDownload,
    openFolder: async () => {
      throw new Error("Opening folders is not available in the cloud app.");
    },
    secrets: { get: async () => null, set: async () => {} },
    notify: browserNotify,
    reconnect: async () => ((await checkBackend(API_URL)) ? connect() : null),
    openExternal: openInBrowser,
    pickFolder: async () => null,
    pickImage: async () => null,
    setPreventSleep: async () => {},
    updater: null,
  };
}
```

- [ ] **Step 4: Run the test to see it pass**

Run: `npx vitest run src/platform/cloud` → 6 passed.

- [ ] **Step 5: Add the texts for AuthGate and the Drive browser (Git Bash)**

```bash
node scripts/add-locale-keys.mjs <<'JSON'
{
  "id": {
    "auth": {
      "loading": "Menyiapkan Auto Clipper…",
      "tagline": "Potong video panjang jadi klip pendek secara otomatis.",
      "open_login": "Masuk ke Workspace",
      "login_title": "Masuk",
      "login_subtitle": "Masukkan kode akses dari notebook Colab (API_SECRET_TOKEN).",
      "token_placeholder": "Kode akses",
      "verifying": "Memeriksa…",
      "submit": "Masuk",
      "stored_locally": "Kode akses hanya disimpan di browser ini.",
      "close": "Tutup",
      "discord_title": "Komunitas Discord",
      "discord_badge": "Komunitas",
      "discord_body": "Laporkan bug, minta fitur, pamerkan konten, dan ngobrol dengan sesama clipper.",
      "error_empty": "Kode akses belum diisi. Salin API_SECRET_TOKEN dari notebook Colab, lalu tempel di sini.",
      "error_invalid": "Kode akses ditolak karena tidak cocok dengan server Colab yang sedang berjalan. Salin lagi API_SECRET_TOKEN dari notebook, lalu coba lagi.",
      "error_offline": "Server Colab tidak bisa dihubungi. Notebook belum dijalankan atau sesinya sudah berakhir. Jalankan lagi notebook sampai server menyala, lalu coba lagi.",
      "error_expired": "Kode akses tidak berlaku lagi, mungkin karena server Colab dinyalakan ulang dengan kode baru. Masukkan kode akses dari notebook sekali lagi."
    },
    "drive": {
      "title": "Pilih video dari Google Drive",
      "go_up": "Kembali ke folder sebelumnya",
      "empty": "Folder ini tidak berisi video atau folder lain.",
      "load_failed": "Isi folder tidak bisa dimuat. Google Drive mungkin belum terhubung di Colab. Jalankan lagi sel yang menghubungkan Google Drive di notebook, lalu buka daftar ini lagi.",
      "close": "Tutup"
    }
  },
  "en": {
    "auth": {
      "loading": "Starting Auto Clipper…",
      "tagline": "Turn long videos into short clips automatically.",
      "open_login": "Log in to Workspace",
      "login_title": "Log in",
      "login_subtitle": "Enter the access code from the Colab notebook (API_SECRET_TOKEN).",
      "token_placeholder": "Access code",
      "verifying": "Checking…",
      "submit": "Log in",
      "stored_locally": "The access code is stored in this browser only.",
      "close": "Close",
      "discord_title": "Discord Community",
      "discord_badge": "Community",
      "discord_body": "Report bugs, request features, show your content and chat with other clippers.",
      "error_empty": "The access code is empty. Copy API_SECRET_TOKEN from the Colab notebook and paste it here.",
      "error_invalid": "Access code rejected: it does not match the Colab server that is running. Copy API_SECRET_TOKEN from the notebook again and retry.",
      "error_offline": "The Colab server cannot be reached. The notebook is not running or its session ended. Run the notebook again until the server is up, then retry.",
      "error_expired": "The access code is no longer valid, probably because the Colab server restarted with a new code. Enter the code from the notebook again."
    },
    "drive": {
      "title": "Choose a video from Google Drive",
      "go_up": "Up one folder",
      "empty": "This folder has no videos or folders.",
      "load_failed": "The folder could not be loaded. Google Drive may not be connected in Colab. Run the notebook cell that connects Google Drive again, then open this list again.",
      "close": "Close"
    }
  }
}
JSON
```

- [ ] **Step 6: Move AuthGate**

Run: `cp web/src/components/AuthGate.tsx src/components/AuthGate.tsx`. Then in `src/components/AuthGate.tsx` replace lines 1-122 (imports through `if (isAuthenticated) { return <>{children}</>; }`) with:

```tsx
import React, { useState, useEffect } from "react";
import axios from "axios";
import { useTranslation } from "react-i18next";
import { KeyRound, Eye, EyeOff, ShieldCheck, AlertCircle } from "lucide-react";
import { API_URL } from "../platform/backendUrl";
import { getAuthToken, setAuthToken, UNAUTHORIZED_EVENT } from "../platform/auth";
import { AUTH_CHANGED_EVENT, saveCloudToken } from "../platform/cloud";

// Cloud only (Vercel + Colab): asks for the access token the Colab notebook prints.
// Moved from web/src/components/AuthGate.tsx; texts are in src/locales (auth.*).

type AuthErrorKey = "auth.error_empty" | "auth.error_invalid" | "auth.error_offline" | "auth.error_expired";

export interface AuthGateProps {
  children: React.ReactNode;
}

const checkToken = () => axios.get(`${API_URL}/api/settings/whisper-models`);

export const AuthGate: React.FC<AuthGateProps> = ({ children }) => {
  const { t } = useTranslation();
  const [token, setToken] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [errorKey, setErrorKey] = useState<AuthErrorKey | null>(null);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);
  const errorMsg = errorKey ? t(errorKey) : null;

  useEffect(() => {
    if (getAuthToken()) {
      checkToken()
        .then(() => setIsAuthenticated(true))
        .catch((err) => {
          if (err?.response?.status !== 401) setErrorKey("auth.error_offline");
          setIsAuthenticated(false);
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }

    const handleUnauthorized = () => {
      saveCloudToken("");
      setIsAuthenticated(false);
      setErrorKey("auth.error_expired");
    };
    const handleAuthChanged = (e: Event) => {
      if ((e as CustomEvent<{ token: string }>).detail?.token) {
        setIsAuthenticated(true);
        setErrorKey(null);
      } else {
        setIsAuthenticated(false);
      }
    };

    window.addEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);
    window.addEventListener(AUTH_CHANGED_EVENT, handleAuthChanged);
    return () => {
      window.removeEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);
      window.removeEventListener(AUTH_CHANGED_EVENT, handleAuthChanged);
    };
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanToken = token.trim();
    if (!cleanToken) {
      setErrorKey("auth.error_empty");
      return;
    }
    setIsVerifying(true);
    setErrorKey(null);
    // Check the token before saving it, so the app does not open for a moment with a wrong one.
    setAuthToken(cleanToken);
    try {
      await checkToken();
      saveCloudToken(cleanToken);
      setToken("");
    } catch (err: any) {
      saveCloudToken("");
      setErrorKey(err?.response?.status === 401 ? "auth.error_invalid" : "auth.error_offline");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleExternalLink = (
    e: React.MouseEvent<HTMLAnchorElement>,
    url: string,
  ) => {
    e.preventDefault();
    window.open(url, "_blank");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-600">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-purple-600/30 border-t-purple-600 rounded-full animate-spin" />
          <span className="text-xs font-mono">{t("auth.loading")}</span>
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <>{children}</>;
  }
```

Then replace these literals in the rest of the file (each occurs once):

| Find | Replace with |
|---|---|
| `Automated video clipping and transcription.` | `{t("auth.tagline")}` |
| `Login to Workspace` | `{t("auth.open_login")}` |
| `Discord Community` (inside the `<span className="font-semibold …">`) | `{t("auth.discord_title")}` |
| `Community` (inside the small badge `<span className="text-[10px] …">`) | `{t("auth.discord_badge")}` |
| `Report bugs, request features, showcase content & ideas, and` + next line `chat with fellow clippers.` | `{t("auth.discord_body")}` |
| `<h2 className="text-2xl font-bold text-gray-900 mb-2">Login</h2>` | `<h2 className="text-2xl font-bold text-gray-900 mb-2">{t("auth.login_title")}</h2>` |
| `Enter your Colab access token` | `{t("auth.login_subtitle")}` |
| `placeholder="AUTO_CLIPPER_WEB_TOKEN"` | `placeholder={t("auth.token_placeholder")}` |
| `<span>Verifying...</span>` | `<span>{t("auth.verifying")}</span>` |
| `<span>Unlock</span>` | `<span>{t("auth.submit")}</span>` |
| `<span>Token is stored locally</span>` | `<span>{t("auth.stored_locally")}</span>` |
| `onClick={() => setIsLoginModalOpen(false)}` | `onClick={() => setIsLoginModalOpen(false)}` + new attribute `aria-label={t("auth.close")}` on the same `<button>` |

Check: `git grep -nE ">[^<{]*[A-Za-z]{3,}[^<{]*<" src/components/AuthGate.tsx` prints only brand names (`Auto Clipper`, `TikTok`, `YouTube`, `Instagram`, `GitHub`, `Facebook`, `Trakteer`).

- [ ] **Step 7: Move the Drive browser**

Run: `cp web/src/components/GDriveBrowserModal.tsx src/components/GDriveBrowserModal.tsx`. In the new file:
- replace line 10 `import { apiBrowseGDrive, type GDriveItem } from "../api";` with
  ```tsx
  import { useTranslation } from "react-i18next";
  import { apiBrowseGDrive, type GDriveItem } from "../api";
  ```
- first line inside the component body: `const { t } = useTranslation();`
- in `fetchDir`, replace `setError(err.message || "Failed to load directory");` with
  ```tsx
      console.error("Drive browser failed:", err);
      setError(t("drive.load_failed"));
  ```
  and add `t` to its dependency list: `}, [t]);`
- `Browse Google Drive` → `{t("drive.title")}`
- `title="Go up"` → `title={t("drive.go_up")} aria-label={t("drive.go_up")}`
- `Folder is empty` → `{t("drive.empty")}`
- on the close button (`onClick={onClose}` with `<XCircle …/>`) add `aria-label={t("drive.close")}`.

Add to `src/api.ts`:

```ts
export interface GDriveItem {
  name: string;
  is_dir: boolean;
  path: string;
}

export interface GDriveListing {
  items: GDriveItem[];
  current_dir: string;
  parent_dir: string | null;
}

/** A folder of the Colab Google Drive (cloud only). Throws when the backend refuses. */
export const apiBrowseGDrive = async (dirPath?: string): Promise<GDriveListing> => {
  const res = await axios.get(`${API_URL}/gdrive-browser`, { params: dirPath ? { dir_path: dirPath } : {} });
  if (res.data?.status !== "success") throw new Error(res.data?.message || "gdrive-browser failed");
  return { items: res.data.items || [], current_dir: res.data.current_dir || "", parent_dir: res.data.parent_dir ?? null };
};
```

- [ ] **Step 8: Wire the cloud features into the app**

`src/App.tsx`:
- imports: `import { HashRouter, Navigate, Routes, Route } from "react-router-dom";`, `import { AuthGate } from "./components/AuthGate";`, `import { GDriveBrowserModal } from "./components/GDriveBrowserModal";`, `import { platform } from "./platform";`
- `const [showLanding, setShowLanding] = useState(true);` → `const [showLanding, setShowLanding] = useState(() => platform().kind !== "cloud"); // Cloud: AuthGate is the landing page`
- after the `pendingLocalUpload` state: `const [driveBrowserOpen, setDriveBrowserOpen] = useState(false);`
- in `contextValue`, after `clearPendingLocalUpload: …,`: `requestDriveBrowser: () => setDriveBrowserOpen(true),`
- add above `export default function App()`:

```tsx
/** The sign-in step of each platform: the one place that checks the platform kind. */
function gate(content: React.ReactNode): React.ReactNode {
  return platform().kind === "cloud" ? <AuthGate>{content}</AuthGate> : content;
}
```

- replace the `return ( <AppContext.Provider …> … </AppContext.Provider> );` block (lines 279-303) with:

```tsx
  const routes = showLanding ? (
    <LandingPage onEnter={() => setShowLanding(false)} />
  ) : (
    <Routes>
      <Route path="/" element={<AppLayout />}>
        {/* Cloud has no API-key providers: start on the manual AI page. */}
        <Route index element={platform().caps.apiKeys ? <WorkspacePage /> : <Navigate to="/manual-ai" replace />} />
        <Route path="manual-ai" element={<ManualAIEditorPage />} />
        <Route path="downloader" element={<ManualDownloaderPage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="help" element={<HelpPage />} />
      </Route>
    </Routes>
  );

  return (
    <AppContext.Provider value={contextValue}>
      <HashRouter>
        <Toasts toasts={toasts} />
        {cookiesModal && (
          <CookiesModal onClose={() => setCookiesModal(null)} onRetry={cookiesModal.onRetry} />
        )}
        {platform().caps.driveBrowser && (
          <GDriveBrowserModal
            isOpen={driveBrowserOpen}
            onClose={() => setDriveBrowserOpen(false)}
            onSelectFile={(filePath) => {
              setDriveBrowserOpen(false);
              setInputType("url");
              setUrl(`local:${filePath}`);
            }}
          />
        )}
        {gate(routes)}
      </HashRouter>
    </AppContext.Provider>
  );
```

`src/components/GenerateForm.tsx`: add `HardDrive` to the existing `lucide-react` import, add `import { platform } from "../platform";`, and right after the `<input ref={localFileInput} type="file" … />` element (inside the same `<div className="space-y-2">`) insert:

```tsx
            {platform().caps.driveBrowser && (
              <Button variant="outline" icon={HardDrive} onClick={() => ctx.requestDriveBrowser()}>
                {t("action.pick_from_drive", "Pilih video dari Google Drive")}
              </Button>
            )}
```

`src/components/sidebar/Sidebar.tsx`: wrap the first `<NavLink to="/" …>…</NavLink>` (the "AI Clipper" entry, lines 48-61) in `{platform().caps.apiKeys && ( … )}`.

`src/pages/SettingsPage.tsx`: add `import { platform } from '../platform';`, `const caps = platform().caps;` after `const ctx = …`, wrap `<ProviderSection … />` in `{caps.apiKeys && ( … )}` and `<UpdaterSection />` in `{caps.updater && <UpdaterSection />}`.

`src/components/CookiesPanel.tsx`: add `import { platform } from "../platform";` and replace lines 218-220 with

```tsx
        <p className="text-caption text-text-secondary m-0">
          {/* Only Colab has a Drive browser, and there the app data folder is the user's Google Drive. */}
          {platform().caps.driveBrowser
            ? t("cookies.privacy_cloud")
            : t("cookies.privacy", "File disimpan di komputer ini dan hanya dipakai saat mengunduh video.")}
        </p>
```

- [ ] **Step 9: Cloud build settings**

`.env.cloud`:

```
# Used by `vite build --mode cloud` (npm run build:cloud): the Vercel app for the Colab backend.
VITE_TARGET=cloud
```

In `package.json` scripts, after `"build"`: `"build:cloud": "tsc && vite build --mode cloud",`

`vercel.json` (repo root):

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "vite",
  "installCommand": "npm ci",
  "buildCommand": "npm run build:cloud",
  "outputDirectory": "dist"
}
```

Vercel settings the owner sets in the project (Task 14 puts them in the tutorial): **Root Directory** empty (repo root), **Node.js Version** 22.x, environment variable **`VITE_API_URL`** unchanged. Framework, install, build and output come from `vercel.json`. See plan question 1 for when to change the production project.

- [ ] **Step 10: Run the checks**

Run: `npx vitest run` → all pass. Run: `npm run build` → exit 0. Run: `npm run build:cloud` → exit 0, `dist/index.html` exists. Run: `npx oxlint src` → 0 errors.

- [ ] **Step 11: Browser check of the cloud build**

Window 1 (backend in cloud mode):

```powershell
$env:AUTO_CLIPPER_CLOUD_MODE = "1"; $env:AUTO_CLIPPER_WEB_TOKEN = "test-token"; $env:AUTO_CLIPPER_WORKSPACE = "$env:TEMP\ac-sp1-cloud"
C:\Users\dhima\projects\ac-venv\Scripts\python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

Window 2: `$env:VITE_API_URL = "http://127.0.0.1:8000"; npm run dev -- --mode cloud`, open `http://localhost:5173`.

Expected: AuthGate (no landing page). Token `wrong` → the `auth.error_invalid` text. Token `test-token` → app opens on Manual AI Editor; sidebar has no "AI Clipper"; Settings has no provider section and no updater; the cookies note names Google Drive; on the local-file tab "Pilih video dari Google Drive" opens the Drive browser, which shows `drive.empty` (no `/content/drive` on Windows). Record in the progress log.

- [ ] **Step 12: Commit**

```bash
git add src .env.cloud vercel.json package.json tasks/PROGRESS-LOG.md
git commit -m "$(cat <<'EOF'
feat(sp1): cloud adapter with AuthGate and Drive browser; VITE_TARGET=cloud build

AuthGate and GDriveBrowserModal move from web/ with their texts in
src/locales. Cloud starts on the manual AI page, hides API-key settings and
the updater. npm run build:cloud and vercel.json build the Vercel app from
the repo root.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Error-card actions per platform

Resolves SP0 open decision no. 8: `upload_video` opens the Drive browser in cloud and the file picker on desktop/local; `open_settings` (points at the API key) has no button when `!caps.apiKeys`.

**Files:**
- Create: `src/lib/errorActions.ts`
- Test: `src/lib/errorActions.test.ts`
- Modify: `src/hooks/useErrorActions.ts`, `src/components/ErrorCard.tsx:39-44`

**Interfaces:**
- Consumes: `Caps`, `CAPS` (Task 2), `platform()` (Task 3), `ctx.requestDriveBrowser` (Task 5), `ActionHandlers`, `visibleActions` (existing `src/lib/errorInfo.ts`).
- Produces: `errorActionHandlers(caps: Caps, deps: ErrorActionDeps): ActionHandlers`, `actionLabels(caps: Caps, t: (key: string, fallback: string) => string): Partial<Record<string, string>>`, `ErrorActionDeps { resume?; rerun?; openCookies(onRetry?); uploadVideo(); openDriveBrowser(); openSettings() }`. `useErrorActions(options)` keeps its signature and return type (`ActionHandlers`), so its five call sites do not change.

- [ ] **Step 1: Write the failing test**

`src/lib/errorActions.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { CAPS } from "../platform/caps";
import { actionLabels, errorActionHandlers } from "./errorActions";
import { asErrorInfo, visibleActions } from "./errorInfo";

function deps() {
  return {
    resume: vi.fn(),
    rerun: vi.fn(),
    openCookies: vi.fn(),
    uploadVideo: vi.fn(),
    openDriveBrowser: vi.fn(),
    openSettings: vi.fn(),
  };
}

const INFO = asErrorInfo({
  code: "UPLOAD_MISSING",
  title: "File video yang diunggah sudah tidak ada",
  message: "Unggah videonya lagi.",
  title_en: "The uploaded video is gone",
  message_en: "Upload the video again.",
  actions: [
    { id: "upload_video", label: "Unggah file video", label_en: "Upload a video file" },
    { id: "open_settings", label: "Buka Pengaturan", label_en: "Open Settings" },
    { id: "upload_cookies", label: "Unggah cookies.txt", label_en: "Upload cookies.txt" },
  ],
  technical: "",
})!;

const t = (key: string, fallback: string) => (key === "action.pick_from_drive" ? "Pilih video dari Google Drive" : fallback);

describe("errorActionHandlers", () => {
  it.each(["desktop", "local"] as const)("%s: upload_video picks a file, open_settings opens Settings", (kind) => {
    const d = deps();
    const handlers = errorActionHandlers(CAPS[kind], d);
    handlers.upload_video!();
    handlers.open_settings!();
    expect(d.uploadVideo).toHaveBeenCalledOnce();
    expect(d.openDriveBrowser).not.toHaveBeenCalled();
    expect(d.openSettings).toHaveBeenCalledOnce();
  });

  it("cloud: upload_video opens the Drive browser and open_settings has no button", () => {
    const d = deps();
    const handlers = errorActionHandlers(CAPS.cloud, d);
    handlers.upload_video!();
    expect(d.openDriveBrowser).toHaveBeenCalledOnce();
    expect(d.uploadVideo).not.toHaveBeenCalled();
    expect(handlers.open_settings).toBeUndefined();
    const ids = visibleActions(INFO, handlers, "id", actionLabels(CAPS.cloud, t)).map((a) => [a.id, a.label]);
    expect(ids).toEqual([
      ["upload_video", "Pilih video dari Google Drive"],
      ["upload_cookies", "Unggah cookies.txt"],
    ]);
  });

  it("upload_cookies hands the rerun step to the cookies dialog; retry and resume run the job again", () => {
    const d = deps();
    const handlers = errorActionHandlers(CAPS.desktop, d);
    handlers.upload_cookies!();
    expect(d.openCookies).toHaveBeenCalledWith(d.rerun);
    expect(handlers.retry).toBe(d.rerun);
    expect(handlers.resume).toBe(d.resume);
  });

  it("keeps the backend labels outside cloud", () => {
    expect(actionLabels(CAPS.desktop, t)).toEqual({});
    expect(actionLabels(CAPS.local, t)).toEqual({});
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/lib/errorActions.test.ts`
Expected: FAIL, "Failed to resolve import ./errorActions".

- [ ] **Step 3: Write the mapping**

`src/lib/errorActions.ts`:

```ts
import type { Caps } from "../platform/types";
import type { ActionHandlers } from "./errorInfo";

// What the action buttons of an error card do on each platform
// (ids from backend/errors.py `_ACTIONS`). No React here.

export interface ErrorActionDeps {
  /** Resume the failed job, when there is one. */
  resume?: () => void;
  /** Run the failed step again (the job, or e.g. the quality check). */
  rerun?: () => void;
  openCookies: (onRetry?: () => void) => void;
  /** Pick a video file on this computer. */
  uploadVideo: () => void;
  /** Pick a video from Google Drive (cloud). */
  openDriveBrowser: () => void;
  openSettings: () => void;
}

export function errorActionHandlers(caps: Caps, deps: ErrorActionDeps): ActionHandlers {
  const handlers: ActionHandlers = {
    upload_cookies: () => deps.openCookies(deps.rerun),
    // Cloud takes videos from Google Drive; desktop and local from this computer.
    upload_video: caps.driveBrowser ? deps.openDriveBrowser : deps.uploadVideo,
    retry: deps.rerun,
    resume: deps.resume,
  };
  // open_settings points at the API key; without API keys there is nothing to open.
  if (caps.apiKeys) handlers.open_settings = deps.openSettings;
  return handlers;
}

/** Labels that replace the backend's, where this platform does something more specific. */
export function actionLabels(caps: Caps, t: (key: string, fallback: string) => string): Partial<Record<string, string>> {
  return caps.driveBrowser ? { upload_video: t("action.pick_from_drive", "Pilih video dari Google Drive") } : {};
}
```

- [ ] **Step 4: Use it**

Replace the body of `useErrorActions` in `src/hooks/useErrorActions.ts` (keep the options interface and doc comment; update the comment's first line to "What the action buttons of an error do in this app, per platform"):

```ts
import { useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AppContext } from "../App";
import { platform } from "../platform";
import { errorActionHandlers } from "../lib/errorActions";
import type { ActionHandlers } from "../lib/errorInfo";

// (ErrorActionOptions interface unchanged)

export function useErrorActions(options: ErrorActionOptions = {}): ActionHandlers {
  const ctx = useContext(AppContext);
  const navigate = useNavigate();
  const { jobId, origin = "history", onRetry, onUploadVideo } = options;

  const resume = jobId ? () => ctx.handleResumeJob(jobId, origin) : undefined;

  return errorActionHandlers(platform().caps, {
    resume,
    rerun: onRetry ?? resume,
    openCookies: (retry) => ctx.openCookies(retry),
    uploadVideo:
      onUploadVideo ??
      (() => {
        ctx.requestLocalUpload();
        navigate("/");
      }),
    openDriveBrowser: () => {
      ctx.requestDriveBrowser();
      navigate("/");
    },
    openSettings: () => navigate("/settings"),
  });
}
```

`src/components/ErrorCard.tsx`: add imports `import { platform } from "../platform";` and `import { actionLabels } from "../lib/errorActions";`, and replace line 44 `const actions = visibleActions(info, handlers, lang);` with

```tsx
  const actions = visibleActions(info, handlers, lang, actionLabels(platform().caps, (key, fallback) => t(key, fallback)));
```

- [ ] **Step 5: Run the checks**

Run: `npx vitest run` → all pass. Run: `npm run build`, `npm run build:cloud` → exit 0. Run: `npx oxlint src` → 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src tasks/PROGRESS-LOG.md
git commit -m "$(cat <<'EOF'
feat(sp1): error-card actions per platform

upload_video opens the Drive browser on Colab and the file picker elsewhere;
open_settings has no button without API keys. Closes SP0 open decision 8.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Backend: video signing key and signatures

Spec 4.5. This task only adds the signing module and protects the key file; `/video` starts using it in Task 8.

**Files:**
- Create: `backend/video_sign.py`
- Test: `backend/tests/test_video_sign.py`
- Modify: `backend/path_guard.py` (module docstring, new `_PRIVATE_FILE_PREFIXES`, `_protected_name`)

**Interfaces:**
- Consumes: `backend.logger.get_app_data_dir()`, `backend.logger.log_error(context, err, exc_info=...)`, `backend.drive_mount.library_unavailable()`, `backend.drive_mount.local_dir()`.
- Produces (`backend/video_sign.py`):
  - `KEY_FILE_NAME = "video_signing.key"`, `KEY_BYTES = 32`
  - `key_path() -> str` (app data folder; `drive_mount.local_dir()` while the Colab library is on an unmounted Drive)
  - `load_key() -> bytes` (reads the file; creates it once with 32 random bytes, mode 0600; nothing kept in memory)
  - `canonical_path(path: str) -> str` (`normcase(realpath(abspath(path)))`)
  - `sign(path: str) -> str` (64 hex chars, `HMAC_SHA256(key, canonical_path(path))`)
  - `verify(path: str, sig: Optional[str]) -> bool` (never raises)
  - `signed_url(path: str) -> str` (relative: `/video?path=<urlencoded>&sig=<hex>`)
  - `with_video_urls(clips)` (copies of clip dicts with `video_url`; anything that is not a list is returned as is)
- Produces (`backend/path_guard.py`): `_PRIVATE_FILE_PREFIXES = ("video_signing.key",)`; Task 11 adds `"web_instance.json"`.

- [ ] **Step 1: Write the failing tests**

`backend/tests/test_video_sign.py`:

```python
"""Signed /video links: the key file and the signatures (SP1, spec 4.5).

sig = HMAC_SHA256(key, canonical path), no expiry. The 32-byte key lives in
the app data folder as video_signing.key, is created once, and is read from
the file on every use, so links survive a restart and deleting the file
cancels every old link.
"""
import hashlib
import hmac
import importlib
import os
import sys
from urllib.parse import parse_qs, urlsplit

import pytest

from backend import drive_mount, path_guard, video_sign


@pytest.fixture
def library(tmp_path, monkeypatch):
    lib = tmp_path / "library"
    monkeypatch.setenv("AUTO_CLIPPER_WORKSPACE", str(lib))
    monkeypatch.delenv("AUTO_CLIPPER_CLOUD_MODE", raising=False)
    return lib


def test_key_is_32_random_bytes_created_once_in_the_app_data_folder(library):
    first = video_sign.load_key()
    second = video_sign.load_key()

    key_file = library / "video_signing.key"
    assert video_sign.key_path() == str(key_file)
    assert len(first) == 32
    assert first == second == key_file.read_bytes()


def test_each_library_gets_its_own_random_key(tmp_path, monkeypatch):
    monkeypatch.setenv("AUTO_CLIPPER_WORKSPACE", str(tmp_path / "a"))
    a = video_sign.load_key()
    monkeypatch.setenv("AUTO_CLIPPER_WORKSPACE", str(tmp_path / "b"))

    assert video_sign.load_key() != a


@pytest.mark.skipif(sys.platform == "win32", reason="POSIX file modes")
def test_key_file_is_readable_by_its_owner_only(library):
    video_sign.load_key()

    assert (library / "video_signing.key").stat().st_mode & 0o077 == 0


def test_a_key_file_of_the_wrong_size_is_replaced(library):
    library.mkdir(parents=True)
    (library / "video_signing.key").write_bytes(b"short")

    key = video_sign.load_key()

    assert len(key) == 32
    assert (library / "video_signing.key").read_bytes() == key


def test_signature_is_hmac_sha256_of_the_canonical_path(library):
    clip = str(library / "clips" / "clip_1.mp4")
    expected = hmac.new(video_sign.load_key(), video_sign.canonical_path(clip).encode("utf-8"), hashlib.sha256).hexdigest()

    assert video_sign.sign(clip) == expected
    assert len(expected) == 64


def test_verify_accepts_the_right_signature_and_refuses_everything_else(library):
    a = str(library / "clips" / "a.mp4")
    b = str(library / "clips" / "b.mp4")
    sig_a = video_sign.sign(a)

    assert video_sign.verify(a, sig_a)
    assert video_sign.verify(a, sig_a.upper())
    assert not video_sign.verify(b, sig_a)  # the link of file A does not open file B
    assert not video_sign.verify(a, "")
    assert not video_sign.verify(a, None)
    assert not video_sign.verify(a, "0" * 64)
    assert not video_sign.verify(a, "é" * 64)
    assert not video_sign.verify("", sig_a)


def test_the_same_file_written_another_way_has_the_same_signature(library):
    plain = os.path.join(str(library), "clips", "a.mp4")
    roundabout = os.path.join(str(library), "projects", "..", "clips", ".", "a.mp4")

    assert video_sign.verify(roundabout, video_sign.sign(plain))


def test_links_stay_valid_after_a_restart(library):
    path = str(library / "clips" / "a.mp4")
    sig = video_sign.sign(path)

    importlib.reload(video_sign)  # nothing is kept in memory: the key comes from the file

    assert video_sign.verify(path, sig)


def test_deleting_the_key_file_cancels_every_old_link(library):
    path = str(library / "clips" / "a.mp4")
    sig = video_sign.sign(path)

    os.remove(video_sign.key_path())

    assert not video_sign.verify(path, sig)
    assert video_sign.verify(path, video_sign.sign(path))


def test_key_stays_off_an_unmounted_google_drive(tmp_path, monkeypatch):
    local = tmp_path / "local"
    monkeypatch.setattr(drive_mount, "library_unavailable", lambda: True)
    monkeypatch.setattr(drive_mount, "local_dir", lambda: str(local))

    video_sign.load_key()

    assert video_sign.key_path() == str(local / "video_signing.key")
    assert (local / "video_signing.key").exists()


def test_signed_url_is_a_relative_video_link_with_path_and_sig(library):
    path = str(library / "clips" / "klip satu & dua.mp4")

    url = video_sign.signed_url(path)

    assert url.startswith("/video?")
    assert parse_qs(urlsplit(url).query) == {"path": [path], "sig": [video_sign.sign(path)]}


def test_with_video_urls_adds_links_to_copies_only(library):
    clips = [{"path": str(library / "c1.mp4"), "v": 0}, {"description": "no file yet"}, "junk"]

    out = video_sign.with_video_urls(clips)

    assert out[0]["video_url"] == video_sign.signed_url(clips[0]["path"])
    assert out[0]["v"] == 0
    assert "video_url" not in clips[0]  # history.db and the running job never get a link
    assert out[1] == {"description": "no file yet"}
    assert out[2] == "junk"
    assert video_sign.with_video_urls(None) is None


def test_with_video_urls_leaves_clips_without_links_when_signing_fails(library, monkeypatch):
    def broken():
        raise OSError("disk gone")

    logged = []
    monkeypatch.setattr(video_sign, "load_key", broken)
    monkeypatch.setattr(video_sign, "log_error", lambda *a, **k: logged.append(a))

    assert video_sign.with_video_urls([{"path": "x.mp4"}]) == [{"path": "x.mp4"}]
    assert logged


def test_path_guard_protects_the_key_file_and_its_temp_copies(library):
    assert path_guard.is_protected(str(library / "video_signing.key"))
    assert path_guard.is_protected(str(library / "VIDEO_SIGNING.KEY"))
    assert path_guard.is_protected(str(library / "video_signing.key.1a2b3c4d.part"))
    assert not path_guard.is_protected(str(library / "clips" / "clip_1.mp4"))
```

- [ ] **Step 2: Run them to see them fail**

Run: `C:\Users\dhima\projects\ac-venv\Scripts\python.exe -m pytest backend/tests/test_video_sign.py -q -p no:cacheprovider`
Expected: FAIL at collection, `ImportError: cannot import name 'video_sign' from 'backend'`.

- [ ] **Step 3: Write `backend/video_sign.py`**

```python
"""Signed links for GET /video (SP1, spec 4.5, ADR-013).

The <video> player cannot send the Authorization header, so /video is not
behind the API token. Instead every link carries ``sig``:

    sig = HMAC_SHA256(key, canonical path)   (hex, no expiry)

A link opens exactly one file, for as long as the key file exists. The key is
32 random bytes in the app data folder (``video_signing.key``; on Colab that
is the user's Google Drive, so links survive a new session), created once and
read from the file on every use: nothing is kept in memory, links stay valid
after a restart, and deleting the file cancels every old link. path_guard
refuses the key file to every endpoint.

Links are added to clip data when it is read (``with_video_urls``), never
stored in history.db.
"""
import hashlib
import hmac
import os
import secrets
import threading
from typing import Optional
from urllib.parse import urlencode

from backend import drive_mount
from backend.logger import get_app_data_dir, log_error

KEY_FILE_NAME = "video_signing.key"
KEY_BYTES = 32

_create_lock = threading.Lock()


def key_path() -> str:
    """Where the key lives. While the Colab library is on an unmounted Drive it stays on this machine (E.16)."""
    folder = drive_mount.local_dir() if drive_mount.library_unavailable() else get_app_data_dir()
    return os.path.join(folder, KEY_FILE_NAME)


def _read_key(path: str) -> Optional[bytes]:
    try:
        with open(path, "rb") as f:
            data = f.read()
    except FileNotFoundError:
        return None
    if len(data) != KEY_BYTES:
        log_error("video_sign.load_key", f"{KEY_FILE_NAME} has {len(data)} bytes instead of {KEY_BYTES}; making a new key", exc_info=False)
        return None
    return data


def _write_key(path: str, key: bytes) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    temp = f"{path}.{secrets.token_hex(4)}.part"
    fd = os.open(temp, os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_BINARY", 0), 0o600)
    with os.fdopen(fd, "wb") as f:
        f.write(key)
        f.flush()
        os.fsync(f.fileno())
    os.replace(temp, path)


def load_key() -> bytes:
    """The signing key, created on first use."""
    path = key_path()
    key = _read_key(path)
    if key is not None:
        return key
    with _create_lock:
        key = _read_key(path)
        if key is None:
            key = secrets.token_bytes(KEY_BYTES)
            _write_key(path, key)
        return key


def canonical_path(path: str) -> str:
    """One spelling per file: absolute, symlinks and ``..`` resolved, case folded where the OS ignores case."""
    return os.path.normcase(os.path.realpath(os.path.abspath(path)))


def sign(path: str) -> str:
    return hmac.new(load_key(), canonical_path(path).encode("utf-8"), hashlib.sha256).hexdigest()


def verify(path: str, sig: Optional[str]) -> bool:
    """True when ``sig`` was made for this file with the current key. Never raises."""
    if not path or not sig or not sig.isascii():
        return False
    try:
        expected = sign(path)
    except Exception as e:  # unreadable key or path: refuse
        log_error("video_sign.verify", e)
        return False
    return hmac.compare_digest(expected, sig.strip().lower())


def signed_url(path: str) -> str:
    """The relative link the frontend puts after the backend address."""
    return "/video?" + urlencode({"path": path, "sig": sign(path)})


def with_video_urls(clips):
    """Copies of ``clips`` with a signed ``video_url`` on every clip that has a path.

    The input is not changed, so the running job and history.db never hold a
    link. A clip that cannot be signed is returned without a link; the
    frontend then asks POST /video-url for one.
    """
    if not isinstance(clips, list):
        return clips
    result = []
    for clip in clips:
        if isinstance(clip, dict) and isinstance(clip.get("path"), str) and clip["path"]:
            clip = dict(clip)
            try:
                clip["video_url"] = signed_url(clip["path"])
            except Exception as e:
                log_error("video_sign.with_video_urls", e)
        result.append(clip)
    return result
```

- [ ] **Step 4: Protect the key file in `backend/path_guard.py`**

In the module docstring, replace the first paragraph's list

```
The stored cookies.txt (a YouTube login) and its working copies, the job
history database with its snapshot and SQLite side files, and the backend logs
sit next to the clips in the app data folder, which on Colab is the user's
Google Drive.
```

with

```
The stored cookies.txt (a YouTube login) and its working copies, the job
history database with its snapshot and SQLite side files, the backend logs and
the key that signs /video links (video_signing.key) sit next to the clips in
the app data folder, which on Colab is the user's Google Drive.
```

After `_LOG_PREFIXES = (...)` add:

```python
# video_signing.key (signs /video links, backend.video_sign) and its temp copies while it is written
_PRIVATE_FILE_PREFIXES = ("video_signing.key",)
```

and replace `_protected_name` with:

```python
def _protected_name(name: str) -> bool:
    name = name.lower().lstrip(".")
    return name.startswith(_DB_PREFIX) or name.startswith(_LOG_PREFIXES) or name.startswith(_PRIVATE_FILE_PREFIXES)
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `C:\Users\dhima\projects\ac-venv\Scripts\python.exe -m pytest backend/tests/test_video_sign.py -q -p no:cacheprovider`
Expected: 13 passed, 1 skipped (the POSIX file-mode test on Windows).

Run: `C:\Users\dhima\projects\ac-venv\Scripts\python.exe -m pytest backend/tests -q -p no:cacheprovider`
Expected: 707 passed, 8 skipped.

- [ ] **Step 6: Commit**

```bash
git add backend/video_sign.py backend/tests/test_video_sign.py backend/path_guard.py tasks/PROGRESS-LOG.md
git commit -m "$(cat <<'EOF'
feat(sp1): signing key and HMAC signatures for /video links

video_signing.key (32 random bytes) is created once in the app data folder,
or on this machine while the Colab Drive is not mounted. sig is
HMAC_SHA256(key, canonical path) with no expiry. path_guard refuses the key
file. /video does not use it yet (next task).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Backend: `/video` requires `sig`, `POST /video-url`, signed links in clip data

Spec 4.5 and the T0.19 finding. After this task the old `web/` app can no longer play clips (it builds unsigned `/video` links); `web/` is deleted in Task 14 and is not deployed from this branch, so nothing breaks for users.

**Files:**
- Modify: `backend/main.py` (imports at the top, `verify_token` line 129, `api_get_job` line 781, `api_get_history` lines 836-838, `get_video` lines 949-1001, new `VideoUrlRequest` + `api_video_url` after `get_video`)
- Test: `backend/tests/test_video_links.py` (new)
- Modify tests that call `/video` and expect a file: `backend/tests/test_protected_paths.py:113-118`, `backend/tests/test_main.py:139-144`, `backend/tests/test_workspace.py:941-968`

**Interfaces:**
- Consumes (Task 7): `video_sign.verify(path, sig)`, `video_sign.signed_url(path)`, `video_sign.with_video_urls(clips)`, `video_sign.sign(path)`, `video_sign.key_path()`; `path_guard.DENIED_MESSAGE`, `path_guard.denied`, `path_guard.is_protected`.
- Produces (HTTP contract used by Task 9 and the cloud/local adapters):
  - `GET /video?path=<p>&sig=<hex>[&dl=1][&v=<n>][&title=<t>]`: 403 `{"status":"error","message":"Access denied"}` for a protected path (checked first) or a missing/wrong `sig`; then the existing folder and `.mp4` checks. Never needs the API token.
  - `POST /video-url` body `{"path": str}` (a `local:` prefix is dropped) → 200 `{"status":"success","video_url":"/video?path=…&sig=…"}`; 400 for an empty path; 403 for a protected path. Needs the API token wherever tokens are checked.
  - `GET /jobs/{id}`: every item of `clips` with a `path` gains `video_url` (relative, signed).
  - `GET /history`: every item of each entry's `result_clips` with a `path` gains `video_url`.
  - `verify_token` exempts exactly `path == "/video"` (was `startswith("/video")`, which also exempted `/video-url`).

- [ ] **Step 1: Write the failing tests**

`backend/tests/test_video_links.py`:

```python
"""/video needs a signed link on every platform; clip data carries the links (SP1, spec 4.5).

The player cannot send the API token, so /video checks ``sig`` instead. The
token-protected POST /video-url signs any other path, and GET /jobs/{id} and
GET /history add ``video_url`` to each clip when they are read. history.db
never stores a link.
"""
import importlib
import sqlite3
from urllib.parse import parse_qs, urlsplit

import pytest
from fastapi.testclient import TestClient

from backend import db, jobs, main, video_sign

client = TestClient(main.app)

DENIED = {"status": "error", "message": "Access denied"}


@pytest.fixture
def library(tmp_path, monkeypatch):
    lib = tmp_path / "library"
    monkeypatch.setenv("AUTO_CLIPPER_WORKSPACE", str(lib))
    monkeypatch.delenv("AUTO_CLIPPER_WORK_DIR", raising=False)
    monkeypatch.delenv("AUTO_CLIPPER_CLOUD_MODE", raising=False)
    clips = lib / "projects" / "Talk" / "clips"
    clips.mkdir(parents=True)
    (clips / "clip_1.mp4").write_bytes(b"clip one")
    (clips / "clip_2.mp4").write_bytes(b"clip two")
    return lib


def _clip(library, n=1) -> str:
    return str(library / "projects" / "Talk" / "clips" / f"clip_{n}.mp4")


# --- GET /video --------------------------------------------------------------------------------

def test_video_without_a_signature_is_refused(library):
    r = client.get("/video", params={"path": _clip(library)})

    assert (r.status_code, r.json()) == (403, DENIED)


def test_video_with_a_wrong_signature_is_refused(library):
    r = client.get("/video", params={"path": _clip(library), "sig": "0" * 64})

    assert (r.status_code, r.json()) == (403, DENIED)


def test_the_signature_of_one_clip_does_not_open_another(library):
    r = client.get("/video", params={"path": _clip(library, 2), "sig": video_sign.sign(_clip(library, 1))})

    assert r.status_code == 403
    assert b"clip two" not in r.content


def test_a_signed_link_plays_the_clip(library):
    r = client.get(video_sign.signed_url(_clip(library)))

    assert r.status_code == 200
    assert r.content == b"clip one"
    assert r.headers["content-disposition"].startswith("inline")


def test_a_signed_link_with_dl_1_downloads_the_clip(library):
    r = client.get(video_sign.signed_url(_clip(library)) + "&dl=1&v=3")

    assert r.status_code == 200
    assert r.content == b"clip one"
    assert r.headers["content-disposition"].startswith("attachment")


def test_a_signed_link_still_works_after_a_restart(library):
    url = video_sign.signed_url(_clip(library))

    importlib.reload(video_sign)

    assert client.get(url).status_code == 200


def test_a_signed_link_to_a_protected_file_is_still_refused(library):
    cookies = library / "cookies" / "cookies.mp4"
    cookies.parent.mkdir()
    cookies.write_bytes(b"secret cookies")
    video_sign.load_key()

    for path in (str(cookies), video_sign.key_path()):
        r = client.get(video_sign.signed_url(path))
        assert (r.status_code, r.json()) == (403, DENIED)
        assert b"secret" not in r.content


# --- POST /video-url ---------------------------------------------------------------------------

def test_video_url_signs_a_path_and_the_link_plays(library):
    r = client.post("/video-url", json={"path": _clip(library)})

    assert r.status_code == 200
    assert r.json()["status"] == "success"
    assert client.get(r.json()["video_url"]).content == b"clip one"


def test_video_url_drops_the_local_prefix(library):
    r = client.post("/video-url", json={"path": "local:" + _clip(library)})

    assert parse_qs(urlsplit(r.json()["video_url"]).query)["path"] == [_clip(library)]


def test_video_url_refuses_protected_paths(library):
    r = client.post("/video-url", json={"path": str(library / "history.db")})

    assert (r.status_code, r.json()) == (403, DENIED)


def test_video_url_needs_a_path(library):
    assert client.post("/video-url", json={"path": ""}).status_code == 400


def test_video_url_needs_the_token_where_tokens_are_checked_but_video_does_not(library, monkeypatch):
    monkeypatch.setenv("AUTO_CLIPPER_CLOUD_MODE", "1")
    monkeypatch.setenv("AUTO_CLIPPER_WEB_TOKEN", "tok")

    assert client.post("/video-url", json={"path": _clip(library)}).status_code == 401
    ok = client.post("/video-url", json={"path": _clip(library)}, headers={"Authorization": "Bearer tok"})
    assert ok.status_code == 200
    assert client.get(ok.json()["video_url"]).status_code == 200  # the player sends no header


# --- links in clip data ------------------------------------------------------------------------

def test_job_status_carries_signed_links_without_changing_the_job(library):
    job_id = "signed-links"
    jobs.active_jobs[job_id] = {
        "id": job_id, "status": "DONE", "progress": "",
        "clips": [{"path": _clip(library), "v": 1}], "failed": 0, "error": None,
    }

    body = client.get(f"/jobs/{job_id}").json()

    assert body["clips"][0]["video_url"] == video_sign.signed_url(_clip(library))
    assert body["clips"][0]["v"] == 1
    assert "video_url" not in jobs.active_jobs[job_id]["clips"][0]


def test_history_carries_signed_links_that_are_never_stored(library):
    db.init_db()
    db.save_history("signed-history", "https://youtu.be/x", "DONE", [{"path": _clip(library)}], {})

    history = client.get("/history").json()["history"]

    entry = next(h for h in history if h["id"] == "signed-history")
    assert entry["result_clips"][0]["video_url"] == video_sign.signed_url(_clip(library))
    conn = sqlite3.connect(db.get_db_path())
    try:
        stored = conn.execute("SELECT result_clips FROM history WHERE id=?", ("signed-history",)).fetchone()[0]
    finally:
        conn.close()
    assert "video_url" not in stored
    assert "sig=" not in stored
```

- [ ] **Step 2: Run them to see them fail**

Run: `C:\Users\dhima\projects\ac-venv\Scripts\python.exe -m pytest backend/tests/test_video_links.py -q -p no:cacheprovider`
Expected: FAIL. The unsigned and wrong-signature requests get 200 instead of 403, `/video-url` answers 404/405, and the clip data has no `video_url`.

- [ ] **Step 3: Change `backend/main.py`**

Imports (after `from backend.errors import AppError`, line 12):

```python
from backend import video_sign
```

`verify_token`, replace lines 127-130:

```python
    # Biarkan endpoint tertentu tanpa token (video player tidak bisa mengirim header dengan mudah)
    path = request.url.path
    if request.method == "OPTIONS" or path.startswith("/video") or path in ["/health", "/heartbeat"]:
        return await call_next(request)
```

with

```python
    # /video carries its own signature (backend.video_sign) because the player cannot send a header.
    # Exactly "/video": a prefix match would also open /video-url.
    path = request.url.path
    if request.method == "OPTIONS" or path == "/video" or path in ["/health", "/heartbeat"]:
        return await call_next(request)
```

`api_get_job`, replace `"clips": job["clips"],` with

```python
        # Signed /video links, made now and never stored (spec 4.5).
        "clips": video_sign.with_video_urls(job["clips"]),
```

`api_get_history`, replace the function with

```python
@app.get("/history")
def api_get_history():
    history = get_all_history()
    for entry in history:
        # Signed /video links, made now and never stored in history.db (spec 4.5).
        entry["result_clips"] = video_sign.with_video_urls(entry["result_clips"])
    return {"status": "success", "history": history}
```

`get_video`, replace the signature, docstring and the guard at the top (lines 949-961):

```python
@app.get("/video")
def get_video(path: str, dl: int = 0, title: str = None):
    """Serve a generated clip so the frontend can preview it inline.

    Restricted to existing .mp4 files. Starlette's
    FileResponse handles HTTP Range requests, so seeking works in the player.
    """
    from backend.logger import log_app
    from backend.path_guard import denied, is_protected

    # Before anything that could tell whether the file exists.
    if is_protected(path):
        return denied("video", path)
```

with

```python
@app.get("/video")
def get_video(path: str, sig: str = "", dl: int = 0, title: str = None):
    """Serve a generated clip so the frontend can preview or download it.

    Needs ``sig`` from backend.video_sign instead of the API token, on every
    platform: the <video> player cannot send headers. Links come with the clip
    data (GET /jobs/{id}, GET /history) or from POST /video-url. Restricted to
    existing .mp4 files. Starlette's FileResponse handles HTTP Range requests,
    so seeking works in the player.
    """
    from backend.logger import log_app
    from backend.path_guard import DENIED_MESSAGE, denied, is_protected

    # Before anything that could tell whether the file exists.
    if is_protected(path):
        return denied("video", path)
    if not video_sign.verify(path, sig):
        log_app("[video] Refused: missing or wrong signature")
        return JSONResponse(status_code=403, content={"status": "error", "message": DENIED_MESSAGE})
```

Leave the rest of `get_video` unchanged. Directly after `get_video` (before `if __name__ == "__main__":`) add:

```python
class VideoUrlRequest(BaseModel):
    path: str


@app.post("/video-url")
def api_video_url(req: VideoUrlRequest):
    """A signed /video link for a path the clip data does not carry (spec 4.5).

    Behind the API token like every other endpoint, so only the app can ask
    for links. /video still checks the folder and the file type when the link
    is used.
    """
    from backend.path_guard import denied, is_protected
    path = req.path[len("local:"):] if req.path.startswith("local:") else req.path
    if not path.strip():
        return JSONResponse(status_code=400, content={"status": "error", "message": "path is required"})
    if is_protected(path):
        return denied("video_url", path)
    return {"status": "success", "video_url": video_sign.signed_url(path)}
```

- [ ] **Step 4: Sign the links in the existing `/video` tests**

These tests expect a file (or a folder refusal), so they now need a valid signature. The tests of protected files keep sending no `sig`: path_guard runs before the signature check, so they still prove the path_guard refusal.

`backend/tests/test_protected_paths.py`: change the import line `from backend import cookies, main` to `from backend import cookies, main, video_sign`, and in `test_video_still_serves_clips_sources_and_uploads` replace

```python
    r = client.get("/video", params={"path": str(app_files[name])})
```

with

```python
    path = str(app_files[name])
    r = client.get("/video", params={"path": path, "sig": video_sign.sign(path)})
```

`backend/tests/test_main.py`, `test_video_missing_returns_404`, replace

```python
    r = client.get("/video", params={"path": missing_path})
```

with

```python
    from backend import video_sign
    r = client.get("/video", params={"path": missing_path, "sig": video_sign.sign(missing_path)})
```

`backend/tests/test_workspace.py`, the three `/video` tests at the end of the file:

```python
def test_video_endpoint_serves_a_clip_left_on_the_work_disk(dirs, client):
    from backend import video_sign
    work, _ = dirs
    clip = work / "projects" / TITLE / "clips" / "clip_1.mp4"
    clip.parent.mkdir(parents=True)
    clip.write_bytes(b"clip one")

    r = client.get("/video", params={"path": str(clip), "sig": video_sign.sign(str(clip))})

    assert r.status_code == 200
    assert r.content == b"clip one"


def test_video_endpoint_still_refuses_files_outside_the_allowed_folders(dirs, client, tmp_path):
    from backend import video_sign
    outside = tmp_path / "elsewhere" / "private.mp4"
    outside.parent.mkdir()
    outside.write_bytes(b"not ours")

    # A valid signature does not open a file outside the app's folders.
    r = client.get("/video", params={"path": str(outside), "sig": video_sign.sign(str(outside))})

    assert r.status_code == 403


def test_video_endpoint_without_work_dir_does_not_serve_that_folder(tmp_path, monkeypatch, client):
    from backend import video_sign
    monkeypatch.delenv("AUTO_CLIPPER_WORK_DIR", raising=False)
    monkeypatch.setenv("AUTO_CLIPPER_WORKSPACE", str(tmp_path / "library"))
    clip = tmp_path / "work" / "clip_1.mp4"
    clip.parent.mkdir()
    clip.write_bytes(b"clip one")

    assert client.get("/video", params={"path": str(clip), "sig": video_sign.sign(str(clip))}).status_code == 403
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `C:\Users\dhima\projects\ac-venv\Scripts\python.exe -m pytest backend/tests/test_video_links.py -q -p no:cacheprovider`
Expected: 14 passed.

Run: `C:\Users\dhima\projects\ac-venv\Scripts\python.exe -m pytest backend/tests -q -p no:cacheprovider`
Expected: 721 passed, 8 skipped.

Run: `git grep -n "path.startswith(\"/video\")" backend` → no output.

- [ ] **Step 6: Commit**

```bash
git add backend/main.py backend/tests/test_video_links.py backend/tests/test_protected_paths.py backend/tests/test_main.py backend/tests/test_workspace.py tasks/PROGRESS-LOG.md
git commit -m "$(cat <<'EOF'
feat(sp1): /video needs a signed link; POST /video-url; links in clip data

GET /video refuses a missing or wrong sig with 403 on every platform
(T0.19). GET /jobs/{id} and GET /history add a signed video_url to each clip
when read; history.db never stores it. The token exemption is now exactly
/video, so /video-url needs the token.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Frontend: signed video links, ask once for a new link

Spec 4.5 and 5: the frontend no longer builds `/video` URLs. It uses the `video_url` the backend puts in the clip data (Task 8). When the player is refused (403, for example after `video_signing.key` was deleted), it asks `POST /video-url` once for a new link; if that fails too, the clip shows an error card.

**Files:**
- Create: `src/lib/videoUrl.ts`, `src/lib/localErrors.ts`, `src/hooks/useSignedVideo.ts`
- Test: `src/lib/videoUrl.test.ts`, `src/lib/localErrors.test.ts`
- Modify: `src/components/ClipCard.tsx`, `src/components/ClipsResult.tsx`, `src/App.tsx` (the `videoSrc` helper and its context entry), `src/pages/HistoryPage.tsx` (the `videoSrc` prop of `ClipCard`), `src/pages/ManualAIEditorPage.tsx:63`, `src/pages/WorkspacePage.tsx:58`, `src/locales/{id,en}.json`

**Interfaces:**
- Consumes: Task 8 HTTP contract (`clip.video_url`, `POST /video-url` → `{video_url}`); Task 2 `API_URL`; Task 3 `platform().saveClip(ClipRef)`, `fileName()`; Task 4 `scripts/add-locale-keys.mjs`; existing `ErrorCard`, `ErrorInfo`, `src/i18n.ts`.
- Produces:
  - `src/lib/videoUrl.ts`: `videoHref(videoUrl: string, apiUrl: string, extra?: { v?: number; dl?: boolean }): string`, `requestVideoUrl(path: string): Promise<string>`, `VideoLinkState { url: string; refreshed: boolean; failed: boolean }`, `initialVideoLink(videoUrl?: string): VideoLinkState`, `recoverVideoLink(state: VideoLinkState, path: string, fetchUrl?: (path: string) => Promise<string>): Promise<VideoLinkState>`.
  - `src/lib/localErrors.ts`: `LOCAL_ERROR_CODES` (readonly tuple), `LocalErrorCode`, `localErrorInfo(code: LocalErrorCode, technical?: string): ErrorInfo`. Task 12 adds three codes.
  - `src/hooks/useSignedVideo.ts`: `useSignedVideo(path: string, videoUrl?: string): { src: string; failed: boolean; onError(): void; retry(): void }`.
  - `Clip.video_url?: string` in `src/components/ClipCard.tsx`; `ClipCard` and `ClipsResult` lose the `videoSrc` prop; `AppContext` loses `videoSrc`.
  - Locale keys `local_error.action.retry`, `local_error.video_link_refused.{title,message}`.

- [ ] **Step 1: Write the failing tests**

`src/lib/videoUrl.test.ts`:

```ts
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { initialVideoLink, recoverVideoLink, videoHref } from "./videoUrl";

const SIGNED = "/video?path=C%3A%5Cclips%5Cclip_1.mp4&sig=abc";

describe("videoHref", () => {
  it("puts the backend address in front of the backend's relative link", () => {
    expect(videoHref(SIGNED, "http://127.0.0.1:5123")).toBe(`http://127.0.0.1:5123${SIGNED}`);
  });

  it("keeps an absolute link as it is", () => {
    expect(videoHref(`https://be.example.com${SIGNED}`, "http://127.0.0.1:5123")).toBe(`https://be.example.com${SIGNED}`);
  });

  it("adds the cache-buster and the download flag after the signature", () => {
    expect(videoHref(SIGNED, "https://be.example.com", { v: 3, dl: true })).toBe(`https://be.example.com${SIGNED}&v=3&dl=1`);
    expect(videoHref("/video", "https://be.example.com", { dl: true })).toBe("https://be.example.com/video?dl=1");
  });

  it("gives no address for a clip without a link", () => {
    expect(videoHref("", "https://be.example.com", { v: 1 })).toBe("");
  });
});

describe("recoverVideoLink", () => {
  it("asks the backend once for a new link after the player was refused", async () => {
    const fetchUrl = vi.fn(async () => "/video?path=x&sig=new");

    const next = await recoverVideoLink(initialVideoLink(SIGNED), "C:\\clips\\clip_1.mp4", fetchUrl);

    expect(fetchUrl).toHaveBeenCalledWith("C:\\clips\\clip_1.mp4");
    expect(next).toEqual({ url: "/video?path=x&sig=new", refreshed: true, failed: false });
  });

  it("gives up when the new link is refused too", async () => {
    const fetchUrl = vi.fn(async () => "/video?path=x&sig=newer");

    const after = await recoverVideoLink({ url: "/video?path=x&sig=new", refreshed: true, failed: false }, "x", fetchUrl);

    expect(fetchUrl).not.toHaveBeenCalled();
    expect(after).toEqual({ url: "/video?path=x&sig=new", refreshed: true, failed: true });
  });

  it("gives up when the backend will not sign a new link", async () => {
    const fetchUrl = vi.fn(async () => {
      throw new Error("403");
    });

    const after = await recoverVideoLink(initialVideoLink(SIGNED), "x", fetchUrl);

    expect(after).toEqual({ url: SIGNED, refreshed: true, failed: true });
  });
});

// The backend signs every link (spec 4.5); a link built here would be refused.
const SRC = resolve(process.cwd(), "src");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name) ? [full] : [];
  });
}

describe("video links come from the backend", () => {
  it("no source file builds a /video?path= link itself", () => {
    const offenders = sourceFiles(SRC)
      .map((file) => relative(SRC, file).split(sep).join("/"))
      .filter((file) => file !== "lib/videoUrl.ts")
      .filter((file) => readFileSync(join(SRC, file), "utf8").includes("/video?path="));
    expect(offenders).toEqual([]);
  });
});
```

`src/lib/localErrors.test.ts`:

```ts
import { beforeAll, describe, expect, it } from "vitest";
import i18n from "../i18n";
import { LOCAL_ERROR_CODES, localErrorInfo } from "./localErrors";

describe("localErrorInfo", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("id");
  });

  it.each(LOCAL_ERROR_CODES)("%s has Indonesian and English text from src/locales", (code) => {
    const info = localErrorInfo(code, "detail");

    expect(info.code).toBe(code);
    expect(info.technical).toBe("detail");
    for (const text of [info.title, info.message, info.title_en, info.message_en]) {
      expect(text).toBeTruthy();
      expect(text).not.toContain("local_error.");
    }
    expect(info.title).not.toBe(info.title_en);
    for (const action of info.actions) {
      expect(action.label).not.toContain("local_error.");
      expect(action.label_en).not.toContain("local_error.");
    }
  });

  it("offers to try a refused video link again", () => {
    const info = localErrorInfo("VIDEO_LINK_REFUSED");
    expect(info.actions.map((a) => [a.id, a.label, a.label_en])).toEqual([["retry", "Coba lagi", "Try again"]]);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/lib/videoUrl.test.ts src/lib/localErrors.test.ts`
Expected: FAIL, "Failed to resolve import ./videoUrl" and "./localErrors".

- [ ] **Step 3: Write `src/lib/videoUrl.ts`**

```ts
import axios from "axios";
import { API_URL } from "../platform/backendUrl";

// Signed /video links (spec 4.5). The backend makes every link: in the clip data
// (video_url) or through POST /video-url. This file only puts the backend address
// in front and adds parameters the signature does not cover (v, dl).

/** An absolute address for a backend video_url ("" when there is none). */
export function videoHref(videoUrl: string, apiUrl: string, extra: { v?: number; dl?: boolean } = {}): string {
  if (!videoUrl) return "";
  const base = /^https?:\/\//i.test(videoUrl) ? videoUrl : `${apiUrl}${videoUrl.startsWith("/") ? "" : "/"}${videoUrl}`;
  const params: string[] = [];
  if (extra.v !== undefined) params.push(`v=${encodeURIComponent(String(extra.v))}`);
  if (extra.dl) params.push("dl=1");
  if (!params.length) return base;
  return `${base}${base.includes("?") ? "&" : "?"}${params.join("&")}`;
}

/** A fresh signed link for a file on the backend machine. Throws when the backend refuses. */
export async function requestVideoUrl(path: string): Promise<string> {
  const res = await axios.post(`${API_URL}/video-url`, { path });
  const url = res.data?.video_url;
  if (typeof url !== "string" || !url) throw new Error("The backend sent no video_url.");
  return url;
}

export interface VideoLinkState {
  /** The relative signed link in use ("" when the clip data had none). */
  url: string;
  /** A new link was already asked for once. */
  refreshed: boolean;
  /** Give up: show the error card. */
  failed: boolean;
}

export function initialVideoLink(videoUrl?: string): VideoLinkState {
  return { url: videoUrl || "", refreshed: false, failed: false };
}

/** After the player could not load the link: ask once for a new one; a second failure is final. */
export async function recoverVideoLink(
  state: VideoLinkState,
  path: string,
  fetchUrl: (path: string) => Promise<string> = requestVideoUrl,
): Promise<VideoLinkState> {
  if (state.refreshed) return { ...state, failed: true };
  try {
    return { url: await fetchUrl(path), refreshed: true, failed: false };
  } catch (err) {
    console.error("The backend refused a new video link:", err);
    return { ...state, refreshed: true, failed: true };
  }
}
```

- [ ] **Step 4: Write `src/lib/localErrors.ts`**

```ts
import i18n from "../i18n";
import type { ErrorInfo } from "../types/errorInfo";

// Error cards for failures the backend cannot report itself (it refused a link, or
// cannot be reached). Same ErrorInfo shape as backend/errors.py, texts from
// src/locales (local_error.*), so ErrorCard renders them like any other error.

export const LOCAL_ERROR_CODES = ["VIDEO_LINK_REFUSED"] as const;
export type LocalErrorCode = (typeof LOCAL_ERROR_CODES)[number];

const ACTIONS: Record<LocalErrorCode, string[]> = {
  VIDEO_LINK_REFUSED: ["retry"],
};

export function localErrorInfo(code: LocalErrorCode, technical = ""): ErrorInfo {
  const id = i18n.getFixedT("id");
  const en = i18n.getFixedT("en");
  const key = `local_error.${code.toLowerCase()}`;
  return {
    code,
    title: id(`${key}.title`),
    message: id(`${key}.message`),
    title_en: en(`${key}.title`),
    message_en: en(`${key}.message`),
    actions: ACTIONS[code].map((action) => ({
      id: action,
      label: id(`local_error.action.${action}`),
      label_en: en(`local_error.action.${action}`),
    })),
    technical,
  };
}
```

- [ ] **Step 5: Add the texts (Git Bash)**

```bash
node scripts/add-locale-keys.mjs <<'JSON'
{
  "id": {
    "local_error": {
      "action": { "retry": "Coba lagi" },
      "video_link_refused": {
        "title": "Video tidak bisa diputar",
        "message": "Server menolak alamat video ini, atau filenya sudah dipindah atau dihapus. Tekan Coba lagi. Bila tetap gagal, buat ulang klip ini dari Riwayat."
      }
    }
  },
  "en": {
    "local_error": {
      "action": { "retry": "Try again" },
      "video_link_refused": {
        "title": "This video cannot be played",
        "message": "The server refused this video's address, or the file was moved or deleted. Press Try again. If it still fails, render this clip again from History."
      }
    }
  }
}
JSON
```

- [ ] **Step 6: Run the unit tests to see them pass**

Run: `npx vitest run src/lib/videoUrl.test.ts src/lib/localErrors.test.ts`
Expected: the `videoHref`, `recoverVideoLink` and `localErrorInfo` tests pass; "no source file builds a /video?path= link itself" still FAILS, listing `App.tsx` and `pages/HistoryPage.tsx`.

- [ ] **Step 7: Write the hook**

`src/hooks/useSignedVideo.ts`:

```ts
import { useCallback, useEffect, useState } from "react";
import { initialVideoLink, recoverVideoLink, type VideoLinkState } from "../lib/videoUrl";

/**
 * The signed link of one clip (spec 4.5). When the player is refused, asks the
 * backend once for a new link (spec 5); after that `failed` is true and the
 * clip shows an error card whose "Coba lagi" tries once more.
 */
export function useSignedVideo(path: string, videoUrl?: string) {
  const [link, setLink] = useState<VideoLinkState>(() => initialVideoLink(videoUrl));

  // New clip data (job polling, History reload) brings a new link.
  useEffect(() => {
    setLink(initialVideoLink(videoUrl));
  }, [path, videoUrl]);

  const recover = useCallback(
    (from: VideoLinkState) => {
      recoverVideoLink(from, path).then(setLink);
    },
    [path],
  );

  // Clip data without a link (a backend from before SP1): ask for one straight away.
  useEffect(() => {
    if (!link.url && !link.refreshed) recover(link);
  }, [link, recover]);

  return {
    src: link.url,
    failed: link.failed,
    onError: () => recover(link),
    retry: () => recover({ ...link, refreshed: false, failed: false }),
  };
}
```

- [ ] **Step 8: Use the backend's links in the components**

`src/components/ClipCard.tsx`:
- add imports after `import { fileName } from "../platform/paths";`:

```tsx
import { API_URL } from "../platform/backendUrl";
import { useSignedVideo } from "../hooks/useSignedVideo";
import { localErrorInfo } from "../lib/localErrors";
import { videoHref } from "../lib/videoUrl";
import { ErrorCard } from "./ErrorCard";
```

- in `interface Clip`, after `path: string;` add:

```tsx
  /** Signed /video link from the backend (relative), see backend/video_sign.py. */
  video_url?: string;
```

- in `interface ClipCardProps` delete the line `videoSrc: (path: string, v: number) => string;`, and delete `videoSrc,` from the destructured props of `ClipCard`.
- first line of the component body after `const [localSocial, …] = useState…;`:

```tsx
  const video = useSignedVideo(clip.path, clip.video_url);
```

- replace the `<video … />` element (inside `<div className="aspect-[9/16] …">`) with:

```tsx
        {video.failed ? (
          <ErrorCard
            info={localErrorInfo("VIDEO_LINK_REFUSED")}
            handlers={{ retry: video.retry }}
            className="h-full overflow-y-auto rounded-none border-0"
          />
        ) : (
          <video
            key={`${clip.v}-${video.src}`}
            src={videoHref(video.src, API_URL, { v: clip.v }) || undefined}
            onError={video.onError}
            controls
            playsInline
            preload="metadata"
            className="w-full h-full object-contain bg-black"
          />
        )}
```

- in the download button's `onClick` (written in Task 3), replace `videoUrl: videoSrc(clip.path, clip.v),` with:

```tsx
                  videoUrl: videoHref(video.src, API_URL, { dl: true }) || undefined,
```

`src/components/ClipsResult.tsx`: delete the line `videoSrc: (p: string, v?: number) => string;` from `ClipsResultProps`, change the signature to `export default function ClipsResult({ clips, status, failedCount, jobId }: ClipsResultProps) {`, and delete `videoSrc={videoSrc}` from the `<ClipCard … />`.

`src/App.tsx`: delete

```tsx
  const videoSrc = (p: string, v = 0) =>
    `${API_URL}/video?path=${encodeURIComponent(p)}&v=${v}`;
```

the line `videoSrc,` in `contextValue`, and the comment and import that Task 3 added for it:

```tsx
// videoSrc below still reads API_URL; a re-export alone does not bring it into scope (removed in Task 9).
import { API_URL } from "./platform/backendUrl";
```

(`noUnusedLocals` would fail the build otherwise). Keep the re-export line `export { API_URL, setApiUrl } from "./platform/backendUrl";`: other files import `API_URL` from `../App`.

`src/pages/HistoryPage.tsx`: delete the three lines

```tsx
                      videoSrc={(path, v) =>
                        `${API_URL}/video?path=${encodeURIComponent(path)}&v=${v || 0}`
                      }
```

`src/pages/ManualAIEditorPage.tsx` and `src/pages/WorkspacePage.tsx`: delete the line `videoSrc={ctx.videoSrc}`.

- [ ] **Step 9: Run the checks**

Run: `npx vitest run` → all pass (including the source scan).
Run: `npm run build` → exit 0. Run: `npm run build:cloud` → exit 0. Run: `npx oxlint src` → 0 errors.
Run: `git grep -n "videoSrc" src` → no output.

- [ ] **Step 10: Browser check**

Window 1:

```powershell
$env:AUTO_CLIPPER_DEV_TOKEN = "dev-token"; $env:AUTO_CLIPPER_WORKSPACE = "$env:TEMP\ac-sp1-dev"
C:\Users\dhima\projects\ac-venv\Scripts\python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

Window 2: `$env:VITE_DEV_BACKEND = "true"; npm run dev`, open `http://localhost:5173`.

Make one short clip (Manual AI Editor with a local `.mp4`, or reuse a job already in `$env:TEMP\ac-sp1-dev`). Expected: the clip plays in the result and in Riwayat; the network tab shows `/video?path=…&sig=…&v=…`; Download saves the file (`…&dl=1`). Then, with Riwayat still open: stop the backend, delete `$env:TEMP\ac-sp1-dev\video_signing.key`, start the backend again, press play on a clip. Expected: one 403 on `/video`, one `POST /video-url`, then the clip plays. Record the result in the progress log.

- [ ] **Step 11: Commit**

```bash
git add src tasks/PROGRESS-LOG.md
git commit -m "$(cat <<'EOF'
feat(sp1): clips play from the backend's signed links

ClipCard uses video_url from the clip data and asks POST /video-url once
when the player is refused, then shows an error card. No component builds a
/video URL any more (a Vitest scan checks it). Adds localErrorInfo for error
cards the backend cannot send.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: Backend: web mode serves the UI, token rules

Spec 4.4 (serving and token parts). `backend/web_mode.py` (Task 11) turns the mode on; here the mode is driven by environment variables so it can be tested with `TestClient`.

**Files:**
- Create: `backend/web_ui.py`
- Test: `backend/tests/test_web_ui.py`
- Modify: `backend/main.py` (import line added in Task 8, `verify_token`, `app.include_router` before `if __name__ == "__main__":`)

**Interfaces:**
- Consumes: `path_guard.is_within(path, root)`; Task 8 `verify_token` shape; Task 7/8 `video_sign.signed_url`.
- Produces (`backend/web_ui.py`):
  - `WEB_MODE_ENV = "AUTO_CLIPPER_WEB_MODE"`, `UI_DIR_ENV = "AUTO_CLIPPER_UI_DIR"`
  - `is_web_mode() -> bool`, `ui_dir() -> str` (`""` when unset), `is_public_path(path: str) -> bool`
  - `router` (`APIRouter`): `GET /` → `index.html`, `GET /assets/{file_path:path}`, `GET /{name}` for image files at the top of the UI folder; all answer 404 `{"status":"error","message":"Not found"}` outside web mode.
- Produces (rules in `verify_token`): web mode → no token for `OPTIONS`, `/video`, `/health`, and `is_public_path` paths; the token for everything else, `/heartbeat` included. Outside web mode the rules are unchanged (desktop dev without token; installed desktop and cloud with token; `/heartbeat`, `/health`, `/video` open).

- [ ] **Step 1: Write the failing tests**

`backend/tests/test_web_ui.py`:

```python
"""Local web mode: the backend serves the built UI and every API call needs the launch token (SP1, spec 4.4)."""
import os
import sys

import pytest
from fastapi.testclient import TestClient

from backend import main, video_sign, web_ui
from backend.logger import get_app_data_dir

client = TestClient(main.app)

TOKEN = "web-launch-token"
AUTH = {"Authorization": f"Bearer {TOKEN}"}


@pytest.fixture
def web(tmp_path, monkeypatch):
    """A built UI folder and web mode switched on, the way backend.web_mode.launch does it."""
    ui = tmp_path / "ui"
    (ui / "assets").mkdir(parents=True)
    (ui / "index.html").write_text('<!doctype html><title>Auto Clipper</title><div id="root"></div>', encoding="utf-8")
    (ui / "assets" / "index-abc123.js").write_text("console.log('ui')", encoding="utf-8")
    (ui / "assets" / "index-abc123.css").write_text("body{}", encoding="utf-8")
    (ui / "logo.svg").write_text("<svg/>", encoding="utf-8")
    (ui / "character.png").write_bytes(b"\x89PNG")
    (tmp_path / "secret.txt").write_text("not ui", encoding="utf-8")
    monkeypatch.setenv("AUTO_CLIPPER_WEB_MODE", "1")
    monkeypatch.setenv("AUTO_CLIPPER_UI_DIR", str(ui))
    monkeypatch.setenv("AUTO_CLIPPER_WEB_TOKEN", TOKEN)
    monkeypatch.delenv("AUTO_CLIPPER_CLOUD_MODE", raising=False)
    return ui


def test_index_is_served_without_the_token(web):
    r = client.get("/")

    assert r.status_code == 200
    assert '<div id="root">' in r.text
    assert r.headers["content-type"].startswith("text/html")
    assert r.headers["cache-control"] == "no-cache"


def test_assets_are_served_without_the_token_with_types_the_browser_accepts(web):
    js = client.get("/assets/index-abc123.js")
    css = client.get("/assets/index-abc123.css")

    assert (js.status_code, css.status_code) == (200, 200)
    assert js.headers["content-type"].startswith("text/javascript")
    assert css.headers["content-type"].startswith("text/css")
    assert "immutable" in js.headers["cache-control"]


def test_image_files_at_the_top_of_the_ui_folder_are_served(web):
    svg = client.get("/logo.svg")
    png = client.get("/character.png")

    assert (svg.status_code, png.status_code) == (200, 200)
    assert svg.headers["content-type"].startswith("image/svg+xml")
    assert png.content == b"\x89PNG"


def test_missing_files_and_files_outside_the_ui_folder_are_not_found(web):
    for url in ("/assets/missing.js", "/assets/%2E%2E/%2E%2E/secret.txt", "/assets/..%2F..%2Fsecret.txt", "/secret.txt", "/index.html"):
        r = client.get(url, headers=AUTH)
        assert r.status_code == 404, url
        assert b"not ui" not in r.content


def test_ui_routes_do_not_shadow_the_api(web):
    r = client.get("/history", headers=AUTH)

    assert r.status_code == 200
    assert r.json()["status"] == "success"


def test_api_needs_the_launch_token_in_web_mode(web):
    assert client.get("/history").status_code == 401
    assert client.get("/history", headers={"Authorization": "Bearer wrong"}).status_code == 401
    assert client.get("/history", headers=AUTH).status_code == 200
    assert client.post("/video-url", json={"path": "x.mp4"}).status_code == 401


def test_heartbeat_needs_the_token_in_web_mode_but_health_does_not(web):
    assert client.post("/heartbeat").status_code == 401
    assert client.post("/heartbeat", headers=AUTH).status_code == 200
    assert client.get("/health").status_code == 200


def test_video_uses_its_signature_not_the_token_in_web_mode(web):
    clip = os.path.join(get_app_data_dir(), "projects", "Web", "clips", "clip_1.mp4")
    os.makedirs(os.path.dirname(clip), exist_ok=True)
    with open(clip, "wb") as f:
        f.write(b"web clip")

    r = client.get(video_sign.signed_url(clip))

    assert r.status_code == 200
    assert r.content == b"web clip"


def test_ui_is_not_served_outside_web_mode(web, monkeypatch):
    monkeypatch.delenv("AUTO_CLIPPER_WEB_MODE")

    assert client.get("/").status_code == 404
    assert client.get("/assets/index-abc123.js").status_code == 404
    assert client.get("/history").status_code == 200  # desktop dev: no token, as before


def test_web_mode_without_a_ui_folder_answers_not_found(web, monkeypatch):
    monkeypatch.delenv("AUTO_CLIPPER_UI_DIR")

    assert client.get("/").status_code == 404


def test_installed_desktop_rules_are_unchanged(monkeypatch):
    monkeypatch.delenv("AUTO_CLIPPER_WEB_MODE", raising=False)
    monkeypatch.delenv("AUTO_CLIPPER_CLOUD_MODE", raising=False)
    monkeypatch.setenv("AUTO_CLIPPER_WEB_TOKEN", TOKEN)
    monkeypatch.setattr(sys, "frozen", True, raising=False)

    assert client.get("/history").status_code == 401
    assert client.get("/history", headers=AUTH).status_code == 200
    assert client.post("/heartbeat").status_code == 200
    assert client.get("/").status_code == 401  # not a public path outside web mode


@pytest.mark.parametrize("path, public", [
    ("/", True),
    ("/health", True),
    ("/assets/index-abc123.js", True),
    ("/logo.svg", True),
    ("/character.png", True),
    ("/favicon.ico", True),
    ("/history", False),
    ("/heartbeat", False),
    ("/video-url", False),
    ("/assets", False),
    ("/api/settings/logo.png", False),
    ("/index.html", False),
])
def test_public_paths(path, public):
    assert web_ui.is_public_path(path) is public
```

- [ ] **Step 2: Run them to see them fail**

Run: `C:\Users\dhima\projects\ac-venv\Scripts\python.exe -m pytest backend/tests/test_web_ui.py -q -p no:cacheprovider`
Expected: FAIL at collection, `ImportError: cannot import name 'web_ui' from 'backend'`.

- [ ] **Step 3: Write `backend/web_ui.py`**

```python
"""Local web mode: the backend serves the built UI (SP1, spec 4.4, ADR-013).

On when AUTO_CLIPPER_WEB_MODE is set. backend.web_mode.launch sets it together
with AUTO_CLIPPER_UI_DIR (the Vite build) and the launch token. The app uses
HashRouter, so only "/", "/assets/*" and the image files at the top of the UI
folder are served: there is no SPA fallback that could shadow an API route.
In web mode these paths and /health need no token; everything else does
(verify_token in backend/main.py).
"""
import os
import re

from fastapi import APIRouter
from fastapi.responses import FileResponse, JSONResponse

from backend.path_guard import is_within

WEB_MODE_ENV = "AUTO_CLIPPER_WEB_MODE"
UI_DIR_ENV = "AUTO_CLIPPER_UI_DIR"

# index.html links /logo.svg; LandingPage and AuthGate use /character.png and /logo.png.
_ROOT_FILE = re.compile(r"^/[A-Za-z0-9_-][A-Za-z0-9_.-]*\.(svg|png|ico|jpg|jpeg|webp)$", re.IGNORECASE)

# Set explicitly: on Windows the mimetypes module reads the registry, which can map
# .js to text/plain, and the browser then refuses to run the module script.
_MEDIA_TYPES = {
    ".html": "text/html",
    ".js": "text/javascript",
    ".mjs": "text/javascript",
    ".css": "text/css",
    ".json": "application/json",
    ".map": "application/json",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".ico": "image/x-icon",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
}

_NO_CACHE = "no-cache"
# Vite puts a content hash in every file name under assets/.
_ASSET_CACHE = "public, max-age=31536000, immutable"


def is_web_mode() -> bool:
    return bool(os.environ.get(WEB_MODE_ENV))


def ui_dir() -> str:
    """The UI folder, or "" when none is set."""
    folder = os.environ.get(UI_DIR_ENV, "").strip()
    return os.path.abspath(folder) if folder else ""


def is_public_path(path: str) -> bool:
    """Paths that need no token in web mode."""
    return path in ("/", "/health") or path.startswith("/assets/") or bool(_ROOT_FILE.match(path))


def _not_found() -> JSONResponse:
    return JSONResponse(status_code=404, content={"status": "error", "message": "Not found"})


def _serve(relative: str, cache: str):
    root = ui_dir()
    if not is_web_mode() or not root:
        return _not_found()
    target = os.path.join(root, *relative.split("/"))
    if not is_within(target, root) or not os.path.isfile(target):
        return _not_found()
    media_type = _MEDIA_TYPES.get(os.path.splitext(target)[1].lower(), "application/octet-stream")
    return FileResponse(target, media_type=media_type, headers={"Cache-Control": cache})


router = APIRouter()


@router.get("/")
def ui_index():
    return _serve("index.html", _NO_CACHE)


@router.get("/assets/{file_path:path}")
def ui_asset(file_path: str):
    return _serve(f"assets/{file_path}", _ASSET_CACHE)


@router.get("/{name}")
def ui_root_file(name: str):
    if not _ROOT_FILE.match(f"/{name}"):
        return _not_found()
    return _serve(name, _NO_CACHE)
```

- [ ] **Step 4: Wire it into `backend/main.py`**

Change the import added in Task 8 from `from backend import video_sign` to:

```python
from backend import video_sign, web_ui
```

Replace the whole `verify_token` function with:

```python
@app.middleware("http")
async def verify_token(request: Request, call_next):
    # /video carries its own signature (backend.video_sign) because the player cannot send a header.
    # Exactly "/video": a prefix match would also open /video-url.
    path = request.url.path
    if request.method == "OPTIONS" or path in ("/video", "/health"):
        return await call_next(request)

    if web_ui.is_web_mode():
        # Local web mode (spec 4.4): only the UI files are open; everything else, /heartbeat
        # included, needs the token of this launch.
        if web_ui.is_public_path(path):
            return await call_next(request)
    else:
        if path == "/heartbeat":
            return await call_next(request)
        # Enforce token verification in frozen bundles or cloud mode
        cloud_mode = bool(os.environ.get("AUTO_CLIPPER_CLOUD_MODE"))
        if not getattr(sys, 'frozen', False) and not cloud_mode:
            return await call_next(request)

    auth_header = request.headers.get("Authorization")
    token = os.environ.get("AUTO_CLIPPER_WEB_TOKEN") or os.environ.get("AUTO_CLIPPER_DEV_TOKEN") or API_SECRET_TOKEN
    if not auth_header or auth_header != f"Bearer {token}":
        return JSONResponse(status_code=401, content={"status": "error", "message": "Unauthorized API access"})

    return await call_next(request)
```

Directly before `if __name__ == "__main__":` (after `api_video_url` from Task 8) add:

```python
# Local web mode (spec 4.4): "/", "/assets/*" and the UI's image files.
# Registered after every API route so none of them can be shadowed.
app.include_router(web_ui.router)
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `C:\Users\dhima\projects\ac-venv\Scripts\python.exe -m pytest backend/tests/test_web_ui.py -q -p no:cacheprovider`
Expected: 23 passed.

Run: `C:\Users\dhima\projects\ac-venv\Scripts\python.exe -m pytest backend/tests -q -p no:cacheprovider`
Expected: 744 passed, 8 skipped. (`test_main.py::test_auth_middleware_in_cloud_mode` and `test_heartbeat_endpoint` still pass: outside web mode `/heartbeat` stays open.)

- [ ] **Step 6: Commit**

```bash
git add backend/web_ui.py backend/tests/test_web_ui.py backend/main.py tasks/PROGRESS-LOG.md
git commit -m "$(cat <<'EOF'
feat(sp1): web mode serves the built UI; token on every API call

With AUTO_CLIPPER_WEB_MODE the backend serves index.html, /assets/* and the
UI's root image files without a token; every other path, /heartbeat
included, needs the launch token. Explicit content types, so Windows
registry entries cannot turn .js into text/plain. Desktop and cloud token
rules unchanged.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: Backend: `--web` launcher (one instance, browser, console text)

Spec 4.4 (launcher part) and spec 6 ("deteksi instance yang sudah berjalan, bind hanya 127.0.0.1"). Plan questions 7 and 8 apply: the instance file holds `{port, pid, token}` and is protected by path_guard.

**Files:**
- Create: `backend/web_mode.py`
- Test: `backend/tests/test_web_mode.py`
- Modify: `backend/main.py` (start of the `if __name__ == "__main__":` block), `backend/path_guard.py` (`_PRIVATE_FILE_PREFIXES`, docstring)

**Interfaces:**
- Consumes: Task 10 `web_ui.WEB_MODE_ENV`, `web_ui.UI_DIR_ENV`, the web-mode token rules (`/` open, `/heartbeat` needs the token); `logger.get_app_data_dir()`, `logger.log_error()`; `main._original_stdout` / `_original_stderr` (frozen stdout guard).
- Produces (`backend/web_mode.py`):
  - `INSTANCE_FILE_NAME = "web_instance.json"`, `TOKEN_ENV = "AUTO_CLIPPER_WEB_TOKEN"`, `NO_BROWSER_ENV = "AUTO_CLIPPER_NO_BROWSER"` (used by the Task 13 smoke test), `HOST = "127.0.0.1"`
  - `RUNNING_TEXT`, `ALREADY_RUNNING_TEXT`, `ADDRESS_TEXT`, `MISSING_UI_TEXT` (console texts, id + en)
  - `instance_path(data_dir: Optional[str] = None) -> str`, `read_instance(path) -> Optional[dict]`, `write_instance(path, port: int, pid: int, token: str) -> None`, `remove_instance(path, pid: int) -> None`
  - `app_url(port: int, token: str) -> str` (`http://127.0.0.1:<port>/#t=<token>`)
  - `instance_alive(info: dict, timeout: float = 2.0) -> bool`, `free_port() -> int`, `make_server(app, port) -> uvicorn.Server`, `run_server(app, port, on_ready) -> None`, `open_in_browser(url) -> bool`
  - `default_ui_dir() -> str`, `ui_dir_from_args(argv: list) -> str`
  - `launch(app, argv, stream, *, serve=run_server, open_browser=open_in_browser, is_alive=instance_alive, data_dir=None) -> int` (0 = served or handed over to the running instance, 1 = UI folder missing)
- Produces (CLI): `backend --web [--ui-dir PATH]` (frozen) and `python -m backend.main --web [--ui-dir PATH]` (source; default UI folder `<repo>/dist`). The frozen default is `<exe folder>/ui`, else `<exe folder>/../ui` (macOS onedir).

- [ ] **Step 1: Write the failing tests**

`backend/tests/test_web_mode.py`:

```python
"""`backend --web`: one instance per computer, a browser tab with the token, the console text,
and a server on 127.0.0.1 only (SP1, spec 4.4 and 6)."""
import io
import json
import os
import socket
import subprocess
import sys
import threading
import time
from pathlib import Path

import pytest

from backend import path_guard, web_mode

REPO = Path(__file__).resolve().parents[2]


@pytest.fixture
def ui(tmp_path):
    folder = tmp_path / "ui"
    folder.mkdir()
    (folder / "index.html").write_text('<!doctype html><div id="root"></div>', encoding="utf-8")
    return folder


@pytest.fixture
def web_env(monkeypatch):
    """launch() switches web mode on in os.environ; monkeypatch puts the old values back."""
    for name in ("AUTO_CLIPPER_WEB_MODE", "AUTO_CLIPPER_UI_DIR", "AUTO_CLIPPER_WEB_TOKEN"):
        monkeypatch.setenv(name, "")


class FakeServer:
    """Stands in for run_server: records the call, reads the instance file while "running"."""

    def __init__(self, instance_file):
        self.instance_file = Path(instance_file)
        self.calls = []
        self.instance_during_run = None

    def __call__(self, app, port, on_ready):
        self.calls.append((app, port))
        self.instance_during_run = json.loads(self.instance_file.read_text(encoding="utf-8"))
        on_ready()


def _no_instance_expected(info):
    pytest.fail("there is no instance file to check")


def test_launch_starts_one_server_and_opens_the_app_with_its_token(tmp_path, ui, web_env):
    data = tmp_path / "data"
    serve = FakeServer(data / "web_instance.json")
    opened, out = [], io.StringIO()

    code = web_mode.launch("APP", ["--web", "--ui-dir", str(ui)], out, serve=serve,
                           open_browser=lambda url: opened.append(url) or True,
                           is_alive=_no_instance_expected, data_dir=str(data))

    assert code == 0
    [(app, port)] = serve.calls
    token = os.environ["AUTO_CLIPPER_WEB_TOKEN"]
    assert app == "APP"
    assert len(token) >= 32
    assert opened == [f"http://127.0.0.1:{port}/#t={token}"]
    assert serve.instance_during_run == {"port": port, "pid": os.getpid(), "token": token}
    assert os.environ["AUTO_CLIPPER_WEB_MODE"] == "1"
    assert os.environ["AUTO_CLIPPER_UI_DIR"] == str(ui)
    text = out.getvalue()
    assert "Auto Clipper berjalan. Jangan tutup jendela ini selama memakai aplikasi." in text
    assert "Auto Clipper is running. Do not close this window while you use the app." in text
    assert opened[0] in text
    assert not (data / "web_instance.json").exists()  # removed when the server stops


def test_a_second_launch_only_opens_a_tab_on_the_running_server(tmp_path, ui, web_env):
    data = tmp_path / "data"
    web_mode.write_instance(web_mode.instance_path(str(data)), 5123, 4242, "old-token")
    opened, out = [], io.StringIO()

    code = web_mode.launch("APP", ["--web", "--ui-dir", str(ui)], out,
                           serve=lambda *a: pytest.fail("must not start a second server"),
                           open_browser=lambda url: opened.append(url) or True,
                           is_alive=lambda info: info["port"] == 5123, data_dir=str(data))

    assert code == 0
    assert opened == ["http://127.0.0.1:5123/#t=old-token"]
    assert "Auto Clipper sudah berjalan" in out.getvalue()
    assert "already running" in out.getvalue()
    assert web_mode.read_instance(web_mode.instance_path(str(data)))["pid"] == 4242


def test_a_stale_instance_file_is_replaced_by_a_new_server(tmp_path, ui, web_env):
    data = tmp_path / "data"
    web_mode.write_instance(web_mode.instance_path(str(data)), 5123, 4242, "old-token")
    serve = FakeServer(data / "web_instance.json")

    web_mode.launch("APP", ["--web", "--ui-dir", str(ui)], io.StringIO(), serve=serve,
                    open_browser=lambda url: True, is_alive=lambda info: False, data_dir=str(data))

    assert serve.instance_during_run["pid"] == os.getpid()
    assert serve.instance_during_run["token"] != "old-token"


@pytest.mark.parametrize("content", [
    "",
    "not json",
    "[]",
    '{"port": "5123", "pid": 1, "token": "t"}',
    '{"port": 5123, "pid": 1, "token": ""}',
])
def test_an_unreadable_instance_file_counts_as_no_instance(tmp_path, content):
    path = tmp_path / "web_instance.json"
    path.write_text(content, encoding="utf-8")

    assert web_mode.read_instance(str(path)) is None


def test_launch_without_the_ui_folder_explains_and_stops(tmp_path, web_env):
    out = io.StringIO()

    code = web_mode.launch("APP", ["--web", "--ui-dir", str(tmp_path / "missing")], out,
                           serve=lambda *a: pytest.fail("must not start"), data_dir=str(tmp_path / "data"))

    assert code == 1
    assert "tidak ditemukan" in out.getvalue()
    assert "was not found" in out.getvalue()


def test_the_browser_can_be_switched_off_for_the_ci_smoke_test(monkeypatch):
    monkeypatch.setenv("AUTO_CLIPPER_NO_BROWSER", "1")
    monkeypatch.setattr(web_mode.webbrowser, "open", lambda url: pytest.fail("browser opened"))

    assert web_mode.open_in_browser("http://127.0.0.1:1/#t=x") is False


def test_the_instance_file_of_a_newer_launch_is_left_alone(tmp_path):
    path = str(tmp_path / "web_instance.json")
    web_mode.write_instance(path, 5123, 999999, "newer")

    web_mode.remove_instance(path, os.getpid())

    assert web_mode.read_instance(path)["token"] == "newer"


@pytest.mark.skipif(sys.platform == "win32", reason="POSIX file modes")
def test_instance_file_is_readable_by_its_owner_only(tmp_path):
    path = tmp_path / "web_instance.json"

    web_mode.write_instance(str(path), 5123, 1, "secret")

    assert path.stat().st_mode & 0o077 == 0


def test_path_guard_protects_the_instance_file(tmp_path):
    assert path_guard.is_protected(str(tmp_path / "web_instance.json"))
    assert path_guard.is_protected(str(tmp_path / "web_instance.json.1a2b3c4d.part"))


def test_free_port_is_free_on_loopback():
    port = web_mode.free_port()

    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", port))


def test_ui_folder_defaults_to_the_vite_build_of_a_source_checkout():
    assert web_mode.ui_dir_from_args(["--web"]) == str(REPO / "dist")
    assert web_mode.ui_dir_from_args(["--web", "--ui-dir", "some/ui"]) == os.path.abspath("some/ui")


def test_the_server_listens_on_127_0_0_1_only_and_answers_its_own_token(ui, web_env, monkeypatch):
    from backend import main
    token = "integration-token"
    monkeypatch.setenv("AUTO_CLIPPER_WEB_MODE", "1")
    monkeypatch.setenv("AUTO_CLIPPER_UI_DIR", str(ui))
    monkeypatch.setenv("AUTO_CLIPPER_WEB_TOKEN", token)
    port = web_mode.free_port()
    server = web_mode.make_server(main.app, port)
    thread = threading.Thread(target=server.run, daemon=True)
    thread.start()
    try:
        deadline = time.monotonic() + 30
        while not server.started and time.monotonic() < deadline:
            time.sleep(0.05)
        assert server.started
        assert server.config.host == "127.0.0.1"
        assert {sock.getsockname()[0] for srv in server.servers for sock in srv.sockets} == {"127.0.0.1"}
        assert web_mode.instance_alive({"port": port, "pid": os.getpid(), "token": token})
        assert not web_mode.instance_alive({"port": port, "pid": os.getpid(), "token": "wrong"})
    finally:
        server.should_exit = True
        thread.join(timeout=10)
    assert not web_mode.instance_alive({"port": port, "pid": 1, "token": token}, timeout=0.5)


def test_backend_main_with_web_flag_runs_the_launcher(tmp_path):
    env = dict(os.environ, AUTO_CLIPPER_WORKSPACE=str(tmp_path / "library"), AUTO_CLIPPER_NO_BROWSER="1")

    result = subprocess.run(
        [sys.executable, "-m", "backend.main", "--web", "--ui-dir", str(tmp_path / "missing")],
        cwd=str(REPO), env=env, capture_output=True, text=True, timeout=180,
    )

    assert result.returncode == 1
    assert "was not found" in result.stdout
```

- [ ] **Step 2: Run them to see them fail**

Run: `C:\Users\dhima\projects\ac-venv\Scripts\python.exe -m pytest backend/tests/test_web_mode.py -q -p no:cacheprovider`
Expected: FAIL at collection, `ImportError: cannot import name 'web_mode' from 'backend'`.

- [ ] **Step 3: Write `backend/web_mode.py`**

```python
"""Local web mode launcher: ``backend --web [--ui-dir PATH]`` (SP1, spec 4.4, ADR-013).

Started by "Auto Clipper Web" (scripts/web_launcher.py on Windows, the .command
and .sh scripts on macOS and Linux). One instance per computer:

- web_instance.json in the app data folder holds {port, pid, token} of the
  running server (file mode 0600, refused by path_guard).
- If that server still answers with that token, the launcher only opens a
  browser tab on it and exits.
- Otherwise it takes a free port on 127.0.0.1, makes a new token, switches on
  web mode (backend.web_ui), opens http://127.0.0.1:<port>/#t=<token> once the
  server is up, and prints the console message. Closing the window stops the
  server; a file left behind by a killed window is detected as stale.

The console text goes to the stream ``launch`` is given. Besides main's
__main__ block this is the only backend module that writes to the console
(AGENTS.md A.2); the desktop sidecar handshake is not involved.
"""
import json
import os
import secrets
import socket
import sys
import threading
import time
import urllib.error
import urllib.request
import webbrowser
from typing import Callable, Optional, TextIO

from backend.logger import get_app_data_dir, log_error
from backend.web_ui import UI_DIR_ENV, WEB_MODE_ENV

INSTANCE_FILE_NAME = "web_instance.json"
TOKEN_ENV = "AUTO_CLIPPER_WEB_TOKEN"
# Set by the CI smoke test (scripts/smoke_web_package.py): no browser on the build machine.
NO_BROWSER_ENV = "AUTO_CLIPPER_NO_BROWSER"
HOST = "127.0.0.1"

RUNNING_TEXT = (
    "Auto Clipper berjalan. Jangan tutup jendela ini selama memakai aplikasi.\n"
    "Auto Clipper is running. Do not close this window while you use the app.\n"
)
ALREADY_RUNNING_TEXT = (
    "Auto Clipper sudah berjalan di jendela lain. Tab baru dibuka di browser.\n"
    "Auto Clipper is already running in another window. A new tab was opened in your browser.\n"
)
ADDRESS_TEXT = (
    "\nBila browser tidak terbuka sendiri, salin alamat ini ke browser:\n"
    "If your browser did not open, copy this address into it:\n"
    "{url}\n"
)
MISSING_UI_TEXT = (
    "Tampilan aplikasi tidak ditemukan di {folder}. Unduh ulang paket Auto Clipper Web, lalu ekstrak semua isinya.\n"
    "The app's interface was not found in {folder}. Download the Auto Clipper Web package again and extract everything.\n"
)


# --- instance file ------------------------------------------------------------------------------

def instance_path(data_dir: Optional[str] = None) -> str:
    return os.path.join(data_dir or get_app_data_dir(), INSTANCE_FILE_NAME)


def read_instance(path: str) -> Optional[dict]:
    """{port, pid, token} of the last launch, or None when the file is missing or unusable."""
    try:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
    except (OSError, ValueError):
        return None
    if not isinstance(data, dict):
        return None
    port, pid, token = data.get("port"), data.get("pid"), data.get("token")
    if not isinstance(port, int) or not isinstance(pid, int) or not isinstance(token, str) or not token:
        return None
    return {"port": port, "pid": pid, "token": token}


def write_instance(path: str, port: int, pid: int, token: str) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    temp = f"{path}.{secrets.token_hex(4)}.part"
    fd = os.open(temp, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        json.dump({"port": port, "pid": pid, "token": token}, f)
    os.replace(temp, path)


def remove_instance(path: str, pid: int) -> None:
    """Remove the file while it still names this process (a newer launch may have replaced it)."""
    info = read_instance(path)
    if info and info["pid"] == pid:
        try:
            os.remove(path)
        except OSError as e:
            log_error("web_mode.remove_instance", e)


# --- server -------------------------------------------------------------------------------------

def app_url(port: int, token: str) -> str:
    return f"http://{HOST}:{port}/#t={token}"


def _status(request: urllib.request.Request, timeout: float) -> Optional[int]:
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return response.status
    except urllib.error.HTTPError as e:
        return e.code
    except (OSError, ValueError):
        return None


def instance_alive(info: dict, timeout: float = 2.0) -> bool:
    """True when an Auto Clipper web server with this token answers on that port.

    "/" answers only in web mode (a desktop sidecar on a reused port does not
    serve the UI), and /heartbeat answers 200 in web mode only with the token.
    """
    base = f"http://{HOST}:{info['port']}"
    if _status(urllib.request.Request(f"{base}/"), timeout) != 200:
        return False
    beat = urllib.request.Request(
        f"{base}/heartbeat", data=b"", method="POST", headers={"Authorization": f"Bearer {info['token']}"},
    )
    return _status(beat, timeout) == 200


def free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind((HOST, 0))
        return s.getsockname()[1]


def make_server(app, port: int):
    """A uvicorn server bound to 127.0.0.1 only: other devices on the network cannot reach it."""
    import uvicorn
    return uvicorn.Server(uvicorn.Config(app, host=HOST, port=port, reload=False, log_level="warning"))


def run_server(app, port: int, on_ready: Callable[[], None]) -> None:
    """Serve until the window is closed (or Ctrl+C); call ``on_ready`` once the port accepts connections."""
    server = make_server(app, port)

    def announce_when_up():
        deadline = time.monotonic() + 120
        while not server.started and not server.should_exit and time.monotonic() < deadline:
            time.sleep(0.1)
        if server.started:
            on_ready()

    threading.Thread(target=announce_when_up, daemon=True).start()
    server.run()


def open_in_browser(url: str) -> bool:
    if os.environ.get(NO_BROWSER_ENV):
        return False
    try:
        return bool(webbrowser.open(url))
    except Exception as e:
        log_error("web_mode.open_in_browser", e)
        return False


# --- arguments ----------------------------------------------------------------------------------

def default_ui_dir() -> str:
    """app/ui next to the backend in the package, else the Vite build (dist/) of a source checkout."""
    if getattr(sys, "frozen", False):
        exe_dir = os.path.dirname(os.path.abspath(sys.executable))
        # Windows/Linux onefile: app/backend(.exe) -> app/ui; macOS onedir: app/backend/backend -> app/ui.
        for candidate in (os.path.join(exe_dir, "ui"), os.path.join(os.path.dirname(exe_dir), "ui")):
            if os.path.isdir(candidate):
                return candidate
        return os.path.join(exe_dir, "ui")
    return os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "dist")


def ui_dir_from_args(argv: list) -> str:
    if "--ui-dir" in argv:
        i = argv.index("--ui-dir")
        if i + 1 < len(argv):
            return os.path.abspath(argv[i + 1])
    return default_ui_dir()


# --- launch -------------------------------------------------------------------------------------

def _say(stream: Optional[TextIO], text: str) -> None:
    try:
        stream.write(text)
        stream.flush()
    except (OSError, ValueError, AttributeError):
        pass  # no console (closed or never attached): the browser tab is enough


def launch(app, argv: list, stream: Optional[TextIO], *,
           serve: Callable = run_server,
           open_browser: Callable[[str], bool] = open_in_browser,
           is_alive: Callable[[dict], bool] = instance_alive,
           data_dir: Optional[str] = None) -> int:
    """Run the local web app, or hand over to the instance that already runs. Returns the exit code."""
    ui = ui_dir_from_args(argv)
    if not os.path.isfile(os.path.join(ui, "index.html")):
        log_error("web_mode.launch", f"index.html not found in {ui}", exc_info=False)
        _say(stream, MISSING_UI_TEXT.format(folder=ui))
        return 1

    path = instance_path(data_dir)
    running = read_instance(path)
    if running and is_alive(running):
        url = app_url(running["port"], running["token"])
        open_browser(url)
        _say(stream, ALREADY_RUNNING_TEXT + ADDRESS_TEXT.format(url=url))
        return 0

    port = free_port()
    token = secrets.token_urlsafe(32)
    os.environ[WEB_MODE_ENV] = "1"
    os.environ[UI_DIR_ENV] = ui
    os.environ[TOKEN_ENV] = token
    write_instance(path, port, os.getpid(), token)
    url = app_url(port, token)

    def on_ready():
        open_browser(url)
        _say(stream, RUNNING_TEXT + ADDRESS_TEXT.format(url=url))

    try:
        serve(app, port, on_ready)
    finally:
        remove_instance(path, os.getpid())
    return 0
```

- [ ] **Step 4: Protect the instance file in `backend/path_guard.py`**

Replace (from Task 7)

```python
# video_signing.key (signs /video links, backend.video_sign) and its temp copies while it is written
_PRIVATE_FILE_PREFIXES = ("video_signing.key",)
```

with

```python
# video_signing.key (signs /video links, backend.video_sign) and web_instance.json (port and
# token of the local web server, backend.web_mode), with their temp copies while they are written
_PRIVATE_FILE_PREFIXES = ("video_signing.key", "web_instance.json")
```

and in the module docstring change `the key that signs /video links (video_signing.key)` to `the key that signs /video links (video_signing.key), the local web token (web_instance.json)`.

- [ ] **Step 5: Start the launcher from `backend/main.py`**

At the start of the `if __name__ == "__main__":` block at the end of the file, before the existing `try:` (the comment lines `# Setup logger and cleanup old temp files` / `# freeze_support already called at the top of the file` stay above it), insert:

```python
    if "--web" in sys.argv[1:]:
        # Local web mode (spec 4.4): no PORT:/TOKEN: handshake and no watchdog;
        # the console window owns the server. The launcher writes the console text.
        if _original_stdout is not None:
            sys.stdout = _original_stdout
        if _original_stderr is not None:
            sys.stderr = _original_stderr
        try:
            from backend.web_mode import launch
            sys.exit(launch(app, sys.argv[1:], sys.stdout))
        except Exception as e:
            log_error("Backend web mode", e)
            sys.stderr.write(f"Auto Clipper Web tidak bisa dimulai / could not start: {e}\n")
            sys.stderr.flush()
            sys.exit(1)

```

- [ ] **Step 6: Run the tests to see them pass**

Run: `C:\Users\dhima\projects\ac-venv\Scripts\python.exe -m pytest backend/tests/test_web_mode.py -q -p no:cacheprovider`
Expected: 16 passed, 1 skipped (the POSIX file-mode test on Windows).

Run: `C:\Users\dhima\projects\ac-venv\Scripts\python.exe -m pytest backend/tests -q -p no:cacheprovider`
Expected: 760 passed, 9 skipped.

- [ ] **Step 7: Try the launcher by hand**

```powershell
npm run build
$env:AUTO_CLIPPER_WORKSPACE = "$env:TEMP\ac-sp1-web"
C:\Users\dhima\projects\ac-venv\Scripts\python.exe -m backend.main --web
```

Expected: the console shows the two "Auto Clipper berjalan / is running" lines and the address; the browser opens `http://127.0.0.1:<port>/#t=…` and the landing page appears (API calls still go to `127.0.0.1:8000` until Task 12, so the sidebar may say "Terputus"). `$env:TEMP\ac-sp1-web\web_instance.json` exists. In a second PowerShell window run the same command: it prints "Auto Clipper sudah berjalan…", opens a tab on the same port and exits. Press Ctrl+C in the first window: the server stops and `web_instance.json` is gone. Record in the progress log.

- [ ] **Step 8: Commit**

```bash
git add backend/web_mode.py backend/tests/test_web_mode.py backend/main.py backend/path_guard.py tasks/PROGRESS-LOG.md
git commit -m "$(cat <<'EOF'
feat(sp1): backend --web launcher, one instance per computer

Serves on 127.0.0.1 with a random free port and a new token per launch,
opens http://127.0.0.1:<port>/#t=<token> and prints the console text in
Indonesian and English. web_instance.json ({port, pid, token}, 0600,
refused by path_guard) lets a second launch open a tab on the running
server instead.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: Frontend: local adapter token and LocalGate

Spec 4.1 (local column), 5 and 6 ("adapter local membaca token dari `#t=` lalu menghapusnya dari alamat"). Replaces the Task 3 baseline local adapter.

**Files:**
- Create: `src/platform/local/token.ts`, `src/components/LocalGate.tsx`
- Test: `src/platform/local/local.test.ts`
- Modify: `src/platform/local/index.ts` (rewrite), `src/lib/localErrors.ts` (three codes), `src/App.tsx` (`gate()`), `src/locales/{id,en}.json`

**Interfaces:**
- Consumes: Task 2 `setApiUrl`, `API_URL`, `setAuthToken`, `getAuthToken`, `wireAuthOnce`, `UNAUTHORIZED_EVENT`, `CAPS`; Task 3 `browser.ts` helpers, `localStorageSecrets`, `parentDir`; Task 5 `gate()` in `App.tsx`; Task 9 `localErrorInfo`, `LOCAL_ERROR_CODES`; Task 10/11 backend: page origin = backend, `#t=<token>`, `/api/settings/whisper-models` needs the token.
- Produces:
  - `src/platform/local/token.ts`: `LOCAL_TOKEN_KEY = "ac_local_token"`, `BACKEND_LOST_EVENT = "ac_backend_lost"`, `takeLocalToken(win?: Window): string | null`, `LocalEnv { origin; dev; devBackend }`, `localEnv(): LocalEnv`, `resolveLocalBackend(env: LocalEnv, pageToken: string | null): BackendInfo`, `LocalGateState = "checking" | "ok" | "no_token" | "token_expired" | "server_closed"`, `initialGateState(env, token): LocalGateState`, `gateStateAfterCheck(status: number | null): LocalGateState`.
  - `src/platform/local/index.ts`: `createPlatform()`; `reconnect()` dispatches `BACKEND_LOST_EVENT` when the backend does not answer.
  - `src/components/LocalGate.tsx`: `LocalGate: React.FC<{ children: React.ReactNode }>`.
  - `LocalErrorCode` gains `"LOCAL_TOKEN_MISSING" | "LOCAL_TOKEN_EXPIRED" | "LOCAL_SERVER_CLOSED"`; locale keys `local_error.local_token_missing.*`, `local_error.local_token_expired.*`, `local_error.local_server_closed.*`, `local_gate.checking`.

- [ ] **Step 1: Write the failing test**

`src/platform/local/local.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// No real network in tests: the backend is "gone" whenever reconnect() checks it.
vi.mock("../browser", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../browser")>()),
  checkBackend: vi.fn(async () => false),
}));

import { getAuthToken } from "../auth";
import { API_URL } from "../backendUrl";
import { createPlatform } from "./index";
import {
  BACKEND_LOST_EVENT,
  gateStateAfterCheck,
  initialGateState,
  LOCAL_TOKEN_KEY,
  resolveLocalBackend,
  takeLocalToken,
} from "./token";

const BUILT = { origin: "http://127.0.0.1:5123", dev: false, devBackend: false };

function openAt(hash: string) {
  window.history.replaceState(null, "", `/${hash}`);
}

describe("takeLocalToken", () => {
  beforeEach(() => {
    sessionStorage.clear();
    openAt("");
  });

  it("reads #t= from the address, keeps it for this tab and removes it from the address", () => {
    openAt("#t=tok-123");

    expect(takeLocalToken()).toBe("tok-123");
    expect(sessionStorage.getItem(LOCAL_TOKEN_KEY)).toBe("tok-123");
    expect(window.location.hash).toBe("#/");
    expect(window.location.href).not.toContain("tok-123");
  });

  it("uses the token kept for this tab after a reload and leaves app routes alone", () => {
    sessionStorage.setItem(LOCAL_TOKEN_KEY, "tok-kept");
    openAt("#/history");

    expect(takeLocalToken()).toBe("tok-kept");
    expect(window.location.hash).toBe("#/history");
  });

  it("has no token in a tab opened by hand", () => {
    expect(takeLocalToken()).toBeNull();
  });
});

describe("resolveLocalBackend", () => {
  it("uses the page origin and the launch token in the built app", () => {
    expect(resolveLocalBackend(BUILT, "tok")).toEqual({ url: "http://127.0.0.1:5123", token: "tok" });
  });

  it("uses the backend started by hand under npm run dev", () => {
    expect(resolveLocalBackend({ ...BUILT, dev: true }, null)).toEqual({ url: "http://127.0.0.1:8000", token: "" });
    expect(resolveLocalBackend({ ...BUILT, dev: true, devBackend: true }, null)).toEqual({
      url: "http://127.0.0.1:8000",
      token: "dev-token",
    });
  });
});

describe("LocalGate decisions", () => {
  it("sends the user back to the launcher when the built app has no token", () => {
    expect(initialGateState(BUILT, "")).toBe("no_token");
    expect(initialGateState(BUILT, "tok")).toBe("checking");
    expect(initialGateState({ ...BUILT, dev: true }, "")).toBe("checking");
  });

  it("reads the answer to the token check", () => {
    expect(gateStateAfterCheck(200)).toBe("ok");
    expect(gateStateAfterCheck(500)).toBe("ok"); // the server is there and took the token
    expect(gateStateAfterCheck(401)).toBe("token_expired");
    expect(gateStateAfterCheck(null)).toBe("server_closed");
  });
});

describe("local platform", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.stubEnv("DEV", false);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("talks to the page origin with the token from the address", async () => {
    openAt("#t=tok-launch");

    const p = createPlatform();

    expect(await p.backend()).toEqual({ url: window.location.origin, token: "tok-launch" });
    expect(API_URL).toBe(window.location.origin);
    expect(getAuthToken()).toBe("tok-launch");
    expect(window.location.hash).toBe("#/");
    expect(p.kind).toBe("local");
    expect(p.caps.openFolder).toBe(true);
    expect(p.updater).toBeNull();
  });

  it("reports a closed server so LocalGate can say so", async () => {
    openAt("#t=tok-launch");
    const lost = vi.fn();
    window.addEventListener(BACKEND_LOST_EVENT, lost);

    expect(await createPlatform().reconnect()).toBeNull();
    expect(lost).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/platform/local`
Expected: FAIL, "Failed to resolve import ./token".

- [ ] **Step 3: Write `src/platform/local/token.ts`**

```ts
import type { BackendInfo } from "../types";

// Local web mode (spec 4.4, 5): the launcher opens http://127.0.0.1:<port>/#t=<token>.
// The token is kept in sessionStorage (this tab only) and removed from the address.
// No side effects on import: LocalGate imports this file directly.

export const LOCAL_TOKEN_KEY = "ac_local_token";
/** Fired on window when the backend cannot be reached any more (the launcher window was closed). */
export const BACKEND_LOST_EVENT = "ac_backend_lost";

const TOKEN_HASH = /^#t=([^&/]+)$/;

/** The launch token: from #t= (then removed from the address), else the one kept for this tab. */
export function takeLocalToken(win: Window = window): string | null {
  const match = TOKEN_HASH.exec(win.location.hash);
  if (match) {
    const token = decodeURIComponent(match[1]);
    try {
      win.sessionStorage.setItem(LOCAL_TOKEN_KEY, token);
    } catch {
      // Storage blocked: the token still works until this page is reloaded.
    }
    // HashRouter owns the hash: give it the start route, and keep the token out of history and bookmarks.
    win.history.replaceState(null, "", `${win.location.pathname}${win.location.search}#/`);
    return token;
  }
  try {
    return win.sessionStorage.getItem(LOCAL_TOKEN_KEY);
  } catch {
    return null;
  }
}

export interface LocalEnv {
  /** Origin of this page: the backend itself in web mode. */
  origin: string;
  /** `npm run dev`: the page comes from Vite and the backend runs by hand on 127.0.0.1:8000. */
  dev: boolean;
  /** VITE_DEV_BACKEND=true: that backend checks the token "dev-token". */
  devBackend: boolean;
}

export function localEnv(): LocalEnv {
  return {
    origin: window.location.origin,
    dev: import.meta.env.DEV,
    devBackend: import.meta.env.VITE_DEV_BACKEND === "true",
  };
}

export function resolveLocalBackend(env: LocalEnv, pageToken: string | null): BackendInfo {
  if (env.dev) return { url: "http://127.0.0.1:8000", token: env.devBackend ? "dev-token" : "" };
  return { url: env.origin, token: pageToken || "" };
}

export type LocalGateState = "checking" | "ok" | "no_token" | "token_expired" | "server_closed";

/** A built page without a token cannot work; `npm run dev` may run without one. */
export function initialGateState(env: LocalEnv, token: string): LocalGateState {
  return !env.dev && !token ? "no_token" : "checking";
}

/** What the answer to the token check means (null: no answer at all). */
export function gateStateAfterCheck(status: number | null): LocalGateState {
  if (status === null) return "server_closed";
  if (status === 401) return "token_expired";
  return "ok";
}
```

- [ ] **Step 4: Rewrite `src/platform/local/index.ts`**

```ts
import axios from "axios";
import { API_URL, setApiUrl } from "../backendUrl";
import { setAuthToken, wireAuthOnce } from "../auth";
import { browserDownload, browserNotify, checkBackend, openInBrowser, pickBrowserVideo } from "../browser";
import { CAPS } from "../caps";
import { localStorageSecrets } from "../localSecrets";
import { parentDir } from "../paths";
import type { BackendInfo, Platform } from "../types";
import { BACKEND_LOST_EVENT, localEnv, resolveLocalBackend, takeLocalToken } from "./token";

// Local web mode (spec 4.1, 4.4): the page is served by the backend that
// "Auto Clipper Web" started, so the backend is the page origin and the token
// comes from #t=. Under `npm run dev` the backend runs by hand on 127.0.0.1:8000.

let pageToken: string | null = null;

function connect(): BackendInfo {
  const info = resolveLocalBackend(localEnv(), pageToken);
  setApiUrl(info.url);
  setAuthToken(info.token || null);
  wireAuthOnce();
  return info;
}

export function createPlatform(): Platform {
  // Before the first render: HashRouter must not see "#t=…", and LocalGate needs the token.
  pageToken = takeLocalToken();
  connect();
  return {
    kind: "local",
    caps: CAPS.local,
    backend: async () => connect(),
    pickVideo: pickBrowserVideo,
    saveClip: browserDownload,
    async openFolder(path) {
      await axios.post(`${API_URL}/open_folder`, { path: parentDir(path) });
    },
    secrets: localStorageSecrets,
    notify: browserNotify,
    async reconnect() {
      if (await checkBackend(API_URL)) return connect();
      // A new launch uses a new port and token: this tab cannot get the server back.
      window.dispatchEvent(new CustomEvent(BACKEND_LOST_EVENT));
      return null;
    },
    openExternal: openInBrowser,
    pickFolder: async () => null,
    pickImage: async () => null,
    setPreventSleep: async () => {},
    updater: null,
  };
}
```

- [ ] **Step 5: Run the test to see it pass**

Run: `npx vitest run src/platform/local` → 9 passed.

- [ ] **Step 6: Add the error cards and their texts**

In `src/lib/localErrors.ts` replace

```ts
export const LOCAL_ERROR_CODES = ["VIDEO_LINK_REFUSED"] as const;
export type LocalErrorCode = (typeof LOCAL_ERROR_CODES)[number];

const ACTIONS: Record<LocalErrorCode, string[]> = {
  VIDEO_LINK_REFUSED: ["retry"],
};
```

with

```ts
export const LOCAL_ERROR_CODES = [
  "VIDEO_LINK_REFUSED",
  "LOCAL_TOKEN_MISSING",
  "LOCAL_TOKEN_EXPIRED",
  "LOCAL_SERVER_CLOSED",
] as const;
export type LocalErrorCode = (typeof LOCAL_ERROR_CODES)[number];

const ACTIONS: Record<LocalErrorCode, string[]> = {
  VIDEO_LINK_REFUSED: ["retry"],
  // Only a new tab from the launcher helps; a button here could not do it.
  LOCAL_TOKEN_MISSING: [],
  LOCAL_TOKEN_EXPIRED: [],
  LOCAL_SERVER_CLOSED: ["retry"],
};
```

Texts (Git Bash):

```bash
node scripts/add-locale-keys.mjs <<'JSON'
{
  "id": {
    "local_gate": { "checking": "Menghubungkan ke Auto Clipper…" },
    "local_error": {
      "local_token_missing": {
        "title": "Buka lewat \"Auto Clipper Web\"",
        "message": "Halaman ini dibuka tanpa kunci akses, jadi Auto Clipper tidak bisa dipakai di sini. Kunci itu hanya ikut di tab yang dibuka oleh \"Auto Clipper Web\". Klik dua kali \"Auto Clipper Web\" lagi; tab baru akan terbuka dan siap dipakai."
      },
      "local_token_expired": {
        "title": "Kunci akses tab ini sudah tidak berlaku",
        "message": "Auto Clipper sudah dijalankan ulang dengan kunci baru, jadi tab lama ini tidak bisa dipakai lagi. Klik dua kali \"Auto Clipper Web\" untuk membuka tab baru, lalu tutup tab ini."
      },
      "local_server_closed": {
        "title": "Jendela Auto Clipper sudah ditutup",
        "message": "Aplikasi berhenti saat jendela \"Auto Clipper Web\" (yang bertuliskan \"Auto Clipper berjalan\") ditutup. Buka lagi \"Auto Clipper Web\", lalu pakai tab baru yang terbuka."
      }
    }
  },
  "en": {
    "local_gate": { "checking": "Connecting to Auto Clipper…" },
    "local_error": {
      "local_token_missing": {
        "title": "Open it with \"Auto Clipper Web\"",
        "message": "This page was opened without its access key, so Auto Clipper cannot be used here. The key only comes with the tab that \"Auto Clipper Web\" opens. Double-click \"Auto Clipper Web\" again; a new tab opens, ready to use."
      },
      "local_token_expired": {
        "title": "This tab's access key is no longer valid",
        "message": "Auto Clipper was started again with a new key, so this old tab cannot be used any more. Double-click \"Auto Clipper Web\" to open a new tab, then close this one."
      },
      "local_server_closed": {
        "title": "The Auto Clipper window was closed",
        "message": "The app stops when the \"Auto Clipper Web\" window (the one that says \"Auto Clipper is running\") is closed. Open \"Auto Clipper Web\" again and use the new tab it opens."
      }
    }
  }
}
JSON
```

- [ ] **Step 7: Write `src/components/LocalGate.tsx`**

```tsx
import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { useTranslation } from "react-i18next";
import { ErrorCard } from "./ErrorCard";
import { localErrorInfo, type LocalErrorCode } from "../lib/localErrors";
import { getAuthToken, UNAUTHORIZED_EVENT } from "../platform/auth";
import { API_URL } from "../platform/backendUrl";
import {
  BACKEND_LOST_EVENT,
  gateStateAfterCheck,
  initialGateState,
  localEnv,
  type LocalGateState,
} from "../platform/local/token";

// Local web only (spec 5): the page needs the token the launcher put in the address,
// and the server lives only while the "Auto Clipper Web" window is open.

const CARDS: Record<"no_token" | "token_expired" | "server_closed", LocalErrorCode> = {
  no_token: "LOCAL_TOKEN_MISSING",
  token_expired: "LOCAL_TOKEN_EXPIRED",
  server_closed: "LOCAL_SERVER_CLOSED",
};

export const LocalGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { t } = useTranslation();
  const [state, setState] = useState<LocalGateState>(() => initialGateState(localEnv(), getAuthToken() || ""));

  const runCheck = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/api/settings/whisper-models`, { timeout: 15000 });
      setState(gateStateAfterCheck(res.status));
    } catch (err) {
      const status = (err as { response?: { status?: number } } | null)?.response?.status;
      setState(gateStateAfterCheck(typeof status === "number" ? status : null));
    }
  }, []);

  useEffect(() => {
    if (state === "checking") void runCheck();
  }, [state, runCheck]);

  useEffect(() => {
    const expired = () => setState("token_expired");
    const lost = () => setState("server_closed");
    window.addEventListener(UNAUTHORIZED_EVENT, expired);
    window.addEventListener(BACKEND_LOST_EVENT, lost);
    return () => {
      window.removeEventListener(UNAUTHORIZED_EVENT, expired);
      window.removeEventListener(BACKEND_LOST_EVENT, lost);
    };
  }, []);

  if (state === "ok") return <>{children}</>;

  if (state === "checking") {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center text-text-secondary">
        <div className="flex flex-col items-center gap-3" role="status">
          <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin" aria-hidden="true" />
          <span className="text-caption">{t("local_gate.checking")}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center p-6">
      <ErrorCard
        info={localErrorInfo(CARDS[state])}
        handlers={{ retry: () => setState("checking") }}
        announce
        className="w-full max-w-lg"
      />
    </div>
  );
};
```

- [ ] **Step 8: Use LocalGate in `src/App.tsx`**

Add `import { LocalGate } from "./components/LocalGate";` next to the `AuthGate` import, and replace `gate()` (Task 5) with:

```tsx
/** The sign-in step of each platform: the one place that checks the platform kind. */
function gate(content: React.ReactNode): React.ReactNode {
  const kind = platform().kind;
  if (kind === "cloud") return <AuthGate>{content}</AuthGate>;
  if (kind === "local") return <LocalGate>{content}</LocalGate>;
  return content;
}
```

- [ ] **Step 9: Run the checks**

Run: `npx vitest run` → all pass (`localErrors.test.ts` now covers four codes).
Run: `npm run build` → exit 0. Run: `npm run build:cloud` → exit 0. Run: `npx oxlint src` → 0 errors.

- [ ] **Step 10: Browser check of the whole local web app**

```powershell
npm run build
$env:AUTO_CLIPPER_WORKSPACE = "$env:TEMP\ac-sp1-web"
C:\Users\dhima\projects\ac-venv\Scripts\python.exe -m backend.main --web
```

Expected, and record each line in the progress log:
1. The tab opens; after loading, the address ends in `#/` (no token visible); landing page → app; sidebar "Terhubung".
2. Settings: API key providers present, no "Pilih Folder" row, no updater.
3. A job from an uploaded `.mp4` (Manual AI Editor) finishes; the clip plays; Download saves it through the browser; "Buka folder" opens the folder; Riwayat shows the job; Rerender All works.
4. Copy the address without `#t=…` into a new tab → the "Buka lewat \"Auto Clipper Web\"" card.
5. Run the same command in a second window → "Auto Clipper sudah berjalan…", a working new tab.
6. Ctrl+C in the first window, then click back into an open tab → the "Jendela Auto Clipper sudah ditutup" card; "Coba lagi" keeps showing it while the server is down.

Desktop dev check (`$env:VITE_DEV_BACKEND = "true"; npm run dev` with the dev backend of Task 3 Step 10) → the app still opens (LocalGate passes under `npm run dev`).

- [ ] **Step 11: Commit**

```bash
git add src tasks/PROGRESS-LOG.md
git commit -m "$(cat <<'EOF'
feat(sp1): local web adapter reads the launch token; LocalGate

The local adapter talks to the page origin with the token from #t=, keeps
it in sessionStorage and removes it from the address before HashRouter
starts. LocalGate shows an error card when the tab has no token, an old
token, or the launcher window was closed.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 13: Packaging: launchers, smoke test, CI zips for 4 targets, CI checks

Spec 4.6 and 6 (CI). The packages are built only in GitHub Actions; this machine can run the unit tests of the scripts, not the PyInstaller builds of the other OSes. Plan questions 4, 9, 11, 13, 14 and 15 apply.

**Files:**
- Create: `scripts/web_launcher.py`, `scripts/assemble_web_package.py`, `scripts/smoke_web_package.py`
- Create: `packaging/web/Auto Clipper Web.command`, `packaging/web/Auto Clipper Web.sh`, `packaging/web/BACA-SAYA.txt`, `.gitattributes`
- Create: `.github/workflows/web-package.yml`
- Test: `backend/tests/test_web_launcher_script.py`
- Modify: `.github/workflows/build.yml` (job `check-version` outputs, new job `web-package`), `.github/workflows/pr-check.yml` (new jobs `checks` and `web-package`), `.gitignore`

**Interfaces:**
- Consumes: Task 11 CLI `backend --web --ui-dir PATH`, console line `http://127.0.0.1:<port>/#t=<token>`, `RUNNING_TEXT` / `ALREADY_RUNNING_TEXT` wording ("Auto Clipper berjalan", "Auto Clipper is running", "sudah berjalan"), `AUTO_CLIPPER_NO_BROWSER`, exit codes (0, 1); Task 10 public paths and 401 rule; `GET /api/preflight` check `ffmpeg`; `backend.spec` outputs (`dist/backend.exe` Windows, `dist/backend` Linux, `dist/backend_app/` macOS); Task 1/5 `npm test`, `npm run lint`, `npm run build`, `npm run build:cloud`.
- Produces:
  - `scripts/web_launcher.py`: `package_dir() -> str`, `backend_command(base: str) -> list`, `main(base=None, run=subprocess.call, out=sys.stdout, wait=input) -> int`; built into `Auto Clipper Web.exe`.
  - `scripts/assemble_web_package.py`: `TARGETS = ("windows", "macos-arm64", "macos-x64", "linux")`, `assemble(target, out, *, backend_dist, ui_dist, ffmpeg, launcher_exe=None, packaging_dir) -> str`; CLI `python scripts/assemble_web_package.py <target> <out> --ffmpeg PATH [--launcher-exe PATH] [--backend-dist DIR] [--ui-dist DIR]`.
  - `scripts/smoke_web_package.py`: `parse_address(line) -> Optional[tuple[int, str]]`, `first_asset(html) -> Optional[str]`, `launcher_command(package) -> list`, `main(argv=None) -> int`.
  - Package layout `Auto Clipper Web/{Auto Clipper Web.exe|.command|.sh, BACA-SAYA.txt, app/{backend.exe | backend | backend/backend…}, app/ffmpeg(.exe), app/ui/}`, zipped as `Auto-Clipper-Web-<windows|macos-arm64|macos-x64|linux>.zip`.
  - Workflow `web-package.yml` (`workflow_call` with input `release-tag`, and `workflow_dispatch`); artifacts `Auto-Clipper-Web-<name>`.

- [ ] **Step 1: Write the failing tests**

`backend/tests/test_web_launcher_script.py`:

```python
"""Scripts of the local web package (SP1, spec 4.6): the Windows launcher, the package layout,
the macOS/Linux launch scripts and the CI smoke test."""
import importlib.util
import io
import os
import stat
import sys
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[2]
SCRIPTS = REPO / "scripts"
PACKAGING = REPO / "packaging" / "web"


def _load(name):
    spec = importlib.util.spec_from_file_location(name, SCRIPTS / f"{name}.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


# --- scripts/web_launcher.py (Auto Clipper Web.exe) ------------------------------------------

def test_launcher_runs_the_backend_in_web_mode_with_the_ui_next_to_it(tmp_path):
    launcher = _load("web_launcher")
    app = tmp_path / "app"
    app.mkdir()
    (app / "backend.exe").write_bytes(b"")
    ran = []

    code = launcher.main(str(tmp_path), run=lambda cmd: ran.append(cmd) or 0, out=io.StringIO(),
                         wait=lambda prompt: pytest.fail("no pause after a normal stop"))

    assert code == 0
    assert ran == [[str(app / "backend.exe"), "--web", "--ui-dir", str(app / "ui")]]


def test_launcher_keeps_the_window_open_when_the_backend_fails(tmp_path):
    launcher = _load("web_launcher")
    (tmp_path / "app").mkdir()
    (tmp_path / "app" / "backend.exe").write_bytes(b"")
    waited = []

    code = launcher.main(str(tmp_path), run=lambda cmd: 1, out=io.StringIO(), wait=lambda prompt: waited.append(prompt))

    assert code == 1
    assert waited and "Enter" in waited[0]


def test_launcher_explains_a_package_that_was_not_extracted(tmp_path):
    launcher = _load("web_launcher")
    out, waited = io.StringIO(), []

    code = launcher.main(str(tmp_path), run=lambda cmd: pytest.fail("nothing to run"), out=out,
                         wait=lambda prompt: waited.append(prompt))

    assert code == 1
    assert "ekstrak" in out.getvalue()
    assert "extract" in out.getvalue()
    assert waited


def test_launcher_survives_a_window_without_input(tmp_path):
    launcher = _load("web_launcher")

    def no_input(prompt):
        raise EOFError

    assert launcher.main(str(tmp_path), run=lambda cmd: 0, out=io.StringIO(), wait=no_input) == 1


# --- scripts/assemble_web_package.py ---------------------------------------------------------

def _fake_build(tmp_path, target):
    dist = tmp_path / "dist"
    if target == "windows":
        dist.mkdir()
        (dist / "backend.exe").write_bytes(b"exe")
    elif target == "linux":
        dist.mkdir()
        (dist / "backend").write_bytes(b"elf")
    else:
        (dist / "backend_app" / "_internal").mkdir(parents=True)
        (dist / "backend_app" / "backend").write_bytes(b"macho")
        (dist / "backend_app" / "_internal" / "lib.dylib").write_bytes(b"lib")
    ui = tmp_path / "web-ui"
    (ui / "assets").mkdir(parents=True)
    (ui / "index.html").write_text('<div id="root"></div>', encoding="utf-8")
    (ui / "assets" / "index-1.js").write_text("js", encoding="utf-8")
    ffmpeg = tmp_path / ("ffmpeg.exe" if target == "windows" else "ffmpeg")
    ffmpeg.write_bytes(b"ff")
    launcher = tmp_path / "Auto Clipper Web.exe"
    launcher.write_bytes(b"launcher")
    return dist, ui, ffmpeg, launcher


MAC_FILES = ["Auto Clipper Web.command", "BACA-SAYA.txt", "app/backend/backend", "app/backend/_internal/lib.dylib",
             "app/ffmpeg", "app/ui/assets/index-1.js", "app/ui/index.html"]
EXPECTED = {
    "windows": ["Auto Clipper Web.exe", "BACA-SAYA.txt", "app/backend.exe", "app/ffmpeg.exe",
                "app/ui/assets/index-1.js", "app/ui/index.html"],
    "linux": ["Auto Clipper Web.sh", "BACA-SAYA.txt", "app/backend", "app/ffmpeg",
              "app/ui/assets/index-1.js", "app/ui/index.html"],
    "macos-arm64": MAC_FILES,
    "macos-x64": MAC_FILES,
}


def _assemble(tmp_path, target):
    assemble = _load("assemble_web_package")
    dist, ui, ffmpeg, launcher = _fake_build(tmp_path, target)
    out = tmp_path / "pkg" / "Auto Clipper Web"
    assemble.assemble(target, str(out), backend_dist=str(dist), ui_dist=str(ui), ffmpeg=str(ffmpeg),
                      launcher_exe=str(launcher), packaging_dir=str(PACKAGING))
    return out


@pytest.mark.parametrize("target", sorted(EXPECTED))
def test_package_layout(tmp_path, target):
    out = _assemble(tmp_path, target)

    files = sorted(p.relative_to(out).as_posix() for p in out.rglob("*") if p.is_file())
    assert files == sorted(EXPECTED[target])


@pytest.mark.skipif(sys.platform == "win32", reason="POSIX file modes")
@pytest.mark.parametrize("target, programs", [
    ("linux", ["Auto Clipper Web.sh", "app/backend", "app/ffmpeg"]),
    ("macos-arm64", ["Auto Clipper Web.command", "app/backend/backend", "app/ffmpeg"]),
])
def test_launchers_and_programs_are_executable(tmp_path, target, programs):
    out = _assemble(tmp_path, target)

    for rel in programs:
        assert os.stat(out / rel).st_mode & stat.S_IXUSR, rel


def test_a_package_without_the_built_ui_is_refused(tmp_path):
    assemble = _load("assemble_web_package")
    dist, ui, ffmpeg, launcher = _fake_build(tmp_path, "linux")
    (ui / "index.html").unlink()

    with pytest.raises(SystemExit, match="index.html"):
        assemble.assemble("linux", str(tmp_path / "out"), backend_dist=str(dist), ui_dist=str(ui),
                          ffmpeg=str(ffmpeg), packaging_dir=str(PACKAGING))


def test_an_unknown_target_is_refused(tmp_path):
    assemble = _load("assemble_web_package")

    with pytest.raises(SystemExit, match="unknown target"):
        assemble.assemble("windows-arm", str(tmp_path / "out"), backend_dist=str(tmp_path), ui_dist=str(tmp_path),
                          ffmpeg=str(tmp_path / "ffmpeg"), packaging_dir=str(PACKAGING))


# --- packaging/web ---------------------------------------------------------------------------

@pytest.mark.parametrize("name, command", [
    ("Auto Clipper Web.command", '"$DIR/app/backend/backend" --web --ui-dir "$DIR/app/ui"'),
    ("Auto Clipper Web.sh", '"$DIR/app/backend" --web --ui-dir "$DIR/app/ui"'),
])
def test_unix_launchers_start_the_backend_in_web_mode(name, command):
    text = (PACKAGING / name).read_bytes()

    assert text.startswith(b"#!/usr/bin/env bash\n")
    assert b"\r\n" not in text  # bash on macOS/Linux fails on CRLF; .gitattributes keeps LF
    assert command.encode() in text


def test_readme_explains_every_os_in_both_languages():
    text = (PACKAGING / "BACA-SAYA.txt").read_text(encoding="utf-8")

    for phrase in ("Windows", "macOS", "Linux", "Run anyway", "Open", "Jangan tutup", "Do not close", "#t="):
        assert phrase in text, phrase


# --- scripts/smoke_web_package.py ------------------------------------------------------------

def test_smoke_test_reads_the_address_line():
    smoke = _load("smoke_web_package")

    assert smoke.parse_address("http://127.0.0.1:5123/#t=abc-_DEF09\n") == (5123, "abc-_DEF09")
    assert smoke.parse_address("Auto Clipper berjalan. Jangan tutup jendela ini selama memakai aplikasi.") is None


def test_smoke_test_finds_the_script_of_the_built_page():
    smoke = _load("smoke_web_package")
    html = '<script type="module" crossorigin src="./assets/index-AbC1.js"></script>'

    assert smoke.first_asset(html) == "assets/index-AbC1.js"
    assert smoke.first_asset("<html></html>") is None
```

- [ ] **Step 2: Run them to see them fail**

Run: `C:\Users\dhima\projects\ac-venv\Scripts\python.exe -m pytest backend/tests/test_web_launcher_script.py -q -p no:cacheprovider`
Expected: FAIL, `FileNotFoundError` for `scripts/web_launcher.py` (and the other scripts and packaging files).

- [ ] **Step 3: Write `scripts/web_launcher.py`**

```python
"""Source of "Auto Clipper Web.exe", the launcher of the Windows web package (SP1, spec 4.6).

Runs app\\backend.exe --web --ui-dir app\\ui in this console window and waits.
Closing the window stops both. Built in CI with PyInstaller (--onefile --console),
see .github/workflows/web-package.yml.
"""
import os
import subprocess
import sys

MISSING = (
    "File aplikasi tidak lengkap: {path} tidak ada. Unduh ulang Auto-Clipper-Web-windows.zip, "
    "lalu ekstrak semua isinya ke satu folder sebelum membuka Auto Clipper Web.\n"
    "The app files are incomplete: {path} is missing. Download Auto-Clipper-Web-windows.zip again "
    "and extract everything into one folder before opening Auto Clipper Web.\n"
)
PRESS_ENTER = "Tekan Enter untuk menutup jendela ini. / Press Enter to close this window. "


def package_dir() -> str:
    if getattr(sys, "frozen", False):
        return os.path.dirname(os.path.abspath(sys.executable))
    return os.path.dirname(os.path.abspath(__file__))


def backend_command(base: str) -> list:
    app = os.path.join(base, "app")
    return [os.path.join(app, "backend.exe"), "--web", "--ui-dir", os.path.join(app, "ui")]


def _pause(wait) -> None:
    """Keep the window open so the message can be read."""
    try:
        wait(PRESS_ENTER)
    except (EOFError, KeyboardInterrupt, OSError):
        pass


def main(base=None, run=subprocess.call, out=sys.stdout, wait=input) -> int:
    command = backend_command(base or package_dir())
    if not os.path.isfile(command[0]):
        out.write(MISSING.format(path=command[0]))
        out.flush()
        _pause(wait)
        return 1
    try:
        code = run(command)
    except KeyboardInterrupt:
        return 0
    if code != 0:
        _pause(wait)
    return code


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 4: Write the macOS and Linux launchers, the readme and `.gitattributes`**

`.gitattributes` (repo root):

```
# Launch scripts of the local web package run under bash on macOS and Linux: LF only.
*.sh text eol=lf
*.command text eol=lf
```

`packaging/web/Auto Clipper Web.command` (LF line endings):

```bash
#!/usr/bin/env bash
# Auto Clipper Web (macOS). Double-click to start; the first time: right-click > Open.
# Keep this Terminal window open while you use the app. Closing it stops Auto Clipper.
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Files from a downloaded zip carry the quarantine flag. The user already allowed this
# script with right-click > Open; allow the bundled backend and FFmpeg too (plan question 11).
xattr -dr com.apple.quarantine "$DIR" 2>/dev/null || true

"$DIR/app/backend/backend" --web --ui-dir "$DIR/app/ui"
status=$?
if [ $status -ne 0 ]; then
  echo
  read -r -p "Tekan Enter untuk menutup / Press Enter to close. " _
fi
exit $status
```

`packaging/web/Auto Clipper Web.sh` (LF line endings):

```bash
#!/usr/bin/env bash
# Auto Clipper Web (Linux). Start it with "Run as a Program" or: bash "Auto Clipper Web.sh"
# Keep its terminal window open while you use the app. Closing it stops Auto Clipper.
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Started from a file manager without a terminal: open one, so the window can be seen and closed.
if [ ! -t 1 ] && [ -z "$AUTO_CLIPPER_IN_TERMINAL" ] && { [ -n "$DISPLAY" ] || [ -n "$WAYLAND_DISPLAY" ]; }; then
  export AUTO_CLIPPER_IN_TERMINAL=1
  for term in x-terminal-emulator gnome-terminal konsole xfce4-terminal xterm; do
    if command -v "$term" >/dev/null 2>&1; then
      if [ "$term" = "gnome-terminal" ]; then
        exec gnome-terminal -- bash "$DIR/Auto Clipper Web.sh"
      fi
      exec "$term" -e bash "$DIR/Auto Clipper Web.sh"
    fi
  done
fi

"$DIR/app/backend" --web --ui-dir "$DIR/app/ui"
status=$?
if [ $status -ne 0 ]; then
  echo
  read -r -p "Tekan Enter untuk menutup / Press Enter to close. " _
fi
exit $status
```

`packaging/web/BACA-SAYA.txt`:

```
AUTO CLIPPER WEB
================
(English below)

Auto Clipper Web menjalankan Auto Clipper di browser komputer Anda, tanpa memasang aplikasi.
Video diproses di komputer ini. Data hanya keluar saat Anda mengunduh video dari internet
atau memakai penyedia AI dengan API key.

Cara memakai
1. Ekstrak seluruh isi zip ini ke satu folder, misalnya Dokumen/Auto Clipper Web.
   Jangan membukanya langsung dari dalam zip.
2. Klik dua kali "Auto Clipper Web".
   - Windows: bila muncul "Windows protected your PC", klik "More info", lalu "Run anyway".
     Paket ini belum ditandatangani Microsoft, jadi peringatan ini muncul pada pembukaan pertama.
   - macOS: pada pembukaan pertama, klik kanan "Auto Clipper Web.command", pilih "Open",
     lalu "Open" lagi. Paket ini belum ditandatangani Apple.
     Pilih zip yang cocok: macos-arm64 untuk Mac Apple Silicon (M1 dan sesudahnya),
     macos-x64 untuk Mac Intel.
   - Linux: klik kanan "Auto Clipper Web.sh", pilih "Run as a Program" atau "Run in Terminal".
     Bisa juga dari terminal: bash "Auto Clipper Web.sh"
3. Jendela bertuliskan "Auto Clipper berjalan" terbuka, lalu browser membuka aplikasinya.
   Jangan tutup jendela itu selama memakai aplikasi. Menutupnya menghentikan Auto Clipper.
4. Bila browser tidak terbuka sendiri, salin alamat yang tertulis di jendela itu ke browser.
5. Tab tertutup? Klik dua kali "Auto Clipper Web" lagi; tab baru terbuka.
   Alamat tanpa bagian #t=... (kunci akses) tidak bisa dipakai.

Model Whisper (pengubah suara ke teks) diunduh saat pertama dipakai.
Riwayat, klip, dan pengaturan disimpan di folder data Auto Clipper, sama dengan aplikasi desktop:
   Windows: %APPDATA%\AutoClipper
   macOS:   ~/Library/Application Support/AutoClipper
   Linux:   ~/.local/share/AutoClipper
Untuk menghapus Auto Clipper Web, hapus folder hasil ekstrak ini. Folder data tetap ada.

------------------------------------------------------------------------------------------

Auto Clipper Web runs Auto Clipper in your computer's browser, without installing an app.
Videos are processed on this computer. Data only leaves it when you download a video from
the internet or use an AI provider with an API key.

How to use
1. Extract everything in this zip into one folder, for example Documents/Auto Clipper Web.
   Do not open it from inside the zip.
2. Double-click "Auto Clipper Web".
   - Windows: if "Windows protected your PC" appears, click "More info", then "Run anyway".
     The package is not signed by Microsoft, so the warning appears the first time.
   - macOS: the first time, right-click "Auto Clipper Web.command", choose "Open", then
     "Open" again. The package is not signed by Apple.
     Pick the right zip: macos-arm64 for Apple Silicon Macs (M1 and later),
     macos-x64 for Intel Macs.
   - Linux: right-click "Auto Clipper Web.sh" and choose "Run as a Program" or "Run in Terminal".
     Or from a terminal: bash "Auto Clipper Web.sh"
3. A window that says "Auto Clipper is running" opens, then your browser opens the app.
   Do not close that window while you use the app. Closing it stops Auto Clipper.
4. If your browser did not open, copy the address shown in that window into it.
5. Closed the tab? Double-click "Auto Clipper Web" again; a new tab opens.
   An address without the #t=... part (the access key) does not work.

The Whisper model (speech to text) is downloaded the first time it is used.
History, clips and settings are kept in the Auto Clipper data folder, the same one the
desktop app uses (see the folders above). To remove Auto Clipper Web, delete the extracted
folder. The data folder stays.
```

- [ ] **Step 5: Write `scripts/assemble_web_package.py`**

```python
"""Puts the local web package together (SP1, spec 4.6). Used by .github/workflows/web-package.yml.

    python scripts/assemble_web_package.py <target> <out folder> --ffmpeg PATH [--launcher-exe PATH]

<out folder> ("Auto Clipper Web", zipped by the workflow):

    Auto Clipper Web.exe | Auto Clipper Web.command | Auto Clipper Web.sh
    BACA-SAYA.txt
    app/backend.exe            Windows (PyInstaller onefile, dist/backend.exe)
    app/backend                Linux (onefile, dist/backend)
    app/backend/backend + ...  macOS (onedir, dist/backend_app/)
    app/ffmpeg(.exe)           ffmpeg-static@5; the backend looks next to itself and one folder up
    app/ui/                    the Vite build (npm run build -- --outDir web-ui)
"""
import argparse
import os
import shutil
import stat
import sys

TARGETS = ("windows", "macos-arm64", "macos-x64", "linux")
REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _fail(message: str) -> None:
    raise SystemExit(f"assemble_web_package: {message}")


def _make_executable(path: str) -> None:
    mode = os.stat(path).st_mode
    os.chmod(path, mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)


def assemble(target: str, out: str, *, backend_dist: str = os.path.join(REPO, "dist"),
             ui_dist: str = os.path.join(REPO, "web-ui"), ffmpeg: str, launcher_exe: str = None,
             packaging_dir: str = os.path.join(REPO, "packaging", "web")) -> str:
    if target not in TARGETS:
        _fail(f"unknown target {target!r}; use one of {', '.join(TARGETS)}")
    if not os.path.isfile(os.path.join(ui_dist, "index.html")):
        _fail(f"{ui_dist} has no index.html: run `npm run build -- --outDir web-ui` first")
    if not os.path.isfile(ffmpeg):
        _fail(f"FFmpeg not found at {ffmpeg}")
    if target == "windows" and not (launcher_exe and os.path.isfile(launcher_exe)):
        _fail("the Windows package needs --launcher-exe (Auto Clipper Web.exe)")

    if os.path.exists(out):
        shutil.rmtree(out)
    app = os.path.join(out, "app")
    os.makedirs(app)
    shutil.copytree(ui_dist, os.path.join(app, "ui"))
    shutil.copy2(os.path.join(packaging_dir, "BACA-SAYA.txt"), os.path.join(out, "BACA-SAYA.txt"))

    if target == "windows":
        shutil.copy2(os.path.join(backend_dist, "backend.exe"), os.path.join(app, "backend.exe"))
        shutil.copy2(ffmpeg, os.path.join(app, "ffmpeg.exe"))
        shutil.copy2(launcher_exe, os.path.join(out, "Auto Clipper Web.exe"))
        return out

    if target == "linux":
        backend = os.path.join(app, "backend")
        shutil.copy2(os.path.join(backend_dist, "backend"), backend)
        launcher = os.path.join(out, "Auto Clipper Web.sh")
    else:
        # onedir: keep symlinks (Python.framework inside _internal) so the ad-hoc signatures stay valid.
        shutil.copytree(os.path.join(backend_dist, "backend_app"), os.path.join(app, "backend"), symlinks=True)
        backend = os.path.join(app, "backend", "backend")
        launcher = os.path.join(out, "Auto Clipper Web.command")
    shutil.copy2(os.path.join(packaging_dir, os.path.basename(launcher)), launcher)
    ffmpeg_out = os.path.join(app, "ffmpeg")
    shutil.copy2(ffmpeg, ffmpeg_out)
    for path in (backend, ffmpeg_out, launcher):
        _make_executable(path)
    return out


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="Assemble the Auto Clipper Web package.")
    parser.add_argument("target", choices=TARGETS)
    parser.add_argument("out")
    parser.add_argument("--ffmpeg", required=True)
    parser.add_argument("--launcher-exe", default=None)
    parser.add_argument("--backend-dist", default=os.path.join(REPO, "dist"))
    parser.add_argument("--ui-dist", default=os.path.join(REPO, "web-ui"))
    args = parser.parse_args(argv)
    out = assemble(args.target, os.path.abspath(args.out), backend_dist=args.backend_dist, ui_dist=args.ui_dist,
                   ffmpeg=args.ffmpeg, launcher_exe=args.launcher_exe)
    print(f"Package ready: {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 6: Write `scripts/smoke_web_package.py`**

```python
"""CI smoke test of an assembled local web package (SP1, spec 4.6 and 6).

    python scripts/smoke_web_package.py "<package folder>"

Starts "Auto Clipper Web" the way a user does (the .exe, .command or .sh) with the
app data in a temporary folder and no browser (AUTO_CLIPPER_NO_BROWSER), then checks:
the console prints the text and the address with the token; "/" and its script load
without a token; /history needs the token; FFmpeg is found (preflight); a second
launch hands over to the first; the server stops with its window. Exit code 0 when
everything holds.
"""
import json
import os
import re
import signal
import subprocess
import sys
import tempfile
import threading
import time
import urllib.error
import urllib.request
from typing import Optional

ADDRESS = re.compile(r"http://127\.0\.0\.1:(\d+)/#t=([A-Za-z0-9_\-]+)")
ASSET = re.compile(r'src="\.?/?(assets/[^"]+\.js)"')
START_TIMEOUT = 300  # a onefile backend unpacks itself first, and CI disks are slow


def parse_address(line: str) -> Optional[tuple]:
    match = ADDRESS.search(line)
    return (int(match.group(1)), match.group(2)) if match else None


def first_asset(html: str) -> Optional[str]:
    match = ASSET.search(html)
    return match.group(1) if match else None


def launcher_command(package: str) -> list:
    if sys.platform == "win32":
        return [os.path.join(package, "Auto Clipper Web.exe")]
    if sys.platform == "darwin":
        return ["/bin/bash", os.path.join(package, "Auto Clipper Web.command")]
    return ["/bin/bash", os.path.join(package, "Auto Clipper Web.sh")]


def _request(url: str, token: Optional[str] = None, method: str = "GET"):
    """(status, content type, body); status None when nothing answers."""
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    req = urllib.request.Request(url, headers=headers, method=method, data=b"" if method == "POST" else None)
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            return response.status, response.headers.get("Content-Type", ""), response.read()
    except urllib.error.HTTPError as e:
        return e.code, e.headers.get("Content-Type", ""), e.read()
    except OSError:
        return None, "", b""


class Launch:
    """One double-click on the launcher; its console output is collected in a thread."""

    def __init__(self, package: str, env: dict):
        extra = {"creationflags": subprocess.CREATE_NEW_PROCESS_GROUP} if sys.platform == "win32" else {"start_new_session": True}
        self.proc = subprocess.Popen(
            launcher_command(package), stdout=subprocess.PIPE, stderr=subprocess.STDOUT, stdin=subprocess.DEVNULL,
            env=env, text=True, encoding="utf-8", errors="replace", **extra,
        )
        self.lines = []
        self.reader = threading.Thread(target=self._read, daemon=True)
        self.reader.start()

    def _read(self):
        for line in self.proc.stdout:
            sys.stdout.write(f"  | {line}")
            self.lines.append(line)

    def output(self) -> str:
        return "".join(self.lines)

    def wait_for_address(self, timeout: float) -> Optional[tuple]:
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            found = parse_address(self.output())
            if found:
                return found
            if self.proc.poll() is not None:
                self.reader.join(timeout=5)
                return parse_address(self.output())
            time.sleep(0.5)
        return None

    def stop(self):
        if self.proc.poll() is None:
            if sys.platform == "win32":
                subprocess.run(["taskkill", "/F", "/T", "/PID", str(self.proc.pid)], capture_output=True, check=False)
            else:
                os.killpg(self.proc.pid, signal.SIGTERM)
            try:
                self.proc.wait(timeout=30)
            except subprocess.TimeoutExpired:
                self.proc.kill()
        self.reader.join(timeout=5)


def main(argv=None) -> int:
    args = sys.argv[1:] if argv is None else argv
    package = os.path.abspath(args[0])
    results = []

    def check(ok: bool, what: str) -> None:
        results.append((bool(ok), what))
        print(f"{'OK  ' if ok else 'FAIL'} {what}")

    with tempfile.TemporaryDirectory(prefix="ac-web-smoke-") as data:
        env = dict(os.environ, AUTO_CLIPPER_WORKSPACE=data, AUTO_CLIPPER_NO_BROWSER="1", PYTHONIOENCODING="utf-8")
        first = Launch(package, env)
        base = None
        try:
            address = first.wait_for_address(START_TIMEOUT)
            check(address is not None, "the launcher prints http://127.0.0.1:<port>/#t=<token>")
            if address:
                port, token = address
                base = f"http://127.0.0.1:{port}"
                check("Auto Clipper berjalan" in first.output() and "Auto Clipper is running" in first.output(),
                      "the console text is in Indonesian and English")
                status, _, body = _request(f"{base}/")
                check(status == 200 and b'id="root"' in body, "GET / serves index.html without a token")
                asset = first_asset(body.decode("utf-8", "replace"))
                check(asset is not None, "index.html links its script")
                if asset:
                    status, content_type, _ = _request(f"{base}/{asset}")
                    check(status == 200 and content_type.startswith("text/javascript"), f"GET /{asset} is JavaScript")
                check(_request(f"{base}/history")[0] == 401, "GET /history without the token is refused")
                status, _, body = _request(f"{base}/history", token)
                check(status == 200 and json.loads(body or b"{}").get("status") == "success", "GET /history with the token works")
                status, _, body = _request(f"{base}/api/preflight", token)
                levels = {c.get("id"): c.get("level") for c in json.loads(body or b"{}").get("checks", [])} if status == 200 else {}
                check(levels.get("ffmpeg") == "ok", f"FFmpeg is found (preflight ffmpeg: {levels.get('ffmpeg')})")

                second = Launch(package, env)
                try:
                    code = second.proc.wait(timeout=START_TIMEOUT)
                except subprocess.TimeoutExpired:
                    code = None
                second.stop()
                check(code == 0 and "sudah berjalan" in second.output() and f":{port}/#t={token}" in second.output(),
                      "a second launch opens the running server instead of a new one")
        finally:
            first.stop()
        if base:
            check(_request(f"{base}/health")[0] is None, "the server stops with its window")

    failed = [what for ok, what in results if not ok]
    print(f"\n{len(results) - len(failed)} of {len(results)} checks passed.")
    return 1 if failed or not results else 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 7: Run the tests to see them pass**

Run: `C:\Users\dhima\projects\ac-venv\Scripts\python.exe -m pytest backend/tests/test_web_launcher_script.py -q -p no:cacheprovider`
Expected: 15 passed, 2 skipped (the POSIX file-mode tests on Windows).

Run: `git ls-files --eol "packaging/web/*"` after `git add packaging .gitattributes` → the two scripts show `i/lf w/lf`.

- [ ] **Step 8: Write `.github/workflows/web-package.yml`**

```yaml
name: Web Package

# "Auto Clipper Web" for Windows, macOS (Apple Silicon and Intel) and Linux: the same
# PyInstaller backend as the desktop app (backend.spec), ffmpeg-static@5 and the built
# UI (SP1 spec 4.6, ADR-013). Called by build.yml (release) and pr-check.yml; can also
# be run by hand from the Actions tab.

on:
  workflow_call:
    inputs:
      release-tag:
        description: "Upload the zips to this GitHub release (empty: workflow artifacts only)"
        type: string
        default: ""
  workflow_dispatch:

permissions:
  contents: read

jobs:
  package:
    strategy:
      fail-fast: false
      matrix:
        include:
          - os: windows-latest
            name: windows
            python-arch: x64
            pip-constraints: ""
          - os: macos-14
            name: macos-arm64
            python-arch: arm64
            pip-constraints: "-c backend/constraints-macos12.txt"
          # Intel image after macos-13 was retired (plan question 9).
          - os: macos-15-intel
            name: macos-x64
            python-arch: x64
            pip-constraints: "-c backend/constraints-macos12.txt"
          - os: ubuntu-22.04
            name: linux
            python-arch: x64
            pip-constraints: ""
    runs-on: ${{ matrix.os }}

    env:
      MACOSX_DEPLOYMENT_TARGET: "11.0"

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'

      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'
          architecture: ${{ matrix.python-arch }}

      - name: System libraries for OpenCV (Linux)
        if: runner.os == 'Linux'
        run: sudo apt-get update && sudo apt-get install -y libgl1 libglib2.0-0

      - name: Install Node.js dependencies (downloads ffmpeg-static for this OS)
        run: npm ci

      - name: Build the UI
        # Into web-ui/: PyInstaller writes to dist/ in the next steps.
        run: npm run build -- --outDir web-ui

      - name: Install Python dependencies
        run: |
          python -m pip install --upgrade pip
          pip install -r backend/requirements.txt ${{ matrix.pip-constraints }}
          pip install pyinstaller

      - name: Build the backend (same backend.spec as the desktop app)
        run: pyinstaller --clean backend.spec -y

      - name: Build "Auto Clipper Web.exe" (Windows)
        if: runner.os == 'Windows'
        shell: bash
        run: >
          pyinstaller --onefile --console --name "Auto Clipper Web"
          --icon "$GITHUB_WORKSPACE/src-tauri/icons/icon.ico"
          --distpath launcher-dist --workpath launcher-build --specpath launcher-build
          scripts/web_launcher.py

      - name: Ad-hoc codesign the backend (macOS)
        if: runner.os == 'macOS'
        run: |
          find dist/backend_app -type f \( -name '*.dylib' -o -name '*.so' -o -perm +111 \) \
            -exec codesign --force --sign - {} \;
          codesign --verify --verbose dist/backend_app/backend

      - name: Assemble the package
        shell: bash
        run: |
          FFMPEG="$(node -e "console.log(require('ffmpeg-static'))")"
          python scripts/assemble_web_package.py ${{ matrix.name }} "pkg/Auto Clipper Web" \
            --ffmpeg "$FFMPEG" --launcher-exe "launcher-dist/Auto Clipper Web.exe"

      - name: Ad-hoc codesign FFmpeg and check the architecture (macOS)
        if: runner.os == 'macOS'
        run: |
          codesign --force --sign - "pkg/Auto Clipper Web/app/ffmpeg" || true
          file "pkg/Auto Clipper Web/app/ffmpeg" "pkg/Auto Clipper Web/app/backend/backend"

      - name: Smoke test (start, serve, token, FFmpeg, second launch, stop)
        shell: bash
        run: python scripts/smoke_web_package.py "pkg/Auto Clipper Web"

      - name: Zip (Windows)
        if: runner.os == 'Windows'
        shell: pwsh
        run: Compress-Archive -Path "pkg/Auto Clipper Web" -DestinationPath "Auto-Clipper-Web-${{ matrix.name }}.zip"

      - name: Zip (macOS, keeps symlinks and permissions)
        if: runner.os == 'macOS'
        run: ditto -c -k --sequesterRsrc --keepParent "pkg/Auto Clipper Web" "Auto-Clipper-Web-${{ matrix.name }}.zip"

      - name: Zip (Linux, keeps symlinks and permissions)
        if: runner.os == 'Linux'
        run: cd pkg && zip -qry "../Auto-Clipper-Web-${{ matrix.name }}.zip" "Auto Clipper Web"

      - name: Upload the zip
        uses: actions/upload-artifact@v4
        with:
          name: Auto-Clipper-Web-${{ matrix.name }}
          path: Auto-Clipper-Web-${{ matrix.name }}.zip
          retention-days: 14
          compression-level: 0

  release:
    needs: package
    if: inputs.release-tag != ''
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - name: Download the zips
        uses: actions/download-artifact@v4
        with:
          pattern: Auto-Clipper-Web-*
          merge-multiple: true

      - name: Attach the zips to the release
        env:
          GH_TOKEN: ${{ github.token }}
        run: gh release upload "${{ inputs.release-tag }}" Auto-Clipper-Web-*.zip --clobber --repo "${{ github.repository }}"
```

- [ ] **Step 9: Call it from the release and PR workflows**

`.github/workflows/build.yml`, job `check-version`:
- under `outputs:` add `version: ${{ steps.check.outputs.version }}`;
- as the first line of the `run: |` script of step `check` add `echo "version=$(jq -r .version package.json)" >> $GITHUB_OUTPUT`.

At the end of `build.yml` add the job:

```yaml
  web-package:
    # After the desktop build: tauri-action creates the release app-v<version>; the zips are attached to it.
    needs: [check-version, build]
    if: needs.check-version.outputs.changed == 'true'
    uses: ./.github/workflows/web-package.yml
    permissions:
      contents: write
    with:
      release-tag: app-v${{ needs.check-version.outputs.version }}
```

`.github/workflows/pr-check.yml`: add at the end of `jobs:`

```yaml
  checks:
    # Spec SP1 section 6: Vitest, oxlint, the cloud build and pytest on every PR.
    runs-on: ubuntu-22.04
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'

      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'

      - name: System libraries (FFmpeg, OpenCV)
        run: sudo apt-get update && sudo apt-get install -y ffmpeg libgl1 libglib2.0-0

      - name: Install dependencies
        run: |
          npm ci
          python -m pip install --upgrade pip
          pip install -r backend/requirements.txt

      - name: Vitest
        run: npm test

      - name: oxlint
        run: npm run lint

      - name: Cloud build (VITE_TARGET=cloud)
        run: npm run build:cloud

      - name: Backend tests
        run: python -m pytest backend/tests -q -p no:cacheprovider

  web-package:
    uses: ./.github/workflows/web-package.yml
    permissions:
      contents: read
```

`.gitignore`: after the `# Build & Binaries (PyInstaller)` block add

```
# Local web package (web-package.yml)
web-ui/
pkg/
launcher-build/
launcher-dist/
Auto-Clipper-Web-*.zip
```

- [ ] **Step 10: Run the checks**

Run: `C:\Users\dhima\projects\ac-venv\Scripts\python.exe -m pytest backend/tests -q -p no:cacheprovider`
Expected: 775 passed, 11 skipped.

Run: `npx vitest run` → all pass. Run: `npm run build` → exit 0. Run: `npm run build:cloud` → exit 0.

Check the workflow files are valid YAML: `C:\Users\dhima\projects\ac-venv\Scripts\python.exe -c "import yaml,sys; [yaml.safe_load(open(f, encoding='utf-8')) for f in sys.argv[1:]]; print('ok')" .github/workflows/web-package.yml .github/workflows/build.yml .github/workflows/pr-check.yml` → `ok` (if PyYAML is missing: `C:\Users\dhima\projects\ac-venv\Scripts\python.exe -m pip install pyyaml` first).

- [ ] **Step 11: Local package try-out on Windows (optional, about 10 minutes)**

Only if PyInstaller is installed in the venv (`C:\Users\dhima\projects\ac-venv\Scripts\python.exe -m PyInstaller --version`); otherwise skip and rely on CI.

```powershell
npm run build -- --outDir web-ui
C:\Users\dhima\projects\ac-venv\Scripts\python.exe -m PyInstaller --clean backend.spec -y
C:\Users\dhima\projects\ac-venv\Scripts\python.exe -m PyInstaller --onefile --console --name "Auto Clipper Web" --icon "$PWD\src-tauri\icons\icon.ico" --distpath launcher-dist --workpath launcher-build --specpath launcher-build scripts\web_launcher.py
C:\Users\dhima\projects\ac-venv\Scripts\python.exe scripts\assemble_web_package.py windows "pkg\Auto Clipper Web" --ffmpeg node_modules\ffmpeg-static\ffmpeg.exe --launcher-exe "launcher-dist\Auto Clipper Web.exe"
C:\Users\dhima\projects\ac-venv\Scripts\python.exe scripts\smoke_web_package.py "pkg\Auto Clipper Web"
```

Expected: every smoke check `OK`, last line `N of N checks passed.`, exit 0. Record the result (or "skipped, no PyInstaller") in the progress log.

- [ ] **Step 12: Commit**

```bash
git add scripts/web_launcher.py scripts/assemble_web_package.py scripts/smoke_web_package.py packaging .gitattributes .gitignore .github/workflows backend/tests/test_web_launcher_script.py tasks/PROGRESS-LOG.md
git commit -m "$(cat <<'EOF'
build(sp1): Auto Clipper Web zips for Windows, macOS arm64/x64 and Linux

web-package.yml builds each package from backend.spec, ffmpeg-static@5 and
the UI build, runs a smoke test (console text, UI without token, API with
token, FFmpeg found, second launch hands over) and attaches
Auto-Clipper-Web-<os>.zip to the release. PR Check also runs Vitest,
oxlint, the cloud build, pytest and the four packages.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

The owner can now run "Web Package" from the Actions tab on this branch (workflow_dispatch) and try the zips: put the result in the progress log when it comes back.

---

### Task 14: Delete `web/`, docs, ADR-013, AGENTS.md, version 1.19.0, roadmap

Spec section 7 step 6.

**Files:**
- Delete: `web/` (whole folder), `scripts/check-web-strings.mjs`
- Create: `docs/decisions/013-single-frontend-local-web-signed-video-links.md`
- Modify: `.agents/AGENTS.md`, `README.md`, `docs/tutorial-auto-clipper-cloud.md`, `docs/panduan-penggunaan-awam.md`, `docs/cloud-architecture-plan.md`, `CHANGELOG.md`, `package.json`, `package-lock.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, `file_version_info.txt`, `docs/superpowers/specs/2026-11-12-enhancement-roadmap.md`, `tasks/roadmap-todo.md`, `tasks/PROGRESS-LOG.md`

**Interfaces:**
- Consumes: everything from Tasks 1-13 (names quoted in the docs below must match them).
- Produces: version 1.19.0 everywhere; ADR-013; the owner's manual checklist in `tasks/PROGRESS-LOG.md`.

- [ ] **Step 1: Prove nothing outside `web/` still needs it**

Run: `git grep -n -I -e "web/src" -e "from \"../web" -e "cd web" -e "web/package.json" -- . ":!web" ":!docs/superpowers" ":!tasks" ":!CHANGELOG.md" ":!docs/decisions/012-*" ":!docs/cloud-architecture-plan.md"`
Expected output: only `README.md` (Opsi 5, `cd web && npm run dev`), `docs/tutorial-auto-clipper-cloud.md` (the `web/src/api.ts` tip), `.agents/AGENTS.md` (section 3 list) and `scripts/check-web-strings.mjs`. All of them change in this task.

- [ ] **Step 2: Delete**

```bash
git rm -r -q web scripts/check-web-strings.mjs
```

Run: `npx vitest run`, `npm run build`, `npm run build:cloud`, `npx oxlint src` → all pass / exit 0. Run the backend tests → 775 passed, 11 skipped.

- [ ] **Step 3: Commit the deletion**

```bash
git commit -m "$(cat <<'EOF'
refactor(sp1): delete web/; src/ is the only frontend

The cloud app is now built from src/ (npm run build:cloud). The one-off
check that web/ texts are in src/locales goes with it.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 4: Write ADR-013**

`docs/decisions/013-single-frontend-local-web-signed-video-links.md`:

````markdown
# ADR-013: Satu Frontend untuk Desktop, Web Lokal, dan Cloud; Alamat Video Bertanda Tangan

- **Status**: Accepted
- **Date**: 2026-11-18
- **Context**: SP1 "Frontend tunggal dan web lokal", rilis v1.19.0. Spec: `docs/superpowers/specs/2026-11-18-sp1-single-frontend-web-local-design.md`. Rencana: `docs/superpowers/plans/2026-11-18-sp1-single-frontend-web-local.md`

---

## 1. Konteks & Masalah

1. Ada dua frontend yang hampir kembar: `src/` (desktop, React 18) dan `web/` (Colab lewat Vercel, React 19). Komponen yang sama ditulis dua kali dan mulai berbeda; setiap perbaikan UI di SP0 dikerjakan dua kali.
2. Belum ada cara memakai Auto Clipper di browser tanpa memasang aplikasi desktop.
3. `GET /video` dikecualikan dari cek token (temuan T0.19): siapa pun yang tahu alamat tunnel Colab bisa mengambil `.mp4` apa pun di folder yang diizinkan.

## 2. Keputusan Arsitektur

### A. Satu frontend dengan lapisan platform (`src/platform/`)
- Semua yang berbeda antar platform ada di satu objek `Platform`: `kind`, `caps` (`apiKeys`, `localFilePicker`, `driveBrowser`, `openFolder`, `updater`, `preventSleep`), `backend()`, `pickVideo()`, `saveClip()`, `openFolder()`, `secrets`, `notify()`, ditambah `reconnect()`, `openExternal()`, `pickFolder()`, `pickImage()`, `setPreventSleep()` dan `updater` yang dibutuhkan untuk memindahkan semua panggilan Tauri.
- Pemilihan saat start: `window.__TAURI_INTERNALS__` ada → desktop; build `VITE_TARGET=cloud` → cloud; selain itu → local. Adapter dimuat dengan import dinamis, jadi build local dan cloud tidak menjalankan kode Tauri.
- `@tauri-apps/*` hanya diimpor di `src/platform/desktop/`; uji Vitest `src/platform/imports.test.ts` memindai sumber.
- Komponen memeriksa `caps`, bukan `kind`. Pengecualian: pilihan gerbang (`AuthGate` untuk cloud, `LocalGate` untuk web lokal) dan halaman pembuka di `App.tsx`.
- Toolchain `src/` disamakan dengan `web/`: React 19, Vite 8, TypeScript 6, `@vitejs/plugin-react` 6, oxlint, dan Vitest (baru). Teks hanya di `src/locales/{id,en}.json`.
- Cloud dibangun dari root repo: `npm run build:cloud` (`vite build --mode cloud`, `.env.cloud`) dengan setelan di `vercel.json`. `web/` dihapus.

### B. Alamat video bertanda tangan (`backend/video_sign.py`)
- `sig = HMAC_SHA256(kunci, path kanonik)`, tanpa waktu kedaluwarsa. Kunci 32 byte acak di `video_signing.key` dalam folder data aplikasi (di Colab ikut ke Drive; selama Drive belum ter-mount di `drive_mount.local_dir()`), dibuat sekali, dibaca dari file setiap dipakai. Link tetap berlaku setelah restart; menghapus file kunci membatalkan semua link.
- `GET /video` mewajibkan `sig` di ketiga platform. Urutan: `path_guard` → tanda tangan → folder yang diizinkan → file `.mp4`. Penolakan: 403 `Access denied`.
- Link dibuat saat data dibaca (`clips` di `GET /jobs/{id}`, `result_clips` di `GET /history`) dan lewat `POST /video-url` (bertoken) untuk path lain. Link tidak pernah disimpan di `history.db`. Pengecualian token di middleware persis `path == "/video"`.
- Frontend tidak menyusun URL `/video`. `ClipCard` meminta link baru sekali bila pemutar ditolak, lalu menampilkan kartu error.
- Konsekuensi yang diterima: link yang tersebar tetap membuka klip itu (hanya klip itu) selama server dan alamatnya sama.

### C. Mode web lokal (`backend/web_ui.py`, `backend/web_mode.py`)
- `backend --web`: bind `127.0.0.1` saja, port acak, token acak per peluncuran. Backend menyajikan `/` (`index.html`), `/assets/*`, dan file gambar di root folder UI. Navigasi memakai `HashRouter`, jadi tidak ada fallback SPA yang bisa menutupi endpoint API.
- Tanpa token di mode ini: `/`, `/assets/*`, file gambar root UI, `/health`; `/video` memakai `sig`. Semua yang lain, termasuk `/heartbeat`, wajib token.
- Satu instance per komputer: `web_instance.json` (`{port, pid, token}`, mode 0600, ditolak `path_guard`). Instance dianggap hidup bila `/` menjawab 200 dan `POST /heartbeat` dengan tokennya menjawab 200; peluncur kedua hanya membuka tab baru.
- Peluncur membuka `http://127.0.0.1:<port>/#t=<token>` dan menulis "Auto Clipper berjalan. Jangan tutup jendela ini selama memakai aplikasi." (id + en) beserta alamatnya. Frontend menyimpan token di `sessionStorage` dan menghapusnya dari alamat; `LocalGate` menangani token hilang, token lama, dan jendela yang ditutup.
- Tidak ada watchdog di mode web: jendela konsol adalah pemilik server.

### D. Paket "Auto Clipper Web"
- `.github/workflows/web-package.yml` membangun `Auto-Clipper-Web-<windows|macos-arm64|macos-x64|linux>.zip` dari `backend.spec` yang sama dengan desktop (onefile di Windows/Linux, onedir di macOS), `ffmpeg-static@5`, dan build UI; uji asap di CI; zip dilampirkan ke rilis `app-v<versi>`.
- Peluncur: `Auto Clipper Web.exe` (`scripts/web_launcher.py`), `Auto Clipper Web.command` (macOS), `Auto Clipper Web.sh` (Linux). Tidak ditandatangani; `BACA-SAYA.txt` menjelaskan SmartScreen dan klik kanan → Open.
- Folder data sama dengan aplikasi desktop.

### E. Kartu error buatan frontend
- Kegagalan yang tidak bisa dilaporkan backend (link video ditolak, token lokal hilang atau lama, server lokal ditutup) memakai `localErrorInfo()` (`src/lib/localErrors.ts`) dengan teks id/en di `src/locales` (`local_error.*`) dan dirender `ErrorCard`. Ini pengecualian sempit dari AGENTS.md E.12.

## 3. Konsekuensi

- Satu kode frontend; perbaikan UI cukup sekali.
- Pengguna tanpa instalasi bisa memakai Auto Clipper di browser.
- `/video` tidak lagi terbuka tanpa token atau tanda tangan.
- Pengguna cloud mendapat halaman desktop (Manual AI Editor, Riwayat), yang kurang nyaman di layar HP: dicatat untuk SP2.
- Paket web lokal tidak ditandatangani: Windows SmartScreen dan macOS Gatekeeper memperingatkan.
- Setelan Vercel (Root Directory kosong, Node 22.x) harus diubah pemilik saat PR akhir digabung.
- Desktop dan web lokal memakai folder data yang sama (riwayat, cookies, kunci video).

## 4. Pertanyaan Terbuka

Lihat bagian "Questions for the owner" di rencana SP1. Keputusan bawaan yang dipakai tercatat di sana.
````

- [ ] **Step 5: Update `.agents/AGENTS.md`**

Section 1, replace the two lines

```
- **Frontend Desktop**: Tauri v2 (Rust) + React 18 + TypeScript + Vite + Tailwind CSS + Lucide React + React Router.
- **Frontend Web (Cloud UI)**: Terletak di folder `web/`. Menggunakan React 18 + TypeScript + Vite + Tailwind CSS untuk antarmuka web murni (tanpa Tauri).
```

with

```
- **Frontend (satu kode, `src/`)**: React 19 + TypeScript 6 + Vite 8 + Tailwind CSS 3 + Lucide React + React Router (`HashRouter`), uji Vitest, lint oxlint. Berjalan di tiga platform lewat `src/platform/` (ADR-013): **desktop** (dibungkus Tauri v2), **web lokal** (disajikan backend `--web`, paket "Auto Clipper Web"), dan **cloud** (Vercel, `npm run build:cloud` dengan `VITE_TARGET=cloud`, backend di Colab). Folder `web/` sudah dihapus.
```

A.2, append to the end of the item: ` Pengecualian: mode web lokal (`--web`) tidak memakai handshake; `backend/web_mode.launch` menulis teks konsol ke stream yang diberikan blok `__main__` (ADR-013).`

E.7, replace the whole item with:

```
7. ~~**Web UI Draft State Invariant**~~: dihapus bersama `web/` (SP1, ADR-013).
```

E.14, replace `dan log `backend_*.log`.` with `log `backend_*.log`, kunci video `video_signing.key`, dan file instance web lokal `web_instance.json`.`

After E.16 add:

```
17. **Alamat Video Bertanda Tangan (ADR-013)**: `GET /video` **WAJIB** menolak (403) `sig` yang hilang atau salah di semua platform, sesudah `path_guard` dan sebelum pemeriksaan folder. `sig` hanya dibuat `backend/video_sign.py` (`HMAC_SHA256(video_signing.key, path kanonik)`, tanpa kedaluwarsa). Link ditambahkan saat data klip dibaca (`with_video_urls` di `GET /jobs/{id}` dan `GET /history`) atau lewat `POST /video-url`, dan **tidak pernah** disimpan di `history.db`. Pengecualian token di `verify_token` persis `path == "/video"`. Frontend tidak boleh menyusun URL `/video` sendiri (dijaga `src/lib/videoUrl.test.ts`).
18. **Mode Web Lokal (ADR-013)**: `backend --web` hanya bind ke `127.0.0.1`, port acak, token acak per peluncuran, satu instance per komputer (`web_instance.json`). Di mode ini hanya `/`, `/assets/*`, file gambar root UI, dan `/health` yang tanpa token (`web_ui.is_public_path`); `/video` memakai `sig`; yang lain, termasuk `/heartbeat`, wajib token. Tidak ada watchdog heartbeat di mode ini.
```

Section F, replace items 2 and 3 with:

```
2. Notifikasi lewat `platform().notify()`: desktop memakai `@tauri-apps/plugin-notification`; web lokal dan cloud memakai Notification API browser bila diizinkan, selain itu toast.
3. Proses rendering video mencegah OS tidur lewat `platform().setPreventSleep()` hanya bila `platform().caps.preventSleep` (desktop).
```

and after item 5 add:

```
6. **Lapisan Platform (ADR-013)**: Semua yang berbeda antar platform lewat `platform()` dari `src/platform/`. `@tauri-apps/*` hanya diimpor di `src/platform/desktop/` dan `__TAURI_INTERNALS__` hanya muncul di `src/platform/` (uji `src/platform/imports.test.ts`). Komponen memeriksa `platform().caps`, bukan `platform().kind`; pemeriksaan `kind` hanya untuk pilihan gerbang (`AuthGate`/`LocalGate`) dan halaman pembuka di `App.tsx`.
7. **Kartu Error Buatan Frontend**: Kegagalan yang tidak bisa dilaporkan backend (link video ditolak, token web lokal hilang atau lama, server web lokal ditutup) memakai `localErrorInfo()` dari `src/lib/localErrors.ts`, teksnya di `src/locales` (`local_error.*`), dan dirender `ErrorCard`.
8. **Uji Frontend**: `npm test` (Vitest), `npm run lint` (oxlint), `npm run build` (desktop dan web lokal), `npm run build:cloud` (cloud). Teks id dan en wajib punya kunci yang sama (`src/locales/locales.test.ts`); kunci baru ditambahkan dengan `node scripts/add-locale-keys.mjs`.
```

Section G, after item 7 add:

```
8. **Paket Web Lokal (ADR-013)**: `.github/workflows/web-package.yml` membangun `Auto-Clipper-Web-<windows|macos-arm64|macos-x64|linux>.zip` dari `backend.spec` yang sama, `ffmpeg-static@5`, dan build UI (`npm run build -- --outDir web-ui`, karena PyInstaller menulis ke `dist/`). Susunan paket diatur `scripts/assemble_web_package.py` dan diuji `scripts/smoke_web_package.py` di CI. Skrip `.sh`/`.command` wajib berakhiran baris LF (`.gitattributes`).
```

Section H item 2, replace with:

```
2. Selalu jalankan unit test backend dengan `pytest` di folder `backend/tests/`, `npm test` dan `npm run lint`, serta validasi build frontend (`npm run build` dan `npm run build:cloud`) sebelum menyelesaikan task besar.
```

Section 3: change `ADR-001 s/d ADR-012` to `ADR-001 s/d ADR-013`; change `- `src/App.tsx`: Routing, splash screen, startup update check.` to `- `src/App.tsx`: Routing, splash screen, startup update check, pilihan gerbang per platform (`AuthGate`/`LocalGate`).`; replace the last five lines (from `- `src/components/ErrorCard.tsx`, `CookiesPanel.tsx`, `TimingDetails.tsx` (dan pasangannya di `web/src/components/`)…` to the `web/src/components/ClipEditModal.tsx` line) with:

```
- `src/components/ErrorCard.tsx`, `CookiesPanel.tsx`, `TimingDetails.tsx`: Kartu error generik, panel unggah cookies, dan "Detail waktu".
- `src/platform/`: Lapisan platform (`types.ts`, `caps.ts`, `index.ts`, adapter `desktop/`, `local/`, `cloud/`), alamat backend (`backendUrl.ts`) dan token (`auth.ts`).
- `src/components/AuthGate.tsx` (cloud), `src/components/LocalGate.tsx` (web lokal), `src/components/GDriveBrowserModal.tsx` (cloud): gerbang masuk per platform dan penjelajah Google Drive.
- `src/lib/videoUrl.ts`, `src/hooks/useSignedVideo.ts`: alamat video bertanda tangan dari backend dan permintaan link baru sekali.
- `src/lib/errorActions.ts`, `src/lib/localErrors.ts`: aksi kartu error per platform dan kartu error buatan frontend.
- `backend/video_sign.py`: Kunci `video_signing.key` dan tanda tangan `/video`.
- `backend/web_ui.py`, `backend/web_mode.py`: Mode web lokal (menyajikan UI, aturan token) dan peluncur `--web` (satu instance, browser, teks konsol).
- `scripts/web_launcher.py`, `scripts/assemble_web_package.py`, `scripts/smoke_web_package.py`, `packaging/web/`: Peluncur Windows, susunan paket, uji asap CI, skrip peluncur macOS/Linux, dan `BACA-SAYA.txt`.
- `.github/workflows/web-package.yml`: Build paket web lokal empat OS (dipanggil `build.yml` dan `pr-check.yml`).
- `vercel.json`, `.env.cloud`: Build cloud dari root repo.
```

Run: `git grep -n "web/" .agents/AGENTS.md` → only the lines that say `web/` was deleted.

- [ ] **Step 6: Update the user docs**

`README.md`, Opsi 5 step 4, replace `(misal `https://clipper.dhims.web.id` yang di-deploy di Vercel, atau lokal `cd web && npm run dev`).` with `(misal `https://clipper.dhims.web.id` yang di-deploy di Vercel dari root repo dengan `npm run build:cloud`; untuk mencobanya di komputer: `npm run dev -- --mode cloud`).` After the Opsi 5 block (before the `---` line above "_Dibuat untuk para kreator…_") add:

```markdown
### Opsi 6: Auto Clipper Web (di Browser, Tanpa Instalasi)

Untuk komputer yang tidak mau dipasangi aplikasi desktop. Semua proses tetap berjalan di komputer Anda.

1. Unduh zip yang cocok dari [halaman rilis](https://github.com/DhimasPH/auto-clipper/releases): `Auto-Clipper-Web-windows.zip`, `Auto-Clipper-Web-macos-arm64.zip` (Mac Apple Silicon), `Auto-Clipper-Web-macos-x64.zip` (Mac Intel), atau `Auto-Clipper-Web-linux.zip`.
2. Ekstrak seluruh isinya ke satu folder, lalu klik dua kali **Auto Clipper Web** (macOS, pertama kali: klik kanan → **Open**; Windows: bila SmartScreen muncul, **More info** → **Run anyway**).
3. Jendela bertuliskan "Auto Clipper berjalan" terbuka dan browser membuka aplikasinya. Jangan tutup jendela itu selama memakai aplikasi.

Panduan lengkapnya ada di `BACA-SAYA.txt` di dalam zip. Untuk developer: `npm run build`, lalu `python -m backend.main --web`.
```


`docs/tutorial-auto-clipper-cloud.md`:
- line 67: `Vercel["React + Vite Single-Page Wizard<br/>(Root Folder: web/)"]` → `Vercel["React + Vite (src/, build: npm run build:cloud)"]`
- line 272: replace the sentence with `Frontend Web Auto Clipper memakai kode yang sama dengan aplikasi desktop (folder `src/`, **React 19 + Vite 8 + Tailwind CSS**) dan dibangun dengan `VITE_TARGET=cloud`.`
- replace the whole "Langkah 5.2" subsection (heading to the line before "### Langkah 5.3") with:

```markdown
### Langkah 5.2: Konfigurasi Root Directory & Build Settings

Sejak v1.19.0 aplikasi web dibangun dari folder utama repositori. Setelan build ada di file `vercel.json`, jadi Anda cukup:
- **Project Name:** `auto-clipper-web` (atau sesuai preferensi Anda).
- **Root Directory:** biarkan kosong (folder utama). Jangan pilih folder `web` (folder itu sudah dihapus).
- **Framework Preset, Build Command, Output Directory, Install Command:** biarkan bawaan. Vercel memakai isi `vercel.json`: `vite`, `npm run build:cloud`, `dist`, `npm ci`.
- **Node.js Version** (Settings → Build and Deployment): `22.x`.

> [!IMPORTANT]
> **Proyek Vercel lama (Root Directory `web`):** buka **Settings → Build and Deployment**, kosongkan **Root Directory**, pilih Node.js **22.x**, simpan, lalu **Redeploy**. Tanpa langkah ini deploy berikutnya gagal karena folder `web` sudah tidak ada.
```

- in the 5.3 tip, replace `File [`web/src/api.ts`](../web/src/api.ts) secara otomatis membaca` with `File [`src/platform/cloud/index.ts`](../src/platform/cloud/index.ts) secara otomatis membaca`.
- replace section 6 (from `## 6. SOP Pengoperasian Harian via Smartphone (4-Step Wizard)` to the line before `## 7.`) with:

```markdown
## 6. SOP Pengoperasian Harian via Smartphone

Sejak v1.19.0 aplikasi web memakai halaman yang sama dengan aplikasi desktop. Alurnya:

### Langkah 0: Masuk
1. Pastikan notebook Colab sudah berjalan sampai server menyala.
2. Buka alamat Vercel Anda di browser HP, tekan **Masuk ke Workspace**, lalu masukkan kode akses (`API_SECRET_TOKEN` dari notebook). Kode disimpan di browser itu saja.

### Langkah 1: Video dan Gaya
1. Aplikasi terbuka di **Manual AI Editor**. Isi **Judul Proyek**.
2. Tempel link YouTube/TikTok/Instagram/X, atau buka tab file dan tekan **Pilih video dari Google Drive**.
3. Pilih rasio, subtitle, dan gaya kanvas, lalu tekan tombol buat klip di bawah formulir.

### Langkah 2: Prompt untuk AI
1. Setelah transkripsi selesai, aplikasi pindah ke **Riwayat** dengan pesan "Prompt manual berhasil dibuat".
2. Pada proyek itu tekan **Lanjut Manual**, lalu **Salin Prompt**, dan tempel ke ChatGPT, Gemini, atau Claude.

### Langkah 3: Hasil JSON dari AI
1. Salin balasan AI yang berbentuk `[ ... ]`.
2. Tempel di kolom **Hasil JSON dari AI**, lalu tekan **Lanjutkan Proses**.

### Langkah 4: Render dan Unduh
1. Klip dirender di Colab. Layar boleh ditutup; buka lagi aplikasi nanti.
2. Di **Riwayat**, putar klip langsung atau tekan **Download** untuk menyimpannya ke HP.
```

- in the table of contents, replace the six lines from `6. [SOP Pengoperasian Harian via Smartphone (4-Step Wizard)]…` to `   - [Step 4: Background Rendering & Download MP4]…` with:

```markdown
6. [SOP Pengoperasian Harian via Smartphone](#6-sop-pengoperasian-harian-via-smartphone)
   - [Langkah 0: Masuk](#langkah-0-masuk)
   - [Langkah 1: Video dan Gaya](#langkah-1-video-dan-gaya)
   - [Langkah 2: Prompt untuk AI](#langkah-2-prompt-untuk-ai)
   - [Langkah 3: Hasil JSON dari AI](#langkah-3-hasil-json-dari-ai)
   - [Langkah 4: Render dan Unduh](#langkah-4-render-dan-unduh)
```

Open the cloud build (Task 5 Step 11 commands) and check every button name quoted above against the screen; correct the doc text where the app says something else.

`docs/panduan-penggunaan-awam.md`:
- Langkah 2, replace item 3 with:

```markdown
3. Pada halaman pengaturan, biarkan **Root Directory** kosong (folder utama). Pengaturan lain terbaca otomatis dari file `vercel.json`. Setelah proyek dibuat, buka **Settings → Build and Deployment** dan pastikan **Node.js Version** `22.x`.
   - Sudah punya proyek Vercel lama yang Root Directory-nya `web`? Kosongkan Root Directory di **Settings → Build and Deployment**, simpan, lalu **Redeploy**.
```

- Langkah 3, replace items 2 to 6 with:

```markdown
2. Tekan **Masuk ke Workspace**, lalu masukkan *password* rahasia (`rahasia123`) yang Anda buat.
3. **Mulai Bikin Video** (halaman **Manual AI Editor**):
   - Isi judul proyek. Tempel link video YouTube/TikTok, atau buka tab file lalu tekan **Pilih video dari Google Drive**. Pilih rasio (Vertical 9:16) dan gaya tulisan.
   - Tekan tombol buat klip di bawah formulir. Mesin di Colab mengambil teks dari video, lalu aplikasi pindah ke menu **History**.
4. **Pilih Bagian Terbaik Pakai AI:**
   - Di menu **History**, pada proyek Anda tekan **Lanjut Manual**, lalu **Salin Prompt**.
   - Tempel ke aplikasi AI di HP Anda (ChatGPT / Gemini).
   - *Copy* balasan AI yang berbentuk tanda kurung `[ ... ]` (*JSON*), tempel di kolom **Hasil JSON dari AI**, lalu tekan **Lanjutkan Proses**.
5. **Selesai!** HP boleh ditutup. Buka lagi web beberapa menit kemudian, buka **History**, lalu tekan **Download** untuk menyimpan videonya ke galeri HP.
```

- in "Kalau proses gagal", the button list stays (`Lanjutkan`, `Unggah cookies.txt`, `Pilih video dari Google Drive`).

`docs/cloud-architecture-plan.md`: directly under the title add

```markdown
> **Catatan 2026-11-18 (SP1):** dokumen ini catatan sejarah. Folder `web/` sudah dihapus; aplikasi cloud kini dibangun dari `src/` dengan `npm run build:cloud` (ADR-013).
```

- [ ] **Step 7: Version 1.19.0 and CHANGELOG**

Run: `npm version 1.19.0 --no-git-tag-version` (changes `package.json` and `package-lock.json`).

In `src-tauri/tauri.conf.json` `"version": "1.18.0"` → `"version": "1.19.0"`; in `src-tauri/Cargo.toml` `version = "1.18.0"` → `version = "1.19.0"`; in `file_version_info.txt` `filevers=(1, 18, 0, 0)` → `filevers=(1, 19, 0, 0)`, `prodvers=(1, 18, 0, 0)` → `prodvers=(1, 19, 0, 0)`, `'1.18.0.0'` → `'1.19.0.0'` (both `FileVersion` and `ProductVersion`).

Run: `git grep -n "1\.18\.0" -- package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml file_version_info.txt` → no output.

`CHANGELOG.md`, above `## [1.18.0] - 2026-11-18`:

```markdown
## [1.19.0] - belum dirilis

Rilis SP1 (frontend tunggal dan web lokal). Tanggal diisi saat rilis (plan question 10).

### Added
- **Auto Clipper Web (tanpa instalasi)**: Paket zip untuk Windows, macOS Apple Silicon, macOS Intel, dan Linux. Klik dua kali "Auto Clipper Web", lalu aplikasi terbuka di browser; semua proses tetap di komputer sendiri. Jendela "Auto Clipper berjalan" harus tetap terbuka selama dipakai. Membuka "Auto Clipper Web" lagi hanya membuka tab baru pada aplikasi yang sudah berjalan.
- **Kartu error baru**: "Video tidak bisa diputar" (dengan **Coba lagi**), serta untuk web lokal: halaman yang dibuka tanpa kunci akses, kunci akses yang sudah tidak berlaku, dan jendela Auto Clipper yang sudah ditutup.

### Changed
- **Satu Aplikasi untuk Desktop, Web Lokal, dan Cloud**: Aplikasi web untuk Google Colab kini memakai kode dan halaman yang sama dengan aplikasi desktop (Manual AI Editor, Riwayat, Pengaturan cookies). Gerbang kode akses, alamat backend, dan penjelajah Google Drive tetap ada.
- **Vercel**: Aplikasi cloud dibangun dari folder utama repositori dengan `npm run build:cloud` (`vercel.json`). Proyek Vercel lama harus mengosongkan Root Directory dan memakai Node.js 22.x (lihat tutorial cloud, Langkah 5.2).
- **Tombol aksi kartu error per platform**: **Pilih video dari Google Drive** di cloud, pemilih file di desktop dan web lokal; **Buka Pengaturan** untuk API key tidak tampil di cloud.
- Frontend memakai React 19, Vite 8, dan TypeScript 6; uji frontend dengan Vitest.

### Security
- **Alamat video bertanda tangan**: `/video` tidak lagi bisa dibuka tanpa tanda tangan di semua platform (T0.19). Setiap link hanya membuka satu klip. Kunci tanda tangan (`video_signing.key`) disimpan di folder data aplikasi; menghapusnya membatalkan semua link lama.

### Removed
- Folder `web/` (aplikasi web lama). Isinya sudah dipindah ke `src/`.
```

- [ ] **Step 8: Roadmap and owner checklist**

`docs/superpowers/specs/2026-11-12-enhancement-roadmap.md`, section 4 table, add rows:

```markdown
| 2026-11-18 | SP1: desktop (`src/`) menjadi satu-satunya frontend dengan lapisan platform; `web/` dihapus. | Satu kode untuk desktop, web lokal, dan cloud (ADR-013). |
| 2026-11-18 | SP1: web lokal sebagai paket siap pakai per OS dengan peluncur; token acak per peluncuran di `#t=`. | Pengguna tanpa instalasi desktop, tanpa Python. |
| 2026-11-18 | SP1: `/video` memakai link bertanda tangan HMAC tanpa kedaluwarsa di semua platform. | Pemutar video tidak bisa mengirim header token (T0.19). |
```

and in section 5 replace the two `- SP1: …` lines with `- SP1: dijawab di spec `2026-11-18-sp1-single-frontend-web-local-design.md` dan ADR-013.`

`tasks/roadmap-todo.md`, section `## SP1: …`: change the heading suffix `(belum dimulai)` to `(selesai, menunggu PR bersama SP2)`, tick T1.0 and the four T1.x items (`- [x]`), each followed by ` · ` and the hash of the commit that finished it (`git log --oneline feat/sp1-single-frontend-web-local` shows them), and add at the end of the section:

```markdown
- [ ] T1.y (dari T0.19, tidak dicakup spec SP1) `canvas_config.background_image_path` dan `output_dir` masih menerima path bebas (dibaca FFmpeg, tujuan tulis). Pindah ke SP2/SP3.
- [ ] T1.y Gambar latar kanvas di web lokal dan cloud memakai alamat `blob:` yang tidak bisa dibaca backend (bug lama, plan question 6). Pindah ke SP2.
```

`tasks/PROGRESS-LOG.md`, at the end of the `## 2026-11-18 · SP1` section, add the owner checklist (spec section 6):

```markdown
### Daftar cek manual SP1 (pemilik)

Untuk setiap platform: buat job dari URL, buat job dari file, klip hasil terputar, simpan klip, buka folder (desktop dan web lokal), Pengaturan, cookies (unggah dan hapus), kartu error (mis. URL salah, video unggahan hilang), Riwayat, Rerender All.

- [ ] Desktop Windows (installer dari "PR Check" atau build lokal): semua butir di atas; pembaruan aplikasi masih terdeteksi; komputer tidak tidur saat render.
- [ ] Web lokal Windows (zip dari "Web Package"): semua butir; SmartScreen "Run anyway"; peluncur kedua membuka tab baru; menutup jendela → kartu "Jendela Auto Clipper sudah ditutup".
- [ ] Web lokal macOS (arm64 atau x64): klik kanan → Open; semua butir.
- [ ] Web lokal Linux (bila ada mesin): semua butir.
- [ ] Cloud: proyek Vercel kedua dari branch ini (Root Directory kosong, Node 22.x, `VITE_API_URL`), Colab dengan branch ini: masuk dengan kode akses, Manual AI Editor → Riwayat → Lanjut Manual, Drive, cookies, putar dan unduh klip dari HP.
- [ ] Saat PR akhir digabung: proyek Vercel produksi → Root Directory kosong, Node 22.x, Redeploy.
```

- [ ] **Step 9: Final checks**

Run: `C:\Users\dhima\projects\ac-venv\Scripts\python.exe -m pytest backend/tests -q -p no:cacheprovider` → 775 passed, 11 skipped.
Run: `npx vitest run` → all pass. Run: `npm run build` and `npm run build:cloud` → exit 0. Run: `npx oxlint src` → 0 errors.
Run: `git grep -n -I "web/src\|cd web " -- . ":!docs/superpowers" ":!tasks" ":!CHANGELOG.md" ":!docs/decisions/012-*" ":!docs/cloud-architecture-plan.md"` → no output.

- [ ] **Step 10: Commit**

```bash
git add .agents/AGENTS.md README.md docs CHANGELOG.md package.json package-lock.json src-tauri/tauri.conf.json src-tauri/Cargo.toml file_version_info.txt tasks/roadmap-todo.md tasks/PROGRESS-LOG.md
git commit -m "$(cat <<'EOF'
docs(sp1): ADR-013, AGENTS.md, guides for one frontend and local web; 1.19.0

ADR-013 records the platform layer, signed /video links, the local web mode
and the packages. AGENTS.md gains invariants E.17/E.18 and F.6-F.8. The cloud
tutorial and the beginner guide describe the Vercel settings from the repo
root and the desktop pages on Colab. Version 1.19.0 with a changelog entry
and the owner's manual checklist.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Spec coverage

| Spec | Tasks |
|---|---|
| 4.1 Platform layer, caps, selection, per-platform behaviour | 2, 3, 5, 12 |
| 4.2 Web features moved (AuthGate, Drive browser, error actions, strings) | 4, 5, 6 |
| 4.3 Toolchain | 1 |
| 4.4 Backend serves the UI, 127.0.0.1, random port, token, one instance, launcher text | 10, 11 |
| 4.5 Signed video links (key, sig, 403, `/video-url`, links in clip data, ask once) | 7, 8, 9 |
| 4.6 Web packages per OS in CI, launchers, unsigned-app guidance | 13 (and `BACA-SAYA.txt`) |
| 4.7 Cloud on Vercel from the repo root | 5, 14 |
| 5 Error handling (backend not found per platform, local token, video 403, id + en texts) | 5, 6, 9, 12 |
| 6 Tests: pytest, Vitest, CI (desktop, cloud, packages, pytest, Vitest, oxlint), manual checklist | every task; CI in 13; checklist in 14 |
| 7 Work order | Task order table |
| 9 Open question (macOS x64) | closed by the owner: built in 13 |
