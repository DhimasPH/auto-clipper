"""Google Drive on Colab: the library is used only once Drive is mounted.

On Colab the library (``AUTO_CLIPPER_WORKSPACE``) is
/content/drive/MyDrive/AutoClipperData. If the server starts before the
notebook has mounted Drive, that path is only a folder on the runtime's own
disk. What is written there disappears with the runtime, and the folder makes
the later ``drive.mount('/content/drive')`` fail: Colab refuses to mount onto
a folder that already contains files.

So while the library is on an unmounted Drive:

- nothing is created under /content/drive: ``refuse_unmounted`` raises
  DRIVE_NOT_MOUNTED instead;
- the preflight check "drive" blocks, so every job stops before it starts;
- logs and history.db stay on this machine (``local_dir``) for the session.
  Once Drive is mounted, history.db is merged into the library copy as usual.

Without cloud mode, or with a library outside /content/drive, nothing here
changes anything.
"""
import os
import tempfile

from backend.errors import AppError

DRIVE_ROOT = "/content/drive"


def _norm(path: str) -> str:
    return os.path.normcase(os.path.abspath(os.path.expanduser(path))).replace("\\", "/")


def is_on_drive(path: str) -> bool:
    """True when ``path`` is the Drive mount point or inside it."""
    if not path or not path.strip():
        return False
    target, root = _norm(path.strip()), _norm(DRIVE_ROOT)
    return target == root or target.startswith(root + "/")


def drive_mounted() -> bool:
    # Ask the mount point, not a folder under it: a folder can exist without a mount.
    return os.path.ismount(DRIVE_ROOT)


def library_on_drive() -> bool:
    """True on a Colab run whose library is on Google Drive, mounted or not."""
    return bool(os.environ.get("AUTO_CLIPPER_CLOUD_MODE")) and is_on_drive(os.environ.get("AUTO_CLIPPER_WORKSPACE", ""))


def library_unavailable() -> bool:
    """True when the library is on a Google Drive that is not mounted."""
    return library_on_drive() and not drive_mounted()


def refuse_unmounted(path: str) -> None:
    """Raise DRIVE_NOT_MOUNTED instead of letting ``path`` be created on a Drive that is not mounted."""
    if is_on_drive(path) and library_unavailable():
        raise AppError("DRIVE_NOT_MOUNTED", technical=f"{DRIVE_ROOT} is not a mount point, so {path} was not created")


def _system_temp_dir() -> str:
    return tempfile.gettempdir()


def local_dir() -> str:
    """Where logs and history.db go while the library is unavailable, created if needed.

    The work dir when one is set (and not itself on Drive), else a folder in the
    system temp dir. Either way it is lost with the runtime, which is why jobs
    are refused until Drive is mounted.
    """
    work = os.environ.get("AUTO_CLIPPER_WORK_DIR", "").strip()
    if work and not is_on_drive(work):
        path = os.path.abspath(os.path.expanduser(work))
    else:
        path = os.path.join(_system_temp_dir(), "AutoClipper")
    os.makedirs(path, exist_ok=True)
    return path
