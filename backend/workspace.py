"""Where a job works and where its results are kept.

Two places:

- The **library** is where finished projects live: ``AUTO_CLIPPER_WORKSPACE``
  (the app data dir) or the output folder the user chose. On Google Colab this
  is Google Drive, which survives the session but is slow to seek and write.
- The **work dir** (``AUTO_CLIPPER_WORK_DIR``) is a fast local disk for
  everything a job reads and writes while it runs: source video, audio,
  working subtitles, renders.

Without ``AUTO_CLIPPER_WORK_DIR`` a job works inside the library, as the desktop
app always has, and every function here leaves paths alone.

With it, ``publish`` copies what must outlive the work disk (clips, subtitle
files, a metadata file) into the library and repoints the job's clips and
metadata at those copies. The source video is not copied: it is large, and a
resumed job downloads it again.

The job history (``history.db``) follows the same split: with a work dir the
database is opened there and ``backend.db`` keeps a snapshot of it in the
library. Logs and cookies stay in the app data dir.
"""
import errno
import json
import os
import shutil
import uuid
from typing import Optional

from backend.drive_mount import library_unavailable, local_dir, refuse_unmounted
from backend.logger import get_app_data_dir, log_error
from backend.stage_timer import stage

WORK_DIR_ENV = "AUTO_CLIPPER_WORK_DIR"
METADATA_FILE = "metadata.json"

_CLIP_FILE_KEYS = ("path", "custom_subtitle_path")
_METADATA_FILE_KEYS = ("subtitle_path",)
# Never written to disk: not in metadata.json, not in history.db (T0.18).
SECRET_KEYS = ("api_key", "pexels_api_key")


def get_work_dir() -> Optional[str]:
    """The work dir, created if needed, or None when no work dir is configured."""
    raw = os.environ.get(WORK_DIR_ENV, "").strip()
    if not raw:
        return None
    path = os.path.abspath(os.path.expanduser(raw))
    refuse_unmounted(path)
    os.makedirs(path, exist_ok=True)
    return path


def work_project_dir(safe_title: str) -> Optional[str]:
    """Where a project works when a work dir is configured, else None."""
    work = get_work_dir()
    return os.path.join(work, "projects", safe_title) if work else None


def uploads_dir() -> str:
    """Where uploaded videos are written: the work dir when one is set, else the app data dir.

    An upload is a source video, so it follows the same rule as a download.
    """
    return os.path.join(get_work_dir() or get_app_data_dir(), "temp_downloads")


def _same(a: str, b: str) -> bool:
    return os.path.normcase(os.path.abspath(a)) == os.path.normcase(os.path.abspath(b))


def _relative_to(path: str, root: str) -> Optional[str]:
    """``path`` relative to ``root``, or None when it is not inside ``root``."""
    try:
        rel = os.path.relpath(os.path.abspath(path), os.path.abspath(root))
    except ValueError:  # different drives on Windows
        return None
    if rel == os.curdir or rel == os.pardir or rel.startswith(os.pardir + os.sep):
        return None
    return rel


def is_split(ws: dict) -> bool:
    """True when this project works in one place and is kept in another."""
    library = ws.get("library_dir")
    return bool(library) and not _same(ws["project_dir"], library)


def library_path(ws: dict, path: Optional[str]) -> Optional[str]:
    """The library twin of a file in the project's work dir, or None for any other path."""
    if not path or not is_split(ws):
        return None
    rel = _relative_to(path, ws["project_dir"])
    return os.path.join(ws["library_dir"], rel) if rel else None


def work_path(ws: dict, path: str) -> str:
    """The work-dir twin of a library file, so it can be rebuilt on the fast disk.

    Any other path is returned unchanged.
    """
    if not path or not is_split(ws):
        return path
    rel = _relative_to(path, ws["library_dir"])
    return os.path.join(ws["project_dir"], rel) if rel else path


def _temp_name(dst: str) -> str:
    # Same folder as the target so the rename stays on one disk; the name is
    # hidden and has no media extension, so nothing lists it as a clip.
    folder, name = os.path.split(dst)
    return os.path.join(folder, f".{name}.{uuid.uuid4().hex[:8]}.part")


def _discard(path: str) -> None:
    try:
        os.remove(path)
    except OSError:
        pass


def copy_atomic(src: str, dst: str) -> None:
    """Copy ``src`` to ``dst``. A reader sees the old ``dst`` or the complete new one, never half a file."""
    refuse_unmounted(dst)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    tmp = _temp_name(dst)
    try:
        shutil.copyfile(src, tmp)
        os.replace(tmp, dst)
    except BaseException:
        _discard(tmp)
        raise


def _write_json_atomic(path: str, data: dict) -> None:
    refuse_unmounted(path)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = _temp_name(path)
    try:
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        os.replace(tmp, path)
    except BaseException:
        _discard(tmp)
        raise


