# Auto Clipper — Prototype Revamp UI/UX

Prototype **statis**. Tidak terhubung ke backend Python, tidak ada job engine, tidak ada video.
Yang divalidasi di sini adalah **cakupan layar, struktur navigasi, dan kelengkapan state** —
bukan timing.

Copy UI ditulis dalam bahasa Inggris (mengikuti `src/locales/en.json`).
Dokumen ini bahasa Indonesia karena sasarannya kamu dan tim dev.

---

## Cara membuka

Dobel-klik **`index.html`**. Tidak perlu server, tidak perlu internet.

`index.html` bukan layar aplikasi — itu **peta prototype**: daftar semua layar,
semua state, dan ringkasan apa yang berubah dari build sekarang. Mulai dari sana.

> Font Outfit diambil dari Google Fonts. Kalau offline, otomatis jatuh ke font
> sistem — tata letak tidak berubah.

## Prototype state switcher

Karena statis, tidak ada yang bisa ditunggu. Layar yang punya lebih dari satu state
menampilkan pil **Prototype state** di tengah-atas layar. Ganti lewat situ untuk
melompat ke kondisi kosong, berjalan, gagal, dibatalkan, atau selesai.

State juga bisa dipanggil lewat URL: `project.html?state=error`.

Tombol yang belum punya tujuan statis akan bilang terus terang lewat toast,
bukan diam-diam tidak melakukan apa-apa.

---

## Struktur file

```
prototype/
├── index.html          Peta prototype (mulai dari sini)
├── splash.html         Boot + handshake engine        states: loading, error
├── welcome.html        Brand & community
├── projects.html       Hub                            states: default, empty, loading
├── new-project.html    Stepper 5 langkah              states: mode, source, format, options, review, invalid
├── project.html        Detail & progress              states: rendering, queued, done, error, cancelled, awaiting, download
├── studio.html         Clip Studio                    states: default, nowords
├── handoff.html        Wizard BYO-LLM                 states: step1, step2, step3, invalid
├── settings.html       5 seksi                        states: provider, transcription, output, appearance, updates
├── help.html           FAQ & requirements
│
├── src.css             Sumber Tailwind + design token
├── tailwind.config.js
├── package.json        npm run css / npm run watch
│
└── assets/
    ├── css/app.css     HASIL BUILD — jangan diedit langsung
    ├── vendor/         jquery 3.7.1
    ├── img/            logo, character (disalin dari public/, tidak diubah)
    └── js/
        ├── data.js     Semua mock data. Bentuknya sengaja mengikuti tipe asli.
        ├── shell.js    Sidebar, Job Dock, ikon, toast, modal, state switcher
        └── <layar>.js  Satu file per layar
```

### Kalau mengubah class Tailwind

`assets/css/app.css` adalah hasil build. Setelah menambah class baru di HTML/JS:

```bash
cd prototype
npm install          # sekali saja
npm run css          # build ulang
npm run watch        # atau: rebuild otomatis sambil ngoprek
```

Class yang dirakit saat runtime (`'badge-' + tone`) tidak terlihat oleh scanner
Tailwind — daftarnya ada di `safelist` dalam `tailwind.config.js`. Tambahkan ke
situ kalau membuat pola serupa.

---

## Keputusan desain yang perlu dibaca sebagai usulan

### 1. Tiga pintu masuk jadi satu

`Workspace`, `Manual AI Editor`, dan `Manual Downloader` merender `GenerateForm`
yang sama persis — bedanya cuma satu string `provider`. Ketiganya dilebur jadi
**New Project** dengan pemilihan mode di langkah pertama:
`AI Auto` / `Bring your own LLM` / `Download only`.

Jalan pintas "Download only" tetap ada di halaman Projects, karena secara mental
model itu tugas yang berbeda meski alurnya sama.

### 2. History dinaikkan jadi Projects

Rerender, AI Correct, Lanjut Manual, dan Edit Klip **hanya ada di History** —
jadi secara praktik History sudah menjadi hub, tapi dinamai seperti arsip.
Istilah "Project" juga sudah dipakai PRD §2.2 ("Project Workspaces").

### 3. Job Dock permanen

Dock di bawah layar menampilkan job aktif + antrean di semua halaman, dengan
progress per fase dan tombol Cancel. Sekarang, begitu pindah halaman, job yang
berjalan hilang dari layar sampai toast selesai muncul.

### 4. Studio menggantikan ClipEditModal

