# ADR-001: Penggunaan Tauri untuk Framework Aplikasi Desktop

## Status
Accepted

## Date
2026-07-21

## Context
Kami membutuhkan framework untuk membangun aplikasi desktop cross-platform (Windows, macOS, Linux) yang dapat menjalankan antarmuka modern (React/Web) dan berkomunikasi dengan sistem lokal (file system, eksekusi proses) untuk pemrosesan video.
Kriteria utama:
- Ukuran bundle (installer) yang kecil dan efisien.
- Konsumsi memori (RAM) yang rendah.
- Dukungan untuk memanggil dan mengontrol *sidecar* proses (seperti Python/FFmpeg).
- Dukungan auto-updater yang kuat.

## Decision
Menggunakan **Tauri** (berbasis Rust) sebagai framework desktop utama.

## Alternatives Considered

### Electron
- Pros: Ekosistem sangat besar, sangat populer, Node.js bawaan.
- Cons: Ukuran aplikasi besar (menyertakan Chromium), konsumsi RAM sangat tinggi.
- Rejected: Aplikasi Auto Clipper sudah cukup berat karena proses pemrosesan video dan AI secara lokal. Menambah beban Electron akan membuat aplikasi tidak dapat berjalan lancar di PC spesifikasi rendah.

### Qt (Python/C++)
- Pros: Sangat native dan performa tinggi.
- Cons: Membutuhkan waktu pengembangan UI yang lebih lama, sulit mencari UI developer dibanding web developer.
- Rejected: Ingin menggunakan React dan Tailwind agar UI terlihat modern dan lebih cepat dikembangkan.

## Consequences
- Ukuran installer lebih kecil.
- Perlu memahami dasar konfigurasi Rust/Cargo jika ada custom plugin.
- Integrasi antar *sidecar* backend Python dilakukan melalui `tauri-plugin-shell` (Command API).
