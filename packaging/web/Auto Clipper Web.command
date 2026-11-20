#!/usr/bin/env bash
# Auto Clipper Web (macOS). Double-click to start. The first time: on macOS 15 or later,
# System Settings > Privacy & Security > Open Anyway; on macOS 14 or earlier, right-click > Open.
# Keep this Terminal window open while you use the app. Closing it stops Auto Clipper.
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Files from a downloaded zip carry the quarantine flag. The user already allowed this
# script (Open Anyway or right-click > Open); allow the bundled backend and FFmpeg too (plan question 11).
xattr -dr com.apple.quarantine "$DIR" 2>/dev/null || true

"$DIR/app/backend/backend" --web --ui-dir "$DIR/app/ui"
status=$?
if [ $status -ne 0 ]; then
  echo
  read -r -p "Tekan Enter untuk menutup / Press Enter to close. " _
fi
exit $status
