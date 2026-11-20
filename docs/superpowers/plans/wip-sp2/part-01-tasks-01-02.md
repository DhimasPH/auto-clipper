### Task 1: Backend: live stage stack in `stage_timer`

Spec 4.4 (first half). `stage_timer` already sees every stage start and end; it gains an optional per-job `live` dict holding the running stages, a `report()` for live-only facts, and `current_stage()` that turns the top of the stack into the spec's `current` object. Nothing is added to `timings`.

**Files:**
- Modify: `backend/stage_timer.py` (module docstring, `collect_timings`, `stage`; new `DEVICE_FIELDS`, `report`, `current_stage`)
- Test: `backend/tests/test_stage_timer.py` (append)
- Create: `tasks/sp2-ledger.md` (only if the pre-flight scan of `tasks/HANDOFF-AI.md` section 3 has not created it)
- Modify: `tasks/PROGRESS-LOG.md` (add the `## 2026-11-20 · SP2` heading once, then the entry)

**Interfaces:**
- Consumes: nothing new.
- Produces (used by Task 2):
  - `stage_timer.DEVICE_FIELDS: tuple[str, ...] = ("whisper_device", "encoder", "tracking_engine_used")`
  - `collect_timings(timings: list, live: dict | None = None)` (context manager; `live` is owned by the job)
  - `report(**fields) -> None` (`clips_total=<int>` for the run, `percent=<float>` for the running stage)
  - `current_stage(live: dict | None) -> dict | None` returning `{"stage": str, "started_at": float, "elapsed_seconds": float, "device"?: str, "clip"?: int, "clips_total"?: int, "percent"?: float}`

- [ ] **Step 1: Ledger and log heading**

If `tasks/sp2-ledger.md` does not exist yet, create it:

```markdown
# SDD ledger — plan: docs/superpowers/plans/2026-11-20-sp2-ux-for-everyone.md

> Ledger resmi SP2. AI mana pun yang melanjutkan SP2 memperbarui file INI setelah setiap task, fix round, dan keputusan. Cara kerja: `tasks/HANDOFF-AI.md`.

Spec: docs/superpowers/specs/2026-11-20-sp2-ux-for-everyone-design.md
Branch: feat/sp2-ux-for-everyone, start dc3ba66
Owner accepted all plan defaults (2026-11-20: "ikuti rekomendasi, yang penting UX-nya jelas untuk orang awam").

## Pre-flight scan
(one line per finding: `- P<n> [Task, step, level] Ruling: <what> — <why> — <cost if wrong>`)

## Tasks
```

At the very end of `tasks/PROGRESS-LOG.md`, add once:

```markdown

## 2026-11-20 · SP2
```

- [ ] **Step 2: Write the failing tests** (append to `backend/tests/test_stage_timer.py`)

