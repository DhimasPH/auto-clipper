# SP2 audit antislop (Task 15)

Tanggal: 2026-11-24. Branch `feat/sp2-ux-for-everyone`, BASE Task 15 `a068ee6`.
Commit Task 15: `88f8540` (satu Dialog dengan focus trap, focus kembali, penjaga isian), `031a6da` (audit layar lama: kontras, teks, muat di HP), `2eb263a` (wip saat kuota habis, sekarang sudah diverifikasi), dan commit penutup audit ini.

Skill yang dipakai: `antislop` (inti dan Delivery Gate), `antislop-copywriting`, `antislop-ui`, `antislop-layoutmobile`, `antislop-human` (termasuk skrip `contrast-check.py`). Mode: audit setelah pekerjaan (mode 2), dengan semua temuan langsung diperbaiki karena pemilik sudah menyetujui "ikuti rekomendasi" (HANDOFF bagian 4 dan 7).

Design Read (dari spec bagian 3 dan Global Constraints): alat langkah demi langkah untuk kreator awam di HP, gaya tenang dan netral dengan satu aksen biru, dial ENERGY 1 / RHYTHM 1 / MOTION 1. Motif identitas: penanda langkah bernomor. Satu titik fokus per layar: satu tombol terisi.

## Cara memeriksa

- Pencarian kode (`src/`, semua file termasuk gerbang, dialog, dan panel lanjutan sesuai P11): warna mentah atau token tak terdefinisi, `alert(`/`confirm(`, `<div onClick>`, tombol ikon tanpa `aria-label`, `outline-none` tanpa pengganti, `text-xs` dan ukuran huruf di bawah 14 px, tombol di bawah 44 px, teks yang tidak lewat i18n, emoji dan em dash di semua teks locale.
- Kontras: semua pasangan token di `src/index.css` (dipakai lewat `tailwind.config.js`) dihitung dengan rumus WCAG 2.x (skrip sendiri, dicocokkan dengan `contrast-check.py` antislop), termasuk latar tipis `/10` pada badge.
- Browser: build `dist/` dilayani `backend.main --web`, Edge headless lewat CDP dengan data backend tiruan (proyek berjalan, menunggu AI, selesai, gagal). 360×780, 768×1024, 1280×800, terang dan gelap, plus cek bahasa Inggris di 360 terang. Per layar diukur: luas halaman melebihi layar, elemen keluar tepi, kontrol di bawah 44 px, huruf di bawah 14 px, error di console. Tangkapan layar ada di `.superpowers/sdd/2026-11-20-sp2-ux-for-everyone/screens/` (75 gambar, `report.json`; folder ini tidak ikut git).
- Keyboard: Tab di Buat klip, Riwayat, Pengaturan; menu titik tiga lalu dialog hapus (fokus masuk, Tab berputar di dalam, Escape menutup dan fokus kembali); dialog ubah klip dengan isian (Escape bertanya dulu). Dijalankan di keenam kombinasi lebar dan tema.

## 1. Copywriting

| Cek | Hasil |
|---|---|
| Em dash di teks apa pun (R-02) | PASS. Tes baru di `plainWords.test.ts` memeriksa SEMUA teks id/en (bukan hanya layar utama): 0 temuan. Sebelumnya 3 em dash tersisa di namespace lama yang tidak dipakai, sudah dihapus. |
| Emoji dekoratif | PASS. Tes yang sama: 0 emoji di seluruh locale. Sebelumnya 11 kunci ber-emoji (`main.*`, `clip.*`, `history.*`, `busy.*`, `smartEditor.*`) di namespace yang tidak dipakai kode mana pun; namespace `main`, `clip`, `history`, `busy`, `sidebar`, `header`, `aiClipper`, `manualAI` dan `smartEditor` kecuali `noClips` dihapus (diperiksa dengan grep, termasuk kunci dinamis). |
| Kata teknis di layar utama | PASS. `plainWords.test.ts` kini juga memeriksa `timing.device_*` (baris perangkat di layar progres). Temuan baru di luar `src/`: catatan dan kartu pemeriksaan awal dari backend tampil di Buat klip dan memakai "FFmpeg", "merender", "Render memakai prosesor". Diganti: "program pengolah video", "membuat klip", "Klip dibuat dengan prosesor" (`backend/errors.py` FFMPEG_MISSING, `backend/preflight.py` disk dan gpu_render); nama teknis tetap ada di "Detail teknis". Tes backend baru `test_messages_shown_on_the_main_screen_avoid_the_banned_words` memakai daftar kata yang sama untuk semua keadaan pemeriksaan awal. Kutipan teks itu di `docs/tutorial-auto-clipper-cloud.md` dan `docs/panduan-penggunaan-awam.md` ikut disesuaikan. |
| CTA generik, buzzword, tanda seru (R-15, R-16) | PASS. Pencarian `get started`, `learn more`, `explore`, `discover`, `seamless`, `powerful`, `viral`, `ajaib`, `!` di locale: 0 temuan. Tombol berupa kata kerja (Mulai, Salin perintah, Buat ulang klip ini, Ya, hapus, Periksa lagi). `ConfirmDialog` kini wajib diberi `confirmLabel` (tidak ada lagi bawaan "Konfirmasi"). |
| Pesan masalah: apa, kenapa, harus apa | PASS untuk layar lama P11: `alert()`/`confirm()` diganti pesan di tempat (`role="alert"`), alasan mentah backend dipindah ke "Detail teknis" (`TechnicalDetails`). Contoh: `clip_rerender.save_failed`, `clip_rerender.auto_failed`, `projects.delete_failed`. |
| Teks tanpa i18n | PASS. Teks keras di JSX hanya placeholder format (`https://youtube.com/…`, `#000000`, `http://localhost:11434/v1`, `llama3`). |

