# Spec SP1: Frontend tunggal dan web lokal

Tanggal: 2026-11-18 · Status: disetujui pemilik per bagian, menunggu review tertulis · Induk: `2026-11-12-enhancement-roadmap.md` · Bergantung: SP0 (`2026-11-12-pipeline-stability-design.md`)

## 1. Masalah

Ada dua frontend yang hampir kembar:

| | `src/` (desktop, Tauri) | `web/` (Colab lewat Vercel) |
|---|---|---|
| Ukuran | 64 file, ±8.200 baris | 41 file, ±6.300 baris |
| Toolchain | React 18, Vite 4, TypeScript 5.0, `HashRouter` | React 19, Vite 8, TypeScript 6, oxlint, router |
| Teks | i18next, `src/locales/{id,en}.json` | `web/src/lib/strings.ts` |
| AI | provider dengan API key dan manual | manual saja |
| Sumber video | URL, file lokal | URL, Google Drive |

Komponen yang sama (`ClipCard`, `ClipEditModal`, `SubtitleConfigControls`, `ErrorCard`, `CookiesPanel`, dan lainnya) ditulis dua kali dan sudah mulai berbeda. Setiap perbaikan UI di SP0 dikerjakan dua kali. Selain itu belum ada cara memakai aplikasi di browser tanpa memasang desktop, dan `/video` dapat diakses tanpa token (temuan T0.19).

## 2. Sasaran dan non-sasaran

Sasaran:

- Satu kode frontend (`src/`) yang berjalan di tiga platform: desktop (Tauri), web lokal, dan cloud (Vercel + backend Colab).
- Web lokal untuk pengguna yang tidak mau memasang aplikasi desktop: unduh zip, klik dua kali, aplikasi terbuka di browser.
- Perilaku desktop dan cloud bagi pengguna tidak berubah, kecuali perbaikan yang disebut di spec ini.
- `/video` tidak lagi dapat diakses tanpa token di semua platform.

Non-sasaran:

- Merombak tampilan dan alur (SP2). SP1 tidak merapikan UI.
- Paket GPU, ukuran installer, startup (SP3).
- Akses dari perangkat lain di jaringan yang sama (tidak dipilih pemilik).
- "AI ulang" versi manual (task SP4).

## 3. Keputusan pemilik (2026-11-18)

| Pertanyaan | Keputusan |
|---|---|
| Web lokal untuk siapa | Pengguna tanpa pemasangan desktop, di komputer sendiri (`localhost`). |
| Jalur Colab | Tetap Vercel. Dipakai pengguna tanpa PC atau dengan PC sangat lemah, biasanya dari HP. |
| Cara menyatukan | Desktop (`src/`) menjadi basis dengan lapisan platform; fitur khusus web dipindah; `web/` dihapus. |
| Cara menjalankan web lokal | Paket siap pakai per OS dari halaman rilis GitHub, tanpa Python. |
| PR | Satu PR ke `main` setelah SP1 dan SP2, branch bertumpuk (`feat/sp1-single-frontend-web-local` dari branch SP0). |

## 4. Desain

### 4.1 Lapisan platform

Semua yang berbeda antar platform dikumpulkan di `src/platform/`. Komponen tidak memanggil `@tauri-apps/*` atau `window.location` secara langsung; mereka memakai antarmuka platform.

```ts
type PlatformKind = "desktop" | "local" | "cloud";

interface Platform {
  kind: PlatformKind;
  caps: {
    apiKeys: boolean;        // provider AI dengan API key; cloud: false (AI manual saja)
    localFilePicker: boolean; // dialog file OS; local/cloud: unggah lewat browser
    driveBrowser: boolean;   // penjelajah Google Drive; hanya cloud
    openFolder: boolean;     // buka folder hasil; desktop dan local
    updater: boolean;        // hanya desktop
    preventSleep: boolean;   // hanya desktop
  };
  backend(): Promise<{ url: string; token: string }>;
  pickVideo(): Promise<VideoSource | null>;   // path lokal, unggahan, atau file Drive
  saveClip(clip: ClipRef): Promise<void>;     // dialog "Simpan sebagai" atau unduhan browser
  openFolder(path: string): Promise<void>;
  secrets: { get(name: string): Promise<string | null>; set(name: string, value: string): Promise<void> };
  notify(title: string, body: string): void;
}
```

