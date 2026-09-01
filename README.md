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
- ✍️ **Edit Subtitle Cerdas** – Koreksi salah eja secara manual atau biarkan AI merapikannya untuk Anda, lalu *rerender* klip spesifik dalam hitungan detik.
- ☁️ **Dukungan Cloud GPU** – Jalankan mesin render berat di Google Colab (Gratis) dan akses UI lewat browser tanpa perlu PC mahal!
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

#### 🍎 macOS (Apple Silicon & Intel)

Untuk pengguna Mac, unduh file `.dmg` yang sesuai chip Anda dari halaman **[Releases](../../releases)**:

- **Apple Silicon (M1/M2/M3…):** `Auto.Clipper_<versi>_aarch64.dmg`
- **Intel:** `Auto.Clipper_<versi>_x64.dmg`

Buka DMG-nya, lalu seret **Auto Clipper** ke folder `/Applications`. Karena aplikasi ini di-sign secara _ad-hoc_ (tanpa akun Apple Developer berbayar), macOS Gatekeeper akan menahannya saat pertama kali dibuka. Jalankan perintah ini **sekali** di Terminal untuk mengizinkannya:

```bash
xattr -cr "/Applications/Auto Clipper.app"
```

Setelah itu aplikasi bisa dibuka normal dari Launchpad atau folder Applications.

**Cara update:** gunakan updater bawaan aplikasi — klik tombol _"Update"_ di dalam aplikasi saat tersedia (terverifikasi secara kriptografis dengan Minisign). Anda juga selalu bisa mengunduh DMG versi terbaru dari halaman Releases.

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

4. **Jalankan Frontend Web (UI Browser):** Jika Anda ingin menggunakan UI web murni:
   ```bash
   cd web
   npm install
   npm run dev
   ```


### Opsi 4: Build DMG macOS Sendiri (Lokal, untuk macOS 12+)

Jika Anda pengembang di Mac dan ingin mem-build aplikasi macOS sendiri (misalnya untuk menguji di macOS 12 Intel), tersedia script otomatis **`build-mac-local.sh`** di root proyek yang merangkum semua langkah: memeriksa/menginstal tool yang belum ada, build backend Python, staging + _ad-hoc codesign_, hingga menghasilkan `.app`/`.dmg`.

1. **Clone repo & jalankan script** dari root proyek di Mac Anda:
   ```bash
   git clone https://github.com/DhimasPH/auto-clipper.git
   cd auto-clipper
   chmod +x build-mac-local.sh
   ./build-mac-local.sh
   ```
2. Rust, Node, dan Python akan dipasang otomatis jika belum ada. Untuk **Xcode Command Line Tools** (`xcode-select --install`) dan **Homebrew** yang butuh interaksi/kata sandi, script berhenti dan memberi instruksi — pasang lalu jalankan ulang.
3. Hasil build (`.app` + `.dmg`) muncul di `src-tauri/target/x86_64-apple-darwin/release/bundle/` dan disalin ke `./dist-macos/`. Buka DMG-nya, drag **Auto Clipper** ke `/Applications`, lalu jalankan.

> **Catatan:** Ini _build pengujian_ (artifact auto-updater dimatikan, jadi tidak perlu signing key). Script menyasar target **Intel (x86_64)**; jika Anda di Apple Silicon, ubah variabel `TARGET` di dalam script menjadi `aarch64-apple-darwin`. Untuk menghemat ruang setelah selesai, jalankan `CLEAN=1 ./build-mac-local.sh` (sisa build dihapus, DMG tetap disimpan). Jika Gatekeeper memblokir: `xattr -cr "/Applications/Auto Clipper.app"`.

### Opsi 5: Menjalankan Auto Clipper Cloud (Google Colab GPU + Web UI HP)

Jika Anda ingin memproses video dari smartphone atau PC Anda tidak memiliki GPU yang mumpuni, Anda bisa menjalankan *backend* Auto Clipper di **Google Colab (Gratis GPU T4)** dengan penyimpanan persisten di **Google Drive**, dan mengontrolnya langsung dari browser smartphone:

📖 **[Baca Panduan Teknis Lengkap Auto Clipper Cloud (Tutorial Step-by-Step)](docs/tutorial-auto-clipper-cloud.md)**

**Ringkasan Cepat:**
1. Buka file **[`Auto_Clipper_Colab.ipynb`](Auto_Clipper_Colab.ipynb)** di Google Colab.
2. Pastikan Runtime Colab di-set ke **T4 GPU** (*Runtime $\rightarrow$ Change runtime type $\rightarrow$ T4 GPU*).
3. Masukkan `CLOUDFLARE_TUNNEL_TOKEN` (atau token Ngrok) dan `API_SECRET_TOKEN` rahasia Anda, lalu jalankan semua sel (*Run All*).
4. Buka antarmuka Web UI di browser smartphone Anda (misal `https://clipper.dhims.web.id` yang di-deploy di Vercel, atau lokal `cd web && npm run dev`).
5. Masukkan token rahasia Anda pada layar login Web UI.
6. Nikmati kemudahan memotong klip dan transkripsi video otomatis berkecepatan tinggi langsung dari genggaman HP Anda!


---

_Dibuat untuk para kreator yang lebih suka membuat konten daripada terjebak di ruang editing._