## 2. UI

| Cek | Hasil |
|---|---|
| Token tak terdefinisi / warna mentah (P11) | PASS. 0 `bg-bg-card`, `text-accent-fg`, `bg-white`, `text-white` di atas aksen, warna Tailwind mentah (red/green/amber/purple). Sisa yang disengaja: `bg-black` di bingkai video, `text-black`/`text-white` untuk tanda centang di atas contoh warna (dipilih sesuai warna contohnya), bingkai pratinjau abu `#6B6E74` agar subtitle terang dan gelap sama-sama terlihat. |
| Satu aksen, palet 2-3 warna + aksen (R-29) | PASS. Netral + biru `--accent`; merah/kuning/hijau hanya untuk status. |
| Gradien, kilau, glow, animasi dekoratif (R-01, R-13, R-19) | PASS. Animasi `float`, `gradient-x`, `mesh`, `fade-in-up` dihapus dari `tailwind.config.js` (tidak dipakai). Gerak yang tersisa: spinner, transisi hover/fokus, dan pratinjau "pop" subtitle (lihat Ruling 4). |
| Satu tombol terisi per layar | PASS. Kartu error di daftar Riwayat memakai `quiet` (semua tombol garis); di layar lain hanya satu `primary`. |
| Ikon (R-04) | PASS. lucide-react (aturan repo F.5), hanya di tempat yang memperjelas; ikon dekoratif berlabel `aria-hidden`. Ikon tile di bagian Pengaturan lama dihapus. |
| Badge status (R-09) | Diperbaiki. `Badge` memakai latar tipis `bg-success/10` dsb.; di atas latar halaman terang teks hijau 4,36:1 dan kuning 4,38:1 (gagal AA). Kini latar `bg-bg-secondary` padat dengan garis warna status: hijau 5,37:1, kuning 5,43:1, merah 6,57:1 (terang); 9,20 / 9,49 / 7,38:1 (gelap). Tes penjaga: `contrast.test.ts` menolak latar transparan di `Badge.tsx`. |

## 3. Layout dan HP

| Cek | Hasil |
|---|---|
| Overflow horizontal (R-03) | PASS. 75 pemeriksaan halaman (12 tampilan × 3 lebar × 2 tema + 3 layar bahasa Inggris, termasuk dialog Bagikan, dialog hapus, dan dialog ubah klip): overflow 0 px, 0 elemen keluar tepi. |
| Area sentuh 44 px | PASS. 0 kontrol di bawah 44 × 44 px di semua halaman yang diukur (label pembungkus dihitung sebagai area sentuh). Perbaikan wip: `summary` Detail waktu dan tombol jenis log kini min 44 px. |
| Huruf isi | PASS. 0 teks di bawah 14 px yang terlihat; isi memakai `text-body` 16 px, label/caption 14 px. Satu-satunya 12 px adalah watermark di pratinjau `aria-hidden` (Ruling 5). |
| Grid melipat | PASS. Pilihan blur 1 kolom di HP (3 di `sm`), skala video 2 kolom (5 di `sm`), ukuran huruf subtitle 2 kolom; legend "Wajah di tengah" tidak lagi tertembus garis (`ClipOptions`, minor Task 8). |
| Navigasi | PASS. Navigasi bawah di < 768 px, sidebar ramping dari 768 px; urutan Tab di HP: isi dulu lalu navigasi bawah. Navigasi bawah tidak menutupi tombol Mulai (terlihat di tangkapan 360). |

