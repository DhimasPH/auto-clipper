# Changelog

Semua perubahan yang signifikan pada proyek ini akan didokumentasikan di file ini.

## [1.7.0] - 2026-08-01

### Added

- **Native OS Notifications**: Notifikasi kini menggunakan sistem notifikasi bawaan sistem operasi (native) yang mendukung multi-bahasa, menggantikan notifikasi web konvensional.
- **System Sleep Prevention**: Menambahkan antarmuka _BusyOverlay_ dan mekanisme pencegahan OS _sleep_ saat aplikasi merender video, memastikan proses tidak gagal di tengah jalan.
- **Internationalization (i18n)**: Menambahkan dukungan multi-bahasa (Bahasa Inggris dan Indonesia) pada antarmuka pengguna aplikasi.

### Changed

- **FastAPI Architecture**: Beralih dari penggunaan standar I/O (IPC) ke peladen backend berbasis FastAPI untuk stabilitas _Job Management_ (antrean kliping, translasi, render) yang jauh lebih tangguh.
- Memperbarui dokumentasi teknis, PRD, dan BRD agar sejalan dengan kapabilitas dan arsitektur baru.

## [1.6.11] - 2026-07-31

### Fixed

- Memperbaiki parser JSON untuk data hasil respon AI agar lebih tangguh (robust) ketika AI berhalusinasi atau memberikan format JSON yang tidak valid di bagian terbawah teks, sehingga klip tetap berhasil diproses tanpa terhenti karena _error_.

## [1.6.10] - 2026-07-30

### Fixed

- Memperbaiki bug di mana video gagal dipotong (muncul pesan "Semua klip gagal dirender") karena sistem lupa meneruskan data _highlights_ dari AI ke fungsi _cropping_.
- Memperbaiki kegagalan proses _Resume/Retry_ dari halaman History yang disebabkan oleh data _highlights_ yang tidak tersimpan ke database.

## [1.6.9] - 2026-07-30

### Fixed

- Memperbaiki bug aplikasi crash (Converting circular structure to JSON) saat klik tombol "Generate Viral Clips" dengan mencegah pengiriman object Event React ke backend.

## [1.6.8] - 2026-07-30

### Added

- Menambahkan panduan langkah demi langkah penggunaan fitur "Manual AI Editor (Gratis)" di halaman Help / FAQ (mendukung bahasa Indonesia dan Inggris).

### Fixed

- Memperbaiki alur navigasi fitur "Manual AI" agar tetap berada di halaman History saat melajutkan proses kliping, tidak lagi terlempar ke layar utama.
- Memperbaiki sistem _parser_ JSON (di sisi _frontend_ dan _backend_) agar lebih kebal (_robust_) terhadap respons dari AI yang menyertakan teks narasi pengantar atau terbungkus oleh _Markdown code blocks_.
- Memperbaiki _error_ layar putih (_blank white screen_) di halaman Help / FAQ akibat kegagalan muat _icon_.

## [1.6.7] - 2026-07-29

### Fixed

- Memperbaiki isu proses rendering klip yang gagal karena respons dari model AI terbungkus oleh blok _Markdown_ (e.g. ` ```json `).
- Memperbaiki fitur **Retry** pada riwayat gagal karena hilangnya API Key; sekarang _frontend_ mengirimkan API Key yang tersimpan sebagai _fallback real-time_.

## [1.6.6] - 2026-07-28

### Fixed

- Memperbaiki fitur Retry agar tidak crash saat terjadi network timeout (`getaddrinfo failed`).
- Menambahkan fallback _retry delay_ yang lebih sabar (hingga 8 attempts / ~4 menit) pada integrasi API Gemini untuk mengatasi isu `503 UNAVAILABLE` (server overloaded).
- Mencegah fitur Retry/AI Koreksi dari proses _re-transcribing_ dan mengekstrak ulang audio yang sudah ada, sehingga membuat _retry_ dan koreksi AI secara signifikan lebih cepat.
- Menghapus _placeholder_ `ffmpeg.exe` (berukuran 0 byte) bawaan Tauri pada folder _target_ yang menyebabkan `[WinError 193]` saat sistem memanggil `ffmpeg`.
- Memperbaiki halaman Riwayat (History Page) yang tidak merender tombol "Retry" akibat perbedaan _string_ status `"ERROR"` pada backend dengan `"failed"` pada frontend.

## [1.6.5] - 2026-07-27

### Fixed

- Memperbaiki izin eksekusi _sidecar_ pada Tauri v2 dengan menyelaraskan string `"bin/backend"` di `src-tauri/capabilities/default.json` agar _backend_ dapat berjalan di hasil rilis.

## [1.6.4] - 2026-07-27

### Fixed

- Memperbaiki isu "disconnected" pada frontend dengan menyelaraskan nama string pemanggilan _sidecar_ agar sesuai dengan path `externalBin` terbaru di `tauri.conf.json`.

## [1.6.3] - 2026-07-27

### Fixed

- Memperbaiki isu "ffmpeg is not installed" pada rilis GitHub Actions dengan menyesuaikan path executable ffmpeg agar disertakan dengan benar saat _bundling_ oleh Tauri.

## [1.6.2] - 2026-07-27

### Fixed

- Menambahkan fallback loop cookie untuk browser pada `yt-dlp` guna menyelesaikan isu kegagalan unduhan video YouTube yang diblokir oleh bot protection/age restriction.

## [1.6.1] - 2026-07-25

### Changed

- Refactoring arsitektur backend menjadi berbasis FastAPI untuk stabilitas yang lebih baik.
- Integrasi Tauri Sidecar dan perbaikan background job processing.
- Penambahan fungsi Stronghold Storage untuk token.

## [1.6.0] - 2026-07-24

### Added

- Fitur **Multi-Stage Resume (Retry Cerdas)**: Proses retry kini hanya mensyaratkan ketersediaan file video lokal. Jika gagal di tengah jalan (misal: saat transkripsi Whisper), pengguna tidak perlu _download_ ulang videonya, sistem akan secara cerdas melanjutkan tahap transkripsi dari video yang sudah ada.

## [1.5.0] - 2026-07-22

### Added

- Fitur Social Kit Modal yang lebih rapi (menampilkan judul, deskripsi, hashtag, dan ide thumbnail).
- Rekomendasi Waktu Posting (Best Time to Post) yang menyesuaikan zona waktu lokal pengguna.
- Saran Backsound Musik yang spesifik (lagu, artis, dan genre) sesuai suasana klip.
- Durasi klip yang lebih dinamis (20-120 detik) untuk mengakomodasi narasi panjang atau klip singkat yang _punchy_.

### Fixed

- Memperbaiki bug di `HistoryPage` di mana data social kit baru tidak terlempar (forwarded) ke komponen `ClipCard`.

## [1.4.0] - 2026-07-21

### Added

- Fitur AI Content Generation untuk pembuatan konten otomatis.
- Pencarian dan integrasi B-Roll otomatis dari Pexels.
- Implementasi sistem logging terpusat untuk semua proses.

### Fixed

- Perbaikan masalah OpenAI 524 Error.

## [1.3.3] - 2026-07-21

### Added

- Dokumen Architecture Decision Records (ADR) di folder `docs/decisions`.
- Dokumentasi `AGENTS.md` untuk membantu AI AI Agent memahami konteks proyek.
- File `CHANGELOG.md` untuk melacak riwayat pembaruan aplikasi.

### Changed

- Refactoring dokumentasi internal.

## [1.3.2] - Previous Version

_(Catatan historis untuk versi sebelumnya sebelum changelog ini diinisiasi)_
