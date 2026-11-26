"""Structured errors that the UI can show to a non-technical user.

Every failure a user can act on gets a code. ``AppError.to_dict()`` is what the
backend stores in ``job["error_info"]``:

    {code, title, message, title_en, message_en, actions: [{id, label, label_en}], technical}

``title``/``message`` are Indonesian (the default language of the app),
``*_en`` are English. Each message says what happened, why, and what to do.
The raw exception text goes in ``technical`` only.
"""
import errno

_ACTIONS = {
    "upload_cookies": ("Unggah cookies.txt", "Upload cookies.txt"),
    "upload_video": ("Unggah file video", "Upload a video file"),
    "retry": ("Coba lagi", "Try again"),
    "resume": ("Lanjutkan", "Resume"),
    "open_settings": ("Buka Pengaturan", "Open Settings"),
    "new_project": ("Buat proyek baru", "Start a new project"),
}

ERROR_CODES = {
    "YT_SIGNIN_REQUIRED": {
        "title": "YouTube meminta verifikasi",
        "message": (
            "YouTube meminta bukti login sebelum mengirim video ini. "
            "Ini sering terjadi saat aplikasi berjalan di Google Colab, karena YouTube mencurigai permintaan dari server, "
            "dan juga pada video dengan batasan umur. "
            "Unggah file cookies.txt dari akun YouTube cadangan, atau unduh videonya sendiri lalu unggah filenya ke sini."
        ),
        "title_en": "YouTube asked for verification",
        "message_en": (
            "YouTube wants proof of a login before it sends this video. "
            "This often happens when the app runs on Google Colab, because YouTube distrusts requests from servers, "
            "and also with age-restricted videos. "
            "Upload a cookies.txt file from a spare YouTube account, or download the video yourself and upload the file here."
        ),
        "actions": ["upload_cookies", "upload_video"],
    },
    "YT_RATE_LIMITED": {
        "title": "YouTube membatasi unduhan untuk sementara",
        "message": (
            "YouTube menerima terlalu banyak permintaan dari alamat internet ini, jadi unduhan ditahan untuk sementara. "
            "Tunggu hingga satu jam, lalu coba lagi. "
            "Jika perlu lebih cepat, unduh videonya sendiri lalu unggah filenya ke sini."
        ),
        "title_en": "YouTube is limiting downloads for now",
        "message_en": (
            "YouTube received too many requests from this internet address, so it is holding downloads back for a while. "
            "Wait up to an hour, then try again. "
            "If you need it sooner, download the video yourself and upload the file here."
        ),
        "actions": ["retry", "upload_video"],
    },
    "VIDEO_UNAVAILABLE": {
        "title": "Video tidak bisa diakses",
        "message": (
            "Video ini tidak bisa diunduh dari tautan tersebut. "
            "Videonya mungkin privat, sudah dihapus, belum tayang, khusus anggota kanal, "
            "atau tidak tersedia di negara tempat server berjalan. "
            "Buka tautannya di browser tanpa login untuk memeriksa. "
            "Jika Anda punya file videonya, unggah langsung ke sini."
        ),
        "title_en": "This video can't be accessed",
        "message_en": (
            "The video could not be downloaded from that link. "
            "It may be private, deleted, not yet live, for channel members only, "
            "or unavailable in the country where the server runs. "
            "Open the link in a browser without logging in to check. "
            "If you have the video file, upload it here."
        ),
        "actions": ["upload_video"],
    },
    "VIDEO_TOO_LONG": {
        "title": "Video terlalu panjang",
        "message": (
            "Video ini lebih panjang dari yang sanggup diproses perangkat ini. "
            "Semakin panjang video, semakin banyak memori dan waktu yang dibutuhkan. "
            "Potong videonya menjadi beberapa bagian yang lebih pendek, lalu proses satu per satu."
        ),
        "title_en": "The video is too long",
        "message_en": (
            "This video is longer than this device can process. "
            "Longer videos need more memory and time. "
            "Cut the video into shorter parts and process them one at a time."
        ),
        "actions": ["upload_video"],
    },
    "OUT_OF_MEMORY": {
        "title": "Memori perangkat habis",
        "message": (
            "Proses berhenti karena memori (RAM) perangkat tidak cukup untuk video ini. "
            "Tutup aplikasi lain, pilih model subtitle yang lebih kecil, atau pakai pelacakan wajah mode standar. "
            "Setelah itu tekan Lanjutkan. Bagian yang sudah selesai tidak diulang."
        ),
        "title_en": "The device ran out of memory",
        "message_en": (
            "The process stopped because the device does not have enough memory (RAM) for this video. "
            "Close other apps, choose a smaller subtitle model, or use standard face tracking. "
            "Then press Resume. Finished parts are not redone."
        ),
        "actions": ["resume"],
    },
    "NO_GPU_SLOW": {
        "title": "GPU tidak aktif",
        "message": (
            "Aplikasi tidak menemukan GPU, jadi pembuatan subtitle memakai prosesor biasa dan berjalan jauh lebih lambat. "
            "Di Google Colab, buka menu Runtime, pilih Change runtime type, pilih T4 GPU, lalu jalankan ulang notebook. "
            "Di komputer tanpa kartu grafis NVIDIA, ini normal dan proses tetap berjalan."
        ),
        "title_en": "GPU is not active",
        "message_en": (
            "The app did not find a GPU, so it makes subtitles on the regular processor, which is much slower. "
            "On Google Colab, open the Runtime menu, choose Change runtime type, pick T4 GPU, then run the notebook again. "
            "On a computer without an NVIDIA graphics card this is normal and the process still works."
        ),
        "actions": [],
    },
    "DRIVE_NOT_MOUNTED": {
        "title": "Google Drive belum terhubung",
        "message": (
            "Proses video tidak dijalankan karena Google Drive belum terhubung. "
            "Tanpa Google Drive, klip hanya tersimpan sementara di Colab dan hilang saat sesi berakhir. "
            "Hentikan kotak server di Langkah 4 dengan tombol stop di kotak itu, "
            "jalankan Langkah 1 (Hubungkan Google Drive), lalu jalankan lagi kotak server. "
            "Jika Langkah 1 gagal karena foldernya sudah berisi file, buka menu Runtime, "
            "pilih \"Disconnect and delete runtime\", lalu jalankan semua langkah dari awal."
        ),
        "title_en": "Google Drive is not connected",
        "message_en": (
            "Video processing did not start because Google Drive is not connected. "
            "Without Google Drive, clips are kept only in Colab's temporary storage and disappear when the session ends. "
            "Stop the server box in Step 4 with its stop button, "
            "run Step 1 (Hubungkan Google Drive), then run the server box again. "
            "If Step 1 fails because the folder already contains files, open the Runtime menu, "
            "choose \"Disconnect and delete runtime\", then run every step again from the start."
        ),
        "actions": [],
    },
    "DISK_FULL": {
        "title": "Ruang penyimpanan penuh",
        "message": (
            "Proses berhenti karena tidak ada ruang kosong untuk menyimpan file video. "
            "Hapus proyek lama atau file lain yang tidak dipakai. "
            "Setelah itu tekan Lanjutkan."
        ),
        "title_en": "Storage is full",
        "message_en": (
            "The process stopped because there is no free space left to save video files. "
            "Delete old projects or other files you no longer need. "
            "Then press Resume."
        ),
        "actions": ["resume"],
    },
    "UPLOAD_MISSING": {
        "title": "File video yang diunggah sudah tidak ada",
        "message": (
            "Langkah ini memerlukan file video asli, tetapi file yang dulu Anda unggah sudah tidak tersimpan. "
            "Di Google Colab, file unggahan terhapus saat sesi berakhir. "
            "Klip yang sudah jadi tetap aman. "
            "Untuk membuat atau mengubah klip lagi, unggah videonya sekali lagi sebagai proyek baru."
        ),
        "title_en": "The uploaded video file is gone",
        "message_en": (
            "This step needs the original video file, but the file you uploaded earlier is no longer stored. "
            "On Google Colab, uploaded files are removed when the session ends. "
            "Your finished clips are safe. "
            "To make or change clips again, upload the video once more as a new project."
        ),
        "actions": ["upload_video"],
    },
    "RERUN_SOURCE_MISSING": {
        "title": "Bahan proyek lama sudah tidak ada",
        "message": (
            "Memilih ulang momen butuh video asli dan teks ucapan dari proyek ini, tetapi salah satunya sudah tidak tersimpan. "
            "Ini bisa terjadi setelah sesi Google Colab berakhir atau file proyek dihapus. "
            "Klip lama tetap aman. "
            "Buat proyek baru dari link videonya untuk memilih momen lagi."
        ),
        "title_en": "The old project's files are gone",
        "message_en": (
            "Picking moments again needs the original video and the spoken text of this project, but one of them is no longer stored. "
            "This can happen after a Google Colab session ends or the project files were deleted. "
            "Your old clips are safe. "
            "Start a new project from the video link to pick moments again."
        ),
        "actions": ["new_project"],
    },
    "PUBLISH_FAILED": {
        "title": "Klip belum tersimpan ke folder penyimpanan",
        "message": (
            "Klip sudah selesai dibuat, tetapi gagal disalin ke folder penyimpanan. "
            "Di Google Colab folder itu adalah Google Drive, jadi periksa apakah Google Drive masih terhubung "
            "dan masih punya ruang kosong. "
            "Setelah itu tekan Lanjutkan. Klip yang sudah jadi tidak dibuat ulang, hanya disalin."
        ),
        "title_en": "Clips were not saved to the storage folder",
        "message_en": (
            "The clips are finished, but copying them to the storage folder failed. "
            "On Google Colab that folder is Google Drive, so check that Google Drive is still connected "
            "and still has free space. "
            "Then press Resume. Finished clips are not made again, only copied."
        ),
        "actions": ["resume"],
    },
    "OUTPUT_DIR_REFUSED": {
        "title": "Folder hasil tidak bisa dipakai",
        "message": (
            "Klip tidak disimpan di folder hasil yang dipilih, karena folder itu menyimpan file pribadi aplikasi. "
            "Menyimpan klip di sana bisa merusak data aplikasi. "
            "Pilih folder lain di Pengaturan, lalu coba lagi."
        ),
        "title_en": "The output folder cannot be used",
        "message_en": (
            "Clips were not saved to the chosen output folder, because that folder holds the app's private files. "
            "Saving clips there could damage the app's data. "
            "Choose another folder in Settings, then try again."
        ),
        "actions": ["open_settings"],
    },
    "AI_KEY_INVALID": {
        "title": "Kunci API ditolak",
        "message": (
            "Layanan AI menolak kunci API yang dipakai. "
            "Kunci itu mungkin salah ketik, sudah dicabut, atau bukan milik layanan yang dipilih. "
            "Periksa kunci di halaman Pengaturan, lalu tekan Lanjutkan."
        ),
        "title_en": "The API key was rejected",
        "message_en": (
            "The AI service rejected the API key. "
            "The key may be mistyped, revoked, or issued by a different service than the one selected. "
            "Check the key on the Settings page, then press Resume."
        ),
        "actions": ["open_settings", "resume"],
    },
    "AI_KEY_MISSING": {
        "title": "Kunci API belum diisi",
        "message": (
            "Bagian proses yang tersisa memerlukan layanan AI, tetapi aplikasi tidak mengirim kunci API untuk layanan itu. "
            "Kunci API tidak disimpan di riwayat proyek, jadi kunci diambil dari Pengaturan setiap kali proses dilanjutkan. "
            "Isi kunci untuk layanan AI yang dipilih di halaman Pengaturan, lalu tekan Lanjutkan."
        ),
        "title_en": "No API key was given",
        "message_en": (
            "The rest of this process needs the AI service, but the app did not send an API key for it. "
            "API keys are not kept in the project history, so the key is taken from Settings each time a process is resumed. "
            "Enter the key for the selected AI service on the Settings page, then press Resume."
        ),
        "actions": ["open_settings", "resume"],
    },
    "ADDON_DOWNLOAD_FAILED": {
        "title": "Gagal memasang komponen tambahan",
        "message": (
            "Unduhan komponen berhenti atau file tidak lengkap. "
            "Periksa koneksi internet dan ruang penyimpanan, lalu coba lagi."
        ),
        "title_en": "Could not install add-on component",
        "message_en": (
            "The component download stopped or the file was incomplete. "
            "Check your internet connection and storage space, then try again."
        ),
        "actions": ["retry"],
    },
    "ADDON_IN_USE": {
        "title": "Komponen akan dihapus saat aplikasi dibuka ulang",
        "message": (
            "Komponen ini sedang dipakai oleh aplikasi yang berjalan sehingga belum bisa dihapus langsung. "
            "Penghapusan sudah dijadwalkan otomatis, cukup tutup lalu buka ulang Auto Clipper."
        ),
        "title_en": "Component will be removed on restart",
        "message_en": (
            "This component is in use by the running app so it cannot be deleted right away. "
            "Removal is scheduled automatically, simply close and reopen Auto Clipper."
        ),
        "actions": [],
    },
    "FFMPEG_MISSING": {
        "title": "Komponen pengolah video tidak ditemukan",
        "message": (
            "Aplikasi tidak menemukan program pengolah video yang dipakai untuk memotong video menjadi klip. "
            "Tanpa program itu tidak ada klip yang bisa dibuat. "
            "Di aplikasi desktop, pasang ulang Auto Clipper. Di Google Colab, jalankan ulang langkah instalasi di notebook."
        ),
        "title_en": "The video processing component is missing",
        "message_en": (
            "The app could not find the video processing program it uses to cut a video into clips. "
            "No clip can be made without it. "
            "In the desktop app, reinstall Auto Clipper. On Google Colab, run the notebook's install step again."
        ),
        "actions": [],
    },
    # Reasons an uploaded cookies.txt is turned away (backend/cookies.py).
    "COOKIES_EMPTY": {
        "title": "File cookies kosong",
        "message": (
            "File yang diunggah tidak berisi cookies satu pun. "
            "Kemungkinan ekspor dari browser gagal atau file yang dipilih salah. "
            "Buka YouTube di browser, login dengan akun cadangan, ekspor ulang cookies.txt, lalu unggah lagi."
        ),
        "title_en": "The cookies file is empty",
        "message_en": (
            "The uploaded file does not contain any cookies. "
            "The export from the browser may have failed, or the wrong file was picked. "
            "Open YouTube in your browser, log in with a spare account, export cookies.txt again, then upload it."
        ),
        "actions": ["upload_cookies"],
    },
    "COOKIES_INVALID_FORMAT": {
        "title": "File ini bukan cookies.txt yang bisa dibaca",
        "message": (
            "Aplikasi tidak bisa membaca file yang diunggah sebagai cookies. "
            "File harus berupa cookies.txt hasil ekspor browser (format Netscape), "
            "bukan JSON, gambar, atau teks yang disalin tempel. "
            "Ekspor ulang dari browser dengan pilihan format cookies.txt, lalu unggah lagi."
        ),
        "title_en": "This file is not a readable cookies.txt",
        "message_en": (
            "The app could not read the uploaded file as cookies. "
            "It must be a cookies.txt exported from the browser (Netscape format), "
            "not JSON, an image, or copied and pasted text. "
            "Export it again from the browser with the cookies.txt format selected, then upload it."
        ),
        "actions": ["upload_cookies"],
    },
    "COOKIES_NO_YOUTUBE": {
        "title": "Tidak ada cookies YouTube di file ini",
        "message": (
            "File cookies terbaca, tetapi tidak berisi cookies dari youtube.com. "
            "Kemungkinan ekspor dilakukan saat tab yang terbuka bukan YouTube. "
            "Buka youtube.com, login dengan akun cadangan, ekspor cookies dari tab itu, lalu unggah lagi."
        ),
        "title_en": "This file has no YouTube cookies",
        "message_en": (
            "The cookies file could be read, but it has no cookies from youtube.com. "
            "The export was probably made while a tab other than YouTube was open. "
            "Open youtube.com, log in with a spare account, export the cookies from that tab, then upload it."
        ),
        "actions": ["upload_cookies"],
    },
    "COOKIES_EXPIRED": {
        "title": "Cookies YouTube sudah kedaluwarsa",
        "message": (
            "Semua cookies YouTube di file ini sudah melewati masa berlakunya, jadi YouTube tidak menerimanya lagi. "
            "Cookies punya batas waktu, dan file ini diekspor terlalu lama yang lalu. "
            "Login lagi ke YouTube dengan akun cadangan, ekspor cookies.txt yang baru, lalu unggah."
        ),
        "title_en": "The YouTube cookies have expired",
        "message_en": (
            "Every YouTube cookie in this file is past its expiry date, so YouTube no longer accepts them. "
            "Cookies have a time limit, and this file was exported too long ago. "
            "Log in to YouTube again with a spare account, export a new cookies.txt, then upload it."
        ),
        "actions": ["upload_cookies"],
    },
    "COOKIES_TOO_LARGE": {
        "title": "File cookies terlalu besar",
        "message": (
            "File yang diunggah lebih besar dari 1 MB, jauh di atas ukuran file cookies yang wajar. "
            "Kemungkinan file yang dipilih salah. "
            "Pilih file cookies.txt hasil ekspor dari browser, lalu unggah lagi."
        ),
        "title_en": "The cookies file is too large",
        "message_en": (
            "The uploaded file is larger than 1 MB, far more than a cookies file needs. "
            "The wrong file was probably picked. "
            "Choose the cookies.txt file exported from your browser, then upload it."
        ),
        "actions": ["upload_cookies"],
    },
    "UNKNOWN": {
        "title": "Proses gagal",
        "message": (
            "Proses berhenti karena kesalahan yang belum dikenali aplikasi. "
            "Tekan Lanjutkan untuk mencoba lagi dari bagian yang gagal. "
            "Jika gagal lagi, buka Detail teknis, salin isinya, dan kirimkan ke pengembang."
        ),
        "title_en": "The process failed",
        "message_en": (
            "The process stopped because of an error the app does not recognise yet. "
            "Press Resume to try again from the part that failed. "
            "If it fails again, open Technical details, copy the text, and send it to the developer."
        ),
        "actions": ["resume"],
    },
}