Isi per platform:

| | desktop | local | cloud |
|---|---|---|---|
| `backend()` | jalankan sidecar, baca `PORT:`/`TOKEN:` dari stdout (kode sekarang di `useUserSettings.ts`) | origin halaman; token dari `#t=` di alamat pembuka, disimpan di `sessionStorage`, lalu dihapus dari alamat | alamat tunnel dan token yang diisi pengguna (kode `web/` sekarang: `AuthGate`, `AUTO_CLIPPER_API_URL`) |
| `pickVideo()` | `plugin-dialog` | `<input type=file>` → `POST /upload` | unggah atau `GDriveBrowserModal` |
| `saveClip()` | `plugin-dialog` save → `POST /save_file` | unduhan browser (`/video?dl=1` bertanda tangan) | sama dengan local |
| `openFolder()` | `plugin-shell` | `POST /open_folder` | tidak tersedia |
| `secrets` | stronghold | `localStorage` | tidak ada (`caps.apiKeys = false`) |
| `notify()` | `plugin-notification` | Notification API browser bila diizinkan, selain itu toast | sama dengan local |
| updater, cegah sleep | `plugin-updater`, `invoke('prevent_sleep')` | tidak | tidak |

Pemilihan platform saat start: `window.__TAURI_INTERNALS__` ada → desktop; build dengan `VITE_TARGET=cloud` → cloud; selain itu → local. Modul Tauri hanya di-import di adapter desktop (import dinamis), sehingga build local dan cloud tidak bergantung pada Tauri saat runtime.

Komponen memeriksa `caps`, bukan `kind`. Contoh: bagian provider AI di Pengaturan tampil hanya bila `caps.apiKeys`; tombol "Pilih dari Google Drive" hanya bila `caps.driveBrowser`.

### 4.2 Fitur web yang dipindah ke `src/`

- `AuthGate` dan pengaturan alamat backend (hanya cloud).
- `GDriveBrowserModal` (hanya cloud, `GET /gdrive-browser`).
- Pemetaan aksi kartu error per platform: aksi `upload_video` membuka Drive di cloud dan pemilih file di desktop/local; aksi `open_settings` untuk kunci API disembunyikan bila `!caps.apiKeys`. Menyelesaikan keputusan terbuka SP0 no. 8.
- Teks `web/src/lib/strings.ts` dipindah ke `src/locales/{id,en}.json`; `web/src/lib/lang.ts` diganti pengaturan bahasa i18next.

Tidak dipindah: `Dashboard/HeroInput`, `ResultsModal`, `PromptJsonModal`, `HistoryList`, `OutputStyleSelector`, `useJobPolling`. Desktop sudah punya padanannya (`GenerateForm`, `ClipsResult`, `ManualAIEditorPage`, `HistoryPage`, `useClipJobs`), dan tampilannya dirombak di SP2. Bila padanan desktop kurang sesuatu yang dipakai pengguna cloud (misalnya ukuran layar HP), dicatat sebagai temuan untuk SP2, bukan dibangun ulang di SP1.

### 4.3 Toolchain

`src/` dinaikkan ke toolchain `web/`: React 19, Vite 8, TypeScript 6, `@vitejs/plugin-react` 6, oxlint. Tailwind tetap versi 3 (keduanya sudah 3). Tauri 2 tetap membungkus hasil `vite build`. Vitest ditambahkan (belum ada test runner frontend).

### 4.4 Backend menyajikan UI (mode web lokal)

