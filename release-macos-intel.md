# Rilis macOS Intel (manual) + in-app updater

CI GitHub **tidak** mem-build macOS Intel (runner `macos-13` tidak bisa diandalkan), jadi
build Intel dilakukan manual di Mac Intel, lalu artefaknya ditempel ke release yang sudah
dibuat CI. Dokumen ini juga menjelaskan cara mengaktifkan **in-app updater** untuk Intel
dengan mengedit `latest.json`.

Jalankan flow ini **hanya saat memang perlu** rilis Intel baru (on-demand).

## Prasyarat (sekali saja)

- Mac Intel (macOS 12+).
- File signing key `autoclipper-new.key` **dan password-nya** (sama dengan GitHub Secrets
  `TAURI_SIGNING_PRIVATE_KEY` / `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`). Simpan aman; jangan
  commit ke repo.
- `gh` (GitHub CLI) dan `jq` — kalau belum ada: `brew install gh jq` lalu `gh auth login`.

## Langkah

### 1. Tunggu CI selesai
Push tag versi seperti biasa (mis. `v1.11.0`). Biarkan CI membangun & mengupload
**Windows + macOS arm64** ke release `app-v1.11.0`, termasuk `latest.json`.

### 2. Build Intel di Mac (dengan updater artifacts)
Dari root repo di Mac Intel:
```bash
export TAURI_SIGNING_PRIVATE_KEY="$(cat /path/ke/autoclipper-new.key)"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="password-key-mu"   # "" jika tanpa password
./release-mac-intel.sh
```
Hasil di `./dist-macos/`:
- `Auto Clipper_<ver>_x64.dmg`
- `Auto Clipper_<ver>_x64.app.tar.gz`
- `Auto Clipper_<ver>_x64.app.tar.gz.sig`

Script juga mencetak **SHA256 DMG** dan lokasi file `.sig`.

### 3. Upload DMG + updater artifact ke release

**Via CLI:**
```bash
VER="1.11.0"    # sesuaikan
gh release upload "app-v${VER}" \
  dist-macos/*_x64.dmg \
  dist-macos/*_x64.app.tar.gz --clobber
```
> Catatan: GitHub mengganti spasi di nama file menjadi titik, jadi asetnya akan tampil
> sebagai `Auto.Clipper_<ver>_x64.dmg` dan `Auto.Clipper_<ver>_x64.app.tar.gz`.

**Alternatif (Via Web Browser):**
Buka halaman *Releases* di repo GitHub, edit rilis `app-v<ver>`, lalu drag-and-drop file `.dmg` dan `.app.tar.gz` dari folder `dist-macos/` ke kotak attachment.

### 4. Tambahkan Intel ke `latest.json` (aktifkan in-app updater Intel)
CI hanya menaruh `darwin-aarch64` + `windows-x86_64` di `latest.json`. Tambahkan `darwin-x86_64`:

**Via CLI (Butuh `jq` & `gh`):**
```bash
VER="1.11.0"
TAG="app-v${VER}"
BASE="https://github.com/DhimasPH/auto-clipper/releases/download/${TAG}"

curl -fsSL -o latest.json "${BASE}/latest.json"
SIG="$(cat dist-macos/*_x64.app.tar.gz.sig)"
URL="${BASE}/Auto.Clipper_${VER}_x64.app.tar.gz"

jq --arg sig "$SIG" --arg url "$URL" \
  '.platforms["darwin-x86_64"] = {signature:$sig, url:$url}' \
  latest.json > latest.new.json && mv latest.new.json latest.json

gh release upload "${TAG}" latest.json --clobber
```

**Alternatif (Tanpa CLI `jq` / `gh`, via Python + Web Browser):**
1. Download file `latest.json` dari halaman rilis GitHub ke folder `auto-clipper`.
2. Jalankan script Python ini di terminal untuk menginject signature:
   ```bash
   python3 -c "
   import json
   ver = '1.11.0'
   with open(f'dist-macos/Auto Clipper_{ver}_x64.app.tar.gz.sig', 'r') as f:
       sig = f.read().strip()
   url = f'https://github.com/DhimasPH/auto-clipper/releases/download/app-v{ver}/Auto.Clipper_{ver}_x64.app.tar.gz'
   with open('latest.json', 'r') as f:
       data = json.load(f)
   data['platforms']['darwin-x86_64'] = {'signature': sig, 'url': url}
   with open('latest.json', 'w') as f:
       json.dump(data, f, indent=2)
   "
   ```
3. Buka GitHub *Releases* di web, edit rilisnya, hapus `latest.json` lama, dan drag-and-drop `latest.json` hasil editan ini ke attachment.

Verifikasi isi `latest.json` jika menggunakan CLI:
```bash
jq '.platforms | keys' latest.json
# ["darwin-aarch64","darwin-x86_64","windows-x86_64"]
```

### 5. Tes
- Download DMG Intel dari Releases, `xattr -cr "/Applications/Auto Clipper.app"`, buka —
  pastikan tidak `Killed: 9`.
- Dari versi Intel lama, cek tombol **Update** di aplikasi muncul dan update terpasang.

## Kalau versi ini TIDAK perlu build Intel
Lewati saja langkah 2–4. Release tetap berisi Windows + arm64; pengguna Intel tetap di versi
lama sampai ada build Intel berikutnya (updater Intel hanya menawarkan versi yang `latest.json`-nya
punya entri `darwin-x86_64`). Aman, tidak error.

## Keamanan
Signing key `autoclipper-new.key` adalah aset paling kritis: jika bocor, orang bisa mengirim
"update" palsu ke semua pengguna. Jangan commit ke repo, jangan tempel di tempat publik, dan
backup di tempat aman (mis. password manager).
