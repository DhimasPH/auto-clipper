# ADR 010: Cross-Platform Packaging Split (Windows Onefile vs macOS Onedir) & Auto-Updater Artifacts

## Context
Auto Clipper mendistribusikan backend Python FastAPI sebagai sidecar yang dibungkus dengan PyInstaller dan dikontrol oleh shell Tauri v2.

Pada arsitektur distribusi lintas platform (Windows dan macOS), ditemukan perbedaan perilaku kritis:
1. **macOS Codesign & Sandbox/Temp Permission**:
   - Mode PyInstaller `--onefile` pada macOS mengekstrak seluruh biner Python, dynamic libraries (`.dylib`), dan file data ke direktori temporer `/var/folders/...` saat setiap eksekusi.
   - Hal ini menimbulkan *cold start latency* yang tinggi, potensi konflik perizinan runtime, serta kegagalan / deadlock saat proses *deep codesigning* dan notarisasi Apple pada biner bertingkat.
2. **Windows Simplicity**:
   - Pada platform Windows x86_64, PyInstaller `--onefile` (`bin/backend-x86_64-pc-windows-msvc.exe`) berjalan sangat andal, mudah dibersihkan, dan tidak mengalami isu codesign library internal.
3. **In-App Auto-Updater**:
   - Pembaruan aplikasi native Tauri v2 memerlukan payload spesifik per platform (installer `.msi`/`.exe` pada Windows, `.app.tar.gz` dan tanda tangan signature `.sig` pada macOS, beserta file manifest `updater.json`).

## Decision

1. **Packaging Split per Target OS di `backend.spec`**:
   - **Windows**: Menggunakan bundling `EXE` mode `--onefile` menghasilkan `bin/backend-x86_64-pc-windows-msvc.exe`.
   - **macOS**: Menggunakan bundling `COLLECT` mode `--onedir` menghasilkan direktori biner sidecar `bin/backend-x86_64-apple-darwin/` (Intel) atau `bin/backend-aarch64-apple-darwin/` (Apple Silicon).

2. **Platform-Specific Tauri Configuration (`tauri.macos.conf.json`)**:
   - Konfigurasi Tauri khusus platform macOS dipisahkan untuk mendaftarkan struktur folder sidecar `bin/backend-*` dan perizinan terkait, digabungkan saat build via flag `tauri build -c src-tauri/tauri.macos.conf.json`.

3. **Standalone Script & Dokumentasi Rilis macOS Intel (`release-mac-intel.sh`)**:
   - Menyediakan skrip rilis mandiri khusus macOS Intel x86_64 (`release-mac-intel.sh`) dan dokumen panduannya (`docs/release-macos-intel.md`).
   - Skrip ini otomatis:
     - Membersihkan direktori build (`--clean`).
     - Membangun sidecar Python onedir via PyInstaller.
     - Mem-build aplikasi Tauri (`.app` dan `.dmg`).
     - Meng-generate arsip update `.tar.gz` beserta signature kriptografis `.tar.gz.sig` menggunakan Tauri Private Key.
     - Menyusun `updater.json` siap upload ke hosting rilis / GitHub Releases.

4. **CI/CD Automation (`.github/workflows/build.yml`)**:
   - Menyelaraskan alur build matrix lintas platform (Windows x86_64, macOS x86_64, macOS aarch64) di GitHub Actions dengan caching dependensi Whisper/PyTorch.

## Consequences

- **Positif**: Cold start sidecar pada macOS jauh lebih cepat karena tidak ada proses dekompresi temporer di setiap launch.
- **Positif**: Proses codesigning dan notarization macOS bebas dari deadlock file biner tersembunyi.
- **Positif**: Windows tetap mempertahankan distribusi biner tunggal yang ringkas.
- **Positif**: Mendukung alur rilis manual maupun otomatis dengan artifact in-app updater yang valid.