Timeline + playhead, trim in/out, transcript word-level yang sinkron, dan
**kotak subtitle yang bisa digeser langsung di preview** — sekaligus melunasi
backlog PRD §6 *"konfigurasi bebas mengatur posisi subtitle (X dan Y axis) tiap clip"*.

Yang benar-benar interaktif di prototype (murni frontend, jadi nyata):
playhead, play/pause, scrub, trim handle, edit kata, dan drag caption.
`Space` play/pause, `←` `→` geser playhead.

### 5. Handoff BYO-LLM jadi 3 langkah

`Copy prompt → Paste hasil → Preview highlight ter-parse` sebelum commit.
Error parsing ditampilkan per baris dengan alasannya, bukan setelah submit
dari backend.

---

## Perubahan token yang perlu ikut ke implementasi

`src/index.css` menyimpan warna sebagai **hex di dalam CSS variable**. Akibatnya
Tailwind tidak bisa membuat opacity modifier dari token itu — `border-error/30`
gagal di-compile. Itu sebabnya di kode sekarang muncul `rgba()` hardcoded di
beberapa tempat.

Prototype menyimpan warna sebagai **channel RGB** dan mendeklarasikannya sebagai
`rgb(var(--x) / <alpha-value>)`. Warnanya identik, tapi seluruh skala `/opacity`
jadi bisa dipakai. Lihat catatan di `src.css`.

---

## Kosakata status

Prototype mengusulkan satu kosakata bersama. Dua perubahan penting:

| Sekarang | Prototype | Alasan |
|---|---|---|
| `CROPPING` | `RENDERING` | Tahap itu bukan cuma crop — dia juga menggambar kanvas dan membakar subtitle. |
| *(tidak ada)* | `ANALYZING` | Tahap LLM tidak punya status sendiri, jadi UI diam di `TRANSCRIBING` selama proses berjalan. |

Selengkapnya: `QUEUED · DOWNLOADING · TRANSCRIBING · ANALYZING · RENDERING ·
DONE · ERROR · CANCELLED · AWAITING_MANUAL`.

---

## Yang sengaja TIDAK ada

| Tidak ada | Alasan |
|---|---|
| Job engine & timer | Yang divalidasi ronde ini adalah cakupan layar, bukan timing. State switcher menggantikannya. |
| Persistensi | Refresh = kembali ke awal. Hanya tema dan posisi dock yang disimpan. |
| Video & waveform asli | Tanpa backend tidak ada decoding audio. Poster + playhead palsu cukup untuk menilai tata letak dan interaksi drag. |
| Backlog PRD lain | Split-screen multi-speaker, auto-post, translate subtitle, hook, cinematic effect, thumbnail generator. Semuanya fitur baru, bukan revamp UI. |
| Responsive mobile | Ini desktop app (Tauri). Satu breakpoint desktop. |
| Web UI / Colab (`web/`) | Permukaan terpisah, pengguna berbeda. |

---

## Temuan di kode existing yang jadi dasar redesign

Semuanya dari pembacaan `src/` pada versi 1.8.0.

