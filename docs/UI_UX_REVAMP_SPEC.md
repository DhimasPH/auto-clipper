# Auto Clipper — UI/UX Revamp Design Spec

**Versi 2.0** · 16 Agustus 2026 · menggantikan `20260816uiuxrevampdesign.md`
**Status:** disepakati, tervalidasi lewat prototype klik-able (`prototype/`)

Dokumen ini adalah hasil rekonsiliasi antara spec versi 1 dan prototype yang sudah
diuji. Di mana keduanya berbeda, **prototype menang** — kecuali pada hal yang bisa
diputuskan dengan bukti, dan itu dicatat di §12.

---

## 1. Ringkasan

Merombak UI/UX Auto Clipper agar terasa profesional dan *workflow-centric*, **tanpa
menghilangkan satu pun fitur yang sudah ada**, sambil menutup empat kelemahan yang
ditemukan saat membaca kode v1.8.0:

1. Proses yang berjalan tidak terlihat.
2. Kegagalan tidak bisa dipulihkan dari UI.
3. Tiga menu berbeda merender form yang sama persis.
4. Fitur paling berharga (koreksi subtitle) terkubur tiga level.

Arah desainnya menjauhi estetika "AI slop" (gradien ungu-neon, glow berwarna) menuju
*dashboard* yang tenang: permukaan gelap netral, satu warna aksen, *hairline border*,
dan bayangan hitam lembut.

**Non-goal:** tidak ada fitur baru di luar UI. Backlog PRD lain (split-screen
multi-speaker, auto-post, translate subtitle, hook, cinematic effect, thumbnail
generator) di luar cakupan. Satu pengecualian, §7.4.

---

## 2. Design Token

### 2.1 Warna — diturunkan dari logo, bukan dikarang

`public/logo.svg` memakai tepat tiga warna: `#3B82F6` (blue), `#0F172A` (slate),
`#F9FAFB` (near-white). Palet di bawah diturunkan dari itu. Aplikasi v1.8.0 memakai
indigo `#6366f1` yang **tidak ada** di brand — itu diperbaiki.

**Aksen dipecah dua token, dan alasannya wajib dipahami:**

| Token | Dark | Light | Untuk |
|---|---|---|---|
| `--accent` | `#3B82F6` | `#1D4ED8` | Teks, border, ikon, focus ring, indikator |
| `--accent-solid` | `#2563EB` | `#2563EB` | **Permukaan terisi yang memuat teks putih** |
| `--accent-hover` | `#60A5FA` | `#1E40AF` | State hover |
| `--accent-muted` | `rgb(accent / 0.14)` | idem | Latar chip & baris nav aktif |

> **Kenapa dipecah.** Putih di atas `#3B82F6` hanya **3.68:1** — gagal WCAG AA untuk
> teks normal. Di atas `#2563EB` menjadi **5.17:1** dan lolos. Memakai satu token
> untuk teks *dan* isian tombol adalah kesalahan yang pemisahan ini cegah.
> Tombol primer wajib `bg-accent-solid`.

**Skala permukaan (dark)** — slate, berlabuh pada `#0F172A` milik logo:

| Token | Nilai | Peran |
|---|---|---|
| `--bg-primary` | `#070B14` | Latar halaman |
| `--bg-secondary` | `#0F172A` | Kartu, sidebar (warna gelap logo) |
| `--bg-elevated` | `#16203A` | Dock, dropdown, modal |
| `--bg-surface` | `#1E293B` | Panel di dalam kartu, tombol sekunder |

**Teks:** `#E8EDF5` / `#94A3B8` / `#64748B` (primary / secondary / tertiary).
**Border:** `rgba(255,255,255,0.08)`, aktif `0.16`.
**Semantik:** success `#22C55E`, error `#F87171`, warning `#FBBF24`, info `#60A5FA`.

**Light mode** dispesifikasikan penuh di `prototype/src.css`. Semua pasangan
foreground/background sudah diverifikasi ≥ 4.5:1 (≥ 3:1 untuk teks tersier).

### 2.2 Format token — perubahan teknis yang wajib ikut

