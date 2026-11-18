# 📖 Panduan Santai Menggunakan Auto Clipper Cloud (Untuk Pemula)

Selamat datang! Panduan ini dibuat khusus agar siapa saja bisa menjalankan sistem pembuat klip video otomatis (Auto Clipper) tanpa pusing dengan istilah teknis.

Mari kita gunakan perumpamaan sederhana:
- **Google Colab** = **"Mesin Pabrik"**. Ini adalah komputer milik Google yang dipinjamkan gratis untuk kita. Tugasnya memotong video dan bikin subtitle.
- **Vercel (Web App)** = **"Remote Control"**. Ini adalah website yang Anda buka di HP untuk menyuruh Mesin Pabrik bekerja.
- **Kabel Penghubung** = Agar Remote Control bisa terhubung ke Mesin Pabrik, kita butuh jembatan. Ada 2 pilihan jembatan:
  - **Ngrok:** Gratis dan sangat gampang (cocok untuk pemula).
  - **Cloudflare:** Gratis juga, tapi khusus buat Anda yang sudah punya *domain web* sendiri (misal: `namaanda.com`).

---

## 🎯 Pemanasan: Bikin Akun Gratis
Sebelum mulai, pastikan Anda sudah punya akun-akun ini (semuanya gratis):
1. **Akun Google**: Untuk buka Google Colab & nyimpen hasil video di Google Drive.
2. **Akun GitHub** ([github.com](https://github.com)): Untuk menyimpan kode program.
3. **Akun Vercel** ([vercel.com](https://vercel.com)): Untuk menaruh Remote Control supaya bisa dibuka di HP.
4. **Pilih Salah Satu Kabel Penghubung:**
   - **Bikin Akun Ngrok** ([ngrok.com](https://ngrok.com)) kalau Anda **TIDAK** punya domain. Simpan teks panjang (*Authtoken*) dari menu *Your Authtoken*.
   - **Bikin Akun Cloudflare** kalau Anda **PUNYA** domain sendiri.
5. **(Disarankan) Akun Google cadangan**: akun kedua yang bukan akun utama Anda. Akun ini dipakai kalau YouTube meminta verifikasi (lihat Tanya Jawab nomor 7).

---

## 🏭 Langkah 1: Menyalakan "Mesin Pabrik" (Google Colab)

Langkah ini dilakukan di laptop/komputer.

1. Buka [Google Colab](https://colab.research.google.com/).
2. Buka *file* bernama `Auto_Clipper_Colab.ipynb` dari repository kode yang Anda punya.
3. **Sangat Penting:** Klik menu **Runtime** (di atas) -> **Change runtime type**. Pastikan *Hardware accelerator* terpilih **T4 GPU**. Tanpa GPU, pembuatan subtitle berjalan jauh lebih lambat.
4. Klik tombol **Play (▶️)** di sebelah kiri kotak-kotak kodenya secara berurutan:
   - **Kotak 1:** Untuk menyambungkan ke Google Drive (klik izinkan saat muncul peringatan).
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
| Render memakai prosesor | Klip dirender dengan prosesor biasa, bukan kartu grafis. | Tidak perlu apa-apa. Lebih lambat, tetapi klip tetap jadi. |
| Google Drive belum terhubung | Klip tidak tersimpan ke Drive dan hilang saat sesi selesai. | Jalankan Kotak 1 lagi, lalu jalankan ulang Kotak 4. |
| Pembantu unduhan YouTube belum terpasang | Deno tidak ada, jadi video YouTube lebih sering gagal diunduh. | Jalankan Kotak 2 lagi, lalu jalankan ulang Kotak 4. |
| Pengunduh video perlu diperbarui | Pengunduh video sudah lama, makin sering gagal. | Jalankan Kotak 3 lagi, lalu jalankan ulang Kotak 4. |

Biarkan tab Google Colab ini tetap terbuka!

---

## 📱 Langkah 2: Menyiapkan "Remote Control" (Vercel)

Langkah ini juga dilakukan sekali saja.

1. Buka [Vercel](https://vercel.com) dan masuk.
2. Klik **Add New...** -> **Project**. Pilih repository Auto Clipper dari GitHub Anda.
3. Pada halaman pengaturan, cari **Root Directory**, klik Edit, dan pilih folder bernama `web`.
4. Buka menu **Environment Variables**, lalu tambahkan:
   - **Name:** `VITE_API_URL`
   - **Value:** *Paste* link Ngrok / Cloudflare yang Anda *copy* di Langkah 1 tadi.
5. Klik **Deploy** dan tunggu 1-2 menit.
6. Anda akan mendapatkan link website gratis dari Vercel (contoh: `https://auto-clipper-web.vercel.app`). Ini adalah Remote Control Anda!

---

## 🎬 Langkah 3: Cara Pakai Sehari-hari (Bikin Video lewat HP)

Setelah mesin dan remote siap, Anda cukup menggunakan HP setiap harinya.

1. Buka browser di HP, buka link Remote Control Anda (link Vercel tadi).
2. Masukkan *Password* rahasia (`rahasia123`) yang Anda buat.
3. **Mulai Bikin Video:**
   - Tempel link video YouTube/TikTok, atau tekan tombol **Drive** (ikon hard disk di sebelah kolom link) untuk memilih video dari Google Drive Anda. Pilih rasio (Vertical 9:16) dan gaya tulisan.
   - Klik **Start Transcription**. Mesin di Colab akan mengekstrak teks.
4. **Pilih Bagian Terbaik Pakai AI:**
   - Setelah muncul teks video, klik **Share Prompt**.
   - Kirim teks ke aplikasi AI di HP Anda (ChatGPT / Gemini).
   - *Copy* balasan AI yang berbentuk tanda kurung `[ ... ]` (*JSON*), lalu *Paste* di web Auto Clipper.
5. Klik **Render Clips**.
6. **Selesai!** HP boleh ditutup. Buka lagi web beberapa menit kemudian, klik **Download** untuk menyimpan videonya ke galeri HP.

### Tulisan "Menunggu giliran"

Mesin Pabrik hanya mengerjakan **satu video berat dalam satu waktu**, supaya memorinya tidak habis. Kalau Anda memulai video kedua saat video pertama masih diproses, layar menulis **"Menunggu giliran. Proses ini berikutnya."** atau **"Menunggu giliran. Urutan ke-2 dalam antrean."**

Artinya video Anda sudah tercatat dan akan dikerjakan otomatis begitu video sebelumnya selesai. Tidak perlu menekan apa-apa. Jangan menekan **Lanjutkan** berulang kali: proyek yang masih diproses akan menolak dengan pesan "Proyek ini masih diproses".

### "Detail waktu": berapa lama tiap tahap

Setelah video selesai, di atas daftar klip ada tulisan **Detail waktu** yang bisa diketuk untuk dibuka. Isinya:
- Lama tiap tahap (mengunduh video, membuat subtitle, melacak wajah, merender klip, menyimpan ke folder penyimpanan) beserta totalnya.
- **Yang mengerjakan**: apakah subtitle dan render memakai **GPU (cepat)** atau **prosesor biasa, tanpa GPU (lebih lambat)**.

Detail waktu juga ada di menu **History**, di setiap proyek yang Anda buka.

### Kalau proses gagal: kotak merah dan "Detail teknis"

Kalau ada yang gagal, muncul kotak merah berisi judul masalah, penjelasan singkat, dan tombol untuk memperbaikinya (misalnya **Lanjutkan**, **Unggah cookies.txt**, atau **Pilih video dari Google Drive**).

Di bagian bawah kotak merah ada tulisan **Detail teknis**. Ketuk untuk membukanya, lalu tekan **Salin**. Teks itu tidak perlu Anda pahami: kirimkan saja ke pengembang kalau masalahnya tidak hilang.

---

## 🗂️ Di Mana Video Anda Disimpan?

- **Selama proses**, Mesin Pabrik bekerja di "meja kerja" sementara milik Colab (folder `/content/work`). Meja ini cepat, tetapi **dibersihkan setiap kali sesi Colab berakhir**.
- **Setiap klip yang selesai langsung disalin** ke Google Drive Anda, di folder `AutoClipperData`. Riwayat proyek (`history.db`) juga ikut disalin ke sana secara berkala.
- **Video asli (sumber) tidak disalin ke Drive**, karena ukurannya besar.

### Kalau sesi Colab mati (tab tertutup, terputus, atau kehabisan waktu)

- **Klip yang sudah jadi dan riwayat proyek aman** di Google Drive. Setelah Kotak 1-4 dijalankan lagi, semuanya muncul kembali di menu **History**.
- **Melanjutkan proyek dari link YouTube**: video aslinya diunduh ulang secara otomatis. Ini butuh waktu tambahan, dan bisa saja YouTube meminta verifikasi lagi.
- **Melanjutkan proyek dari video Google Drive**: video disalin ulang dari Drive Anda, asalkan file itu belum dihapus atau dipindah.
- **Video yang diunggah langsung ke mesin (bukan dipilih dari Drive)** ikut hilang bersama meja kerja. Kalau muncul pesan **"File video yang diunggah sudah tidak ada"**, unggah videonya sekali lagi sebagai proyek baru. Klip yang sudah jadi tetap aman.
- Klip yang sedang dirender tepat saat sesi mati belum tersimpan. Tekan **Lanjutkan** pada proyek itu: klip yang sudah jadi tidak dibuat ulang.

---

## 🛠️ Solusi Masalah Umum (Tanya Jawab Lengkap)

**1. Kenapa loading di HP muter-muter terus dan tidak ada reaksi?**
**J:** Kemungkinan Mesin Pabrik (Google Colab) tertidur karena lama tidak dipakai. Buka lagi Google Colab di laptop, klik *Reconnect*, lalu jalankan lagi Kotak 1 sampai Kotak 4. Baca bagian "Kalau sesi Colab mati" di atas untuk tahu apa yang tetap aman.

**2. Muncul peringatan "Unauthorized" atau salah password di HP?**
**J:** Anda salah memasukkan Password rahasia. Hapus riwayat (*cache/local storage*) website di HP Anda, *refresh* web-nya, lalu ketik password yang sama persis dengan yang ada di Google Colab.

**3. Muncul Error "Network Failed" / Gagal Koneksi?**
**J:** Ini berarti HP gagal menyambung ke Mesin.
- Pastikan tab Google Colab di laptop masih nyala dan berjalan (ikon Play-nya berputar).
- Kalau pakai Ngrok, kadang alamat link-nya berganti. Anda mungkin perlu mengambil link Ngrok baru di Colab dan memperbaruinya di pengaturan *Environment Variable* Vercel.

**4. Error saat pakai Cloudflare ("connection refused [::1]")?**
**J:** Saat mengatur *Public Hostname* di Cloudflare, bagian **URL** *wajib* diisi dengan angka `127.0.0.1:8000`. Jika Anda mengisi tulisan `localhost:8000`, koneksinya akan nyangkut dan error.

**5. Proses memotong video tiba-tiba mati / muncul "Memori perangkat habis"?**
**J:** Kalau videonya sangat panjang (lebih dari 1 jam), memori mesin Google Colab bisa habis. Pakai model suara (*Whisper model*) ukuran **Small** dan pelacakan wajah mode standar, lalu tekan **Lanjutkan**. Bagian yang sudah selesai tidak diulang.

**6. Google Drive saya kepenuhan, apa yang harus dihapus?**
**J:** Buka Google Drive, masuk ke folder `AutoClipperData` -> `projects`. Isinya klip dan subtitle tiap proyek. Anda boleh menghapus folder proyek lama yang klipnya sudah di-download ke HP. **Sangat Penting:** Jangan pernah menghapus file `history.db`! File ini adalah buku catatan riwayat video Anda di HP. Setelah menghapus, kosongkan juga *Sampah (Trash)* di Google Drive.

**7. Muncul "YouTube meminta verifikasi" (dulu muncul sebagai Error 403)?**
**J:** YouTube sering curiga pada permintaan dari server Google Colab, lalu meminta bukti login. Ada dua jalan keluar.

*Cara 1: Unggah file cookies.txt.* File ini berisi bukti login dari browser Anda. Ambil dari komputer, bukan HP:
1. Di browser komputer, pasang ekstensi "Get cookies.txt LOCALLY".
2. Buka youtube.com, lalu login dengan **akun cadangan**.
3. Di tab YouTube itu, klik ikon ekstensi tadi, pilih Export, lalu unggah file hasilnya.

Unggah lewat tombol **Unggah cookies.txt** di kotak merah, atau kapan saja lewat menu **Pengaturan** -> **Cookies YouTube** -> **Pilih file cookies.txt**. Kalau Anda mengunggah dari kotak merah, setelah file diterima tekan **Coba lagi sekarang**.

> ⚠️ **Pakai akun cadangan, bukan akun utama.** YouTube bisa membatasi akun yang cookies-nya dipakai untuk mengunduh. Jangan pernah memakai akun Google utama Anda.

Yang perlu diketahui:
- File cookies tersimpan di folder `AutoClipperData` di Google Drive Anda, jadi masih ada di sesi Colab berikutnya. Isinya hanya dipakai oleh pengunduh video. Untuk menghapusnya, buka **Pengaturan** -> **Cookies YouTube** -> **Hapus cookies**.
- Cookies punya masa berlaku. Kalau muncul "Cookies YouTube sudah kedaluwarsa", login lagi dengan akun cadangan, ekspor ulang, lalu unggah file baru.
- Kalau muncul "File ini bukan dari akun yang sedang login", Anda mengekspor saat belum login. Login dulu, baru ekspor.

*Cara 2: Pakai file videonya langsung.* Unduh videonya sendiri, simpan ke Google Drive Anda, lalu tekan **Pilih video dari Google Drive** di kotak merah (atau tombol **Drive** di sebelah kolom link) dan pilih file tersebut.

**8. Muncul "YouTube membatasi unduhan untuk sementara"?**
**J:** YouTube menerima terlalu banyak permintaan dari mesin yang sama. Tunggu hingga satu jam lalu coba lagi, atau pakai Cara 2 di nomor 7.

---
Selamat membuat konten viral dengan mudah! 🚀
