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
    # Task 2.1: Proportional font sizing relative to width (better for vertical 9:16)
    font_size = max(12, round(width * 0.075))
    outline = max(1, round(width * 0.005))
    shadow = max(1, round(width * 0.005))
    margin_h = max(20, round(width * 0.08))
    margin_v = max(20, round(height * 0.12)) # Lift higher from the bottom

    header = (
        "[Script Info]\n"
        "ScriptType: v4.00+\n"
        "WrapStyle: 1\n"  # 1 = Smart word wrapping if line is too long
        f"PlayResX: {width}\n"
        f"PlayResY: {height}\n\n"
        "[V4+ Styles]\n"
        "Format: Name, Fontname, Fontsize, PrimaryColour, OutlineColour, BackColour, "
        "Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, "
        "Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n"
        f"Style: Default,Arial,{font_size},&H00FFFFFF,&H00000000,&H80000000,"
        f"-1,0,0,0,100,100,0,0,1,{outline},{shadow},2,{margin_h},{margin_h},{margin_v},1\n\n"
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


def words_to_karaoke_ass(words: list, width: int, height: int, clip_start: float, clip_end: float) -> str:
    """Convert word-level timestamps to Karaoke ASS format for a specific clip."""
    width = int(width) or 1080
    height = int(height) or 1920
    font_size = max(12, round(width * 0.075))
    outline = max(1, round(width * 0.005))
    shadow = max(1, round(width * 0.005))
    margin_h = max(20, round(width * 0.08))
    margin_v = max(20, round(height * 0.12))

    header = (
        "[Script Info]\n"
        "ScriptType: v4.00+\n"
        "WrapStyle: 1\n"
        f"PlayResX: {width}\n"
        f"PlayResY: {height}\n\n"
        "[V4+ Styles]\n"
        "Format: Name, Fontname, Fontsize, PrimaryColour, OutlineColour, BackColour, "
        "Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, "
        "Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n"
        f"Style: Default,Arial,{font_size},&H00FFFFFF,&H00000000,&H80000000,"
        f"-1,0,0,0,100,100,0,0,1,{outline},{shadow},2,{margin_h},{margin_h},{margin_v},1\n\n"
        "[Events]\n"
        "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n"
    )

    events = []
    
    # Filter words to only those within the clip window
    clip_words = []
    for w in words:
        w_start = w.get("start", 0)
        w_end = w.get("end", 0)
        # Shift to clip timeline
        s = max(0, w_start - clip_start)
        e = min(clip_end - clip_start, w_end - clip_start)
        if e > 0 and w_start < clip_end and w_end > clip_start:
            clip_words.append({"word": w.get("word", "").strip(), "start": s, "end": e})

    if not clip_words:
        return header

    # Chunk words into lines (max 4 words per line)
    CHUNK_SIZE = 4
    chunks = [clip_words[i:i+CHUNK_SIZE] for i in range(0, len(clip_words), CHUNK_SIZE)]

    for chunk in chunks:
        if not chunk: continue
        line_start = chunk[0]["start"]
        line_end = chunk[-1]["end"]
        
        # Create an event for each word being highlighted
        for i, highlight_word in enumerate(chunk):
            w_start = highlight_word["start"]
            w_end = highlight_word["end"]
            
            # If it's the last word in the chunk, extend its display until the line ends
            # actually, each event spans the duration of that word
            
            parts = []
            for j, w in enumerate(chunk):
                if j == i:
                    parts.append(f"{{\\c&H00FFFF&}}{w['word']}{{\\c}}") # Yellow highlight
                else:
                    parts.append(w["word"])
                    
            text = " ".join(parts)
            events.append(
                f"Dialogue: 0,{_fmt_ass_ts(w_start)},{_fmt_ass_ts(w_end)},Default,,0,0,0,,{text}"
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


def _run_ffmpeg(cmd, cwd=None, register=None):
    """Run ffmpeg, returning (ok, stderr_text).

    Uses Popen (not subprocess.run) so the caller can register the live process
    handle and kill it mid-render on cancel.
    """
    proc = subprocess.Popen(cmd, cwd=cwd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if register:
        register(proc)
    _, stderr = proc.communicate()
    return proc.returncode == 0, (stderr or b"").decode("utf-8", "ignore")


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


def build_crop_filter(aspect_ratio: str, center_pct: float) -> str:
    """ffmpeg crop expression for a given target aspect ratio.

    Portrait/square ratios keep the full source height and crop the width,
    horizontally centred on the detected face. Landscape (16:9) instead keeps
    the full width and crops the height, centred vertically. The returned
    string must not contain a comma (it is concatenated with ",ass=...").
    """
    if aspect_ratio == "1:1":
        return f"crop=trunc(ih/2)*2:ih:iw*{center_pct}-ih/2:0"
    elif aspect_ratio == "4:5":
        return f"crop=trunc(ih*4/5/2)*2:ih:iw*{center_pct}-ih*4/10:0"
    elif aspect_ratio == "16:9":
        return "crop=iw:trunc(iw*9/16/2)*2:0:(ih-trunc(iw*9/16/2)*2)/2"
    else:  # 9:16 default
        return f"crop=trunc(ih*9/16/2)*2:ih:iw*{center_pct}-ih*9/32:0"


def output_width(aspect_ratio: str, src_w: int, src_h: int) -> int:
    """Rendered clip width (even) for subtitle sizing, per aspect ratio."""
    if aspect_ratio == "1:1":
        return (int(src_h) // 2) * 2
    elif aspect_ratio == "4:5":
        return (int(src_h * 4 / 5) // 2) * 2
    elif aspect_ratio == "16:9":
        return (int(src_w) // 2) * 2 if src_w else 0
    else:  # 9:16 default
        return (int(src_h * 9 / 16) // 2) * 2 if src_h else 0


def crop_to_vertical(input_path: str, output_path: str, start_time: str,
                     end_time: str, subtitle_path: str = None, aspect_ratio: str = "9:16",
                     register_proc=None, should_cancel=None) -> str:
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
    
    # Calculate crop dimensions based on aspect ratio
    crop_filter = build_crop_filter(aspect_ratio, center_pct)

    # Build an optional subtitle-burning variant. We generate an .ass sized to
    # the clip and reference it by basename while running ffmpeg from that
    # folder, which sidesteps the fragile Windows drive-letter escaping
    # (C:\ -> C\:) inside the subtitle filter.
    subtitle_vf = None
    subtitle_cwd = None
    if subtitle_path and os.path.exists(subtitle_path):
        import json
        is_json = subtitle_path.endswith(".json")
        src_w, src_h = _video_dims(input_path)
        out_w = output_width(aspect_ratio, src_w, src_h)
        # Landscape crops height from width, so subtitle canvas height differs.
        out_h = int(src_w * 9 / 16) if aspect_ratio == "16:9" else src_h
            
        ass_text = ""
        
        try:
            with open(subtitle_path, "r", encoding="utf-8") as f:
                content = f.read()
                
            if is_json:
                data = json.loads(content)
                words = data.get("words", [])
                ass_text = words_to_karaoke_ass(words, out_w, out_h, start_s, end_s)
            else:
                clip_srt = shift_srt_for_clip(content, start_s, end_s)
                if clip_srt.strip():
                    ass_text = srt_to_ass(clip_srt, out_w, out_h)
        except Exception as e:
            print(f"Failed to generate ASS: {e}")
            ass_text = ""
            
        if ass_text:
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

    if should_cancel and should_cancel():
        raise RuntimeError("Dibatalkan oleh pengguna.")

    # Try with burned-in subtitles first; if that fails (e.g. ffmpeg built
    # without libass), fall back to a plain crop so a clip is still produced.
    if subtitle_vf is not None:
        ok, _ = _run_ffmpeg(build_cmd(subtitle_vf), cwd=subtitle_cwd, register=register_proc)
        if ok:
            return output_path
        # Don't run the fallback render if the user just cancelled.
        if should_cancel and should_cancel():
            raise RuntimeError("Dibatalkan oleh pengguna.")

    ok, err = _run_ffmpeg(build_cmd(crop_filter), register=register_proc)
    if not ok:
        raise RuntimeError(f"ffmpeg failed: {err[-800:]}")
    return output_path