class AppError(Exception):
    """An error with a code the UI knows how to present.

    ``str(error)`` is the raw technical text, so code that still shows
    ``job["error"]`` as a plain string keeps working.
    """

    def __init__(self, code: str, technical: str = ""):
        self.code = code
        self.technical = technical or ""
        super().__init__(self.technical or ERROR_CODES.get(code, ERROR_CODES["UNKNOWN"])["message"])

    def to_dict(self) -> dict:
        entry = ERROR_CODES.get(self.code, ERROR_CODES["UNKNOWN"])
        return {
            "code": self.code,
            "title": entry["title"],
            "message": entry["message"],
            "title_en": entry["title_en"],
            "message_en": entry["message_en"],
            "actions": [
                {"id": action_id, "label": _ACTIONS[action_id][0], "label_en": _ACTIONS[action_id][1]}
                for action_id in entry["actions"]
            ],
            "technical": self.technical,
        }


_DISK_FULL = ("no space left on device", "errno 28", "not enough space on the disk", "disk quota exceeded")
_RATE_LIMITED = ("http error 429", "too many requests", "rate-limit", "rate limit", "try again later")
_UNAVAILABLE = (
    "private video", "video is private", "video unavailable", "video is unavailable",
    "not available in your country", "not made this video available", "has been removed",
    "has been terminated", "members-only", "live event will begin", "premieres in",
    "this video is not available", "video does not exist",
)
_SIGNIN = (
    "sign in to confirm", "not a bot", "confirm your age", "login required", "use --cookies",
    "http error 403", "403: forbidden",
)
_OUT_OF_MEMORY = ("out of memory", "unable to allocate", "cannot allocate memory", "bad_alloc", "bad allocation")
_AI_KEY = (
    "incorrect api key", "invalid api key", "api key not valid", "api_key_invalid", "invalid_api_key",
    "invalid x-api-key", "invalid authentication", "api key is invalid",
)


