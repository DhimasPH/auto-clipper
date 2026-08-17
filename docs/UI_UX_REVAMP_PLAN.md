# Auto Clipper — Implementation Plan: UI/UX Revamp

**Versi 1.0** · 16 Agustus 2026
**Acuan:** `docs/UI_UX_REVAMP_SPEC.md` v2.0 · prototype di `prototype/`
**Basis kode:** v1.8.0 · Tauri + React + TypeScript + Tailwind, backend Python (FastAPI sidecar)

---

## 0. Cara membaca rencana ini

Sepuluh fase, berurut karena tiap fase memakai hasil fase sebelumnya. Tiap task punya
**file yang disentuh** dan **acceptance criteria yang bisa dicek**, bukan "selesai
kalau kelihatan benar".

**Estimasi memakai satuan hari-orang (d)** dengan asumsi satu developer frontend yang
sudah familiar dengan basis kode ini. Angka ini untuk mengurutkan prioritas, bukan
janji tanggal.

**Aturan yang berlaku di semua fase:**

1. **Tidak ada fitur yang hilang.** Setiap PR yang menyentuh layar wajib menyertakan
   checklist fitur lama yang dipindahkan atau dipertahankan.
2. **Satu fase = satu PR seri**, dan tiap PR harus bisa di-*revert* sendiri.
3. **Feature flag** `VITE_NEW_UI` menyalakan shell baru. Sampai Fase 8 selesai, UI lama
   tetap bisa dijalankan.
4. Setiap string baru langsung masuk `en.json` **dan** `id.json`. Tidak ada string
   hardcode baru.

---

## Fase 0 — Tambal bug fungsional lebih dulu · ~1.5d

Enam bug ini nyata di v1.8.0, tidak berhubungan dengan desain, dan akan menyesatkan
pengujian revamp kalau dibiarkan. **Rilis sebagai patch tersendiri (v1.8.1), sebelum
revamp dimulai.**

| # | Task | File | Acceptance |
|---|---|---|---|
| 0.1 | Perbaiki job id Social Kit dari Workspace | `src/pages/WorkspacePage.tsx:57` | `ctx.job?.id` → `ctx.jobId`. Social Kit dari Workspace memanggil endpoint dengan id terisi; diverifikasi lewat network tab. |
| 0.2 | Perbaiki key localStorage auto-correct | `src/components/ClipEditModal.tsx:84-88` | Baca `ac_provider`/`ac_model` dan `apiKeys` dari `useUserSettings`, bukan `ai_provider`. Dengan key tersimpan, tab "Auto" berjalan tanpa alert "API Key belum diatur". |
| 0.3 | Perbaiki toast ManualResumeModal | `src/components/ManualResumeModal.tsx:20` | Terima `notify` dari context alih-alih memanggil `useToasts()` lokal. Toast sukses/gagal benar-benar tampil. |
| 0.4 | Buat Retry saat ERROR bisa dijangkau | `useClipJobs.ts:88-92`, `GenerateForm.tsx:364` | Simpan `lastFailedJobId` terpisah dari `activeJobId`. Tombol Retry muncul setiap kali status `ERROR`. Ditutup unit test. |
| 0.5 | Munculkan tombol Cancel | `useClipJobs.ts:123` + Workspace | `cancelJob()` punya tombol saat `isRunning`. Menekannya membuat backend mengirim `CANCELLED` dan UI berhenti. |
| 0.6 | Hentikan kebocoran state Manual Downloader | `ManualDownloaderPage.tsx:42-43` | Halaman memakai state lokal penuh. Submit di Downloader tidak mengubah judul/kualitas di Workspace. |

**Exit criteria Fase 0:** enam bug punya test regresi, dan v1.8.1 dirilis.

---

## Fase 1 — Fondasi token & utilitas · ~2d

Tidak ada perubahan tampilan yang terlihat besar; ini menyiapkan lantainya.

