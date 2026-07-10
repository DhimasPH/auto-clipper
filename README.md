<div align="center">
  <h1>✂️ Auto Clipper MVP</h1>
  <p><strong>Ubah Video YouTube Berjam-jam Menjadi Shorts Viral dalam 5 Menit. Tanpa Edit Manual.</strong></p>
</div>

---

## 🛑 Berhenti Membuang Waktu Mengedit Video Pendek

Jika Anda adalah kreator konten, podcaster, atau streamer, Anda tahu betapa melelahkannya mencari *momen emas* dari video berdurasi 2 jam, memotongnya, mengubah rasionya menjadi vertikal, dan menambahkan subtitle satu per satu. 

**Auto Clipper** mengambil alih pekerjaan kasar itu. Anda cukup memasukkan link YouTube, dan biarkan AI kami mencari bagian paling menarik, memotongnya ke format 9:16 yang pas untuk TikTok/Reels, dan menempelkan subtitle secara otomatis.

> *"Ketika saya selesai melakukan live streaming (Situasi), saya ingin langsung mendapatkan 3 video pendek terbaik (Motivasi), sehingga saya bisa langsung upload ke TikTok untuk menarik penonton baru tanpa harus mengedit semalaman (Hasil)."*

## ✨ Mengapa Menggunakan Auto Clipper?

*   ⏳ **Hemat 2 Jam Per Video** – Tidak perlu lagi *scrubbing* timeline mencari momen lucu. AI yang melakukannya.
*   🎯 **Format 9:16 Otomatis (Face-Tracking)** – Video lanskap Anda otomatis dipotong menjadi vertikal dengan wajah Anda tetap berada di tengah layar.
*   💬 **Subtitle Bawaan yang Akurat** – Ditenagai oleh teknologi *speech-to-text* (OpenAI Whisper) kelas dunia, subtitle sudah langsung menyatu dengan video (*burned-in*).
*   🚀 **Sangat Mudah Digunakan** – Tanpa pengaturan *framerate* atau *bitrate* yang membingungkan. Paste Link $\rightarrow$ Klik Proses $\rightarrow$ Dapatkan MP4.

## 🛠️ Arsitektur & Teknologi (MVP)

Aplikasi ini dibangun untuk kecepatan dan efisiensi lokal:
*   **Frontend (UI):** Electron + React + Tauri (Tampilan modern, ringan, dan *frictionless*).
*   **Backend (Mesin):** Python FastAPI berjalan secara lokal sebagai *sidecar*.
*   **AI Engine:** Integrasi OpenAI API (untuk ekstraksi *highlights* cerdas dan transkripsi akurat).
*   **Media Processing:** `yt-dlp` (unduh cepat) dan `FFmpeg` + `OpenCV` (pemotongan & pelacakan wajah super cepat).

## 🚀 Cara Mulai Menggunakan

Karena ini adalah versi MVP, Anda perlu menjalankan *backend* dan *frontend* secara berdampingan.

### 1. Persiapan
Pastikan Anda memiliki:
- Node.js (v18+)
- Python (3.10+)
- [FFmpeg](https://ffmpeg.org/) terinstal dan terdaftar di `PATH` sistem operasi Anda.
- OpenAI API Key.

### 2. Jalankan Backend (Python)
```bash
cd backend
pip install -r requirements.txt
python main.py
```

### 3. Jalankan Frontend (Electron/React)
Buka terminal baru di root folder proyek:
```bash
npm install
npm run electron:dev
```

---
*Dibuat untuk para kreator yang lebih suka membuat konten daripada terjebak di ruang editing.*
