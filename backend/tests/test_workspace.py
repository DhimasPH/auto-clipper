"""Local work dir (AUTO_CLIPPER_WORK_DIR) and publishing results to the library.

Two temp folders stand in for the fast local disk and for Google Drive. No
real FFmpeg, network or Drive: the pipeline's building blocks are replaced by
fakes that only write small files where the real ones would.
"""
import asyncio
import json
import os
import shutil

import pytest

import backend.db as db
from backend import jobs, preflight, workspace
from backend.stage_timer import collect_timings

TITLE = "Podcast Ep 1"


@pytest.fixture
def dirs(tmp_path, monkeypatch):
    work = tmp_path / "work"
    library = tmp_path / "library"
    monkeypatch.setenv("AUTO_CLIPPER_WORK_DIR", str(work))
    monkeypatch.setenv("AUTO_CLIPPER_WORKSPACE", str(library))
    return work, library


def _inside(path, root) -> bool:
    path = os.path.normcase(os.path.abspath(str(path)))
    root = os.path.normcase(os.path.abspath(str(root)))
    return path.startswith(root + os.sep)


def _files(root) -> list:
    """Every file under ``root`` as a sorted list of forward-slash relative paths."""
    found = []
    for folder, _, names in os.walk(str(root)):
        for name in names:
            found.append(os.path.relpath(os.path.join(folder, name), str(root)).replace(os.sep, "/"))
    return sorted(found)


def _stages(timings) -> list:
    return [t["stage"] for t in timings]


# --- choosing the work dir ----------------------------------------------------

def test_work_dir_is_off_unless_the_variable_is_set(monkeypatch):
    monkeypatch.delenv("AUTO_CLIPPER_WORK_DIR", raising=False)
    assert workspace.get_work_dir() is None
    monkeypatch.setenv("AUTO_CLIPPER_WORK_DIR", "   ")
    assert workspace.get_work_dir() is None


def test_work_dir_comes_from_the_variable_and_is_created(tmp_path, monkeypatch):
    target = tmp_path / "fast" / "work"
    monkeypatch.setenv("AUTO_CLIPPER_WORK_DIR", f"  {target}  ")
    assert workspace.get_work_dir() == str(target)
    assert target.is_dir()


def test_without_work_dir_the_project_lives_in_the_library(tmp_path, monkeypatch):
    monkeypatch.delenv("AUTO_CLIPPER_WORK_DIR", raising=False)
    monkeypatch.setenv("AUTO_CLIPPER_WORKSPACE", str(tmp_path / "library"))

    ws = jobs.get_project_workspace(TITLE)
    project = str(tmp_path / "library" / "projects" / TITLE)
    assert ws["project_dir"] == project
    assert ws["library_dir"] == project
    assert ws["source_dir"] == os.path.join(project, "source")
    assert ws["clips_dir"] == os.path.join(project, "clips")
    assert not workspace.is_split(ws)

    chosen = jobs.get_project_workspace(TITLE, output_dir=str(tmp_path / "out"))
    assert chosen["project_dir"] == str(tmp_path / "out" / TITLE)
    assert chosen["library_dir"] == chosen["project_dir"]


def test_with_work_dir_every_working_folder_is_on_the_work_disk(dirs):
    work, library = dirs
    ws = jobs.get_project_workspace(TITLE)

    for key in ("project_dir", "source_dir", "subtitles_dir", "clips_dir", "broll_dir"):
        assert _inside(ws[key], work), key
        assert os.path.isdir(ws[key]), key
    assert ws["library_dir"] == str(library / "projects" / TITLE)
    assert workspace.is_split(ws)


def test_with_work_dir_the_chosen_output_folder_is_the_library(dirs, tmp_path):
    work, _ = dirs
    out = tmp_path / "MyDrive" / "Clips"
    ws = jobs.get_project_workspace(TITLE, output_dir=str(out))

    assert _inside(ws["clips_dir"], work)
    assert ws["library_dir"] == str(out / TITLE)