| # | Task | File | Acceptance |
|---|---|---|---|
| 1.1 | Ubah token warna ke channel RGB | `src/index.css` | Semua `--bg-*`, `--accent*`, `--text-*`, semantik jadi triplet RGB. |
| 1.2 | Deklarasikan `<alpha-value>` di Tailwind | `tailwind.config.js` | `bg-error/10`, `border-accent/25` dsb. ter-compile. Tambahkan `safelist` untuk kelas yang dirakit runtime. |
| 1.3 | Terapkan palet brand | `src/index.css` | Aksen `#3B82F6`, `accent-solid` `#2563EB`, permukaan slate. Light mode lengkap. |
| 1.4 | Audit kontras | script di `scripts/contrast.mjs` | Semua pasangan ≥ 4.5:1 (≥3:1 tersier). Skrip dijalankan di CI dan gagal bila ada yang turun. |
| 1.5 | Hapus rgba hardcode | seluruh `src/` | `grep -r "rgba(" src/` hanya menyisakan definisi token. |
| 1.6 | Kunci skala tipografi | `src/index.css` | Utility `t-display`…`t-overline` tersedia dan dipakai; tidak ada `text-[Npx]` liar di komponen baru. |
| 1.7 | Ganti aset karakter | `public/character.png` | PNG **dengan alpha**. Diverifikasi: `Image.open(...).mode == 'RGBA'` dan piksel sudut transparan. |

**Exit criteria:** app lama masih berjalan normal dengan token baru; tidak ada regresi
visual selain pergeseran warna yang disengaja.

---

## Fase 2 — Komponen dasar · ~3d

| # | Task | File | Acceptance |
|---|---|---|---|
| 2.1 | Primitif tombol | `src/components/ui/Button.tsx` | Varian primary/secondary/ghost/danger, ukuran sm/md/lg, mode ikon. **Primary memakai `bg-accent-solid`.** |
| 2.2 | Primitif form | `ui/Input.tsx`, `Select.tsx`, `Textarea.tsx`, `Toggle.tsx`, `Segmented.tsx` | Semua punya state error, helper text, `:focus-visible`, dan atribut ARIA sesuai §9 spec. |
| 2.3 | Surface & feedback | `ui/Card.tsx`, `Panel.tsx`, `Badge.tsx`, `EmptyState.tsx`, `Skeleton.tsx` | `Badge` menerima nada `neutral/accent/success/error/warning/info`. |
| 2.4 | Modal terpadu | `ui/Modal.tsx` | Esc + klik backdrop + tombol X, ketiganya, di semua pemakaian. Focus trap. Mengembalikan fokus ke pemicu saat ditutup. |
| 2.5 | Progress | `ui/Track.tsx`, `PhaseRail.tsx` | Determinate & indeterminate. `PhaseRail` menerima daftar fase + indeks aktif + fase gagal. |
| 2.6 | Hapus `alert()` dan `window.confirm` | `ClipEditModal.tsx`, `HistoryPage.tsx` | `grep -rn "alert(\|window.confirm" src/` kosong. |
| 2.7 | `ConfirmDialog` bernama | `ui/ConfirmDialog.tsx` | Menerima judul, daftar konsekuensi, opsi lunak opsional, label aksi destruktif. |

**Exit criteria:** Storybook (atau halaman `/__ui`) memuat seluruh primitif di dark dan
light, lolos audit kontras.

---

## Fase 3 — Shell aplikasi · ~2.5d

| # | Task | File | Acceptance |
|---|---|---|---|
| 3.1 | Sidebar baru | `src/components/sidebar/Sidebar.tsx` | Dua item utama (Projects, New Project) + dua kaki. Item aktif memakai `aria-current="page"`. |
| 3.2 | Sidebar bisa dilipat | idem + `hooks/useSidebar.ts` | Toggle melipat ke 60px, hanya ikon; state bertahan setelah reload (`ac_nav_collapsed`). |
| 3.3 | Top header + breadcrumb | `layouts/AppLayout.tsx`, `ui/Breadcrumbs.tsx` | Sticky, translucent, breadcrumb dari route, indikator engine di kanan. |
| 3.4 | **Job Dock** | `components/dock/JobDock.tsx`, `hooks/useJobQueue.ts` | Tampil di semua halaman kecuali Studio & Welcome. Menampilkan job aktif + antre, fase, progress, ETA, Open, Cancel. Bisa diciutkan dan bertahan. Ikut bergeser saat sidebar dilipat. |
| 3.5 | Routing baru | `App.tsx` | `/projects`, `/projects/new`, `/projects/:id`, `/projects/:id/clips/:index`, `/projects/:id/handoff`, `/settings/:section`, `/help/:tab`. Redirect dari route lama. |
| 3.6 | Ganti gate Landing dengan route | `App.tsx`, `pages/WelcomePage.tsx` | `showLanding` boolean dihapus. Welcome jadi route `/welcome`, ditampilkan saat launch hanya bila preferensi menyala. |
| 3.7 | Splash gelap | `components/SplashScreen.tsx` | Mengikuti tema, punya state error dengan sebab + tindakan. |

