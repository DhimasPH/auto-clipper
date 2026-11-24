# -*- mode: python ; coding: utf-8 -*-
import os
import sys
from PyInstaller.utils.hooks import collect_all, copy_metadata

datas = [
    ('backend/assets', 'backend/assets'),
]
datas.extend(copy_metadata('yt-dlp'))
binaries = []
hiddenimports = [
    'google',
    'google.genai',
    'google.genai.types',
    'openai',
    'httpx',
    'pydantic',
    'pydantic.deprecated.decorator',
    'pydantic_core',
    'uvicorn',
    'uvicorn.logging',
    'uvicorn.loops',
    'uvicorn.loops.auto',
    'uvicorn.protocols',
    'uvicorn.protocols.http',
    'uvicorn.protocols.http.auto',
    'uvicorn.protocols.http.h11_impl',
    'uvicorn.lifespan',
    'uvicorn.lifespan.on',
    'uvicorn.lifespan.off',
    'fastapi',
    'starlette',
    'anyio',
    'h11',
    'requests',
    'certifi',
    'yt_dlp',
    'sqlite3',
    # Stdlib modules needed when loading mediapipe/absl/flatbuffers dynamically from addons/
    'wave',
    'csv',
    'timeit',
    'getpass',
    'xml',
    'xml.etree',
    'xml.etree.ElementTree',
    'backend',
    'backend._lazy',
    'backend.main',
    'backend.jobs',
    'backend.ai_utils',
    'backend.crop_utils',
    'backend.db',
    'backend.logger',
    'backend.video_utils',
    'backend.broll',
    'backend.metadata',
]

# Native runtimes that carry dynamic libraries / asset data files.
for pkg in [
    'faster_whisper',
    'ctranslate2',
    'onnxruntime',
    'av',
    'numpy',
    'certifi',
]:
    try:
        d, b, h = collect_all(pkg)
        datas.extend(d)
        binaries.extend(b)
        hiddenimports.extend(h)
    except Exception:
        pass

# OpenCV: keep native binaries, Python submodules, and only the single Haar cascade we use.
try:
    d_cv2, b_cv2, h_cv2 = collect_all('cv2')
    binaries.extend(b_cv2)
    hiddenimports.extend(h_cv2)
    for src, dst in d_cv2:
        if src.replace('\\', '/').endswith('haarcascade_frontalface_default.xml'):
            datas.append((src, dst))
except Exception:
    pass


def _keep_toc_entry(dest_path: str) -> bool:
    norm = '/' + dest_path.replace('\\', '/').lower().lstrip('/')
    base = os.path.basename(norm)
    if '/tests/' in norm or '/test/' in norm:
        return False
    if norm.endswith(('.h', '.hpp', '.lib', '.pdb')):
        return False
    if 'cv2/data/' in norm and base != 'haarcascade_frontalface_default.xml':
        return False
    return True


a = Analysis(
    [os.path.join('backend', 'main.py')],
    pathex=['.'],
    binaries=binaries,
    datas=datas,
    hiddenimports=list(set(hiddenimports)),
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=['mediapipe', 'flatbuffers', 'absl', 'matplotlib', 'sounddevice'],
    noarchive=False,
    optimize=0,
)
a.datas = [entry for entry in a.datas if _keep_toc_entry(entry[0])]
a.binaries = [entry for entry in a.binaries if _keep_toc_entry(entry[0])]
pyz = PYZ(a.pure)

icon_path = os.path.join('src-tauri', 'icons', 'icon.ico') if os.path.exists(os.path.join('src-tauri', 'icons', 'icon.ico')) else None
version_file = 'file_version_info.txt' if os.path.exists('file_version_info.txt') else None

# Platform-aware packaging:
#  - macOS: ONEDIR (COLLECT -> backend_app/). Required so each bundled .dylib can
#    be ad-hoc codesigned individually; onefile hides the dylibs inside the archive
#    and they end up unsigned at runtime -> "Killed: 9" on Apple Silicon/Monterey.
#  - Windows: ONEFILE (unchanged). The Windows build is stable on onefile and does
#    not need per-dylib signing, so we keep it exactly as before.
IS_MACOS = sys.platform == 'darwin'

if IS_MACOS:
    exe = EXE(
        pyz,
        a.scripts,
        [],
        exclude_binaries=True,
        name='backend',
        debug=False,
        bootloader_ignore_signals=False,
        strip=False,
        upx=False,
        console=True,
        disable_windowed_traceback=False,
        argv_emulation=False,
        target_arch=None,
        codesign_identity=None,
        entitlements_file=None,
        icon=icon_path,
        version=version_file,
    )

    coll = COLLECT(
        exe,
        a.binaries,
        a.zipfiles,
        a.datas,
        strip=False,
        upx=False,
        name='backend_app'
    )
else:
    exe = EXE(
        pyz,
        a.scripts,
        a.binaries,
        a.datas,
        [],
        name='backend',
        debug=False,
        bootloader_ignore_signals=False,
        strip=False,
        upx=False,
        upx_exclude=[],
        runtime_tmpdir=None,
        console=True,
        disable_windowed_traceback=False,
        argv_emulation=False,
        target_arch=None,
        codesign_identity=None,
        entitlements_file=None,
        icon=icon_path,
        version=version_file,
    )
