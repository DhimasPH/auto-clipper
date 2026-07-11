# Auto Clipper: Migrasi Electron ke Tauri (Desain Arsitektur)

## Tujuan
Memigrasikan lapisan desktop (OS integrasi) dari Electron ke Tauri V2 untuk mengurangi ukuran akhir aplikasi secara drastis (dari ~200MB menjadi <10MB) dan menghemat memori, tanpa mengubah logika frontend React/Vite maupun backend Python yang sudah ada.

## Strategi Migrasi
Kita akan membuang infrastruktur Electron (`electron/main.cjs`, `electron/preload.cjs`, `electron-builder`) dan menggantikannya dengan Tauri V2 beserta ekosistem plugin resminya.

## Komponen & IPC (Inter-Process Communication)

| Fitur | Status di Electron saat ini | Desain di Tauri V2 |
| :--- | :--- | :--- |
| **Menjalankan Backend** | `child_process.spawn` di Node.js. | Menggunakan fitur bawaan **Tauri Sidecar** melalui `tauri-plugin-shell` untuk memanggil `backend.exe`. |
| **Mendapatkan Port Backend** | Membaca *stdout* via Node.js *event emitter*. | Frontend membaca *stdout* Sidecar menggunakan fungsi `.on('line', handler)` dari `tauri-plugin-shell`. |
| **Penyimpanan API Key** | `safeStorage` (Electron API) & `fs.writeFileSync`. | Menggunakan **`tauri-plugin-stronghold`** untuk enkripsi tingkat tinggi berbasis Rust yang diakses langsung dari Frontend. |
| **Pilih Folder** | IPC `dialog.showOpenDialog`. | Memanggil langsung dari Frontend menggunakan **`tauri-plugin-dialog`** (`open()` fungsi). |
| **Buka Folder** | IPC `shell.showItemInFolder`. | Memanggil langsung dari Frontend menggunakan **`tauri-plugin-shell`** (`open()` atau eksekusi perintah OS). |
| **Tutup Aplikasi / Cleanup** | Hook `will-quit` untuk mematikan `.exe` & *cleanup*. | Mendengarkan Tauri Window Event (`tauri://close-requested`) dari frontend atau Rust untuk *graceful exit* dan *cleanup* file temporer. |

## Modifikasi CI/CD (GitHub Actions)
Pipeline `.github/workflows/ci.yml` (atau workflow build lainnya) akan diubah total untuk mendukung ekosistem Rust:
1. **Instalasi Rust:** Menambahkan *step* `actions-rs/toolchain`.
2. **Dependensi Linux:** Menginstal dependensi OS khusus Linux (Ubuntu runner) seperti `libwebkit2gtk-4.0-dev` dan `libgtk-3-dev`.
3. **Tauri Action:** Mengganti skrip `npm run build / pack` dengan *action* resmi `tauri-apps/tauri-action` yang mengurus *build* lintas platform dan otomatis mengunggah *installer* (msi, exe, deb, dmg) ke GitHub Releases.

## Fase Eksekusi
1. Penghapusan *library* dan skrip Electron dari `package.json`.
2. Inisialisasi Tauri (`npx create-tauri-app` dengan *template* kosong untuk Vite).
3. Pengaturan `tauri.conf.json` (konfigurasi Sidecar, *identifier*, hak akses IPC/Plugin).
4. Pembaruan file Frontend (`App.tsx` atau konteks terkait) untuk mengganti panggilan `window.ipcRenderer` menjadi pemanggilan fungsi *plugin* Tauri.
5. Pembaruan file konfigurasi GitHub Actions.

## Pertimbangan & Batasan (Scope)
- **Tidak ada perubahan pada struktur backend FastAPI Python.** Backend.exe hanya akan di-bundle sebagai Sidecar.
- **Tidak ada perubahan logika React.** Tampilan, transisi, dan state management tidak tersentuh.
