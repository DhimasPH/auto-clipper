import cv2
import os
import re
import subprocess


def to_seconds(t) -> float:
    """Parse a flexible timestamp into seconds.

    Handles 'HH:MM:SS.mmm', 'MM:SS', plain seconds, comma decimals, and the
    malformed 'MM:SS:mmm' / 'HH:MM:SS:mmm' shape some models emit (a trailing
    3-digit group is treated as milliseconds).
    """
    if t is None:
        return 0.0
    s = str(t).strip().replace(',', '.')
    if not s:
        return 0.0
    if ':' in s:
        parts = s.split(':')
        if '.' not in s and len(parts) >= 3 and parts[-1].isdigit() and len(parts[-1]) == 3:
            ms = parts.pop()
            parts[-1] = f"{parts[-1]}.{ms}"
        try:
            nums = [float(p) for p in parts]
        except ValueError:
            return 0.0
        if len(nums) == 3:
            return nums[0] * 3600 + nums[1] * 60 + nums[2]
        if len(nums) == 2:
            return nums[0] * 60 + nums[1]
        return nums[0] if nums else 0.0
    try:
        return float(s)
    except ValueError:
        return 0.0


def detect_primary_face_center(video_path: str, start_time=None, end_time=None) -> float:
    """Return the relative X center (0.0-1.0) to center the 9:16 crop on.

    Samples several frames spread across the clip window (not just the start),
    takes the *median* face position so a brief detection glitch can't throw the
    framing off, and clamps the result so the crop window stays fully in-frame
    (which also keeps the face from being cut off at the edges). Defaults to 0.5
    if no face is found.
    """
    face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
    cap = cv2.VideoCapture(video_path)

    if not cap.isOpened():
        cap.release()
        return 0.5

    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    frame_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
    frame_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)

    if start_time is not None:
        s = to_seconds(start_time)
        e = to_seconds(end_time) if end_time is not None else s + 30.0
    else:
        dur = total_frames / fps if fps else 0.0
        s, e = (dur * 0.4, dur * 0.6) if dur else (0.0, 1.0)
    if e <= s:
        e = s + 1.0

    centers = []
    samples = 10
    for i in range(samples):
        t = s + (e - s) * (i / (samples - 1) if samples > 1 else 0.5)
        cap.set(cv2.CAP_PROP_POS_MSEC, t * 1000.0)
        ret, frame = cap.read()
        if not ret:
            continue
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        faces = face_cascade.detectMultiScale(gray, 1.1, 4)
        if len(faces) > 0:
            x, y, w, h = max(faces, key=lambda rect: rect[2] * rect[3])
            centers.append((x + w / 2) / frame.shape[1])

    cap.release()

    if not centers:
        return 0.5

    centers.sort()
    center = centers[len(centers) // 2]  # median

    # Clamp so the 9:16 window never runs off either edge.
    if frame_w and frame_h:
        half_window = (frame_h * 9 / 16) / frame_w / 2
        lo, hi = half_window, 1 - half_window
        if lo <= hi:
            center = max(lo, min(hi, center))

    return center


def _parse_srt_ts(ts: str) -> float:
    ts = ts.strip().replace('.', ',')
    h, m, rest = ts.split(':')
    s, ms = rest.split(',')
    return int(h) * 3600 + int(m) * 60 + int(s) + int(ms) / 1000.0


def _fmt_srt_ts(sec: float) -> str:
    if sec < 0:
        sec = 0
    h = int(sec // 3600); sec -= h * 3600
    m = int(sec // 60); sec -= m * 60
    s = int(sec); ms = int(round((sec - s) * 1000))
    if ms == 1000:
        s += 1; ms = 0
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def shift_srt_for_clip(srt_text: str, start_time, end_time) -> str:
    """Slice a full-video SRT down to a clip window and rebase timestamps to 0.

    Burning the full transcript onto a trimmed clip would show the wrong lines,
    because the clip's timeline restarts at 0. This keeps only the cues that
    overlap [start, end] and shifts them relative to the clip start.
    """
    start_s = to_seconds(start_time)
    end_s = to_seconds(end_time)
    out = []
    idx = 1
    for block in re.split(r'\n\s*\n', srt_text.strip()):
        lines = block.strip().split('\n')
        if len(lines) < 2:
            continue
        tline = ti = None
        for i, ln in enumerate(lines):
            if '-->' in ln:
                tline, ti = ln, i
                break
        if tline is None:
            continue
        a, _, z = tline.partition('-->')
        try:
            cue_start = _parse_srt_ts(a)
            cue_end = _parse_srt_ts(z)
        except Exception:
            continue
        if cue_end <= start_s or cue_start >= end_s:
            continue
        new_start = max(cue_start, start_s) - start_s
        new_end = min(cue_end, end_s) - start_s
        text = '\n'.join(lines[ti + 1:]).strip()
        if not text:
            continue
        out.append(f"{idx}\n{_fmt_srt_ts(new_start)} --> {_fmt_srt_ts(new_end)}\n{text}")
        idx += 1
    return '\n\n'.join(out) + ('\n' if out else '')


def _fmt_ass_ts(sec: float) -> str:
    if sec < 0:
        sec = 0
    h = int(sec // 3600); sec -= h * 3600
    m = int(sec // 60); sec -= m * 60
    s = int(sec); cs = int(round((sec - s) * 100))
    if cs == 100:
        s += 1; cs = 0
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"


def srt_to_ass(srt_text: str, width: int, height: int) -> str:
    """Convert SRT text to an ASS subtitle with an explicit script resolution.

    Burning an SRT directly makes libass assume a default script size, so the
    same FontSize renders wildly different (often huge) depending on the build.
    Pinning PlayResX/Y to the actual clip and sizing the font as a fraction of
    clip height keeps captions a sensible, consistent size.
    """
    width = int(width) or 1080
    height = int(height) or 1920
    font_size = max(12, round(height * 0.045))
    outline = max(1, round(height * 0.0028))
    margin_v = max(20, round(height * 0.06))
    header = (
        "[Script Info]\n"
        "ScriptType: v4.00+\n"
        "WrapStyle: 2\n"
        f"PlayResX: {width}\n"
        f"PlayResY: {height}\n\n"
        "[V4+ Styles]\n"
        "Format: Name, Fontname, Fontsize, PrimaryColour, OutlineColour, BackColour, "
        "Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, "
        "Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n"
        f"Style: Default,Arial,{font_size},&H00FFFFFF,&H00000000,&H80000000,"
        f"-1,0,0,0,100,100,0,0,1,{outline},0,2,60,60,{margin_v},1\n\n"
        "[Events]\n"
        "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n"
    )
    events = []
    for block in re.split(r'\n\s*\n', srt_text.strip()):
        lines = block.strip().split('\n')
        if len(lines) < 2:
            continue
        tline = ti = None
        for i, ln in enumerate(lines):
            if '-->' in ln:
                tline, ti = ln, i
                break
        if tline is None:
            continue
        a, _, z = tline.partition('-->')
        try:
            st = _parse_srt_ts(a)
            et = _parse_srt_ts(z)
        except Exception:
            continue
        text = '\\N'.join(ln.strip() for ln in lines[ti + 1:] if ln.strip())
        if not text:
            continue
        events.append(
            f"Dialogue: 0,{_fmt_ass_ts(st)},{_fmt_ass_ts(et)},Default,,0,0,0,,{text}"
        )
    return header + "\n".join(events) + ("\n" if events else "")


def _video_dims(path: str):
    """Return (width, height) of the video, or (0, 0) if unreadable."""
    cap = cv2.VideoCapture(path)
    if not cap.isOpened():
        cap.release()
        return (0, 0)
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)
    cap.release()
    return (w, h)


def _run_ffmpeg(cmd, cwd=None):
    """Run ffmpeg, returning (ok, stderr_text)."""
    proc = subprocess.run(cmd, cwd=cwd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    return proc.returncode == 0, proc.stderr.decode("utf-8", "ignore")


def _video_duration(path: str):
    """Return the video duration in seconds, or None if it can't be read."""
    cap = cv2.VideoCapture(path)
    if not cap.isOpened():
        cap.release()
        return None
    fps = cap.get(cv2.CAP_PROP_FPS) or 0
    frames = cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0
    cap.release()
    if fps > 0 and frames > 0:
        return frames / fps
    return None


def crop_to_vertical(input_path: str, output_path: str, start_time: str,
                     end_time: str, subtitle_path: str = None) -> str:
    """Crop to 9:16, trim to [start, end], and optionally burn subtitles.

    ``subtitle_path`` should point at a full-video .srt; a per-clip subtitle is
    generated automatically so the captions line up with the trimmed clip.
    """
    start_s = to_seconds(start_time)
    end_s = to_seconds(end_time)

    # Small padding so clips don't cut off the first/last word of a sentence.
    PAD = 0.5
    start_s = max(0.0, start_s - PAD)
    end_s = end_s + PAD

    # Guard against out-of-range AI timestamps, which otherwise make ffmpeg
    # emit an empty (unplayable) file while still exiting successfully.
    total = _video_duration(input_path)
    if total:
        if start_s >= total:
            raise ValueError(
                f"Highlight start {start_s:.0f}s is past the video length "
                f"{total:.0f}s — the AI returned an out-of-range timestamp."
            )
        end_s = min(end_s, total)

    duration = end_s - start_s
    if duration < 0.5:
        raise ValueError(
            f"Highlight window is invalid (start {start_s:.1f}s, end {end_s:.1f}s)."
        )

    center_pct = detect_primary_face_center(input_path, start_time=start_s, end_time=end_s)
    # trunc(.../2)*2 keeps the crop width even, which H.264 requires.
    crop_filter = f"crop=trunc(ih*9/16/2)*2:ih:iw*{center_pct}-ih*9/32:0"

    # Build an optional subtitle-burning variant. We generate an .ass sized to
    # the clip and reference it by basename while running ffmpeg from that
    # folder, which sidesteps the fragile Windows drive-letter escaping
    # (C:\ -> C\:) inside the subtitle filter.
    subtitle_vf = None
    subtitle_cwd = None
    if subtitle_path:
        try:
            with open(subtitle_path, "r", encoding="utf-8") as f:
                clip_srt = shift_srt_for_clip(f.read(), start_s, end_s)
        except Exception:
            clip_srt = ""
        if clip_srt.strip():
            src_w, src_h = _video_dims(input_path)
            out_w = (int(src_h * 9 / 16) // 2) * 2 if src_h else 0
            ass_text = srt_to_ass(clip_srt, out_w, src_h)
            clip_ass_path = output_path.rsplit('.', 1)[0] + ".ass"
            with open(clip_ass_path, "w", encoding="utf-8") as f:
                f.write(ass_text)
            subtitle_cwd = os.path.dirname(clip_ass_path) or None
            ass_name = os.path.basename(clip_ass_path)
            subtitle_vf = f"{crop_filter},ass={ass_name}"

    def build_cmd(vf):
        return [
            "ffmpeg", "-y",
            "-ss", f"{start_s:.3f}",
            "-i", input_path,
            "-t", f"{duration:.3f}",
            "-vf", vf,
            "-c:v", "libx264",
            "-pix_fmt", "yuv420p",
            "-preset", "veryfast",
            "-c:a", "aac",
            "-movflags", "+faststart",
            output_path,
        ]

    # Try with burned-in subtitles first; if that fails (e.g. ffmpeg built
    # without libass), fall back to a plain crop so a clip is still produced.
    if subtitle_vf is not None:
        ok, _ = _run_ffmpeg(build_cmd(subtitle_vf), cwd=subtitle_cwd)
        if ok:
            return output_path

    ok, err = _run_ffmpeg(build_cmd(crop_filter))
    if not ok:
        raise RuntimeError(f"ffmpeg failed: {err[-800:]}")
    return output_path
