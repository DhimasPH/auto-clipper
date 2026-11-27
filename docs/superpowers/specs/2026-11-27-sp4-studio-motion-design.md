# Spec SP4 Lanjutan: Auto Clipper Studio, Motion Graphic, Dua Pembicara, Fitur Konten, dan Perawatan

Tanggal: 2026-11-27 · Status: disetujui pemilik 2026-11-27 · Induk: `2026-11-12-enhancement-roadmap.md` (bagian 6) · Sebelumnya: `2026-11-25-sp4-wave1-design.md` (gelombang 1, sudah rilis di 1.19.x)

Dokumen ini adalah **spec payung**. Setiap gelombang (G0 sampai G5 dan Perawatan) mendapat rencana implementasi dan branch sendiri dari `main`, dikerjakan dan direview seperti gelombang 1 (`tasks/HANDOFF-AI.md` bagian 4). Bila rencana sebuah gelombang bertentangan dengan dokumen ini, dokumen ini yang berlaku sampai diubah atas persetujuan pemilik.

---

## 1. Latar

Versi 1.19.2 sudah rilis lengkap di semua platform. Sisa SP4 adalah kelompok besar yang belum dirancang:

1. Klip yang dihasilkan masih "polos": subtitle karaoke satu gaya, watermark teks, B-roll, dan hook video. Kreator membutuhkan motion graphic (subtitle beranimasi, teks hook, efek, logo, intro/outro) supaya klip siap unggah tanpa membuka aplikasi lain.
2. Setelah klip jadi, pengguna hanya bisa mengubah kata dan tampilan subtitle lewat `ClipEditModal`. Mereka tidak bisa memotong ulang, memperbaiki crop yang salah, atau menambah elemen. Pemilik ingin **Auto Clipper Studio**: editor klip setelah jadi.
3. Video podcast dua orang dipotong menjadi satu wajah saja. Pemilik ingin mode dua pembicara yang bisa dipilih per klip.
4. Kandidat roadmap yang dipilih pemilik: terjemahan subtitle, hapus jeda dan kata pengisi, antrean batch dan preset ekspor.
5. Backlog perawatan: update Auto Clipper Web tahap 2 (pasang sendiri) dan Riwayat yang memperbarui daftarnya sendiri.
6. **Bug (laporan pemilik 2026-11-27):** di Google Colab font subtitle kadang tidak sesuai pilihan pengguna.

## 2. Sasaran dan non-sasaran

Sasaran:

- Satu model data per klip (**dokumen edit klip**) yang dipakai render pertama, render ulang, motion graphic, dan Studio.
- Motion graphic bawaan yang ringan dan sama di desktop, web lokal, dan Colab, plus jalur opsional ke Remotion untuk grafis kelas atas.
- Studio di semua platform, versi ringkas di HP.
- Empat perilaku dua pembicara yang dipilih per klip.
- Font yang tampil di hasil selalu sama dengan yang dipilih dan yang tampil di pratinjau.

Non-sasaran (daftar "nanti"):

- Auto-post ke YouTube Shorts, TikTok, Reels (rencana lama `2026-08-10-local-cdp-autopost` tetap di backlog).
- Penyunting multi-klip (menggabungkan beberapa klip menjadi satu video).
- Kolaborasi multi-pengguna dan sinkronisasi brand kit antar perangkat.
- Mengubah updater desktop.

## 3. Keputusan pemilik (2026-11-27)

| Pertanyaan | Keputusan |
|---|---|
| Arti "Auto Clipper Studio" | Editor klip setelah jadi (potong, subtitle, crop, efek, render ulang). |
| Arti "motion graphic" | Keempatnya: subtitle animasi bergaya, teks judul/hook animasi, efek otomatis dari AI, intro/outro brand. Remotion boleh dipakai. |
| Lingkup dokumen | Semua kelompok dirancang dulu menjadi satu dokumen lengkap, termasuk bug font Colab. |
| Platform Studio | Semua platform; HP versi ringkas. |
| Alat Studio versi pertama | Potong & geser waktu, Subtitle & teks, Crop & framing, Lapisan motion graphic, plus **logo sendiri dengan opacity**. |
| Kandidat SP4 lain | Terjemahan subtitle, Hapus jeda & kata pengisi, Antrean batch + preset ekspor. Auto-post ditunda. |
| Mesin motion graphic | **C. Bertingkat**: ASS + FFmpeg bawaan, Remotion sebagai komponen tambahan opsional setelah spike. |
| Dua pembicara | Empat perilaku, dipilih pengguna per klip; bawaan otomatis dari jumlah wajah. |
| Detektor untuk dua pembicara | YuNet (OpenCV, MIT), bukan YOLO (AGPL-3.0 dan butuh PyTorch/onnxruntime). Disetujui pemilik. |
| Lisensi Remotion | Pemilik menilai aman: proyek dimiliki perorangan sehingga masuk Free License (dasar kelayakannya jumlah orang, bukan status open source; Remotion sendiri source-available, bukan open source). Email konfirmasi ke Remotion dianjurkan, bukan syarat. |

## 4. Susunan gelombang

