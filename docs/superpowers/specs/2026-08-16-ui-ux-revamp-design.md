# Auto Clipper UI/UX Revamp Design Spec (Revised)

## 1. Visi & Tujuan
Merombak antarmuka pengguna (UI) dan pengalaman pengguna (UX) Auto Clipper agar terasa lebih profesional, *enterprise-level*, dan intuitif tanpa menghilangkan satu pun fitur yang sudah ada. 

Fokus utama desain adalah menjauhi estetika klise AI ("AI Slop" seperti gradien ungu/neon berlebihan) dan beralih ke desain *dashboard* yang tenang, kokoh, dan berpusat pada alur kerja (*workflow-centric*). Desain ini akan sangat selaras dengan identitas merek asli (Logo menggunakan warna Blue `#3B82F6` dan Slate `#0F172A`).

## 2. Bahasa Visual (Design Language) & Token
- **Warna Dasar (Dark Mode Premium)**: Skala *zinc-900* ke *black* murni untuk background utama (`#09090b` hingga `#18181b`), untuk mengurangi kelelahan mata. Splash screen yang sebelumnya *light* akan diubah menjadi *dark* agar transisi ke dalam aplikasi mulus.
- **Warna Aksen**: Diselaraskan dengan warna logo yaitu **Blue `#3B82F6`** (bukan lagi Indigo). Digunakan hanya untuk elemen interaktif (tombol utama, *toggle on*, teks *link*), indikator status, dan elemen *branding*.
- **Tipografi**: Mempertahankan font **Outfit** yang sudah ada, namun mengoptimalkan penggunaan *font-weight* (Medium 500 untuk *labels*, Bold 700 untuk *headings*, Regular 400 untuk *body*) dan *letter-spacing* yang presisi agar terkesan lebih profesional.
- **Komponen & Material**:
  - *Hairline borders* (`rgba(255,255,255,0.08)`) pada kartu dan *bento grid*.
  - Menghilangkan *drop-shadow* berwarna neon. Menggunakan *soft black shadows* untuk kedalaman (depth).
  - *Subtle Glassmorphism* (efek *blur* tipis) pada *Header*, *Sidebar Collapse*, dan *Drawers*.
- **Micro-Interactions**: Animasi transisi yang halus (150ms-200ms) pada komponen *hover*, klik tombol, dan pembukaan *drawer*.

## 3. Struktur Tata Letak Utama (Global Layout)
### 3.1. Navigasi SaaS-Style (Sidebar Kiri)
- Sidebar bersih dengan menu utama: **New Workspace**, **History**, **Settings**, dan **Help/Community**.
- **Collapsible**: Terdapat tombol *toggle* kecil di bawah (atau *hover* otomatis) untuk melipat sidebar menjadi hanya ikon, memberikan ruang maksimal saat mengedit klip. State disimpan di `localStorage`.
- **Top Header**: Header kontekstual minimalis (tanpa *background* solid tebal, menggunakan *glassmorphism*). Menampilkan *breadcrumbs* dan indikator *backend health* (Blue/Green *pulsing dot*).

## 4. Komponen Halaman Utama
### 4.1. Unified Workspace (Halaman "New Job")
Menggabungkan halaman *Workspace (AI Clipper)*, *Manual AI Editor*, dan *Manual Downloader* ke dalam satu alur yang terpusat.
- **Tahap 1 (Input)**: Layar bersih terpusat untuk memasukkan URL YouTube atau *Upload* file lokal.
- **Tahap 2 (Mode Selection)**: Tiga kartu elegan untuk memilih tipe *Job* (Auto AI, Manual AI Prompter, Full Downloader).
- **Tahap 3 (Bento Grid Config)**: Panel konfigurasi (Aspect Ratio, Subtitle, Canvas) diatur dalam *grid* yang rapi. Khusus untuk komponen kompleks seperti `SubtitleConfigControls` dan `CanvasConfigControls`, mereka akan diletakkan di kartu *bento* terpisah yang luas agar *live preview* dan *color picker* tetap mudah diakses.
- **CTA**: Tombol "Start Processing" di bawah kanan, kokoh dengan warna Blue `#3B82F6`.

### 4.2. History & Project Management
- **Project Overview**: Tampilan *History* dirombak menjadi daftar/Tabel proyek bergaya *dashboard* (Judul, Durasi, Mode, Status, Aksi). Tidak ada lagi tumpukan kartu klip horizontal yang berantakan di halaman utama.
- **Project Detail Drawer**: Mengklik proyek akan membuka panel samping (*Drawer*) dari kanan. Di sinilah klip hasil, *AI Correction Panel*, dan *Rerender Panel* ditampilkan dengan rapi tanpa menutupi seluruh layar.

### 4.3. Settings & Help Page
- **Settings**: Tata letak disesuaikan dengan gaya *Bento Grid*. Pengaturan dikelompokkan dalam kartu-kartu elegan (Appearance, AI Provider, Whisper, Output).
- **Help Page**: Tab *Terminal Logs* (untuk `backend_app.log`, dll) dirombak. *Syntax highlighting* pada terminal akan dipertajam dengan warna khas *developer tool* modern (VScode-style) dengan *font monospace* yang lebih nyaman dibaca. Tab *User Guide* akan dirapikan tipografinya.

## 5. Rombakan Splash Screen & Landing Page
- **Splash Screen**: Logo *crop* minimalis tetap dipertahankan namun disesuaikan dengan tema gelap (Dark Theme). *Progress bar* dibuat sangat halus dengan warna Blue `#3B82F6`.
- **Landing Page (Dari Linktree ke Hero/Welcome Screen)**:
  - Landing page bergaya *Linktree* (kartu putih dengan daftar sosmed) akan dirombak.
  - Halaman diubah menjadi **Welcome Screen** *enterprise* yang elegan (tetap Dark Mode). Menampilkan sapaan heroik, logo Auto Clipper, dan sebuah tombol CTA besar "Go to Workspace".
  - Tautan *Social Media* (TikTok, YouTube, Discord, dll) dipindahkan ke bagian *Footer* Welcome Screen, *Sidebar* bawah, atau ditambahkan ke tab baru di halaman **Help/Community**. Ini menghilangkan kesan aplikasi main-main dan meningkatkan kecepatan akses kerja pengguna.

## 6. Rombakan Modal Kompleks (UI Intervensi)
- **ClipEditModal & ClipRerenderModal**: Ditingkatkan dari *popup modal* tradisional menjadi **Side-Panel Editor** atau **Immersive Full-Screen Overlay**. Ini memberikan ruang lapang bagi pratinjau video di sebelah kiri dan *timeline* teks/konfigurasi di sebelah kanan, layaknya aplikasi NLE (Non-Linear Editor).
- **SocialKitModal**: Menggunakan *slide-out drawer* atau modal yang sangat terstruktur (Bento-style) untuk merapikan bagian judul, hashtag, dan jadwal *posting*.
- **BusyOverlay (Proses Berjalan)**: Dipertajam dengan estetika *glassmorphism* tebal (`backdrop-blur`). Indikator proses akan lebih informatif tanpa terasa menyumbat layar.
