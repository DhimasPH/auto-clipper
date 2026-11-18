import importlib.util
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[2] / "scripts" / "colab_preflight.py"


def _load():
    spec = importlib.util.spec_from_file_location("colab_preflight", SCRIPT)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _check(check_id, level, title, message):
    return {"id": check_id, "level": level, "title": title, "message": message,
            "title_en": "english title", "message_en": "english message"}


OK = _check("ffmpeg", "ok", "Pengolah video siap", "Aplikasi menemukan FFmpeg.")
WARN = _check("gpu", "warn", "GPU tidak aktif", "Pembuatan subtitle berjalan jauh lebih lambat.")
BLOCK = _check("disk", "block", "Ruang penyimpanan penuh", "Ruang kosong tinggal 0,4 GB.")


def test_report_shows_level_title_and_message_of_every_check_in_indonesian():
    lines = _load().format_report([OK, WARN, BLOCK]).splitlines()

    assert "[OK] Pengolah video siap" in lines
    assert "    Aplikasi menemukan FFmpeg." in lines
    assert "[PERHATIAN] GPU tidak aktif" in lines
    assert "    Pembuatan subtitle berjalan jauh lebih lambat." in lines
    assert "[MASALAH] Ruang penyimpanan penuh" in lines
    assert "    Ruang kosong tinggal 0,4 GB." in lines
    assert not any("english" in line for line in lines)


def test_report_wraps_a_long_message_under_its_title():
    long_message = " ".join(["Kalimat panjang yang harus dilipat."] * 8)
    lines = _load().format_report([_check("ram", "warn", "Judul", long_message)]).splitlines()

    body = [line for line in lines if line.startswith("    ")]
    assert len(body) > 1
    assert all(len(line) <= 88 for line in body)
    assert " ".join(line.strip() for line in body) == long_message


def test_report_summary_says_whether_anything_needs_attention():
    module = _load()

    assert module.format_report([OK]).splitlines()[-1] == "Semua pemeriksaan aman."
    assert module.format_report([OK, WARN, WARN]).splitlines()[-1].startswith("2 hal perlu perhatian.")
    # A block stops jobs, so it wins over warnings in the summary.
    last = module.format_report([OK, WARN, BLOCK]).splitlines()[-1]
    assert last.startswith("1 masalah harus diperbaiki dulu.")
    assert "proses video tidak akan dimulai" in last


def test_report_treats_an_unknown_level_as_needing_attention():
    report = _load().format_report([_check("new", "critical", "Judul baru", "Pesan baru.")])
    assert "[PERHATIAN] Judul baru" in report
    assert report.splitlines()[-1].startswith("1 hal perlu perhatian.")


def test_unmounted_drive_is_a_problem_and_running_the_checks_creates_nothing_on_it(monkeypatch, tmp_path):
    from backend import drive_mount

    drive = tmp_path / "drive"
    monkeypatch.setattr(drive_mount, "DRIVE_ROOT", str(drive))
    monkeypatch.setenv("AUTO_CLIPPER_CLOUD_MODE", "1")
    monkeypatch.setenv("AUTO_CLIPPER_WORKSPACE", str(drive / "MyDrive" / "AutoClipperData"))
    monkeypatch.setenv("AUTO_CLIPPER_WORK_DIR", str(tmp_path / "work"))

    checks = {c["id"]: c for c in _load().collect_checks()}

    assert checks["drive"]["level"] == "block"
    assert checks["drive"]["code"] == "DRIVE_NOT_MOUNTED"
    assert not drive.exists()
    report = _load().format_report(list(checks.values()))
    assert "[MASALAH] Google Drive belum terhubung" in report


def test_main_prints_the_report_and_exits_zero(monkeypatch, capsys):
    from backend import preflight

    module = _load()
    monkeypatch.setattr(preflight, "run_preflight", lambda: [OK, WARN])

    assert module.main() == 0
    out = capsys.readouterr().out
    assert "PEMERIKSAAN AWAL AUTO CLIPPER" in out
    assert "[PERHATIAN] GPU tidak aktif" in out


def test_main_never_stops_the_server_cell_when_the_checks_cannot_run(monkeypatch, capsys):
    module = _load()

    def broken():
        raise ImportError("No module named yt_dlp")

    monkeypatch.setattr(module, "collect_checks", broken)

    assert module.main() == 0
    out = capsys.readouterr().out
    assert "Pemeriksaan awal tidak bisa dijalankan. Server tetap dijalankan." in out
    assert "ImportError: No module named yt_dlp" in out