```python
# --- live stage for the job status (SP2 spec 4.4) ---------------------------------------------

def test_current_stage_is_none_without_a_running_stage():
    live = {}
    assert stage_timer.current_stage(live) is None
    assert stage_timer.current_stage(None) is None
    with collect_timings([], live):
        assert stage_timer.current_stage(live) is None


def test_current_stage_shows_the_running_stage_and_clears_when_it_ends():
    live = {}
    with collect_timings([], live):
        before = time.time()
        with stage("download"):
            cur = stage_timer.current_stage(live)
            assert cur["stage"] == "download"
            assert before - 1 <= cur["started_at"] <= time.time() + 1
            assert cur["elapsed_seconds"] >= 0
        assert stage_timer.current_stage(live) is None


def test_nested_stage_shows_the_inner_one_then_the_outer_again():
    live = {}
    with collect_timings([], live):
        with stage("clip", clip=1):
            with stage("render"):
                assert stage_timer.current_stage(live)["stage"] == "render"
            assert stage_timer.current_stage(live)["stage"] == "clip"
        assert stage_timer.current_stage(live) is None


def test_device_comes_from_the_field_the_stage_records():
    live = {}
    with collect_timings([], live):
        with stage("transcribe", whisper_model="small") as rec:
            assert "device" not in stage_timer.current_stage(live)
            rec["whisper_device"] = "cpu"
            assert stage_timer.current_stage(live)["device"] == "cpu"


def test_clip_number_and_total_while_rendering():
    live = {}
    with collect_timings([], live):
        stage_timer.report(clips_total=3)
        stage_timer.set_context(clip=2)
        with stage("render") as rec:
            rec["encoder"] = "libx264"
            cur = stage_timer.current_stage(live)
    assert (cur["clip"], cur["clips_total"], cur["device"]) == (2, 3, "libx264")


def test_percent_is_rounded_and_clamped():
    live = {}
    with collect_timings([], live):
        with stage("download"):
            stage_timer.report(percent=42.1234)
            assert stage_timer.current_stage(live)["percent"] == 42.1
            stage_timer.report(percent=180)
            assert stage_timer.current_stage(live)["percent"] == 100.0


def test_live_data_never_reaches_timings():
    timings, live = [], {}
    with collect_timings(timings, live):
        stage_timer.report(clips_total=4)
        stage_timer.set_context(clip=1)
        with stage("download"):
            stage_timer.report(percent=50)
    assert set(timings[0]) == {"stage", "clip", "seconds", "rss_mb_peak", "ok"}


def test_report_without_a_live_dict_is_harmless():
    stage_timer.report(percent=10, clips_total=2)
    timings = []
    with collect_timings(timings):
        with stage("download"):
            stage_timer.report(percent=10)
    assert "percent" not in timings[0]


def test_a_failing_stage_still_leaves_the_live_stack():
    live = {}
    with collect_timings([], live):
        with pytest.raises(RuntimeError):
            with stage("render"):
                raise RuntimeError("ffmpeg died")
        assert stage_timer.current_stage(live) is None


def test_each_collector_block_has_its_own_live_dict():
    outer, inner = {}, {}
    with collect_timings([], outer):
        with collect_timings([], inner):
            with stage("render"):
                assert stage_timer.current_stage(outer) is None
                assert stage_timer.current_stage(inner)["stage"] == "render"
```

- [ ] **Step 3: Run them to verify they fail**

Run: `C:\Users\dhima\projects\ac-venv\Scripts\python.exe -m pytest backend/tests/test_stage_timer.py -q -p no:cacheprovider`
Expected: FAIL with `AttributeError: module 'backend.stage_timer' has no attribute 'current_stage'` and `TypeError: collect_timings() takes 1 positional argument but 2 were given`.

- [ ] **Step 4: Implement**

In `backend/stage_timer.py`, add to the end of the module docstring (before the closing `"""`):

```python
While a job runs, ``collect_timings(timings, live)`` also keeps the running stages
on a stack in ``live`` (a dict owned by the job). ``current_stage(live)`` turns the
innermost one into the ``current`` object of the job status (SP2 spec 4.4), and
``report()`` adds live-only facts (``percent``, ``clips_total``). None of this is
ever written to ``timings``.
```

Below `_local = threading.local()` add:

```python
# Fields that say which device really did the work (see jobs._finalize_job).
DEVICE_FIELDS = ("whisper_device", "encoder", "tracking_engine_used")
```

Replace `collect_timings` with:

```python
@contextmanager
def collect_timings(timings: list, live: dict = None):
    """Send every ``stage`` finished on this thread, inside the block, to ``timings``.

    ``live`` (optional, owned by the job) holds the stages that are running now,
    for the job status. It is never copied into ``timings``.
    """
    previous = getattr(_local, "timings", None)
    previous_fields = getattr(_local, "fields", {})
    previous_live = getattr(_local, "live", None)
    _local.timings = timings
    _local.fields = {}
    _local.live = live
    try:
        yield timings
    finally:
        _local.timings = previous
        _local.fields = previous_fields
        _local.live = previous_live
```

In `stage()`, replace the lines from `log_app(f"[timing] start stage=...` down to `yield rec` with:

```python
    log_app(f"[timing] start stage={name}" + "".join(f" {k}={v}" for k, v in merged.items()))
    sampler = _PeakSampler()
    sampler.start()
    started = time.monotonic()
    live = getattr(_local, "live", None)
    entry = None
    if live is not None:
        # Replaced, never mutated in place: the status request reads it from another thread.
        entry = {"rec": rec, "started": started, "started_at": time.time()}
        live["stack"] = [*(live.get("stack") or []), entry]
    ok = True
    try:
        yield rec
```

and at the start of the `finally:` block of `stage()` add:

```python
        if entry is not None:
            live["stack"] = [e for e in (live.get("stack") or []) if e is not entry]
```

Add after `stage()`:

```python
def report(**fields):
    """Live facts for the job status only: ``clips_total`` for the run, ``percent`` for the running stage."""
    live = getattr(_local, "live", None)
    if live is None:
        return
    if "clips_total" in fields:
        live["clips_total"] = fields.pop("clips_total")
    stack = live.get("stack") or []
    if stack and fields:
        stack[-1].update(fields)


def _is_int(value) -> bool:
    return isinstance(value, int) and not isinstance(value, bool)


def current_stage(live) -> dict:
    """The innermost running stage as the ``current`` object of the job status, or None.

    ``{stage, started_at, elapsed_seconds, device?, clip?, clips_total?, percent?}``.
    ``elapsed_seconds`` comes from this server's clock, so a phone with another time still
    shows the right running time.
    """
    if not isinstance(live, dict):
        return None
    stack = live.get("stack") or []
    if not stack:
        return None
    top = stack[-1]
    rec = top["rec"]
    out = {
        "stage": rec.get("stage"),
        "started_at": round(top["started_at"], 3),
        "elapsed_seconds": round(max(0.0, time.monotonic() - top["started"]), 1),
    }
    for field in DEVICE_FIELDS:
        value = rec.get(field)
        if isinstance(value, str) and value:
            out["device"] = value
            break
    if _is_int(rec.get("clip")):
        out["clip"] = rec["clip"]
        total = live.get("clips_total")
        if _is_int(total) and total > 0:
            out["clips_total"] = total
    percent = top.get("percent")
    if isinstance(percent, (int, float)) and not isinstance(percent, bool):
        out["percent"] = round(min(100.0, max(0.0, float(percent))), 1)
    return out
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `C:\Users\dhima\projects\ac-venv\Scripts\python.exe -m pytest backend/tests/test_stage_timer.py backend/tests/test_pipeline_timings.py -q -p no:cacheprovider`
Expected: all PASS.
Then the whole suite: `C:\Users\dhima\projects\ac-venv\Scripts\python.exe -m pytest backend/tests -q -p no:cacheprovider` → 815 passed, 12 skipped (805 + 10).

- [ ] **Step 6: Log and commit**

Append under `## 2026-11-20 · SP2` in `tasks/PROGRESS-LOG.md`:

```markdown
- Task 1 (`stage_timer` tahap berjalan): `collect_timings(timings, live)` menyimpan tahap yang sedang berjalan di tumpukan milik job; `current_stage(live)` membentuk objek `current` (spec 4.4) dengan `elapsed_seconds` dari jam server; `report()` untuk `percent` dan `clips_total`, tidak pernah masuk `timings`. pytest: 815 lulus, 12 dilewati (+10).
```

Add to `tasks/sp2-ledger.md` under `## Tasks`: `Task 1: complete (commits <base>..<head>, review clean)` after the review.

```bash
git add backend/stage_timer.py backend/tests/test_stage_timer.py tasks/PROGRESS-LOG.md tasks/sp2-ledger.md
git commit -m "feat(sp2): live stage stack in stage_timer for the job status

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Backend: `current` in the job status (clip count, download percent)

Spec 4.4 (second half). Each job run gets its own `live` dict; `GET /jobs/{id}` returns `current`; render loops report `clips_total`; downloads report `percent`; the manual-resume run shares its timings list so finished step-4 stages show while it runs (Spec gap 4).

**Files:**
- Modify: `backend/jobs.py` (imports; `_DEVICE_FIELDS`; `_with_timings`; new `live_stage`; `report(clips_total=…)` before the clip loops of `_render_video_clips`, `_run_manual_job`, `_run_rerender_job`, `_run_rerun_ai_job`; `_run_manual_resume_job`)
- Modify: `backend/video_utils.py` (import; new `download_percent`; `_download_youtube_video` hook)
- Modify: `backend/main.py` (`api_get_job`)
- Test: `backend/tests/test_job_current.py` (create)

**Interfaces:**
- Consumes: `stage_timer.DEVICE_FIELDS`, `collect_timings(timings, live)`, `report(**fields)`, `current_stage(live)` (Task 1).
- Produces:
  - `jobs.live_stage(job_id: str) -> dict | None`
  - `video_utils.download_percent(d: dict) -> float | None`
  - `GET /jobs/{id}` JSON gains `"current": null | {"stage", "started_at", "elapsed_seconds", "device"?, "clip"?, "clips_total"?, "percent"?}` (consumed by Tasks 9–10 as `LiveStage`).

- [ ] **Step 1: Write the failing tests** (`backend/tests/test_job_current.py`)

```python
"""The job status names the stage that is running now (SP2 spec 4.4), without changing timings."""
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from backend import jobs, main, stage_timer
from backend.stage_timer import collect_timings, stage

