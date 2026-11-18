"""Environment checks shown before a job starts.

``run_preflight()`` returns one result per check:

    {id, level: "ok"|"warn"|"block", title, message, title_en, message_en, code?, technical?}

``block`` stops a job before it starts (see ``blocking_error``). ``warn`` is
information only: the job runs, the user is told what will be slower or at
risk. Checks read state and change nothing. A check that crashes is reported as
a warning and logged; it never fails the other checks and never blocks a job.

Each check gets its facts from a small ``_probe`` function so tests can replace
one fact at a time.
"""
import ctypes
import datetime
import importlib
import os
import shutil
import sys

from backend.errors import AppError, ERROR_CODES
from backend.logger import log_error

DISK_BLOCK_GB = 1.0
DISK_WARN_GB = 5.0
RAM_WARN_GB = 2.0
DOWNLOADER_MAX_AGE_DAYS = 90  # the age at which yt-dlp itself starts warning


# --- probes: one fact each, no side effects ----------------------------------

def _ffmpeg_path():
    from backend.video_utils import get_ffmpeg_path
    return get_ffmpeg_path()


def _free_disk_gb() -> float:
    # The fullest of the disks a job writes to: with AUTO_CLIPPER_WORK_DIR the
    # download and renders go to the work dir, the clips to the library.
    from backend.workspace import free_disk_gb
    return free_disk_gb()


def _storage_dirs() -> list:
    from backend.workspace import storage_dirs
    return storage_dirs()


def _available_ram_gb():
    """Free memory in GB, or None when this platform offers no way to read it."""
    try:
        import psutil
        return psutil.virtual_memory().available / 1024 ** 3
    except ImportError:
        pass
    if sys.platform == "win32":
        import ctypes

        class MEMORYSTATUSEX(ctypes.Structure):
            _fields_ = [
                ("dwLength", ctypes.c_ulong), ("dwMemoryLoad", ctypes.c_ulong),
                ("ullTotalPhys", ctypes.c_ulonglong), ("ullAvailPhys", ctypes.c_ulonglong),
                ("ullTotalPageFile", ctypes.c_ulonglong), ("ullAvailPageFile", ctypes.c_ulonglong),
                ("ullTotalVirtual", ctypes.c_ulonglong), ("ullAvailVirtual", ctypes.c_ulonglong),
                ("ullAvailExtendedVirtual", ctypes.c_ulonglong),
            ]

        status = MEMORYSTATUSEX()
        status.dwLength = ctypes.sizeof(status)
        if not ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(status)):
            return None
        return status.ullAvailPhys / 1024 ** 3
    if os.path.exists("/proc/meminfo"):
        with open("/proc/meminfo", "r", encoding="ascii") as f:
            for line in f:
                if line.startswith("MemAvailable:"):
                    return int(line.split()[1]) / 1024 ** 2
    return None


def _cuda_device_count() -> int:
    import ctranslate2
    return int(ctranslate2.get_cuda_device_count())


# What ctranslate2 4.5+ (faster-whisper) loads to run on the GPU: CUDA 12 cuBLAS
# and cuDNN 9. A GPU without them makes Whisper fall back to the processor.
_WHISPER_GPU_LIBS = (("libcublas.so.12", "cublas"), ("libcudnn.so.9", "cudnn"))


def _nvidia_lib_dir(package: str):
    """lib folder of the nvidia-<package>-cu12 wheel, or None when it is not installed."""
    try:
        module = importlib.import_module(f"nvidia.{package}.lib")
    except ImportError:
        return None
    paths = list(getattr(module, "__path__", []))
    return paths[0] if paths else None


def _whisper_gpu_libs_missing() -> list:
    """Libraries Whisper needs on the GPU that cannot be loaded. Linux only.

    Looks where colab_api.py points LD_LIBRARY_PATH: the system paths, then
    the nvidia pip packages.
    """
    if not sys.platform.startswith("linux"):
        return []
    missing = []
    for name, package in _WHISPER_GPU_LIBS:
        candidates = [name]
        lib_dir = _nvidia_lib_dir(package)
        if lib_dir:
            candidates.append(os.path.join(lib_dir, name))
        for candidate in candidates:
            try:
                ctypes.CDLL(candidate)
                break
            except OSError:
                continue
        else:
            missing.append(name)
    return missing


