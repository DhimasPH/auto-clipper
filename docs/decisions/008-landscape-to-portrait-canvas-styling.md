# ADR 008: Landscape-to-Portrait Canvas Background Styling & Foreground Zoom

## Context
Sebelumnya, saat memproses video lanskap (16:9), Auto Clipper hanya mendukung satu mode cropping yaitu *Dynamic Face-Tracking Crop* yang memotong video menjadi 9:16 dengan mengikuti posisi wajah pembicara.

Namun pada beberapa skenario konten, cropping ketat 9:16 merusak konteks video:
1. **Podcast Multi-Host / Interview**: Ketika dua orang duduk bersebelahan, face tracking melompat-lompat atau memotong salah satu pembicara.
2. **Video Edukasi & Presentasi**: Video yang memuat slide, kode pemrograman, diagram, atau grafik horizontal terpotong teks pentingnya jika dipotong vertikal.
3. **Gameplay / Stream Replay**: Elemen UI game (HUD, minimap, health bar) yang tersebar di sisi kiri/kanan layar hilang total.

Pengguna membutuhkan fleksibilitas untuk mempertahankan rasio penuh 16:9 di dalam kanvas vertikal 9:16 dengan latar belakang estetis (*blurred background*, *solid color*, atau *custom image*) serta kontrol pembesaran (*foreground zoom/enlarge*).

## Decision

1. **Skema Data Konfigurasi Kanvas (`CanvasConfig`)**:
   - Didefinisikan model Pydantic pada backend dan interface TypeScript pada frontend:
     - `enabled: bool = False`: Menandai apakah mode canvas aktif.
     - `background_type: Literal["blur", "color", "image"] = "blur"`: Tipe latar belakang.
     - `blur_level: Literal["light", "medium", "heavy"] = "medium"`: Kekuatan filter blur.
     - `color: str = "#000000"`: Warna hex solid.
     - `image_path: str = ""`: Berkas gambar lokal untuk background.
     - `enlarge_scale: float = 1.0`: Faktor skala zoom video foreground (1.0x s/d 2.0x).

2. **FFmpeg Complex Filtergraph (`build_canvas_background_filter`)**:
   - **Split Stream Pipeline**:
     - *Background Stream*: Video input di-scale dan di-crop menjadi 1080x1920, lalu diberi filter `boxblur=10:5` (light), `boxblur=25:10` (medium), atau `boxblur=50:20` (heavy). Jika menggunakan warna solid, dibuat canvas sintetis dengan `color=c=0x...:s=1080x1920`. Jika gambar lokal, dimuat via input `movie=...`.
     - *Foreground Stream*: Video input di-scale secara proporsional sesuai `enlarge_scale` (misal 1080x608 untuk 1.0x).
     - *Overlay*: Stream foreground ditempatkan di titik pusat `(W-w)/2:(H-h)/2`.

3. **Adaptive Subtitle Positioning (Margin Penempatan Teks)**:
   - Pada mode kanvas dengan video 16:9 di tengah frame 9:16, terdapat ruang kosong yang luas di area atas dan bawah video.
   - Posisi vertikal subtitle ASS disesuaikan secara otomatis (`MarginV` disesuaikan atau dinaikkan) sehingga teks subtitle karaoke muncul rapi di area bawah kanvas tanpa menumpuk di atas visual video foreground.

4. **Integritas Persistensi Metadata di Semua Pipeline**:
   - `canvas_config` dipropagasikan secara utuh pada semua endpoint pembuatan job:
     - `/jobs` (Auto AI)
     - `/jobs/manual` (Manual Downloader)
     - `/jobs/{job_id}/rerender` (Re-render)
     - `/jobs/{job_id}/rerun-ai` (Rerun AI)
     - `/jobs/{job_id}/resume` & `/jobs/{job_id}/resume-manual` (Resume Job dari History)
   - Metadata `canvas_config` disimpan ke `history.db` dan dimuat ulang saat job dilanjutkan, menjamin tidak ada konfigurasi visual yang hilang saat perenderan ulang.

## Consequences

- **Positif**: Kreator memiliki kebebasan penuh untuk memilih antara *Smart Face-Tracking Crop* atau *Canvas Background Styling* sesuai jenis konten mereka.
- **Positif**: Visual video 16:9 tetap utuh 100% tanpa kehilangan informasi grafis atau teks presentasi.
- **Positif**: Penempatan subtitle karaoke lebih estetis dan tidak menutupi fokus visual utama video.
- **Perhatian Performa**: Filter `boxblur` pada FFmpeg CPU memerlukan alokasi komputasi tambahan dibandingkan cropping sederhana; integrasi NVENC hardware acceleration tetap diprioritaskan dengan fallback otomatis ke CPU (`libx264`).
