"""Print the environment checks in plain Indonesian, for the Colab notebook.

The notebook runs this right before it starts the server, in the same cell and
with the same environment variables (AUTO_CLIPPER_WORKSPACE,
AUTO_CLIPPER_WORK_DIR, AUTO_CLIPPER_CLOUD_MODE, PATH), so the user reads what
the server is about to find: FFmpeg, disk, memory, GPU, Google Drive, Deno and
the downloader version. The checks are the ones behind ``GET /api/preflight``
(backend/preflight.py). A Google Drive that is not mounted is a ``MASALAH``:
the server still starts, but every job is refused until Drive is connected.

Usage (from the repo root):

    python scripts/colab_preflight.py

Always exits 0 and never raises: a check that cannot run must not keep the
server cell from starting the server.
"""
import os
import sys
import textwrap

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

WIDTH = 88
LEVEL_LABELS = {"ok": "OK", "warn": "PERHATIAN", "block": "MASALAH"}


def collect_checks() -> list:
    """The preflight results of this environment."""
    if REPO_ROOT not in sys.path:
        sys.path.insert(0, REPO_ROOT)
    from backend.preflight import run_preflight

    return run_preflight()


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
