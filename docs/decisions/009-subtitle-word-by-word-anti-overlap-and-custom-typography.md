# ADR 009: Subtitle Word-by-Word Anti-Overlap Engine & Custom Typography

## Context
Sebelumnya, sistem subtitle pada Auto Clipper menggunakan format kumulatif bertahap (`words_to_karaoke_ass`) yang sering memunculkan tumpang tindih waktu (*time overlap*) antar kata atau antar *chunk* transkripsi ketika model speech-to-text (Whisper) menghasilkan timestamp dengan durasi yang saling beririsan atau ketika jeda hold time (+0.35s) ditambahkan di akhir kalimat. Hal ini menyebabkan efek glitch teks ganda (duplikasi visual) pada video vertikal yang dirender.

Selain itu:
1. Pemilihan gaya subtitle (`standard` vs `karaoke`) sebelumnya diputuskan secara implisit berdasarkan ekstensi file input (`.srt` vs `.json`), bukan berdasarkan kontrol eksplisit dari pengguna.
2. Pengguna tidak memiliki opsi kustomisasi tipografi (pemilihan font family, font size, font weight, huruf kapital, warna teks, dan margin posisi vertikal).
3. Transkripsi Whisper standar sebelumnya hanya menghasilkan file `.srt` jika opsi karaoke tidak aktif, sehingga menyulitkan transisi antar mode tanpa transkripsi ulang.

## Decision

1. **Anti-Overlap Flat-List Invariant (`end_i <= start_{i+1}`)**:
   - Seluruh kata dari berbagai chunk transkripsi diratakan menjadi satu daftar tunggal (*flat list*) sebelum diproses.
   - Durasi aktif suatu kata dibatasi secara tegas agar tidak pernah melebihi awal mula kata berikutnya:
     `t_end = min(t_start + duration + hold, next_start)`
   - Jika timestamp sumber memiliki `next_start <= t_start`, `next_start` dipaksa maju secara linear untuk mencegah glitch duplikasi visual.
   - Kata ditampilkan tunggal (*single-word pop*) di layar, memberikan keterbacaan yang fokus dan dinamis untuk format video pendek (Shorts/Reels/TikTok).

2. **Word-to-Sentence Reconstruction (`words_to_standard_ass`)**:
   - Menambahkan fungsi rekonstruksi kalimat baris natural dari daftar kata ber-timestamp.
   - Kata-kata dikelompokkan secara otomatis berdasarkan jeda hening (*silence threshold*) dan tanda baca akhir kalimat.

3. **Skema Tipografi & Format Warna ASS**:
   - Format warna primer subtitle ASS dikonversi ke format 8-digit hex BGR: `&H00BBGGRR`.
   - Bobot font disederhanakan dan distandarkan: `bold` (`Bold=-1`) dan `normal` (`Bold=0`).
   - Ukuran font (`small`, `medium`, `large`, `xlarge`) diskalakan secara proporsional terhadap resolusi video (`PlayResY`).
   - Mendukung transformasi teks huruf kapital (*uppercase*) dan penyesuaian posisi vertikal (`top`, `middle`, `bottom`).

4. **Universal Word-Level Transcription & Mode Dispatch**:
   - Modul `backend/ai_utils.py` selalu mengekstrak word-level timestamps dan menyimpan file `.words.json` di setiap proses transkripsi Whisper.
   - Mode perenderan subtitle di `backend/crop_utils.py` sepenuhnya ditentukan oleh properti `subtitle_config.style` (`karaoke` vs `standard`), bukan ekstensi file.

5. **Persistensi Metadata Subtitle Lintas Pipeline**:
   - Objek `subtitle_config` dipropagasikan secara konsisten pada seluruh endpoint FastAPI (`create_job`, `create_manual_job`, `create_rerender_job`, `create_rerun_ai_job`, `create_resume_job`, `resume_manual_job`).
   - Konfigurasi disimpan ke SQLite (`history.db`) dan dimuat kembali saat re-render atau resume job.

## Consequences

- **Positif**: Visual subtitle karaoke tampil bersih, presisi, tanpa duplikasi visual atau flicker overlap.
- **Positif**: Pengguna memiliki kendali penuh atas estetika tipografi video dengan Live Preview interaktif di antarmuka web.
- **Positif**: Fleksibilitas mengubah gaya subtitle (karaoke/standard) pada re-render tanpa perlu mengunduh atau mentranskripsi ulang video.
- **Positif**: Kompatibilitas mundur terjaga untuk job lama melalui fallback `DEFAULT_SUBTITLE_CONFIG`.
