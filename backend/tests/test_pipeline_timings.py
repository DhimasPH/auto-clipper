"""The pipeline reports per-stage timings without changing what it does."""
import json
import subprocess
from unittest.mock import MagicMock, patch

from backend import jobs
from backend.stage_timer import collect_timings, stage


def _fake_proc(returncode):
    p = MagicMock()
    p.communicate.return_value = (b"", b"")
    p.returncode = returncode
    p.poll.return_value = returncode
    return p


def _stages(timings):
    return [t["stage"] for t in timings]


# --- stages emitted by the building blocks ---------------------------------

@patch("backend.video_utils.yt_dlp.YoutubeDL")
def test_download_records_a_download_stage(mock_ytdl, tmp_path):
    from backend.video_utils import download_youtube_video
    mock_ytdl.return_value.__enter__.return_value = MagicMock()

    timings = []
    with collect_timings(timings):
        download_youtube_video("https://youtu.be/x", str(tmp_path / "v.mp4"))

    assert _stages(timings) == ["download"]


@patch("backend.video_utils.subprocess.Popen")
def test_extract_audio_records_a_stage(mock_popen, tmp_path):
    from backend.video_utils import extract_audio
    mock_popen.return_value = _fake_proc(0)

    timings = []
    with collect_timings(timings):
        extract_audio("in.mp4", str(tmp_path / "a.mp3"))

    assert _stages(timings) == ["extract_audio"]


def _whisper_model(device):
    seg = MagicMock(start=0.0, end=1.0, text="hi", words=[])
    model = MagicMock()
    model.transcribe.return_value = ([seg], MagicMock())
    model.model.device = device
    return model


def test_transcription_records_the_device_actually_used():
    from backend.ai_utils import transcribe_with_faster_whisper

    timings = []
    with patch("faster_whisper.WhisperModel", return_value=_whisper_model("cuda")):
        with collect_timings(timings):
            transcribe_with_faster_whisper("dummy.mp3", model_size="medium")

    assert _stages(timings) == ["transcribe"]
    assert timings[0]["whisper_device"] == "cuda"
    assert timings[0]["whisper_model"] == "medium"


def test_transcription_records_cpu_after_gpu_fallback():
    from backend.ai_utils import transcribe_with_faster_whisper

    def factory(name, device="auto", compute_type="default"):
        if device == "auto":
            raise RuntimeError("Library cublas64_12.dll is not found or cannot be loaded")
        return _whisper_model("cpu")

    timings = []
    with patch("faster_whisper.WhisperModel", side_effect=factory):
        with collect_timings(timings):
            transcribe_with_faster_whisper("dummy.mp3")

    assert timings[0]["whisper_device"] == "cpu"


def test_transcription_device_is_always_json_safe():
    """A mocked or odd backend must not put a non-string into job metadata."""
    from backend.ai_utils import transcribe_with_faster_whisper

    model = _whisper_model("cuda")
    model.model.device = MagicMock()

    timings = []
    with patch("faster_whisper.WhisperModel", return_value=model):
        with collect_timings(timings):
            transcribe_with_faster_whisper("dummy.mp3")

    json.dumps(timings)
    assert timings[0]["whisper_device"] == "unknown"


@patch("backend.ai_utils.OpenAI")
def test_get_highlights_records_an_ai_analysis_stage(mock_openai):
    from backend.ai_utils import get_highlights
    resp = MagicMock()
    resp.choices[0].message.content = '[{"start_time": "00:00:01", "end_time": "00:00:20", "description": "x"}]'
    mock_openai.return_value.chat.completions.create.return_value = resp

    timings = []
    with collect_timings(timings):
        get_highlights("1\n00:00:00,000 --> 00:00:05,000\nhi\n", "key")

    assert _stages(timings) == ["ai_analysis"]


@patch("backend.crop_utils.subprocess.Popen")
@patch("backend.crop_utils.sample_face_trajectory", return_value=[(0.0, 0.5, 0.16)])
def test_crop_records_tracking_and_render_with_cpu_encoder(mock_traj, mock_popen):
    from backend.crop_utils import crop_to_vertical
    mock_popen.return_value = _fake_proc(0)

    timings = []
    with patch("backend.crop_utils.is_nvenc_available", return_value=False):
        with collect_timings(timings):
            crop_to_vertical("in.mp4", "out.mp4", "00:00:00", "00:00:10")

    assert _stages(timings) == ["tracking", "render"]
    assert timings[1]["encoder"] == "libx264"


