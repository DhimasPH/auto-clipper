## Ringkasan

SP0 "Pipeline andal dan cepat" (v1.18.0). Video YouTube 30 menit dengan 10 klip di Google Colab T4 sebelumnya tidak pernah selesai: unduhan ditolak YouTube, subtitle jatuh ke prosesor, lalu runtime terputus. Sekarang job itu selesai dalam sekitar 12 menit waktu mesin.

Diukur di Colab T4, 2026-11-18 (rincian di `docs/superpowers/specs/2026-11-12-pipeline-stability-design.md` bagian 7):

| Tahap | Sebelum | Sesudah |
|---|---|---|
| Unduh | Gagal "Sign in to confirm you're not a bot" | 14 dtk (dengan `cookies.txt`) |
| Subtitle (Whisper `medium`) | Prosesor, belum selesai setelah 24 menit | 2 menit di GPU |
| Tracking wajah, 10 klip | 13,1 menit | 4,5 menit |
| Render, 10 klip | Prosesor (uji NVENC salah) | 5 menit di GPU (NVENC) |

## Perubahan utama

- **Error yang bisa ditindaklanjuti**: `AppError` dengan kode dan pesan awam (id + en), kartu error di desktop dan web.
- **Cookies YouTube**: unggah, validasi, status, dan hapus `cookies.txt`; strategi client yt-dlp dengan Deno/EJS.
- **Detail waktu** per tahap dan perangkat yang benar-benar dipakai (`metadata["timings"]`).
- **Antrean job**: satu job berat sekaligus, job berikutnya "Menunggu giliran".
- **Pemeriksaan awal** (`GET /api/preflight`, `scripts/colab_preflight.py`): FFmpeg, disk, RAM, GPU, pustaka GPU Whisper, encoder GPU, Drive, Deno, umur yt-dlp.
- **Colab**: disk kerja lokal `/content/work` dengan publish atomik ke Drive, `history.db` lokal dengan snapshot ke Drive, job ditolak bila Drive belum ter-mount, notebook dengan Deno, pustaka GPU Whisper, dan kolom `BRANCH`.
- **Pelacakan wajah satu kali baca** lewat FFmpeg (2,9× lebih cepat di T4, hasil identik).
- **Unduhan bawaan** H.264 ≤ 1080p; FFmpeg 6.1 di installer Windows agar NVENC jalan.

## Keamanan

- `/upload`, `/save_file`, `/video`, `/api/thumbnails`, `/api/extract-metadata` tidak lagi bisa membaca atau menimpa `cookies.txt`, `history.db`, dan log (`backend/path_guard.py`). `/upload` sebelumnya bisa menulis ke luar folder unggahan di Windows.
- Kunci API tidak lagi disimpan di `history.db` (yang dicadangkan ke Drive); data lama dibersihkan saat aplikasi dibuka.
- Belum ditutup, masuk SP1: `/video` tidak memerlukan token.

## Pengujian

- `pytest backend/tests`: 694 lulus, 7 dilewati (butuh FFmpeg atau symlink).
- `npm run build` desktop dan web: exit 0. `npm run lint` web: exit 0 (3 peringatan lama).
- Diuji di Colab T4 oleh pemilik: unduh dengan cookies, transkripsi GPU, render NVENC, job 30 menit sampai selesai, Rerender All dari web.

## Belum diverifikasi

- Notebook dari runtime Colab yang benar-benar baru, termasuk: riwayat setelah runtime dihapus, antrean dari dua tab, dan sel server tanpa Langkah 1 (T0.13).
- Cek manual tampilan kartu error, panel cookies, dan Detail waktu di kedua frontend (T0.12).
- Build Windows lewat GitHub Actions dengan FFmpeg 6.1, dan subtitle GPU di desktop Windows (pustaka cuBLAS belum dibundel; direncanakan sebagai paket GPU opsional di SP3).

Keputusan arsitektur: ADR-012. Status task: `tasks/roadmap-todo.md`, log kerja: `tasks/PROGRESS-LOG.md`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
