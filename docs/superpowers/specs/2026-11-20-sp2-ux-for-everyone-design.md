# Spec SP2: UI/UX untuk orang awam

Tanggal: 2026-11-20 · Status: disetujui pemilik per bagian ("ikuti saran, yang penting UX-nya jelas"), menunggu review tertulis · Induk: `2026-11-12-enhancement-roadmap.md` · Bergantung: SP1 (`2026-11-18-sp1-single-frontend-web-local-design.md`)

## 1. Masalah

Setelah SP1 ada satu frontend (`src/`) untuk desktop, web lokal, dan cloud (Vercel + Colab), tetapi tampilannya masih tampilan desktop lama:

- Enam menu dengan istilah teknis dan sebagian berbahasa Inggris: Workspace, Manual AI Editor, Manual Downloader, History, Settings, Help / FAQ. Pengguna awam harus menebak harus mulai dari mana.
- Formulir utama (`GenerateForm`, 515 baris) menampilkan banyak pilihan sekaligus.
- Alur AI manual (salin prompt, tempel jawaban) ada di halaman terpisah dari alur utama, padahal di cloud itu satu-satunya jalur.
- Sidebar 240 px tidak nyaman di HP, padahal pengguna Colab membuka aplikasi dari HP (temuan SP1).
- Layar proses (`BusyOverlay`) menampilkan pesan berdasarkan waktu yang tidak jujur ("hampir siap", "sabar yaa", "diproses di GPU Cloud") dan memutar pesan tahap palsu (diminta pemilik 2026-11-18, `tasks/roadmap-todo.md` SP2).
- Hasil pemeriksaan awal SP0 (`GET /api/preflight`) belum ditampilkan di frontend mana pun.
- Gambar latar kanvas di web lokal dan cloud memakai `blob:` yang tidak bisa dibaca backend (bug lama, temuan SP1).
- `platform().pickVideo()` dibuat di SP1 tetapi belum dipakai (temuan review akhir SP1, M6).

## 2. Sasaran dan non-sasaran

Sasaran (ukuran keberhasilan):

- Pengguna awam yang belum pernah memakai aplikasi selesai dari link video sampai mengunduh klip **tanpa panduan**, di HP lewat Colab dan di desktop.
- Layar proses selalu menampilkan tahap, perangkat, dan progres yang sebenarnya.
- Semua teks yang terlihat lolos aturan teks di bagian 4.6.

Non-sasaran:

- Fitur kreator baru, termasuk "AI ulang" versi manual (SP4).
- Ukuran installer, startup, paket GPU (SP3).
- Perubahan pipeline backend selain data tahap yang sedang berjalan (4.4) dan unggah gambar latar kanvas (4.7).

## 3. Keputusan pemilik (2026-11-20)

| Pertanyaan | Keputusan |
|---|---|
| Patokan desain | HP dulu, lalu melebar ke layar besar. Satu tata letak responsif untuk semua platform. |
| Jalur AI utama | AI manual dipandu langkah (tanpa API key). API key tetap ada sebagai opsi lanjutan. |
| Gaya visual | Bersih dan tenang: latar netral, satu warna aksen, huruf jelas, sedikit dekorasi. |
| Struktur | Alur bertahap di layar utama; tiga menu: Buat klip, Riwayat, Pengaturan. |
| Diskusi | Lewat chat, tanpa mockup di browser. |
| Sisanya | Ikuti rekomendasi, dengan patokan UX harus jelas untuk orang awam. |

## 4. Desain

### 4.1 Navigasi dan kerangka

- Tiga tujuan: **Buat klip** (`/`), **Riwayat** (`/riwayat`, juga `/riwayat/:id` untuk satu proyek), **Pengaturan** (`/pengaturan`). Router tetap `HashRouter` (SP1).
- HP (lebar < 768 px): navigasi di bawah layar, tiga ikon dengan label teks. Layar besar: sidebar ramping dengan tiga item yang sama. Status koneksi backend tampil sebagai titik kecil berlabel di header, bukan di sidebar.
- Rute lama dialihkan: `/manual-ai` dan `/downloader` → bagian yang sesuai (lihat 4.2 dan 4.5), `/history` → `/riwayat`, `/settings` → `/pengaturan`, `/help` → `/pengaturan#bantuan`. Tautan lama di dokumen tetap berfungsi.
- Halaman pembuka desktop (`LandingPage`) diganti: aplikasi langsung membuka Buat klip.