def publish(ws: dict, clips: list, metadata: dict, final: bool = False, job_id: str = "", url: str = "") -> list:
    """Copy finished work files into the library and point ``clips``/``metadata`` at the copies.

    Safe to call after every clip: a file that is already in the library is
    skipped, so each call copies only what is new. A file that cannot be copied
    keeps its work path (it still exists there), is logged, and is tried again
    on the next call. ``final`` also writes the metadata file and treats a clip
    still listed on the work disk as a failure.

    Returns the errors, empty when everything is in the library. Does nothing
    when the project already works inside the library.
    """
    if not is_split(ws):
        return []
    clips = clips or []
    slots = [(clip, key) for clip in clips for key in _CLIP_FILE_KEYS]
    slots += [(metadata, key) for key in _METADATA_FILE_KEYS]
    pending = [
        (holder, key) for holder, key in slots
        if library_path(ws, holder.get(key)) and os.path.isfile(holder[key])
    ]
    if not pending and not final:
        return []

    failures = []
    with stage("publish", files=len(pending)) as rec:
        for holder, key in pending:
            src = holder[key]
            try:
                dst = library_path(ws, src)
                copy_atomic(src, dst)
                holder[key] = dst
            except OSError as e:
                log_error("workspace.publish", e)
                failures.append(e)

        if final and not failures:
            failures += _stranded_clips(ws, clips)
        if final and not failures:
            try:
                _write_json_atomic(os.path.join(ws["library_dir"], METADATA_FILE), {
                    "id": job_id,
                    "url": url,
                    "clips": clips,
                    "metadata": {k: v for k, v in metadata.items() if k not in SECRET_KEYS},
                })
            except OSError as e:
                log_error("workspace.publish_metadata", e)
                failures.append(e)
        if failures:
            rec["failed"] = len(failures)
    return failures


def _stranded_clips(ws: dict, clips: list) -> list:
    """Clips still listed on the work disk although no copy failed: their files are gone."""
    work_root = get_work_dir() or ws["project_dir"]
    errors = []
    for clip in clips:
        path = clip.get("path")
        if path and _relative_to(path, work_root):
            e = FileNotFoundError(errno.ENOENT, "Clip is missing from the work dir and was not published", path)
            log_error("workspace.publish", e, exc_info=False)
            errors.append(e)
    return errors


def library_warnings() -> list:
    """What the user must be told about the library along with a finished job.

    Same shape as a preflight result. Only warnings are reported. An unmounted
    Google Drive is not one any more: it blocks the job before it starts and
    makes publishing fail (backend.drive_mount), so today this returns an empty
    list, and the caller uses that to clear the Drive warning older versions
    stored in a project's metadata.
    """
    from backend.preflight import check_drive
    result = check_drive()
    return [result] if result["level"] == "warn" else []


def storage_dirs() -> list:
    """Every folder a job writes to: the library, and the work dir when one is set.

    While the library is on a Google Drive that is not mounted, jobs are
    refused and only this machine's disk is measured.
    """
    if library_unavailable():
        return [local_dir()]
    dirs = [get_app_data_dir()]
    work = get_work_dir()
    if work and not _same(work, dirs[0]):
        dirs.append(work)
    return dirs


def free_disk_gb() -> float:
    """Free space on the fullest disk a job writes to."""
    return min(shutil.disk_usage(d).free for d in storage_dirs()) / 1024 ** 3


def _job_records(active_jobs: dict, history: list):
    """(title, output_dir, job id, clips) of every running job and every history row."""
    for job in list(active_jobs.values()):
        meta = job.get("metadata") or {}
        yield (job.get("title") or meta.get("title", ""), job.get("output_dir") or meta.get("output_dir", ""),
               job.get("id", ""), job.get("clips") or [])
    for row in history:
        meta = row.get("metadata") or {}
        yield meta.get("title", ""), meta.get("output_dir", ""), row.get("id", ""), row.get("result_clips") or []


def allowed_project_output_dirs(active_jobs: dict, history: Optional[list] = None) -> list:
    """Project folders under an output folder chosen on Desktop that /video and /save_file may read (T1.y).

    Built only from what the server recorded for real jobs (``active_jobs`` and
    history), never from a request. Each entry is one project folder
    (``<output folder>/<title>``, or the folder holding a recorded clip's
    ``clips`` folder inside that output folder), not the whole output folder,
    so other files the user keeps there stay closed. Private app folders
    (``path_guard``) are left out. Empty on Cloud, where no request may choose
    an output folder and an older one in history is not trusted.
    """
    if os.environ.get("AUTO_CLIPPER_CLOUD_MODE"):
        return []
    from backend.jobs import project_library_dir
    from backend.path_guard import is_protected, is_within
    if history is None:
        from backend.db import get_all_history
        try:
            history = get_all_history()
        except Exception as e:  # an unreadable history opens nothing more
            log_error("workspace.allowed_project_output_dirs", e)
            history = []

    dirs = []
    for title, output_dir, job_id, clips in _job_records(active_jobs, history):
        if not isinstance(output_dir, str) or not output_dir.strip():
            continue
        base = os.path.abspath(output_dir.strip())
        candidates = [project_library_dir(title if isinstance(title, str) else "", base, job_id)]
        for clip in clips:
            path = clip.get("path") if isinstance(clip, dict) else None
            if not isinstance(path, str) or not path:
                continue
            clips_dir = os.path.dirname(os.path.abspath(path))
            project = os.path.dirname(clips_dir)
            # Strictly inside the output folder: a clip at <output>/clips would open all of it.
            if os.path.basename(clips_dir).lower() == "clips" and is_within(project, base) and not is_within(base, project):
                candidates.append(project)
        for folder in candidates:
            if folder not in dirs and not is_protected(folder):
                dirs.append(folder)
    return dirs