**Exit criteria:** navigasi antar halaman lama masih berjalan di dalam shell baru;
job berjalan tetap terlihat di semua halaman.

---

## Fase 4 — Lapisan data & status · ~3d

Fase paling berisiko. Kerjakan sebelum layar besar dibangun di atasnya.

| # | Task | File | Acceptance |
|---|---|---|---|
| 4.1 | Satukan kosakata status | backend + `useClipJobs.ts` | `CROPPING` → `RENDERING`; `ANALYZING` ditambahkan dan dikirim backend saat memanggil LLM. Union frontend lengkap; **`as any` dihapus**. |
| 4.2 | Migrasi record lama | `backend/history.py` + skrip migrasi | Job lama berstatus `CROPPING`/`completed`/`failed` dipetakan ke kosakata baru saat dibaca. Tidak ada job lama yang jadi tak terbaca. |
| 4.3 | Konsolidasi setelan render | `backend/history.py`, `HistoryPage.tsx` | Satu sumber kebenaran (disarankan: top-level). `metadata.aspect_ratio` dsb. dihapus setelah migrasi. Semua konsumer membaca sumber yang sama. |
| 4.4 | Hapus duplikasi `captionStyle` | `App.tsx:75-79` | Hanya `subtitleConfig.style` yang ada. Tipe memuat `single_word`. |
| 4.5 | Ketikkan AppContext | `App.tsx`, `types/context.ts` | `createContext<AppContextValue>` bertipe penuh; `any` hilang. `tsc --noEmit` bersih. |
| 4.6 | Progress asli | backend + `useClipJobs.ts` | Backend mengirim `{phase, phase_index, phase_progress, eta_seconds, detail}`. Tangga hardcoded 15/45/60/100 dihapus. |
| 4.7 | Perbaiki polling | `useClipJobs.ts:121` | Dependency interval tidak lagi memuat `clips.length`. Interval stabil. Kegagalan polling memunculkan state "engine tidak merespons", bukan `console.error` diam. |
| 4.8 | Endpoint antrean | backend | `GET /jobs` mengembalikan job aktif + antre untuk Job Dock. |

**Exit criteria:** satu job AI penuh berjalan dan setiap fase tampil dengan nama,
progress, dan ETA yang benar; membunuh sidecar di tengah jalan memunculkan state
"tidak merespons" dalam ≤ 5 detik.

---

## Fase 5 — Kontrol bersama · ~2.5d

| # | Task | File | Acceptance |
|---|---|---|---|
| 5.1 | Perluas `SubtitleConfig` | `src/types/subtitle.ts` | Tambah `pos_x`, `pos_y` (persen, default 50/78). Default lama tetap valid. |
| 5.2 | Renderer memakai posisi | `backend/render.py` | Subtitle dirender pada X/Y yang diminta; margin vertikal adaptif lama menjadi fallback saat field tidak ada. Diuji pada 9:16 dan 16:9-canvas. |
| 5.3 | Rombak `SubtitleConfigControls` | `components/ui/SubtitleConfigControls.tsx` | Inventaris lengkap §7.2 spec, **termasuk kontrol `outline_color` dan `shadow_color`** yang sebelumnya tidak ada, dan watermark. |
| 5.4 | Rombak `CanvasConfigControls` | `components/ui/CanvasConfigControls.tsx` | Mode switch dua kartu bisa dirender terpisah (`<CanvasModeSwitch/>`) agar New Project bisa menaruhnya tepat di bawah pemilih rasio. |
| 5.5 | Satukan pemilih rasio | `ui/AspectRatioPicker.tsx` | **Satu** komponen dipakai semua layar. `grep` memastikan tidak ada daftar rasio lain. Empat opsi di mana-mana. |
| 5.6 | Preview caption bersama | `ui/CaptionPreview.tsx` | Dipakai New Project (statis) dan Studio (mengikuti playhead). |