| Gelombang | Isi | Bergantung | Catatan rilis |
|---|---|---|---|
| **G0 · Perbaikan font** | Registri font satu sumber, padanan bebas lisensi, Bold, pratinjau memakai file font yang sama (bagian 5) | - | Bisa rilis sendiri sebagai 1.19.3 |
| **G1 · Dokumen edit klip** | Model data, penerjemah tunggal ke FFmpeg + ASS, migrasi klip lama, aset ber-ID (bagian 6) | G0 | Perilaku pengguna tidak berubah; refaktor jalur render |
| **G2 · Motion graphic native + Dua pembicara** | Gaya subtitle animasi, sorot kata kunci, emoji, teks hook, efek AI, brand kit (logo + opacity, intro/outro), empat mode dua pembicara (bagian 7 dan 8) | G1 | Rilis minor |
| **G3 · Studio** | Halaman editor `/studio/:jobId/:clip`, semua alat, pratinjau JASSUB, render pratinjau 5 detik (bagian 9) | G1, G2 | Rilis minor |
| **G4 · Fitur konten** | Terjemahan subtitle, hapus jeda & kata pengisi, antrean batch, preset ekspor (bagian 10) | G1 (G3 untuk tombol di Studio) | Rilis minor |
| **G5 · Grafis lanjutan (Remotion)** | Spike go/no-go, lalu add-on opsional (bagian 11) | G2, G3 | Hanya bila spike lolos |
| **Perawatan** | Update Web tahap 2, Riwayat refresh sendiri (bagian 12) | - | Boleh diselipkan di gelombang mana pun |

Aturan: satu gelombang aktif pada satu waktu, kecuali butir Perawatan. G4 boleh dimulai sebelum G3 selesai untuk bagian yang tidak butuh Studio (batch, preset ekspor, terjemahan di langkah Siapkan).

---

## 5. G0: Perbaikan font

### 5.1 Penyebab bug (temuan 2026-11-27, belum diuji di Colab nyata)

- `FONTS` di `src/components/ui/SubtitleConfigControls.tsx` menawarkan `Arial`, `Montserrat`, `Impact`, `Roboto`, `Oswald`, `Bebas Neue`, `Courier New`.
- `backend/fonts/` hanya berisi `Anton`, `Bebas Neue`, `Montserrat`, `Oswald`, `Permanent Marker`, `Poppins`, `Roboto`, semuanya hanya **Regular** (nama keluarga di tabel `name` sudah diperiksa cocok).
- Render memanggil `ass=...:fontsdir=backend/fonts`. Di Windows, Arial, Impact, dan Courier New ada di font sistem, jadi hasilnya benar. Colab memakai Linux tanpa font tersebut, sehingga libass memakai font pengganti tanpa peringatan. `Arial` adalah font bawaan (`DEFAULT_SUBTITLE_CONFIG`) dan `Impact` dipakai satu preset.
- Gaya bawaan memakai `Bold=-1`. Tanpa file Bold, libass membuat bold tiruan yang bentuknya berbeda dari pratinjau.
- Pratinjau di browser memakai `style={{ fontFamily }}` sehingga bergantung pada font yang terpasang di perangkat penonton.
- Anton, Poppins, dan Permanent Marker dibawa tetapi tidak pernah ditawarkan.

Probe 2026-11-27 (FFmpeg `ffmpeg-static`, Windows, `-loglevel verbose`) membuktikan sebagian: `fontselect: (Montserrat, 700, 0) -> Montserrat-Regular` (bold tiruan) dan nama tak dikenal jatuh ke `Arial-BoldMT` tanpa peringatan. Penggantian Arial di Linux dibuktikan oleh uji render G0 yang berjalan di CI Linux. Rencana: `docs/superpowers/plans/2026-11-27-sp4-g0-fonts.md`.

### 5.2 Rancangan

- **Registri** `backend/fonts/fonts.json`: daftar `{family, label, files: {regular, bold}, license, aliases: []}`. Ini satu-satunya sumber daftar font.
- **Padanan bebas lisensi** (OFL/Apache, file lisensi ikut disimpan di `backend/fonts/licenses/`): `Arial → Arimo`, `Courier New → Cousine` (metrik identik), `Impact → Anton`. Nama lama ditulis di `aliases`.
- **Bold**: setiap keluarga yang ditawarkan punya file Bold. Keluarga yang memang tidak punya Bold (Anton, Bebas Neue, Permanent Marker) ditandai `bold: null`, dan UI menyembunyikan pilihan tebal untuknya.
- **Backend**: `resolve_font_family(name)` memetakan alias lama ke nama registri, dipanggil di semua generator ASS (`crop_utils.py`). Pengaturan lama di `history.db` tidak diubah; pemetaan terjadi saat render, jadi render ulang riwayat langsung benar.
- **Frontend**: `src/lib/fonts.ts` mengimpor `backend/fonts/fonts.json` dan file `.ttf` lewat `import.meta.glob` saat build (berlaku untuk `build` dan `build:cloud`, tanpa salinan), lalu membuat aturan `@font-face` dengan nama `"AC <keluarga>"` supaya pratinjau tidak pernah memakai font sistem. Pilihan font di UI dan pratinjau hanya dari registri.
- **PyInstaller**: `backend.spec` membundel seluruh `backend/fonts` (file font, `fonts.json`, `licenses/`). Temuan 2026-11-27: folder ini **belum pernah** dibundel, jadi di desktop dan Auto Clipper Web font bawaan aplikasi juga jatuh ke font sistem.

### 5.3 Uji

- pytest: setiap `font_family` yang bisa dipilih ada di registri; alias lama dipetakan; setiap file di registri ada dan nama keluarganya cocok dengan tabel `name`.
- CI Linux: render 1 detik video sintetis (`lavfi`) dengan setiap keluarga registri, regular dan bold, lalu pastikan log libass tidak menunjukkan font pengganti.
- Vitest: `FONTS` lama hilang; UI hanya menampilkan isi registri.

---

## 6. G1: Dokumen edit klip

### 6.1 Lokasi dan siklus hidup