@patch("backend.crop_utils.subprocess.Popen")
@patch("backend.crop_utils.sample_face_trajectory", return_value=[(0.0, 0.5, 0.16)])
def test_crop_records_gpu_encoder_when_it_worked(mock_traj, mock_popen):
    from backend.crop_utils import crop_to_vertical
    mock_popen.return_value = _fake_proc(0)

    timings = []
    with patch("backend.crop_utils.is_nvenc_available", return_value=True):
        with collect_timings(timings):
            crop_to_vertical("in.mp4", "out.mp4", "00:00:00", "00:00:10")

    assert timings[-1]["encoder"] == "h264_nvenc"


@patch("backend.crop_utils.subprocess.Popen")
@patch("backend.crop_utils.sample_face_trajectory", return_value=[(0.0, 0.5, 0.16)])
def test_crop_records_cpu_encoder_after_gpu_encoder_failed(mock_traj, mock_popen):
    from backend.crop_utils import crop_to_vertical
    mock_popen.side_effect = [_fake_proc(1), _fake_proc(0)]

    timings = []
    with patch("backend.crop_utils.is_nvenc_available", return_value=True):
        with collect_timings(timings):
            res = crop_to_vertical("in.mp4", "out.mp4", "00:00:00", "00:00:10")

    assert res == "out.mp4"
    assert timings[-1]["encoder"] == "libx264"


def test_crop_skips_the_tracking_stage_when_no_tracking_runs():
    from backend.crop_utils import crop_to_vertical

    timings = []
    with patch("backend.crop_utils.subprocess.Popen", return_value=_fake_proc(0)), \
         patch("backend.crop_utils.is_nvenc_available", return_value=False):
        with collect_timings(timings):
            crop_to_vertical("in.mp4", "out.mp4", "00:00:00", "00:00:10", tracking_mode="center")

    assert _stages(timings) == ["render"]


# --- the job run collects them into metadata["timings"] --------------------

def _ai_job(job_id, src):
    return {
        "id": job_id, "url": f"local:{src}", "provider": "openai", "api_key": "k",
        "mode": "ai", "aspect_ratio": "9:16", "title": f"Timing {job_id}",
        "caption_style": "standard", "burn_subs": False, "output_dir": "", "quality": "best",
        "status": "PENDING", "progress": "", "cancelled": False, "clips": [], "failed": 0,
        "error": None,
    }


def test_run_job_stores_timings_in_saved_metadata(tmp_path, monkeypatch):
    src = tmp_path / "source.mp4"
    src.write_bytes(b"x")
    job_id = "test-timings-run"
    job = _ai_job(job_id, src)
    job["output_dir"] = str(tmp_path)
    jobs.active_jobs[job_id] = job

    seg = {"start_time": "00:00:01", "end_time": "00:00:11", "description": "s"}
    monkeypatch.setattr(jobs, "process_with_openai", lambda *a, **k: {"highlights": [dict(seg), dict(seg)], "subtitle_path": None})

    def fake_crop(*a, **k):
        with stage("render") as rec:
            rec["encoder"] = "libx264"
        return "clip.mp4"

    monkeypatch.setattr(jobs, "crop_to_vertical", fake_crop)
    saved = []
    monkeypatch.setattr("backend.db.save_history", lambda job_id, url, status, clips, meta: saved.append((status, json.dumps(meta))))

    try:
        jobs._run_job(job_id)
        assert job["status"] == "DONE"
        final_status, final_meta = saved[-1]
        timings = json.loads(final_meta)["timings"]
        assert final_status == "DONE"
        assert "download" in _stages(timings)
        renders = [t for t in timings if t["stage"] == "render"]
        assert [t["clip"] for t in renders] == [1, 2]
        assert json.loads(final_meta)["encoder"] == "libx264"
    finally:
        jobs.active_jobs.pop(job_id, None)


def test_timings_of_one_run_do_not_carry_into_a_rerender(tmp_path, monkeypatch):
    src = tmp_path / "source.mp4"
    src.write_bytes(b"x")
    job_id = "test-timings-rerender"
    old_entry = {"stage": "download", "seconds": 99.0, "rss_mb_peak": 1.0, "ok": True}
    metadata = {
        "source_video": str(src), "subtitle_path": None, "title": "Rerender timing",
        "highlights": [{"start_time": "00:00:01", "end_time": "00:00:11", "description": "s"}],
        "timings": [old_entry],
    }
    jobs.active_jobs[job_id] = {
        "id": job_id, "url": "local:x", "mode": "rerender", "aspect_ratio": "9:16",
        "burn_subs": False, "output_dir": str(tmp_path), "title": "Rerender timing",
        "status": "PENDING", "progress": "", "cancelled": False, "clips": [], "failed": 0,
        "error": None, "metadata": metadata, "original_clips": [],
    }
    monkeypatch.setattr(jobs, "crop_to_vertical", lambda *a, **k: "clip.mp4")
    monkeypatch.setattr("backend.db.save_history", lambda *a, **k: None)
    monkeypatch.setattr("backend.video_utils.get_video_duration", lambda p: 60.0)

    try:
        jobs._run_rerender_job(job_id)
        assert jobs.active_jobs[job_id]["status"] == "DONE"
        assert old_entry not in metadata["timings"]
    finally:
        jobs.active_jobs.pop(job_id, None)