def test_work_dir_equal_to_the_library_needs_no_publish(tmp_path, monkeypatch):
    monkeypatch.setenv("AUTO_CLIPPER_WORK_DIR", str(tmp_path))
    monkeypatch.setenv("AUTO_CLIPPER_WORKSPACE", str(tmp_path))
    assert not workspace.is_split(jobs.get_project_workspace(TITLE))


# --- atomic copy ----------------------------------------------------------------

def test_copy_atomic_writes_under_another_name_then_renames(tmp_path, monkeypatch):
    src = tmp_path / "clip.mp4"
    src.write_bytes(b"clip")
    dst = tmp_path / "library" / "clips" / "clip.mp4"
    seen = {}
    real_copy = shutil.copyfile

    def spy(source, target, *a, **k):
        seen["target"] = str(target)
        seen["final_name_visible"] = dst.exists()
        return real_copy(source, target, *a, **k)

    monkeypatch.setattr(workspace.shutil, "copyfile", spy)
    workspace.copy_atomic(str(src), str(dst))

    assert seen["target"] != str(dst)
    assert os.path.dirname(seen["target"]) == str(dst.parent)  # same folder, so the rename is atomic
    assert not seen["target"].lower().endswith(".mp4")  # never mistaken for a finished clip
    assert seen["final_name_visible"] is False
    assert dst.read_bytes() == b"clip"
    assert os.listdir(dst.parent) == ["clip.mp4"]


def test_copy_atomic_failure_leaves_no_partial_file_and_keeps_the_old_one(tmp_path, monkeypatch):
    src = tmp_path / "clip.mp4"
    src.write_bytes(b"new clip")
    dst = tmp_path / "library" / "clip.mp4"
    dst.parent.mkdir()
    dst.write_bytes(b"old clip")

    def broken(source, target, *a, **k):
        with open(target, "wb") as f:
            f.write(b"new")  # half of the file, then the disk goes away
        raise OSError(5, "Input/output error")

    monkeypatch.setattr(workspace.shutil, "copyfile", broken)
    with pytest.raises(OSError):
        workspace.copy_atomic(str(src), str(dst))

    assert dst.read_bytes() == b"old clip"
    assert os.listdir(dst.parent) == ["clip.mp4"]


# --- publish ---------------------------------------------------------------------

def _finished_project(title=TITLE):
    """A project as it looks on the work disk right after rendering."""
    ws = jobs.get_project_workspace(title)

    def write(folder, name, data=b"x"):
        path = os.path.join(ws[folder], name)
        with open(path, "wb") as f:
            f.write(data)
        return path

    source = write("source_dir", "source_video.mp4", b"source")
    write("source_dir", "source_audio.mp3", b"audio")
    words = write("subtitles_dir", "subtitles.words.json", b'{"words": []}')
    clip = write("clips_dir", "clip_1.mp4", b"clip one")
    write("clips_dir", "clip_1.ass", b"ass")
    clips = [{"path": clip, "description": "one"}]
    metadata = {"title": title, "source_video": source, "subtitle_path": words, "api_key": "sk-secret", "pexels_api_key": "px-secret"}
    return ws, clips, metadata


def test_publish_copies_clips_and_subtitles_and_points_history_at_the_copies(dirs):
    work, library = dirs
    ws, clips, metadata = _finished_project()

    failures = workspace.publish(ws, clips, metadata)

    assert failures == []
    project = library / "projects" / TITLE
    assert clips[0]["path"] == str(project / "clips" / "clip_1.mp4")
    assert metadata["subtitle_path"] == str(project / "subtitles" / "subtitles.words.json")
    assert (project / "clips" / "clip_1.mp4").read_bytes() == b"clip one"
    assert (project / "subtitles" / "subtitles.words.json").read_bytes() == b'{"words": []}'


def test_publish_leaves_the_source_video_and_other_working_files_on_the_work_disk(dirs):
    work, library = dirs
    ws, clips, metadata = _finished_project()
    source = metadata["source_video"]

    workspace.publish(ws, clips, metadata)

    assert metadata["source_video"] == source
    assert _inside(source, work) and os.path.exists(source)
    assert _files(library / "projects" / TITLE) == ["clips/clip_1.mp4", "subtitles/subtitles.words.json"]


