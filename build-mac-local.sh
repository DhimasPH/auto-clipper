#!/usr/bin/env bash
#
# build-mac-local.sh
# Build & ad-hoc sign Auto Clipper for macOS Intel (x86_64), locally on your Mac.
#
# Usage (from the repo root on your Intel Mac, macOS 12+):
#   chmod +x build-mac-local.sh
#   ./build-mac-local.sh
#
# To auto-clean heavy build intermediates afterwards (keeps the DMG):
#   CLEAN=1 ./build-mac-local.sh
#
# NOTE: This produces a TEST build (no auto-updater artifacts, so no signing key
# needed). The real distributable DMG comes from CI. This build is just to verify
# the app runs on your macOS 12 Intel machine (no "Killed: 9", sidecar + FFmpeg OK).

set -euo pipefail

TARGET="x86_64-apple-darwin"

echo "==> [0/4] Preflight: checking environment & tools..."

# Must be run from the repo root.
if [ ! -f backend.spec ] || [ ! -d src-tauri ]; then
  echo "ERROR: run this from the auto-clipper repo root (backend.spec + src-tauri/ must exist)."
  echo "  If you don't have the repo on this Mac yet:"
  echo "    git clone https://github.com/DhimasPH/auto-clipper.git && cd auto-clipper"
  exit 1
fi

# Architecture sanity (this script targets Intel x86_64).
if [ "$(uname -m)" != "x86_64" ]; then
  echo "WARNING: this Mac reports arch '$(uname -m)', not Intel x86_64."
  echo "         The script still builds the x86_64 target, but you probably want the arm64 build instead."
fi

need_manual=0

# --- Xcode Command Line Tools (codesign, clang, git) : manual (GUI dialog) ---
if ! xcode-select -p >/dev/null 2>&1; then
  echo "MISSING: Xcode Command Line Tools."
  echo "  Run:  xcode-select --install   (finish the popup, then re-run this script)"
  need_manual=1
fi

# --- Homebrew : manual (needs password) if Node/Python are also missing ---
if ! command -v brew >/dev/null 2>&1; then
  if ! command -v node >/dev/null 2>&1 || ! command -v python3.11 >/dev/null 2>&1; then
    echo "MISSING: Homebrew (needed to install Node/Python)."
    echo "  Install from https://brew.sh (it will ask for your password), then re-run."
    need_manual=1
  fi
fi

# --- Rust : auto-install (headless) ---
if ! command -v cargo >/dev/null 2>&1; then
  echo "==> Installing Rust (rustup)..."
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
fi
# make cargo/rustup available in this shell
source "$HOME/.cargo/env" 2>/dev/null || true

# --- Node 22 : auto-install via brew if missing ---
if ! command -v node >/dev/null 2>&1; then
  if command -v brew >/dev/null 2>&1; then
    echo "==> Installing Node 22..."; brew install node@22
    brew link --overwrite --force node@22 2>/dev/null || true
  else
    need_manual=1
  fi
fi

# --- Python 3.11 : auto-install via brew if missing ---
PY=""
if command -v python3.11 >/dev/null 2>&1; then
  PY="python3.11"
elif command -v python3 >/dev/null 2>&1 && python3 -c 'import sys; exit(0 if sys.version_info[:2]==(3,11) else 1)' 2>/dev/null; then
  PY="python3"
elif command -v brew >/dev/null 2>&1; then
  echo "==> Installing Python 3.11..."; brew install python@3.11
  PY="$(brew --prefix)/bin/python3.11"
else
  echo "MISSING: Python 3.11."
  need_manual=1
fi

if [ "$need_manual" = "1" ]; then
  echo
  echo "==> Please install the MISSING item(s) above, then re-run this script. Stopping."
  exit 1
fi

# Ensure the Rust target is available (usually default on Intel, harmless otherwise).
rustup target add "$TARGET" >/dev/null 2>&1 || true

echo "==> [1/4] Building Python backend with PyInstaller..."
"$PY" -m venv .venv
# shellcheck disable=SC1091
source .venv/bin/activate
pip install --upgrade pip
pip install -r backend/requirements.txt -c backend/constraints-macos12.txt
pip install pyinstaller
pyinstaller --clean backend.spec -y