## 4. Manusia: kontras dan keyboard

### Kontras (WCAG 2.x, dihitung dari token `src/index.css`)

Teks (minimal 4,5:1). Format: terang / gelap.

| Teks di atas latar | Terang | Gelap |
|---|---|---|
| text-primary / bg-primary | 15,59 | 15,45 |
| text-primary / bg-secondary | 16,87 | 14,25 |
| text-primary / bg-surface | 14,25 | 12,61 |
| text-primary / accent-muted | 14,50 | 12,16 |
| text-secondary / bg-primary | 6,59 | 7,68 |
| text-secondary / bg-secondary | 7,13 | 7,08 |
| text-secondary / bg-surface | 6,03 | 6,27 |
| text-secondary / accent-muted | 6,13 | 6,04 |
| accent / bg-primary | 5,44 | 7,77 |
| accent / bg-secondary | 5,89 | 7,17 |
| accent / bg-surface | 4,97 | 6,35 |
| accent / accent-muted | 5,06 | 6,12 |
| on-accent / accent (tombol utama) | 5,89 | 7,31 |
| on-accent / accent-hover | 7,66 | 9,52 |
| error / bg-primary, bg-secondary, bg-surface | 6,08 / 6,57 / 5,55 | 8,00 / 7,38 / 6,54 |
| warning / bg-primary, bg-secondary, bg-surface | 5,01 / 5,43 / 4,58 | 10,29 / 9,49 / 8,40 |
| success / bg-primary, bg-secondary, bg-surface | 4,97 / 5,37 / 4,54 | 9,97 / 9,20 / 8,14 |
| error / warning / success di atas accent-muted | 5,65 / 4,66 / 4,62 | 6,30 / 8,10 / 7,85 |
| Badge lama: success / warning di atas `/10` + bg-primary | 4,36 / 4,38 (GAGAL, diperbaiki) | 8,30 / 8,55 |

Non-teks (minimal 3:1): border-active terhadap bg-primary / bg-secondary / bg-surface 3,28 / 3,55 / 3,00 (terang), 4,43 / 4,09 / 3,62 (gelap); cincin fokus (accent) terhadap ketiga latar 5,44 / 5,89 / 4,97 dan 7,77 / 7,17 / 6,35; kenop saklar 5,89 dan 7,31; titik status koneksi semua di atas 4,9. Sepuluh pasangan di brief dijalankan juga lewat `contrast-check.py` antislop dengan hasil sama (15,59; 6,03; 5,89; 5,44; 6,57; 15,45; 6,27; 7,31; 7,77; 7,38). `src/styles/contrast.test.ts` kini menguji 27 pasangan teks dan 9 pasangan non-teks per tema (sebelumnya 17 dan 3).

### Keyboard (Edge headless, keenam kombinasi lebar × tema)

- Buat klip: Tab berurutan sesuai tampilan (di 768/1280 navigasi samping dulu, di 360 isi dulu lalu navigasi bawah); setiap elemen yang terfokus punya outline terlihat (0 elemen tanpa fokus terlihat).
- Riwayat: judul proyek, menu titik tiga per proyek, tombol utama per baris, tombol di kartu error, semuanya bisa dicapai dan bercincin fokus.
- Menu titik tiga → Hapus: fokus pindah ke "Batal" di dalam dialog, Tab berputar Ya, hapus → Tutup → Batal tanpa keluar dialog, Escape menutup dan fokus kembali ke tombol menu proyek itu.
- Dialog ubah klip dengan isian: Escape memunculkan "Isian di jendela ini belum dipakai dan akan hilang bila ditutup." dengan Kembali mengisi / Tutup tanpa menyimpan; Escape kedua kembali ke isian (dialog tetap terbuka, fokus di kotak teks).
- Pengaturan: tombol tema, bahasa, cookies, saklar, kunci Pexels, pilihan, unduh model, semua bercincin fokus.
- Tombol coba lagi yang hilang setelah ditekan: fokus pindah ke judul halaman atau tautan Kembali, bukan ke `<body>` (tes baru di `ProjectPage.test.tsx` dan `ProjectsPage.test.tsx`; tes ProjectPage terbukti gagal bila baris fokus dihapus).
- Console: 0 error dan 0 exception di seluruh putaran browser.

