# 005. Configurable Whisper Models and VAD Integration

Date: 2026-08-02

## Context
Akurasi transkrip subtitle pada Auto Clipper terkadang menghasilkan kata-kata terlewat (*missed words*) atau *typo*, terutama pada audio dengan istilah teknis, noise latar belakang, atau aksen tertentu. Sebelumnya, model STT *faster-whisper* di-hardcode ke ukuran model `small`. Pengguna memerlukan fleksibilitas untuk memilih model yang lebih akurat (seperti `medium` atau `large-v3`) melalui menu Settings dengan default tetap `small`. Selain itu, proses transkripsi harus tetap stabil tanpa halusinasi audio (menggunakan Silero VAD) dan harus memiliki perlindungan *offline-first* di mana model yang belum diunduh tidak dapat dipilih jika tidak ada koneksi internet.

## Decision
1. **Model Registry & Status Inspection**:
   - Menambahkan registry model yang didukung (`small`, `medium`, `large-v3`) di `backend/ai_utils.py` dengan metadata ukuran file dan rekomendasi VRAM.
   - Menyediakan fungsi `get_available_whisper_models()` yang memeriksa direktori cache Hugging Face (`faster-whisper` snapshot cache) secara offline untuk menentukan apakah model sudah terunduh secara lokal.
2. **Explicit Model Download & Strict Offline-First Guard**:
   - Menyediakan endpoint `POST /api/settings/whisper-models/download` untuk mengunduh model secara eksplisit saat pengguna terhubung ke internet.
   - Menjalankan `WhisperModel(model_size, ..., local_files_only=True)` untuk model non-default agar tidak pernah mencoba mengunduh diam-diam saat job berjalan jika koneksi offline/tidak stabil.
3. **VAD Filter Integration**:
   - Mengaktifkan `vad_filter=True` pada `transcribe_with_faster_whisper()` dengan parameter `min_silence_duration_ms=500` untuk memangkas jeda hening dan mencegah halusinasi/pengulangan teks.
4. **End-to-End Parameter Propagation**:
   - Memperbarui seluruh alur pemanggilan job (`create_job`, `create_manual_job`, `create_rerun_ai_job`, `create_resume_job`, dan `create_rerender_job`) di `backend/jobs.py` dan `backend/main.py` untuk menerima parameter `whisper_model`.
5. **Frontend Settings UI & i18n**:
   - Membuat komponen `TranscriptionSection.tsx` di halaman Settings untuk memilih model Whisper terunduh atau mengunduh model baru.
   - Mendukung teks bilingual penuh (`id.json` & `en.json`) dengan tips performa/VRAM.

## Alternatives Considered
1. **Auto-download on Job Start**: Ditolak karena jika koneksi internet pengguna terputus atau lambat saat proses pembuatan klip berlangsung, job akan hang/gagal secara tidak terduga. Pendekatan unduhan eksplisit di Settings dengan `local_files_only=True` menjamin stabilitas eksekusi.
2. **Cloud STT API (OpenAI Whisper API / Google Cloud)**: Ditolak sebagai solusi utama karena membutuhkan biaya API per-menit dan menghilangkan keunggulan eksekusi lokal tanpa biaya tambahan.

## Consequences
- **Positive**:
  - Pengguna dapat meningkatkan akurasi transkripsi secara signifikan menggunakan model `medium` atau `large-v3`.
  - VAD secara otomatis memangkas segmen hening dan mencegah halusinasi teks berulang.
  - Aplikasi aman dari kegagalan unduhan mendadak saat offline/koneksi tidak stabil.
- **Negative / Considerations**:
  - Model yang lebih besar (`medium` ~1.5GB, `large-v3` ~3.1GB) membutuhkan ruang penyimpanan disk tambahan dan konsumsi RAM/VRAM yang lebih tinggi saat proses inferensi.
