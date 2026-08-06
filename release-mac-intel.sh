#!/usr/bin/env bash
#
# release-mac-intel.sh
# Build a SIGNED macOS Intel (x86_64) RELEASE of Auto Clipper, WITH updater artifacts.
#
# Output (in ./dist-macos/):
#   - Auto Clipper_<ver>_x64.dmg              -> upload to the GitHub release
#   - Auto Clipper_<ver>_x64.app.tar.gz       -> upload to the GitHub release (for in-app updater)
#   - Auto Clipper_<ver>_x64.app.tar.gz.sig   -> its signature (goes into latest.json)
#
# REQUIRES the app's Minisign signing key + password (same as your GitHub Secrets).
# Copy the key file (autoclipper-new.key) to this Mac first, then:
#
#   export TAURI_SIGNING_PRIVATE_KEY="$(cat /path/to/autoclipper-new.key)"
#   export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="your-password"
#   ./release-mac-intel.sh
#
# Optional: CLEAN=1 ./release-mac-intel.sh   (remove heavy build intermediates afterwards)

set -euo pipefail
TARGET="x86_64-apple-darwin"

echo "==> [0/5] Preflight..."

# --- signing key is MANDATORY for a release build (updater artifacts) ---
if [ -z "${TAURI_SIGNING_PRIVATE_KEY:-}" ]; then
  echo "ERROR: TAURI_SIGNING_PRIVATE_KEY is not set."
  echo '  export TAURI_SIGNING_PRIVATE_KEY="$(cat /path/to/autoclipper-new.key)"'
  echo '  export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="your-password"'
  echo "  ...then re-run. (Without the key there are no updater artifacts -> use build-mac-local.sh instead for a DMG-only test build.)"
  exit 1
fi
if [ -z "${TAURI_SIGNING_PRIVATE_KEY_PASSWORD+x}" ]; then
  echo "ERROR: TAURI_SIGNING_PRIVATE_KEY_PASSWORD is not set (use \"\" if the key has no password)."
  exit 1
fi

if [ ! -f backend.spec ] || [ ! -d src-tauri ]; then
  echo "ERROR: run this from the auto-clipper repo root."
  exit 1
fi
if [ "$(uname -m)" != "x86_64" ]; then
  echo "WARNING: this Mac is $(uname -m), not Intel x86_64 — you'd normally run this on an Intel Mac."
fi

need_manual=0
if ! xcode-select -p >/dev/null 2>&1; then
  echo "MISSING: Xcode Command Line Tools -> run: xcode-select --install"; need_manual=1
fi
if ! command -v brew >/dev/null 2>&1; then
  if ! command -v node >/dev/null 2>&1 || ! command -v python3.11 >/dev/null 2>&1; then
    echo "MISSING: Homebrew (needed to install Node/Python) -> https://brew.sh"; need_manual=1
  fi
fi
if ! command -v cargo >/dev/null 2>&1; then
  echo "==> Installing Rust..."; curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
fi
source "$HOME/.cargo/env" 2>/dev/null || true
if ! command -v node >/dev/null 2>&1; then
  command -v brew >/dev/null 2>&1 && { echo "==> Installing Node..."; brew install node@22; brew link --overwrite --force node@22 2>/dev/null || true; } || need_manual=1
fi
PY=""
if command -v python3.11 >/dev/null 2>&1; then PY="python3.11"
elif command -v python3 >/dev/null 2>&1 && python3 -c 'import sys;exit(0 if sys.version_info[:2]==(3,11) else 1)' 2>/dev/null; then PY="python3"
elif command -v brew >/dev/null 2>&1; then echo "==> Installing Python 3.11..."; brew install python@3.11; PY="$(brew --prefix)/bin/python3.11"
else echo "MISSING: Python 3.11"; need_manual=1; fi
[ "$need_manual" = "1" ] && { echo; echo "Install the MISSING item(s) above, then re-run. Stopping."; exit 1; }
rustup target add "$TARGET" >/dev/null 2>&1 || true

echo "==> [1/5] Building Python backend (PyInstaller, onedir)..."
"$PY" -m venv .venv
# shellcheck disable=SC1091
source .venv/bin/activate
pip install --upgrade pip
pip install -r backend/requirements.txt -c backend/constraints-macos12.txt
pip install pyinstaller
pyinstaller --clean backend.spec -y