`src/index.css` menyimpan warna sebagai **hex di dalam CSS variable**. Akibatnya
Tailwind tidak bisa menghasilkan opacity modifier: `border-error/30` gagal
di-compile. Itu sebabnya di kode sekarang ada `rgba()` hardcoded.

**Wajib:** simpan sebagai **channel RGB** dan deklarasikan
`rgb(var(--x) / <alpha-value>)` di `tailwind.config.js`. Warnanya identik, tapi
seluruh skala `/opacity` jadi bisa dipakai.

```css
:root { --accent: 59 130 246; }
```
```js
accent: { DEFAULT: 'rgb(var(--accent) / <alpha-value>)' }
```

Kelas yang dirakit saat runtime (`'badge-' + tone`) tidak terlihat scanner Tailwind —
daftarkan di `safelist`.

### 2.3 Tipografi

Font **Outfit** dipertahankan. Skala dikunci sebagai utility:

| Kelas | Ukuran | Bobot | Untuk |
|---|---|---|---|
| `t-display` | 28px | 700 | Judul hero |
| `t-page` | 22px | 700 | Judul halaman |
| `t-section` | 17px | 600 | Judul seksi |
| `t-card` | 15px | 600 | Judul kartu |
| `t-body` | 14px | 400 | Paragraf |
| `t-label` | 13px | 500 | Label form, tombol, item nav |
| `t-caption` | 12px | 400 | Teks bantuan, metadata |
| `t-overline` | 10px | 600, uppercase, tracking .12em | Label grup |

Angka, timestamp, path, dan log memakai **JetBrains Mono** + `tabular-nums`.

### 2.4 Material & gerak

- *Hairline border* di semua kartu. Tidak ada glow berwarna.
- Bayangan hitam lembut saja: `card`, `card-hover`, `dropdown`, `toast`, `dock`.
- *Glassmorphism tipis* (`backdrop-blur-md` + latar 80%) **hanya** di tiga tempat:
  top header, Job Dock, dan backdrop modal.
- Radius: kartu 12px, input/tombol 8px, badge penuh.
- Transisi 150ms untuk hover/warna, 200–220ms untuk masuk/keluarnya panel.
- Setiap elemen interaktif punya `:focus-visible` berupa outline aksen 2px.

---

## 3. Arsitektur Informasi

### 3.1 Navigasi

```
Sidebar (228px, bisa dilipat jadi 60px)
├── Workspace
│   ├── Projects       ← hub
│   └── New Project    ← satu pintu
└── (bawah)
    ├── Settings
    ├── Help & FAQ
    └── [lipat sidebar] [ganti tema]
```

**Projects, bukan History.** Di v1.8.0 setiap aksi pemulihan yang berarti — re-render,
AI Correct, Lanjut Manual, Edit Klip — hanya ada di History. Layar itu sudah menjadi
hub dalam praktiknya, tapi dinamai seperti arsip. Istilah "Project" juga sudah dipakai
PRD §2.2 ("Project Workspaces").

**Tiga pintu jadi satu.** `Workspace`, `Manual AI Editor`, dan `Manual Downloader`
merender `GenerateForm` yang identik; bedanya hanya satu string `provider`. Ketiganya
menjadi *mode* di langkah pertama New Project. Jalan pintas "Download only" tetap
tersedia di halaman Projects karena mental model penggunanya berbeda.

**Sidebar bisa dilipat.** Toggle di kaki sidebar, state disimpan di
`localStorage['ac_nav_collapsed']`. Saat terlipat hanya ikon yang tampil dan Job Dock
ikut menyesuaikan posisi kirinya.

### 3.2 Top header

Tinggi 48px, sticky, translucent (`bg-bg-primary/80` + `backdrop-blur-md`).
Isinya **breadcrumb** di kiri dan **indikator engine** di kanan (titik + label).
Tidak ada latar solid tebal, tidak ada duplikasi judul halaman.

### 3.3 Job Dock — komponen yang sebelumnya tidak ada

Dock permanen di kaki layar, di atas semua halaman kecuali Studio dan Welcome.

- Baris ringkas: ikon, jumlah job aktif, dan judul job yang sedang berjalan.
- Bisa diciutkan; state di `localStorage['ac_dock_collapsed']`.
- Tiap baris: nama project, fase saat ini, progress bar, ETA, **Open**, **Cancel**.
- Job antre ditampilkan dengan track kosong dan keterangan urutannya.

