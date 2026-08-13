# ADR 006: Standarisasi Logging Error dan Penanganan Exception di Backend

## Context
Auto Clipper menggunakan Python FastAPI sebagai sidecar backend. Sebelumnya, penanganan error dan peringatan (warnings) tersebar secara tidak konsisten: beberapa modul menggunakan `print()` ke stdout/stderr, beberapa blok `except Exception` tidak mencatat ke file log atau mengabaikan error, dan unhandled exception pada endpoint FastAPI tidak otomatis masuk ke `backend_error.log`.

Hal ini menyulitkan diagnosa ketika terjadi kegagalan rendering, transkripsi Whisper, pemotongan video, atau error koneksi API AI di komputer pengguna desktop.

## Decision
1. **Penyempurnaan `backend/logger.py`**:
   - Memperluas fungsi `log_error` agar menerima string maupun objek `Exception`, mencatat context, pesan error, timestamp, dan full traceback bila tersedia.
   - Menjadikan operasi file log bersifat fail-safe (`try...except`) dengan encoding UTF-8 eksplisit.
2. **Pengalihan `print` Error & Blok Exception di Seluruh Modul Backend**:
   - Mengganti seluruh `print` error/warning di `ai_utils.py`, `crop_utils.py`, `broll.py`, `jobs.py`, `metadata.py`, `video_utils.py`, dan `db.py` dengan pemanggilan `log_error()`.
3. **Global Exception Handler & Handshake Safety**:
   - Menambahkan handler `@app.exception_handler(Exception)` dan `sys.excepthook` di `main.py` untuk menangkap crash tak terduga.
   - Mempertahankan baris `print(f"PORT:{port}")` dan `print(f"TOKEN:{token}")` di stdout agar handshake Tauri sidecar tetap berjalan tanpa gangguan.

## Alternatives Considered
- **I/O Stream Interception (`sys.stderr` redirection)**: Ditolak karena berisiko mengganggu buffer standard stream di Windows atau membingungkan handshake listener port pada startup Tauri sidecar.
- **Migrasi Total ke Python `logging` Standard**: Dipertimbangkan, namun pendekatan wrapper langsung pada `logger.py` dipilih karena paling aman, minim perubahan dependensi, dan langsung kompatibel dengan pola yang sudah ada.

## Consequences
- **Positif**: Semua error, warning kegagalan, dan crash yang terjadi di backend tercatat secara terpusat di `backend_error.log` dengan context dan traceback yang lengkap.
- **Positif**: Proses rendering video tidak akan terhenti mendadak hanya karena kegagalan logging.
- **Negatif / Perhatian**: Perlu memastikan pengujian menyeluruh (regression tests) di backend agar tidak ada modul yang terganggu akibat perubahan logging.
