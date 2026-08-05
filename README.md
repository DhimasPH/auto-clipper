<div align="center">
  <h1>✂️ Auto Clipper</h1>
  <p><strong>Ubah Video YouTube Berjam-jam Menjadi Shorts Viral dalam 5 Menit. Tanpa Edit Manual.</strong></p>
</div>

---

## 🛑 Berhenti Membuang Waktu Mengedit Video Pendek

Jika Anda adalah kreator konten, podcaster, atau streamer, Anda tahu betapa melelahkannya mencari _momen emas_ dari video berdurasi 2 jam, memotongnya, mengubah rasionya menjadi vertikal, dan menambahkan subtitle satu per satu.

**Auto Clipper** mengambil alih pekerjaan kasar itu. Anda cukup memasukkan link YouTube, dan biarkan AI kami mencari bagian paling menarik, memotongnya ke format 9:16 yang pas untuk TikTok/Reels, dan menempelkan subtitle secara otomatis.

> _"Ketika saya selesai melakukan live streaming, saya ingin langsung mendapatkan 3 video pendek terbaik, sehingga saya bisa langsung upload ke TikTok untuk menarik penonton baru tanpa harus begadang mengedit."_

## ✨ Mengapa Memilih Auto Clipper?

- ⏳ **Hemat 2 Jam Per Video** – Tidak perlu lagi _scrubbing_ timeline mencari momen lucu. AI yang memilihkannya untuk Anda.
- 🎯 **Fokus Selalu Pada Anda** – Video lanskap otomatis dipotong menjadi vertikal dengan teknologi _Face-Tracking_ bawaan. Wajah Anda tidak akan keluar dari frame.
- 💬 **Subtitle yang Siap Tayang** – Ditenagai teknologi _speech-to-text_ kelas dunia, subtitle sudah langsung menyatu dengan video (_burned-in_).
- 🚀 **Semudah Copy-Paste** – Tanpa pengaturan _framerate_ atau _bitrate_ yang membingungkan. Paste Link $\rightarrow$ Klik Proses $\rightarrow$ Dapatkan Video MP4.

## 💻 Spesifikasi Minimal Komputer (PC/Laptop)

Karena aplikasi ini melakukan pemrosesan video dan pelacakan wajah secara lokal, pastikan perangkat Anda memenuhi spesifikasi berikut:

- **Sistem Operasi:** Windows 10/11 (64-bit), atau macOS 12 (Monterey) ke atas — Apple Silicon (M1/M2/M3…) maupun Intel
- **Prosesor (CPU):** Intel Core i5 (Generasi ke-8) atau AMD Ryzen 5 (Multicore sangat disarankan untuk kecepatan _render_ video)
- **RAM:** Minimal 8 GB (Direkomendasikan 16 GB untuk pemrosesan video HD)
- **Penyimpanan:** Minimal 2 GB ruang kosong (siapkan ruang tambahan untuk menyimpan file video asli yang diunduh)
- **Koneksi Internet:** Wajib (untuk mengunduh video YouTube dan memanggil API transkripsi/AI)

## 🚀 Cara Instalasi & Penggunaan

### Opsi 1: Menggunakan Installer Praktis (Rekomendasi)

Anda tidak perlu repot dengan terminal. Semua komponen yang dibutuhkan sudah kami bundel menjadi satu.

**Langkah Pemasangan:**

1. Buka halaman **[Releases](../../releases)** kami.
2. Unduh file installer `.exe` versi terbaru.
3. Klik ganda (Double-click) file yang sudah diunduh dan instal seperti biasa. Aplikasi siap digunakan!

#### 🍎 macOS (Homebrew)

Untuk pengguna Mac (Apple Silicon maupun Intel), Auto Clipper tersedia lewat Homebrew Tap dan berjalan di **macOS 12 (Monterey) ke atas**. Cukup satu baris di Terminal:

```bash
brew install --cask --no-quarantine DhimasPH/tap/auto-clipper
```

Flag `--no-quarantine` membuat aplikasi langsung bisa dibuka tanpa peringatan _"app is damaged"_ / _"unidentified developer"_. Aplikasi ini di-sign secara _ad-hoc_ (tanpa akun Apple Developer berbayar), sehingga karantina perlu dibersihkan — flag tersebut melakukannya otomatis saat instalasi.

Jika Anda mengunduh file `.dmg` langsung dari halaman Releases (bukan lewat Homebrew), pindahkan aplikasi ke `/Applications`, lalu jalankan sekali di Terminal untuk membersihkan karantina:

```bash
xattr -cr "/Applications/Auto Clipper.app"
```

**Cara update:** lewat tombol _"Update"_ di dalam aplikasi (terverifikasi secara kriptografis dengan Minisign), atau jalankan `brew upgrade auto-clipper`.

> Catatan: aplikasi membundel backend Python (transkripsi Whisper, OpenCV, FFmpeg), jadi ukuran unduhan cukup besar (ratusan MB). Unduhan pertama akan memakan waktu.

### Opsi 2: Menjalankan Mode Developer (Build Source)

Jika Anda ingin ikut berkontribusi atau mengembangkan fitur baru:

1. **Persiapan:** Pastikan Anda memiliki Node.js (v20+), Python (3.11+), Rust / Cargo (untuk build desktop), dan OpenAI API Key.
2. **Jalankan Backend (Python):**
   _(Tauri akan menjalankan sidecar backend secara otomatis, tetapi untuk build awal sidecar-nya Anda perlu meng-compile-nya sekali saja)_
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

### Opsi 3: Menjalankan Mode Developer (Fast-Reload tanpa Sidecar)

Jika Anda sedang mengubah kode backend Python (`backend/`) secara terus-menerus dan tidak ingin mem-*build* file `.exe` setiap kali ada perubahan, Anda bisa mem-bypass Sidecar:

1. **Jalankan Backend Secara Manual:** Buka terminal pertama dan jalankan `uvicorn` dengan mode *auto-reload* aktif. Atur environment variable `AUTO_CLIPPER_DEV_TOKEN` dengan token rahasia lokal.
   ```powershell
   $env:AUTO_CLIPPER_DEV_TOKEN="dev-token"; uvicorn backend.main:app --port 8000 --reload
   ```
2. **Jalankan Frontend Tauri:** Buka terminal kedua, pastikan Anda memiliki file `.env.local` di folder root dengan isi `VITE_DEV_BACKEND=true`. Frontend akan langsung terkoneksi ke `localhost:8000` tanpa men-spawn `.exe`.
   ```bash
   npm run tauri dev
   ```

---

_Dibuat untuk para kreator yang lebih suka membuat konten daripada terjebak di ruang editing._
