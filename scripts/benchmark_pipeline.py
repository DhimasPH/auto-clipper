"""Run one video through the real job pipeline and print time and memory per stage.

The numbers come from metadata["timings"], which every job records (see
backend/stage_timer.py). Nothing here is simulated: the script starts a normal
job, waits for it, then prints the table.

Usage (from the repo root):

    python scripts/benchmark_pipeline.py SOURCE [options]

SOURCE is a video URL or a path to a local video file.

Without --provider the script runs a manual job: download, audio extraction,
transcription, face tracking and render. That needs no AI key and covers every
heavy stage. With --provider and --api-key it runs the AI job instead, which
adds the highlight selection stage.

Examples:

    # three 60-second clips from a 30-minute video, default settings
    python scripts/benchmark_pipeline.py "https://www.youtube.com/watch?v=VIDEO_ID"

    # same video with MediaPipe tracking and the medium Whisper model
    python scripts/benchmark_pipeline.py "https://www.youtube.com/watch?v=VIDEO_ID" \
        --engine mediapipe --whisper-model medium --json after.json

    # a local file, your own clip ranges
    python scripts/benchmark_pipeline.py talk.mp4 --clip 00:00:30-00:01:30 --clip 00:05:00-00:06:00

Google Colab. Stop the server cell first, so the benchmark is the only heavy
process, then run this in a new cell. It gives the benchmark the same workspace
and GPU library paths as the server:

    %cd /content/auto-clipper
    from backend.colab_api import setup_environment
    setup_environment("/content/drive/MyDrive/AutoClipperData")
    !python scripts/benchmark_pipeline.py "https://www.youtube.com/watch?v=VIDEO_ID" --engine mediapipe --json /content/benchmark.json

Use the same video, clips and options for the "before" and "after" runs,
otherwise the two tables cannot be compared.
"""
import argparse
import json
import os
import sys
import time

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

DEFAULT_CLIPS = ["00:01:00-00:02:00", "00:10:00-00:11:00", "00:20:00-00:21:00"]
FINISHED = ("DONE", "ERROR", "CANCELLED", "AWAITING_MANUAL")
DETAIL_FIELDS = ("whisper_model", "whisper_device", "tracking_engine_used", "encoder", "source")


def to_source_url(source: str) -> str:
    """A local file becomes the "local:<path>" form the job pipeline expects."""
    if os.path.exists(source):
        return f"local:{os.path.abspath(source)}"
    return source


def parse_clip(text: str) -> dict:
    start, _, end = text.partition("-")
    if not start.strip() or not end.strip():
        raise argparse.ArgumentTypeError(f"clip must look like 00:01:00-00:02:00, got {text!r}")
    return {"start": start.strip(), "end": end.strip()}


def format_timings_table(timings: list) -> str:
    if not timings:
        return "No timings were recorded."

    rows = []
    for t in timings:
        details = [f"{key}={t[key]}" for key in DETAIL_FIELDS if t.get(key)]
        if t.get("ok") is False:
            details.append("FAILED")
        rss = t.get("rss_mb_peak")
        rows.append((
            str(t.get("stage", "?")),
            str(t.get("clip", "")),
            f"{float(t.get('seconds') or 0):.1f}",
            f"{rss:.1f}" if rss is not None else "n/a",
            " ".join(details),
        ))

    headers = ("stage", "clip", "seconds", "rss_mb_peak", "details")
    widths = [max(len(headers[i]), *(len(r[i]) for r in rows)) for i in range(4)]

    def line(cells):
        return "  ".join(
            [cells[0].ljust(widths[0]), cells[1].rjust(widths[1]), cells[2].rjust(widths[2]), cells[3].rjust(widths[3]), cells[4]]
        ).rstrip()

    total = sum(float(t.get("seconds") or 0) for t in timings)
    peaks = [t["rss_mb_peak"] for t in timings if t.get("rss_mb_peak") is not None]
    out = [line(headers), line(tuple("-" * w for w in widths) + ("",))]
    out.extend(line(r) for r in rows)
    out.append("")
    out.append(f"total of all stages: {total:.1f} s")
    out.append(f"highest rss_mb_peak: {max(peaks):.1f} MB" if peaks else "highest rss_mb_peak: n/a")
    return "\n".join(out)


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="Benchmark the Auto Clipper pipeline on one video.")
    p.add_argument("source", help="video URL or path to a local video file")
    p.add_argument("--clip", action="append", type=parse_clip, metavar="START-END",
                   help="clip range, repeatable (default: three 60 s clips at minute 1, 10 and 20)")
    p.add_argument("--whisper-model", default="small")
    p.add_argument("--engine", default="haar", choices=["haar", "mediapipe"], help="face tracking engine")
    p.add_argument("--quality", default="best")
    p.add_argument("--aspect-ratio", default="9:16")
    p.add_argument("--no-subs", action="store_true", help="skip transcription and subtitles")
    p.add_argument("--provider", default="", help="run the AI job with this provider instead of a manual job")
    p.add_argument("--api-key", default="")
    p.add_argument("--model", default="")
    p.add_argument("--workspace", default="", help="sets AUTO_CLIPPER_WORKSPACE for this run")
    p.add_argument("--json", dest="json_out", default="", help="also write the raw result to this file")
    return p


def run(args) -> int:
    if args.workspace:
        os.environ["AUTO_CLIPPER_WORKSPACE"] = args.workspace
    sys.path.insert(0, REPO_ROOT)

    from backend.db import init_db
    from backend import jobs

    init_db()
    url = to_source_url(args.source)
    title = f"benchmark-{time.strftime('%Y%m%d-%H%M%S')}"
    common = dict(aspect_ratio=args.aspect_ratio, burn_subs=not args.no_subs, quality=args.quality,
                  title=title, whisper_model=args.whisper_model, face_tracking_engine=args.engine)

    if args.provider:
        job_id = jobs.create_job(url, args.provider, args.api_key, model=args.model, **common)
    else:
        clips = args.clip or [parse_clip(c) for c in DEFAULT_CLIPS]
        job_id = jobs.create_manual_job(url, clips, **common)

    started = time.monotonic()
    last_progress = None
    while True:
        job = jobs.get_job(job_id)
        progress = f"{job.get('status')}: {job.get('progress')}"
        if progress != last_progress:
            print(f"[{time.monotonic() - started:7.1f}s] {progress}", file=sys.stderr)
            last_progress = progress
        if job.get("status") in FINISHED:
            break
        time.sleep(1)

    wall = time.monotonic() - started
    metadata = job.get("metadata") or {}
    timings = metadata.get("timings") or job.get("timings") or []

    print(format_timings_table(timings))
    print(f"wall clock for the job: {wall:.1f} s")
    print(f"status: {job.get('status')}, clips rendered: {len(job.get('clips') or [])}, clips failed: {job.get('failed', 0)}")
    if job.get("error"):
        print(f"error: {job['error']}")

    if args.json_out:
        result = {
            "source": args.source, "status": job.get("status"), "wall_seconds": round(wall, 1),
            "options": {"whisper_model": args.whisper_model, "engine": args.engine, "quality": args.quality,
                        "provider": args.provider or "manual"},
            "timings": timings, "error": job.get("error"),
        }
        with open(args.json_out, "w", encoding="utf-8") as f:
            json.dump(result, f, indent=2)

    return 0 if job.get("status") == "DONE" else 1


if __name__ == "__main__":
    sys.exit(run(build_parser().parse_args()))
