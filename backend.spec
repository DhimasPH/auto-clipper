# -*- mode: python ; coding: utf-8 -*-
import os
import sys
from PyInstaller.utils.hooks import collect_all

datas = []
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
    'backend',
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

for pkg in [
    'faster_whisper',
    'ctranslate2',
    'onnxruntime',
    'cv2',
    'numpy',
    'google.genai',
    'openai',
    'httpx',
    'pydantic',
    'pydantic_core',
    'uvicorn',
    'fastapi',
    'starlette',
    'anyio',
    'h11',
    'yt_dlp',
    'requests',
    'certifi',
]:
    try:
        d, b, h = collect_all(pkg)
        datas.extend(d)
        binaries.extend(b)
        hiddenimports.extend(h)
    except Exception:
        pass

a = Analysis(
    [os.path.join('backend', 'main.py')],
    pathex=['.'],
    binaries=binaries,
    datas=datas,
    hiddenimports=list(set(hiddenimports)),
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
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