## Item "deferred → Task 15" dari ledger

| Asal | Item | Status |
|---|---|---|
| Task 4 | ConfirmDialog tanpa focus trap / focus kembali, bawaan "Konfirmasi" | Selesai (`88f8540`): ConfirmDialog memakai `Dialog`, `confirmLabel` wajib. |
| Task 5, 8, 12, 13, 14 | Cek browser 360/768/1280 | Selesai: 75 pemeriksaan, 0 masalah (lihat bagian 3). |
| Task 8 | `<legend>` tertembus garis di `ClipOptions` | Selesai (`031a6da`). |
| Task 13 | Dialog tanpa focus trap/return; tutup lewat latar/Escape tanpa penjaga isian | Selesai (`88f8540`, `2eb263a`), diverifikasi di browser. |
| Task 13 | Tombol coba lagi hilang, fokus jatuh ke body; tes re-render dialog hanya untuk ProjectsPage | Selesai: kode di `88f8540`, tes fokus untuk kedua halaman dan tes re-render dialog ProjectPage (termasuk muat ulang karena `historyVersion`) ditambah di commit ini. |
| Task 14 | Bagian lama Provider/Transcription/Cookies/Updater: ikon tile, `text-xs`, "AI Provider", "⚙️", error mentah | Selesai (`031a6da`), grep 0 temuan. |
| Task 14 | Judul OutputSection tidak cocok di luar desktop; tes emoji memakai mock bagian lama; pengunduh tanpa pesan selesai | Selesai (`031a6da`): judul sesuai isi, `SettingsPage.real.test.tsx` merender bagian asli, `DownloaderPanel` memberi pesan selesai. |

Di luar daftar itu, implementer sebelumnya juga menyelesaikan minor Task 13 "Lihat progres buntu untuk job dari tab lain" (`watchJob` di `useClipJobs`, dengan 2 tes). Minor Task 13 lain yang tidak ditandai untuk Task 15 (duplikasi FailedRowError, judul cadangan `local:`, urutan `fetchProjects`) tetap ditunda.

## Ruling

1. Teks pemeriksaan awal dan FFMPEG_MISSING di backend ikut diaudit walau di luar `src/`, karena tampil di layar Buat klip dan spec 4.6 bagian tujuan berkata semua teks yang terlihat lolos aturan teks. Biaya bila salah: tiga kalimat dikembalikan.
2. `COOKIES_INVALID_FORMAT` tetap menyebut "JSON": pengguna yang mengekspor cookies dalam format JSON perlu tahu persis apa yang salah, dan pesan ini muncul di alur unggah cookies, bukan teks layar utama. Biaya bila salah: satu kata diganti.
3. "Deno", "NVIDIA", "GPU", "API key" tetap di catatan dan pengaturan: nama yang harus dikenali pengguna untuk bertindak (pasang dari deno.com, kartu grafis NVIDIA), tidak ada di daftar kata terlarang. Biaya bila salah: penulisan ulang beberapa kalimat.
4. Pratinjau "pop" subtitle berulang terus: menunjukkan animasi yang dipilih pengguna untuk klipnya, berada di pratinjau `aria-hidden`, dan berhenti lewat aturan global `prefers-reduced-motion` di `src/index.css`. Biaya bila salah: pratinjau diam.
5. Watermark 12 px putih di pratinjau: simulasi ukuran watermark di video, bukan teks antarmuka, kontras 5,11:1 di bingkai `#6B6E74`. Biaya bila salah: ukuran pratinjau dinaikkan.
6. Tombol utama nonaktif (opacity 50 %) di bawah 4,5:1: WCAG 1.4.3 tidak berlaku untuk kontrol nonaktif, dan alasannya tertulis di bawah tombol dengan `text-secondary` ("Tempel link atau pilih file video dulu."). Biaya bila salah: gaya nonaktif baru untuk `Button`.
7. (Review Task 15, minor 1, diputuskan controller.) "Buat judul dan tagar" di Bagikan (`SocialKitModal`) dan "Perbaiki otomatis" di Ubah subtitle (`ClipEditModal`) hanya muncul bila mode AI "Pakai API key" (`aiMode === "auto"`), `caps.apiKeys`, dan ada kunci (atau server sendiri). Alasan: spec 4.2 menjadikan API key opsi lanjutan, dan `settingsVisibility` menyembunyikan kunci penyedia di mode AI manual, jadi tombol di mode manual akan memakai kunci yang tidak bisa dilihat pengguna. Di mode manual, Bagikan menjelaskan cara menyalakannya dan Ubah subtitle menawarkan cara salin ke ChatGPT/Gemini. Dikunci tes di `SocialKitModal.test.tsx` dan `ClipEditModal.test.tsx`. Biaya bila salah: satu kondisi per tombol.

