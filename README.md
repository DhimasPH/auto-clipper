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

### Opsi 2: Menjalankan Mode Developer (Build Source)
Jika Anda ingin ikut berkontribusi atau mengembangkan fitur baru:

1. **Persiapan:** Pastikan Anda memiliki Node.js (v20+), Python (3.11+), dan OpenAI API Key.
2. **Jalankan Backend (Python):**
   ```bash
   cd backend
   pip install -r requirements.txt
   python main.py
   ```
3. **Jalankan Frontend (Electron/React):** Buka terminal baru di root proyek:
   ```bash
   npm install
   npm run electron:dev
   ```

---
*Dibuat untuk para kreator yang lebih suka membuat konten daripada terjebak di ruang editing.*
