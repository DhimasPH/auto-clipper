"""Canvas background images go to the backend (SP2 spec 4.7) and job requests cannot point the
canvas image at a private app file (AGENTS.md E.14)."""
import os
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from backend import jobs, main

client = TestClient(main.app)
DENIED = {"status": "error", "message": "Access denied"}


@pytest.fixture
def library(tmp_path, monkeypatch):
    lib = tmp_path / "library"
    monkeypatch.setenv("AUTO_CLIPPER_WORKSPACE", str(lib))
    monkeypatch.delenv("AUTO_CLIPPER_WORK_DIR", raising=False)
    return lib


def _upload(name, data=b"\x89PNG data", kind="image/png"):
    return client.post("/upload-image", files={"file": (name, data, kind)})


def _images(library):
    return os.path.normcase(str(library / "temp_downloads" / "images")) + os.sep


def test_upload_image_stores_the_file_and_returns_its_backend_path(library):
    r = _upload("latar.png")

    assert r.status_code == 200
    path = r.json()["path"]
    assert os.path.normcase(os.path.abspath(path)).startswith(_images(library))
    assert path.endswith("latar.png")
    assert Path(path).read_bytes() == b"\x89PNG data"


def test_two_uploads_with_the_same_name_keep_both_files(library):
    first = _upload("latar.jpg", b"one", "image/jpeg").json()["path"]
    second = _upload("latar.jpg", b"two", "image/jpeg").json()["path"]

    assert first != second
    assert Path(first).read_bytes() == b"one"
    assert Path(second).read_bytes() == b"two"


@pytest.mark.parametrize("name", ["notes.txt", "clip.mp4", "history.db", "no-extension"])
def test_upload_image_refuses_files_that_are_not_images(library, name):
    assert _upload(name, b"x", "application/octet-stream").status_code == 400


@pytest.mark.parametrize("name", ["../../history.db.png", "..\\..\\cookies\\x.png"])
def test_upload_image_name_cannot_climb_out_of_the_images_folder(library, name):
    r = _upload(name)

    assert r.status_code == 200
    assert os.path.normcase(os.path.abspath(r.json()["path"])).startswith(_images(library))


def test_upload_image_refuses_a_protected_destination(library, monkeypatch):
    monkeypatch.setattr("backend.path_guard.is_protected", lambda path: True)

    r = _upload("latar.png")

    assert r.status_code == 403
    assert r.json() == DENIED


_JOB_REQUESTS = [
    ("/jobs", {"url": "https://youtu.be/abc", "provider": "manual_ai", "api_key": "", "title": "t"}),
    ("/jobs/manual", {"url": "https://youtu.be/abc", "clips": [], "title": "t"}),
    ("/jobs/some-id/rerender", {"provider": "openai", "api_key": ""}),
    ("/jobs/some-id/rerun_ai", {"url": "", "provider": "openai", "api_key": ""}),
    ("/jobs/some-id/rerun-manual", {}),
    ("/jobs/some-id/clips/0/rerender", {"words": [], "aspect_ratio": "9:16", "caption_style": "standard", "burn_subs": True}),
]
_CREATORS = ("create_job", "create_manual_job", "create_rerender_job", "create_rerun_ai_job", "create_rerender_clip_job", "create_rerun_manual_job")


@pytest.mark.parametrize("path, body", _JOB_REQUESTS)
def test_job_requests_refuse_a_protected_canvas_image(library, monkeypatch, path, body):
    started = []
    for name in _CREATORS:
        monkeypatch.setattr(jobs, name, lambda *a, **k: started.append(1) or "job-1")
    monkeypatch.setattr("backend.ai_utils.ping_provider", lambda *a, **k: None)
    canvas = {"enabled": True, "background_type": "image", "background_image_path": str(library / "history.db")}

    r = client.post(path, json={**body, "canvas_config": canvas})

    assert r.status_code == 403
    assert r.json() == DENIED
    assert started == []


def test_a_job_keeps_an_uploaded_canvas_image(library, monkeypatch):
    image = _upload("latar.png").json()["path"]
    seen = {}
    monkeypatch.setattr(jobs, "create_job", lambda *a, **k: seen.update(k) or "job-1")
    monkeypatch.setattr("backend.ai_utils.ping_provider", lambda *a, **k: None)
    canvas = {"enabled": True, "background_type": "image", "background_image_path": image}

    r = client.post("/jobs", json={**_JOB_REQUESTS[0][1], "canvas_config": canvas})

    assert r.status_code == 200
    assert seen["canvas_config"]["background_image_path"] == image