Ini yang mematikan empat masalah sekaligus: proses tak terlihat, tidak ada tombol
cancel, tidak ada indikator global, dan job yang "hilang" saat pindah halaman.

---

## 4. Kosakata Status

Satu kosakata dipakai backend dan frontend.

| Status | Label UI | Nada | Catatan |
|---|---|---|---|
| `QUEUED` | Queued | neutral | Baru |
| `DOWNLOADING` | Downloading | info | |
| `TRANSCRIBING` | Transcribing | info | |
| `ANALYZING` | Analyzing | info | **Baru** |
| `RENDERING` | Rendering | info | **Ganti nama** dari `CROPPING` |
| `DONE` | Completed | success | |
| `ERROR` | Failed | error | |
| `CANCELLED` | Cancelled | neutral | |
| `AWAITING_MANUAL` | Needs your AI | warning | |

**Dua perubahan penting:**

- `CROPPING` → `RENDERING`. Tahap itu bukan cuma crop — dia juga menggambar kanvas
  dan membakar subtitle. Nama lama membuat fase terpanjang terdengar sepele.
- `ANALYZING` **baru**. Di v1.8.0 tahap LLM tidak punya status sendiri, jadi UI diam
  di `TRANSCRIBING` selama proses berjalan — pengguna melihat progres macet tanpa
  penjelasan.

Frontend **tidak boleh** melakukan `setStatus(job.status as any)`. Union harus lengkap
dan status tak dikenal jatuh ke penanganan eksplisit.

---

## 5. Layar

Sepuluh layar. Semua state di bawah wajib ada, bukan opsional.

### 5.1 Splash
Tema gelap (sebelumnya terang, menyebabkan kedipan putih tiap cold start).
Logo, progress halus warna aksen, pesan tahap.
**State:** `loading`, `error` (engine gagal start, dengan penyebab + tindakan).

### 5.2 Welcome
Bukan lagi gerbang wajib tiap cold start; jadi tujuan yang bisa ditinggalkan dan
didatangi lagi. Mengikuti tema. Berisi identitas, satu CTA utama, tautan komunitas,
dan **CTA Trakteer** sebagai blok tersendiri.

> **Catatan aset.** `public/character.png` adalah RGB **tanpa alpha** dengan latar
> `#F1F1F1`. Di tema gelap dia tampil sebagai kotak putih. **Wajib diganti dengan PNG
> transparan** sebelum implementasi. Prototype memakai versi cutout sementara.

### 5.3 Projects — hub
Daftar kartu per project (bukan tabel: tiap baris membawa strip klip dan panel state
yang berbeda tinggi).

- Toolbar: pencarian, filter status (All / Running / Completed / Needs attention),
  jumlah hasil.
- Kartu: judul, badge status, badge mode, metarow (sumber, waktu, durasi komputasi,
  kualitas, rasio), lalu **badan yang berbeda menurut status**:
  - berjalan → fase + progress + ETA + klip yang sudah jadi
  - gagal → fase kegagalan + kode + pesan
  - `AWAITING_MANUAL` → ajakan lanjut ke handoff
  - selesai → strip klip yang bisa diklik ke Studio
  - download-only → nama file + ukuran + tombol buka folder
- Aksi: Open, dan aksi kontekstual (Fix & retry / Resume / Re-render), lalu Delete.
- **Delete** memakai dialog bernama yang merinci apa yang ikut terhapus, plus opsi
  "simpan klip, hapus sisanya". Bukan `window.confirm`.

**State:** `default`, `empty`, `loading` (skeleton, **bukan** spinner yang mengganti
seluruh daftar — v1.8.0 kehilangan posisi scroll tiap job selesai).

### 5.4 New Project — stepper 5 langkah

`Mode → Source → Format → Options → Review`, dengan rail ringkasan yang hidup di kanan.

1. **Mode** — AI Auto / Bring your own LLM / Download only. Tiap kartu menyebut
   kebutuhannya (API key atau tidak) dan estimasi waktunya.
2. **Source** — URL atau file lokal, judul project (wajib), kualitas unduhan, dan
   tombol cek kualitas tersedia.
