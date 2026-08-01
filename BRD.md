# Business Requirements Document (BRD) - Auto Clipper

## 1. Executive Summary
Auto Clipper adalah aplikasi desktop yang dirancang untuk mengotomatisasi proses pembuatan video pendek (Shorts, Reels, TikTok) dari video berdurasi panjang, baik melalui link YouTube maupun berkas lokal. Solusi ini mengurangi waktu editing hingga 90% dengan memanfaatkan AI untuk menyeleksi momen, melacak wajah (face-tracking), membuat subtitle secara otomatis, hingga meracik metadata (judul, deskripsi, tag) yang siap pakai.

## 2. Business Objectives
- **Efisiensi Waktu**: Mengurangi waktu yang dibutuhkan kreator konten untuk mengubah format video dari hitungan jam menjadi hitungan menit.
- **Peningkatan Produktivitas**: Memungkinkan streamer, podcaster, dan pembuat konten untuk memproduksi lebih banyak konten turunan (*repurposed content*) tanpa perlu menyewa editor video khusus.
- **Aksesibilitas & Keterjangkauan**: Menyediakan solusi lokal (*on-premise*) dengan pemrosesan di komputer sendiri yang tidak bergantung pada biaya langganan SaaS (Software as a Service) bulanan yang mahal.
- **Jangkauan Global**: Mendukung multi-bahasa (awalnya Bahasa Inggris dan Indonesia) pada antarmuka aplikasi untuk memperluas target pasar secara global.

## 3. Target Audience
- **Content Creators / YouTubers**: Mereka yang membuat video panjang dan butuh *teaser* untuk platform video pendek.
- **Streamers (Twitch/YouTube)**: Membutuhkan cara instan untuk mengambil *highlight* dari siaran langsung (live stream) yang berdurasi panjang, baik yang sudah tayang maupun rekaman lokal.
- **Podcasters**: Ingin membagikan momen penting dari obrolan panjang mereka.
- **Digital Marketers / Agencies**: Tim yang ingin mendaur ulang aset video perusahaan atau klien menjadi materi promosi di media sosial dengan metadata yang sudah disiapkan AI.

## 4. Market Needs & Problem Statement
**Problem:** Proses *repurposing* video lanskap (16:9) menjadi video vertikal (9:16) secara manual sangat memakan waktu. Editor harus mencari momen yang tepat ("momen emas"), memotong klip, mengatur pergerakan kamera agar wajah narasumber tidak keluar dari *frame* (keyframing), mengetik subtitle satu per satu, dan memikirkan *copywriting* untuk media sosial.

**Solution:** Auto Clipper mengambil alih seluruh beban kerja ini. Hanya dengan memberikan sumber video (URL atau berkas lokal), aplikasi akan secara otomatis memotong, merender, dan membekali klip dengan transkripsi presisi serta metadata yang relevan.

## 5. Scope & Limitations
- **In-Scope**: 
  - Unduhan otomatis dari YouTube atau input video lokal.
  - Deteksi *highlight* via AI (LLM) dengan dukungan *retry logic* untuk akurasi optimal.
  - Pemotongan video (*cropping*) 9:16 otomatis menggunakan algoritma Face-Tracking.
  - Generasi subtitle presisi dengan teknologi Whisper (*burned-in*).
  - Penyesuaian batas klip secara manual bagi kreator yang membutuhkan penyesuaian akhir (*fine-tuning*).
  - Generasi metadata sosial (Title, Description, Tags).
  - Berjalan secara lokal (*on-premise*) sebagai desktop app.
- **Out-of-Scope**: 
  - Cloud rendering secara penuh.
  - Integrasi publikasi langsung/otomatis ke akun media sosial (auto-post melalui API platform).
  - Pengeditan *timeline* manual layaknya NLE profesional (Premiere Pro/DaVinci).

## 6. Business Value & ROI
Bagi pengguna, pengembalian investasi (ROI) diukur dari penghematan biaya editor dan waktu rilis. Pekerjaan yang sebelumnya membutuhkan waktu lebih dari 2 jam per video (termasuk rendering dan copywriting) dapat diselesaikan dalam hitungan menit secara otomatis, dijalankan dengan infrastruktur komputasi milik pengguna sendiri tanpa batasan kuota.
