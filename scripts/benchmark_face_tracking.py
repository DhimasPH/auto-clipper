"""Time face tracking for one clip: the old seek-per-sample read against the FFmpeg read.

Both runs call the real tracking code in backend/crop_utils.py over the same
window, then the script checks that they produced the same sample times.

Usage (from the repo root):

    python scripts/benchmark_face_tracking.py [SOURCE] [options]

Without SOURCE the script first encodes a 90-second 1080p30 H.264 test video
(moving test pattern plus noise, a keyframe every 5 seconds like a YouTube
download) into a temporary folder. With SOURCE it uses that file.

Examples:

    # synthetic video, 80-second window, Haar engine
    python scripts/benchmark_face_tracking.py

    # a real video on Colab, window 00:05:00 to 00:06:20
    !python scripts/benchmark_face_tracking.py /content/work/video.mp4 --start 300 --duration 80

FFmpeg must be on PATH or where backend/video_utils.py looks for it.
"""
import argparse
import os
import shutil
import subprocess
import sys
import tempfile
import time

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="Compare the old and new face tracking frame readers on one clip.")
    p.add_argument("source", nargs="?", help="video file; omitted = encode a synthetic 1080p30 test video")
    p.add_argument("--start", type=float, default=5.0, help="window start in seconds (default 5)")
    p.add_argument("--duration", type=float, default=80.0, help="window length in seconds (default 80)")
    p.add_argument("--engine", choices=("haar", "mediapipe"), default="haar")
    p.add_argument("--interval", type=float, default=0.5, help="seconds between samples (default 0.5, as in the pipeline)")
    p.add_argument("--keep", action="store_true", help="keep the synthetic video instead of deleting it")
    return p


def make_test_video(ffmpeg: str, path: str, seconds: int = 90) -> None:
    """1080p30 H.264 at ~4 Mbit/s with motion everywhere and a keyframe every 150 frames."""
    cmd = [
        ffmpeg, "-hide_banner", "-loglevel", "error", "-y",
        "-f", "lavfi", "-i", f"testsrc2=size=1920x1080:rate=30:duration={seconds}",
        "-vf", "noise=alls=6:allf=t,format=yuv420p",
        # About the bitrate YouTube serves 1080p30 H.264 at.
        "-c:v", "libx264", "-preset", "veryfast", "-b:v", "4M", "-maxrate", "5M", "-bufsize", "10M",
        "-g", "150", "-keyint_min", "150", "-sc_threshold", "0",
        path,
    ]
    subprocess.run(cmd, check=True)


def timed(fn):
    t0 = time.perf_counter()
    result = fn()
    return result, time.perf_counter() - t0


def main(argv=None) -> int:
    args = build_parser().parse_args(argv)
    sys.path.insert(0, REPO_ROOT)
    from backend import crop_utils

    ffmpeg = crop_utils._ffmpeg_executable()
    if not ffmpeg:
        print("FFmpeg not found; put it on PATH first.", file=sys.stderr)
        return 1

    tmp_dir = None
    source = args.source
    if not source:
        tmp_dir = tempfile.mkdtemp(prefix="tracking-bench-")
        source = os.path.join(tmp_dir, "synthetic_1080p30.mp4")
        print(f"Encoding a 90 s 1080p30 test video to {source} ...")
        make_test_video(ffmpeg, source)

    try:
        start, end = args.start, args.start + args.duration
        print(f"Video: {source} ({os.path.getsize(source) / 1e6:.1f} MB)")
        print(f"Window: {start:.1f}-{end:.1f} s, interval {args.interval} s, engine {args.engine}, CPUs {os.cpu_count()}")

        old_info, new_info = {}, {}
        old, old_s = timed(lambda: crop_utils._sample_face_trajectory(
            source, start, end, args.interval, engine=args.engine, info=old_info, use_ffmpeg=False))
        new, new_s = timed(lambda: crop_utils.sample_face_trajectory(
            source, start, end, args.interval, engine=args.engine, info=new_info))

        same_times = [p[0] for p in old] == [p[0] for p in new]
        max_dx = max((abs(a[1] - b[1]) for a, b in zip(old, new)), default=0.0)
        print()
        print(f"{'reader':<28}{'seconds':>10}{'x clip length':>16}")
        print(f"{'old: seek per sample':<28}{old_s:>10.1f}{old_s / args.duration:>16.2f}")
        print(f"{'new: one FFmpeg read':<28}{new_s:>10.1f}{new_s / args.duration:>16.2f}")
        print(f"speed-up: {old_s / new_s:.1f}x")
        print(f"samples: {len(old)} old, {len(new)} new, same sample times: {same_times}, largest x difference: {max_dx:.4f}")
        print(f"engine used: old {old_info.get('engine_used')}, new {new_info.get('engine_used')}")
        return 0 if same_times else 2
    finally:
        if tmp_dir and not args.keep:
            shutil.rmtree(tmp_dir, ignore_errors=True)


if __name__ == "__main__":
    sys.exit(main())