### 4.2 Alur Buat klip (4 langkah)

Satu layar dengan penanda langkah di atas: **1 Video → 2 Siapkan → 3 Pilih momen → 4 Klip**. Langkah aktif terlihat jelas, langkah selesai bercentang. Urutan mengikuti urutan backend sebenarnya pada mode AI manual (unduh dan subtitle, menunggu jawaban AI, render).

1. **Video**
   - Kotak besar "Tempel link YouTube, TikTok, atau Instagram". Link diperiksa langsung; link yang tidak didukung diberi pesan di bawah kotak.
   - Tombol "Pilih file video" lewat `platform().pickVideo()`; di cloud juga "Pilih dari Google Drive".
   - Satu pilihan yang selalu terlihat: **Bentuk klip**: Vertikal untuk TikTok/Reels/Shorts (bawaan), Persegi, Lebar.
   - "Atur tampilan klip" (tertutup bawaan) berisi pilihan lanjutan: gaya subtitle, kanvas, hook pembuka, B-roll, kualitas unduhan, jumlah klip, mode pelacakan wajah. Nilai bawaan yang baik; pilihan terakhir diingat untuk video berikutnya.
   - Peringatan awal (4.4) tampil di atas tombol.
   - Tombol **Mulai**.
2. **Siapkan**: layar progres (4.3) untuk unduh, ambil suara, dan buat subtitle.
3. **Pilih momen** (AI manual)
   - ① **Salin perintah**, dengan keterangan "Teks ini berisi transkrip video dan petunjuk untuk AI."
   - ② **Buka ChatGPT** dan **Buka Gemini** (tab baru), dengan keterangan "Tempel perintah tadi, lalu kirim."
   - ③ Kotak "Tempel jawaban AI di sini" dan tombol **Buat klip**. Jawaban divalidasi sebelum dikirim; pesan salah format menjelaskan apa yang kurang (contoh: "Jawaban belum lengkap. Salin seluruh jawaban AI, termasuk tanda kurung di awal dan akhir.").
   - Bila mode API key aktif di Pengaturan, langkah ini berjalan otomatis dan tampil sebagai bagian dari progres.
   - Proyek yang menunggu jawaban tersimpan; pengguna bisa kembali lewat Riwayat ("Tempel jawaban AI").
4. **Klip**: layar progres untuk pelacakan wajah dan render, lalu hasil (4.5).

### 4.3 Layar progres (menggantikan `BusyOverlay`)

- Daftar tahap dengan nama yang sama seperti "Detail waktu" (`timing.stage_*`): Mengunduh video, Mengambil suara, Membuat subtitle, Memilih momen terbaik (hanya mode API key), Melacak wajah, Merender klip, Menyimpan. Tahap selesai bercentang dengan lamanya; tahap berjalan menampilkan waktu berjalan.
- Hanya progres nyata: persen unduhan bila backend mengirimnya, "Merender klip 3 dari 10". Tidak ada pesan berdasarkan waktu dan tidak ada pesan tahap yang berputar.
- Perangkat yang benar-benar dipakai: bila subtitle atau render memakai prosesor, catatan "Subtitle dibuat dengan prosesor, bukan GPU. Untuk video panjang bisa jauh lebih lama."
- Pesan menutup halaman per platform: desktop "Jangan tutup aplikasi sampai selesai."; web lokal "Jangan tutup jendela Auto Clipper Web."; cloud "Halaman ini boleh ditutup. Proses tetap jalan selama Colab menyala; lihat hasilnya di Riwayat."
- Antrean: "Menunggu giliran. Urutan ke-N." (data `queue_position` dari SP0).
- Tombol **Batalkan** dengan konfirmasi.
- Layar progres adalah bagian dari halaman (bukan overlay penuh) sehingga navigasi tetap bisa dipakai.

