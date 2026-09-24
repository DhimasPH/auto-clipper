# 📖 Panduan Santai Menggunakan Auto Clipper Cloud (Untuk Pemula)

Selamat datang! Panduan ini dibuat khusus agar siapa saja bisa menjalankan sistem pembuat klip video otomatis (Auto Clipper) tanpa pusing dengan istilah teknis.

Mari kita gunakan perumpamaan sederhana:
- **Google Colab** = **"Mesin Pabrik"**. Ini adalah komputer super kuat milik Google yang dipinjamkan gratis untuk kita. Tugasnya memotong video dan bikin subtitle.
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

---

## 🏭 Langkah 1: Menyalakan "Mesin Pabrik" (Google Colab)

Langkah ini dilakukan di laptop/komputer.

1. Buka [Google Colab](https://colab.research.google.com/).
2. Buka *file* bernama `Auto_Clipper_Colab.ipynb` dari repository kode yang Anda punya.
3. **Sangat Penting:** Klik menu **Runtime** (di atas) -> **Change runtime type**. Pastikan *Hardware accelerator* terpilih **T4 GPU** (agar kerja mesinnya super ngebut).
4. Klik tombol **Play (▶️)** di sebelah kiri kotak-kotak kodenya secara berurutan:
   - **Kotak 1:** Untuk menyambungkan ke Google Drive (klik izinkan saat muncul peringatan).
   - **Kotak 2 & 3:** Untuk menginstal mesin dan peralatannya. Tunggu sampai selesai (ada centang hijau ✅).

### Cara Menghubungkan (Pilih Salah Satu):

**Jalur A: Menggunakan Ngrok (Tanpa Domain)**
- Pergi ke **Kotak 4 (Bagian Ngrok)**.
- Masukkan *Authtoken* dari akun Ngrok Anda, dan bikin sembarang *Password* rahasia (contoh: `rahasia123`).
- Klik **Play (▶️)**. Tunggu sampai muncul tulisan `URL ANDA: https://abcd-123.ngrok-free.app`. **Salin URL tersebut.**

**Jalur B: Menggunakan Cloudflare (Punya Domain Sendiri)**
- Masuk ke *dashboard* Cloudflare Anda -> menu **Zero Trust** -> **Networks** -> **Tunnels** -> **Create a tunnel** (pilih Cloudflared).
- Salin token panjangnya (kata-kata setelah `--token`).
- Masuk ke tab **Public Hostname**, lalu tambahkan:
  - **Subdomain:** misal `mesin-clipper`
  - **Domain:** pilih domain Anda (misal `namaanda.com`).
  - **URL Tujuan:** Pilih `HTTP` dan isikan angka wajib ini: `127.0.0.1:8000` *(jangan ketik 'localhost')*.
- Di Google Colab, pergi ke **Kotak 4 (Bagian Cloudflare)**. Masukkan token panjang tadi, dan buat *Password* rahasia. Klik **Play (▶️)**.
- **Selesai!** URL Anda sekarang adalah `https://mesin-clipper.namaanda.com`. **Salin URL tersebut.**

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
   - Tempel link video YouTube/TikTok. Pilih rasio (Vertical 9:16) dan gaya tulisan.
   - Klik **Start Transcription**. Mesin di Colab akan mengekstrak teks.
4. **Pilih Bagian Terbaik Pakai AI:**
   - Setelah muncul teks video, klik **Share Prompt**.
   - Kirim teks ke aplikasi AI di HP Anda (ChatGPT / Gemini).
   - *Copy* balasan AI yang berbentuk tanda kurung `[ ... ]` (*JSON*), lalu *Paste* di web Auto Clipper.
5. Klik **Render Clips**.
6. **Selesai!** HP boleh ditutup. Buka lagi web 5-10 menit kemudian, klik **Download** untuk menyimpan videonya ke galeri HP.

---

## 🛠️ Solusi Masalah Umum (Tanya Jawab Lengkap)

**1. Kenapa loading di HP muter-muter terus dan tidak ada reaksi?**
**J:** Kemungkinan Mesin Pabrik (Google Colab) tertidur karena lama tidak dipakai. Buka lagi Google Colab di laptop, klik *Reconnect*, dan tekan tombol *Play* pada kotak 4 lagi.

**2. Muncul peringatan "Unauthorized" atau salah password di HP?**
**J:** Anda salah memasukkan Password rahasia. Hapus riwayat (*cache/local storage*) website di HP Anda, *refresh* web-nya, lalu ketik password yang sama persis dengan yang ada di Google Colab.

**3. Muncul Error "Network Failed" / Gagal Koneksi?**
**J:** Ini berarti HP gagal menyambung ke Mesin. 
- Pastikan tab Google Colab di laptop masih nyala dan berjalan (ikon Play-nya berputar).
- Kalau pakai Ngrok, kadang alamat link-nya berganti. Anda mungkin perlu mengambil link Ngrok baru di Colab dan memperbaruinya di pengaturan *Environment Variable* Vercel.

**4. Error saat pakai Cloudflare ("connection refused [::1]")?**
**J:** Saat mengatur *Public Hostname* di Cloudflare, bagian **URL** *wajib* diisi dengan angka `127.0.0.1:8000`. Jika Anda mengisi tulisan `localhost:8000`, koneksinya akan nyangkut dan error.

**5. Proses memotong video tiba-tiba mati / RAM kepenuhan?**
**J:** Kalau videonya sangat panjang (lebih dari 1 jam), terkadang mesin Google Colab ngos-ngosan. Untuk video panjang, pakai model suara (*Whisper model*) ukuran **Small** saja di pengaturan web HP, agar lebih ringan.

**6. Google Drive saya kepenuhan, apa yang harus dihapus?**
**J:** Buka Google Drive, masuk ke folder `AutoClipperData` -> `projects`. Anda boleh menghapus folder video lama yang sudah di-download ke HP. **Sangat Penting:** Jangan pernah menghapus file `history.db`! File ini adalah buku catatan riwayat video Anda di HP.

**7. Muncul Error 403 saat memasukkan link YouTube?**
**J:** Ini berarti pihak YouTube sedang memblokir akses pengunduhan otomatis dari mesin. Solusinya, jangan pakai link YouTube. Anda bisa mengunduh videonya terlebih dahulu lalu pakai menu **Video Lokal** di aplikasi, atau simpan saja videonya di Google Drive Anda.

---
Selamat membuat konten viral dengan mudah! 🚀
