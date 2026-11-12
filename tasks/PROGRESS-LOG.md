# Log Progres dan Cara Melanjutkan

Dokumen ini dibaca pertama kali oleh sesi baru. Daftar task ada di `tasks/roadmap-todo.md`, spec di `docs/superpowers/specs/2026-11-12-pipeline-stability-design.md`.

## Protokol kuota sesi 5 jam

Preferensi pemilik: saat pemakaian sesi 5 jam mencapai sekitar 80%, pekerjaan berhenti, hasilnya di-commit, dan log ini diperbarui supaya bisa dilanjutkan setelah kuota reset.

Catatan teknis: Claude tidak bisa membaca persentase kuota. Pemilik yang menyebutkan angkanya ("sudah 80%"), atau mengetik `/usage` lalu memberi tahu. Sampai itu terjadi, aturan pengaman berlaku:

1. Setiap kali satu task selesai dan tesnya lulus, buat commit di branch kerja dan perbarui log ini.
2. Saat pemilik bilang kuota sudah 80% atau "stop dulu": hentikan agen yang berjalan, jalankan `pytest backend/tests`, commit sebagai `wip(sp0): ...` bila belum hijau, dan tulis entri baru di bawah.
3. Jangan pernah mencentang task di `roadmap-todo.md` tanpa hasil tes yang benar-benar dijalankan.

## Cara melanjutkan di sesi baru

1. `git checkout feat/sp0-pipeline-stability` lalu `git log --oneline -10` dan `git status`.
2. Baca entri terakhir di bawah, lalu `tasks/roadmap-todo.md`.
3. Jalankan `pytest backend/tests`. Catat hasilnya sebagai baseline sesi itu.
4. Lanjutkan task pertama yang belum `[x]`, dengan TDD dan aturan di `.agents/AGENTS.md`.
5. Python tidak ada di PATH Git Bash di mesin pemilik. Cari interpreter (`py -3`, PowerShell `Get-Command python,py`) atau venv yang dibuat agen sebelumnya.

## Entri

### 2026-11-12 · titik simpan pertama (WIP, belum diverifikasi)

Dikerjakan oleh agen Fable (effort high) di branch `feat/sp0-pipeline-stability`. Agen masih berjalan saat entri ini ditulis dan belum memberi laporan akhir.

Bukti dari repo saat commit ini dibuat:

| Task | Yang ada di repo | Yang belum diketahui |
|---|---|---|
| T0.1 `stage_timer` | `backend/stage_timer.py`, `test_stage_timer.py`, `test_pipeline_timings.py`, perubahan di `jobs.py` | Hasil tes |
| T0.2 skrip benchmark | `scripts/benchmark_pipeline.py`, `test_benchmark_script.py` | Hasil tes. Pengukuran di Colab belum dilakukan `[!]` |
| T0.3 error terstruktur | `backend/errors.py`, `test_errors.py`, `test_error_integration.py` | Hasil tes |
| T0.4 antrean job | `backend/job_queue.py`, `test_job_queue.py`, `test_jobs_queue_integration.py` | Hasil tes, cakupan semua titik pembuatan thread |
| T0.5 mediapipe | perubahan di `crop_utils.py` dan `test_crop_utils.py` | Hasil tes |
| T0.6 format unduhan | perubahan di `video_utils.py` dan `test_video_utils.py` | Hasil tes |
| T0.7 preflight | `backend/preflight.py` baru muncul, kemungkinan belum lengkap | Endpoint, tes, dan integrasi ke job |

Hal yang perlu diperiksa sesi berikutnya:

- **Tidak ada task yang dicentang** di `roadmap-todo.md`. Centang hanya setelah tes dijalankan dan lulus.
- `backend/crop_utils.py` menunjukkan ±478 baris berubah. Jalankan `git diff -w --stat backend/crop_utils.py` untuk memastikan itu bukan sekadar perubahan akhir baris (CRLF/LF). Jika iya, kembalikan agar riwayat diff bersih.
- Baseline tes sebelum perubahan agen belum kuketahui. Jika ada tes gagal, bandingkan dengan `git stash` atau commit `072164d`.
- Fase 3 sampai 5 (T0.8–T0.15) belum disentuh. T0.2 dan T0.14 butuh sesi Colab pemilik.

Langkah berikutnya yang disarankan: verifikasi T0.1–T0.7 dengan tes nyata, centang yang valid, lalu mulai Fase 3 (T0.8 workspace lokal).
