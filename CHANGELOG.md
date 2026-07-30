# Changelog

Semua perubahan yang signifikan pada proyek ini akan didokumentasikan di file ini.

## [1.6.10] - 2026-07-30
### Fixed
- Memperbaiki bug di mana video gagal dipotong (muncul pesan "Semua klip gagal dirender") karena sistem lupa meneruskan data *highlights* dari AI ke fungsi *cropping*.
- Memperbaiki kegagalan proses *Resume/Retry* dari halaman History yang disebabkan oleh data *highlights* yang tidak tersimpan ke database.
## [1.6.9] - 2026-07-30
### Fixed
- Memperbaiki bug aplikasi crash (Converting circular structure to JSON) saat klik tombol "Generate Viral Clips" dengan mencegah pengiriman object Event React ke backend.

## [1.6.8] - 2026-07-30
### Added
- Menambahkan panduan langkah demi langkah penggunaan fitur "Manual AI Editor (Gratis)" di halaman Help / FAQ (mendukung bahasa Indonesia dan Inggris).

### Fixed
- Memperbaiki alur navigasi fitur "Manual AI" agar tetap berada di halaman History saat melajutkan proses kliping, tidak lagi terlempar ke layar utama.
- Memperbaiki sistem *parser* JSON (di sisi *frontend* dan *backend*) agar lebih kebal (*robust*) terhadap respons dari AI yang menyertakan teks narasi pengantar atau terbungkus oleh *Markdown code blocks*.
- Memperbaiki *error* layar putih (*blank white screen*) di halaman Help / FAQ akibat kegagalan muat *icon*.

## [1.6.7] - 2026-07-29
### Fixed
- Memperbaiki isu proses rendering klip yang gagal karena respons dari model AI terbungkus oleh blok *Markdown* (e.g. ` ```json `).
- Memperbaiki fitur **Retry** pada riwayat gagal karena hilangnya API Key; sekarang *frontend* mengirimkan API Key yang tersimpan sebagai *fallback real-time*.

## [1.6.6] - 2026-07-28
### Fixed
- Memperbaiki fitur Retry agar tidak crash saat terjadi network timeout (`getaddrinfo failed`).
- Menambahkan fallback *retry delay* yang lebih sabar (hingga 8 attempts / ~4 menit) pada integrasi API Gemini untuk mengatasi isu `503 UNAVAILABLE` (server overloaded).
- Mencegah fitur Retry/AI Koreksi dari proses *re-transcribing* dan mengekstrak ulang audio yang sudah ada, sehingga membuat *retry* dan koreksi AI secara signifikan lebih cepat.
- Menghapus *placeholder* `ffmpeg.exe` (berukuran 0 byte) bawaan Tauri pada folder *target* yang menyebabkan `[WinError 193]` saat sistem memanggil `ffmpeg`.
- Memperbaiki halaman Riwayat (History Page) yang tidak merender tombol "Retry" akibat perbedaan *string* status `"ERROR"` pada backend dengan `"failed"` pada frontend.

## [1.6.5] - 2026-07-27
### Fixed
- Memperbaiki izin eksekusi *sidecar* pada Tauri v2 dengan menyelaraskan string `"bin/backend"` di `src-tauri/capabilities/default.json` agar *backend* dapat berjalan di hasil rilis.

## [1.6.4] - 2026-07-27
### Fixed
- Memperbaiki isu "disconnected" pada frontend dengan menyelaraskan nama string pemanggilan *sidecar* agar sesuai dengan path `externalBin` terbaru di `tauri.conf.json`.

## [1.6.3] - 2026-07-27
### Fixed
- Memperbaiki isu "ffmpeg is not installed" pada rilis GitHub Actions dengan menyesuaikan path executable ffmpeg agar disertakan dengan benar saat *bundling* oleh Tauri.

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
- Fitur **Multi-Stage Resume (Retry Cerdas)**: Proses retry kini hanya mensyaratkan ketersediaan file video lokal. Jika gagal di tengah jalan (misal: saat transkripsi Whisper), pengguna tidak perlu *download* ulang videonya, sistem akan secara cerdas melanjutkan tahap transkripsi dari video yang sudah ada.

## [1.5.0] - 2026-07-22
### Added
- Fitur Social Kit Modal yang lebih rapi (menampilkan judul, deskripsi, hashtag, dan ide thumbnail).
- Rekomendasi Waktu Posting (Best Time to Post) yang menyesuaikan zona waktu lokal pengguna.
- Saran Backsound Musik yang spesifik (lagu, artis, dan genre) sesuai suasana klip.
- Durasi klip yang lebih dinamis (20-120 detik) untuk mengakomodasi narasi panjang atau klip singkat yang *punchy*.

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
*(Catatan historis untuk versi sebelumnya sebelum changelog ini diinisiasi)*