def test_publish_copies_a_clip_s_edited_subtitle(dirs):
    _, library = dirs
    ws, clips, metadata = _finished_project()
    custom = os.path.join(ws["subtitles_dir"], "clip_0_custom.words.json")
    with open(custom, "w", encoding="utf-8") as f:
        json.dump({"words": [{"word": "Halo", "start": 0.0, "end": 1.0}]}, f)
    clips[0]["custom_subtitle_path"] = custom

    workspace.publish(ws, clips, metadata)

    published = clips[0]["custom_subtitle_path"]
    assert _inside(published, library)
    with open(published, "r", encoding="utf-8") as f:
        assert json.load(f)["words"][0]["word"] == "Halo"


def test_publish_records_a_publish_stage(dirs):
    ws, clips, metadata = _finished_project()
    timings = []
    with collect_timings(timings):
        workspace.publish(ws, clips, metadata)

    assert _stages(timings) == ["publish"]
    assert timings[0]["files"] == 2
    assert timings[0]["ok"] is True


def test_publish_does_nothing_without_a_work_dir(tmp_path, monkeypatch):
    monkeypatch.delenv("AUTO_CLIPPER_WORK_DIR", raising=False)
    monkeypatch.setenv("AUTO_CLIPPER_WORKSPACE", str(tmp_path / "library"))
    ws, clips, metadata = _finished_project()
    before = (clips[0]["path"], metadata["subtitle_path"], _files(tmp_path))

    timings = []
    with collect_timings(timings):
        failures = workspace.publish(ws, clips, metadata, final=True, job_id="j", url="u")

    assert failures == []
    assert timings == []
    assert (clips[0]["path"], metadata["subtitle_path"], _files(tmp_path)) == before


def test_second_publish_copies_only_what_is_new(dirs, monkeypatch):
    ws, clips, metadata = _finished_project()
    workspace.publish(ws, clips, metadata)

    copied = []
    real_copy = workspace.copy_atomic
    monkeypatch.setattr(workspace, "copy_atomic", lambda s, d: (copied.append(s), real_copy(s, d))[1])
    second = os.path.join(ws["clips_dir"], "clip_2.mp4")
    with open(second, "wb") as f:
        f.write(b"clip two")
    clips.append({"path": second})

    timings = []
    with collect_timings(timings):
        workspace.publish(ws, clips, metadata)
        workspace.publish(ws, clips, metadata)  # nothing left to do: no copy, no stage

    assert copied == [second]
    assert _stages(timings) == ["publish"]


def test_final_publish_writes_metadata_without_api_keys(dirs):
    _, library = dirs
    ws, clips, metadata = _finished_project()

    workspace.publish(ws, clips, metadata, final=True, job_id="job-1", url="https://youtu.be/x")

    with open(library / "projects" / TITLE / "metadata.json", "r", encoding="utf-8") as f:
        text = f.read()
    saved = json.loads(text)
    assert saved["id"] == "job-1"
    assert saved["url"] == "https://youtu.be/x"
    assert saved["clips"][0]["path"] == clips[0]["path"]
    assert saved["metadata"]["title"] == TITLE
    assert "secret" not in text
    assert metadata["api_key"] == "sk-secret"  # the job's own metadata is untouched


def test_failed_copy_is_reported_logged_and_retried_next_time(dirs, monkeypatch):
    work, library = dirs
    ws, clips, metadata = _finished_project()
    logged = []
    monkeypatch.setattr(workspace, "log_error", lambda context, err=None, **k: logged.append((context, str(err))))
    real_copy = workspace.copy_atomic

    def drive_is_gone(src, dst):
        raise OSError(107, "Transport endpoint is not connected")

    monkeypatch.setattr(workspace, "copy_atomic", drive_is_gone)
    timings = []
    with collect_timings(timings):
        failures = workspace.publish(ws, clips, metadata)

    assert len(failures) == 2
    assert all(isinstance(f, OSError) for f in failures)
    assert _inside(clips[0]["path"], work)  # history keeps pointing at a file that exists
    assert _inside(metadata["subtitle_path"], work)
    assert len(logged) == 2 and "not connected" in logged[0][1]
    assert timings[0]["failed"] == 2

    monkeypatch.setattr(workspace, "copy_atomic", real_copy)
    assert workspace.publish(ws, clips, metadata) == []
    assert _inside(clips[0]["path"], library)