- File `clip_<n>.doc.json` di `project_dir/clips/`. Setelah klip berhasil, dipublikasikan ke pustaka lewat `workspace.publish()` (E.8). Path pustaka disimpan di `result_clips[n].clip_doc_path` (E.9: tidak pernah menunjuk ke work dir).
- Render pertama: pipeline membuat dokumen dulu dari hasil AI, pelacak wajah, dan pengaturan job, baru diterjemahkan menjadi perintah render. Tidak ada jalur render kedua.
- Render ulang, Studio, terjemahan, dan hapus jeda hanya mengubah dokumen lalu menerjemahkannya ulang.
- Klip lama tanpa `clip_doc_path` dibuatkan dokumen otomatis (`synthesize_clip_doc(job, clip)`) dari metadata yang ada, dengan `custom_subtitle_path` diprioritaskan sesuai D.10.

### 6.2 Bentuk dokumen (versi 1)

```json
{
  "version": 1,
  "source": { "job_id": "…", "clip_index": 0, "duration": 1834.2 },
  "segments": [
    { "src_start": 120.40, "src_end": 128.90, "role": "hook" },
    { "src_start": 95.10, "src_end": 141.75, "role": "main" }
  ],
  "framing": {
    "layout": "mix",
    "tracks": { "A": [{ "t": 0.0, "x": 0.31, "y": 0.42, "zoom": 1.0 }], "B": [] },
    "shots": [{ "start": 0.0, "end": 4.2, "view": "A" }, { "start": 4.2, "end": 7.0, "view": "split" }],
    "manual_keys": [],
    "canvas_config": {}
  },
  "subtitles": {
    "enabled": true,
    "words": [{ "w": "Halo", "start": 0.12, "end": 0.40 }],
    "subtitle_config": {},
    "animation": "pop",
    "position": { "x": 0.5, "y": 0.78 },
    "keywords": [3, 9],
    "language": "id",
    "translated_from": null,
    "bilingual": false
  },
  "layers": [
    { "id": "l1", "type": "text", "start": 0.0, "end": 2.5, "source": "ai", "enabled": true,
      "props": { "text": "Ini rahasianya", "role": "hook", "style": "brand_title" } },
    { "id": "l2", "type": "zoom", "start": 12.3, "end": 13.1, "source": "ai", "enabled": true,
      "props": { "to": 1.15 } },
    { "id": "l3", "type": "logo", "start": 0.0, "end": null, "source": "user", "enabled": true,
      "props": { "asset_id": "a_3f9c…", "anchor": "top_right", "scale": 0.18, "opacity": 0.8 } }
  ],
  "brand_kit_id": "default",
  "export_preset": "tiktok"
}
```

- Waktu di `subtitles.words`, `framing`, dan `layers` adalah **waktu timeline** (setelah potongan), bukan waktu sumber. `segments` adalah satu-satunya pemetaan ke waktu sumber.
- `end: null` berarti sampai akhir klip.
- Jenis lapisan: `text`, `logo`, `emoji`, `zoom`, `progress_bar`, `intro`, `outro`, `music`, `sfx`, `broll`, `transition`, dan (G5) `remotion`. B-roll Pexels, watermark teks, dan transisi glitch hook yang sudah ada dipetakan ke lapisan ini.
- Hook video yang sudah ada (`hook_start`/`hook_end`) menjadi segmen `role: "hook"` + lapisan `transition`.

### 6.3 Aset ber-ID, tidak pernah path

- Dokumen **tidak pernah** berisi path file. Logo, musik, SFX unggahan, dan gambar kanvas dirujuk lewat `asset_id`.
- Unggahan masuk ke folder aset aplikasi lewat endpoint unggah aset (nama dari `path_guard.safe_upload_name()`, E.14). Backend menyimpan peta `asset_id → file` dan menyelesaikan ID saat menerjemahkan. ID yang tidak dikenal berarti lapisannya dilewati dengan peringatan.
- Aset bawaan (emoji, SFX, template intro/outro) punya ID tetap berawalan `builtin:`.
- Di Cloud, folder aset mengikuti aturan Drive E.16 (`refuse_unmounted`).

### 6.4 Validasi

- Model Pydantic `ClipDoc` di `backend/clip_doc.py`. Batas: `segments` ≤ 100, `layers` ≤ 200, teks lapisan ≤ 200 huruf, `zoom` 1,0–2,0, `opacity` 0–1, posisi 0–1, semua waktu di dalam durasi.
- Dokumen yang tidak lolos validasi ditolak dengan `AppError("CLIP_DOC_INVALID")`. Isi mentahnya hanya ditulis di `technical`.
- Migrasi versi: `version` dinaikkan bila bentuk berubah, dan `upgrade_clip_doc()` mengubah versi lama saat dibaca.

### 6.5 Penerjemah tunggal

- `compile_clip_doc(doc, ctx) -> RenderPlan` di `backend/clip_compile.py`: fungsi murni tanpa I/O. `RenderPlan` berisi daftar input (sumber + aset), `filter_complex`, teks ASS, peta audio, dan pengaturan encoder dari `export_preset`.
- `render_plan(plan)` adalah satu-satunya yang menjalankan FFmpeg, dengan percobaan NVENC lalu fallback `libx264` (D.8) dan pencatatan `encoder` di `timings`.
- Logika yang sekarang ada di `crop_utils.py` (crop dinamis, kanvas, split gaming, ASS karaoke/standard, watermark) dipindahkan ke fungsi-fungsi kecil yang dipanggil penerjemah. Invarian D.1–D.12 tetap berlaku, dan tesnya ikut dipindah, tidak dihapus.

### 6.6 Endpoint

| Endpoint | Fungsi |
|---|---|
| `GET /jobs/{id}/clips/{n}/doc` | Dokumen klip (dibuat otomatis bila belum ada) + alamat video sumber bertanda tangan (E.17) |
| `PUT /jobs/{id}/clips/{n}/doc` | Simpan draf dari Studio (validasi penuh, tulis atomik `.part` lalu `os.replace`) |
| `POST /jobs/{id}/clips/{n}/rerender` | Sudah ada; kini menerjemahkan dokumen tersimpan |
| `POST /api/assets` / `GET /api/assets` / `DELETE /api/assets/{asset_id}` | Unggah, daftar, dan hapus aset pengguna |