| # | Temuan | Lokasi |
|---|---|---|
| 1 | `progress` dari backend disimpan tapi tidak pernah dirender di layar manapun | `useClipJobs.ts:110` → `App.tsx:223` |
| 2 | `progressPct` tangga hardcoded 15/45/60/100; fase render mentok 60% karena `totalClips` hanya di-set di jalur manual | `useClipJobs.ts:418-429`, `:234` |
| 3 | Tombol Retry saat ERROR mustahil muncul — `jobId` di-null-kan di branch yang sama yang men-set ERROR | `GenerateForm.tsx:364` vs `useClipJobs.ts:88-92` |
| 4 | `cancelJob()` ada dan diekspos, tapi tidak ada tombolnya di layar manapun | `useClipJobs.ts:123`, `App.tsx:228` |
| 5 | Social Kit dari Workspace mengirim job id kosong (`ctx.job` tidak ada) | `WorkspacePage.tsx:57` |
| 6 | Auto-correct membaca localStorage key yang salah (`ai_provider` vs `ac_provider`) | `ClipEditModal.tsx:84-88` vs `App.tsx:82` |
| 7 | Toast di `ManualResumeModal` tidak pernah tampil — instance `useToasts()` terpisah | `ManualResumeModal.tsx:20` |
| 8 | `captionStyle` disimpan ganda dan bisa desync; default `single_word` tidak ada di tipe setter | `App.tsx:75-79`, `:193` |
| 9 | Manual Downloader mengubah state global saat submit (judul & kualitas bocor ke form AI) | `ManualDownloaderPage.tsx:42-43` |
| 10 | Panel inline di History berbagi satu state untuk semua job | `HistoryPage.tsx:28-33` |
| 11 | Setelan render dibaca dari dua sumber berbeda yang bisa berbeda isi | `HistoryPage.tsx:302-311` vs `:371-374` |
| 12 | Polling gagal hanya `console.error` — UI membeku tanpa tanda | `useClipJobs.ts:115-117` |
| 13 | Interval polling dibongkar-pasang tiap klip baru datang | `useClipJobs.ts:121` |
| 14 | Navigasi keras `window.location.hash` dari dalam callback polling | `useClipJobs.ts:103` |
| 15 | Refresh History mengganti seluruh list dengan spinner, posisi scroll hilang | `HistoryPage.tsx:86-89` |
| 16 | `alert()` native dipakai 4 kali padahal sistem toast sudah ada | `ClipEditModal.tsx:75,100,107,157` |
| 17 | `ClipRerenderModal.tsx` (400 baris) klon mati dari `ClipEditModal.tsx` | — |
| 18 | Opsi aspect ratio berbeda di 4 tempat (4/4/3/2 opsi) | `GenerateForm.tsx:184`, `HistoryPage.tsx:190`, `ClipEditModal.tsx:360`, `ManualDownloaderPage.tsx:107` |
| 19 | LandingPage hardcode warna terang, mengabaikan tema | `LandingPage.tsx:22-24` |
| 20 | Rerender mengirim `title: ""` diam-diam | `useClipJobs.ts:292,332` |

Nomor 5, 6, 7 adalah **bug fungsional**, bukan masalah desain — layak ditambal
lebih dulu terlepas dari revamp ini.

---

## Revisi 2 — hasil review pertama

| Feedback | Yang dilakukan |
|---|---|
| Gambar welcome kepotong / kurang fit | **Ini bukan masalah CSS.** `public/character.png` itu **RGB tanpa alpha**, background-nya abu terang `#F1F1F1` — di tema gelap dia jadi kotak putih. Prototype pakai `assets/img/character-cutout.png` (background dibuang + di-crop ke konten). File aslimu tidak disentuh. **Untuk implementasi: ganti aset ini dengan PNG transparan.** |
| CTA Trakteer hilang | Dikembalikan, sebagai blok "Support on Trakteer" tersendiri di kartu Community — bukan tombol sosial ke-7 yang tenggelam. Facebook & Website juga dikembalikan. |
| Help tidak ada view log | Help sekarang bertab: **User Guide / FAQ / System Logs**, sama seperti `HelpPage.tsx`. Log viewer punya 3 sumber (Application / Errors / AI Requests), terminal chrome dengan nama file, pewarnaan `[ERROR]`/`[WARNING]`/`[SUCCESS]`/`[AI …]`, Refresh, Copy log, plus **Show files** yang di app sekarang belum ada. State kosong dan state "backend mati" ikut digambar. |
| Custom endpoint tidak ada API key | Ditambahkan. Tiga field sesuai `CustomConfigModal`: Base URL, Model name, dan **API key** dengan placeholder *"Leave empty for Ollama or a local endpoint"* + tombol reveal. Ditambah "Test AI connection". |
| Show welcome screen at launch → default true | Diubah jadi true. |
| Include pre-releases | Dihapus. (Di app sekarang toggle ini memang tidak ada.) |
| Check automatically at launch → default true | Tetap ada, default true. |
| Prevent sleep while rendering → default true | Sudah true. |
| Notify me when a job finishes → default true | Sudah true. |
| Keep source video after rendering | Dihapus. |
| Subtitle language | Dihapus. |
| 16:9 tidak ada pilihan original vs canvas portrait | Ditambahkan sebagai **mode switch dua kartu**, persis `CanvasConfigControls` saat `showModeSwitch`: **Normal Landscape (16:9)** vs **Convert to 9:16 Vertical (Canvas)**. Muncul tepat di bawah pemilih rasio — bukan tersembunyi di dalam panel canvas. Preview Studio ikut berubah: frame 16:9 di tengah kanvas vertikal dengan background blur/warna/gambar. |
| Watermark & config subtitle hilang | Semua dikembalikan dan dijadikan modul bersama `assets/js/controls.js`, dipakai New Project **dan** Studio: quick presets, caption mode (3), font family (7), font size (0.8/1/1.2/1.5), font weight, outline width (0–5), shadow depth (0–10), pop/uppercase/italic, empat warna, dan **watermark** (teks + opacity 10–100%). |