def _gpu_encoder_available() -> bool:
    from backend.crop_utils import is_nvenc_available
    return bool(is_nvenc_available())


def _cloud_drive_expected() -> bool:
    """True when this is a Colab run whose library lives on Google Drive.

    AUTO_CLIPPER_WORKSPACE is the library (where clips are kept). The work dir
    (AUTO_CLIPPER_WORK_DIR) is a local disk and plays no part here.
    """
    workspace = os.environ.get("AUTO_CLIPPER_WORKSPACE", "").replace("\\", "/")
    return bool(os.environ.get("AUTO_CLIPPER_CLOUD_MODE")) and workspace.startswith("/content/drive")


def _drive_mounted() -> bool:
    # Ask the mount point, not the folder: opening the library creates
    # /content/drive/MyDrive/... on the local disk when Drive is not mounted.
    return os.path.ismount("/content/drive")


def _deno_path():
    return shutil.which("deno")


def _downloader_version() -> str:
    from yt_dlp.version import __version__
    return __version__


def _today() -> datetime.date:
    return datetime.date.today()


# --- results -------------------------------------------------------------------

def _result(check_id, level, title, message, title_en, message_en, code=None, technical=None) -> dict:
    result = {
        "id": check_id, "level": level,
        "title": title, "message": message, "title_en": title_en, "message_en": message_en,
    }
    if code:
        result["code"] = code
    if technical:
        result["technical"] = technical
    return result


def _from_error_code(check_id, level, code, technical=None) -> dict:
    entry = ERROR_CODES[code]
    return _result(check_id, level, entry["title"], entry["message"], entry["title_en"], entry["message_en"],
                   code=code, technical=technical)


def _gb(value: float) -> tuple:
    """(Indonesian, English) text for a size in GB."""
    text = f"{value:.1f}"
    return text.replace(".", ","), text


# --- checks ---------------------------------------------------------------------

def check_ffmpeg() -> dict:
    path = _ffmpeg_path()
    if not path:
        return _from_error_code("ffmpeg", "block", "FFMPEG_MISSING", technical="ffmpeg executable not found")
    return _result(
        "ffmpeg", "ok",
        "Pengolah video siap", "Aplikasi menemukan FFmpeg.",
        "Video processing is ready", "The app found FFmpeg.",
        technical=f"ffmpeg at {path}",
    )


def check_disk() -> dict:
    free = _free_disk_gb()
    free_id, free_en = _gb(free)
    technical = f"free disk space {free:.2f} GB at {' and '.join(_storage_dirs())}"
    if free < DISK_BLOCK_GB:
        return _result(
            "disk", "block",
            "Ruang penyimpanan penuh",
            f"Ruang kosong tinggal {free_id} GB, tidak cukup untuk mengunduh dan merender video. "
            "Proses tidak dimulai agar tidak berhenti di tengah jalan. "
            "Hapus proyek lama atau file lain yang tidak dipakai, lalu coba lagi.",
            "Storage is full",
            f"Only {free_en} GB of space is free, which is not enough to download and render a video. "
            "The process was not started so it would not stop partway. "
            "Delete old projects or other files you no longer need, then try again.",
            code="DISK_FULL", technical=technical,
        )
    if free < DISK_WARN_GB:
        return _result(
            "disk", "warn",
            "Ruang penyimpanan menipis",
            f"Ruang kosong tinggal {free_id} GB. "
            "Satu video panjang beserta klipnya bisa memakai lebih dari 1 GB, jadi proses bisa berhenti di tengah jalan. "
            "Hapus proyek lama atau file lain yang tidak dipakai.",
            "Storage space is running low",
            f"Only {free_en} GB of space is free. "
            "One long video and its clips can take more than 1 GB, so the process may stop partway. "
            "Delete old projects or other files you no longer need.",
            technical=technical,
        )
    return _result(
        "disk", "ok",
        "Ruang penyimpanan cukup", f"Ruang kosong {free_id} GB.",
        "Enough storage space", f"{free_en} GB free.",
        technical=technical,
    )


