# ADR-003: Dynamic Face Tracking dan Cumulative Karaoke Subtitles

## Status
Accepted

## Date
2026-08-01

## Context
1. Pemotongan video ke format portrait (9:16, 4:5, 1:1) sebelumnya hanya menggunakan estimasi titik tengah statis (single median center) dari sampling awal. Hal ini menyebabkan subjek pembicara yang bergerak aktif terpotong atau keluar dari frame (kabur/tidak ter-highlight).
2. Subtitle dengan mode karaoke (word-by-word) sebelumnya menampilkan seluruh kata dalam satu kalimat sekaligus dengan highlight warna kuning yang sering berkedip atau tidak sinkron, bukan muncul bertahap per kata.

## Decision
1. **Dynamic Face Tracking & Panning**:
   - Menerapkan fungsi `sample_face_trajectory` untuk mendeteksi koordinat pembicara secara periodik sepanjang durasi klip.
   - Menggunakan Exponential Moving Average (`smooth_trajectory`, alpha ~0.25) guna menghasilkan pergerakan kamera (panning) yang mulus tanpa getaran (jitter).
   - Membangun ekspresi piecewise linear interpolation FFmpeg (`build_dynamic_crop_filter`) untuk menggerakkan crop window secara kontinu di level FFmpeg filter graph.
2. **Cumulative Word-by-Word Karaoke Subtitles**:
   - Memperbarui `words_to_karaoke_ass` dan `chunk_words_smartly` agar kata-kata muncul bertahap menambah kalimat (kata baru berwarna kuning `{\c&H00FFFF&}`, kata sebelumnya menjadi putih).
   - Menggabungkan jeda mikro antar kata (temporal bridging) dan menambahkan hold time di akhir kalimat agar subtitle tidak hilang terlalu cepat.

## Alternatives Considered

### Static Crop Saja
- Pros: Lebih sederhana, tidak membutuhkan ekspresi interpolasi waktu di FFmpeg.
- Cons: Pembicara sering terpotong ketika bergerak ke kiri/kanan.
- Rejected: Kualitas visual potongan video portrait sangat berkurang jika pembicara keluar dari frame.

### MediaPipe Video Face Tracking Per-Frame Eksternal
- Pros: Deteksi per-frame sangat granular.
- Cons: Menambah dependency berat baru dan waktu render per-frame yang lambat di Python.
- Rejected: Haar Cascade sampling 0.5s + EMA + FFmpeg internal expression evaluation jauh lebih cepat dan tidak membutuhkan dependensi tambahan.

## Consequences
- Kualitas klip portrait (9:16) meningkat drastis dengan kamera yang mengikuti pembicara secara smooth.
- Tampilan subtitle karaoke tampil estetik dan mudah dibaca sesuai ekspektasi gaya konten pendek (TikTok/Reels/Shorts).
- Semua tes unit terkait subtitle dan cropping lulus 100%.
