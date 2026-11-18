"""Print the environment checks in plain Indonesian, for the Colab notebook.

The notebook runs this right before it starts the server, in the same cell and
with the same environment variables (AUTO_CLIPPER_WORKSPACE,
AUTO_CLIPPER_WORK_DIR, AUTO_CLIPPER_CLOUD_MODE, PATH), so the user reads what
the server is about to find: FFmpeg, disk, memory, GPU, Google Drive, Deno and
the downloader version. The checks are the ones behind ``GET /api/preflight``
(backend/preflight.py).

Usage (from the repo root):

    python scripts/colab_preflight.py

Always exits 0 and never raises: a check that cannot run must not keep the
server cell from starting the server.
"""
import os
import sys
import textwrap

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

DRIVE_ROOT = "/content/drive"
WIDTH = 88
LEVEL_LABELS = {"ok": "OK", "warn": "PERHATIAN", "block": "MASALAH"}


def drive_is_missing(workspace: str, is_mount=os.path.ismount) -> bool:
    """True when the library is meant to be on Google Drive but Drive is not mounted.

    This asks the mount point itself. backend.preflight looks for the folder
    /content/drive/MyDrive, and the backend creates that folder on the local
    disk the first time it opens the library, so without a mount that check
    still passes.
    """
    workspace = (workspace or "").replace("\\", "/")
    return (workspace == DRIVE_ROOT or workspace.startswith(DRIVE_ROOT + "/")) and not is_mount(DRIVE_ROOT)


def mark_drive_missing(checks: list) -> list:
    """Replace a passing Drive check with the "Google Drive is not connected" warning."""
    from backend.errors import ERROR_CODES

    entry = ERROR_CODES["DRIVE_NOT_MOUNTED"]
    warning = {
        "id": "drive", "level": "warn", "code": "DRIVE_NOT_MOUNTED",
        "title": entry["title"], "message": entry["message"],
        "title_en": entry["title_en"], "message_en": entry["message_en"],
        "technical": f"{DRIVE_ROOT} is not a mount point",
    }
    return [warning if c.get("id") == "drive" and c.get("level") == "ok" else c for c in checks]


def collect_checks() -> list:
    """The preflight results of this environment."""
    # Asked before the backend is imported: opening the library creates its folder.
    drive_missing = drive_is_missing(os.environ.get("AUTO_CLIPPER_WORKSPACE", ""))
    if REPO_ROOT not in sys.path:
        sys.path.insert(0, REPO_ROOT)
    from backend.preflight import run_preflight

    checks = run_preflight()
    return mark_drive_missing(checks) if drive_missing else checks


def format_report(checks: list) -> str:
    """Level, title and message of every check, then one summary line."""
    rule = "=" * 60
    lines = [rule, "PEMERIKSAAN AWAL AUTO CLIPPER", rule]
    for check in checks:
        label = LEVEL_LABELS.get(check.get("level"), LEVEL_LABELS["warn"])
        lines.append(f"[{label}] {check.get('title', '')}")
        lines.extend(textwrap.wrap(check.get("message", ""), WIDTH, initial_indent="    ", subsequent_indent="    "))
    lines.append("-" * 60)

    blocks = sum(1 for c in checks if c.get("level") == "block")
    warns = sum(1 for c in checks if c.get("level") not in ("ok", "block"))
    if blocks:
        lines.append(
            f"{blocks} masalah harus diperbaiki dulu. Server tetap menyala, "
            "tetapi proses video tidak akan dimulai sebelum masalah itu beres."
        )
    elif warns:
        lines.append(f"{warns} hal perlu perhatian. Server tetap dijalankan dan aplikasi bisa dipakai.")
    else:
        lines.append("Semua pemeriksaan aman.")
    return "\n".join(lines)


def main() -> int:
    try:
        report = format_report(collect_checks())
    except Exception as e:
        report = (
            "Pemeriksaan awal tidak bisa dijalankan. Server tetap dijalankan.\n"
            f"Detail teknis: {type(e).__name__}: {e}"
        )
    try:
        print(report, flush=True)
    except Exception:
        pass
    return 0


if __name__ == "__main__":
    sys.exit(main())