echo "==> [2/5] Staging backend_app + wrapper + native FFmpeg..."
mkdir -p src-tauri/bin
rm -rf src-tauri/bin/backend_app
cp -r dist/backend_app src-tauri/bin/
printf '%s\n' \
  '#!/usr/bin/env bash' \
  'DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"' \
  'for c in "$DIR/../Resources/bin/backend_app/backend" "$DIR/../Resources/backend_app/backend" "$DIR/backend_app/backend"; do' \
  '  if [ -x "$c" ]; then exec "$c" "$@"; fi' \
  'done' \
  'echo "ERROR: backend_app/backend not found next to sidecar wrapper" >&2; exit 1' \
  > "src-tauri/bin/backend-${TARGET}"
npm install ffmpeg-static@5
cp "$(node -e "console.log(require('ffmpeg-static'))")" src-tauri/bin/ffmpeg
chmod +x src-tauri/bin/ffmpeg "src-tauri/bin/backend-${TARGET}" "src-tauri/bin/backend_app/backend"

echo "==> [3/5] Ad-hoc codesigning (each Mach-O in backend_app)..."
find src-tauri/bin/backend_app -type f \( -name '*.dylib' -o -name '*.so' -o -perm +111 \) \
  -exec codesign --force --sign - {} \;
codesign --force --sign - "src-tauri/bin/backend-${TARGET}"
codesign --force --sign - src-tauri/bin/ffmpeg
codesign --verify --verbose "src-tauri/bin/backend_app/backend"

echo "==> [4/5] Building Tauri app (RELEASE, updater artifacts ON)..."
npm install
# NOTE: no --config override here, so createUpdaterArtifacts (v1Compatible) stays ON.
# Tauri signs the updater artifact using TAURI_SIGNING_PRIVATE_KEY(+PASSWORD).
npm run tauri build -- --target "$TARGET"

echo "==> [5/5] Collecting artifacts into ./dist-macos ..."
OUT="src-tauri/target/${TARGET}/release/bundle"
mkdir -p dist-macos
find "$OUT" \( -name '*.dmg' -o -name '*.app.tar.gz' -o -name '*.app.tar.gz.sig' \) -exec cp {} dist-macos/ \; 2>/dev/null || true

# Rename Tauri's unversioned updater artifacts to match the DMG's naming scheme
DMG_FILE=$(ls dist-macos/*.dmg 2>/dev/null | head -1 || true)
if [ -n "$DMG_FILE" ]; then
  BASE_NAME=$(basename "$DMG_FILE" .dmg)
  if [ -f "dist-macos/Auto Clipper.app.tar.gz" ]; then
    mv "dist-macos/Auto Clipper.app.tar.gz" "dist-macos/${BASE_NAME}.app.tar.gz"
  fi
  if [ -f "dist-macos/Auto Clipper.app.tar.gz.sig" ]; then
    mv "dist-macos/Auto Clipper.app.tar.gz.sig" "dist-macos/${BASE_NAME}.app.tar.gz.sig"
  fi
fi

echo
echo "==================== DONE ===================="
echo "Artifacts:"
ls -1 dist-macos/ | sed 's/^/  /'
echo
DMG="$(ls dist-macos/*.dmg 2>/dev/null | head -1 || true)"
SIG="$(ls dist-macos/*.app.tar.gz.sig 2>/dev/null | head -1 || true)"
TARGZ="$(ls dist-macos/*.app.tar.gz 2>/dev/null | head -1 || true)"
[ -n "$DMG" ]   && { echo "DMG SHA256:"; shasum -a 256 "$DMG"; }
echo
echo "NEXT (see docs/release-macos-intel.md):"
echo "  1) Upload to the release: the DMG + the .app.tar.gz"
echo "        gh release upload app-v<version> \"$DMG\" \"$TARGZ\" --clobber"
echo "  2) Add the darwin-x86_64 entry to latest.json using the signature in:"
echo "        $SIG"
echo "=============================================="

if [ "${CLEAN:-0}" = "1" ]; then
  echo; echo "==> CLEAN=1: removing build intermediates (keeping ./dist-macos)..."
  rm -rf .venv node_modules dist build src-tauri/target
  echo "Cleaned."
fi