echo "==> [2/4] Staging backend + native FFmpeg into src-tauri/bin ..."
mkdir -p src-tauri/bin
rm -rf src-tauri/bin/backend_app
cp -r dist/backend_app src-tauri/bin/

# Create bash wrapper for Tauri sidecar
cat << 'EOF' > "src-tauri/bin/backend-${TARGET}"
#!/usr/bin/env bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
LOG="/tmp/autoclipper_sidecar.log"
echo "Sidecar started at $(date). DIR: $DIR" > "$LOG"

if [ -f "$DIR/../Resources/bin/backend_app/backend" ]; then
  echo "Found backend in Resources/bin" >> "$LOG"
  "$DIR/../Resources/bin/backend_app/backend" "$@" 2>&1 | tee -a "$LOG"
elif [ -f "$DIR/../Resources/backend_app/backend" ]; then
  echo "Found backend in Resources" >> "$LOG"
  "$DIR/../Resources/backend_app/backend" "$@" 2>&1 | tee -a "$LOG"
elif [ -f "$DIR/backend_app/backend" ]; then
  echo "Found backend in local DIR" >> "$LOG"
  "$DIR/backend_app/backend" "$@" 2>&1 | tee -a "$LOG"
else
  echo "ERROR: Could not find backend executable!" >> "$LOG"
  echo "Contents of Resources/bin:" >> "$LOG"
  ls -la "$DIR/../Resources/bin" >> "$LOG" 2>&1
  exit 1
fi
EOF

npm install ffmpeg-static@5
cp "$(node -e "console.log(require('ffmpeg-static'))")" src-tauri/bin/ffmpeg
chmod +x src-tauri/bin/ffmpeg "src-tauri/bin/backend-${TARGET}"
echo "--- arch check (both should say x86_64) ---"
file "src-tauri/bin/ffmpeg" "src-tauri/bin/backend_app/backend"

echo "==> [3/4] Ad-hoc codesigning binaries (prevents 'Killed: 9') ..."
find "src-tauri/bin/backend_app" -type f \( -name "*.dylib" -o -name "*.so" -o -perm +111 \) -exec codesign --force --sign - {} \;
codesign --force --sign - "src-tauri/bin/backend-${TARGET}"
codesign --force --sign - src-tauri/bin/ffmpeg
codesign --verify --verbose "src-tauri/bin/backend_app/backend"

echo "==> [4/4] Building the Tauri app (test build, updater artifacts disabled) ..."
npm install
npm run tauri build -- --target "$TARGET" --config '{"bundle":{"createUpdaterArtifacts":false}}'

# Re-sign the whole .app bundle (outer bundle) ad-hoc, for good measure.
OUT="src-tauri/target/${TARGET}/release/bundle"
APP="$(find "$OUT/macos" -maxdepth 1 -name '*.app' 2>/dev/null | head -1 || true)"
if [ -n "$APP" ]; then
  codesign --force --deep --sign - "$APP" 2>/dev/null || true
  codesign --verify --deep --strict --verbose=2 "$APP" 2>/dev/null || true
fi

# Collect the DMG somewhere easy to find.
mkdir -p dist-macos
find "$OUT" -name '*.dmg' -exec cp {} dist-macos/ \; 2>/dev/null || true

echo
echo "==================== DONE ===================="
echo "Built artifacts:"
find "$OUT" \( -name '*.dmg' -o -name '*.app' \) | sed 's/^/  /'
echo "DMG also copied to: ./dist-macos/"
echo
echo "TEST: open the DMG, drag 'Auto Clipper' to /Applications, launch it, and check:"
echo "  - it opens WITHOUT 'Killed: 9' or a Gatekeeper 'damaged' error"
echo "  - the backend/sidecar connects, and a clip render (FFmpeg + subtitle) works"
echo "If Gatekeeper still blocks it:  xattr -cr \"/Applications/Auto Clipper.app\""
echo "=============================================="

# Optional cleanup of heavy intermediates (keeps ./dist-macos).
if [ "${CLEAN:-0}" = "1" ]; then
  echo
  echo "==> CLEAN=1 set: removing build intermediates (venv, node_modules, dist, build, target)..."
  rm -rf .venv node_modules dist build src-tauri/target
  echo "Cleaned. (Rust in ~/.rustup/~/.cargo and Homebrew packages remain installed.)"
fi
