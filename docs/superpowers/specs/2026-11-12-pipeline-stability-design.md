# Spec SP0: Pipeline Andal dan Cepat

Tanggal: 2026-11-12 · Status: draft untuk review · Induk: `2026-11-12-enhancement-roadmap.md`

## 1. Masalah

Memproses video YouTube 30 menit di Google Colab lambat sekali lalu gagal. Gejala yang dilaporkan: runtime terputus atau proses mati dengan `-9` (kehabisan RAM), terutama dengan opsi mediapipe. Selain itu `yt-dlp` sering error "Sign in to confirm you're not a bot". Pengguna awam tidak mendapat petunjuk apa pun saat itu terjadi.

## 2. Temuan analisis

Semua temuan di bawah berasal dari membaca kode dan **belum terukur**. Task T0.1 dan T0.2 mengubahnya menjadi angka. Status: `Dugaan` sampai terbukti.

| # | Temuan | Lokasi | Status |
|---|---|---|---|
| F1 | Workspace default Colab adalah `/content/drive/MyDrive/AutoClipperData`. Video sumber, audio, klip, dan `history.db` semuanya lewat mount Drive. Seek acak dan `-movflags +faststart` di atas Drive sangat lambat, dan klien Drive memakai RAM. | `backend/colab_api.py:20` | Dugaan kuat |
| F2 | Unduhan default `bestvideo[ext=mp4]` tanpa batas tinggi. YouTube menyajikan AV1 dalam kontainer mp4 dan yt-dlp memprioritaskannya, sehingga file bisa AV1 1440p/4K yang sangat lambat di-decode di 2 vCPU. | `backend/video_utils.py:70-80` | Dugaan |
| F3 | Pelacakan wajah men-seek video sumber untuk tiap sampel (±121 `cap.set(POS_MSEC)` per klip 60 detik). Tiap seek men-decode dari keyframe terdekat. | `backend/crop_utils.py:133-190`, `:286-292` | Dugaan kuat |
| F4 | Instance `FaceMesh` dibuat ulang untuk setiap klip (`max_num_faces=5`, `refine_landmarks=True`). `close()` tidak dipanggil bila terjadi exception. Beberapa versi mediapipe bocor memori saat instance dibuat berulang. | `backend/crop_utils.py:161-215` | Dugaan |
| F5 | Kegagalan mediapipe ditelan `except Exception: pass`, lalu seluruh sampling diulang dengan Haar. Waktu berlipat dan tidak ada jejak. | `backend/crop_utils.py:271-273` | Terbukti dari kode |
| F6 | Tidak ada batas job paralel. Tiap job membuat thread sendiri. Dua job (atau klik Resume dua kali) berarti dua Whisper dan dua tracking bersamaan di RAM 12 GB. | `backend/jobs.py:161`, `:239`, `:281`, `:1081`, `:1280`, `:1546`, `:1645` | Terbukti dari kode |
| F7 | Whisper memilih `device="auto"` dan jatuh ke CPU hanya dengan satu baris log. Di CPU, model `medium`/`large-v3` untuk 30 menit audio bisa puluhan menit. | `backend/ai_utils.py:595-616` | Dugaan |
| F8 | Notebook memakai `apt install ffmpeg` biasa dan mengklaim NVENC. Colab biasanya tidak mengekspos NVENC, jadi render memakai `libx264` di CPU. Mode hook merender tiap klip tiga kali. | `Auto_Clipper_Colab.ipynb`, `backend/jobs.py:561-602` | Dugaan |
| F9 | Tidak ada waktu per tahap, sehingga tidak ada yang bisa membuktikan F1-F8. | seluruh pipeline | Terbukti |
| F10 | Downloader merotasi client `ios → tv → web_creator → android` tanpa cookies, tanpa JS runtime. Error "sign in / bot" langsung pindah client, lalu error mentah dilempar ke UI. UI tidak punya cara memasukkan cookies. | `backend/video_utils.py:150-185` | Terbukti dari kode |
| F11 | Notebook hanya menjalankan `pip install -U yt-dlp`. Panduan terbaru yt-dlp menyebut Deno diperlukan untuk menyelesaikan tantangan JS YouTube. | `Auto_Clipper_Colab.ipynb` | Dari sumber luar |

Catatan: jalur mediapipe hanya dipakai pada video non-gaming. Pada mode gaming `job_layout` terisi sehingga `engine` diabaikan dan crop statis.

## 3. Sasaran dan non-sasaran

Sasaran:

- Video 30 menit selesai di Colab gratis (T4) tanpa `-9` dan tanpa runtime terputus.
- Setiap job menghasilkan laporan waktu dan RAM per tahap.
- Error unduhan selalu berupa pesan yang bisa ditindaklanjuti oleh pengguna awam.
- Tidak ada lagi fallback yang diam-diam (GPU, NVENC, mediapipe).

Non-sasaran (sengaja ditunda):

- Pelacakan wajah satu-kali-baca via FFmpeg (pendekatan B) dan proxy 720p (pendekatan C). Diputuskan setelah ada angka dari T0.14.
- Revamp UI, web lokal, dan fitur baru.
- PO Token provider (`bgutil`). Ditambahkan hanya jika data menunjukkan masih perlu.

## 4. Desain

### 4.1 Workspace lokal dan publish ke Drive

- Variabel `AUTO_CLIPPER_WORK_DIR` menentukan disk kerja. Di Colab notebook mengaturnya ke `/content/work`. Di desktop dan web lokal default-nya tidak berubah.
- Semua file antara (video sumber, audio, subtitle kerja, klip sementara) ditulis ke work dir.
- Setelah job sukses, `publish` menyalin klip akhir, file subtitle kata, dan metadata ke direktori pustaka (Drive di Colab). Penyalinan memakai nama sementara lalu rename, agar file setengah jadi tidak terlihat.
- Jika Drive tidak ter-mount, job tetap berjalan dan UI menampilkan peringatan jelas, tidak gagal diam-diam.
- Resume setelah runtime mati mengunduh ulang video sumber (fallback re-download sudah ada). Aturan ini tertulis di panduan pengguna.

### 4.2 `history.db` lokal dengan cadangan ke Drive

- `history.db` dipindah ke work dir (SQLite di atas FUSE lambat dan berisiko rusak).
- Snapshot dibuat dengan API backup SQLite ke Drive pada setiap perubahan status job, dengan pembatasan frekuensi (maksimal sekali per beberapa detik).
- Saat startup, jika `history.db` lokal tidak ada tetapi snapshot ada, snapshot dipulihkan.
- Invarian `AGENTS.md` bagian E (resume tidak mengunduh ulang bila file tersedia, memakai ulang transkripsi dan highlight dari DB) tetap berlaku.

### 4.3 Antrean job

- Modul `job_queue` memegang satu slot untuk tahap berat (transkripsi, tracking, render). Jumlah slot dari `AUTO_CLIPPER_MAX_HEAVY_JOBS` (default 1; desktop boleh lebih besar).
- Semua titik pembuatan thread di `jobs.py` mengantre lewat modul ini. Status job mendapat `queue_position`. Pembatalan job yang masih mengantre langsung membuangnya.
- Menekan Resume pada job yang sudah berjalan ditolak dengan pesan jelas.

### 4.4 Laporan waktu (`stage_timer`)

- Context manager mencatat `{stage, seconds, rss_mb_peak}` untuk: unduh, ekstrak audio, transkripsi, analisis AI, tracking wajah, render per klip, publish.
- Hasilnya disimpan di `metadata["timings"]`, ditulis ke log (via `log_app`, tidak ke stdout) dan ditampilkan di UI sebagai "Detail waktu".
- Termasuk keterangan perangkat yang benar-benar dipakai: `whisper_device`, `encoder`, `tracking_engine_used`.

### 4.5 Pengecekan awal (`preflight`)

Endpoint `GET /api/preflight` mengembalikan daftar `{id, level: ok|warn|block, title, message, action?}` untuk: GPU (CUDA ctranslate2 tersedia), NVENC, FFmpeg, ruang disk, RAM, Drive ter-mount, Deno, versi yt-dlp. Dijalankan saat startup dan sebelum job dimulai. `block` menghentikan job dengan pesan jelas. `warn` hanya ditampilkan (contoh: "GPU tidak aktif, transkripsi akan jauh lebih lambat").

### 4.6 Unduhan dan downloader

- Selektor format default dibatasi: H.264 (`vcodec^=avc1`) mp4 hingga 1080p. Opsi resolusi lebih tinggi tetap ada, tetapi pilihan "terbaik" tidak lagi berarti AV1 4K.
- `cookies.txt`: endpoint untuk unggah, validasi, status, dan hapus. File disimpan di app data lokal, tidak pernah dikirim ke mana pun selain yt-dlp. Validasi memeriksa format Netscape, keberadaan domain `youtube.com`, dan masa berlaku.
- Rotasi client dihentikan. Urutan: default yt-dlp, lalu client yang tidak butuh PO Token (`web_embedded`, `android_vr`) sebagai cadangan.
- Deno dipasang di notebook Colab dan komponen EJS diaktifkan. Preflight melaporkan jika Deno tidak ada.
- `classify_download_error(exc)` memetakan error yt-dlp ke kode terstruktur (lihat 4.7).