### 4.4 Data tahap berjalan dan peringatan awal

- Backend: status job (`GET /jobs/{id}`) ditambah objek `current` = `{stage, started_at, device?, clip?, clips_total?, percent?}`. Diisi saat tahap dimulai oleh `stage_timer` (SP0), dikosongkan saat tahap selesai; `device` mengikuti nilai yang sudah dicatat (`whisper_device`, `encoder`, `tracking_engine_used`); `percent` hanya untuk unduhan bila yt-dlp melaporkan. Tidak ada perubahan pada `timings`.
- Frontend memetakan `stage` ke teks lewat kunci `timing.stage_*` yang sudah ada.
- Peringatan awal: layar Buat klip memanggil `GET /api/preflight` saat dibuka dan saat koneksi pulih. Hasil `warn` tampil sebagai catatan kecil; `block` tampil sebagai kartu error dan tombol Mulai nonaktif sampai pemeriksaan ulang lolos (tombol "Periksa lagi").

### 4.5 Hasil, Riwayat, Pengaturan

Hasil:
- Klip satu kolom di HP, grid di layar besar. Per klip: pemutar (link bertanda tangan SP1), judul/hook dari AI, durasi, tombol **Unduh** dan **Bagikan** (Social Kit: caption dan hashtag, salin sekali ketuk). Menu "⋯": Ubah subtitle, Render ulang, Buka folder (bila `caps.openFolder`).
- Tombol **Unduh semua** di atas daftar.
- "Detail waktu" tetap tersedia, tertutup bawaan.

Riwayat:
- Daftar proyek: judul video, tanggal, status dengan kata yang mudah dipahami (Selesai, Gagal, Menunggu jawaban AI, Sedang diproses, Menunggu giliran), jumlah klip.
- Satu tombol utama sesuai status: **Lihat klip**, **Tempel jawaban AI**, **Lanjutkan**, **Coba lagi**. Menu "⋯": Render ulang semua, Hapus (dengan konfirmasi).
- Proyek gagal menampilkan kartu error-nya.

Pengaturan (satu halaman, empat bagian):
- **Umum**: bahasa, tema.
- **YouTube**: panel cookies (SP0).
- **Lanjutan**: AI otomatis dengan API key (hanya bila `caps.apiKeys`), folder hasil (bila `caps.localFilePicker`), model subtitle, mode pelacakan wajah, pengunduh video tanpa klip (isi `ManualDownloaderPage` lama).
- **Bantuan** (`#bantuan`): langkah singkat, FAQ, versi, updater (bila `caps.updater`).

### 4.6 Aturan teks dan visual

Teks:
- Bahasa Indonesia sehari-hari plus bahasa Inggris (`src/locales/{id,en}.json`, aturan F di AGENTS.md).
- Kalimat pendek; tombol berupa kata kerja ("Tempel link", "Unduh semua").
- Tanpa istilah teknis di layar utama (contoh terlarang: transkripsi, render, encoder, JSON, sidecar, token); istilah teknis hanya di "Detail teknis".
- Tanpa emoji dekoratif, tanpa basa-basi, tanpa klaim yang tidak bisa dibuktikan.
- Setiap pesan masalah menjawab apa, kenapa, harus apa.
- Seluruh teks baru dan yang diubah diaudit dengan skill `antislop` dan `antislop-copywriting`.

Visual:
- Latar netral, satu warna aksen, mode terang dan gelap.
- Ukuran huruf minimal 16 px untuk teks isi di HP; area sentuh minimal 44 × 44 px.
- Kontras memenuhi WCAG AA (diperiksa dengan alat kontras skill `antislop-human`); semua fungsi bisa dipakai dengan keyboard dan fokus terlihat.
- Tanpa gradien dekoratif, efek kilau, atau kartu bertumpuk; ikon hanya bila memperjelas.
- Audit tampilan dengan skill `antislop-ui` dan `antislop-layoutmobile`.

### 4.7 Perbaikan yang terbawa