Semua endpoint butuh token, dan semua yang menerima path atau `canvas_config` mematuhi E.14.

---

## 7. G2a: Motion graphic native dan brand kit

### 7.1 Gaya subtitle animasi

- Preset `animation`: `pop` (karaoke sekarang), `bounce`, `rise` (naik), `box` (kotak sorot di belakang kata aktif), `type` (ketik). Semuanya dibuat dengan tag ASS (`\t`, `\fscx`/`\fscy`, `\move`, `\3c`, `\k`) dan tetap menjamin zero-overlap D.4.
- **Sorot kata kunci**: kata dengan indeks di `subtitles.keywords` memakai warna aksen brand dan skala 110%.
- **Emoji**: overlay PNG dari set kurasi sekitar 100 emoji Noto (OFL), disimpan di `backend/assets/emoji/` dengan `index.json`. libass tidak dipakai untuk emoji berwarna. AI hanya boleh memilih dari daftar ini; pilihan lain diabaikan.

### 7.2 Teks hook animasi

- Lapisan `text` dengan `role: "hook"` dari `hook_text` AI, tampil di 2–3 detik pertama area atas, dengan animasi masuk, tahan, dan keluar dari brand kit.
- Bisa dipakai bersama atau tanpa hook video.

### 7.3 Efek otomatis dari AI

- `zoom`: punch-in 1,0 → 1,15 dalam sekitar 0,2 detik, ditahan, lalu kembali, ditumpuk di atas crop pelacak wajah.
- `progress_bar`: garis tipis di tepi bawah atau atas, warna brand.
- `sfx`: whoosh/pop opsional di titik zoom dan emoji, dari set suara kecil bebas lisensi (`builtin:sfx/*`).
- Sakelar di langkah Siapkan: **Efek otomatis: Mati / Halus / Ramai**. *Halus* = teks hook, sorot kata kunci, maksimal 2 zoom, tanpa SFX. *Ramai* = semua usulan AI termasuk emoji dan SFX. Bawaan: *Halus*.

### 7.4 Kolom baru di jawaban AI

Perintah AI (`generate_manual_prompt` dan jalur API key) ditambah kolom **opsional** per klip:

| Kolom | Bentuk | Batas |
|---|---|---|
| `hook_text` | teks | ≤ 60 huruf |
| `keywords` | daftar kata yang ada di ucapan klip | ≤ 8 |
| `emoji` | `[{ "time": detik_relatif, "emoji": "🔥" }]` dari daftar kurasi | ≤ 6 |
| `zoom_moments` | `[detik_relatif]` | ≤ 5 |

- Kolom hilang, rusak, atau di luar batas berarti efek itu tidak dibuat. Tidak pernah menjadi error.
- Validator jawaban AI manual (`src/lib/aiAnswer.ts`) menerima jawaban lama tanpa kolom ini.
- Perintah tetap pendek. Daftar emoji dikirim sebagai satu baris karakter, bukan nama.

### 7.5 Brand kit

- Disimpan di `brand_kits.json` di folder data aplikasi (Cloud: ikut aturan E.16). Bisa lebih dari satu.
- Isi: nama, font judul, font subtitle (hanya dari registri G0), warna utama, warna aksen, logo (`asset_id`, posisi 9 titik, ukuran 5–40% lebar, **opacity 0–100%**), intro dan outro (template native: latar warna atau blur + logo + nama channel + ajakan follow, 1,5–3 detik, nyala/mati), gaya animasi subtitle bawaan.
- Endpoint: `GET/POST /api/brand-kits`, `PUT/DELETE /api/brand-kits/{id}`.
- Watermark teks lama di `subtitle_config` dipindahkan otomatis ke brand kit "Bawaan" saat pertama dibaca, tanpa menghapus nilai lama di riwayat.
- Brand kit dipilih saat Buat klip (langkah Siapkan) dan bisa diganti di Studio. Di Pengaturan ada bagian **Brand** untuk mengelolanya.

### 7.6 Aman gagal

- Overlay yang gagal (aset hilang, emoji tidak dikenal, template rusak) dilewati dengan catatan di `JobWarnings`. Klipnya tetap jadi.
- Semua lapisan lewat jalur NVENC → `libx264` yang sama (D.8).
- **Anggaran waktu**: mode *Halus* menambah ≤ 15% waktu render per klip dibanding 1.19.2, diukur dengan `stage_timer` pada video uji yang sama. Bila terlewati, rencana G2 wajib mencatat Ruling dan opsi optimasinya sebelum lanjut.

---

## 8. G2b: Dua pembicara

### 8.1 Mode

| Nilai `framing.layout` | Label layar | Perilaku |
|---|---|---|
| `track` | Satu orang | Seperti sekarang |
| `split` | Selalu dibagi dua | Dua wajah atas-bawah sepanjang klip |
| `speaker` | Ikuti yang bicara | Satu wajah penuh layar, potong tegas ke yang bicara |
| `mix` | Campur otomatis | Fokus ke yang bicara; bagi dua saat bolak-balik cepat atau bicara bersamaan |

- Pilihan bawaan ada di langkah Siapkan (**Video dua orang**: Otomatis / Satu orang / Selalu dibagi dua / Ikuti yang bicara / Campur otomatis), dan bisa diubah per klip di Studio.
- *Otomatis*: bila terdeteksi dua orang maka `mix`, selain itu `track`.
- Video gaming tetap memakai split gaming D.11, bukan mode ini.

### 8.2 Detektor wajah: YuNet, bukan YOLO

