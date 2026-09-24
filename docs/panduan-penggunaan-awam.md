# 📖 Panduan Santai Menggunakan Auto Clipper Cloud (Untuk Pemula)

Selamat datang! Panduan ini dibuat khusus agar siapa saja bisa menjalankan sistem pembuat klip video otomatis (Auto Clipper) tanpa pusing dengan istilah teknis.

Mari kita gunakan perumpamaan sederhana:
- **Google Colab** = **"Mesin Pabrik"**. Ini adalah komputer super kuat milik Google yang dipinjamkan gratis untuk kita. Tugasnya memotong video dan bikin subtitle.
- **Vercel (Web App)** = **"Remote Control"**. Ini adalah website yang Anda buka di HP untuk menyuruh Mesin Pabrik bekerja.
- **Ngrok** = **"Kabel Penghubung"**. Ini adalah layanan gratis yang menyambungkan Remote Control (HP Anda) ke Mesin Pabrik.

---

## 🎯 Pemanasan: Bikin 4 Akun Gratis
Sebelum mulai, pastikan Anda sudah punya 4 akun ini (semuanya gratis):
1. **Akun Google**: Untuk buka Google Colab & nyimpen hasil video di Google Drive.
2. **Akun GitHub** ([github.com](https://github.com)): Untuk menyimpan kode program.
3. **Akun Ngrok** ([ngrok.com](https://ngrok.com)): Untuk bikin Kabel Penghubung. Setelah daftar, cari menu **Your Authtoken** dan simpan teks panjang yang muncul.
4. **Akun Vercel** ([vercel.com](https://vercel.com)): Untuk menaruh Remote Control supaya bisa dibuka di HP.

---

## 🏭 Langkah 1: Menyalakan "Mesin Pabrik" (Google Colab)

Langkah ini dilakukan di laptop/komputer.

1. Buka [Google Colab](https://colab.research.google.com/).
2. Buka *file* bernama `Auto_Clipper_Colab.ipynb` dari repository kode yang Anda punya.
3. **Sangat Penting:** Klik menu **Runtime** (di atas) -> **Change runtime type**. Pastikan *Hardware accelerator* terpilih **T4 GPU** (agar kerja mesinnya super ngebut).
4. Di dalam Colab, Anda akan melihat beberapa kotak kode. Klik tombol **Play (▶️)** di sebelah kiri kotak secara berurutan dari atas ke bawah:
   - **Kotak 1:** Untuk menyambungkan ke Google Drive (klik izinkan saat muncul peringatan).
   - **Kotak 2 & 3:** Untuk menginstal mesin dan peralatannya. Tunggu sampai selesai (ada centang hijau ✅).
   - **Kotak 4 (Bagian Ngrok):** Masukkan *Authtoken* dari akun Ngrok Anda, dan bikin sembarang *Password* rahasia (contoh: `rahasia123`). Lalu klik **Play (▶️)**.
5. Tunggu sebentar, di bawah kotak 4 akan muncul tulisan:
   > 🚀 PUBLIC BACKEND URL ANDA: `https://abcd-12-34-56.ngrok-free.app`
6. **Selesai!** Salin (copy) link `ngrok-free.app` tersebut. Mesin pabrik sudah menyala. Biarkan tab Google Colab ini tetap terbuka.

---

## 📱 Langkah 2: Menyiapkan "Remote Control" (Vercel)

Langkah ini juga dilakukan sekali saja.

1. Buka [Vercel](https://vercel.com) dan masuk.
2. Klik **Add New...** -> **Project**. Pilih repository Auto Clipper dari GitHub Anda.
3. Pada halaman pengaturan, cari **Root Directory**, klik Edit, dan pilih folder bernama `web`.
4. Buka menu **Environment Variables**, lalu tambahkan:
   - **Name:** `VITE_API_URL`
   - **Value:** Paste link Ngrok yang Anda copy di Langkah 1 tadi (contoh: `https://abcd-12-34-56.ngrok-free.app`).
5. Klik **Deploy** dan tunggu 1-2 menit.
6. Anda akan mendapatkan link website gratis dari Vercel (contoh: `https://auto-clipper-web.vercel.app`). Ini adalah Remote Control Anda!

---

## 🎬 Langkah 3: Cara Pakai Sehari-hari (Bikin Video lewat HP)

Setelah mesin dan remote siap, Anda cukup menggunakan HP setiap harinya.

1. Buka browser di HP (Chrome / Safari), buka link Remote Control Anda (link Vercel tadi).
2. Masukkan *Password* rahasia (`rahasia123`) yang Anda buat di Langkah 1.
3. **Mulai Bikin Video:**
   - Tempel link video (YouTube/TikTok/IG) di kolom yang tersedia.
   - Pilih rasio (misal Vertical 9:16 untuk Reels) dan gaya tulisan (Subtitle).
   - Klik **Start Transcription**. Mesin di Colab akan mulai bekerja mengekstrak teks.
4. **Pilih Bagian Terbaik Pakai AI:**
   - Setelah muncul teks transkrip video, klik **Share Prompt**.
   - Pilih aplikasi AI di HP Anda (misal ChatGPT atau Gemini) lalu tempel teksnya.
   - AI akan membalas dengan teks *JSON* berisi menit-menit terbaik.
   - *Copy* balasan AI tersebut, kembali ke web Auto Clipper, dan *Paste* di kotak yang diminta.
5. Klik **Render Clips**.
6. **Selesai!** HP boleh ditutup atau dimatikan layarnya. Mesin Pabrik di Colab akan mengedit video secara otomatis. 
7. Buka lagi web Auto Clipper 5-10 menit kemudian, dan klik **Download** untuk menyimpan videonya ke galeri HP Anda. Videonya juga sudah tersimpan aman di Google Drive Anda.

---

## 🛠️ Solusi Masalah Umum (Tanya Jawab)

**T: Kenapa loading di HP muter-muter terus dan tidak ada reaksi?**
J: Kemungkinan Mesin Pabrik (Google Colab) tertidur atau koneksi terputus. Buka lagi Google Colab di laptop, pastikan kotak nomor 4 masih menyala (berputar). Jika mati, klik tombol *Play* lagi. 

**T: Muncul peringatan "Unauthorized" di HP?**
J: Anda salah memasukkan Password rahasia. Hapus data browser atau masuk ulang, lalu ketik password yang sama persis dengan yang ada di Google Colab.

**T: Google Drive saya kepenuhan, apa yang harus dihapus?**
J: Buka Google Drive, masuk ke folder `AutoClipperData` -> `projects`. Anda boleh menghapus folder video lama yang sudah di-download ke HP. **Penting:** Jangan hapus file `history.db` agar riwayat aplikasi di HP tidak hilang.

---
Selamat membuat konten viral dengan mudah! 🚀
