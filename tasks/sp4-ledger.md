# SDD ledger — plan: docs/superpowers/plans/2026-11-25-sp4-wave1.md

> Ledger resmi SP4 gelombang 1. AI mana pun yang melanjutkan memperbarui file INI setelah setiap task, fix round, dan keputusan. Format mengikuti `tasks/sp3-ledger.md`.

Spec: docs/superpowers/specs/2026-11-25-sp4-wave1-design.md (`7978a52`, disetujui pemilik 2026-11-25)
Plan: docs/superpowers/plans/2026-11-25-sp4-wave1.md (`353f1b6`, 7 task)
Branch: feat/sp4-wave1 dari feat/sp3-lightweight (`113f8f6`). Setelah review menyeluruh lolos, feat/sp3-lightweight dimajukan (fast-forward) ke feat/sp4-wave1 supaya PR SP0–SP3 yang sudah hijau ikut membawa gelombang ini. Jangan push atau merge tanpa permintaan pemilik.

Owner decisions (2026-11-25): isi gelombang = identitas (footer + splash + Tentang), AI ulang tanpa API key, pemberitahuan update web lokal tahap 1, catatan tertunda SP2/SP3, README + tutorial Colab; footer ringkas di bawah isi halaman + "Tentang Auto Clipper" di Pengaturan → Bantuan; splash web sekali per tab 0,8–2,5 dtk; hasil AI ulang = proyek baru; hak cipta "© {tahun berjalan} Dhimas Panjie Herlambang".

## Pre-flight scan
Selesai 2026-11-26 (sebelum Task 1). Baseline terverifikasi: branch `feat/sp4-wave1` di `bdab797` (dari `113f8f6`), pytest 1067 passed / 7 skipped, Vitest 474 passed (66 file), oxlint 0 error. Ruling yang mengikat Task 1–7:
- **P1 (Sumber versi tunggal & `appInfo.ts`):** `vite.config.ts` mengisi `__APP_VERSION__` dari `package.json`; `appVersion()` membacanya. `APP_VERSION` di `src/lib/settingsLayout.ts` (+ blok tesnya di `settingsLayout.test.ts`) dihapus dan diganti `src/lib/appInfo.test.ts` (sekaligus menjaga versi `tauri.conf.json` & `Cargo.toml`). `HelpSection.tsx` melepas `<p>` `settings.help_version` dan merender `<AboutSection />` di paling atas (menampilkan `about.version` = `"Versi 1.19.0"`, sehingga `SettingsPage.test.tsx:161` tetap cocok).
- **P2 (Simbol "©" U+00A9 vs regex emoji `\p{Extended_Pictographic}`):** Terbukti di Node bahwa `\p{Extended_Pictographic}` menangkap `©` (`\u00A9`). `copyrightLine()` dibuat di `src/lib/appInfo.ts` (tidak masuk file locale), jadi `plainWords.test.ts` tidak perlu ubah regex. Kedua tes halaman Pengaturan yang merender `HelpSection` → `AboutSection` dan menguji `EMOJI.test(container.textContent)` (`src/pages/SettingsPage.real.test.tsx:16` **dan** `src/pages/SettingsPage.test.tsx:48`) wajib memakai `/(?!\u00A9)\p{Extended_Pictographic}/u` pada Task 1.
- **P3 (Path SVG Threads & satu sumber tautan):** Path Threads 24×24 Simple Icons dipakai bersama 7 platform lain di `SOCIAL_LINKS` (`tiktok`, `youtube`, `instagram`, `threads`, `github`, `facebook`, `discord`, `trakteer`) dalam `src/lib/appInfo.ts`. `AuthGate.tsx` mengimpor `APP_NAME`, `SOCIAL_LINKS`, dan `copyrightLine` dari sana.
- **P4 (Splash lintas platform via `caps.splash`):** `Caps.splash: "startup" | "tab"` (`desktop: "startup"`, `local/cloud: "tab"`), tanpa mengecek `platform().kind` (AGENTS F.6). `useWebSplash` tampil sekali per tab (`sessionStorage` `ac_splash_seen` dalam `try/catch`) hingga `GET {API_URL}/health` pertama selesai (0,8 s – 2,5 s) sesudah pengaturan dimuat.
- **P5 (Bug `rerun_ai` menimpa klip lama & `_title_in_use`):** Dikonfirmasi `create_rerun_ai_job` (`backend/jobs.py:1350`) mempertahankan judul lama sehingga menulis ke folder proyek yang sama dan menimpa `<judul>_clip_<n>.mp4`. Baik `create_rerun_ai_job` maupun `create_rerun_manual_job` kini memakai `repick_title(old_title)`, mengatur `"timings": []`, dan membersihkan `_TRACKING_META_FIELDS`. `_title_in_use` membungkus `get_all_history()` dalam `try ... except Exception: return False` agar tes unit lama yang memalsukan `get_history`/`save_history` tanpa `db.init_db()` (`test_workspace.py:795`, `test_tracking_engine.py:70`) tidak gagal.
- **P6 (`POST /jobs/{id}/rerun-manual` & pemulihan sumber Colab):** Sinkron tanpa thread, membaca teks ucapan tersimpan, menyusun perintah dengan `generate_manual_prompt`, dan menyimpan proyek baru `AWAITING_MANUAL`. Teks ucapan hilang atau video tidak bisa kembali ditolak dengan `RERUN_SOURCE_MISSING` (aksi `new_project`). Dengan `AUTO_CLIPPER_WORK_DIR` aktif pada proyek link, video sumber yang hilang diizinkan karena `resume-manual` memulihkannya lewat `_restore_source_video`.
- **P7 ("Pilih ulang momen" & penghapusan `AiCorrectDialog`):** `RepickDialog` dan `canRepick` menggantikan `AiCorrectDialog` dan `canRerunAI` di `src/lib/history.ts`, `ProjectsPage.tsx`, `ProjectPage.tsx`, serta tes terkait. Alamat lama `/rerun-ai` (tanda hubung) tidak ada lagi di `src/` maupun `backend/`, dijaga tes di `repick.test.ts`.
- **P8 (Pemberitahuan update Auto Clipper Web tahap 1):** `GET /api/update-check` (hanya mode `--web`, token wajib) memakai `backend/update_check.py` (stdlib saja, di-import malas saat endpoint dipanggil), cache sukses 24 jam, hanya meneruskan URL di `https://github.com/DhimasPH/auto-clipper/releases/`. Dikendalikan `caps.updateNotice`.
- **P9 (Triase catatan tertunda SP2/SP3 pada Task 6):** 65 catatan dari `tasks/sp2-ledger.md` dan `tasks/sp3-ledger.md` ditriase: 19 dikerjakan (5 wajib W1–W5 + 14 minor valid K1–K12b), 21 sudah beres, 25 tidak dikerjakan dengan alasan tertulis.