### Dua celah di build sekarang yang ikut ditambal

1. **`outline_color` dan `shadow_color` tidak punya kontrol UI sama sekali.** Keduanya ada di `SubtitleConfig`, dipakai di live preview, dan di-set oleh setiap preset — tapi tidak ada satupun input untuk mengubahnya. Satu-satunya cara mengubah adalah memilih preset (yang selalu menulis `#000000`). Prototype menambahkan kontrol untuk keduanya.
2. **Watermark tidak punya kontrol posisi**, dan opacity minimumnya `0.1` sehingga tidak bisa benar-benar transparan. Prototype mempertahankan perilaku itu apa adanya — dicatat di sini supaya jadi keputusan sadar, bukan kelupaan.

---

## Revisi 3 — transcript fixer punya dua jalur lagi

Revisi 2 menyisakan satu kesalahan gua: `ClipEditModal` punya **dua** sub-mode di bagian
"AI Auto Correction", dan gua cuma bawa satu.

| Sub-mode di app sekarang | Status di revisi 2 | Status sekarang |
|---|---|---|
| `auto` — `POST /ai/correct-subtitle` pakai API key tersimpan | Ada (Auto-fix) | Ada, tab **"Use my API key"** |
| `manual` — **app yang menulis prompt-nya**, user jalankan di chat model apa saja, lalu paste JSON balik | **Hilang** | Ada, tab **"Copy to a chat model"** |

Jalur `manual` itu yang melayani user tanpa API key, dan itu bukan fitur pinggiran —
itu konsisten dengan mode **Bring your own LLM** di level project. Sekarang pola-nya
seragam di dua tempat: Auto Clipper yang menulis prompt, user cuma jadi kurir.

**Bentuknya di prototype** (`studio.html` → tab Transcript → **Fix mistakes**):

- **Tab "Use my API key"** — provider + model kelihatan, satu tombol *Find mistakes*.
  Kalau key belum ada, panel ini **tidak** menyuruh lu ke Settings sebagai satu-satunya
  jalan keluar; dia menawarkan tab sebelahnya lebih dulu.
- **Tab "Copy to a chat model"** — dua langkah: copy prompt (instruksi + JSON word-level,
  sama seperti `generatePrompt()`), lalu paste hasilnya. Ada shortcut ChatGPT / Gemini / Claude
  dan tombol *Use a sample*.
- **Satu review step yang dipakai berdua.** Ini bagian terpentingnya: `alert("Subtitle berhasil
  diperbarui")` diganti daftar perubahan **sebelum** apa-apa ditulis. Tiap baris menunjukkan
  `sebelum → sesudah`, timestamp, alasannya, dan bisa dicentang/dilepas satu-satu. Ada tombol
  jump ke playhead per perubahan. Timing tidak pernah disentuh, cuma kata.
- **Paste yang salah dijelaskan per aturan**, bukan `JSON.parse` gagal lalu diam.

Transkrip mock sengaja gua isi 4 kesalahan ASR yang wajar (`buisness`, `tution`, `thats`,
`their`) supaya review step-nya punya bahan nyata, bukan diff karangan.

State yang bisa dilompati dari switcher: `fixauto`, `fixnokey`, `fixmanual`, `fixpaste`,
`fixinvalid`, `fixreview`.

> Catatan: di build sekarang jalur `auto` membaca localStorage key yang salah
> (`ai_provider` padahal app menyimpan di `ac_provider`), jadi hampir selalu gagal dengan
> "API Key belum diatur" walaupun key-nya ada. Artinya jalur `manual` **satu-satunya yang
> benar-benar jalan hari ini** — alasan tambahan kenapa dia tidak boleh hilang.

### Catatan aset

`character-cutout.png` dibuat otomatis dari `character.png` (flood-fill background + crop). Hasilnya bagus di ukuran kecil, tapi kalau nanti dipakai besar, lebih baik minta versi PNG transparan aslinya dari sumber desainnya.

---

## Pertanyaan yang belum terjawab

- **Job Dock**: dock bawah (dipakai di prototype) atau rail kanan yang selalu terlihat?
- **Clip Studio**: halaman penuh (dipakai di prototype) atau overlay di atas Projects?
- **Nama menu**: "Projects" sudah dipakai — cek apakah terasa benar setelah diklik-klik.