def test_final_publish_reports_a_clip_that_never_reached_the_library(dirs):
    work, _ = dirs
    ws, clips, metadata = _finished_project()
    clips.append({"path": os.path.join(ws["clips_dir"], "clip_2.mp4")})  # listed, but the file is gone

    failures = workspace.publish(ws, clips, metadata, final=True, job_id="j", url="u")

    assert len(failures) == 1
    assert "clip_2.mp4" in str(failures[0])


def test_final_publish_failure_writes_no_metadata_file(dirs, monkeypatch):
    _, library = dirs
    ws, clips, metadata = _finished_project()
    monkeypatch.setattr(workspace, "copy_atomic", lambda s, d: (_ for _ in ()).throw(OSError(28, "No space left on device")))

    assert workspace.publish(ws, clips, metadata, final=True, job_id="j", url="u")
    assert not (library / "projects" / TITLE / "metadata.json").exists()


# --- the pipeline, with a work dir ------------------------------------------------

def _seg(n):
    return {"start_time": f"00:00:0{n}", "end_time": f"00:00:1{n}", "description": f"seg{n}"}


def _ai_job(job_id, url, **fields):
    job = {
        "id": job_id, "url": url, "provider": "openai", "api_key": "sk-secret", "mode": "ai",
        "aspect_ratio": "9:16", "caption_style": "karaoke", "burn_subs": True, "output_dir": "",
        "quality": "best", "title": TITLE, "status": "PENDING", "progress": "", "cancelled": False,
        "clips": [], "failed": 0, "error": None,
    }
    job.update(fields)
    return job


@pytest.fixture
def pipeline(monkeypatch):
    """Replace download, AI, render and the database with recording fakes."""
    rec = {"saved": [], "crops": [], "downloads": [], "ai_calls": 0}

    def fake_save(job_id, url, status, clips, metadata=None):
        rec["saved"].append({"id": job_id, "status": status, "clips": json.loads(json.dumps(clips)),
                             "metadata": json.loads(json.dumps(metadata or {}))})

    def fake_download(url, output_path, quality="best", is_cancelled=None):
        rec["downloads"].append(output_path)
        with open(output_path, "wb") as f:
            f.write(b"downloaded source")

    def fake_ai(file_path, api_key, **k):
        rec["ai_calls"] += 1
        base, _ = os.path.splitext(file_path)
        with open(base + "_audio.mp3", "wb") as f:
            f.write(b"audio")
        words = base + ".words.json"
        with open(words, "w", encoding="utf-8") as f:
            json.dump({"words": [{"word": "Halo", "start": 0.5, "end": 1.0}], "segments": []}, f)
        return {"highlights": [_seg(0), _seg(1)], "subtitle_path": words}

    def fake_crop(in_path, out_path, start, end, **k):
        rec["crops"].append({"in": in_path, "out": out_path, "subtitle": k.get("subtitle_path")})
        with open(out_path, "wb") as f:
            f.write(f"clip {start}".encode())
        return out_path

    monkeypatch.setattr("backend.db.save_history", fake_save)
    monkeypatch.setattr(jobs, "save_history", fake_save)
    monkeypatch.setattr(jobs, "download_youtube_video", fake_download)
    monkeypatch.setattr(jobs, "process_with_openai", fake_ai)
    monkeypatch.setattr(jobs, "crop_to_vertical", fake_crop)
    return rec


def _run(job):
    jobs.active_jobs[job["id"]] = job
    jobs._run_job(job["id"])
    return jobs.active_jobs[job["id"]]