## Belum diverifikasi

- Bagian Pengaturan di bawah 16 tombol pertama (YouTube dan Lanjutan) hanya sebagian lewat Tab. Enam layar yang dulu belum dibuka di browser kini sudah (lihat "Putaran perbaikan 1"); `SplashScreen` dan overlay pembaruan lewat harness, bukan lewat aplikasi utuh.
- Data backend di browser adalah tiruan (job, riwayat, kata subtitle); alur penuh dengan video sungguhan tidak dijalankan.
- Pembaca layar (NVDA/VoiceOver) tidak dipakai; label diperiksa lewat atribut dan urutan fokus saja.
- Zoom 200 % dan keyboard layar HP tidak diuji.
- Desktop Tauri tidak bisa dijalankan di mesin ini (tidak ada Rust).
- Uji pemakaian oleh orang awam tetap menunggu pemilik (Task 18).

## Putaran perbaikan 1 (review Task 15)

Tanggal: 2026-11-24, FIX_BASE `7453308`. Temuan review: `.superpowers/sdd/2026-11-20-sp2-ux-for-everyone/task-15-review.md`.

### Browser: enam layar yang belum diperiksa

Edge headless lewat CDP, 360×780, 768×1024, 1280×800, terang dan gelap (6 kombinasi). Skrip memakai ukuran yang sama dengan putaran pertama (overflow, elemen keluar tepi, kontrol di bawah 44 px, huruf di bawah 14 px, error console) dan membuka dialog dengan keyboard (fokus lalu Enter), supaya cincin fokus mengikuti aturan `:focus-visible`. Tangkapan layar: `.superpowers/sdd/2026-11-20-sp2-ux-for-everyone/screens-t15fix/` (gambar dan `report-t15fix.json`, tidak ikut git).

Cara tiap layar dijangkau:
- `LocalGate`: build `npm run build` dilayani `backend.main --web`. Tanpa token di alamat: kartu "Buka lewat Auto Clipper Web". Token ditolak (cek token dijawab 401 tiruan): kartu kunci kedaluwarsa. Server tidak menjawab (permintaan digagalkan): kartu "Jendela Auto Clipper sudah ditutup", lalu "Coba lagi" dengan server kembali membuka Buat klip.
- Dialog cookies: dari kartu error proyek gagal di Riwayat, tombol "Unggah cookies.txt". Status dan hapus cookies dijawab tiruan (file cookies asli di mesin ini tidak disentuh).
- `AuthGate` dan dialog Google Drive: build cloud (`vite build --mode cloud`) dilayani server statis, alamat backend diarahkan ke asal yang sama, semua jawaban backend tiruan (`/api/settings/whisper-models` hanya menerima token yang benar; `/gdrive-browser` dengan folder berisi, folder gagal, dan nama file panjang tanpa spasi).
- `SplashScreen` dan overlay pembaruan: harness Vite (`.superpowers/harness/`, tidak ikut git) yang merender komponen asli dengan CSS dan font aplikasi. Di build web, splash hilang dalam sekejap karena tidak ada yang ditunggu dari jaringan, dan pembaruan hanya ada di desktop (Tauri tidak bisa dijalankan di mesin ini). Harness memakai `UpdaterSection` asli dengan updater tiruan yang berhenti di 40 %, jadi alurnya sama: Periksa pembaruan, pertanyaan "Pasang sekarang", lalu overlay.

