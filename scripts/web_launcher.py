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
CANNOT_START = (
    "Auto Clipper tidak bisa dijalankan: Windows atau antivirus menolak membuka {path}. "
    "Paket ini belum ditandatangani, jadi antivirus kadang memblokirnya. Izinkan file itu di antivirus "
    "(atau pulihkan dari karantina), atau ekstrak ulang zip ke folder lain, lalu buka Auto Clipper Web lagi.\n"
    "Auto Clipper could not be started: Windows or your antivirus refused to open {path}. "
    "The package is not signed, so antivirus software sometimes blocks it. Allow that file in your antivirus "
    "(or restore it from quarantine), or extract the zip again into another folder, then open Auto Clipper Web again.\n"
    "\nDetail teknis / Technical details: {error}\n"
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
    except OSError as e:  # e.g. PermissionError when antivirus blocks the unsigned backend.exe
        out.write(CANNOT_START.format(path=command[0], error=e))
        out.flush()
        _pause(wait)
        return 1
    if code != 0:
        _pause(wait)
    return code


if __name__ == "__main__":
    sys.exit(main())
