<div align="center">
  <h1>✂️ Auto Clipper</h1>
  <p><strong>Ubah Video YouTube Berjam-jam Menjadi Shorts Viral dalam 5 Menit. Tanpa Edit Manual.</strong></p>
</div>

---

## 🛑 Berhenti Membuang Waktu Mengedit Video Pendek

Jika Anda adalah kreator konten, podcaster, atau streamer, Anda tahu betapa melelahkannya mencari *momen emas* dari video berdurasi 2 jam, memotongnya, mengubah rasionya menjadi vertikal, dan menambahkan subtitle satu per satu. 

**Auto Clipper** mengambil alih pekerjaan kasar itu. Anda cukup memasukkan link YouTube, dan biarkan AI kami mencari bagian paling menarik, memotongnya ke format 9:16 yang pas untuk TikTok/Reels, dan menempelkan subtitle secara otomatis.

> *"Ketika saya selesai melakukan live streaming, saya ingin langsung mendapatkan 3 video pendek terbaik, sehingga saya bisa langsung upload ke TikTok untuk menarik penonton baru tanpa harus begadang mengedit."*

## ✨ Mengapa Memilih Auto Clipper?

*   ⏳ **Hemat 2 Jam Per Video** – Tidak perlu lagi *scrubbing* timeline mencari momen lucu. AI yang memilihkannya untuk Anda.
*   🎯 **Fokus Selalu Pada Anda** – Video lanskap otomatis dipotong menjadi vertikal dengan teknologi *Face-Tracking* bawaan. Wajah Anda tidak akan keluar dari frame.
*   💬 **Subtitle yang Siap Tayang** – Ditenagai teknologi *speech-to-text* kelas dunia, subtitle sudah langsung menyatu dengan video (*burned-in*).
*   🚀 **Semudah Copy-Paste** – Tanpa pengaturan *framerate* atau *bitrate* yang membingungkan. Paste Link $\rightarrow$ Klik Proses $\rightarrow$ Dapatkan Video MP4.

## 💻 Spesifikasi Minimal Komputer (PC/Laptop)

Karena aplikasi ini melakukan pemrosesan video dan pelacakan wajah secara lokal, pastikan perangkat Anda memenuhi spesifikasi berikut:

*   **Sistem Operasi:** Windows 10/11 (64-bit), macOS 12+, atau Linux (Ubuntu 22.04+)
*   **Prosesor (CPU):** Intel Core i5 (Generasi ke-8) atau AMD Ryzen 5 (Multicore sangat disarankan untuk kecepatan *render* video)
*   **RAM:** Minimal 8 GB (Direkomendasikan 16 GB untuk pemrosesan video HD)
*   **Penyimpanan:** Minimal 2 GB ruang kosong (siapkan ruang tambahan untuk menyimpan file video asli yang diunduh)
*   **Koneksi Internet:** Wajib (untuk mengunduh video YouTube dan memanggil API transkripsi/AI)

## 🚀 Cara Instalasi & Penggunaan

### Opsi 1: Menggunakan Installer Praktis (Rekomendasi)
Anda tidak perlu repot dengan terminal. Buka halaman **[Releases](../../releases)** di GitHub kami dan unduh file installer (`.exe`, `.dmg`, atau `.AppImage`). Semua kebutuhan termasuk FFmpeg dan Backend sudah dibundel di dalamnya!

> #### ⚠️ Pengguna macOS: Status "Backend Disconnected"
>
> Aplikasi macOS saat ini **belum di-notarisasi Apple**. Karena itu, ketika Anda mengunduh `.dmg` dari internet, macOS menandai aplikasi (dan komponen backend di dalamnya) dengan atribut *quarantine*, sehingga backend diblokir oleh Gatekeeper dan status tampil **"Disconnected"** meski jendela aplikasi terbuka.
>
> **Solusi (sekali saja):** setelah menyeret aplikasi ke folder Applications, buka **Terminal** lalu jalankan:
>
> ```bash
> xattr -cr "/Applications/Auto Clipper.app"
> ```
>
> Perintah ini menghapus atribut quarantine dari aplikasi **beserta** backend di dalamnya (opsi `-r` bersifat rekursif). Buka kembali aplikasinya — status akan berubah menjadi **"Connected"**. Anda hanya perlu melakukan ini sekali per pemasangan.
>
> Catatan: klik-kanan → *Open* saja seringkali **tidak cukup**, karena hanya membersihkan cangkang aplikasi, bukan binary backend di dalamnya.

### Opsi 2: Menjalankan Mode Developer (Build Source)
Jika Anda ingin ikut berkontribusi atau mengembangkan fitur baru:

1. **Persiapan:** Pastikan Anda memiliki Node.js (v20+), Python (3.11+), Rust / Cargo (untuk build desktop), dan OpenAI API Key.
2. **Jalankan Backend (Python):**
   *(Tauri akan menjalankan sidecar backend secara otomatis, tetapi untuk build awal sidecar-nya Anda perlu meng-compile-nya sekali saja)*
   ```bash
   pip install pyinstaller
   pyinstaller --onefile backend/main.py --name backend
   mkdir bin
   # Salin dist/backend.exe ke bin/backend-<TARGET_TRIPLET>.exe (sesuaikan dengan OS Anda)
   ```
3. **Jalankan Frontend (Tauri/React):** Buka terminal baru di root proyek:
   ```bash
   npm install
   npm run tauri dev
   ```

---
*Dibuat untuk para kreator yang lebih suka membuat konten daripada terjebak di ruang editing.*