3. **Format** — rasio, **mode switch 16:9**, burn subtitle, preview caption langsung,
   dan akordeon "Caption appearance" berisi kontrol lengkap.
4. **Options** — gaming footage, B-roll (dengan tautan langsung ke Settings bila key
   Pexels kosong), jumlah klip, model transkripsi, provider AI.
5. **Review** — ringkasan yang setiap barisnya bisa di-Edit, penjelasan apa yang akan
   terjadi, lalu **Start project**.

**Validasi inline per-field**, bukan lima toast setelah submit. Prasyarat yang berada
di layar lain selalu disertai tautan langsung ke sana.

**State:** kelima langkah + `invalid`.

### 5.5 Project detail
Layar penuh, bukan drawer (lihat §12).

- Header: judul, status, mode, URL, dan aksi (**Cancel job** saat berjalan).
- **Banner state**: gagal (dengan penyebab, dampak pada pekerjaan, dan tombol pulih),
  awaiting, cancelled, selesai, download-only.
- **Phase rail**: empat fase dengan durasi/hasil per fase, fase aktif dengan progress
  dan ETA, fase gagal ditandai merah beserta pesannya.
- **Grid klip** saat selesai; klip yang sudah jadi ikut tampil saat masih berjalan.
- **Activity log** yang bisa dibuka di tempat.
- Rail kanan: setelan yang dipakai + buka folder project.

**State:** `queued`, `rendering`, `done`, `error`, `cancelled`, `awaiting`, `download`.

### 5.6 Clip Studio — layar penuh
Menggantikan `ClipEditModal` (dan klonnya `ClipRerenderModal`).

- **Kiri**: preview dengan rasio yang bisa diganti, **kotak caption yang bisa
  digeser**, watermark overlay, playhead, tombol play.
- **Bawah**: timeline dengan bar per kata, handle trim in/out, penanda waktu.
- **Kanan (380px), tiga tab**:
  - **Transcript** — pencarian, daftar kata word-level yang sinkron dengan playhead
    dan bisa diedit, tombol **Fix mistakes** (§6).
  - **Captions** — posisi X/Y, lalu seluruh `SubtitleConfigControls`.
  - **Canvas** — mode switch 16:9 + seluruh `CanvasConfigControls`.
- Topbar: navigasi antar klip, penanda "Unsaved changes", Reset, **Save & re-render**
  dengan ringkasan perubahan sebelum konfirmasi.
- Keyboard: `Space` play/pause, `←` `→` geser playhead, `Esc` tutup dialog.

**State:** `default`, `nowords`, plus enam state fixer.

### 5.7 BYO-LLM Handoff
Tiga langkah: `Copy prompt → Paste hasil → Preview highlight ter-parse`.
Kesalahan parsing dijelaskan per baris **sebelum** submit, bukan setelah backend
menolak. Preview menampilkan posisi highlight di timeline sumber dan daftar
segmennya, masing-masing bisa dibuang.

**State:** `step1`, `step2`, `step3`, `invalid`.

### 5.8 Social Kit
Modal terstruktur: pilihan judul (dengan salin per item), deskripsi, hashtag, ide
thumbnail, waktu posting, backsound. Aksi: Regenerate, Copy all.

### 5.9 Settings
Lima seksi dengan nav kiri: **AI provider, Transcription, Output, Appearance, Updates**.

- **AI provider** — daftar provider dengan status key, lalu **Custom endpoint
  (OpenAI compatible)** dengan **tiga** field: Base URL, Model name, dan **API key**
  (opsional, boleh kosong untuk Ollama/lokal) plus tombol reveal. Test AI connection.
  Kartu Model muncul setelah test berhasil. Pexels terpisah.
- **Transcription** — model Whisper sebagai **kartu dengan status unduhan**
  (Active / Ready / Not downloaded), bukan dropdown. Catatan VAD selalu aktif.
- **Output** — folder simpan, kualitas default, notifikasi selesai (default **on**),
  cegah sleep saat render (default **on**).
- **Appearance** — tema, bahasa antarmuka, tampilkan welcome saat launch
  (default **on**).
- **Updates** — versi saat ini, cek sekarang, cek otomatis saat launch (default **on**).