**Exit criteria:** mengubah satu field di New Project dan di Studio menghasilkan
payload yang identik untuk field yang sama.

---

## Fase 6 — Layar: Projects, New Project, Project detail · ~5d

| # | Task | File | Acceptance |
|---|---|---|---|
| 6.1 | Halaman Projects | `pages/ProjectsPage.tsx` | Kartu per status sesuai §5.3 spec. Search + filter + jumlah. Skeleton saat memuat — **posisi scroll tidak hilang** saat job selesai di latar. |
| 6.2 | Delete bernama | idem + `ConfirmDialog` | Menyebut nama project dan apa yang terhapus; opsi "simpan klip". |
| 6.3 | Shortcut Download-only | idem | Membuka New Project dengan mode terpilih. |
| 6.4 | Stepper New Project | `pages/NewProjectPage.tsx` + `components/newproject/*` | Lima langkah, rail ringkasan hidup, state tersimpan saat pindah langkah. |
| 6.5 | Validasi inline | idem | Field wajib divalidasi di tempat; prasyarat menautkan ke Settings. **Lima toast pasca-submit dihapus.** |
| 6.6 | Tiga mode → satu payload | `hooks/useClipJobs.ts` | `handleGenerate` menerima mode; `manual_ai` dan download-only tidak lagi butuh layar sendiri. |
| 6.7 | Pensiunkan tiga halaman lama | hapus `WorkspacePage`, `ManualAIEditorPage`, `ManualDownloaderPage`, `GenerateForm` | Route lama redirect. Checklist fitur menunjukkan setiap kontrol lama punya rumah baru. |
| 6.8 | Project detail | `pages/ProjectDetailPage.tsx` | Phase rail, banner per state, grid klip, activity log, rail setelan. Tujuh state terbukti bisa dicapai. |
| 6.9 | Pemulihan kegagalan | idem | Banner error menyebut fase, sebab, dampak, dan tombol pulih yang benar-benar melanjutkan dari fase yang gagal. |
| 6.10 | Cancel dengan konfirmasi | idem + dock | Dialog menyebut apa yang tetap tersimpan. Setelah cancel, Resume melanjutkan dari fase terakhir. |

**Exit criteria:** alur AI penuh — buat, jalankan, batalkan, lanjutkan, gagal,
pulihkan, selesai — bisa diselesaikan tanpa membuka UI lama.

---

## Fase 7 — Clip Studio & Transcript Fixer · ~5d

Bagian termahal. Jangan dimulai sebelum Fase 5 selesai.

| # | Task | File | Acceptance |
|---|---|---|---|
| 7.1 | Kerangka Studio | `pages/ClipStudioPage.tsx` | Layar penuh, topbar + preview + timeline + panel tiga tab. |
| 7.2 | Preview + playhead | `components/studio/Preview.tsx` | `<video>` asli dengan `timeupdate` menggerakkan playhead. Rasio bisa diganti. |
| 7.3 | Timeline & trim | `components/studio/Timeline.tsx` | Bar per kata, scrub, handle in/out. Trim tersimpan ke payload re-render. |
| 7.4 | **Caption box draggable** | `components/studio/CaptionBox.tsx` | Digeser dengan mouse dan keyboard (panah), dibatasi 8–92%, menulis `pos_x`/`pos_y`. Nilai dibulatkan. |
| 7.5 | Panel transkrip | `components/studio/TranscriptPanel.tsx` | Word-level, klik untuk melompat, edit inline menandai perubahan, pencarian menyaring. |
| 7.6 | **Fixer: jalur API key** | `components/studio/FixerModal.tsx` | Memanggil `/ai/correct-subtitle` dengan kredensial yang benar (hasil Fase 0.2). |
| 7.7 | **Fixer: jalur copy-paste** | idem | App menghasilkan prompt (instruksi + JSON word-level). Tombol salin. Textarea paste dengan validasi per-aturan. |
| 7.8 | **Fixer: review bersama** | idem | Daftar `sebelum → sesudah` + timestamp + alasan; tiap baris bisa dilepas; melompatkan playhead. **Tidak ada penulisan sebelum diterima.** |
| 7.9 | Panel Captions & Canvas | reuse Fase 5 | Semua field menghidupkan preview secara langsung. |
| 7.10 | Save & re-render | idem | Ringkasan perubahan sebelum konfirmasi; hanya klip ini yang di-render ulang; versi sebelumnya disimpan. |
| 7.11 | Hapus modal lama | hapus `ClipEditModal.tsx`, `ClipRerenderModal.tsx` | Tidak ada import tersisa. |