client = TestClient(main.app)


def _job(job_id, src, tmp_path, **extra):
    job = {
        "id": job_id, "url": f"local:{src}", "provider": "openai", "api_key": "k", "mode": "ai",
        "aspect_ratio": "9:16", "title": f"Current {job_id}", "caption_style": "standard",
        "burn_subs": False, "output_dir": str(tmp_path), "quality": "best", "whisper_model": "small",
        "max_clips": 0, "status": "PENDING", "progress": "", "cancelled": False, "clips": [],
        "failed": 0, "error": None,
    }
    job.update(extra)
    return job


def test_live_stage_is_none_for_unknown_and_finished_jobs():
    assert jobs.live_stage("no-such-job") is None
    jobs.active_jobs["test-current-done"] = {"id": "test-current-done", "status": "DONE", "_live": {}}
    try:
        assert jobs.live_stage("test-current-done") is None
    finally:
        jobs.active_jobs.pop("test-current-done", None)


def test_run_job_reports_each_running_stage_with_its_device(tmp_path, monkeypatch):
    src = tmp_path / "source.mp4"
    src.write_bytes(b"x")
    job_id = "test-current-run"
    jobs.active_jobs[job_id] = _job(job_id, src, tmp_path, provider="manual_ai", api_key="",
                                    metadata={"title": "Current run"})
    seen = {}

    def fake_extract_audio(video, audio, register_proc=None):
        with stage("extract_audio"):
            seen["extract_audio"] = jobs.live_stage(job_id)
        return audio

    def fake_transcribe(audio, karaoke=False, is_cancelled=None, model_size="small"):
        with stage("transcribe", whisper_model=model_size) as rec:
            rec["whisper_device"] = "cpu"
            seen["transcribe"] = jobs.live_stage(job_id)
        return {"segments": [{"start": 0.0, "end": 1.0, "text": "halo"}]}

    monkeypatch.setattr("backend.ai_utils.extract_audio", fake_extract_audio)
    monkeypatch.setattr("backend.ai_utils.transcribe_with_faster_whisper", fake_transcribe)
    monkeypatch.setattr("backend.video_utils.get_video_duration", lambda p: 60.0)
    monkeypatch.setattr("backend.db.save_history", lambda *a, **k: None)
    try:
        jobs._run_job(job_id)
        assert jobs.active_jobs[job_id]["status"] == "AWAITING_MANUAL"
        assert seen["extract_audio"]["stage"] == "extract_audio"
        assert seen["transcribe"]["stage"] == "transcribe"
        assert seen["transcribe"]["device"] == "cpu"
        assert jobs.live_stage(job_id) is None
    finally:
        jobs.active_jobs.pop(job_id, None)


def test_render_reports_clip_number_of_total_without_touching_timings(tmp_path, monkeypatch):
    src = tmp_path / "source.mp4"
    src.write_bytes(b"x")
    job_id = "test-current-render"
    seg = {"start_time": "00:00:01", "end_time": "00:00:11", "description": "s"}
    metadata = {"highlights": [dict(seg), dict(seg)], "title": "Current render"}
    job = _job(job_id, src, tmp_path, metadata=metadata)
    live = job["_live"] = {}
    jobs.active_jobs[job_id] = job
    seen = []

    def fake_crop(*a, **k):
        with stage("render") as rec:
            rec["encoder"] = "libx264"
            seen.append(jobs.live_stage(job_id))
        return "clip.mp4"

    monkeypatch.setattr(jobs, "crop_to_vertical", fake_crop)
    monkeypatch.setattr("backend.db.save_history", lambda *a, **k: None)
    timings = []
    try:
        with collect_timings(timings, live):
            jobs._render_video_clips(job, job_id, metadata, str(src), None, lambda: False, 0)
        assert [(c["clip"], c["clips_total"], c["device"]) for c in seen] == [(1, 2, "libx264"), (2, 2, "libx264")]
        assert all("clips_total" not in t and "percent" not in t for t in timings)
    finally:
        jobs.active_jobs.pop(job_id, None)


