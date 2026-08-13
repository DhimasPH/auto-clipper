# ADR-011: Cross-Platform CORS Configuration & Installer Process Lifecycle

- **Status**: Accepted
- **Date**: 2026-08-07
- **Context**: Release v1.11.0 & v1.10.0 Windows/macOS Desktop Build

---

## 1. Konteks & Masalah

Pada rilis desktop v1.11.0, aplikasi mengalami masalah konektivitas *backend disconnected* pada OS Windows dan kegagalan penggantian file (*file lock*) saat proses upgrade/downgrade:

1. **Origin Mismatch di WebView2**:
   Origin desktop berbeda secara fundamental antar OS:
   - **Windows (WebView2)**: Menggunakan `http://tauri.localhost` atau `https://tauri.localhost`.
   - **macOS (WKWebView)**: Menggunakan custom scheme `tauri://localhost` atau `app://*`.
   - **Development**: Menggunakan `http://localhost:5173` atau `http://127.0.0.1:5173`.
   
   Saat regex CORS diperketat menjadi `https?://(localhost|127\.0\.0\.1)`, request dari WebView2 Windows terblokir karena `tauri.localhost` dianggap sebagai subdomain yang tidak valid.

2. **File Lock Windows (`WinError 32`) saat Upgrade/Downgrade**:
   Ketika backend gagal handshake akibat CORS, proses `backend-x86_64-pc-windows-msvc.exe` tetap berjalan di background. Saat installer dijalankan, Windows mengunci file `.exe` yang aktif sehingga installer tidak dapat memperbarui binary backend.

3. **FFmpeg Discovery pada Berbagai Struktur Direktori**:
   Lokasi binary FFmpeg berbeda antara mode pengembangan lokal, PyInstaller `--onefile` (folder temporary `_MEIxxxx`), dan bundle macOS `--onedir`.

---

## 2. Keputusan Arsitektur

### A. Universal Regex CORS Matching
FastAPI middleware dikonfigurasi dengan regex komprehensif yang mengizinkan semua subdomain `.localhost`, loopback IP, dan custom scheme Tauri:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https?://([a-zA-Z0-9_.-]+\.)?localhost(:\d+)?|https?://127\.0\.0\.1(:\d+)?|tauri://.*|app://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### B. NSIS Preinstall Process Termination (`hooks.nsh`)
Untuk mencegah *file lock* pada Windows saat instalasi atau pembaruan versi:
```nsis
!macro NSIS_HOOK_PREINSTALL
  ExecWait "taskkill /IM backend.exe /F /T"
  ExecWait "taskkill /IM backend-x86_64-pc-windows-msvc.exe /F /T"
  ExecWait 'taskkill /IM "Auto Clipper.exe" /F /T'
  ExecWait "taskkill /IM app.exe /F /T"
!macroend
```

### C. Hierarki Pencarian Binary FFmpeg
Fungsi `find_ffmpeg()` di `backend/video_utils.py` dan penambahan path di `backend/main.py` menggunakan hierarki:
1. `bin_dir / "ffmpeg.exe"` (atau `ffmpeg` di POSIX)
2. `bin_dir.parent / "ffmpeg"`
3. `os.path.dirname(bin_dir)`
4. Sistem `PATH`

### D. PyInstaller Spec Hardening
Pada `backend.spec`:
- Menambahkan `backend.metadata` ke dalam `hiddenimports`.
- Menggunakan `collect_all('numpy')` untuk menjamin semua modul C-extension dan dependensi numpy terbawa ke dalam bundle executable.

---

## 3. Dampak & Konsekuensi

- **Positif**:
  - Kompatibilitas 100% di semua target platform: Windows (WebView2), macOS Intel (`x86_64`), dan macOS Apple Silicon (`aarch64`).
  - Proses update/install Windows berjalan mulus tanpa risiko file terkunci atau zombie process.
  - Runtime dependency terisolasi dan stabil.
- **Verifikasi**:
  - Unit test `test_cors_headers` di `backend/tests/test_main.py` memvalidasi respon origin `http://tauri.localhost` dan `https://tauri.localhost` dengan header `access-control-allow-origin`.
  - Seluruh test suite (116 tests) lulus.