### 4.7 Model error terstruktur

Backend menghasilkan `AppError` yang diserialisasi ke `job["error_info"]`:

```json
{
  "code": "YT_SIGNIN_REQUIRED",
  "title": "YouTube meminta verifikasi",
  "message": "Ini sering terjadi di Colab karena YouTube curiga pada lokasi servernya.",
  "actions": [
    {"id": "upload_cookies", "label": "Unggah cookies.txt"},
    {"id": "upload_video", "label": "Unggah file video langsung"}
  ],
  "technical": "<pesan asli, untuk laporan bug>"
}
```

Kode awal: `YT_SIGNIN_REQUIRED`, `YT_RATE_LIMITED`, `VIDEO_UNAVAILABLE`, `VIDEO_TOO_LONG`, `OUT_OF_MEMORY`, `NO_GPU_SLOW`, `DRIVE_NOT_MOUNTED`, `DISK_FULL`, `AI_KEY_INVALID`, `UNKNOWN`. Judul dan pesan ditulis dalam bahasa awam dan mengikuti i18n (id dan en). Kedua frontend (`src/` dan `web/`) cukup merender satu kartu error generik dan tombol aksi. Panduan unggah cookies di UI berisi peringatan: pakai akun cadangan, bukan akun utama.

### 4.8 Perbaikan pelacakan wajah (mediapipe)

- `FaceMesh` dibuat sekali per panggilan dan ditutup di blok `finally`.
- Kegagalan mediapipe dicatat dengan alasan (`log_error`) dan engine yang benar-benar dipakai ditulis ke hasil. Pengguna melihat catatan "Pelacakan wajah memakai mode standar".
- Sampling tidak diulang dari awal tanpa alasan: bila mediapipe gagal setelah sebagian frame, bagian yang sudah dibaca dipakai ulang oleh jalur Haar.
- Tidak ada perubahan algoritma pelacakan di SP0. Optimasi algoritmik (pendekatan B) menunggu data.

## 5. Kepatuhan terhadap aturan repo

- Tidak ada `print()` ke stdout di backend (handshake sidecar bergantung pada stdout).
- Semua error lewat `log_error(err, context=...)`. Error frontend lewat `POST /log-error`.
- `canvas_config` dan `subtitle_config` tetap dipropagasi di semua pembuatan job.
- Invarian CORS (ADR-011) tidak berubah.
- Perubahan menyentuh dua frontend hanya untuk kartu error dan unggah cookies, dan keduanya generik.

## 6. Pengujian

- Uji unit: `classify_download_error`, validasi `cookies.txt`, `job_queue`, publish ke Drive dan pemulihan snapshot (direktori sementara), `preflight` dengan mock, pemilihan format unduhan, dan penutupan `FaceMesh` pada exception.
- Skrip benchmark `scripts/benchmark_pipeline.py` dan satu sel Colab opsional: memproses video 30 menit lalu mencetak tabel waktu dan RAM per tahap.
- Pengukuran dasar dilakukan sebelum perubahan performa (T0.2) dan diulang sesudahnya (T0.14). Angkanya dicatat di dokumen ini pada bagian 7.

## 7. Hasil ukur (diisi setelah T0.2 dan T0.14)

| Tahap | Sebelum | Sesudah |
|---|---|---|
| Unduh | belum diukur | belum diukur |
| Transkripsi | belum diukur | belum diukur |
| Tracking wajah (per klip) | belum diukur | belum diukur |
| Render (per klip) | belum diukur | belum diukur |
| RAM puncak | belum diukur | belum diukur |

Keputusan gerbang: jika sesudah A tracking wajah masih mendominasi waktu, pendekatan B dijadwalkan. Jika tidak, B dipindah ke SP3 sebagai optimasi opsional.

## 8. Risiko

- YouTube dapat mengubah perilaku kapan saja, jadi `cookies.txt` dan Deno mengurangi, bukan menghilangkan, kegagalan. Jalur unggah file video selalu tersedia sebagai jalan keluar.
- Akun yang dipakai untuk cookies dapat dibatasi YouTube. Peringatan wajib tampil di UI.
- Memindahkan `history.db` ke lokal mengubah titik persistensi. Pemulihan snapshot harus diuji, termasuk skenario runtime mati di tengah job.
- Pengukuran butuh sesi Colab nyata milik pemilik proyek. T0.2 dan T0.14 membutuhkan aksi dari pemilik.