def _has(text: str, needles) -> bool:
    return any(n in text for n in needles)


def _wrap(code: str, exc: BaseException) -> AppError:
    err = AppError(code, technical=str(exc) or type(exc).__name__)
    err.__cause__ = exc
    return err


def classify_download_error(exc: BaseException) -> AppError:
    """Map a yt-dlp failure to an AppError. Unrecognised errors become UNKNOWN."""
    if isinstance(exc, AppError):
        return exc
    text = str(exc).lower()
    # Order matters: a rate-limit notice also says "Video unavailable", and a
    # private video also says "Sign in".
    if _has(text, _DISK_FULL):
        return _wrap("DISK_FULL", exc)
    if _has(text, _RATE_LIMITED):
        return _wrap("YT_RATE_LIMITED", exc)
    if _has(text, _UNAVAILABLE):
        return _wrap("VIDEO_UNAVAILABLE", exc)
    if _has(text, _SIGNIN):
        return _wrap("YT_SIGNIN_REQUIRED", exc)
    return _wrap("UNKNOWN", exc)


def to_app_error(exc: BaseException) -> AppError:
    """Map any job failure to an AppError."""
    if isinstance(exc, AppError):
        return exc
    text = str(exc).lower()
    if isinstance(exc, MemoryError) or _has(text, _OUT_OF_MEMORY):
        return _wrap("OUT_OF_MEMORY", exc)
    if isinstance(exc, OSError) and exc.errno == errno.ENOSPC:
        return _wrap("DISK_FULL", exc)
    if _has(text, _AI_KEY):
        return _wrap("AI_KEY_INVALID", exc)
    return classify_download_error(exc)