def test_manual_resume_keeps_timings_of_the_first_phase(tmp_path, monkeypatch):
    src = tmp_path / "source.mp4"
    src.write_bytes(b"x")
    first_phase = {"stage": "transcribe", "seconds": 12.0, "rss_mb_peak": 800.0, "ok": True, "whisper_device": "cpu"}
    history = {
        "id": "test-timings-manual", "url": f"local:{src}", "status": "AWAITING_MANUAL", "result_clips": [],
        "metadata": {
            "source_video": str(src), "subtitle_path": str(src), "title": "Manual timing",
            "aspect_ratio": "9:16", "burn_subs": False, "output_dir": str(tmp_path),
            "timings": [first_phase],
        },
    }
    monkeypatch.setattr("backend.db.get_history", lambda j: history)
    saved = []
    monkeypatch.setattr("backend.db.save_history", lambda job_id, url, status, clips, meta: saved.append((status, json.dumps(meta))))
    monkeypatch.setattr("threading.Thread.start", lambda self: None)

    def fake_crop(*a, **k):
        with stage("render"):
            pass
        return "clip.mp4"

    monkeypatch.setattr(jobs, "crop_to_vertical", fake_crop)

    payload = '[{"start_time": "00:00:00", "end_time": "00:00:04", "description": "x"}]'
    job_id = jobs.resume_manual_job("test-timings-manual", payload)
    try:
        from backend.ai_utils import _parse_highlights
        jobs._run_manual_resume_job(job_id, _parse_highlights(payload))
        final_status, final_meta = saved[-1]
        assert final_status == "DONE"
        timings = json.loads(final_meta)["timings"]
        assert _stages(timings) == ["transcribe", "render"]
        assert json.loads(final_meta)["whisper_device"] == "cpu"
    finally:
        jobs.active_jobs.pop(job_id, None)


def test_hook_concat_is_timed(tmp_path, monkeypatch):
    src = tmp_path / "source.mp4"
    src.write_bytes(b"x")
    job_id = "test-timings-hook"
    seg = {"start_time": "00:00:10", "end_time": "00:00:30", "hook_start": "00:00:15", "hook_end": "00:00:18", "description": "s"}
    metadata = {"highlights": [seg], "title": "Hook timing"}
    job = _ai_job(job_id, src)
    job.update({"enable_hook": True, "output_dir": str(tmp_path), "metadata": metadata})
    jobs.active_jobs[job_id] = job

    monkeypatch.setattr(jobs, "crop_to_vertical", lambda *a, **k: "part.mp4")
    monkeypatch.setattr("backend.db.save_history", lambda *a, **k: None)
    monkeypatch.setattr(subprocess, "run", lambda *a, **k: MagicMock(returncode=0))

    timings = []
    try:
        with collect_timings(timings):
            jobs._render_video_clips(job, job_id, metadata, str(src), None, lambda: False, 0)
        assert job["status"] == "DONE"
        concat = [t for t in timings if t["stage"] == "hook_concat"]
        assert len(concat) == 1
        assert concat[0]["clip"] == 1
    finally:
        jobs.active_jobs.pop(job_id, None)


