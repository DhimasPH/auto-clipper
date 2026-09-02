# ☁️ Panduan Teknis Lengkap: Menjalankan Auto Clipper Cloud

Dokumentasi ini merupakan panduan teknis resmi *end-to-end* untuk mengonfigurasi, mendeploy, dan mengoperasikan **Auto Clipper Cloud secara mandiri (*self-hosted*)**.

Dengan panduan ini, Anda dapat menjalankan seluruh proses berat (transkripsi suara dengan Whisper, *face tracking*, pembuatan kanvas dinamis, dan *rendering* video FFmpeg dengan akselerasi hardware NVIDIA NVENC) pada **GPU Google Colab (T4 GPU Gratis)** dengan penyimpanan persisten di **Google Drive**, serta mengontrolnya langsung dari **Web App Smartphone (Vercel)**.

> [!NOTE]
> **Pilihan Metode Konektivitas (Pilih Sesuai Kebutuhan Anda):**
> 1. **Jalur A (Rekomendasi jika Punya Domain Pribadi):** Menggunakan **Cloudflare Zero Trust Named Tunnel** (`be-clipper.domainanda.com`) + Custom Domain di Vercel (`clipper.domainanda.com`).
> 2. **Jalur B (100% Gratis Tanpa Punya Domain):** Menggunakan **Ngrok Tunnel** (`https://xxxx.ngrok-free.app`) + Domain default gratis Vercel (`https://auto-clipper-web-xxxx.vercel.app`).

---

## 📑 Daftar Isi

