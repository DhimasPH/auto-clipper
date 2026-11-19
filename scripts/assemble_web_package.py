"""Puts the local web package together (SP1, spec 4.6). Used by .github/workflows/web-package.yml.

    python scripts/assemble_web_package.py <target> <out folder> --ffmpeg PATH [--launcher-exe PATH]

<out folder> ("Auto Clipper Web", zipped by the workflow):

    Auto Clipper Web.exe | Auto Clipper Web.command | Auto Clipper Web.sh
    BACA-SAYA.txt
    app/backend.exe            Windows (PyInstaller onefile, dist/backend.exe)
    app/backend                Linux (onefile, dist/backend)
    app/backend/backend + ...  macOS (onedir, dist/backend_app/)
    app/ffmpeg(.exe)           ffmpeg-static@5; the backend looks next to itself and one folder up
    app/ui/                    the Vite build (npm run build -- --outDir web-ui)
"""
import argparse
import os
import shutil
import stat
import sys

TARGETS = ("windows", "macos-arm64", "macos-x64", "linux")
REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _fail(message: str) -> None:
    raise SystemExit(f"assemble_web_package: {message}")


def _make_executable(path: str) -> None:
    mode = os.stat(path).st_mode
    os.chmod(path, mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)


def assemble(target: str, out: str, *, backend_dist: str = os.path.join(REPO, "dist"),
             ui_dist: str = os.path.join(REPO, "web-ui"), ffmpeg: str, launcher_exe: str = None,
             packaging_dir: str = os.path.join(REPO, "packaging", "web")) -> str:
    if target not in TARGETS:
        _fail(f"unknown target {target!r}; use one of {', '.join(TARGETS)}")
    if not os.path.isfile(os.path.join(ui_dist, "index.html")):
        _fail(f"{ui_dist} has no index.html: run `npm run build -- --outDir web-ui` first")
    if not os.path.isfile(ffmpeg):
        _fail(f"FFmpeg not found at {ffmpeg}")
    if target == "windows" and not (launcher_exe and os.path.isfile(launcher_exe)):
        _fail("the Windows package needs --launcher-exe (Auto Clipper Web.exe)")

    if os.path.exists(out):
        shutil.rmtree(out)
    app = os.path.join(out, "app")
    os.makedirs(app)
    shutil.copytree(ui_dist, os.path.join(app, "ui"))
    shutil.copy2(os.path.join(packaging_dir, "BACA-SAYA.txt"), os.path.join(out, "BACA-SAYA.txt"))

    if target == "windows":
        shutil.copy2(os.path.join(backend_dist, "backend.exe"), os.path.join(app, "backend.exe"))
        shutil.copy2(ffmpeg, os.path.join(app, "ffmpeg.exe"))
        shutil.copy2(launcher_exe, os.path.join(out, "Auto Clipper Web.exe"))
        return out

    if target == "linux":
        backend = os.path.join(app, "backend")
        shutil.copy2(os.path.join(backend_dist, "backend"), backend)
        launcher = os.path.join(out, "Auto Clipper Web.sh")
    else:
        # onedir: keep symlinks (Python.framework inside _internal) so the ad-hoc signatures stay valid.
        shutil.copytree(os.path.join(backend_dist, "backend_app"), os.path.join(app, "backend"), symlinks=True)
        backend = os.path.join(app, "backend", "backend")
        launcher = os.path.join(out, "Auto Clipper Web.command")
    shutil.copy2(os.path.join(packaging_dir, os.path.basename(launcher)), launcher)
    ffmpeg_out = os.path.join(app, "ffmpeg")
    shutil.copy2(ffmpeg, ffmpeg_out)
    for path in (backend, ffmpeg_out, launcher):
        _make_executable(path)
    return out


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="Assemble the Auto Clipper Web package.")
    parser.add_argument("target", choices=TARGETS)
    parser.add_argument("out")
    parser.add_argument("--ffmpeg", required=True)
    parser.add_argument("--launcher-exe", default=None)
    parser.add_argument("--backend-dist", default=os.path.join(REPO, "dist"))
    parser.add_argument("--ui-dist", default=os.path.join(REPO, "web-ui"))
    args = parser.parse_args(argv)
    out = assemble(args.target, os.path.abspath(args.out), backend_dist=args.backend_dist, ui_dist=args.ui_dist,
                   ffmpeg=args.ffmpeg, launcher_exe=args.launcher_exe)
    print(f"Package ready: {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