def test_manual_resume_shows_finished_stages_while_it_runs(tmp_path, monkeypatch):
    src = tmp_path / "source.mp4"
    src.write_bytes(b"x")
    history = {
        "id": "test-current-manual", "url": f"local:{src}", "status": "AWAITING_MANUAL", "result_clips": [],
        "metadata": {
            "source_video": str(src), "subtitle_path": str(src), "title": "Current manual",
            "aspect_ratio": "9:16", "burn_subs": False, "output_dir": str(tmp_path),
            "timings": [{"stage": "transcribe", "seconds": 3.0, "rss_mb_peak": 1.0, "ok": True}],
        },
    }
    monkeypatch.setattr("backend.db.get_history", lambda j: history)
    monkeypatch.setattr("backend.db.save_history", lambda *a, **k: None)
    monkeypatch.setattr("threading.Thread.start", lambda self: None)
    shared = []

    def fake_crop(*a, **k):
        job = jobs.active_jobs["test-current-manual"]
        shared.append(job["metadata"]["timings"] is job["timings"])
        return "clip.mp4"

    monkeypatch.setattr(jobs, "crop_to_vertical", fake_crop)
    payload = '[{"start_time": "00:00:00", "end_time": "00:00:04", "description": "x"}]'
    job_id = jobs.resume_manual_job("test-current-manual", payload)
    try:
        from backend.ai_utils import _parse_highlights
        jobs._run_manual_resume_job(job_id, _parse_highlights(payload))
        assert shared == [True]
    finally:
        jobs.active_jobs.pop(job_id, None)


@pytest.mark.parametrize("update, expected", [
    ({"status": "downloading", "downloaded_bytes": 50, "total_bytes": 200}, 25.0),
    ({"status": "downloading", "downloaded_bytes": 30, "total_bytes_estimate": 60}, 50.0),
    ({"status": "downloading", "downloaded_bytes": 90, "total_bytes": 60}, 100.0),
    ({"status": "downloading", "downloaded_bytes": 10}, None),
    ({"status": "downloading", "downloaded_bytes": 10, "total_bytes": 0}, None),
    ({"status": "finished", "downloaded_bytes": 10, "total_bytes": 10}, None),
    ("not a dict", None),
])
def test_download_percent(update, expected):
    from backend.video_utils import download_percent
    assert download_percent(update) == expected


@patch("backend.video_utils.yt_dlp.YoutubeDL")
def test_download_reports_percent_while_the_download_stage_runs(mock_ytdl, tmp_path):
    from backend.video_utils import download_youtube_video
    seen, live = [], {}

    def construct(opts):
        ydl = MagicMock()

        def download(urls):
            for hook in opts["progress_hooks"]:
                hook({"status": "downloading", "downloaded_bytes": 50, "total_bytes": 200})
            seen.append(stage_timer.current_stage(live))

        ydl.download.side_effect = download
        manager = MagicMock()
        manager.__enter__.return_value = ydl
        manager.__exit__.return_value = False
        return manager

    mock_ytdl.side_effect = construct
    with collect_timings([], live):
        download_youtube_video("https://youtu.be/x", str(tmp_path / "v.mp4"))
    assert seen[0]["stage"] == "download"
    assert seen[0]["percent"] == 25.0


def test_job_status_carries_current_while_a_stage_runs():
    job_id = "test-current-api"
    live = {}
    jobs.active_jobs[job_id] = {"id": job_id, "url": "local:x", "status": "TRANSCRIBING", "progress": "",
                                "clips": [], "failed": 0, "error": None, "metadata": {}, "_live": live}
    try:
        with collect_timings([], live):
            with stage("transcribe") as rec:
                rec["whisper_device"] = "cuda"
                body = client.get(f"/jobs/{job_id}").json()
        assert body["current"]["stage"] == "transcribe"
        assert body["current"]["device"] == "cuda"
        assert "_live" not in body
        jobs.active_jobs[job_id]["status"] = "DONE"
        assert client.get(f"/jobs/{job_id}").json()["current"] is None
    finally:
        jobs.active_jobs.pop(job_id, None)


def test_job_status_from_history_has_no_current(monkeypatch):
    monkeypatch.setattr("backend.db.get_history", lambda j: {"url": "u", "status": "DONE", "result_clips": [], "metadata": {}})
    assert client.get("/jobs/test-current-history").json()["current"] is None
