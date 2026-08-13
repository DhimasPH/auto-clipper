# 004. Startup Version Update Check

Date: 2026-08-02

## Context
Aplikasi Auto Clipper memiliki mekanisme updater berbasis Tauri v2 (`@tauri-apps/plugin-updater`), namun saat ini pengecekan pembaruan baru dapat dipicu secara manual di halaman Settings. Pengguna membutuhkan notifikasi otomatis saat aplikasi dibuka (selama splash screen berjalan) jika ada versi baru yang tersedia agar selalu *aware* dengan rilis terbaru.

## Decision
1. Mengimplementasikan hook non-blocking `useStartupUpdateCheck` di sisi frontend React (`App.tsx`) yang berjalan paralel dengan proses inisialisasi backend saat splash screen.
2. Menggunakan `check()` dari `@tauri-apps/plugin-updater` dengan proteksi timeout (10 detik) dan deteksi environment (`__TAURI_INTERNALS__`).
3. Jika update tersedia, memicu `notify()` yang menampilkan in-app toast dan Native OS Notification dalam format multi-bahasa (`id` & `en`).
4. Jika terjadi kegagalan jaringan atau offline, aplikasi melakukan *silent fail* di sisi UI dan mengirimkan log error ke endpoint `POST /log-error` untuk dicatat ke `backend_error.log`.

## Alternatives Considered
1. **Pengecekan di dalam init lifecycle `useUserSettings.ts`**: Ditolak karena mencampuradukkan manajemen lifecycle proses backend dengan fitur update check (*tight coupling*).
2. **Pengecekan di Rust bootstrap (`lib.rs`)**: Ditolak karena menyulitkan integrasi teks multi-bahasa (i18n) yang dikelola di sisi frontend.

## Consequences
- **Positive**:
  - Pengguna mendapatkan informasi pembaruan secara proaktif dan seamless melalui Native OS Notification.
  - Startup aplikasi dan splash screen tidak akan terhambat jika internet lambat atau offline.
  - Error tercatat rapi di `backend_error.log`.
- **Negative / Considerations**:
  - Penambahan endpoint lightweight `POST /log-error` di backend FastAPI untuk penerimaan error client.
