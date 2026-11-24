import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
HEAVY_MODULES = ("yt_dlp", "cv2", "numpy", "openai", "google.genai")


def test_startup_imports_do_not_eagerly_load_heavy_modules():
    code = (
        "import json, sys\n"
        "import backend.main\n"
        "from backend.preflight import run_preflight\n"
        "run_preflight()\n"
        "import backend.jobs\n"
        f"loaded = [m for m in {list(HEAVY_MODULES)!r} if m in sys.modules]\n"
        "print(json.dumps(loaded))\n"
    )
    proc = subprocess.run(
        [sys.executable, "-c", code],
        cwd=str(ROOT),
        capture_output=True,
        text=True,
        check=True,
    )
    lines = [line.strip() for line in proc.stdout.splitlines() if line.strip()]
    assert lines == ["[]"], f"Expected no heavy modules loaded at startup, got: {proc.stdout!r}"


def test_requirements_and_backend_spec_drop_mediapipe_and_keep_addon_stdlib():
    import ast

    reqs = (ROOT / "backend" / "requirements.txt").read_text(encoding="utf-8").lower()
    assert "mediapipe" not in reqs

    spec = (ROOT / "backend.spec").read_text(encoding="utf-8")
    tree = ast.parse(spec)
    collect_all_args = set()
    excludes_items = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id == "collect_all":
            if node.args and isinstance(node.args[0], ast.Constant):
                collect_all_args.add(node.args[0].value)
        if isinstance(node, ast.keyword) and node.arg == "excludes" and isinstance(node.value, ast.List):
            for el in node.value.elts:
                if isinstance(el, ast.Constant):
                    excludes_items.add(el.value)

    assert "mediapipe" not in collect_all_args
    assert "mediapipe" in excludes_items
    assert "haarcascade_frontalface_default.xml" in spec
    assert "backend.metadata" in spec
    for mod in ("'wave'", "'csv'", "'timeit'", "'getpass'", "'xml'"):
        assert mod in spec, f"{mod} missing from backend.spec hiddenimports"