def test_job_works_on_the_work_disk_and_publishes_results_to_the_library(dirs, pipeline, tmp_path):
    work, library = dirs
    upload = tmp_path / "upload.mp4"
    upload.write_bytes(b"uploaded source")

    job = _run(_ai_job("job-split", f"local:{upload}"))

    assert job["status"] == "DONE", job.get("error")
    # Source, audio, working subtitle and renders all stayed on the work disk.
    assert len(pipeline["crops"]) == 2
    for crop in pipeline["crops"]:
        assert _inside(crop["in"], work)
        assert _inside(crop["out"], work)
        assert _inside(crop["subtitle"], work)
    assert _inside(job["metadata"]["source_video"], work)
    # The library holds the finished clips, the word subtitles and the metadata, nothing else.
    project = library / "projects" / TITLE
    assert _files(project) == [
        f"clips/{TITLE}_clip_1.mp4", f"clips/{TITLE}_clip_2.mp4", "metadata.json", "subtitles/source_video.words.json",
    ]
    assert [c["path"] for c in job["clips"]] == [
        str(project / "clips" / f"{TITLE}_clip_1.mp4"), str(project / "clips" / f"{TITLE}_clip_2.mp4"),
    ]
    assert (project / "clips" / f"{TITLE}_clip_2.mp4").read_bytes() == b"clip 00:00:01"

    final = pipeline["saved"][-1]
    assert final["status"] == "DONE"
    assert final["metadata"]["subtitle_path"] == str(project / "subtitles" / "source_video.words.json")
    assert "publish" in _stages(final["metadata"]["timings"])
    assert "warnings" not in final["metadata"]


def test_history_never_points_at_a_clip_on_the_work_disk(dirs, pipeline):
    work, _ = dirs
    _run(_ai_job("job-split", "https://youtu.be/abc"))

    with_clips = [s for s in pipeline["saved"] if s["clips"]]
    assert with_clips
    for entry in with_clips:
        for clip in entry["clips"]:
            assert not _inside(clip["path"], work), entry["status"]


def test_published_files_survive_the_loss_of_the_work_disk(dirs, pipeline):
    work, _ = dirs
    job = _run(_ai_job("job-split", "https://youtu.be/abc"))
    shutil.rmtree(work)

    assert all(os.path.exists(c["path"]) for c in job["clips"])
    assert os.path.exists(job["metadata"]["subtitle_path"])


def test_job_without_work_dir_behaves_as_before(tmp_path, monkeypatch, pipeline):
    monkeypatch.delenv("AUTO_CLIPPER_WORK_DIR", raising=False)
    library = tmp_path / "library"
    monkeypatch.setenv("AUTO_CLIPPER_WORKSPACE", str(library))

    job = _run(_ai_job("job-plain", "https://youtu.be/abc"))

    assert job["status"] == "DONE", job.get("error")
    project = library / "projects" / TITLE
    assert [c["path"] for c in job["clips"]] == [
        os.path.normpath(str(project / "clips" / f"{TITLE}_clip_1.mp4")),
        os.path.normpath(str(project / "clips" / f"{TITLE}_clip_2.mp4")),
    ]
    assert job["metadata"]["source_video"] == str(project / "source" / "source_video.mp4")
    assert job["metadata"]["subtitle_path"] == str(project / "subtitles" / "source_video.words.json")
    assert "publish" not in _stages(job["timings"])
    assert "warnings" not in job["metadata"]
    assert not (project / "metadata.json").exists()


def _interrupted_after_first_clip(pipeline):
    """History as the database holds it when the process died while rendering clip 2."""
    entry = next(s for s in pipeline["saved"] if s["status"] == "CROPPING" and len(s["clips"]) == 1)
    return entry["clips"], entry["metadata"]


def _resume(job_id, clips, metadata, url="https://youtu.be/abc"):
    jobs.active_jobs[job_id] = _ai_job(job_id, url, clips=clips, metadata=metadata, status="QUEUED")
    jobs._run_resume_job(job_id)
    return jobs.active_jobs[job_id]


