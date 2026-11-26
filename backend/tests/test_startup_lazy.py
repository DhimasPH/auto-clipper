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
    hiddenimports_items = set()
    copy_metadata_args = set()

    for node in ast.walk(tree):
        if isinstance(node, ast.For) and isinstance(node.iter, ast.List):
            has_collect_all = any(
                isinstance(n, ast.Call) and isinstance(n.func, ast.Name) and n.func.id == "collect_all"
                for n in ast.walk(node)
            )
            if has_collect_all:
                for el in node.iter.elts:
                    if isinstance(el, ast.Constant) and isinstance(el.value, str):
                        collect_all_args.add(el.value)
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name):
            if node.func.id == "collect_all" and node.args and isinstance(node.args[0], ast.Constant):
                collect_all_args.add(node.args[0].value)
            elif node.func.id == "copy_metadata" and node.args and isinstance(node.args[0], ast.Constant):
                copy_metadata_args.add(node.args[0].value)
        if isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name) and target.id == "hiddenimports" and isinstance(node.value, ast.List):
                    for el in node.value.elts:
                        if isinstance(el, ast.Constant) and isinstance(el.value, str):
                            hiddenimports_items.add(el.value)
        if isinstance(node, ast.keyword) and node.arg == "excludes" and isinstance(node.value, ast.List):
            for el in node.value.elts:
                if isinstance(el, ast.Constant) and isinstance(el.value, str):
                    excludes_items.add(el.value)

    assert "mediapipe" not in collect_all_args
    assert {"faster_whisper", "ctranslate2", "onnxruntime", "av", "numpy", "certifi", "cv2"} <= collect_all_args
    assert "mediapipe" in excludes_items
    assert "yt-dlp" in copy_metadata_args
    assert "haarcascade_frontalface_default.xml" in spec
    assert {"backend.metadata", "wave", "csv", "timeit", "getpass", "xml"} <= hiddenimports_items


def test_lazy_module_defers_import_and_forwards_attr_operations(tmp_path, monkeypatch):
    from backend._lazy import LazyModule

    mod_file = tmp_path / "dummy_lazy_mod.py"
    mod_file.write_text("VALUE = 42\n", encoding="utf-8")
    monkeypatch.syspath_prepend(str(tmp_path))
    monkeypatch.delitem(sys.modules, "dummy_lazy_mod", raising=False)

    proxy = LazyModule("dummy_lazy_mod")
    assert "LazyModule" in repr(proxy)
    assert "dummy_lazy_mod" not in sys.modules

    assert proxy.VALUE == 42
    assert "dummy_lazy_mod" in sys.modules

    proxy.EXTRA = "hello"
    assert sys.modules["dummy_lazy_mod"].EXTRA == "hello"
    del proxy.EXTRA
    assert not hasattr(sys.modules["dummy_lazy_mod"], "EXTRA")


def test_lazy_attr_defers_import_and_forwards_calls_and_attributes(tmp_path, monkeypatch):
    from backend._lazy import LazyAttr

    mod_file = tmp_path / "dummy_lazy_attr_mod.py"
    mod_file.write_text(
        "class DummyClient:\n"
        "    TAG = 'ok'\n"
        "    def __init__(self, key, mode='fast'):\n"
        "        self.key = key\n"
        "        self.mode = mode\n",
        encoding="utf-8",
    )
    monkeypatch.syspath_prepend(str(tmp_path))
    monkeypatch.delitem(sys.modules, "dummy_lazy_attr_mod", raising=False)

    cls_proxy = LazyAttr("dummy_lazy_attr_mod", "DummyClient")
    assert "LazyAttr" in repr(cls_proxy)
    assert "dummy_lazy_attr_mod" not in sys.modules

    assert cls_proxy.TAG == "ok"
    assert "dummy_lazy_attr_mod" in sys.modules

    instance = cls_proxy("secret", mode="strict")
    assert (instance.key, instance.mode) == ("secret", "strict")
