# Auto Clipper - AI Agent Guidelines

File ini berisi panduan untuk AI Agent yang bekerja pada repositori `auto-clipper`.

## Arsitektur Proyek
- **Frontend**: React 18, Vite, Tailwind CSS, React Router.
- **Backend / Desktop**: Tauri (Rust), yang memanggil executable Python (sidecar).
- **Backend Core**: Python 3.11+, PyInstaller untuk build executable.

## Aturan Pengembangan (Rules)

1. **Modifikasi Tauri**: 
   Jika Anda mengubah konfigurasi Tauri, selalu cek `src-tauri/tauri.conf.json`. Jika Anda menambahkan dependency Rust, perbarui `Cargo.toml`.
   
2. **Modifikasi Backend (Python)**:
   Backend dijalankan sebagai sidecar. Jika Anda menambahkan module baru, pastikan module tersebut di-*import* dengan benar dan kompatibel dengan PyInstaller.
   Setiap build membutuhkan target triplet di folder `bin/` (misalnya `bin/backend-x86_64-pc-windows-msvc.exe`).

3. **Dokumentasi (ADR)**:
   Setiap perubahan arsitektur yang signifikan, library utama yang baru, atau perubahan alur data yang krusial, HARUS didokumentasikan sebagai file ADR baru di folder `docs/decisions/`. Format file adalah `[nomor]-[nama-singkat].md` (contoh: `004-add-whisper-local.md`). Format ADR mengikuti standard (Context, Decision, Alternatives Considered, Consequences).

4. **UI/UX**:
   Gunakan komponen Lucide React untuk ikon, dan pertahankan desain modern dengan Tailwind CSS (Dark Mode diutamakan jika ada). Jangan gunakan generic "AI style" UI.