Dihapus dari spec v1: *Keep source video after rendering*, *Subtitle language*,
*Include pre-releases*.

### 5.10 Help
Tiga tab: **User Guide / FAQ / System Logs**.

**System Logs** mempertahankan seluruh perilaku `HelpPage.tsx` dan menambah satu hal:

- Tiga sumber: Application / Errors / AI Requests (`GET /logs/{app|error|ai}`).
- Terminal chrome dengan nama file (`backend_app.log` dll).
- Pewarnaan baris: `[ERROR]`/`Traceback`/`Exception` merah, `[WARNING]` kuning,
  `[SUCCESS]`/`DONE` hijau, `[AI …]` aksen.
- Auto-scroll ke bawah, Refresh, Copy log, dan **Show files** (baru).
- State kosong dan state "engine tidak merespons" digambar terpisah.

---

## 6. Transcript Fixer — dua jalur, satu review

`ClipEditModal` punya dua sub-mode dan **keduanya wajib dipertahankan**.

| Jalur | Untuk siapa | Alur |
|---|---|---|
| **Use my API key** | punya key | satu tombol → hasil |
| **Copy to a chat model** | **tidak punya key** | app menulis prompt → user jalankan di ChatGPT/Gemini/Claude → paste balik |

Jalur kedua adalah bentuk kecil dari mode **Bring your own LLM** di level project:
Auto Clipper yang menulis prompt, pengguna hanya jadi kurir. Menghapusnya berarti
mengunci fitur koreksi di belakang API key.

**Keduanya bermuara ke satu review step.** Ini bagian terpentingnya:

- Daftar usulan `sebelum → sesudah`, timestamp, dan alasan tiap perubahan.
- Tiap baris bisa dicentang/dilepas, dan bisa melompatkan playhead ke kata itu.
- **Tidak ada yang ditulis ke transkrip sebelum diterima.** v1.8.0 langsung
  `alert("Subtitle berhasil diperbarui")` tanpa memperlihatkan apa yang berubah.
- Timing tidak pernah diubah — hanya kata.

Panel "no key" **tidak** menjadikan Settings satu-satunya jalan keluar; ia menawarkan
jalur copy-paste lebih dulu.

**State:** `fixauto`, `fixnokey`, `fixmanual`, `fixpaste`, `fixinvalid`, `fixreview`.

---

## 7. Kontrol Bersama

### 7.1 Satu modul, dua layar
`SubtitleConfigControls` dan `CanvasConfigControls` dipakai New Project **dan** Studio
dari satu sumber. Ini yang mencegah terulangnya kondisi v1.8.0: **empat picker aspect
ratio berbeda di empat layar** (4 / 4 / 3 / 2 opsi).

### 7.2 Subtitle — inventaris wajib lengkap
Quick presets (3) · caption mode (3) · font family (7) · font size (0.8/1.0/1.2/1.5) ·
font weight · outline width 0–5 · shadow depth 0–10 · pop / uppercase / italic ·
**empat warna** · **watermark** (teks + opacity 10–100%) · **posisi X/Y**.

> **Celah yang ditutup.** `outline_color` dan `shadow_color` ada di `SubtitleConfig`,
> dipakai live preview, dan ditulis setiap preset — tapi **tidak punya kontrol UI sama
> sekali** di v1.8.0. Satu-satunya cara mengubahnya adalah memilih preset, yang selalu
> menulis `#000000`. Dua field itu efektif konstanta yang menyamar jadi konfigurasi.
> Keputusan: **beri kontrolnya.** Kalau ditolak, hapus dari tipe — jangan didiamkan.

### 7.3 Canvas — mode switch dinaikkan
Dua kartu, persis `showModeSwitch`:
**Normal Landscape (16:9)** vs **Convert to 9:16 Vertical (Canvas)**.

Bedanya dengan v1.8.0: switch ini muncul **tepat di bawah pemilih rasio**, bukan
tersembunyi di dalam panel canvas yang baru muncul setelah 16:9 dipilih. Di Studio,
preview ikut berubah — frame 16:9 di tengah kanvas vertikal dengan latar blur / warna
/ gambar.

Lalu: background type (blur/color/image) · blur level (light/medium/strong) ·
5 preset warna + hex kustom · pemilih gambar · enlarge scale (1.0–2.0).

