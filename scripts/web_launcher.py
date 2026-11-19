"""Source of "Auto Clipper Web.exe", the launcher of the Windows web package (SP1, spec 4.6).

Runs app\\backend.exe --web --ui-dir app\\ui in this console window and waits.
Closing the window stops both. Built in CI with PyInstaller (--onefile --console),
see .github/workflows/web-package.yml.
"""
import os
import subprocess
import sys

MISSING = (
    "File aplikasi tidak lengkap: {path} tidak ada. Unduh ulang Auto-Clipper-Web-windows.zip, "
    "lalu ekstrak semua isinya ke satu folder sebelum membuka Auto Clipper Web.\n"
    "The app files are incomplete: {path} is missing. Download Auto-Clipper-Web-windows.zip again "
    "and extract everything into one folder before opening Auto Clipper Web.\n"
)
PRESS_ENTER = "Tekan Enter untuk menutup jendela ini. / Press Enter to close this window. "


def package_dir() -> str:
    if getattr(sys, "frozen", False):
        return os.path.dirname(os.path.abspath(sys.executable))
    return os.path.dirname(os.path.abspath(__file__))


def backend_command(base: str) -> list:
    app = os.path.join(base, "app")
    return [os.path.join(app, "backend.exe"), "--web", "--ui-dir", os.path.join(app, "ui")]


def _pause(wait) -> None:
    """Keep the window open so the message can be read."""
    try:
        wait(PRESS_ENTER)
    except (EOFError, KeyboardInterrupt, OSError):
        pass


def main(base=None, run=subprocess.call, out=sys.stdout, wait=input) -> int:
    command = backend_command(base or package_dir())
    if not os.path.isfile(command[0]):
        out.write(MISSING.format(path=command[0]))
        out.flush()
        _pause(wait)
        return 1
    try:
        code = run(command)
    except KeyboardInterrupt:
        return 0
    if code != 0:
        _pause(wait)
    return code


if __name__ == "__main__":
    sys.exit(main())