- Gambar latar kanvas di web lokal dan cloud: gambar diunggah ke backend (endpoint unggah yang sudah ada atau varian untuk gambar, tetap lewat `path_guard`) lalu path backend-nya dipakai, menggantikan `blob:`.
- `pickVideo()` dipakai di langkah 1.
- Item yang diparkir sebelum PR akhir (dari `tasks/sp1-ledger.md`): cek port bebas web lokal juga menguji `connect` ke 127.0.0.1; `$\rightarrow$` rusak di tutorial Kendala 9; komentar tes yang menyesatkan.

## 5. Penanganan error

- Semua kegagalan memakai `ErrorCard` (SP0) dengan aksi per platform (SP1), tampil di langkah tempat masalah terjadi.
- Validasi di sisi frontend (link tidak didukung, jawaban AI salah format) tampil di bawah kolom yang bersangkutan, bukan sebagai kartu.
- Backend tidak terhubung: banner di atas layar dengan tombol "Hubungkan ulang" (desktop) atau penjelasan per platform (pesan SP1).

## 6. Pengujian

- Vitest: logika alur (langkah aktif dari status job, transisi, proyek menunggu jawaban), validasi jawaban AI (contoh benar, terpotong, bukan JSON, kosong), pemetaan `current.stage` ke teks dan catatan perangkat, status Riwayat ke tombol utama, pengalihan rute lama, penyaringan bagian Pengaturan berdasarkan `caps`.
- pytest: objek `current` di status job (terisi saat tahap mulai, kosong saat selesai, `clip`/`clips_total` saat render, `device` saat subtitle), tanpa mengubah `timings`; unggah gambar latar kanvas lewat `path_guard`.
- Pemeriksaan otomatis teks: tes yang memastikan setiap kunci baru ada di id dan en (sudah ada dari SP1) dan daftar kata terlarang (4.6) tidak muncul di teks layar utama.
- Audit antislop (teks, UI, tata letak HP, aksesibilitas/kontras) sebagai langkah kerja dengan hasil tercatat.
- Uji pemakaian: satu orang awam, dari link sampai mengunduh klip tanpa panduan, di HP lewat Colab dan di desktop/web lokal. Dicatat di log kerja: berhasil/tidak, di langkah mana ragu.

## 7. Urutan kerja

1. Backend: objek `current` di status job; unggah gambar latar kanvas.
2. Kerangka: navigasi tiga menu (bawah di HP, sidebar ramping di layar besar), rute baru dan pengalihan, gaya visual dasar (token warna, tipografi, mode terang/gelap).
3. Alur Buat klip langkah 1 (Video, pilihan lanjutan, peringatan awal).
4. Layar progres (langkah 2 dan 4) menggantikan `BusyOverlay`.
5. Langkah 3 Pilih momen (AI manual dipandu, validasi jawaban; mode API key otomatis).
6. Hasil dan Riwayat.
7. Pengaturan (empat bagian) dan pemindahan pengunduh manual serta bantuan.
8. Audit teks dan UI antislop, aksesibilitas, item yang diparkir; dokumen pengguna (`docs/panduan-penggunaan-awam.md`, tutorial cloud), CHANGELOG, ADR bila ada perubahan arsitektur.

## 8. Risiko

- Mengubah banyak layar sekaligus bisa merusak alur yang sudah jalan (Rerender All, Resume, AI manual). Tes Vitest per alur dan daftar cek manual per platform menjaga ini.
- Data `current` bergantung pada `stage_timer` yang dipanggil di banyak titik pipeline; tahap yang lupa dilaporkan akan terlihat sebagai tahap kosong. Tes backend memeriksa setiap tahap utama.
- Desain HP dulu bisa terasa terlalu renggang di desktop; grid hasil dan sidebar ramping mengatasinya, dicek di uji pemakaian desktop.
- Uji pemakaian dengan orang awam membutuhkan pemilik.

## 9. Pertanyaan terbuka

- Warna aksen: usul satu warna biru netral yang memenuhi kontras AA di mode terang dan gelap; pemilik boleh mengganti di langkah 2.
