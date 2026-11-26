"""Fail the build when a Windows binary imports from vertdll.dll.

vertdll.dll is the VBS enclave runtime. Since Rust 1.100, std no longer pins
WaitOnAddress/WakeByAddress* to api-ms-win-core-synch-l1-2-0.dll, and an old
windows-sys import library in the dependency tree can bind them to vertdll.dll.
The app then links cleanly but crashes with 0xC0000005 right after start
(v1.19.0, 2026-11-26). Usage: python scripts/check_windows_imports.py <exe>...
"""
import sys

import pefile

FORBIDDEN = {"vertdll.dll"}


def bad_imports(path):
    pe = pefile.PE(path, fast_load=True)
    pe.parse_data_directories(directories=[
        pefile.DIRECTORY_ENTRY["IMAGE_DIRECTORY_ENTRY_IMPORT"],
        pefile.DIRECTORY_ENTRY["IMAGE_DIRECTORY_ENTRY_DELAY_IMPORT"],
    ])
    found = []
    for attr in ("DIRECTORY_ENTRY_IMPORT", "DIRECTORY_ENTRY_DELAY_IMPORT"):
        for entry in getattr(pe, attr, []):
            dll = entry.dll.decode(errors="replace")
            if dll.lower() in FORBIDDEN:
                names = [i.name.decode(errors="replace") if i.name else str(i.ordinal) for i in entry.imports]
                found.append(f"{dll}: {', '.join(names)}")
    return found


def main(paths):
    failed = False
    for path in paths:
        found = bad_imports(path)
        if found:
            failed = True
            print(f"FAIL {path} imports from a forbidden DLL: {'; '.join(found)}")
        else:
            print(f"OK   {path}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
