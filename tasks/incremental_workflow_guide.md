# Panduan Workflow: Incremental Implementation
**Project: Auto Clipper**

Dokumen ini menjelaskan bagaimana kita (AI dan User) akan bekerja sama mengeksekusi `tasks/todo.md` menggunakan pendekatan *Incremental Implementation* (bertahap).

---

## 🔄 Siklus Kerja (The Loop)

Setiap task di dalam Todo list akan melewati **1 Siklus** yang berulang secara konsisten:

### 1. 🎯 Pick & Target (Fokus)
- Saya (AI) akan memilih **hanya 1 atau 2 task kecil** dari `todo.md`.
- *Contoh: Hanya mengerjakan Task 1.4 (Simpan Settings ke localStorage).*
- Saya tidak akan menyentuh file atau logic lain yang tidak relevan dengan task tersebut.

### 2. 🛠️ Execute (Eksekusi Kode)
- Saya akan menganalisis file yang terlibat (misal: `App.tsx`).
- Saya akan melakukan *edit* langsung ke dalam file tersebut (menulis kode).
- Perubahan diusahakan sekecil dan se-efisien mungkin.

### 3. ✅ Verify (Pengujian Lokal)
- Saya akan memberitahu kamu bahwa kode sudah ditulis.
- **Peran Kamu:** Kamu cukup menekan `Ctrl+S` (jika belum tersimpan), memastikan aplikasi berjalan (`npm run electron:dev`), dan mengetes apakah fitur tersebut jalan di UI kamu.
- Jika ada *error* (misal: layar putih atau tombol tidak merespon), kamu tinggal lapor ke saya ("Error layarnya putih") beserta log errornya. Saya akan langsung perbaiki di titik itu juga (Systematic Debugging).

### 4. 📦 Checkpoint (Simpan Progres)
- Jika pengujian sukses, saya akan mencentang `[x]` pada task tersebut di `tasks/todo.md`.
- **Peran Kamu:** (Opsional tapi disarankan) Kamu melakukan *Git Commit* kecil. Misal: `git commit -m "feat: simpan API key ke localstorage (Task 1.4)"`.
- Ini menjamin jika task selanjutnya merusak aplikasi, kamu bisa dengan mudah `git reset` atau *Undo* ke posisi ini.

### 5. ➡️ Next (Lanjut)
- Kita pindah ke task selanjutnya di daftar, dan mengulang siklus dari nomor 1.

---

## 💡 Contoh Simulasi (Fase 1)

**Kondisi Awal:** Aplikasi menyala, tapi belum ada notifikasi OS.

1. **AI:** *"Mari kita kerjakan Task 1.2 (Notifikasi OS). Saya akan mengedit App.tsx untuk menambah Notification API."*
2. **AI:** (Mengedit file) *"Selesai! Silakan coba jalankan 1 klip video, apakah muncul notifikasi di pojok kanan bawah desktop kamu?"*
3. **User:** (Mencoba) *"Iya muncul, tapi teksnya kepotong."*
4. **AI:** *"Oke, saya ubah teksnya agar lebih ringkas."* (Mengedit lagi). *"Coba lagi?"*
5. **User:** *"Sip, udah pas."*
6. **AI:** *"Mantap! Task 1.2 saya centang. Jangan lupa di-commit ya. Sekarang kita lanjut ke Task 1.3 (FAQ Modal)..."*

---

## ⚖️ Keuntungan Model Ini untuk Auto Clipper

| Pendekatan *Big Bang* (Borongan) | Pendekatan *Incremental* (Bertahap) |
|-----------------------------------|--------------------------------------|
| Merubah 5 file sekaligus | Merubah 1 file dalam 1 waktu |
| Aplikasi sering *crash* total dan susah dicari penyebabnya | Aplikasi selalu bisa dipakai, error mudah dilacak |
| Boros token jika harus *retry* karena banyak kode yang di-generate ulang | Output token lebih irit karena hanya menulis blok kode yang spesifik |
| Risiko tinggi memicu *zombie process* Python di background Windows kamu | Sangat aman, pergerakan terkontrol |

---

## 🚀 Kesimpulan
Kita tidak sedang membangun ulang aplikasi, kita sedang menyusun kepingan lego satu per satu. Pendekatan ini dijamin membuat proses *coding* kita lebih santai, minim stres, dan kamu punya kontrol penuh atas apa yang terjadi pada *source code* milikmu.
