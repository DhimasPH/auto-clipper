"""Local web mode: the backend serves the built UI (SP1, spec 4.4, ADR-013).

On when AUTO_CLIPPER_WEB_MODE is set. backend.web_mode.launch sets it together
with AUTO_CLIPPER_UI_DIR (the Vite build) and the launch token. The app uses
HashRouter, so only "/", "/assets/*" and the image files at the top of the UI
folder are served: there is no SPA fallback that could shadow an API route.
In web mode these paths and /health need no token; everything else does
(verify_token in backend/main.py).
"""
import os
import re

from fastapi import APIRouter
from fastapi.responses import FileResponse, JSONResponse

from backend.path_guard import is_network_or_device_path, is_protected, is_within

WEB_MODE_ENV = "AUTO_CLIPPER_WEB_MODE"
UI_DIR_ENV = "AUTO_CLIPPER_UI_DIR"

# index.html links /logo.svg; LandingPage and AuthGate use /character.png and /logo.png.
_ROOT_FILE = re.compile(r"^/[A-Za-z0-9_-][A-Za-z0-9_.-]*\.(svg|png|ico|jpg|jpeg|webp)$", re.IGNORECASE)

# Set explicitly: on Windows the mimetypes module reads the registry, which can map
# .js to text/plain, and the browser then refuses to run the module script.
_MEDIA_TYPES = {
    ".html": "text/html",
    ".js": "text/javascript",
    ".mjs": "text/javascript",
    ".css": "text/css",
    ".json": "application/json",
    ".map": "application/json",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".ico": "image/x-icon",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
}

_NO_CACHE = "no-cache"
# Vite puts a content hash in every file name under assets/.
_ASSET_CACHE = "public, max-age=31536000, immutable"


def is_web_mode() -> bool:
    return bool(os.environ.get(WEB_MODE_ENV))


def ui_dir() -> str:
    """The UI folder, or "" when none is set."""
    folder = os.environ.get(UI_DIR_ENV, "").strip()
    return os.path.abspath(folder) if folder else ""


def is_public_path(path: str) -> bool:
    """Paths that need no token in web mode."""
    return path in ("/", "/health") or path.startswith("/assets/") or bool(_ROOT_FILE.match(path))


def _not_found() -> JSONResponse:
    return JSONResponse(status_code=404, content={"status": "error", "message": "Not found"})


def _serve(relative: str, cache: str):
    root = ui_dir()
    if not is_web_mode() or not root:
        return _not_found()
    # Checked on the text first: os.path.join drops the UI folder for a part that
    # starts with "\\" or a drive, and resolving a UNC path opens an SMB connection
    # to that host. These routes need no token, so any web page could send one.
    if "\\" in relative or ":" in relative or is_network_or_device_path(relative):
        return _not_found()
    target = os.path.join(root, *relative.split("/"))
    if is_protected(target) or not is_within(target, root) or not os.path.isfile(target):
        return _not_found()
    media_type = _MEDIA_TYPES.get(os.path.splitext(target)[1].lower(), "application/octet-stream")
    return FileResponse(target, media_type=media_type, headers={"Cache-Control": cache})


router = APIRouter()


@router.get("/")
def ui_index():
    return _serve("index.html", _NO_CACHE)


@router.get("/assets/{file_path:path}")
def ui_asset(file_path: str):
    return _serve(f"assets/{file_path}", _ASSET_CACHE)


@router.get("/{name}")
def ui_root_file(name: str):
    if not _ROOT_FILE.match(f"/{name}"):
        return _not_found()
    return _serve(name, _NO_CACHE)