```

- [ ] **Step 2: Run them to verify they fail**

Run: `C:\Users\dhima\projects\ac-venv\Scripts\python.exe -m pytest backend/tests/test_job_current.py -q -p no:cacheprovider`
Expected: FAIL with `AttributeError: module 'backend.jobs' has no attribute 'live_stage'`, `ImportError: cannot import name 'download_percent'`, and `KeyError: 'current'`.

- [ ] **Step 3: Implement `jobs.py`**

Import line 15 becomes:

```python
from backend.stage_timer import DEVICE_FIELDS, collect_timings, current_stage, report, set_context, stage
```

Replace the `_DEVICE_FIELDS = (...)` assignment (keep its comment) with:

```python
_DEVICE_FIELDS = DEVICE_FIELDS
```

In `_with_timings.wrapper`, replace `with collect_timings(timings):` with:

```python
        # The stages running now, for GET /jobs/{id} (spec 4.4). Never saved.
        live = job["_live"] = {}
        with collect_timings(timings, live):
```

Add after `_with_timings`:

```python
def live_stage(job_id: str):
    """The stage an active job is running now (the ``current`` of its status), or None."""
    job = active_jobs.get(job_id)
    if not job or job.get("status") in _FINISHED:
        return None
    return current_stage(job.get("_live"))
```

Directly before each of these loops add one line (same indentation as the `for`):
- `_render_video_clips`, before `for i, seg in enumerate(segments):` → `report(clips_total=len(segments))`
- `_run_manual_job`, before `for i, clip in enumerate(clips):` → `report(clips_total=len(clips))`
- `_run_rerender_job`, before `for i, seg in enumerate(segments):` → `report(clips_total=len(segments))`
- `_run_rerun_ai_job`, before `for i, seg in enumerate(segments):` → `report(clips_total=len(segments))`

In `_run_manual_resume_job`, after `job["metadata"] = metadata` add:

```python
    # Same list as job["timings"] (as _with_timings does for new jobs), so the status shows
    # the stages of this run as they finish; _finalize_job saves the same value as before.
    metadata["timings"] = job["timings"]
```

- [ ] **Step 4: Implement `video_utils.py`**

Import: `from backend.stage_timer import report, stage`. Add above `download_youtube_video`:

```python
def download_percent(d) -> float:
    """How far one yt-dlp progress update is, in percent, or None when yt-dlp does not know the size."""
    if not isinstance(d, dict) or d.get("status") != "downloading":
        return None
    done = d.get("downloaded_bytes")
    total = d.get("total_bytes") or d.get("total_bytes_estimate")
    if not isinstance(done, (int, float)) or not isinstance(total, (int, float)) or total <= 0:
        return None
    return min(100.0, done * 100.0 / total)
```

In `_download_youtube_video`, replace the block

```python
    if is_cancelled:
        def hook(d):
            if is_cancelled():
                raise DownloadCancelledError("Download cancelled by user")
        base_ydl_opts['progress_hooks'] = [hook]
```

with

```python
    def hook(d):
        if is_cancelled and is_cancelled():
            raise DownloadCancelledError("Download cancelled by user")
        percent = download_percent(d)
        if percent is not None:
            report(percent=percent)  # live status only (spec 4.4), not timings

    base_ydl_opts['progress_hooks'] = [hook]
```

- [ ] **Step 5: Implement `main.py`**

In `api_get_job`, after the `"metadata": job.get("metadata", {})` entry (add a comma to it) add:

```python
        # The stage running now (spec 4.4): {stage, started_at, elapsed_seconds, device?, clip?,
        # clips_total?, percent?}, or None. Built at read time, never stored.
        "current": jobs.live_stage(job_id),
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `C:\Users\dhima\projects\ac-venv\Scripts\python.exe -m pytest backend/tests/test_job_current.py backend/tests/test_pipeline_timings.py backend/tests/test_video_utils.py -q -p no:cacheprovider` → all PASS.
Then the whole suite → 829 passed, 12 skipped (815 + 14).

- [ ] **Step 7: Log and commit**

PROGRESS-LOG entry: what changed (`current` in `GET /jobs/{id}`, clip count, download percent, manual resume timings shared), pytest numbers. Ledger: `Task 2: complete (...)`.

```bash
git add backend/jobs.py backend/video_utils.py backend/main.py backend/tests/test_job_current.py tasks/PROGRESS-LOG.md tasks/sp2-ledger.md
git commit -m "feat(sp2): current stage, clip count and download percent in the job status

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