def test_resume_after_the_work_disk_is_lost_downloads_again_and_reuses_the_rest(dirs, pipeline, monkeypatch):
    work, library = dirs
    _run(_ai_job("job-first", "https://youtu.be/abc"))
    clips, metadata = _interrupted_after_first_clip(pipeline)
    shutil.rmtree(work)  # a new Colab session
    for key in ("downloads", "crops"):
        pipeline[key].clear()
    pipeline["ai_calls"] = 0

    job = _resume("job-resumed", clips, metadata)

    assert job["status"] == "DONE", job.get("error")
    assert len(pipeline["downloads"]) == 1 and _inside(pipeline["downloads"][0], work)
    assert pipeline["ai_calls"] == 0  # transcript and highlights are reused
    assert len(pipeline["crops"]) == 1  # clip 1 is already in the library
    assert _inside(pipeline["crops"][0]["subtitle"], library)
    assert len(job["clips"]) == 2
    assert all(_inside(c["path"], library) and os.path.exists(c["path"]) for c in job["clips"])


def test_resume_does_not_download_again_while_the_work_disk_is_intact(dirs, pipeline):
    _run(_ai_job("job-first", "https://youtu.be/abc"))
    clips, metadata = _interrupted_after_first_clip(pipeline)
    pipeline["downloads"].clear()
    pipeline["ai_calls"] = 0

    job = _resume("job-resumed", clips, metadata)

    assert job["status"] == "DONE", job.get("error")
    assert pipeline["downloads"] == []
    assert pipeline["ai_calls"] == 0


def test_unmounted_drive_still_finishes_the_job_and_warns_in_both_languages(dirs, pipeline, monkeypatch):
    _, library = dirs
    monkeypatch.setattr(preflight, "_cloud_drive_expected", lambda: True)
    monkeypatch.setattr(preflight, "_drive_mounted", lambda: False)

    job = _run(_ai_job("job-nodrive", "https://youtu.be/abc"))

    assert job["status"] == "DONE", job.get("error")
    assert all(_inside(c["path"], library) and os.path.exists(c["path"]) for c in job["clips"])
    warnings = pipeline["saved"][-1]["metadata"]["warnings"]
    assert [w["code"] for w in warnings] == ["DRIVE_NOT_MOUNTED"]
    assert "Google Drive" in warnings[0]["message"] and "Google Drive" in warnings[0]["message_en"]
    assert job["warnings"] == warnings


def test_job_whose_clips_cannot_be_published_ends_as_an_error_not_as_done(dirs, pipeline, monkeypatch):
    work, _ = dirs
    logged = []
    monkeypatch.setattr(workspace, "log_error", lambda context, err=None, **k: logged.append(context))
    monkeypatch.setattr(workspace, "copy_atomic", lambda s, d: (_ for _ in ()).throw(OSError(107, "Transport endpoint is not connected")))

    job = _run(_ai_job("job-nopublish", "https://youtu.be/abc"))

    assert job["status"] == "ERROR"
    assert pipeline["saved"][-1]["status"] == "ERROR"
    info = job["error_info"]
    assert info["code"] == "PUBLISH_FAILED"
    assert info["message"] and info["message_en"]
    assert "resume" in [a["id"] for a in info["actions"]]
    assert "not connected" in info["technical"]
    assert logged  # the failure is in the error log
    assert len(job["clips"]) == 2 and all(_inside(c["path"], work) for c in job["clips"])


def test_resume_after_a_failed_publish_only_copies(dirs, pipeline, monkeypatch):
    _, library = dirs
    real_copy = workspace.copy_atomic
    monkeypatch.setattr(workspace, "log_error", lambda *a, **k: None)
    monkeypatch.setattr(workspace, "copy_atomic", lambda s, d: (_ for _ in ()).throw(OSError(107, "Transport endpoint is not connected")))
    _run(_ai_job("job-first", "https://youtu.be/abc"))
    failed = pipeline["saved"][-1]
    monkeypatch.setattr(workspace, "copy_atomic", real_copy)
    for key in ("downloads", "crops"):
        pipeline[key].clear()

    job = _resume("job-resumed", failed["clips"], failed["metadata"])

    assert job["status"] == "DONE", job.get("error")
    assert pipeline["downloads"] == [] and pipeline["crops"] == []
    assert all(_inside(c["path"], library) and os.path.exists(c["path"]) for c in job["clips"])
    assert "error_info" not in pipeline["saved"][-1]["metadata"]


