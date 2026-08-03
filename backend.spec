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
]

for pkg in [
    'faster_whisper',
    'ctranslate2',
    'onnxruntime',
    'cv2',
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

