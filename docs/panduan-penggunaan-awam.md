# Panduan Santai Menggunakan Auto Clipper Cloud (Untuk Pemula)

Selamat datang! Panduan ini dibuat khusus agar siapa saja bisa menjalankan sistem pembuat klip video otomatis (Auto Clipper) tanpa pusing dengan istilah teknis.

Mari kita gunakan perumpamaan sederhana:
- **Google Colab** = **"Mesin Pabrik"**. Ini adalah komputer milik Google yang dipinjamkan gratis untuk kita. Tugasnya memotong video dan bikin subtitle.
- **Vercel (Web App)** = **"Remote Control"**. Ini adalah website yang Anda buka di HP untuk menyuruh Mesin Pabrik bekerja.
- **Kabel Penghubung** = Agar Remote Control bisa terhubung ke Mesin Pabrik, kita butuh jembatan. Ada 2 pilihan jembatan:
  - **Ngrok:** Gratis dan sangat gampang (cocok untuk pemula).
  - **Cloudflare:** Gratis juga, tapi khusus buat Anda yang sudah punya *domain web* sendiri (misal: `namaanda.com`).

---

## Pemanasan: Bikin Akun Gratis
Sebelum mulai, pastikan Anda sudah punya akun-akun ini (semuanya gratis):
1. **Akun Google**: Untuk buka Google Colab & nyimpen hasil video di Google Drive.
2. **Akun GitHub** ([github.com](https://github.com)): Untuk menyimpan kode program.
3. **Akun Vercel** ([vercel.com](https://vercel.com)): Untuk menaruh Remote Control supaya bisa dibuka di HP.
4. **Pilih Salah Satu Kabel Penghubung:**
   - **Bikin Akun Ngrok** ([ngrok.com](https://ngrok.com)) kalau Anda **TIDAK** punya domain. Simpan teks panjang (*Authtoken*) dari menu *Your Authtoken*.
   - **Bikin Akun Cloudflare** kalau Anda **PUNYA** domain sendiri.
5. **(Disarankan) Akun Google cadangan**: akun kedua yang bukan akun utama Anda. Akun ini dipakai kalau YouTube meminta verifikasi (lihat Tanya Jawab nomor 7).

---

## Langkah 1: Menyalakan "Mesin Pabrik" (Google Colab)

Langkah ini dilakukan di laptop/komputer.

1. Buka [Google Colab](https://colab.research.google.com/).
2. Buka *file* bernama `Auto_Clipper_Colab.ipynb` dari repository kode yang Anda punya.
3. **Sangat Penting:** Klik menu **Runtime** (di atas) -> **Change runtime type**. Pastikan *Hardware accelerator* terpilih **T4 GPU**. Tanpa GPU, pembuatan subtitle berjalan jauh lebih lambat.
4. Klik tombol **Play (▶️)** di sebelah kiri kotak-kotak kodenya secara berurutan:
   - **Kotak 1:** Untuk menyambungkan ke Google Drive (klik izinkan saat muncul peringatan). Jalankan kotak ini sebelum Kotak 4. Kalau terlewat, server tetap menyala tetapi tidak mau memproses video.
   - **Kotak 2 & 3:** Untuk menginstal mesin dan peralatannya. Tunggu sampai selesai (ada centang hijau ✅).
     - Kotak 2 juga memasang **Deno**, program kecil yang membantu pengunduh video menjawab pemeriksaan dari YouTube. Kalau di bawah kotak muncul tulisan `PERHATIAN: Deno tidak berhasil dipasang`, klik Play sekali lagi. Kalau tetap gagal, lanjutkan saja: aplikasi tetap jalan, hanya saja video YouTube lebih sering gagal diunduh.

### Cara Menghubungkan (Pilih Salah Satu):

**Jalur A: Menggunakan Ngrok (Tanpa Domain)**
- Pergi ke **Kotak 4 (Bagian Ngrok)**.
- Masukkan *Authtoken* dari akun Ngrok Anda, dan bikin sembarang *Password* rahasia (contoh: `rahasia123`).
- Klik **Play (▶️)**. Tunggu sampai muncul tulisan `PUBLIC BACKEND URL ANDA: https://abcd-123.ngrok-free.app`. **Salin URL tersebut.**

**Jalur B: Menggunakan Cloudflare (Punya Domain Sendiri)**
- Masuk ke *dashboard* Cloudflare Anda -> menu **Zero Trust** -> **Networks** -> **Tunnels** -> **Create a tunnel** (pilih Cloudflared).
- Salin token panjangnya (kata-kata setelah `--token`).
- Masuk ke tab **Public Hostname**, lalu tambahkan:
  - **Subdomain:** misal `mesin-clipper`
  - **Domain:** pilih domain Anda (misal `namaanda.com`).
  - **URL Tujuan:** Pilih `HTTP` dan isikan angka wajib ini: `127.0.0.1:8000` *(jangan ketik 'localhost')*.
- Di Google Colab, pergi ke **Kotak 4 (Bagian Cloudflare)**. Masukkan token panjang tadi, dan buat *Password* rahasia. Klik **Play (▶️)**.
- **Selesai!** URL Anda sekarang adalah `https://mesin-clipper.namaanda.com`. **Salin URL tersebut.**

### Baca "Pemeriksaan Awal" di Kotak 4

Sebelum server menyala, Kotak 4 menuliskan **PEMERIKSAAN AWAL AUTO CLIPPER**. Setiap baris diawali salah satu tanda ini:

- **`[OK]`**: aman.
- **`[PERHATIAN]`**: server tetap jalan, tetapi ada yang lebih lambat atau berisiko. Pesan di bawahnya menjelaskan apa yang perlu dilakukan.
- **`[MASALAH]`**: harus diperbaiki dulu. Server tetap menyala, tetapi video tidak akan diproses sebelum masalahnya beres.

Yang paling sering muncul:

| Tulisan | Artinya | Yang perlu dilakukan |
|---|---|---|
| GPU tidak aktif | Mesin tidak mendapat GPU, subtitle dibuat jauh lebih lambat. | Ganti runtime ke **T4 GPU** (Langkah 1 nomor 3), lalu jalankan ulang semua kotak. |
| Klip dibuat dengan prosesor | Klip dibuat dengan prosesor biasa, bukan kartu grafis. | Tidak perlu apa-apa. Lebih lambat, tetapi klip tetap jadi. |
| Google Drive belum terhubung (`[MASALAH]`) | Kotak 4 dijalankan sebelum Kotak 1. Tanpa Drive klip akan hilang saat sesi selesai, jadi video tidak diproses sama sekali. | Hentikan Kotak 4 (tombol stop di kotaknya), jalankan Kotak 1, lalu jalankan lagi Kotak 4. Kalau Kotak 1 gagal karena foldernya sudah berisi file, buka menu **Runtime** -> **Disconnect and delete runtime**, lalu jalankan semua kotak dari awal. |
| Pembantu unduhan YouTube belum terpasang | Deno tidak ada, jadi video YouTube lebih sering gagal diunduh. | Jalankan Kotak 2 lagi, lalu jalankan ulang Kotak 4. |
| Pengunduh video perlu diperbarui | Pengunduh video sudah lama, makin sering gagal. | Jalankan Kotak 3 lagi, lalu jalankan ulang Kotak 4. |

Biarkan tab Google Colab ini tetap terbuka!

---

## Langkah 2: Menyiapkan "Remote Control" (Vercel)

Langkah ini juga dilakukan sekali saja.

1. Buka [Vercel](https://vercel.com) dan masuk.
2. Klik **Add New...** -> **Project**. Pilih repository Auto Clipper dari GitHub Anda.
3. Pada halaman pengaturan, biarkan **Root Directory** kosong (folder utama). Pengaturan lain terbaca otomatis dari file `vercel.json`. Setelah proyek dibuat, buka **Settings → Build and Deployment** dan pastikan **Node.js Version** `22.x`.
   - Sudah punya proyek Vercel lama yang Root Directory-nya `web`? Kosongkan Root Directory di **Settings → Build and Deployment**, simpan, lalu **Redeploy**.
4. Buka menu **Environment Variables**, lalu tambahkan:
   - **Name:** `VITE_API_URL`
   - **Value:** *Paste* link Ngrok / Cloudflare yang Anda *copy* di Langkah 1 tadi.
5. Klik **Deploy** dan tunggu 1-2 menit.
6. Anda akan mendapatkan link website gratis dari Vercel (contoh: `https://auto-clipper-web.vercel.app`). Ini adalah Remote Control Anda!

---

## Langkah 3: Membuat Klip dari HP

Setelah Mesin Pabrik dan Remote Control siap, sehari-hari Anda cukup memakai HP.

### Masuk

1. Buka link Remote Control (link Vercel tadi) di browser HP.
2. Isi kotak **Kode akses** dengan *password* rahasia yang Anda buat di Kotak 4 (contoh: `rahasia123`), lalu tekan **Masuk**. Kode ini hanya disimpan di browser HP itu.

Aplikasi langsung membuka **Buat klip**. Di bawah layar ada tiga menu: **Buat klip**, **Riwayat**, dan **Pengaturan**. Di layar yang lebar (tablet atau laptop), menu ini ada di sisi kiri. Di bagian atas ada tulisan kecil **Terhubung**. Kalau tulisannya **Terputus**, lihat Tanya Jawab nomor 1.

Di atas layar Buat klip ada empat langkah: **1 Video → 2 Siapkan → 3 Pilih momen → 4 Klip**. Langkah yang sudah lewat diberi centang.

### 1 Video

1. Tempel link video di kotak **Tempel link YouTube, TikTok, atau Instagram**. Kalau linknya tidak bisa dipakai, pesannya muncul di bawah kotak.
   - Videonya ada di Google Drive? Tekan **Pilih dari Google Drive**.
   - Videonya ada di HP? Tekan **Pilih file video**. Video ini dikirim ke Mesin Pabrik dan hilang saat sesi Colab berakhir (lihat "Di Mana Video Anda Disimpan?").
2. Pilih **Bentuk klip**: **Vertikal untuk TikTok/Reels/Shorts** (bawaan), **Persegi**, atau **Lebar**.
3. Mau mengatur lebih jauh? Ketuk **Atur tampilan klip**. Di sana ada nama proyek, subtitle, posisi gambar, hook pembuka, kualitas unduhan, dan jumlah klip. Semuanya boleh dibiarkan. Pilihan Anda diingat untuk video berikutnya.
   - Nama proyek boleh kosong. Aplikasi membuatnya dari judul video dan waktu sekarang.
4. Kalau ada **Catatan sebelum mulai**, baca dulu. Catatan biasa tidak menghalangi. Kalau muncul kotak bergaris merah, tombol **Mulai** tidak bisa ditekan. Ikuti petunjuk di kotak itu, lalu tekan **Periksa lagi**.
5. Tekan **Mulai**.

### 2 Siapkan

Layar menampilkan tahap yang sedang dikerjakan Mesin Pabrik: **Mengunduh video** (untuk video dari Google Drive atau dari HP: **Menyiapkan video**), **Mengambil suara dari video**, dan **Membuat subtitle**.

- Tahap yang selesai diberi centang dan lamanya.
- Tahap yang sedang berjalan menunjukkan sudah berapa lama berjalan. Saat mengunduh, persennya juga tampil.
- Kalau muncul "Subtitle dibuat dengan prosesor, bukan GPU", Colab tidak memakai GPU. Video panjang bisa jauh lebih lama. Lain kali, pastikan runtime **T4 GPU** (Langkah 1 nomor 3).

Halaman ini boleh ditutup. Proses tetap jalan selama Colab menyala, dan hasilnya bisa dilihat di **Riwayat**.

Mau berhenti? Tekan **Batalkan**, lalu **Ya, batalkan**. Proyeknya tetap ada di Riwayat.

### 3 Pilih momen

Setelah subtitle jadi, layar menampilkan **Pilih momen terbaik dengan bantuan AI**. Anda memakai ChatGPT atau Gemini biasa, tanpa API key.

1. Tekan **Salin perintah**. Teks ini berisi isi ucapan video dan petunjuk untuk AI.
2. Tekan **Buka ChatGPT** atau **Buka Gemini**. Tempel perintah tadi di kolom chat, lalu kirim.
3. Tunggu sampai AI selesai menjawab. Salin seluruh jawabannya (tombol salin di bawah jawaban paling aman).
4. Kembali ke Auto Clipper. Tempel di kotak **Tempel jawaban AI di sini**, lalu tekan **Buat klip**.

Kalau ada yang kurang, pesannya muncul di bawah kotak. Contoh: "Jawaban belum lengkap. Salin seluruh jawaban AI, termasuk tanda kurung di awal dan akhir." Salin ulang jawabannya, lalu tekan **Buat klip** lagi.

Kalau **Salin perintah** tidak berhasil, tekan lama teks perintah di layar, pilih semua, lalu salin.

Belum sempat ke ChatGPT? Tinggalkan saja. Proyek tersimpan di **Riwayat** dengan status **Menunggu jawaban AI**. Nanti buka Riwayat, tekan **Tempel jawaban AI**, dan langkah ini muncul lagi.

### 4 Klip

Layar progres muncul lagi: **Melacak wajah** (hanya bila posisi gambar **Ikuti wajah**), **Membuat klip** (misalnya "3 dari 10"), lalu **Menyimpan ke folder penyimpanan**. Klip yang sudah jadi langsung tampil di bawahnya.

Setelah semua selesai:

- Putar klip langsung di layar.
- Tekan **Unduh** di bawah klip untuk menyimpannya ke HP.
- Ada beberapa klip? Tekan **Unduh semua** di atas daftar. Browser mengunduh klip satu per satu. Kalau browser meminta izin mengunduh beberapa file, izinkan.
- Tekan **Bagikan** untuk melihat pilihan judul, deskripsi, dan tagar. Tekan **Salin** di bagian yang mau dipakai.
- Tombol titik tiga di setiap klip berisi **Ubah subtitle atau tampilan**: perbaiki kata yang salah atau ganti tampilan, lalu tekan **Buat ulang klip ini**.
- Tekan **Buat klip dari video lain** untuk mulai lagi dari langkah 1.

### Riwayat

Menu **Riwayat** berisi semua proyek: judul, tanggal, status, dan jumlah klip. Setiap proyek punya satu tombol utama:

| Status | Tombol |
|---|---|
| Selesai | **Lihat klip** |
| Menunggu jawaban AI | **Tempel jawaban AI** |
| Sedang diproses, atau Menunggu giliran | **Lihat progres** |
| Gagal | Kotak bergaris merah dengan tombol perbaikan, misalnya **Lanjutkan** |
| Dibatalkan | **Coba lagi** |

Tombol titik tiga di setiap proyek berisi **Buat ulang semua klip** (untuk mengganti tampilan semua klip sekaligus) dan **Hapus**.

### Pengaturan

Menu **Pengaturan** punya empat bagian:

- **Umum**: tema tampilan dan bahasa.
- **YouTube**: unggah atau hapus file cookies (lihat Tanya Jawab nomor 7).
- **Lanjutan**: cara mengikuti wajah, kualitas unduhan, model subtitle, dan **Unduh video tanpa membuat klip** (mengunduh seluruh video dari link, hasilnya muncul di Riwayat).
- **Bantuan**: langkah singkat, pertanyaan umum, versi aplikasi, dan **Detail teknis** (catatan kerja aplikasi untuk dikirim ke pengembang).

### Tulisan "Menunggu giliran"

Mesin Pabrik hanya mengerjakan **satu video berat dalam satu waktu**, supaya memorinya tidak habis. Kalau Anda memulai video kedua saat video pertama masih diproses, layar progres menulis **"Menunggu giliran. Urutan ke-2."** dan di Riwayat statusnya **Menunggu giliran**.

Video Anda sudah tercatat dan dikerjakan otomatis begitu video sebelumnya selesai. Tidak perlu menekan apa-apa. Untuk melihat posisinya, buka proyek itu di Riwayat lalu tekan **Lihat progres**.

### "Detail waktu": berapa lama tiap tahap

Setelah video selesai, di bawah daftar klip ada tulisan **Detail waktu**. Ketuk untuk membukanya. Isinya:
- Lama tiap tahap (mengunduh video, membuat subtitle, melacak wajah, membuat klip, menyimpan ke folder penyimpanan) beserta totalnya.
- **Yang mengerjakan**: apakah subtitle dan pembuatan klip memakai **GPU (cepat)** atau **prosesor biasa, tanpa GPU (lebih lambat)**.

Detail waktu juga ada di halaman setiap proyek di **Riwayat**.

### Kalau proses gagal: kotak bergaris merah dan "Detail teknis"

Kalau ada yang gagal, muncul kotak bergaris merah berisi judul masalah, penjelasan singkat, dan tombol untuk memperbaikinya (misalnya **Lanjutkan**, **Unggah cookies.txt**, atau **Pilih video dari Google Drive**).

Di bagian bawah kotak itu ada tulisan **Detail teknis**. Ketuk untuk membukanya, lalu tekan **Salin**. Teks itu tidak perlu Anda pahami: kirimkan saja ke pengembang kalau masalahnya tidak hilang.

---

## Di Mana Video Anda Disimpan?

- **Selama proses**, Mesin Pabrik bekerja di "meja kerja" sementara milik Colab (folder `/content/work`). Meja ini cepat, tetapi **dibersihkan setiap kali sesi Colab berakhir**.
- **Setiap klip yang selesai langsung disalin** ke Google Drive Anda, di folder `AutoClipperData`. Riwayat proyek (`history.db`) juga ikut disalin ke sana secara berkala.
- **Video asli (sumber) tidak disalin ke Drive**, karena ukurannya besar.

### Kalau sesi Colab mati (tab tertutup, terputus, atau kehabisan waktu)

- **Klip yang sudah jadi dan riwayat proyek aman** di Google Drive. Setelah Kotak 1-4 dijalankan lagi, semuanya muncul kembali di menu **Riwayat**.
- **Melanjutkan proyek dari link YouTube**: video aslinya diunduh ulang secara otomatis. Ini butuh waktu tambahan, dan bisa saja YouTube meminta verifikasi lagi.
- **Melanjutkan proyek dari video Google Drive**: video disalin ulang dari Drive Anda, asalkan file itu belum dihapus atau dipindah.
- **Video yang diunggah langsung ke mesin (bukan dipilih dari Drive)** ikut hilang bersama meja kerja. Kalau muncul pesan **"File video yang diunggah sudah tidak ada"**, unggah videonya sekali lagi sebagai proyek baru. Klip yang sudah jadi tetap aman.
- Klip yang sedang dirender tepat saat sesi mati belum tersimpan. Tekan **Lanjutkan** pada proyek itu: klip yang sudah jadi tidak dibuat ulang.

---

## Solusi Masalah Umum (Tanya Jawab Lengkap)

**1. Kenapa loading di HP muter-muter terus dan tidak ada reaksi?**
**J:** Kemungkinan Mesin Pabrik (Google Colab) tertidur karena lama tidak dipakai. Buka lagi Google Colab di laptop, klik *Reconnect*, lalu jalankan lagi Kotak 1 sampai Kotak 4. Baca bagian "Kalau sesi Colab mati" di atas untuk tahu apa yang tetap aman.

**2. Muncul "Kode akses ditolak" atau "Kode akses tidak berlaku lagi" di HP?**
**J:** Kode yang Anda ketik tidak sama dengan *password* rahasia di Kotak 4, atau server Colab baru dinyalakan ulang dengan *password* lain. Salin lagi *password* dari Kotak 4, tempel di kotak **Kode akses**, lalu tekan **Masuk**.

**3. Muncul "Auto Clipper tidak tersambung" atau tulisan Terputus?**
**J:** Ini berarti HP gagal menyambung ke Mesin. Setelah langkah di bawah, tekan **Hubungkan ulang**.
- Pastikan tab Google Colab di laptop masih nyala dan berjalan (ikon Play-nya berputar).
- Kalau pakai Ngrok, kadang alamat link-nya berganti. Anda mungkin perlu mengambil link Ngrok baru di Colab dan memperbaruinya di pengaturan *Environment Variable* Vercel.

**4. Error saat pakai Cloudflare ("connection refused [::1]")?**
**J:** Saat mengatur *Public Hostname* di Cloudflare, bagian **URL** *wajib* diisi dengan angka `127.0.0.1:8000`. Jika Anda mengisi tulisan `localhost:8000`, koneksinya akan nyangkut dan error.

**5. Proses memotong video tiba-tiba mati / muncul "Memori perangkat habis"?**
**J:** Kalau videonya sangat panjang (lebih dari 1 jam), memori mesin Google Colab bisa habis. Buka **Pengaturan**, bagian **Lanjutan**: pilih model subtitle **Small** dan **Cara mengikuti wajah** **Standar**. Setelah itu buka **Riwayat** dan tekan **Lanjutkan** pada proyek itu. Bagian yang sudah selesai tidak diulang.

**6. Google Drive saya kepenuhan, apa yang harus dihapus?**
**J:** Buka Google Drive, masuk ke folder `AutoClipperData` -> `projects`. Isinya klip dan subtitle tiap proyek. Anda boleh menghapus folder proyek lama yang klipnya sudah di-download ke HP. **Sangat Penting:** Jangan pernah menghapus file `history.db`! File ini adalah buku catatan riwayat video Anda di HP. Setelah menghapus, kosongkan juga *Sampah (Trash)* di Google Drive.

**7. Muncul "YouTube meminta verifikasi" (dulu muncul sebagai Error 403)?**
**J:** YouTube sering curiga pada permintaan dari server Google Colab, lalu meminta bukti login. Ada dua jalan keluar.

*Cara 1: Unggah file cookies.txt.* File ini berisi bukti login dari browser Anda. Ambil dari komputer, bukan HP:
1. Di browser komputer, pasang ekstensi "Get cookies.txt LOCALLY".
2. Buka youtube.com, lalu login dengan **akun cadangan**.
3. Di tab YouTube itu, klik ikon ekstensi tadi, pilih Export, lalu unggah file hasilnya.

Unggah lewat tombol **Unggah cookies.txt** di kotak bergaris merah, atau kapan saja lewat menu **Pengaturan**, bagian **YouTube**, tombol **Pilih file cookies.txt**. Kalau Anda mengunggah dari kotak bergaris merah, setelah file diterima tekan **Coba lagi sekarang**.

> ⚠️ **Pakai akun cadangan, bukan akun utama.** YouTube bisa membatasi akun yang cookies-nya dipakai untuk mengunduh. Jangan pernah memakai akun Google utama Anda.

Yang perlu diketahui:
- File cookies tersimpan di folder `AutoClipperData` di Google Drive Anda, jadi masih ada di sesi Colab berikutnya. Isinya hanya dipakai oleh pengunduh video. Untuk menghapusnya, buka **Pengaturan**, bagian **YouTube**, lalu tekan **Hapus cookies**.
- Cookies punya masa berlaku. Kalau muncul "Cookies YouTube sudah kedaluwarsa", login lagi dengan akun cadangan, ekspor ulang, lalu unggah file baru.
- Kalau muncul "File ini bukan dari akun yang sedang login", Anda mengekspor saat belum login. Login dulu, baru ekspor.

*Cara 2: Pakai file videonya langsung.* Unduh videonya sendiri, simpan ke Google Drive Anda, lalu tekan **Pilih video dari Google Drive** di kotak bergaris merah (atau **Pilih dari Google Drive** di langkah 1 Buat klip) dan pilih file tersebut.

**8. Muncul "YouTube membatasi unduhan untuk sementara"?**
**J:** YouTube menerima terlalu banyak permintaan dari mesin yang sama. Tunggu hingga satu jam lalu coba lagi, atau pakai Cara 2 di nomor 7.