### 7.4 Posisi subtitle X/Y — satu-satunya fitur baru
Backlog PRD §6 meminta *"konfigurasi bebas mengatur posisi subtitle (X dan Y axis)
tiap clip"*. Ini jatuh gratis dari desain Studio: kotak caption **digeser langsung di
preview**, dengan slider dan preset (Top / Middle / Lower third) sebagai cadangan.

Konsekuensi ke belakang: `SubtitleConfig` bertambah `pos_x` dan `pos_y` (persen,
default 50 / 78), dan renderer harus memakainya menggantikan margin vertikal adaptif.

---

## 8. Pola Interaksi

| Pola | Aturan |
|---|---|
| **Destruktif** | Dialog bernama yang merinci konsekuensi + opsi yang lebih lunak bila ada. Dilarang `window.confirm`. |
| **Umpan balik** | Toast untuk hasil, inline untuk validasi. Dilarang `alert()` — sistem toast sudah ada. |
| **Menutup dialog** | Semua modal: Esc, klik backdrop, dan tombol X. Konsisten tanpa kecuali. |
| **Long-running** | Selalu punya fase bernama, elapsed, ETA, dan Cancel. Tidak ada overlay yang memblokir seluruh layar. |
| **Kegagalan** | Sebut fase, sebab, dampak pada pekerjaan yang sudah jadi, dan langkah pulih yang bisa diklik. |
| **Progressive disclosure** | Yang jarang dipakai masuk akordeon, tapi keberadaannya tetap terlihat sebelum dibuka. |
| **Prasyarat** | Selalu tautkan ke tempat pengaturannya, jangan cuma menyebut namanya. |

---

## 9. Aksesibilitas

- Semua pasangan warna ≥ 4.5:1 (≥ 3:1 untuk teks tersier dan komponen UI).
- `:focus-visible` terlihat di setiap kontrol.
- Toggle memakai `role="switch"` + `aria-checked`; segmented memakai `aria-selected`;
  breadcrumb memakai `nav[aria-label]`.
- Ikon dekoratif `aria-hidden`; tombol ikon wajib punya `title`/`aria-label`.
- Target sentuh minimal 32×32 px.

---

## 10. Internasionalisasi

Seluruh string baru masuk `en.json` dan `id.json`. String yang saat ini **melewati
i18n** dan harus diperbaiki saat disentuh:

- seluruh `OutputSection.tsx` (hardcode Indonesia)
- `<h2>Output</h2>`, `<h2>AI Provider</h2>`
- heading watermark `Watermark Video (Teks Sumber)`, placeholder-nya, dan caption `Opacity`
- `Loading...` di terminal log
- template label API key `` `${provider.label} API Key` ``
- `Backend endpoint not found. Please restart the app.`

---

## 11. Utang Teknis yang Menghalangi

Ini bukan pekerjaan desain, tapi implementasi akan menabraknya.

| # | Masalah | Lokasi |
|---|---|---|
| 1 | Setelan render disimpan **dua kali** (top-level & `metadata`), dan dua konsumer membaca sumber berbeda | `HistoryPage.tsx:302-311` vs `:371-374` |
| 2 | `captionStyle` dan `subtitleConfig.style` disimpan terpisah dan dicerminkan manual; tipe setter tidak memuat `single_word` | `App.tsx:75-79`, `:193` |
| 3 | `AppContext` bertipe `any` — nol type safety di seluruh turunannya | `App.tsx:28` |
| 4 | `ClipRerenderModal.tsx` (400 baris) klon mati dari `ClipEditModal.tsx` | — |
| 5 | Polling dibongkar-pasang tiap klip baru datang | `useClipJobs.ts:121` |
| 6 | Kegagalan polling hanya `console.error` | `useClipJobs.ts:115-117` |

### Bug fungsional — tambal lebih dulu, terlepas dari revamp

