# Product Requirements Document (PRD) - Auto Clipper MVP

> **Product Manager Philosophy:** Build outcomes, not outputs. Ship learning, not just features.

## 1. Executive Summary

**Auto Clipper** adalah aplikasi desktop (berbasis Electron + FastAPI) yang dirancang untuk mengatasi masalah terbesar para konten kreator: membuang terlalu banyak waktu untuk mengedit video panjang menjadi potongan pendek (Shorts/Reels/TikTok).

Saat ini, Auto Clipper berada dalam fase **MVP (Minimum Viable Product)**. MVP ini berfokus pada pembuktian nilai inti (_core value proposition_): mengambil URL YouTube dan secara otomatis menghasilkan video berformat 9:16 dengan _face-tracking_.

## 2. Jobs-to-be-Done (JTBD) & Target Pengguna

- **Target Pengguna:** Podcaster, Live Streamer (Twitch/YouTube), Edukator, dan Kreator Konten umum.
- **Situasi:** "Ketika saya selesai melakukan sesi rekaman/streaming yang panjang (1-2 jam)..."
- **Motivasi (Job):** "...saya ingin sistem yang bisa menemukan bagian paling menarik secara otomatis dan mengubah rasionya menjadi vertikal..."
- **Hasil yang Diharapkan (Outcome):** "...sehingga saya bisa langsung mempublikasikannya ke TikTok/Shorts untuk mendapatkan _reach_ baru tanpa harus menghabiskan waktu berjam-jam untuk _scrubbing_ dan _editing_."

## 3. Analisis Fitur Saat Ini (MVP Baseline)

Berikut adalah dekonstruksi fitur yang sudah ada saat ini beserta evaluasi dari sudut pandang produk:

### A. YouTube Downloader

- **Apa yang dilakukan:** Menerima URL YouTube dan mengunduh video sumber secara lokal menggunakan `yt-dlp`.
- **Status MVP:** Berjalan baik, tetapi memiliki hambatan (_friction_) jika video sumber sangat besar/panjang (waktu tunggu unduhan lama).
- **Catatan PM:** Pengguna tidak peduli dengan proses _download_, mereka hanya peduli dengan hasil.

### B. AI Highlight Detection & Transcription

- **Apa yang dilakukan:** Memproses audio menggunakan OpenAI Whisper / Google Gemini 2.5 Flash untuk mendapatkan transkrip, lalu mencari momen penting (_highlights_).
- **Status MVP:** Cukup fungsional, mendukung dua _provider_ besar.
- **🚩 RED FLAG / Pain Point:**
  - Pengguna harus memasukkan **API Key mereka sendiri**. Ini adalah _barrier-to-entry_ (hambatan) yang sangat besar untuk aktivasi. Kreator non-teknis mungkin tidak tahu cara mendapatkan API Key.
  - _Bug Logic:_ Di `App.tsx`, meskipun AI mungkin mengembalikan beberapa _highlights_, sistem saat ini hanya memproses dan memotong **Highlight pertama (Index 0)** (`highlights[0]`). Ini menyalahi janji "mendapatkan 3 video pendek".

### C. Auto-Crop (Face Tracking) & Manual Crop

- **Apa yang dilakukan:** Memotong video lanskap (16:9) menjadi vertikal (9:16) berdasarkan _timestamp_ menggunakan OpenCV untuk memastikan wajah tetap berada di tengah layar. Mode manual juga tersedia.
- **Status MVP:** Fungsional dan menyelesaikan inti permasalahan.
- **🚩 RED FLAG / Pain Point:** Hasil _crop_ tidak dapat langsung diputar/di-_preview_ di dalam aplikasi. Pengguna hanya melihat teks _"Saved to: [path]"_. Ini mengurangi kepuasan pengguna (_aha moment_) karena mereka harus membuka _file explorer_ untuk melihat hasilnya.

---

## 4. Metrik Keberhasilan (North Star & KPI)

Karena kita baru di tahap MVP, kita harus mengukur apakah produk ini benar-benar menyelesaikan masalah pengguna sebelum menambah fitur baru.

- **North Star Metric:** **Jumlah Klip Video Berkualitas yang Dihasilkan per Minggu.** (Merepresentasikan nilai nyata yang didapatkan kreator).
- **Activation Rate:** % dari pengguna yang _install_ aplikasi $\rightarrow$ berhasil _generate_ minimal 1 klip pendek. (Saat ini kemungkinan rendah karena hambatan _API Key_).
- **Time-to-Value:** Rata-rata waktu (dalam detik) dari pengguna memasukkan _link_ URL hingga mereka melihat hasil klip pertama.
- **Retention:** % dari pengguna yang memproses video kedua di hari/minggu yang berbeda.

---

## 5. Rekomendasi Prioritas & Iterasi Selanjutnya

Berdasarkan analisis MVP saat ini, berikut adalah daftar prioritas (berbasis _Outcome over Output_) untuk iterasi selanjutnya sebelum memikirkan fitur-fitur besar baru.

> [!CAUTION]
> **Hentikan penambahan fitur baru** sebelum menyelesaikan hambatan Aktivasi (Activation) di bawah ini.

### 🔴 P0: Memperbaiki Hambatan Aktivasi (Critical)

1.  **Eksekusi Multi-Clip:** Perbaiki logika _frontend_ agar bisa menghasilkan dan memproses **semua** _highlights_ yang dideteksi AI, bukan hanya indeks pertama (`highlights[0]`).
2.  **In-App Video Player Preview:** Render tag `<video>` di dalam React _frontend_ ketika proses selesai, sehingga pengguna langsung merasakan kepuasan (_aha moment_) melihat videonya tanpa harus meninggalkan aplikasi.

### 🟡 P1: Mengurangi Hambatan (_Friction_) Pengguna

1.  **API Key Abstraction (Strategi Jangka Panjang):** Jika aplikasi ini akan diuangkan (SaaS), kita perlu menyediakan opsi di mana pengguna tidak perlu memasukkan API Key. Aplikasi yang menangani API-nya, dan pengguna membayar _subscription_ / _credits_.
2.  **Progress Bar yang Jelas:** Mengganti status "AI is Analyzing..." dengan persentase atau tahapan yang lebih informatif. Menunggu layar _loading_ tanpa estimasi waktu menyebabkan pengguna frustrasi (_churn_).

### 🟢 P2: Eksplorasi (Berdasarkan Data Penggunaan)

- _Burned-in Subtitle Styling:_ Mempercantik tampilan teks (gaya ala Alex Hormozi/MrBeast) saat proses _crop_ FFmpeg, karena kreator sangat peduli dengan estetika teks.

## 6. Apa yang TIDAK Kita Bangun (Won't Do)

- Fitur editor video manual (timeline, efek transisi kompleks). Kita bukan Premiere Pro; nilai jual kita adalah **Otomatisasi**.
- Dukungan platform selain YouTube (seperti Twitch VOD atau file lokal) **untuk saat ini**. Fokus 100% mendominasi konversi YouTube-ke-Shorts terlebih dahulu.

---

_Dibuat menggunakan pendekatan Product Manager (JTBD, Pareto, & Outcome-focused)._