- Mode baru, diaktifkan peluncur (`--web`). Backend menyajikan hasil build UI: `GET /` → `index.html`, `/assets/*` → file statis. Navigasi memakai `HashRouter`, jadi tidak perlu fallback SPA dan tidak bentrok dengan endpoint API yang ada.
- Bind ke `127.0.0.1` saja, port acak yang kosong.
- Token acak per peluncuran, wajib untuk semua endpoint di mode ini (seperti build terpasang dan mode cloud sekarang). `/`, `/assets/*`, `/health` tanpa token.
- Satu instance: peluncur menulis `{port, pid}` ke app data. Bila instance hidup ditemukan (`/health` menjawab), peluncur hanya membuka browser ke server itu lalu keluar.
- Peluncur membuka `http://127.0.0.1:<port>/#t=<token>` dengan `webbrowser.open`, lalu menampilkan di jendela konsol: "Auto Clipper berjalan. Jangan tutup jendela ini selama memakai aplikasi." beserta alamatnya (bila browser tidak terbuka sendiri). Menutup jendela menghentikan server.
- Tidak ada `print()` ke stdout di modul backend selain peluncur CLI (aturan AGENTS.md); handshake sidecar desktop tidak berubah.

### 4.5 Alamat video bertanda tangan

Pemutar `<video>` tidak bisa mengirim header `Authorization`, karena itu `/video` dikecualikan dari cek token. Gantinya:

- `sig = HMAC_SHA256(kunci_video, path_kanonik)`. Tanpa waktu kedaluwarsa (keputusan pemilik 2026-11-18): link berlaku untuk satu file itu, selamanya, dan tidak bisa dipakai untuk file lain.
- `kunci_video`: 32 byte acak, dibuat sekali dan disimpan di app data (`video_signing.key`, di Colab ikut ke Drive), sehingga link tetap berlaku setelah backend dijalankan ulang. File kunci masuk daftar terlindung `path_guard`. Menghapus file itu membatalkan semua link lama.
- `GET /video?path=…&sig=…` menolak (403) bila tanda tangan salah atau path dilindungi `path_guard` (T0.19). Pemeriksaan path yang ada tetap berlaku.
- Frontend tidak menyusun URL video sendiri: backend mengembalikan URL bertanda tangan di data klip, atau lewat `POST /video-url` untuk path lain (pratinjau sumber, unduhan dengan `dl=1`).
- Berlaku di ketiga platform, termasuk desktop dan cloud. Bila tetap mendapat 403 (misalnya kunci dihapus), frontend meminta URL baru sekali.
- Konsekuensi yang diterima: link klip yang tersebar tetap bisa dibuka siapa pun yang memegangnya selama server dan alamatnya sama, tetapi hanya untuk klip itu.

### 4.6 Paket web lokal

- GitHub Actions membangun per OS (Windows, macOS arm64/x64, Linux): backend PyInstaller yang sama dengan desktop (onedir), FFmpeg (`ffmpeg-static@5`, sama dengan installer desktop), dan `dist/` UI. Diunggah ke rilis sebagai `Auto-Clipper-Web-<os>.zip`.
- Isi zip: folder aplikasi dan peluncur yang diberi nama "Auto Clipper Web" (`.exe` di Windows, skrip `.command` di macOS, skrip `.sh` di Linux) yang menjalankan backend dengan `--web`.
- macOS: tidak ditandatangani Apple; panduan menjelaskan klik kanan → Open pada pembukaan pertama.
- Model Whisper diunduh saat pertama dipakai, sama dengan desktop.

### 4.7 Cloud (Vercel + Colab)

- Perilaku sama dengan `web/` sekarang: gerbang token, alamat backend, Drive, AI manual saja, Pengaturan cookies.
- Vercel mem-build dari root dengan `VITE_TARGET=cloud`. Setelan proyek Vercel diubah pemilik (root directory, build command, output directory); spec menyertakan nilai persisnya di panduan.
- Deploy produksi Vercel tetap dari `main`, jadi berubah setelah PR akhir (setelah SP2). Sebelum itu, preview deployment Vercel dari branch dipakai untuk menguji.