**Exit criteria:** memperbaiki satu kata, menggeser caption, dan me-render ulang satu
klip bisa diselesaikan tanpa meninggalkan Studio — dan tanpa API key, lewat jalur
copy-paste.

---

## Fase 8 — Handoff, Settings, Help, Social Kit · ~3.5d

| # | Task | File | Acceptance |
|---|---|---|---|
| 8.1 | Wizard handoff | `pages/HandoffPage.tsx` | Tiga langkah; error parsing dijelaskan per baris; preview highlight di timeline sumber sebelum commit. |
| 8.2 | Hapus `ManualResumeModal` | — | Fungsinya pindah ke wizard; tidak ada import tersisa. |
| 8.3 | Settings shell | `pages/SettingsPage.tsx` | Nav kiri, tiap seksi punya URL sendiri. |
| 8.4 | **API key custom endpoint** | `components/settings/ProviderSection.tsx` | Tiga field inline (Base URL, Model name, API key + reveal). Placeholder menyebut boleh kosong untuk Ollama/lokal. Modal terpisah dipensiunkan. |
| 8.5 | Default & pembersihan Settings | idem + `OutputSection`, `UpdaterSection` | Welcome-at-launch, notify, prevent-sleep, auto-check → default **on**. *Keep source video*, *Subtitle language*, *Include pre-releases* dihapus. |
| 8.6 | Kartu model Whisper | `TranscriptionSection.tsx` | Kartu dengan status unduhan + tombol unduh/pilih; catatan VAD selalu aktif. |
| 8.7 | Help tiga tab | `pages/HelpPage.tsx` | User Guide / FAQ / System Logs. |
| 8.8 | Log viewer | idem | Tiga sumber, terminal chrome, pewarnaan, auto-scroll, Refresh, Copy, **Show files**, state kosong & engine mati. |
| 8.9 | Social Kit | `components/SocialKitModal.tsx` | Terstruktur, salin per item, Regenerate, Copy all. Divider liar di state kosong diperbaiki. |
| 8.10 | Welcome | `pages/WelcomePage.tsx` | Mengikuti tema, CTA utama, tautan komunitas, **blok Trakteer**, karakter memakai PNG transparan. |

**Exit criteria:** tidak ada layar yang masih memakai komponen lama.

---

## Fase 9 — i18n, aksesibilitas, pengujian · ~3d

| # | Task | Acceptance |
|---|---|---|
| 9.1 | Lengkapi i18n | Semua string §10 spec punya kunci. Skrip CI menolak string literal di JSX. `en.json` dan `id.json` punya kunci yang sama persis. |
| 9.2 | Audit aksesibilitas | axe-core bersih di sepuluh layar. Navigasi keyboard menyelesaikan alur AI penuh tanpa mouse. |
| 9.3 | Unit test | Reducer status, parser JSON handoff & fixer, util progress/ETA, konversi posisi caption. |
| 9.4 | E2E (Playwright) | Enam alur: AI penuh · BYO-LLM · download-only · cancel lalu resume · gagal lalu pulih · edit klip di Studio. |
| 9.5 | Uji regresi visual | Snapshot sepuluh layar × dua tema. |
| 9.6 | Uji migrasi | `history.db` dari v1.8.0 terbaca penuh di build baru; tidak ada job hilang atau berstatus tak dikenal. |

---

## Fase 10 — Rollout · ~1.5d

| # | Task | Acceptance |
|---|---|---|
| 10.1 | Matikan feature flag | `VITE_NEW_UI` dihapus; UI lama dihapus dari bundle. |
| 10.2 | Bersihkan kode mati | `ClipRerenderModal`, `GenerateForm`, tiga halaman lama, `ManualResumeModal` terhapus. `knip`/`ts-prune` bersih. |
| 10.3 | Catatan rilis migrasi | Menjelaskan penggantian nama History → Projects dan peleburan tiga menu, dengan peta "dulu di sini → sekarang di sini". |
| 10.4 | Perbarui README & PRD | Screenshot baru; PRD §6 mencoret backlog revamp dan posisi subtitle X/Y. |
| 10.5 | Rilis v2.0.0 | Major, karena IA berubah. |

