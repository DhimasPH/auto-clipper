# ADR 007: Struktur Workspace Berbasis Folder Proyek dan Reference-Safe Deletion

## Context
Sebelumnya, semua file unduhan video sumber, file audio transkripsi, subtitle ASS, serta potongan video b-roll dicampur dalam direktori flat `temp_downloads/`. Pengguna dapat memasukkan judul proyek opsional, namun input ini tidak digunakan untuk mengorganisasi file ke subfolder terpisah.

Hal ini menimbulkan dua masalah kritis:
1. **Pencampuran & Penumpukan File**: Seluruh artefak proyek bercampur di folder root `temp_downloads/` sehingga sulit dinavigasi dan rentan konflik penamaan.
2. **Penghapusan Berbahaya pada Re-render / Multi-job**: Saat pengguna me-rerender job atau membuat job baru dari video sumber yang sama, lalu menghapus salah satu job dari history, fungsi `delete_job_and_clips()` sebelumnya menghapus file video sumber dan file subtitle secara sepihak. Akibatnya, job lama atau job hasil re-render kehilangan file sumbernya dan tidak dapat diproses/di-rerender kembali.

## Decision
1. **Mandatory Project Title (Judul Proyek Wajib)**:
   - Menjadikan `title` sebagai parameter wajib (*mandatory*) di semua alur pembuatan job baru (`/jobs`, `/jobs/manual`, serta form UI di frontend).
   - Melakukan validasi non-empty string di sisi frontend (React) dan backend (FastAPI).
   - Karakter dalam judul proyek disanitasi menggunakan `sanitize_title()` untuk menjamin kompatibilitas nama folder di seluruh sistem operasi.

2. **Struktur Workspace Terorganisir (`get_project_workspace`)**:
   - Setiap job baru dialokasikan ke struktur folder terisolasi:
     - `{output_dir}/{safe_title}/source/`: File video sumber (`source.mp4`)
     - `{output_dir}/{safe_title}/subtitles/`: File transkripsi dan subtitle ASS (`transcript.ass`, `transcript_karaoke.ass`, `transcript.json`)
     - `{output_dir}/{safe_title}/clips/`: Hasil klip video yang di-render (`clip_1.mp4`, dll.)
     - `{output_dir}/{safe_title}/broll/`: Download video B-roll / overlay pendukung
   - Semua alur eksekusi job (`_run_job`, `_run_manual_job`, `_run_rerender_job`, `_run_rerun_ai_job`) menggunakan helper `get_project_workspace()` untuk memastikan konsistensi path.

3. **Pewarisan Metadata pada Re-render / Re-run AI**:
   - Pembuatan job re-render (`create_rerender_job`) dan re-run AI (`create_rerun_ai_job`) mewarisi `title` dan `output_dir` dari metadata job induk.
   - Job re-render menggunakan ulang video sumber dan subtitle yang ada di folder proyek induk tanpa mengunduh atau mengekstrak ulang.

4. **Reference-Safe Deletion di Database (`backend/db.py`)**:
   - Sebelum menghapus file video sumber (`video_source_path` / `url`) atau file subtitle dari disk saat sebuah job dihapus, sistem memeriksa apakah ada job lain di `history.db` yang masih mereferensikan path file yang sama (`is_source_used_by_other_jobs`).
   - File fisik hanya dihapus jika tidak ada job lain yang masih menggunakannya.
   - File klip spesifik milik job tersebut (`clips/*.mp4`) tetap dihapus sesuai kepemilikannya.

## Alternatives Considered
- **Tetap Opsional dengan Default Timestamp / Random ID**: Ditolak karena pengguna tetap kesulitan menemukan folder hasil render dan judul proyek tetap tidak teratur.
- **Salin Ulang File Sumber untuk Setiap Job**: Ditolak karena menghabiskan ruang penyimpanan disk pengguna secara drastis saat melakukan re-render berkali-kali.

## Consequences
- **Positif**: Folder output menjadi sangat rapi dan mudah diatur oleh pengguna berdasarkan judul proyek.
- **Positif**: Operasi re-render dan penghapusan job riwayat menjadi aman dari risiko kehilangan file sumber (*reference-safe*).
- **Positif**: Mengurangi penggunaan bandwidth dan waktu proses karena data sumber digunakan kembali secara optimal.
- **Negatif / Perhatian**: Pengguna wajib mengisi judul proyek setiap kali membuat job baru, yang kini diakomodasi dengan validasi UI yang jelas dan default auto-fill pada input manual file.
