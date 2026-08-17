# 012 - MediaPipe Face Tracking & UI Configuration

## 1. Konteks & Masalah
Saat memproses klip video dengan format portrait (seperti `9:16`, `4:5`, dan `1:1`), sistem saat ini menggunakan OpenCV Haar Cascades untuk memfokuskan kamera (`crop`) pada wajah subjek utama. Namun, pendekatan ini memiliki beberapa kelemahan:
* **Tidak Akurat untuk Multi-Speaker:** Sistem hanya memilih "wajah paling besar" tanpa mendeteksi siapa yang sebenarnya sedang berbicara.
* **Jittery (Goyang):** Algoritma Haar Cascades menghasilkan kotak deteksi (bounding box) yang tidak stabil antar frame, membuat kamera ikut bergetar.
* **Kurangnya Pilihan:** Beberapa jenis video (seperti Podcast) kadang hanya membutuhkan pemotongan di tengah (Center Crop) yang statis, tetapi pengguna tidak memiliki kontrol untuk memilih mode tersebut.

*Catatan: Keputusan ini me-supersede sebagian dari ADR-003 yang sebelumnya menolak MediaPipe karena beban ukuran dan performa. Peningkatan fitur (Active Speaker) kini dinilai sepadan dengan penambahan ukuran dependensi ringan (~40MB).*

## 2. Solusi & Desain Arsitektur
Sistem pelacakan wajah (*face tracking*) akan ditingkatkan ke arsitektur **Google MediaPipe**, dan antarmuka pengguna (UI) akan ditambahkan opsi konfigurasi pengaturan pelacakan wajah.

### A. Perubahan Frontend (Tauri Desktop & Web UI)
* Menambahkan opsi **Tracking Mode** pada antarmuka (Form Generate Klip Desktop & Web UI) saat pengguna memilih rasio `9:16`, `4:5`, atau `1:1`.
* Opsi ini akan di-*disable* atau disembunyikan secara otomatis jika Canvas Mode (misalnya `canvas_blur`) aktif, karena Face Tracking tidak relevan saat Canvas Mode digunakan.
* **Pilihan Mode:**
  1. **Auto Face Tracking (Active Speaker):** Menggunakan AI untuk mengikuti wajah yang bibirnya bergerak (*smooth tracking*).
  2. **Static Center Crop:** Wajah tetap di tengah tanpa pergerakan kamera (statis).
* Parameter `tracking_mode` akan disisipkan ke dalam request API backend.

### B. Perubahan Backend (Python)
* **MediaPipe Face Mesh:** Mengganti dependensi `cv2.CascadeClassifier` dengan `mediapipe`.
* **Active Speaker Detection (Lip Tracking):** 
  * Mendapatkan landmark bibir (bibir atas dan bawah) dari hasil deteksi MediaPipe.
  * Menghitung variasi *Mouth Aspect Ratio* (MAR) melintasi durasi sampel frame video. 
  * Wajah yang memiliki nilai MAR dengan deviasi/variasi terbesar akan dipilih sebagai pembicara utama (*Active Speaker*).
* **Smooth EMA Stabilization:** Pergerakan kotak wajah akan dihaluskan menggunakan algoritma Exponential Moving Average (EMA).
* **Mode Statis (Center Crop):** Jika `tracking_mode == "center"`, fungsi pemrosesan AI dilompati (`bypassed`) dan sistem langsung mengunci pusat *crop* di rasio `0.5` secara matematis.
* **Backward Compatibility:** Untuk *job history* di database SQLite (`history.db`) yang tidak memiliki field `tracking_mode`, sistem akan *fallback* menggunakan `"auto"` sebagai *default* perlakuan.

## 3. Batasan / Constraints
* Jika MediaPipe gagal memuat model, sistem harus melakukan *fallback* aman (contoh: *fallback* ke `Static Center Crop`).
* Algoritma *Lip Tracking* (MAR) hanya bekerja optimal jika bibir pembicara terlihat jelas di kamera. Jika bibir tidak terdeteksi, sistem otomatis kembali melacak wajah terbesar (fallback normal).
* Mode *Gaming Split-screen* (jika aktif) tetap diprioritaskan menggunakan posisi *facecam* dari MediaPipe, tetapi mengabaikan deteksi suara/bibir (karena facecam statis).