- Mode dua pembicara memakai **YuNet** (`cv2.FaceDetectorYN`, sudah ada di `opencv-python-headless`; model ONNX sekitar 230 KB dari OpenCV Zoo, lisensi MIT). YuNet lebih andal dari Haar untuk wajah miring dan memberi 5 titik wajah, termasuk dua sudut mulut. File model dikunci SHA-256, disertakan di `backend.spec` seperti `haarcascade_frontalface_default.xml` (G.6), dan dimuat lewat `_lazy` (E.21).
- **YOLO ditolak** (pertanyaan pemilik 2026-11-27): YOLO Ultralytics berlisensi AGPL-3.0 yang tidak cocok dengan repo MIT tanpa lisensi enterprise. Model YOLO wajah dalam format ONNX sebenarnya bisa jalan di onnxruntime yang sudah dibundel untuk faster-whisper, jadi alasannya lisensi, bukan ukuran. Kebutuhan kita hanya wajah, dan YuNet sudah ada di OpenCV.
- Haar tetap dipakai untuk mode `track` biasa sampai G2 mengukur apakah YuNet layak menggantikannya di semua mode (waktu per sampel dibandingkan lewat `scripts/benchmark_pipeline.py`).
- Lisensi model YuNet dicek ulang ke OpenCV Zoo saat rencana G2 ditulis.

### 8.3 Deteksi dua orang

- Memakai sampel wajah YuNet pada titik sampel yang sama dengan `sample_face_trajectory`. Posisi tengah-x wajah dikelompokkan menjadi dua jalur (A kiri, B kanan). Dianggap dua orang bila dua jalur muncul bersamaan di ≥ 60% sampel dalam satu shot.
- Analisis **per shot**: pergantian adegan dideteksi dengan filter `scdet` FFmpeg. Shot berisi satu wajah memakai `track`.
- Lebih dari dua wajah: dipilih dua jalur paling konsisten. Keterbatasan ini ditulis di panduan.

### 8.4 Siapa yang bicara

- **Teliti** (mediapipe): bukaan bibir dari landmark wajah.
- **Cepat** (bawaan): energi gerak antar-frame di area mulut yang dibatasi dua titik sudut mulut YuNet.
- Skor visual dikalikan dengan ada/tidaknya kata dari waktu kata Whisper (tidak ada kata = tidak ada yang bicara).
- Histeresis: satu shot minimal 1,5 detik.
- `mix` memakai `split` bila pergantian pembicara lebih cepat dari 3 detik atau dua skor tinggi bersamaan.
- Semua aturan ini fungsi murni di `backend/speakers.py` yang menghasilkan `framing.shots`.

### 8.5 Render

- `split`: dua crop dari sumber yang sama, masing-masing diikuti EMA pelacak wajah, ditumpuk `vstack` (1080×960 + 1080×960). Memakai ulang fungsi split gaming bila memungkinkan.
- Subtitle otomatis berada di garis tengah (seperti margin adaptif D.3), kecuali posisinya diubah pengguna.
- Pergantian shot berupa potongan tegas (tanpa transisi) di versi pertama.

### 8.6 Aman gagal

Deteksi tidak yakin atau wajah hilang di tengah shot: shot itu memakai `track` dengan pelacak biasa, ditambah catatan di `JobWarnings`. Klip tetap jadi.

---

## 9. G3: Auto Clipper Studio

### 9.1 Masuk dan rute

- Tombol **Edit di Studio** di kartu klip (`ClipCard`) dan di halaman proyek menggantikan "Ubah subtitle atau tampilan". `ClipEditModal` dihapus setelah semua fungsinya pindah ke Studio, dan alamat lamanya dialihkan lewat `LEGACY_REDIRECTS` bila ada.
- Rute halaman penuh `/studio/:jobId/:clip`. Tombol kembali menanyakan dulu bila ada draf yang belum dibuat ulang.

### 9.2 Tata letak

- **≥ 768 px**: pratinjau 9:16 di tengah, panel alat di kanan, timeline di bawah dengan jalur Potongan, Kamera, Subtitle, dan Lapisan.
- **< 768 px**: pratinjau di atas (sticky), satu baris tab alat **Potong · Teks · Crop · Efek · Brand**, panel alat di bawahnya. Timeline diringkas menjadi satu jalur dengan pegangan awal/akhir dan penanda lapisan. Area sentuh minimal 44 × 44 px, pegangan timeline minimal 44 px lebar sentuh.
- Aturan desain SP2 (F.5) berlaku: satu tombol terisi per layar (**Buat ulang klip**), token warna, mode terang dan gelap, keyboard (spasi = putar/jeda, panah = geser 1 frame/0,1 detik, `Ctrl+Z`/`Ctrl+Shift+Z`).

### 9.3 Alat

1. **Potong**: pegangan awal/akhir yang boleh melebar ke video sumber (dibatasi durasi sumber), **Potong di sini**, **Hapus bagian ini**, **Rapikan jeda** (G4).
2. **Teks**: edit kata (pindahan dari `ClipEditModal`, termasuk koreksi AI manual dan API key), geser posisi subtitle X/Y langsung di pratinjau, gaya animasi, tambah teks bebas dengan waktu tampil, edit teks hook, bahasa subtitle (G4).
3. **Crop**: layout (Satu orang / Selalu dibagi dua / Ikuti yang bicara / Campur otomatis / Kanvas / Manual), jalur **Kamera** untuk mengganti tiap shot ke Orang A, Orang B, atau Bagi dua dan menggeser batasnya, mode Manual (geser dan zoom kotak crop, **Tandai di sini** membuat titik kunci), dan **Perbaiki bagian ini** untuk menimpa jalur pelacak di rentang tertentu.
4. **Efek**: daftar lapisan (AI dan pengguna) dengan sakelar, geser waktu, dan hapus; tambah emoji, zoom, SFX, progress bar, musik latar (aset unggahan, volume, peredam otomatis saat orang bicara memakai waktu kata).
5. **Brand**: pilih brand kit, atur logo (posisi, ukuran, opacity) untuk klip ini, intro/outro nyala/mati.