## Tasks
- Task 1: **Approved** (`8b1e513..9698960`, reviewer `776001ef`) · Vitest 485/485 (69 file), pytest 1067 passed / 7 skipped, oxlint 0 error, build + build:cloud OK. Minor (non-blocking): `AppFooter` di dalam `<main>` (landmark `contentinfo`), `appInfo.test.ts` bisa pakai `sourceFiles("src")`, `AboutSection` tombol dukung belum eksplisit `type="button"`.
- Task 2: **Approved** (`9698960..7f2bb4b`, reviewer `15f6b77e`) · Vitest 497/497 (72 file), oxlint 0 error, build + build:cloud OK. Minor (non-blocking): `SplashScreen.test.tsx` belum assert `alt=""`, beberapa cabang waktu tambahan di `useWebSplash.test.tsx` / `splashVisible("tab", true, true)` / reload branch di `App.tsx`, dan `border-accent/30` (mengikuti pola `AuthGate`/`LocalGate`).
- Task 3: **Approved** (`7f2bb4b..e7dd302`, reviewer `c413a64e`) · pytest 1089 passed / 7 skipped. Minor (non-blocking): `_source_can_return` pada baris tanpa `source_video` sama sekali, `_read_transcript` saat JSON bukan dict, `except Exception` lebar di `_title_in_use`, `create_rerun_ai_job` membawa `_DEVICE_FIELDS` lama jika dibatalkan sebelum jalan, `delete_history` menghapus folder proyek lama jika proyek ulang aktif memakai `subtitle_path`-nya (pra-ada di `db.py`), dan cakupan batas `max_clips`/visual override di `test_rerun_manual.py`.
- Task 4: **Approved** (`e7dd302..b41f7c7`, reviewer `09725fc9`) · Vitest 507/507 (73 file), oxlint 0 error, build + build:cloud OK. Minor (non-blocking): teks FAQ `settings.help_faqs.moments` masih menyebut menu lama "Pilih ulang momen dengan AI", `ProjectPage.test.tsx` belum menguji dispatch confirm `api`/`manual` atau `canRepick`, `ProjectDialogs.test.tsx` belum menguji dirty guard pada input angka saja, `ACTION_ICONS` belum punya ikon `new_project`.
- Task 5: **Approved** (`b41f7c7..b020266`, reviews `597eab07`, `1a168f86`) · fix round 1 memindahkan `useUpdateNotice` ke `WithUpdateNotice` di dalam `gate(...)` (`src/App.tsx`), menolak `..`/spasi di tautan, dan jawaban kosong tanpa `latest` -> `"failed"`. pytest 1117 passed / 7 skipped (targeted 32/32 setelah fix), Vitest 519/519 (77 file), oxlint 0 error, build + build:cloud OK. Minor (non-blocking): uji spasi/`..` di `test_update_check.py`, uji `SettingsPage` integrasi `updateNotice`, normalisasi `new URL`/`\` pada `trusted`, `type="button"` pada tombol `UpdateNoticeSection`, guard urutan `recheck()`.
- Task 6: **Approved** (`b020266..f3b5700`, reviewer `9e7524f2`) · 19 Kept (`W1–W5` + `K1–K12b`), 21 Already fixed, 25 Dropped. pytest 1125 passed / 7 skipped, Vitest 534/534 (79 file), oxlint 0 error, build + build:cloud OK. Minor (non-blocking): W1 tests pakai monkeypatch inline bukan `no_filesystem_for_the_server`, `test_addons.py` belum cek `pending_remove=False` sebelum marker/`cuda`, `test_pipeline_timings.py` belum mengulang asersi `whisper_device`/`tracking_engine_used` dalam tes baru, komentar `scheduled` di `useAddons.ts:33-34` masih menyebut server tidak melaporkannya, letak JSDoc `useScrollToHash.ts:4-5` di atas `hashTarget`, klik `Keep Accurate` di `CreatePage.test.tsx:237` masih sinkron.
- Task 7: dispatched (BASE d517eb0), implementer opus acd143c79de610c95; controller verified at d517eb0: pytest 1125/7, Vitest 534 (79 files)

## Task 6 Triage (SP2 & SP3 Deferred Minors)

**Kept (19 = 5 wajib spec 4.6 + 14 masih valid): dikerjakan di Task 6**

| Id | Source | Where | Fix | Test |
|---|---|---|---|---|
| W1 | SP3 T4 (wajib) | `backend/main.py` (`upload-image`, `extract-metadata`, `thumbnails`, `video-url`) | tolak `is_network_or_device_path` dari teks sebelum `is_protected`/`abspath` | `test_protected_paths.py`, `test_canvas_image.py` |
| W2 | SP3 T4 (wajib) | `backend/jobs.py` `refuse_protected_project_dir` | tolak folder proyek di dalam `workspace.uploads_dir()` & `work_dir` | `test_output_dir.py` |
| W3 | SP3 T5 (wajib) | `backend/addons.py`, `src/lib/addons.ts`, `src/hooks/useAddons.ts`, `AddonControls.tsx` | field status `pending_remove`; catatan hapus tertunda bertahan setelah Pengaturan dibuka lagi | `test_addons.py`, `addons.test.ts`, `FaceTrackingSection.test.tsx` |
| W4 | SP3 Teliti/T6 (wajib) | `src/hooks/useClipJobs.ts`, `src/pages/CreatePage.tsx` | `handleGenerate` menjawab `Promise<boolean>`; dialog prosesor menyimpan `"small"` hanya bila start lolos cek | `useClipJobs.test.tsx`, `CreatePage.test.tsx` |
| W5 | SP3 T5 (wajib) | `backend/jobs.py` `resume_manual_job` & `_finalize_job` | mulai `timings: []`, simpan `earlier_timings`, gabung saat `_finalize_job` + sinkron metadata final | `test_pipeline_timings.py` |
| K1 | SP2 T3 | `src/components/ui/CanvasConfigControls.tsx` | memilih latar lain menghapus status gagal unggah | `CanvasConfigControls.test.tsx` |
| K2 | SP2 T5 | `src/hooks/useScrollToHash.ts` | `decodeURIComponent` dalam try/catch dengan fallback hash mentah | `useScrollToHash.test.tsx` |
| K3 | SP2 T6 | `src/lib/createFlow.ts` | `.trim()` setelah `.slice(0, 60)` | `createFlow.test.ts` |
| K4 | SP2 T12 | `src/locales/id.json`, `en.json` | bentuk `_one` untuk `result.title_done`, `title_partial`, `failed` | `src/locales/plurals.test.ts` |
| K5 | SP2 T12 | `src/components/ClipsResult.tsx` | kunci khusus `result.download_all_failed` di bawah Unduh semua | `ClipsResult.test.tsx` |
| K6 | SP2 T13 | `src/lib/projectStatus.ts`, `ProjectsPage.tsx`, `ProjectPage.tsx` | `projectDisplayTitle()` menampilkan nama file video `local:`, bukan path mentah | `projectStatus.test.ts` |
| K7 | SP2 T13 | `src/pages/ProjectsPage.tsx` | penghitung permintaan `latestLoad`: hanya jawaban `/history` terbaru yang tampil | `ProjectsPage.test.tsx` |
| K8 | SP2 T15 | `src/components/AuthGate.tsx` | hapus `disabled={!token.trim()}` agar klik Masuk kosong memunculkan `auth.error_empty` | `AuthGate.test.tsx` |
| K9 | SP3 Teliti | `src/components/create/ProgressPanel.tsx`, locales | pada cloud catatan Teliti memakai `progress.fallback_tracking_colab` (Langkah 3 Colab); `fallback_tracking_unavailable` dihapus | `ProgressPanel.test.tsx` |
| K10a | SP2 T1 | `backend/tests/test_stage_timer.py` | uji `report(percent=-5)` menjadi `0.0` | `test_stage_timer.py` |
| K10b | SP2 T1 | `backend/tests/test_stage_timer.py` | uji `clips_total=0` tidak tampil di status berjalan | `test_stage_timer.py` |
| K11 | SP2 T7 | `src/components/create/PreflightNotices.test.tsx` | uji `checking` membuat tombol Periksa lagi `aria-busy` & `disabled` | `PreflightNotices.test.tsx` |
| K12a | SP3 Teliti | `backend/tests/test_addons.py` | pastikan `str(colab_dir) not in sys.path` setelah GET status | `test_addons.py` |
| K12b | SP3 Teliti | `backend/tests/test_addons.py` | hapus duplikat `import json` di dalam fungsi uji | `test_addons.py` |

**Already fixed (21)**

| Source | Item | Evidence |
|---|---|---|
| SP2 T1 | `tracking_engine_used` assertion | `backend/tests/test_stage_timer.py:282-291` |
| SP2 T4 | ConfirmDialog focus trap/return, default label | `ConfirmDialog.tsx:10,35-38` wraps `Dialog.tsx` |
| SP2 T5 | `scroll-mt-16` on anchors | `SettingsPage.tsx:20-21` |
| SP2 T8 | `<legend>` across the fieldset border | `ClipOptions.tsx:85-86` (`border-0 p-0`) |
| SP2 T10 | `ManualDownloaderPage` old argument | file deleted |
| SP2 T10 | `CreatePage` `!ctx.isRunning` gate | only intended `canStart` gate remains (`CreatePage.tsx:80`) |
| SP2 T13 | dialogs close without discard guard | `Dialog.tsx:32,38,74-77`, `dirty` passed by every dialog |
| SP2 T13 | "Lihat progres" dead end | `ProjectsPage.tsx` → `watchJob` |
| SP2 T13 | prune unused `history.*` keys | no `history` block left (`7d0862a`) |
| SP2 T13 | retry button focus | `ProjectsPage.tsx`, `ProjectPage.tsx` |
| SP2 T13 | dialog re-render test only on ProjectsPage | `ProjectPage.test.tsx` |
| SP2 T14 | OutputSection title off desktop | `OutputSection.tsx:39` (`output_title_quality`) |
| SP2 T14 | emoji test mocks the sections | `SettingsPage.real.test.tsx` renders the real ones |
| SP2 T14 | no completion message in DownloaderPanel | `DownloaderPanel.tsx` |
| SP2 T14 | P11 legacy sections (icon tiles, `text-xs`, "AI Provider", raw errors) | none left in `src/components/settings` |
| SP2 T15 | `save_refused` for 5xx/404 | `ClipEditModal.tsx` (`547531a`) |
| SP2 T16 | README `$\rightarrow$` | none left in README or tutorial |
| SP2 T17 | README "Update" wording, panduan "Network Failed" | README & panduan |
| SP2 T17 | HANDOFF stale | rewritten 2026-11-20/25 |
| SP3 T4 | AGENTS.md E.14 text-first / local absolute path | `.agents/AGENTS.md` E.14 |
| SP3 T5 ruling | unused `meta` prop on ProgressPanel | removed from `ProgressPanel.tsx` & `CreatePage.tsx` |

**Dropped (25): tidak dikerjakan sekarang**

| Source | Item | Reason |
|---|---|---|
| SP2 T1 | `dict \| None` annotations in `stage_timer` | type hints only |
| SP2 T2 | return type hints of `download_percent`/`live_stage` | type hints only |
| SP2 T2 | `report(clips_total)` loops in rerender/rerun have no `live_stage` test | all share the tested `stage()`/`report()` helpers |
| SP2 T2 | mid-run `GET /jobs` check on manual resume | HTTP path covered generically (`test_job_current.py`) |
| SP2 T5 | `DOT: Record<BackendStatusKey, string>` typing | type only |
| SP2 T6 | deep validation of nested choices in `loadClipChoices` | only the app writes the key; missing keys come from defaults |
| SP2 T6 | more branch tests in `createFlow.test.ts` | no concrete gap named |
| SP2 T7 | no `type="button"` on Periksa lagi | no `<form>` around it, cannot submit |
| SP2 T7 | prior blockers kept while disconnected | `canStart` already needs `connected` |
| SP2 T9 | extra assertions in `progress.test.ts` | logic covered elsewhere |
| SP2 T10 | `set-state-in-effect` warning in ProgressPanel | accepted warning, behaviour correct |
| SP2 T12 | `focusout` test in OverflowMenu | test polish |
| SP2 T12 | whitespace trim test in `clipInfo.test.ts` | test polish |
| SP2 T13 | Riwayat list does not poll | behaviour change; Muat ulang exists; backlog SP4 gelombang 2 |
| SP2 T13 | `FailedRowError` duplicates JobReport's error block | refactor only, nothing visible changes |
| SP2 T14 | "redundant" comments in HelpSection | each annotates a different constant |
| SP2 T14 | non-override `handleManualGenerate` branch lacks `tracking_mode` | unreachable (caller passes look) |
| SP2 T15 | update overlay panel has no focus ring | it has no controls |
| SP2 T15 | Drive retry after root fallback | harmless, root is the right retry |
| SP2 T16 | 0.0.0.0 test may prompt Windows firewall | reproduces bug; dev only |
| SP3 T4 | caching history scan in `allowed_project_output_dirs` | runs after signature check; cache invalidation risk |
| SP3 T5 | `TranscriptionSection.test.tsx` positive assertion | test polish |
| SP3 T5 | `ProgressPanel.test.tsx` duplicate of `progress.test.ts` | harmless |
| SP3 T5 | `test_pipeline_timings.py` old_meta not mutated | `get_history` returns fresh dict |
| SP3 T5 | `aria-disabled` on add-on double click | already guarded by `inFlight` and `useKeepFocus` |
Task 7: implementer DONE, commits a6f2b8e, 562ab36 — pytest 1127/7, Vitest 535 (79 files), oxlint 0 errors, build + build:cloud OK, npm audit 0. Browser 360/768/1280 light/dark: footer, About, splash, Pilih ulang momen dialog, update notice, cloud gate — all pass (mocked backend). Not verified: desktop app, real GitHub call, notebook on real Colab.
Task 7: minor (→ final fix wave): projects.repick_manual_note says "Video tidak diunduh ulang" — not true on a new Colab session (P6); reword to "Subtitle tidak dibuat ulang".
Task 7: review folded into the whole-wave review (docs included).
Whole-wave review dispatched (113f8f6..562ab36)
