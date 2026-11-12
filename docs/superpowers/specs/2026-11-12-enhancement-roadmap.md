# Roadmap Peningkatan Auto Clipper

Tanggal: 2026-11-12 · Status: draft untuk review · Dokumen ini adalah peta induk. Setiap sub-proyek punya spec, plan, dan siklus implementasi sendiri.

## 1. Permintaan awal

Dari pemilik proyek (disarikan, urutan asli):

1. UI/UX lebih bagus dan mudah dipakai orang awam.
2. Aplikasi dibuat jauh lebih ringan.
3. Tambah banyak fitur yang membantu content creator.
4. Sediakan versi web lokal, bukan hanya desktop.
5. Sempurnakan fitur yang sudah ada.
6. Minimalkan dan cegah error.
7. Jangan sampai terlihat seperti AI slop.

Tambahan yang muncul saat brainstorming:

- "Ringan" berarti **semuanya**: ukuran unduhan, startup dan RAM, serta kecepatan proses.
- Di Colab, video 30 menit **lama sekali diproses lalu gagal** (runtime terputus / kehabisan RAM), terutama dengan opsi mediapipe.
- **yt-dlp sering error cookies** ("Sign in to confirm you're not a bot").
- Semua teks dan alur harus bisa dipahami **pengguna awam**.

## 2. Kondisi saat ini (hasil pembacaan repo)

- Ada **dua frontend yang hampir kembar**: `src/` (Tauri, React 18) dan `web/` (cloud/Colab, React 19). Komponen seperti `ClipCard`, `ClipEditModal`, `SubtitleConfigControls`, dan `SocialKitModal` ditulis dua kali dan mulai berbeda.
- `web/` saat ini adalah UI untuk Colab (butuh tunnel dan `AUTO_CLIPPER_WEB_TOKEN`). **Belum ada** cara menjalankannya lokal di browser tanpa Tauri.
- Backend FastAPI sudah berjalan di tiga mode (sidecar, dev, Colab), sehingga web lokal bisa murah dibuat setelah frontend digabung.
- UI hanya ±900 KB. Beban berat ada di backend (mediapipe, faster-whisper, opencv, bundel PyInstaller).
- Temuan performa dan stabilitas lengkap ada di spec Sub-proyek 0.

## 3. Sub-proyek dan urutan

| ID | Sub-proyek | Alasan urutan | Bergantung pada |
|---|---|---|---|
| **SP0** | Pipeline andal dan cepat (stabilitas Colab, performa, downloader, error ramah awam) | Fitur inti gagal di Colab. Tanpa ini fitur baru tidak berguna. | — |
| **SP1** | Fondasi frontend tunggal + web lokal | Semua kerja UI dan fitur berlipat dua selama ada dua frontend. | SP0 (kontrak error terstruktur) |
| **SP2** | Revamp UI/UX untuk orang awam, bebas AI slop | Dibangun di atas satu frontend. | SP1 |
| **SP3** | Ringan (ukuran installer, startup, RAM) | Perlu angka dari SP0 dan struktur dari SP1 sebelum dioptimasi. | SP0, SP1 |
| **SP4** | Fitur kreator dan penyempurnaan fitur lama (dikerjakan per gelombang) | Paling terbuka, paling mudah melebar. | SP1, SP2 |

Aturan: satu sub-proyek aktif pada satu waktu. Hasil ukur SP0 menentukan apakah pendekatan B (pelacakan wajah satu-kali-baca) masuk SP0 atau SP3.

## 4. Keputusan yang sudah diambil

| Tanggal | Keputusan | Alasan |
|---|---|---|
| 2026-11-12 | "Ringan" = ukuran + startup/RAM + kecepatan proses, semuanya. | Jawaban pemilik: semuanya. |
| 2026-11-12 | SP0 memakai pendekatan A (perbaikan struktural), lalu ukur, baru B bila perlu. | A murah dan diduga berdampak terbesar. B tanpa data hanya menebak. |
| 2026-11-12 | Kerja Colab di disk lokal, klip hasil disalin ke Drive. Resume setelah runtime mati mengunduh ulang sumber. | Seek acak ke file di Drive sangat lambat dan berisiko OOM. |
| 2026-11-12 | Dukungan cookies dikembalikan dalam bentuk **unggah `cookies.txt`** dengan peringatan risiko akun. Ini membalik keputusan spec `2026-09-12-ytdlp-bot-bypass`. | Tanpa cookies, pengguna tidak punya jalan keluar di IP datacenter. |
| 2026-11-12 | Semua pesan pengguna menjawab: apa yang terjadi, kenapa, apa yang harus dilakukan. Istilah teknis hanya di "Detail teknis". | Syarat pengguna awam. |
| 2026-11-12 | Error dikirim backend sebagai objek terstruktur, frontend hanya merender kartu generik. | Menghindari penulisan UI dua kali sebelum SP1. |

## 5. Pertanyaan terbuka

- SP1: apakah frontend digabung sebagai satu paket dengan adapter (Tauri, web lokal, Colab), atau `web/` dijadikan satu-satunya frontend dan Tauri hanya membungkusnya? Dibahas saat brainstorming SP1.
- SP1: cara menjalankan web lokal (perintah tunggal / launcher) dan model token untuk akses localhost.
- SP3: apakah mediapipe dijadikan unduhan opsional untuk mengecilkan installer.
- SP4: daftar fitur kreator yang akan dikerjakan (lihat kandidat di bawah).

## 6. Kandidat fitur SP4 (belum diputuskan)

Sumber: backlog PRD, `docs/ideas/`, dan rencana lama di `docs/superpowers/plans/`. Setiap kandidat dibrainstorm dan diprioritaskan sendiri saat SP4 dimulai.

- Terjemahan subtitle multi-bahasa (contoh: video Inggris, subtitle Indonesia).
- Posisi subtitle bebas (sumbu X dan Y) per klip.
- Split-screen untuk dua pembicara.
- Auto-post ke YouTube Shorts, TikTok, dan Reels (ada rencana: `2026-08-10-local-cdp-autopost`).
- Antrean batch beberapa video.
- Template gaya (brand kit: font, warna, watermark) yang bisa disimpan dan dipakai ulang.
- Preset ekspor per platform.
- Penghapusan jeda hening dan kata pengisi.

## 7. Dokumen terkait

- Spec SP0: `docs/superpowers/specs/2026-11-12-pipeline-stability-design.md`
- Daftar task: `tasks/roadmap-todo.md`
- Aturan teknis wajib: `.agents/AGENTS.md` (tidak `print()` ke stdout, `log_error` untuk semua error, invarian CORS, dan lainnya).