| Layar | Hasil (6 kombinasi lebar × tema) |
|---|---|
| `LocalGate` (3 kartu) | 18 halaman: overflow 0, kontrol < 44 px 0, huruf < 14 px 0. Tab: "Coba lagi" bercincin fokus; kartu tanpa token tidak punya tombol (petunjuknya: buka lagi Auto Clipper Web). "Coba lagi" setelah server kembali membuka Buat klip di keenam kombinasi. |
| Dialog cookies | 18 halaman (dialog, konfirmasi hapus, sesudah hapus): 0 masalah ukur. Fokus masuk ke tombol Tutup, Tab berputar di dalam (Ganti file cookies, Hapus cookies, Tutup, Tutup), Escape menutup dan fokus kembali ke "Unggah cookies.txt". Konfirmasi hapus: fokus di Batal. Sesudah hapus: fokus di "Pilih file cookies.txt" (perbaikan minor 5), bukan `<body>`. |
| `AuthGate` | 12 halaman (form, kode salah): 0 masalah ukur. Kolom kode akses fokus otomatis; Tab: kolom, Tampilkan kode akses, tujuh tautan komunitas, semua bercincin fokus. Kode salah lewat Enter: pesan "Kode akses ditolak ..." (`role="alert"`); kode benar membuka aplikasi. Ditemukan dan diperbaiki: Edge menggambar ikon mata kedua di dalam kolom kata sandi, di samping tombol Tampilkan milik aplikasi. `src/index.css` kini menyembunyikan `::-ms-reveal` (tes penjaga di `contrast.test.ts`), dicek ulang di browser. |
| Dialog Google Drive | 18 halaman (akar, subfolder dengan nama panjang, folder gagal): 0 masalah ukur, nama panjang terlipat. Fokus masuk ke Tutup, Tab berputar di dalam, Escape menutup dan fokus kembali ke "Pilih dari Google Drive". Dibuka lagi: langsung di folder terakhir (perbaikan minor 3). Folder gagal: pesan dan "Muat lagi". |
| `SplashScreen` (harness) | 6 halaman: 0 masalah ukur. Tidak ada kontrol; status dibacakan lewat `role="status"`. |
| Overlay pembaruan (harness) | 12 halaman (pertanyaan, overlay): 0 masalah ukur. Pertanyaan: fokus di "Nanti saja". Overlay: tanpa tombol tutup, Escape tidak menutup, fokus tetap di panel dialog (tidak ada kontrol yang bisa dioperasikan), progres memakai `role="progressbar"`. |

Total 84 halaman diukur, 0 overflow, 0 kontrol < 44 px, 0 huruf < 14 px. Pesan console yang muncul hanya yang sengaja dipicu tiruan (401, koneksi ditolak, 500 untuk folder gagal) dan `favicon.ico` 404 di harness. Satu putaran harness 360 gelap terganggu muat ulang server Vite (halaman masuk back-forward cache); diulang sendiri dan lulus.

Catatan: di `AuthGate`, tombol Masuk nonaktif selama kolom kosong, jadi Enter di kolom kosong tidak memunculkan pesan "isi dulu". Sama dengan Ruling 6 (kontrol nonaktif), tidak diubah.

### Perbaikan kode lain di putaran ini

- `Dialog`: `footer` boleh berupa fungsi yang menerima `requestClose`. Tombol Batal di `ClipEditModal`, `RerenderAllDialog`, `AiCorrectDialog`, dan dialog server sendiri (`ProviderSection`) kini lewat penjaga isian yang sama dengan Escape, X, dan klik di luar. Escape yang sudah dipakai kolom di dalam (`defaultPrevented`) tidak lagi menutup dialog; kotak Cari kata di Ubah subtitle memakainya untuk mengosongkan pencarian saja. `focusableIn` tidak diekspor lagi.
- `GDriveBrowserModal`: dibuka lagi di folder terakhir (kembali ke akar bila folder itu sudah tidak ada); Muat lagi mengulang folder yang gagal.
- `ClipEditModal`: pesan gagal dibuat ulang dibedakan menurut sebabnya: aplikasi tidak menjawab (`save_failed`) atau aplikasi menolak permintaan (`save_refused`, alasan di Detail teknis).
- `SocialKitModal`: "Tersalin" diumumkan lewat `role="status"`; kalimat "Salin deskripsi di atas" hanya muncul bila deskripsi memang ditampilkan, selain itu `social.empty_no_text`.
- `CookiesPanel`: setelah hapus, fokus ke tombol unggah (atau kembali ke Hapus cookies bila gagal).
- `TechnicalDetails`: kunci sendiri `common.technical_details`.
- Tes perilaku baru untuk jalur permintaan yang ditulis ulang: `ClipEditModal`, `SocialKitModal`, `ProviderSection`, `TranscriptionSection`, `UpdaterSection` (argumen dan isi permintaan, syarat mode AI, pesan berhasil dan gagal).