### 9.4 Pratinjau

- `<video>` sumber lewat alamat bertanda tangan (`useSignedVideo`, E.17). Saat diputar, bagian di luar `segments` dilompati.
- Crop, zoom, dan split ditiru dengan transform CSS dan dua elemen video untuk split.
- Subtitle digambar **JASSUB** (libass WebAssembly) dari teks ASS yang sama dengan yang dihasilkan penerjemah, dengan font dari registri G0. Teks ASS untuk pratinjau dibuat di frontend dari dokumen oleh port kecil penerjemah ASS (`src/lib/studioAss.ts`) yang diuji silang dengan keluaran backend memakai fixture yang sama.
- Logo, emoji, teks bebas, dan progress bar digambar sebagai overlay HTML/CSS.
- **Lihat hasil 5 detik**: `POST /jobs/{id}/clips/{n}/preview {t}` merender 5 detik di sekitar posisi putar sebagai job ringan lewat antrean (E.10) dan mengembalikan alamat video bertanda tangan. Bila antrean sedang dipakai, layar menulis "Menunggu proses lain selesai".
- JASSUB dimuat lazy hanya di rute Studio. Lisensi JASSUB dan ukuran WASM-nya dicek di rencana G3; bila tidak cocok, pratinjau subtitle memakai tiruan CSS dan tombol **Lihat hasil 5 detik** menjadi jaminan kesamaan.

### 9.5 Simpan dan render

- Perubahan disimpan otomatis ke draf lewat `PUT .../doc` (debounce 1 detik). **Batalkan/Ulangi** tersedia di dalam sesi (tumpukan di memori, maksimal 100 langkah).
- **Buat ulang klip** membuat job render satu klip. Klip lama baru diganti setelah render sukses (publish atomik). Bila gagal, klip lama tetap dan kartu error muncul lewat `ErrorCard`.
- Logika layar di fungsi murni `src/lib/studio*.ts` (hitungan timeline, pemetaan waktu sumber ↔ timeline, titik kunci, shot, tumpukan batalkan/ulangi) sesuai F.10. Komponen di `src/components/studio/`, halaman di `src/pages/StudioPage.tsx`, namespace locale baru `studio` masuk `MAIN_NAMESPACES`.

---

## 10. G4: Fitur konten

### 10.1 Terjemahan subtitle

- Pilihan **Bahasa subtitle** di langkah Siapkan dan di Studio. Mode: *ganti* atau *dua bahasa* (dua baris, `bilingual: true`).
- Diterjemahkan per **potongan kalimat** (rekonstruksi kalimat yang sudah ada di `words_to_standard_ass`). Waktu potongan diambil dari kalimat asli, lalu waktu tiap kata hasil terjemahan dibagi menurut panjang huruf di dalam potongan, sehingga karaoke tetap jalan dan zero-overlap terjaga.
- Endpoint: `POST /jobs/{id}/clips/{n}/translate {target_lang, mode}`. Dengan provider ber-API key, backend menerjemahkan langsung. Dengan `manual_ai` (E.20), backend mengembalikan `{prompt}`, lalu jawaban yang ditempel dikirim ke `POST .../translate/answer`.
- Jawaban dicek di frontend (`src/lib/aiAnswer.ts`) dan di backend: jumlah potongan harus sama. Bila tidak, tampil `TRANSLATE_ANSWER_INVALID`.
- Teks asli disimpan di `translated_from` sehingga bisa dikembalikan.
- Untuk batch dan Buat klip, terjemahan dijalankan per klip setelah klip jadi dan sebelum render akhir. Di jalur AI manual, perintah terjemahan digabung dengan perintah pemilihan momen bila memungkinkan supaya pengguna tidak menempel dua kali. Bila tidak memungkinkan, ada langkah tempel kedua yang jelas.

### 10.2 Hapus jeda & kata pengisi

- Dari waktu kata Whisper. Ambang jeda: *Halus* 0,8 dtk, *Sedang* 0,6 dtk, *Rapat* 0,4 dtk. Setiap jeda yang dipotong menyisakan 0,15 dtk agar ucapan tidak terdengar terpotong.
- Kata pengisi berdiri sendiri dari daftar per bahasa di `backend/fillers.json` (id: *eh, ehm, em, anu*; en: *um, uh, erm*). Kata ambigu seperti *like* atau *apa* tidak masuk daftar.
- Hasilnya perubahan `segments` (fungsi murni `tighten_segments(doc, level)`); subtitle, `framing`, dan `layers` dipetakan ulang. Klip yang menjadi lebih pendek dari 3 detik tidak dipotong lagi.
- Di setiap sambungan ada crossfade audio sekitar 20 ms.
- Tersedia di langkah Siapkan (**Rapikan jeda: Mati / Halus / Sedang / Rapat**, bawaan Mati) dan sebagai tombol di Studio (bisa dibatalkan).

### 10.3 Antrean batch

- Langkah 1 Buat klip menerima beberapa link atau file sekaligus (maksimal 20). Semua memakai pengaturan langkah Siapkan yang sama.
- `POST /jobs/batch` membuat satu proyek per video dengan `batch_id` yang sama, semuanya lewat `job_queue` (E.10).
- Di mode AI manual, proyek yang menunggu jawaban (`AWAITING_MANUAL`) tidak menahan proyek lain. Riwayat mengelompokkan proyek per batch dan menampilkan "N menunggu jawaban AI" dengan tombol untuk menjawab satu per satu.
- Di Cloud batasnya sama, dengan catatan bahwa runtime Colab bisa terputus. Proyek yang belum mulai tetap tersimpan sebagai antre dan bisa dilanjutkan dengan Resume.

