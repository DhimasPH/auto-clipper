#!/usr/bin/env bash
# Auto Clipper Web (Linux). Start it with "Run as a Program" or: bash "Auto Clipper Web.sh"
# Keep its terminal window open while you use the app. Closing it stops Auto Clipper.
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Started from a file manager without a terminal: open one, so the window can be seen and closed.
if [ ! -t 1 ] && [ -z "$AUTO_CLIPPER_IN_TERMINAL" ] && { [ -n "$DISPLAY" ] || [ -n "$WAYLAND_DISPLAY" ]; }; then
  export AUTO_CLIPPER_IN_TERMINAL=1
  for term in x-terminal-emulator gnome-terminal konsole xfce4-terminal xterm; do
    if command -v "$term" >/dev/null 2>&1; then
      if [ "$term" = "gnome-terminal" ]; then
        exec gnome-terminal -- bash "$DIR/Auto Clipper Web.sh"
      fi
      exec "$term" -e bash "$DIR/Auto Clipper Web.sh"
    fi
  done
fi

"$DIR/app/backend" --web --ui-dir "$DIR/app/ui"
status=$?
if [ $status -ne 0 ]; then
  echo
  read -r -p "Tekan Enter untuk menutup / Press Enter to close. " _
fi
exit $status