def check_ram() -> dict:
    available = _available_ram_gb()
    if available is None:
        return _result(
            "ram", "ok",
            "Memori tidak diperiksa", "Jumlah memori bebas tidak bisa dibaca di perangkat ini.",
            "Memory was not checked", "The amount of free memory cannot be read on this device.",
        )
    ram_id, ram_en = _gb(available)
    if available < RAM_WARN_GB:
        return _result(
            "ram", "warn",
            "Memori bebas tinggal sedikit",
            f"Memori (RAM) yang bebas tinggal {ram_id} GB. "
            "Proses bisa berhenti saat membuat subtitle atau melacak wajah. "
            "Tutup aplikasi lain, atau pilih model subtitle yang lebih kecil.",
            "Little free memory left",
            f"Only {ram_en} GB of memory (RAM) is free. "
            "The process may stop while making subtitles or tracking faces. "
            "Close other apps, or choose a smaller subtitle model.",
            technical=f"available memory {available:.2f} GB",
        )
    return _result(
        "ram", "ok",
        "Memori cukup", f"Memori bebas {ram_id} GB.",
        "Enough memory", f"{ram_en} GB of memory is free.",
    )


def check_gpu() -> dict:
    count = _cuda_device_count()
    if count < 1:
        return _from_error_code("gpu", "warn", "NO_GPU_SLOW", technical="ctranslate2 reports 0 CUDA devices")
    missing = _whisper_gpu_libs_missing()
    if missing:
        return _result(
            "gpu", "warn",
            "Subtitle memakai prosesor",
            "GPU aktif, tetapi bagian program yang dibutuhkan untuk membuat subtitle di GPU tidak ditemukan. "
            "Subtitle akan dibuat dengan prosesor, dan untuk video panjang bisa memakan waktu lebih dari satu jam. "
            "Di Google Colab, hentikan server, jalankan ulang Langkah 3 di notebook, lalu jalankan lagi server.",
            "Subtitles use the processor",
            "The GPU is active, but the parts of the program needed to make subtitles on it were not found. "
            "Subtitles will be made on the processor, which can take more than an hour for a long video. "
            "On Google Colab, stop the server, run Step 3 of the notebook again, then start the server again.",
            technical="cannot load " + ", ".join(missing),
        )
    return _result(
        "gpu", "ok",
        "GPU aktif", "Subtitle dibuat memakai GPU.",
        "GPU is active", "Subtitles are made on the GPU.",
    )


def check_gpu_render() -> dict:
    if not _gpu_encoder_available():
        return _result(
            "gpu_render", "warn",
            "Render memakai prosesor",
            "Kartu grafis di perangkat ini tidak bisa dipakai untuk merender klip, "
            "jadi render memakai prosesor dan berjalan lebih lambat. "
            "Di Google Colab ini bisa terjadi walaupun GPU aktif: GPU tetap dipakai untuk membuat subtitle. "
            "Di komputer tanpa kartu grafis NVIDIA, ini juga normal. "
            "Proses tetap berjalan, tidak ada yang perlu dilakukan.",
            "Rendering uses the processor",
            "The graphics card on this device cannot be used to render clips, "
            "so rendering runs on the processor and is slower. "
            "On Google Colab this can happen even when the GPU is active: the GPU is still used to make subtitles. "
            "It is also normal on a computer without an NVIDIA graphics card. "
            "The process still works and you do not need to do anything.",
            technical="h264_nvenc test encode failed, rendering with libx264",
        )
    return _result(
        "gpu_render", "ok",
        "Render memakai GPU", "Klip dirender memakai kartu grafis.",
        "Rendering uses the GPU", "Clips are rendered on the graphics card.",
    )