def test_out_of_space_while_publishing_is_reported_as_a_full_disk(dirs, pipeline, monkeypatch):
    monkeypatch.setattr(workspace, "log_error", lambda *a, **k: None)
    monkeypatch.setattr(workspace, "copy_atomic", lambda s, d: (_ for _ in ()).throw(OSError(28, "No space left on device")))

    job = _run(_ai_job("job-full", "https://youtu.be/abc"))

    assert job["status"] == "ERROR"
    assert job["error_info"]["code"] == "DISK_FULL"


# --- editing and re-rendering published clips ---------------------------------------

def _published_history(pipeline, job):
    final = pipeline["saved"][-1]
    return {"id": job["id"], "url": job["url"], "status": "DONE", "result_clips": final["clips"], "metadata": final["metadata"]}


def _rerender_clip(monkeypatch, history, words):
    monkeypatch.setattr("backend.db.get_history", lambda job_id: json.loads(json.dumps(history)))
    job_id = "rerender_clip_test"
    jobs.active_jobs[job_id] = {
        "id": job_id, "type": "rerender_clip", "url": f"clip-rerender:{history['id']}", "parent_job_id": history["id"],
        "clip_index": 0, "custom_words": words, "aspect_ratio": "9:16", "caption_style": "karaoke", "burn_subs": True,
        "canvas_config": None, "subtitle_config": None, "tracking_mode": "auto", "face_tracking_engine": "haar",
        "status": "QUEUED", "progress": "", "clips": [], "cancelled": False, "failed": 0, "error": None,
    }
    jobs._run_rerender_clip_job(job_id)
    return jobs.active_jobs[job_id]


def test_clip_rerender_renders_on_the_work_disk_and_replaces_the_library_clip(dirs, pipeline, monkeypatch):
    work, library = dirs
    history = _published_history(pipeline, _run(_ai_job("job-split", "https://youtu.be/abc")))
    library_clip = history["result_clips"][0]["path"]
    with open(library_clip, "wb") as f:
        f.write(b"first render")
    pipeline["crops"].clear()
    words = [{"word": "Halo", "start": 0.5, "end": 1.0}]

    job = _rerender_clip(monkeypatch, history, words)

    assert job["status"] == "DONE", job.get("error")
    crop = pipeline["crops"][0]
    assert _inside(crop["out"], work) and _inside(crop["subtitle"], work)
    saved = pipeline["saved"][-1]
    assert saved["id"] == "job-split"
    assert saved["clips"][0]["path"] == library_clip
    with open(library_clip, "rb") as f:
        assert f.read() == b"clip 00:00:00"
    assert _files(library / "projects" / TITLE / "clips") == [f"{TITLE}_clip_1.mp4", f"{TITLE}_clip_2.mp4"]
    assert "publish" in _stages(job["timings"])


def test_edited_subtitle_is_kept_in_the_library_and_served_after_the_work_disk_is_lost(dirs, pipeline, monkeypatch):
    work, library = dirs
    history = _published_history(pipeline, _run(_ai_job("job-split", "https://youtu.be/abc")))
    words = [{"word": "Diedit", "start": 0.5, "end": 1.0}]
    _rerender_clip(monkeypatch, history, words)

    saved = pipeline["saved"][-1]
    custom = saved["clips"][0]["custom_subtitle_path"]
    assert _inside(custom, library)
    shutil.rmtree(work)

    from backend import main
    edited = {"id": "job-split", "url": "u", "status": "DONE", "result_clips": saved["clips"], "metadata": saved["metadata"]}
    monkeypatch.setattr("backend.db.get_history", lambda job_id: edited)
    assert asyncio.run(main.get_clip_words("job-split", 0))["words"] == words


