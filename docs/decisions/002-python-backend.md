# ADR-002: Penggunaan Python sebagai Sidecar Backend

## Status
Accepted

## Date
2026-07-21

## Context
Aplikasi memerlukan kemampuan pemrosesan video yang berat, termasuk:
- Mengunduh video dari YouTube.
- Memotong dan memformat video menggunakan FFmpeg.
- Menganalisis video untuk *Face-Tracking* (AI).
- Mentranskripsi audio ke teks (Speech-to-Text).

Tauri (Rust) dapat melakukan beberapa hal, namun ekosistem library untuk AI, machine learning, dan integrasi video processing (seperti OpenCV, Whisper, yt-dlp) paling kaya ada di ekosistem Python.

## Decision
Membangun backend menggunakan **Python** yang di-*bundle* menjadi single executable menggunakan PyInstaller, lalu dijalankan oleh Tauri sebagai **sidecar process**.

## Alternatives Considered

### Rust Native
- Pros: Sangat cepat, memori efisien, terintegrasi langsung dalam core Tauri tanpa perlu komunikasi antar proses (IPC).
- Cons: Library AI/ML dan pemrosesan video tidak sematang dan semudah Python. Waktu pengembangan akan sangat lambat.
- Rejected: Waktu ke pasar (Time-to-Market) sangat penting, Python memiliki semua tools out-of-the-box.

### Node.js (Electron)
- Pros: Javascript native.
- Cons: Tetap harus *spawn* Python untuk AI, dan performa lebih lambat.
- Rejected: Lihat ADR-001.

## Consequences
- Harus mengonfigurasi PyInstaller untuk mem-*build* backend executable (Windows, macOS, Linux).
- Muncul tantangan pada macOS terkait *Gatekeeper* dan *Quarantine attribute* karena executable pihak ketiga.
- Komunikasi frontend dan backend menggunakan stdio atau HTTP API ringan (jika diaktifkan).