def check_drive() -> dict:
    if not _cloud_drive_expected():
        return _result(
            "drive", "ok",
            "Google Drive tidak dipakai", "Google Drive hanya dipakai saat aplikasi berjalan di Google Colab.",
            "Google Drive is not used", "Google Drive is only used when the app runs on Google Colab.",
        )
    if not _drive_mounted():
        return _from_error_code("drive", "warn", "DRIVE_NOT_MOUNTED", technical="/content/drive is not a mount point")
    return _result(
        "drive", "ok",
        "Google Drive terhubung", "Klip disimpan ke Google Drive.",
        "Google Drive is connected", "Clips are saved to Google Drive.",
    )


def check_deno() -> dict:
    path = _deno_path()
    if not path:
        return _result(
            "deno", "warn",
            "Pembantu unduhan YouTube belum terpasang",
            "Aplikasi tidak menemukan Deno, program kecil yang dipakai untuk menjawab pemeriksaan dari YouTube. "
            "Tanpa program itu sebagian video YouTube gagal diunduh. "
            "Pasang Deno dari deno.com, lalu jalankan ulang aplikasi.",
            "The YouTube download helper is not installed",
            "The app did not find Deno, a small program used to answer YouTube's checks. "
            "Without it some YouTube videos fail to download. "
            "Install Deno from deno.com, then restart the app.",
            technical="deno executable not found in PATH",
        )
    return _result(
        "deno", "ok",
        "Pembantu unduhan YouTube terpasang", "Aplikasi menemukan Deno.",
        "The YouTube download helper is installed", "The app found Deno.",
        technical=f"deno at {path}",
    )


def check_downloader() -> dict:
    version = _downloader_version()
    year, month, day = (int(part) for part in version.split(".")[:3])
    age = (_today() - datetime.date(year, month, day)).days
    technical = f"yt-dlp {version}, {age} days old"
    if age > DOWNLOADER_MAX_AGE_DAYS:
        return _result(
            "downloader", "warn",
            "Pengunduh video perlu diperbarui",
            f"Pengunduh video di aplikasi ini dirilis {age} hari lalu. "
            "YouTube sering berubah, jadi versi lama makin sering gagal mengunduh. "
            "Perbarui Auto Clipper ke versi terbaru. Di Google Colab, jalankan ulang langkah instalasi di notebook.",
            "The video downloader needs an update",
            f"The video downloader in this app was released {age} days ago. "
            "YouTube changes often, so old versions fail more and more. "
            "Update Auto Clipper to the latest version. On Google Colab, run the notebook's install step again.",
            technical=technical,
        )
    return _result(
        "downloader", "ok",
        "Pengunduh video masih baru", f"Versi pengunduh {version}.",
        "The video downloader is recent", f"Downloader version {version}.",
        technical=technical,
    )


CHECKS = (
    ("ffmpeg", check_ffmpeg), ("disk", check_disk), ("ram", check_ram), ("gpu", check_gpu),
    ("gpu_render", check_gpu_render), ("drive", check_drive), ("deno", check_deno), ("downloader", check_downloader),
)
# Only these can return "block"; they are the ones run again right before a job.
_BLOCKING_CHECKS = (("ffmpeg", check_ffmpeg), ("disk", check_disk))


def _run(checks) -> list:
    results = []
    for check_id, check in checks:
        try:
            results.append(check())
        except Exception as e:
            log_error(f"preflight.{check_id}", e)
            results.append(_result(
                check_id, "warn",
                "Pemeriksaan tidak bisa dijalankan",
                "Aplikasi tidak bisa memeriksa bagian ini. Proses tetap bisa dimulai. "
                "Jika proses gagal, buka Detail teknis dan kirimkan isinya ke pengembang.",
                "A check could not run",
                "The app could not run this check. You can still start the process. "
                "If it fails, open Technical details and send the text to the developer.",
                technical=f"{type(e).__name__}: {e}",
            ))
    return results


def run_preflight() -> list:
    """Run every check. Never raises."""
    return _run(CHECKS)


def blocking_error():
    """The AppError that should stop a job right now, or None when it may start."""
    for result in _run(_BLOCKING_CHECKS):
        if result["level"] == "block":
            return AppError(result["code"], technical=f"preflight {result['id']}: {result.get('technical', '')}")
    return None