def test_sync_stage_metadata_records_fallback_live_and_clears_stale_fallback_across_rerenders():
    metadata = {"title": "Rerender", "whisper_device": "cuda"}
    fallback_job = {
        "timings": [{
            "stage": "tracking",
            "tracking_engine_requested": "mediapipe",
            "tracking_engine_used": "haar",
            "tracking_fallback_reason": "addon_not_installed",
        }, {
            "stage": "render",
            "encoder": "h264_nvenc",
        }],
    }
    jobs._sync_stage_metadata(fallback_job, metadata)
    assert metadata["tracking_engine_requested"] == "mediapipe"
    assert metadata["tracking_engine_used"] == "haar"
    assert metadata["tracking_fallback_reason"] == "addon_not_installed"
    assert metadata["encoder"] == "h264_nvenc"
    assert metadata["whisper_device"] == "cuda"

    # Re-rendering after installing MediaPipe clears the previous fallback reason.
    clean_job = {
        "timings": [{
            "stage": "tracking",
            "tracking_engine_requested": "mediapipe",
            "tracking_engine_used": "mediapipe",
        }],
    }
    jobs._sync_stage_metadata(clean_job, metadata)
    assert metadata["tracking_engine_used"] == "mediapipe"
    assert "tracking_fallback_reason" not in metadata

    # Re-rendering with center/no tracking clears previous tracking fields completely.
    no_tracking_job = {"timings": [{"stage": "render", "encoder": "libx264"}]}
    jobs._sync_stage_metadata(no_tracking_job, metadata)
    assert "tracking_engine_requested" not in metadata
    assert "tracking_engine_used" not in metadata
    assert "tracking_fallback_reason" not in metadata
    assert metadata["encoder"] == "libx264"
    assert metadata["whisper_device"] == "cuda"


def test_create_resume_and_rerender_jobs_start_with_empty_timings_and_clear_stale_tracking(tmp_path, monkeypatch):
    src = tmp_path / "source.mp4"
    src.write_bytes(b"x")
    old_meta = {
        "source_video": str(src),
        "title": "Old Project",
        "provider": "manual_ai",
        "timings": [{"stage": "tracking", "tracking_engine_requested": "mediapipe", "tracking_engine_used": "haar", "tracking_fallback_reason": "addon_not_installed"}],
        "tracking_engine_requested": "mediapipe",
        "tracking_engine_used": "haar",
        "tracking_fallback_reason": "addon_not_installed",
    }
    hist_row = {"id": "hist-1", "url": f"local:{src}", "status": "ERROR", "result_clips": [], "metadata": old_meta}
    saved = []
    save_mock = lambda jid, url, status, clips, meta: saved.append((jid, status, dict(meta or {})))
    monkeypatch.setattr("backend.db.get_history", lambda jid: hist_row)
    monkeypatch.setattr("backend.db.save_history", save_mock)
    monkeypatch.setattr(jobs, "save_history", save_mock)
    monkeypatch.setattr(jobs, "_reject_if_still_processing", lambda jid: None)
    monkeypatch.setattr(jobs, "_start_job", lambda *a, **k: None)

    resumed_id = jobs.create_resume_job("hist-1")
    rerender_id = jobs.create_rerender_job("hist-1", "9:16", True, "")
    try:
        for jid in (resumed_id, rerender_id):
            meta = jobs.active_jobs[jid]["metadata"]
            assert meta["timings"] == []
            for key in ("tracking_engine_requested", "tracking_engine_used", "tracking_fallback_reason"):
                assert key not in meta
        assert saved[-2][2]["timings"] == []
        assert saved[-1][2]["timings"] == []
    finally:
        jobs.active_jobs.pop(resumed_id, None)
        jobs.active_jobs.pop(rerender_id, None)


def test_resume_manual_starts_with_no_timings_and_keeps_the_earlier_prepare_rows(monkeypatch):
    import json as _json
    from backend import jobs

    old = [
        {"stage": "download", "seconds": 2.0},
        {"stage": "transcribe", "seconds": 9.0, "whisper_device": "cpu"},
        {"stage": "tracking", "seconds": 1.0, "tracking_engine_used": "haar"},
    ]
    hist = {"url": "https://youtu.be/abc", "status": "AWAITING_MANUAL", "result_clips": [],
            "metadata": {"title": "Talk", "source_video": "/v.mp4", "subtitle_path": "/s.json", "timings": old}}
    monkeypatch.setattr("backend.db.get_history", lambda job_id: _json.loads(_json.dumps(hist)))
    monkeypatch.setattr("backend.db.save_history", lambda *a, **k: None)
    monkeypatch.setattr(jobs, "_start_job", lambda *a, **k: None)
    monkeypatch.setattr(jobs, "_publish", lambda *a, **k: [])

    jobs.resume_manual_job("hist-1", '[{"start_time": "00:00:00", "end_time": "00:00:04", "description": "x"}]')
    job = jobs.active_jobs["hist-1"]

    assert job["timings"] == []
    assert job["earlier_timings"] == old[:2]

    job["timings"].append({"stage": "render", "seconds": 3.0})
    meta = {}
    jobs._finalize_job("hist-1", "DONE", meta)

    assert [row["stage"] for row in meta["timings"]] == ["download", "transcribe", "render"]