1. [Ikhtisar & Arsitektur Sistem](#1-ikhtisar--arsitektur-sistem)
   - [Diagram Aliran Data & Topologi](#diagram-aliran-data--topologi)
   - [Keunggulan Mode Cloud](#keunggulan-mode-cloud)
2. [Prasyarat & Persiapan Akun (One-Time Setup)](#2-prasyarat--persiapan-akun-one-time-setup)
3. [Setup Backend Cloud (Google Colab & Google Drive)](#3-setup-backend-cloud-google-colab--google-drive)
   - [Langkah 3.1: Membuka Notebook Colab](#langkah-31-membuka-notebook-colab)
   - [Langkah 3.2: Mengaktifkan Akselerator Hardware T4 GPU](#langkah-32-mengaktifkan-akselerator-hardware-t4-gpu)
   - [Langkah 3.3: Mounting Google Drive & Struktur Workspace](#langkah-33-mounting-google-drive--struktur-workspace)
   - [Langkah 3.4: Eksekusi Server & Mekanisme GPU Keep-Alive](#langkah-34-eksekusi-server--mekanisme-gpu-keep-alive)
   - [Langkah 3.5: Verifikasi Health Check Backend](#langkah-35-verifikasi-health-check-backend)
4. [Setup Konektivitas Tunnel Publik](#4-setup-konektivitas-tunnel-publik)
   - [Jalur A: Cloudflare Zero Trust Tunnel (Jika Punya Domain Sendiri)](#jalur-a-cloudflare-zero-trust-tunnel-jika-punya-domain-sendiri)
   - [Jalur B: Ngrok Tunnel Gratis (Jika Tidak Punya Domain)](#jalur-b-ngrok-tunnel-gratis-jika-tidak-punya-domain)
5. [Setup & Deployment Frontend Web ke Vercel](#5-setup--deployment-frontend-web-ke-vercel)
   - [Langkah 5.1: Import Repositori ke Vercel](#langkah-51-import-repositori-ke-vercel)
   - [Langkah 5.2: Konfigurasi Root Directory & Build Settings](#langkah-52-konfigurasi-root-directory--build-settings)
   - [Langkah 5.3: Pengaturan Environment Variable (VITE_API_URL)](#langkah-53-pengaturan-environment-variable-vite_api_url)
   - [Langkah 5.4: Pengaturan Domain Frontend (Custom Domain vs Default Vercel)](#langkah-54-pengaturan-domain-frontend-custom-domain-vs-default-vercel)
6. [SOP Pengoperasian Harian via Smartphone (4-Step Wizard)](#6-sop-pengoperasian-harian-via-smartphone-4-step-wizard)
   - [Langkah 0: Inisialisasi Sesi & Login](#langkah-0-inisialisasi-sesi--login)
   - [Step 1: Input URL & Pemilihan Gaya Video](#step-1-input-url--pemilihan-gaya-video)
   - [Step 2: Transkripsi Whisper & Share Prompt ke AI](#step-2-transkripsi-whisper--share-prompt-ke-ai)
   - [Step 3: Submit JSON Highlights dari AI](#step-3-submit-json-highlights-dari-ai)
   - [Step 4: Background Rendering & Download MP4](#step-4-background-rendering--download-mp4)
7. [Panduan Pemeliharaan, Troubleshooting & FAQ](#7-panduan-pemeliharaan-troubleshooting--faq)
   - [Kendala 1: Sesi Google Colab Terputus / Idle Timeout](#kendala-1-sesi-google-colab-terputus--idle-timeout)
   - [Kendala 2: Error 401 Unauthorized / Token Mismatch](#kendala-2-error-401-unauthorized--token-mismatch)
   - [Kendala 3: Error CORS atau Network Connection Failed](#kendala-3-error-cors-atau-network-connection-failed)
   - [Kendala 4: Memory GPU Penuh (OOM) & Fallback Otomatis NVENC](#kendala-4-memory-gpu-penuh-oom--fallback-otomatis-nvenc)
   - [Kendala 5: Manajemen & Pembersihan Kapasitas Google Drive](#kendala-5-manajemen--pembersihan-kapasitas-google-drive)

---

## 1. Ikhtisar & Arsitektur Sistem

Auto Clipper Cloud memisahkan antarmuka pengguna (*Frontend*) dengan mesin komputasi berat (*Backend*). Pengguna mengontrol alur kerja dari browser smartphone (iOS Safari / Android Chrome) yang di-host di Vercel, sementara pemrosesan AI dan video dioperasikan di VM Google Colab yang dilengkapi GPU NVIDIA T4.

### Diagram Aliran Data & Topologi

```mermaid
graph TD
    subgraph Client["📱 Smartphone Client (Mobile Browser)"]
        BrowserA["Safari / Chrome<br/>https://clipper.domainanda.com<br/>(atau https://auto-clipper.vercel.app)"]
    end

    subgraph Hosting["☁️ Vercel Edge Network"]
        Vercel["React + Vite Single-Page Wizard<br/>(Root Folder: web/)"]
    end

    subgraph Tunneling["🌐 Secure Reverse Tunnel Options"]
        CFTunnel["Jalur A: Cloudflare Named Tunnel<br/>https://be-clipper.domainanda.com"]
        NgrokTunnel["Jalur B: Ngrok Tunnel Gratis<br/>https://xxxx.ngrok-free.app"]
    end

    subgraph Compute["🖥️ Google Colab (GPU NVIDIA T4)"]
        Uvicorn["FastAPI Server (Port 8000)<br/>backend/colab_api.py"]
        Whisper["faster-whisper (medium/small)<br/>+ Silero VAD Filter"]
        FFmpeg["FFmpeg Rendering Engine<br/>(NVENC Hardware Acceleration)"]
        KeepAlive["GPU Keep-Alive Pulse Thread"]
    end

    subgraph Persist["📁 Persistent Storage (Google Drive)"]
        GDrive["/content/drive/MyDrive/AutoClipperData/<br/>├── history.db (SQLite Database)<br/>└── projects/{job_id}/<br/>    ├── raw_video.mp4<br/>    ├── words.json<br/>    ├── subtitles.ass<br/>    └── clip_1.mp4, clip_2.mp4..."]
    end

    BrowserA -->|"1. Akses Web UI"| Vercel
    BrowserA -->|"2. API Request via Tunnel (Bearer Token)"| CFTunnel
    BrowserA -.->|"2. Alternatif API Request"| NgrokTunnel
    CFTunnel -->|"Forward ke localhost:8000"| Uvicorn
    NgrokTunnel -.->|"Forward ke localhost:8000"| Uvicorn
    Uvicorn --> Whisper
    Uvicorn --> FFmpeg
    Uvicorn --> KeepAlive
    Uvicorn <-->|"Read / Write Metadata & DB"| GDrive
    FFmpeg -->|"Simpan Klip MP4"| GDrive
    Uvicorn -->|"Stream Video & Direct Download"| BrowserA
```

### Keunggulan Mode Cloud

1. **Bebas Kebutuhan Spesifikasi Komputer**: Tidak memerlukan PC gaming atau kartu grafis mahal. Cukup gunakan HP dengan koneksi internet.
2. **Akselerasi GPU T4 Gratis**: Pemotongan video 9:16, tracking wajah dinamis, dan rendering subtitle karaoke berjalan hingga 4x–8x lebih cepat berkat hardware encoding `h264_nvenc`.
3. **Penyimpanan Persisten & Kebal Disconnect**: Riwayat klip, video sumber, dan file proyek tersimpan permanen di Google Drive Anda. Jika sesi Colab terputus, pekerjaan tidak hilang dan dapat dilanjutkan (*resume*).
4. **Alur Kerja Asinkron (*Bebas Tutup Browser*)**: Saat FFmpeg merender klip di Colab, Anda dapat menutup browser smartphone dan melakukan aktivitas lain. Ketika browser dibuka kembali, sistem akan menyinkronkan status secara otomatis.

---

## 2. Prasyarat & Persiapan Akun (One-Time Setup)

Sebelum menjalankan Auto Clipper Cloud untuk pertama kali, siapkan akun dan token berikut:

| Komponen | Kegunaan | Biaya | Pendaftaran |
|---|---|---|---|
| **Akun Google** | Akses Google Colab & Google Drive | Gratis (15 GB) | [google.com](https://google.com) |
| **Akun GitHub** | Repository hosting kode Auto Clipper | Gratis | [github.com](https://github.com) |
| **Akun Vercel** | Hosting antarmuka Frontend Web | Gratis (Hobby Tier) | [vercel.com](https://vercel.com) |
| **Cloudflare Zero Trust** *(Jalur A)* | Tunnel aman jika punya custom domain | Gratis (Free Tier) | [dash.cloudflare.com](https://dash.cloudflare.com) |
| **Akun Ngrok** *(Jalur B)* | Tunnel instan jika tidak punya domain | Gratis (Free Tier) | [ngrok.com](https://ngrok.com) |

> [!IMPORTANT]
> **Tentukan Static API Secret Token Anda:**
> Siapkan sebuah kata sandi rahasia yang kuat (misalnya: `rahasia-saya-2026-xyz`). Token ini akan digunakan bersama antara Colab Backend (`API_SECRET_TOKEN`) dan Web App di HP Anda untuk mencegah akses tanpa izin dari publik.

---

## 3. Setup Backend Cloud (Google Colab & Google Drive)

### Langkah 3.1: Membuka Notebook Colab

1. Buka [Google Colab](https://colab.research.google.com/).
2. Pilih tab **GitHub**, masukkan URL repository Anda (atau upload file [`Auto_Clipper_Colab.ipynb`](../Auto_Clipper_Colab.ipynb)).
3. Buka file **`Auto_Clipper_Colab.ipynb`**.

### Langkah 3.2: Mengaktifkan Akselerator Hardware T4 GPU

1. Pada menu navigasi Colab, klik **Runtime** $\rightarrow$ **Change runtime type** (*Ubah jenis runtime*).
2. Di bagian **Hardware accelerator**, pilih **T4 GPU**.
3. Pastikan indikator **GPU RAM** muncul di status bar kanan atas.

> [!WARNING]
> Jika runtime berjalan pada mode standard **CPU**, transkripsi Whisper dan rendering FFmpeg akan berjalan jauh lebih lambat dan fitur NVENC tidak dapat digunakan.

### Langkah 3.3: Mounting Google Drive & Struktur Workspace

Jalankan **Cell 1**:
```python
from google.colab import drive
drive.mount('/content/drive')
```
*Klik tautan persetujuan dan berikan izin akses ke Google Drive Anda.*

Setelah ter-mount, backend secara otomatis membuat direktori kerja persisten di:
```text
/content/drive/MyDrive/AutoClipperData/
├── history.db                  # Database riwayat job & status klip
└── projects/                   # Folder isolasi per proyek
    └── {job_id}/
        ├── source.mp4          # Video mentah asli dari yt-dlp
        ├── source.words.json   # Timestamp per kata dari Whisper
        ├── subtitles.ass       # Format subtitle karaoke / standard
        └── clip_1.mp4          # Potongan video siap unduh
```

### Langkah 3.4: Eksekusi Server & Mekanisme GPU Keep-Alive

Jalankan **Cell 2 & 3** untuk menginstal dependensi sistem dan cloning repo:
```bash
!apt-get update -qq && apt-get install -y -qq ffmpeg
!wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb && dpkg -i cloudflared-linux-amd64.deb
!git clone https://github.com/DhimasPH/auto-clipper.git /content/auto-clipper || true
%cd /content/auto-clipper
!pip install -q -r backend/requirements.txt uvicorn pyngrok
```

Pada **Cell 4**, masukkan token konfigurasi sesuai jalur yang Anda pilih:

#### Jika Menggunakan Jalur A (Cloudflare Named Tunnel):
```python
#@title Run Auto Clipper Backend (Cloudflare)
CLOUDFLARE_TUNNEL_TOKEN = "eyJhIjoi..." #@param {type:"string"}
API_SECRET_TOKEN = "password-rahasia-anda" #@param {type:"string"}

# Opsional: Jika menggunakan domain frontend custom
import os
os.environ["AUTO_CLIPPER_CORS_ORIGIN"] = "https://clipper.domainanda.com"

!python backend/colab_api.py --cloudflare-token "$CLOUDFLARE_TUNNEL_TOKEN" --api-token "$API_SECRET_TOKEN"
```

#### Jika Menggunakan Jalur B (Ngrok Gratis):
```python
#@title Run Auto Clipper Backend (Ngrok)
from pyngrok import ngrok
import os

NGROK_AUTHTOKEN = "TOKEN_NGROK_ANDA" #@param {type:"string"}
API_SECRET_TOKEN = "password-rahasia-anda" #@param {type:"string"}

ngrok.set_auth_token(NGROK_AUTHTOKEN)
public_url = ngrok.connect(8000).public_url
print(f"\n🚀 PUBLIC BACKEND URL ANDA: {public_url}\n")

os.environ["API_SECRET_TOKEN"] = API_SECRET_TOKEN
os.environ["AUTO_CLIPPER_DEV_TOKEN"] = API_SECRET_TOKEN
os.environ["AUTO_CLIPPER_CLOUD_MODE"] = "1"
os.environ["AUTO_CLIPPER_WORKSPACE"] = "/content/drive/MyDrive/AutoClipperData"

!python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

#### Cara Kerja `gpu_keep_alive()` di Colab:
Backend menyertakan thread latar belakang otomatis yang mengalokasikan tensor memori GPU ringan (~400MB) dan mengirimkan pulsa komputasi mikro setiap 15 detik. Ini mencegah Google Colab menandai sesi sebagai *idle* saat Anda sedang menunggu respons AI di HP.

### Langkah 3.5: Verifikasi Health Check Backend

Buka tab baru di browser Anda dan akses endpoint:
- **Jalur A:** `https://be-clipper.domainanda.com/health`
- **Jalur B:** `https://xxxx.ngrok-free.app/health`

Respons yang diharapkan:
```json
{
  "status": "ok",
  "version": "1.14.0",
  "gpu_available": true
}
```

---

## 4. Setup Konektivitas Tunnel Publik

Karena Google Colab berjalan di dalam jaringan internal Google yang tertutup, Anda memerlukan *reverse tunnel* agar browser HP dapat mengirim perintah ke backend FastAPI (port 8000).

---

### Jalur A: Cloudflare Zero Trust Tunnel (Jika Punya Domain Sendiri)

Gunakan metode ini jika Anda sudah memiliki domain pribadi (contoh: `domainanda.com`) yang terhubung ke Cloudflare:

1. Buka [Cloudflare Zero Trust Dashboard](https://one.dash.cloudflare.com/).
2. Masuk ke menu **Networks** $\rightarrow$ **Tunnels** $\rightarrow$ klik **Create a tunnel**.
3. Pilih tipe **Cloudflared**, beri nama tunnel (misal: `colab-clipper`), lalu klik **Save tunnel**.
4. Di bagian *Install and run a connector*, pilih tab **Debian (64-bit)** dan salin token tunnel (string panjang setelah `--token`).
5. Masuk ke tab **Public Hostname** pada tunnel tersebut, klik **Add a public hostname**:
   - **Subdomain:** `be-clipper` (atau `api`)
   - **Domain:** Pilih domain Anda yang aktif di Cloudflare (misal: `domainanda.com`)
   - **Path:** *(Biarkan kosong)*
   - **Type:** `HTTP`
   - **URL:** `localhost:8000`
6. Klik **Save hostname**. Publik URL backend Anda sekarang adalah: `https://be-clipper.domainanda.com`.
7. Tempel token yang disalin ke kolom `CLOUDFLARE_TUNNEL_TOKEN` di notebook Colab.

---

### Jalur B: Ngrok Tunnel Gratis (Jika Tidak Punya Domain)

Gunakan metode ini jika Anda **tidak memiliki domain sendiri**. Seluruh proses 100% gratis:

1. Daftar akun di [ngrok.com](https://ngrok.com) dan buka halaman **Your Authtoken**.
2. Salin token autentikasi Ngrok Anda.
3. Tempel token tersebut ke notebook Colab (pada blok Ngrok di Langkah 3.4).
4. Saat sel dijalankan, Colab akan mencetak URL publik unik, contoh: `https://abcd-12-34-56.ngrok-free.app`.
5. Salin URL tersebut untuk dimasukkan ke konfigurasi Vercel di bab berikutnya.

---

## 5. Setup & Deployment Frontend Web ke Vercel

Frontend Web Auto Clipper terletak pada sub-direktori `web/` dan berbasis **React 18 + Vite + Tailwind CSS**.

### Langkah 5.1: Import Repositori ke Vercel

1. Buka dashboard [Vercel](https://vercel.com) dan klik **Add New...** $\rightarrow$ **Project**.
2. Hubungkan akun GitHub Anda dan pilih repositori `auto-clipper` (atau hasil fork Anda).

### Langkah 5.2: Konfigurasi Root Directory & Build Settings

Pada halaman konfigurasi proyek Vercel:
- **Project Name:** `auto-clipper-web` (atau sesuai preferensi Anda).
- **Framework Preset:** `Vite`.
- **Root Directory:** Klik **Edit** dan pilih folder `web` (Penting!).
- **Build Command:** `npm run build` (default).
- **Output Directory:** `dist` (default).
- **Install Command:** `npm install` (default).

### Langkah 5.3: Pengaturan Environment Variable (`VITE_API_URL`)

Buka bagian **Environment Variables** di Vercel dan tambahkan variabel penunjuk backend:

| Nama Variabel | Contoh Nilai Jalur A (Domain Sendiri) | Contoh Nilai Jalur B (Ngrok Gratis) |
|---|---|---|
| `VITE_API_URL` | `https://be-clipper.domainanda.com` | `https://abcd-12-34-56.ngrok-free.app` |

> [!TIP]
> **Tidak Perlu Mengubah Kodingan:**
> File [`web/src/api.ts`](../web/src/api.ts) secara otomatis membaca `import.meta.env.VITE_API_URL`. Anda cukup mengisi variabel ini di Vercel Dashboard tanpa perlu mengotak-atik file kode di Git.
>
> *Catatan:* Jika Anda mengubah nilai `VITE_API_URL` di Vercel di kemudian hari (misal saat URL Ngrok berganti), buka tab **Deployments** $\rightarrow$ klik `...` pada deployment terakhir $\rightarrow$ pilih **Redeploy** agar Vite memperbarui bundle frontend.

### Langkah 5.4: Pengaturan Domain Frontend (Custom Domain vs Default Vercel)

1. **Jalur A (Menggunakan Custom Domain Frontend):**
   - Di Vercel, masuk ke **Settings** $\rightarrow$ **Domains**.
   - Tambahkan domain frontend, misal: `clipper.domainanda.com`.
   - Di DNS Manager Cloudflare Anda, tambahkan CNAME Record:
     - **Name:** `clipper`
     - **Target:** `cname.vercel-dns.com`
     - **Proxy status:** *DNS Only* (abu-abu).
2. **Jalur B (Menggunakan Domain Gratis Bawaan Vercel):**
   - Anda tidak perlu mengatur DNS apapun! Vercel otomatis memberikan URL gratis seperti: `https://auto-clipper-web-xxxx.vercel.app`.
   - Backend FastAPI Auto Clipper secara otomatis mengizinkan seluruh domain `*.vercel.app` tanpa konfigurasi tambahan.

---

## 6. SOP Pengoperasian Harian via Smartphone (4-Step Wizard)

Setelah seluruh infrastruktur terpasang, berikut adalah alur kerja harian untuk memotong video langsung dari smartphone:

```mermaid
sequenceDiagram
    autonumber
    actor User as 📱 Pengguna (Smartphone)
    participant Web as 🌐 Web UI (Vercel)
    participant Colab as 🖥️ Backend Colab (GPU T4)
    participant AI as 🤖 External AI (Gemini / ChatGPT / Claude)

    Note over User,Colab: Sesi Awal
    User->>Web: Buka Web App & Masukkan Access Token
    Web->>Colab: Verifikasi Autentikasi (Bearer Auth)

    Note over User,Colab: Step 1 - Input Video & Visual Styling
    User->>Web: Paste URL Video YouTube + Pilih Style + Subtitle Preset
    Web->>Colab: POST /jobs/manual (URL, canvas_config, subtitle_config)
    Colab->>Colab: Unduh Video (yt-dlp) + Transkripsi Kata (Whisper GPU)
    Colab-->>Web: Status: AWAITING_MANUAL + manual_prompt

    Note over User,AI: Step 2 - Share Prompt ke AI
    Web->>User: Tampilkan Prompt Transkrip
    User->>Web: Klik tombol "📤 Share Prompt" (Web Share API)
    Web->>AI: Buka native share sheet HP -> Kirim ke aplikasi Gemini / Claude
    AI-->>User: AI merespons dengan JSON Highlights Klip Terbaik

    Note over User,Colab: Step 3 - Submit JSON Highlights
    User->>Web: Tempel JSON hasil AI ke textarea Web UI
    User->>Web: Klik tombol "Render Clips"
    Web->>Colab: POST /jobs/{id}/resume-manual (highlights_json)

    Note over User,Colab: Step 4 - Background Processing & Download
    Note over User: 📱 Pengguna bebas menutup browser HP!
    Colab->>Colab: Render FFmpeg NVENC (Face Tracking / Split-Screen / Subtitle Karaoke)
    User->>Web: Buka kembali Web UI saat selesai
    Web->>Colab: GET /jobs/{id} -> Status: DONE
    Web-->>User: Tampilkan Inline Player Video + Tombol Download MP4
    User->>Colab: Unduh MP4 langsung ke Galeri HP
```

---

### Langkah 0: Inisialisasi Sesi & Login
1. Buka notebook Google Colab di browser laptop atau tab HP, lalu klik **Run All**.
2. Buka Web App Anda di browser smartphone (Safari di iOS / Chrome di Android):
   - Contoh URL: `https://clipper.domainanda.com` atau `https://auto-clipper-web-xxxx.vercel.app`.
3. Masukkan **API Secret Token** yang sudah Anda tentukan. Token ini otomatis disimpan di `localStorage` browser Anda.

---

### Step 1: Input URL & Pemilihan Gaya Video
1. **Tempel URL Video**: Masukkan tautan YouTube, TikTok, atau Instagram.
2. **Pilih Gaya Tata Letak (Output Style)**:
   - 🎯 **Face Crop (9:16)**: Memotong video landscape menjadi vertikal dengan pelacakan wajah otomatis (*dynamic face tracking*).
   - 🧊 **Canvas Blur (9:16)**: Menempatkan video utuh di atas latar belakang blur estetik (pilihan blur: *Light*, *Medium*, *Heavy* serta zoom *1.0x - 2.0x*).
   - 🖥️ **Landscape (16:9)**: Mempertahankan rasio horizontal asli.
   - ⬜ **Square (1:1)**: Format persegi untuk feed media sosial.
3. **Pilih Preset Subtitle**:
   - 🎤 **Viral Pop (Default)**: Kata per kata aktif (*single-word pop karaoke*) huruf kapital tebal (Impact/Alex Hormozi style) dengan anti-overlap.
   - 📺 **Podcast**: Subtitle kalimat dengan sorotan kata aktif warna-warni (Montserrat font).
   - 📝 **Classic**: Subtitle kalimat standar elegan (Arial font).
4. Klik tombol **Start Transcription**.

---

### Step 2: Transkripsi Whisper & Share Prompt ke AI
1. Backend Colab akan mengunduh video via `yt-dlp` dan mengekstrak transkrip kata ber-timestamp menggunakan `faster-whisper`.
2. Setelah transkripsi selesai, status job berubah menjadi **`AWAITING_MANUAL`**.
3. Di layar HP Anda akan muncul prompt AI yang sudah diformat lengkap dengan transkrip video.
4. Tekan tombol **📤 Share Prompt**:
   - Browser akan memicu *Web Share API* bawaan sistem operasi smartphone Anda.
   - Pilih aplikasi AI yang Anda gunakan di HP (Google Gemini, ChatGPT, Claude, atau aplikasi Notes).
   - *(Atau gunakan tombol **📋 Copy Prompt** jika ingin menyalin manual).*

---

### Step 3: Submit JSON Highlights dari AI
1. AI pada aplikasi chat Anda akan menganalisis transkrip dan memberikan rekomendasi klip paling viral dalam format JSON, contoh:
```json
[
  {
    "start": 45.2,
    "end": 95.8,
    "title": "Rahasia Sukses Bisnis di Usia Muda",
    "hook_reason": "Pernyataan kontroversial pembicara di awal menit"
  }
]
```
2. Salin teks JSON tersebut dari chat AI.
3. Kembali ke Web App Auto Clipper di HP Anda, tempel ke kolom teks yang disediakan.
4. Klik tombol **🚀 Render Clips**.

---

### Step 4: Background Rendering & Download MP4
1. Backend Colab mulai memotong video, menghitung interpolasi tracking wajah, merender filter kanvas, dan menempelkan subtitle ASS secara presisi dengan GPU hardware acceleration.
2. **Kebebasan Menutup Browser:** Anda **bisa menutup browser smartphone** atau mematikan layar HP. Pemrosesan tetap berjalan aman di Colab.
3. Saat Anda membuka kembali Web App, halaman otomatis memulihkan status job terakhir.
4. Setelah status menjadi **`DONE`**, daftar klip video akan muncul:
   - Putar video langsung di browser menggunakan inline player.
   - Klik tombol **⬇️ Download MP4** untuk menyimpan video langsung ke galeri foto/video smartphone Anda.

---

## 7. Panduan Pemeliharaan, Troubleshooting & FAQ

### Kendala 1: Sesi Google Colab Terputus / Idle Timeout
* **Penyebab:** Google Colab gratis memiliki batas durasi maksimal sesi kontinu dan dapat terputus jika tidak ada aktivitas tab dalam waktu lama.
* **Solusi & Mitigasi:**
  1. Jangan khawatir kehilangan data: semua transkrip, database `history.db`, dan klip yang telah selesai dirender tersimpan permanen di Google Drive Anda.
  2. Buka notebook Colab kembali, klik **Connect / Reconnect**, lalu jalankan kembali seluruh sel (**Run All**).
  3. Buka Web App di HP Anda: sistem akan kembali terhubung ke backend dan mendeteksi riwayat job sebelumnya dari database.

---

### Kendala 2: Error 401 Unauthorized / Token Mismatch
* **Penyebab:** Token yang dimasukkan di Web UI HP tidak sama dengan `API_SECRET_TOKEN` yang berjalan di sel Colab.
* **Solusi:**
  1. Buka menu pengaturan browser HP Anda atau hapus data *local storage* untuk situs web app Anda.
  2. Muat ulang halaman, maka form **AuthGate (Login)** akan muncul kembali.
  3. Masukkan kata sandi yang sesuai dengan yang Anda tuliskan pada sel Colab.

---

### Kendala 3: Error CORS atau Network Connection Failed
* **Penyebab:** Request dari domain frontend diblokir oleh backend, atau tunnel Cloudflare/Ngrok sedang offline.
* **Solusi:**
  1. Pastikan sel backend Colab sedang aktif dan tidak berhenti dengan error.
  2. Uji endpoint `/health` backend di browser untuk memastikan tunnel aktif.
  3. Backend Auto Clipper secara bawaan sudah mengizinkan seluruh domain `*.vercel.app` dan localhost.
  4. Jika Anda menggunakan domain kustom sendiri di luar vercel.app, pastikan Anda telah men-set environment variable `AUTO_CLIPPER_CORS_ORIGIN` di Colab:
     ```python
     os.environ["AUTO_CLIPPER_CORS_ORIGIN"] = "https://clipper.domainanda.com"
     ```

---

### Kendala 4: Memory GPU Penuh (OOM) & Fallback Otomatis NVENC
* **Penyebab:** Video input memiliki resolusi sangat tinggi (4K/60fps) atau durasi transkripsi sangat panjang.
* **Solusi:**
  1. Auto Clipper secara otomatis mendeteksi ketersediaan memori GPU. Jika encoder hardware `h264_nvenc` mengalami kendala, pipeline secara *fail-safe* beralih ke software encoding CPU `libx264`.
  2. Untuk transkripsi video panjang di atas 1 jam, gunakan model Whisper `small` atau `medium` yang ramah memori.

---

### Kendala 5: Manajemen & Pembersihan Kapasitas Google Drive
* **Penyebab:** File video mentah `.mp4` berukuran besar dari YouTube dapat menghabiskan kuota 15 GB Google Drive seiring berjalannya waktu.
* **Solusi Pembersihan:**
  1. Buka Google Drive Anda di browser $\rightarrow$ buka folder `AutoClipperData` $\rightarrow$ `projects`.
  2. Hapus subfolder job proyek lama yang sudah selesai diunduh ke HP.
  3. **Jangan menghapus** file `history.db` jika Anda ingin tetap mempertahankan daftar riwayat klip di aplikasi web.
  4. Kosongkan *Trash / Sampah* di Google Drive Anda untuk membebaskan ruang penyimpanan secara permanen.

---

## 🎯 Kesimpulan

Dengan setup **Auto Clipper Cloud**, Anda memiliki studio klip video otomatis berbasis AI kelas profesional yang 100% mandiri, ditenagai infrastruktur cloud GPU gratis, dan dapat dioperasikan secara fleksibel di mana saja langsung dari genggaman smartphone Anda.