## 5. Penanganan error

- Kegagalan menemukan backend per platform memakai kartu error SP0: desktop (sidecar tidak start, kode sekarang), local (server mati: "Jendela Auto Clipper sudah ditutup. Buka lagi 'Auto Clipper Web'."), cloud (alamat atau token salah: pesan `AuthGate` sekarang).
- Token local hilang (tab ditutup lalu dibuka manual tanpa `#t=`): halaman meminta pengguna membuka ulang lewat peluncur, yang membuka tab baru dengan token.
- 403 dari `/video`: frontend meminta URL baru sekali, lalu menampilkan kartu error bila tetap gagal.
- Teks baru id + en, bahasa awam, mengikuti aturan "apa, kenapa, harus apa".

## 6. Pengujian

- Backend (pytest): penyajian `/` dan `/assets/*` di mode web, token wajib di mode web (tanpa token → 401, dengan token → 200, UI tanpa token), tanda tangan video (benar, salah, tanda tangan file A dipakai untuk file B, path dilindungi, `dl=1`, tetap berlaku setelah restart, kunci dibuat sekali), deteksi instance yang sudah berjalan, bind hanya `127.0.0.1`.
- Frontend (Vitest): pemilihan platform; `caps` per platform; adapter local membaca token dari `#t=` lalu menghapusnya dari alamat; adapter cloud memakai alamat dan token tersimpan; pemetaan aksi kartu error per platform; tidak ada import statis `@tauri-apps/*` di luar `src/platform/desktop` (uji yang memindai sumber, seperti uji thread di SP0).
- CI: build desktop (Tauri), build cloud (`VITE_TARGET=cloud`), paket web lokal per OS, pytest, Vitest, oxlint.
- Manual per platform: daftar cek di log kerja (pembuatan job URL dan file, hasil klip, simpan klip, buka folder, Pengaturan, cookies, kartu error, Riwayat, Rerender All).

## 7. Urutan kerja

1. Toolchain `src/`: React 19, Vite 8, TypeScript 6, oxlint, Vitest. Desktop tetap berfungsi.
2. Lapisan platform dengan adapter desktop; semua pemakaian `@tauri-apps/*` (9 file) dipindah ke adapter. Perilaku desktop tidak berubah.
3. Adapter cloud dan pemindahan fitur web (4.2); i18n tunggal. Vercel preview dari root.
4. Backend: mode web, token, alamat video bertanda tangan (4.4, 4.5) beserta pemakaiannya di frontend.
5. Adapter local dan peluncur; paket web lokal di CI (4.6).
6. Hapus `web/`; perbarui panduan, tutorial, CHANGELOG, ADR (frontend tunggal dan token video), AGENTS.md.

Setiap langkah berakhir dengan tes hijau dan build ketiga platform yang sudah ada.

## 8. Risiko

- Naik ke React 19 / Vite 8 dapat memecah dependensi desktop (i18next, plugin Tauri). Langkah 1 berdiri sendiri agar masalahnya terlihat sebelum perubahan lain.
- Padanan desktop untuk fitur web mungkin kurang nyaman di layar HP. Dicatat untuk SP2, bukan diperbaiki di SP1.
- Paket web lokal tidak ditandatangani: Windows SmartScreen dan macOS Gatekeeper akan memperingatkan. Dijelaskan di panduan.
- Alamat video bertanda tangan mengubah kontrak data klip. Riwayat lama tetap menyimpan path; URL dibuat saat dibaca, bukan disimpan.
- Setelan Vercel harus diubah pemilik; tanpa itu deploy preview gagal setelah `web/` dihapus.

## 9. Pertanyaan terbuka

- Apakah macOS x64 (Intel) masih perlu paket terpisah atau cukup arm64.
