# GitHub Actions Version Check Design

Tujuan dari perubahan ini adalah untuk mencegah berjalannya proses build secara penuh (yang memakan waktu dan kuota GitHub Actions) ketika ada `push` ke branch `main`, kecuali ada perubahan versi pada file `package.json`. 

## 1. Arsitektur Perubahan
Kita akan memodifikasi `.github/workflows/build.yml` dengan menambahkan mekanisme pengecekan versi menggunakan Job terpisah.

### Job 1: `check-version` (Baru)
- Berjalan sangat cepat menggunakan `ubuntu-latest`.
- Menggunakan `actions/checkout@v4` dengan `fetch-depth: 2` agar bisa membandingkan commit saat ini dengan commit sebelumnya.
- Jika event adalah `push` ke branch `main`, job ini akan:
  - Membaca versi dari `package.json` di commit sebelumnya (menggunakan `git show HEAD~1:package.json`).
  - Membaca versi di commit saat ini.
  - Jika versi berbeda, atur output `changed=true`.
  - Jika versi sama, atur output `changed=false`.
- Jika event adalah `push` tag (`v*`) atau `pull_request`, output akan selalu di-set `changed=true` agar build tetap berjalan normal tanpa halangan.

### Job 2: `build` (Modifikasi yang sudah ada)
- Menambahkan dependensi `needs: check-version`.
- Menambahkan kondisi `if: needs.check-version.outputs.changed == 'true'`.
- Job ini akan otomatis di-skip oleh GitHub jika output dari `check-version` bernilai `false`.

## 2. File yang Terpengaruh
- `[MODIFY]` `.github/workflows/build.yml`

## 3. Contoh Implementasi Logika (Shell Script di GitHub Actions)

```yaml
check-version:
  runs-on: ubuntu-latest
  outputs:
    changed: ${{ steps.check.outputs.changed }}
  steps:
    - name: Checkout code
      uses: actions/checkout@v4
      with:
        fetch-depth: 2
    - name: Check version change
      id: check
      run: |
        if [[ "${{ github.event_name }}" == "push" && "${{ github.ref }}" == "refs/heads/main" ]]; then
          OLD_VERSION=$(git show HEAD~1:package.json | jq -r .version || echo "0.0.0")
          NEW_VERSION=$(jq -r .version package.json)
          if [ "$OLD_VERSION" != "$NEW_VERSION" ]; then
            echo "Version changed from $OLD_VERSION to $NEW_VERSION"
            echo "changed=true" >> $GITHUB_OUTPUT
          else
            echo "Version unchanged ($NEW_VERSION)"
            echo "changed=false" >> $GITHUB_OUTPUT
          fi
        else
          # Selalu jalankan build untuk tag release atau pull request
          echo "changed=true" >> $GITHUB_OUTPUT
        fi
```

## 4. Keuntungan
1. **Sangat Cepat**: Job pengecekan hanya membutuhkan waktu beberapa detik, tidak mengunduh dependensi berat.
2. **Efisien**: Jika hanya melakukan push fitur kecil ke `main` tanpa mengubah versi, proses `build` Tauri (yang memakan banyak kuota dan waktu) akan otomatis dilewati.
3. **Aman untuk PR & Release**: Tidak mengganggu alur pembuatan Release (menggunakan Tag) atau validasi Pull Request.