| # | Bug | Lokasi |
|---|---|---|
| A | Social Kit dari Workspace mengirim job id kosong (`ctx.job` tidak pernah ada) | `WorkspacePage.tsx:57` |
| B | Auto-correct membaca `localStorage['ai_provider']` padahal app menyimpan di `ac_provider` → hampir selalu "API Key belum diatur" | `ClipEditModal.tsx:84-88` vs `App.tsx:82` |
| C | Toast di `ManualResumeModal` tidak pernah tampil (instance `useToasts()` terpisah) | `ManualResumeModal.tsx:20` |
| D | Tombol Retry saat ERROR mustahil muncul — `jobId` di-null-kan di branch yang sama | `GenerateForm.tsx:364` vs `useClipJobs.ts:88-92` |
| E | `cancelJob()` ada dan diekspos tapi tidak punya tombol di layar manapun | `useClipJobs.ts:123` |
| F | Manual Downloader mengubah state global saat submit (judul & kualitas bocor) | `ManualDownloaderPage.tsx:42-43` |

---

## 12. Konflik dengan Spec v1 — dan keputusannya

| # | Spec v1 | Keputusan | Alasan |
|---|---|---|---|
| 1 | Aksen Blue `#3B82F6` | **Diterima**, dengan koreksi | Benar — logo memang blue. Tapi `#3B82F6` + teks putih = 3.68:1, gagal AA. Dipecah jadi `accent` / `accent-solid`. |
| 2 | Background zinc-900 → black | **Diganti slate** | Logo memakai slate `#0F172A`. Zinc netral-hangat bertabrakan dengan aksen biru. Slate lebih koheren, dan `#0F172A` jadi warna kartu. |
| 3 | Menu "History" | **Diganti "Projects"** | Layar itu sudah jadi hub dalam praktiknya. Istilahnya pun sudah ada di PRD §2.2. |
| 4 | Urutan: Input → Mode → Config | **Dibalik: Mode dulu** | Mode menentukan field apa yang relevan. BYO-LLM tidak butuh API key; Download-only tidak butuh jumlah klip. Menanyakan sumber lebih dulu memaksa menampilkan field yang mungkin tidak terpakai. |
| 5 | Project Detail sebagai **Drawer** kanan | **Layar penuh** | Isi layar ini adalah phase rail + grid klip + log + rail setelan. Di drawer 480px semuanya jadi kolom sempit, dan grid klip 9:16 praktis tidak muat. Konteks yang dijaga drawer tidak sebanding dengan ruang yang hilang. |
| 6 | Settings gaya **Bento Grid** | **Baris + nav kiri** | Isi Settings adalah pasangan label–kontrol dengan panjang teks berbeda-beda. Bento memaksa tinggi seragam dan memotong penjelasan. Nav kiri juga membuat tiap seksi punya URL sendiri. |
| 7 | **BusyOverlay** dipertajam glassmorphism | **Dihapus, diganti Job Dock** | Overlay yang memblokir layar persis mencegah hal yang paling dibutuhkan: menyiapkan project berikutnya sambil menunggu. Mempercantiknya tidak menyelesaikan itu. |
| 8 | Social link ke Footer/Sidebar/Help | **Tetap di Welcome** + Trakteer | Welcome bukan lagi gerbang wajib, jadi tidak lagi memperlambat kerja. Menyebarnya ke tiga tempat justru membuat sulit dicari. |
| 9 | ClipEditModal → side-panel **atau** full-screen | **Full-screen (Studio)** | Sudah selaras dengan spec v1. |

---

## 13. Yang Sengaja Tidak Dikerjakan

| Tidak dikerjakan | Alasan |
|---|---|
| Backlog PRD lain (split-screen, auto-post, translate, hook, cinematic, thumbnail) | Fitur baru, bukan revamp UI. Mencampurnya membuat hasil revamp tidak bisa dinilai. |
| Responsive mobile | Ini desktop app (Tauri). Satu breakpoint desktop. |
| Web UI / Colab (`web/`) | Permukaan terpisah, pengguna berbeda. Digarap setelah desktop stabil. |
| Mengubah logo, wordmark, atau identitas merek | Di luar cakupan. |

---

## 14. Referensi

- Prototype klik-able: `prototype/index.html` (peta), 10 layar, 30 state.
- Token: `prototype/src.css`, `prototype/tailwind.config.js`.
- Kontrol bersama: `prototype/assets/js/controls.js`.
- Rencana eksekusi: `docs/UI_UX_REVAMP_PLAN.md`.