def test_rerender_all_uses_the_edited_subtitle_and_publishes_the_new_clips(dirs, pipeline, monkeypatch):
    work, library = dirs
    history = _published_history(pipeline, _run(_ai_job("job-split", "https://youtu.be/abc")))
    _rerender_clip(monkeypatch, history, [{"word": "Diedit", "start": 0.5, "end": 1.0}])
    edited = pipeline["saved"][-1]
    custom = edited["clips"][0]["custom_subtitle_path"]
    pipeline["crops"].clear()

    job_id = "job-rerender-all"
    jobs.active_jobs[job_id] = {
        "id": job_id, "url": "https://youtu.be/abc", "mode": "rerender", "aspect_ratio": "1:1", "burn_subs": True,
        "output_dir": "", "title": TITLE, "max_clips": 0, "status": "PENDING", "progress": "", "cancelled": False,
        "clips": [], "failed": 0, "error": None, "metadata": edited["metadata"], "original_clips": edited["clips"],
    }
    jobs._run_rerender_job(job_id)
    job = jobs.active_jobs[job_id]

    assert job["status"] == "DONE", job.get("error")
    assert pipeline["crops"][0]["subtitle"] == custom
    assert all(_inside(c["out"], work) for c in pipeline["crops"])
    assert all(_inside(c["path"], library) and os.path.exists(c["path"]) for c in job["clips"])


# --- deleting a project ---------------------------------------------------------------

def test_deleting_a_project_removes_it_from_the_work_disk_and_the_library(dirs, monkeypatch, tmp_path):
    work, library = dirs
    monkeypatch.setattr(db, "get_db_path", lambda: str(tmp_path / "history.db"))
    db.init_db()
    ws, clips, metadata = _finished_project()
    workspace.publish(ws, clips, metadata, final=True, job_id="job-del", url="u")
    db.save_history("job-del", "u", "DONE", clips, metadata)

    db.delete_history("job-del")

    assert not os.path.exists(ws["project_dir"])
    assert not (library / "projects" / TITLE).exists()


# --- preflight ---------------------------------------------------------------------------

def test_disk_check_covers_the_work_disk_and_the_library(dirs, monkeypatch):
    work, library = dirs
    free = {str(library): 50 * 1024 ** 3, str(work): 3 * 1024 ** 3}
    monkeypatch.setattr(workspace.shutil, "disk_usage", lambda path: type("Usage", (), {"free": free[str(path)]})())

    assert workspace.storage_dirs() == [str(library), str(work)]
    assert workspace.free_disk_gb() == pytest.approx(3.0)

    free[str(library)] = 1 * 1024 ** 3
    assert workspace.free_disk_gb() == pytest.approx(1.0)


def test_disk_check_without_work_dir_looks_at_the_library_only(tmp_path, monkeypatch):
    monkeypatch.delenv("AUTO_CLIPPER_WORK_DIR", raising=False)
    monkeypatch.setenv("AUTO_CLIPPER_WORKSPACE", str(tmp_path / "library"))
    assert workspace.storage_dirs() == [str(tmp_path / "library")]


def test_disk_check_names_both_folders_in_technical_details(dirs):
    work, library = dirs
    technical = preflight.check_disk()["technical"]
    assert str(work) in technical and str(library) in technical


def test_drive_check_follows_the_library_not_the_work_dir(monkeypatch):
    monkeypatch.setenv("AUTO_CLIPPER_CLOUD_MODE", "1")
    monkeypatch.setenv("AUTO_CLIPPER_WORK_DIR", "/content/work")
    monkeypatch.setenv("AUTO_CLIPPER_WORKSPACE", "/content/drive/MyDrive/AutoClipperData")
    assert preflight._cloud_drive_expected() is True

    monkeypatch.setattr(preflight, "_drive_mounted", lambda: False)
    result = preflight.check_drive()
    assert result["level"] == "warn" and result["code"] == "DRIVE_NOT_MOUNTED"

    # A work dir on Drive does not make Drive the library.
    monkeypatch.setenv("AUTO_CLIPPER_WORK_DIR", "/content/drive/MyDrive/tmp")
    monkeypatch.setenv("AUTO_CLIPPER_WORKSPACE", "/content/data")
    assert preflight._cloud_drive_expected() is False