---

## Ringkasan usaha

| Fase | Isi | Estimasi |
|---|---|---|
| 0 | Tambal bug fungsional | 1.5d |
| 1 | Fondasi token | 2d |
| 2 | Komponen dasar | 3d |
| 3 | Shell aplikasi | 2.5d |
| 4 | Data & status | 3d |
| 5 | Kontrol bersama | 2.5d |
| 6 | Projects / New / Detail | 5d |
| 7 | Studio & Fixer | 5d |
| 8 | Handoff / Settings / Help | 3.5d |
| 9 | i18n, a11y, testing | 3d |
| 10 | Rollout | 1.5d |
| | **Total** | **~32.5 hari-orang** |

Dengan satu developer dan buffer 20% untuk hal tak terduga: **±8 minggu kalender**.
Fase 0 bisa dirilis dalam minggu pertama, terlepas dari sisanya.

---

## Jalur kritis & risiko

```
Fase 0 ─┐
        ├─> 1 ─> 2 ─> 3 ─┬─> 6 ─┐
Fase 4 ─┘                 │      ├─> 8 ─> 9 ─> 10
                    5 ────┴─> 7 ─┘
```

Fase 4 (data & status) bisa berjalan paralel dengan Fase 1–3 karena sebagian besar
pekerjaannya di backend. Fase 5 harus selesai sebelum 7.

| Risiko | Dampak | Mitigasi |
|---|---|---|
| **Posisi subtitle X/Y butuh perubahan renderer** (5.2) | Bisa merembet ke logika ASS/FFmpeg dan mengubah output klip lama | Kerjakan lebih awal di Fase 5, di belakang fallback: bila `pos_x`/`pos_y` tidak ada, pakai perilaku lama persis. Uji dengan render sebelum/sesudah pada klip yang sama. |
| **Migrasi setelan render ganda** (4.3) | Job lama bisa jadi tidak bisa di-rerender | Tulis skrip migrasi + backup `history.db` otomatis sebelum upgrade. Uji dengan salinan database asli. |
| **`ANALYZING` butuh perubahan backend** (4.1) | Frontend menunggu backend | Sepakati kontrak status di awal Fase 4; frontend memakai mock sampai backend siap. |
| **Peleburan tiga menu membingungkan pengguna lama** | Keluhan setelah rilis | Route lama redirect (bukan 404), catatan rilis dengan peta lama→baru, dan shortcut Download-only tetap ada. |
| **Studio adalah potongan termahal** | Fase lain kehabisan waktu | Studio ada di Fase 7, setelah alur inti bisa dipakai. Kalau waktu habis, v2.0 bisa rilis dengan `ClipEditModal` lama sementara. |
| **Kualitas highlight AI ternyata masalah sebenarnya** | Revamp tidak mengubah kepuasan | **Ukur sebelum mulai:** dari `history.db`, hitung rasio klip yang di-rerender/dikoreksi. Kalau >60%, geser prioritas ke prompt/model. |

---

## Definition of Done — keseluruhan

Revamp dianggap selesai bila **semuanya** benar:

1. Sepuluh layar dan seluruh state di spec bisa dicapai di aplikasi nyata.
2. Setiap kontrol yang ada di v1.8.0 punya rumah baru — dibuktikan checklist per PR.
3. Job yang berjalan terlihat dari halaman manapun, dan bisa dibatalkan dari sana.
4. Job yang gagal bisa dipulihkan tanpa mengulang tahap yang sudah selesai.
5. Koreksi subtitle bisa diselesaikan **tanpa API key**.
6. Tidak ada `alert()`, `window.confirm`, atau `as any` tersisa di `src/`.
7. Audit kontras dan axe-core bersih, di dua tema.
8. `history.db` dari v1.8.0 terbaca penuh.
9. `en.json` dan `id.json` punya kunci identik; tidak ada string hardcode.
10. Enam alur E2E hijau di CI.

---

## Yang tidak masuk rencana ini

- Backlog PRD lain (split-screen multi-speaker, auto-post, translate subtitle, hook,
  cinematic effect, thumbnail generator).
- Responsive mobile.
- Web UI / Colab (`web/`) — dijadwalkan setelah desktop stabil.
- Perubahan identitas merek.