### 10.4 Preset ekspor

- `backend/export_presets.json`: `tiktok`, `shorts`, `reels`, `original`. Isi: rasio, resolusi, fps, bitrate video, bitrate audio, target kenyaringan (sekitar −14 LUFS lewat `loudnorm`), dan batas durasi.
- Batas durasi tiap platform **wajib dicek ulang ke sumber resmi saat rencana G4 ditulis**, karena sering berubah.
- Klip yang melewati batas diberi peringatan di kartu klip dan di Studio, tidak dipotong diam-diam.
- Dipilih di langkah Siapkan (bawaan dari pilihan terakhir) dan bisa diganti per klip di Studio.

---

## 11. G5: Grafis lanjutan (Remotion)

### 11.1 Fakta lisensi dan runtime (dibaca dari remotion.dev 2026-11-27)

- Free License berlaku untuk perorangan dan organisasi maksimal 3 orang, termasuk pemakaian komersial. Pengguna yang hanya menerima video hasil render tidak perlu lisensi.
- Distribusi di aplikasi desktop diizinkan bila ada lapisan perantara sehingga pengguna akhir tidak bisa mengedit atau mengunggah kode Remotion.
- Teks lisensi tidak membahas secara tegas pengembang perorangan yang bekerja di perusahaan lain. Pemilik menilai proyek ini miliknya pribadi sehingga masuk Free License (keputusan 2026-11-27). Konfirmasi ke hi@remotion.dev dianjurkan; bila struktur kepemilikan berubah (lebih dari 3 orang atau dimiliki badan usaha), lisensi dinilai ulang sebelum rilis.
- Render butuh Node.js + Chrome Headless Shell (diunduh terpisah). Platform: Windows x64, macOS x64/arm64, Linux x64/arm64 dengan glibc ≥ 2.35.
- Video transparan didukung: VP8/VP9 `yuva420p` atau ProRes 4444.
- `@remotion/player` untuk pratinjau; pratinjau tidak dihitung sebagai render.

### 11.2 Spike (gerbang go/no-go)

Ukur tiga template (teks hook, lower third, intro) di 1080×1920 30 fps pada Windows CPU dan Colab. Kriteria lolos:

- overlay 3 detik selesai ≤ 15 detik di Colab,
- ukuran add-on (Node portabel + Chrome Headless Shell + bundel komposisi) ≤ 250 MB,
- glibc Colab ≥ 2.35.

Tidak lolos: G5 dibatalkan, dicatat di ledger, semua template tetap native.

### 11.3 Bila lolos

- Komponen tambahan `remotion` di `PINNED_ADDONS` (E.21): Node, Chrome Headless Shell, dan bundel komposisi yang sudah jadi, semuanya terkunci versi, ukuran, dan SHA-256. Unduh dan hapus dari Pengaturan (Desktop, Web Lokal). Di Colab dipasang oleh langkah notebook ke folder di luar Drive, seperti `install_colab_mediapipe()`.
- Backend memanggil skrip Node lewat subproses dengan props JSON di stdin. Stdout dan stderr subproses ditangkap ke log, tidak pernah diteruskan ke stdout backend (A.2).
- Keluaran WebM VP9 `yuva420p`, lalu ditumpuk oleh `render_plan` sebagai lapisan `remotion`.
- Setiap template Remotion punya pasangan native. Tanpa add-on, atau bila render Remotion gagal, otomatis memakai versi native dengan catatan di `JobWarnings`.
- Pratinjau Studio memakai `@remotion/player` sebagai chunk lazy yang hanya dimuat bila add-on terpasang.
- Pengguna tidak pernah melihat atau mengedit kode komposisi; mereka hanya mengisi props (teks, warna, logo) lewat UI.

---

## 12. Perawatan

### 12.1 Update Auto Clipper Web tahap 2

- Zip paket web ditandatangani di CI (`web-package.yml`) dengan kunci updater yang sama dengan desktop. Kunci publik ditanam di aplikasi.
- `POST /api/update/install` (web lokal saja, token): unduh zip OS yang cocok dari tautan yang lolos aturan E.23, verifikasi tanda tangan, ekstrak ke folder versi baru di samping versi lama. Tanpa tanda tangan sah: `UPDATE_SIGNATURE_INVALID`, tidak ada yang dipasang.
- Peluncur (`scripts/web_launcher.py` dan skrip `.bat`/`.sh`/`.command`) menukar folder saat aplikasi dibuka ulang dan menyimpan satu versi lama. Bila versi baru gagal menyala (tidak menjawab `/health` dalam 30 detik), peluncur kembali ke versi lama.
- Data pengguna di folder data aplikasi tidak tersentuh.
- Pustaka verifikasi tanda tangan (format minisign/ed25519) ditentukan di rencana; syaratnya tidak menambah import berat saat startup (E.21 `_lazy`).

### 12.2 Riwayat memperbarui daftar sendiri

`ProjectsPage` memuat ulang daftar setiap 5 detik selama ada proyek berstatus antre atau berjalan, berhenti bila tidak ada, dan jeda saat tab tersembunyi (`document.visibilityState`). Keputusan "perlu polling?" ada di `src/lib/projectStatus.ts`.

---

## 13. Penanganan error

Kode baru di `backend/errors.py` (E.12), masing-masing dengan `title`/`message` id dan en berbahasa awam serta aksi dari `_ACTIONS`:

| Kode | Kapan | Aksi |
|---|---|---|
| `CLIP_DOC_INVALID` | Dokumen klip tidak lolos validasi | Muat ulang Studio |
| `PREVIEW_RENDER_FAILED` | Render pratinjau 5 detik gagal | Coba lagi |
| `TRANSLATE_ANSWER_INVALID` | Jawaban terjemahan tidak cocok | Tempel ulang / salin perintah lagi |
| `ASSET_MISSING` | Aset yang dirujuk hilang saat render ulang dari Studio (render otomatis cukup peringatan) | Pilih ulang aset |
| `UPDATE_SIGNATURE_INVALID` | Tanda tangan zip update tidak sah | Unduh manual dari halaman rilis |
| `REMOTION_*` | Kegagalan add-on Remotion (pola kode add-on yang sudah ada) | Sesuai pola add-on |

Kegagalan efek saat render otomatis tidak pernah menggagalkan klip; cukup catatan di `JobWarnings`.

## 14. Invarian baru untuk `.agents/AGENTS.md`

1. `clip_doc.json` adalah satu-satunya sumber render ulang klip. Semua render lewat `compile_clip_doc` → `render_plan`.
2. `compile_clip_doc` murni (tanpa I/O, tanpa waktu sistem, tanpa acak) dan diuji snapshot.
3. Dokumen klip tidak pernah berisi path file; aset lewat `asset_id`.
4. Kolom efek dari AI selalu opsional; jawaban lama tanpa kolom itu tetap sah.
5. Emoji hanya dari set kurasi; font hanya dari registri `backend/fonts/fonts.json`.
6. Waktu di dokumen adalah waktu timeline; `segments` satu-satunya pemetaan ke waktu sumber.
7. Stdout subproses Node/Remotion tidak pernah sampai ke stdout backend.
8. `canvas_config`, `subtitle_config`, dan kini `brand_kit_id`, `export_preset`, `framing.layout` dipropagasikan di semua jalur pembuat job dan resume (perluasan D.6).

## 15. ADR

- **ADR-017**: Dokumen edit klip dan penerjemah render tunggal (G1).
- **ADR-018**: Motion graphic bertingkat: native ASS + FFmpeg, Remotion sebagai add-on opsional (G2, G5).
- **ADR-019**: Auto Clipper Studio: rute, pratinjau JASSUB, render pratinjau lewat antrean (G3).
- **ADR-020**: Update Auto Clipper Web bertanda tangan dan penukaran folder oleh peluncur (Perawatan).
- Registri font (G0) dicatat sebagai bagian ADR-017 bila tidak butuh ADR sendiri.

## 16. Pengujian

- **pytest**: snapshot `RenderPlan` per jenis lapisan dan per layout; migrasi klip lama ke dokumen (dengan dan tanpa `custom_subtitle_path`); zero-overlap setelah potong, hapus jeda, dan terjemah; pemetaan ulang waktu; parser kolom AI yang toleran; validasi `ClipDoc` (batas, waktu di luar durasi, aset tak dikenal); `speakers.py` dengan data sintetis (pengelompokan, histeresis, aturan `mix`); endpoint baru dengan `path_guard` dan token; brand kit dan aset di mode Cloud dengan Drive belum ter-mount.
- **Render nyata di CI Linux**: video sintetis `lavfi` (termasuk dua kotak "wajah" bergantian bergerak) melewati `render_plan`: durasi, jumlah stream, tidak ada font pengganti di log libass.
- **Vitest**: `src/lib/studio*.ts`, `src/lib/fonts.ts`, `studioAss.ts` diuji silang dengan fixture backend, validator jawaban terjemahan, polling Riwayat, `plainWords` dan `contrast` untuk kunci dan token baru.
- **Browser**: Studio, langkah Siapkan baru, Pengaturan Brand, di 360/768/1280, terang dan gelap, keyboard, tanpa scroll ke samping, target ≥ 44 px.
- **Waktu**: `scripts/benchmark_pipeline.py` sebelum dan sesudah G1 dan G2 (anggaran bagian 7.6). G1 tidak boleh memperlambat render lebih dari 5%.

## 17. Dokumen yang diperbarui per gelombang

README (fitur baru), `docs/panduan-penggunaan-awam.md` (Studio, efek, brand, dua pembicara, terjemahan, batch), `docs/tutorial-auto-clipper-cloud.md` + notebook (G0 font, G5 langkah add-on), `CHANGELOG.md`, `.agents/AGENTS.md` (bagian 14 dokumen ini), ADR, `tasks/roadmap-todo.md`, `tasks/HANDOFF-AI.md`, ledger per gelombang.

## 18. Risiko dan pertanyaan terbuka

| Risiko / pertanyaan | Penanganan |
|---|---|
| Refaktor render G1 merusak perilaku lama | Tes D.1–D.12 dipindah utuh; snapshot sebelum/sesudah pada video uji; G1 tidak menambah fitur |
| Pratinjau Studio tidak sama dengan hasil | JASSUB + font registri + tes silang ASS; tombol **Lihat hasil 5 detik** |
| Studio berat di HP murah | Pratinjau memakai video sumber (bukan render), JASSUB lazy, timeline ringkas; diukur di cek browser 360 px |
| Deteksi pembicara mode Cepat (YuNet + gerak mulut) kurang akurat | Shot bisa dikoreksi satu ketukan di Studio; Teliti dianjurkan untuk podcast |
| Lisensi Remotion untuk pemilik | Masuk Free License selama proyek milik perorangan; dinilai ulang bila kepemilikan berubah |
| Lisensi dan ukuran JASSUB | Dicek di rencana G3; ada cadangan tiruan CSS |
| Batas durasi platform berubah | Satu tabel konfigurasi, dicek saat rencana G4 |
| Perintah AI manual makin panjang | Kolom efek opsional dan ringkas; uji panjang perintah di tes |
| Pustaka tanda tangan update | Ditentukan di rencana Perawatan, wajib lazy |
