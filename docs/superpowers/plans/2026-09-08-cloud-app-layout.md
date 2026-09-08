# Phase 2: App Layout & Sidebar Navigation for Cloud

Tujuan dari fase ini adalah untuk mengganti sistem navigasi satu halaman (MainWizard) pada versi Cloud menjadi sistem Layout dan Sidebar yang **persis sama** dengan versi Desktop.

## User Review Required

- **Routing Library**: Kita akan menggunakan `react-router-dom` (sama seperti Desktop).
- **Dependency Web**: Modul `i18n` dan *Tauri APIs* tidak akan dibawa ke web. Teks akan ditulis statis dalam Bahasa Inggris (sesuai *default* Desktop), dan link eksternal menggunakan tag HTML standar (`<a target="_blank">`).
- **Penghapusan Fitur**: Sesuai instruksi Anda, *Sidebar* **TIDAK** akan menampilkan menu `Settings` dan `Manual Downloader`.

## Proposed Changes

### 1. Dependencies
- Install `react-router-dom` di dalam direktori `web/`.

### 2. Styling & Theme
- **[MODIFY]** `web/tailwind.config.js`: Menambahkan palet warna semantik Desktop (`bg-bg-primary`, `bg-bg-secondary`, `accent`, dll) agar komponen *Sidebar* dan *Layout* memiliki warna yang persis sama.
- **[MODIFY]** `web/src/index.css`: Memasukkan variabel CSS (CSS Variables) untuk Dark Mode sebagai tema default di Cloud.

### 3. Komponen Baru
- **[NEW]** `web/src/layouts/AppLayout.tsx`: Komponen wrapper yang memosisikan *Sidebar* di sebelah kiri dan konten (`<Outlet />`) di sebelah kanan.
- **[NEW]** `web/src/components/Sidebar.tsx`: Replikasi *Sidebar* dari Desktop.
  - Mempertahankan logo dan versi.
  - Memuat link navigasi: Workspace (hero), Manual AI Editor, dan History.
  - Memodifikasi indikator status Colab untuk menggunakan API *health-check* dari web.

### 4. Refactor App.tsx
- **[MODIFY]** `web/src/App.tsx`: 
  - Membungkus `<AuthGate>` dengan `<HashRouter>`.
  - Mengubah struktur `MainWizard` yang memuat logika *conditional rendering* menjadi rute `react-router-dom`.
  - `/` -> Menampilkan komponen *Workspace* (untuk sementara diisi oleh `HeroInput` yang ada).
  - `/history` -> Menampilkan komponen `HistoryList`.
  - `/manual-ai` -> Menampilkan komponen sementara (placeholder) sebelum fitur ini di-port sepenuhnya.

## Verification Plan

### Automated Tests
- Menjalankan `npm run build` di dalam folder `web/` untuk memastikan integrasi `react-router-dom` dan komponen baru berhasil di-compile tanpa error TypeScript.

### Manual Verification
- Navigasi antar menu di Sidebar bekerja tanpa memuat ulang (*reload*) halaman.
- Indikator status Colab (Connected/Disconnected) di bagian bawah Sidebar berfungsi.
- Warna dan *hover effect* pada Sidebar persis sama dengan versi Desktop.
