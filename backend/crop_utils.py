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
    if face_cascade.empty():
        return 0.5
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


def detect_video_layout(video_path: str, start_time=None, end_time=None, samples: int = 12) -> dict:
    """Classify a video as gaming split-screen vs. a standard centred crop.

    Samples a *fixed* number of frames spread across the window (sparse, so a
    1-hour stream costs the same as a 1-minute clip), detects the largest face
    per frame, and takes the median of the face box across samples. A small face
    parked in a corner is the tell-tale sign of a gaming facecam.

    Returns a dict with normalised (0-1) geometry so callers don't depend on the
    source resolution::

        {"mode": "gaming"|"standard",
         "face_box": (x, y, w, h) | None,
         "face_area_ratio": float,
         "face_center": (cx, cy)}
    """
    import statistics

    result = {"mode": "standard", "face_box": None, "face_area_ratio": 0.0, "face_center": (0.5, 0.5)}

    cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
    if cascade.empty():
        return result
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        cap.release()
        return result

    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    dur = total_frames / fps if fps else 0.0

    if start_time is not None:
        s = to_seconds(start_time)
        e = to_seconds(end_time) if end_time is not None else s + 30.0
    else:
        s, e = 0.0, (dur if dur else 1.0)
    if e <= s:
        e = s + 1.0

    boxes = []  # each: (cx, cy, area_ratio, x, y, w, h) all normalised
    for i in range(samples):
        t = s + (e - s) * (i / (samples - 1) if samples > 1 else 0.5)
        cap.set(cv2.CAP_PROP_POS_MSEC, t * 1000.0)
        ret, frame = cap.read()
        if not ret:
            continue
        fh_, fw_ = frame.shape[0], frame.shape[1]
        if not fw_ or not fh_:
            continue
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        faces = cascade.detectMultiScale(gray, 1.1, 4)
        if len(faces) > 0:
            x, y, w, h = max(faces, key=lambda r: r[2] * r[3])
            boxes.append((
                (x + w / 2) / fw_, (y + h / 2) / fh_, (w * h) / (fw_ * fh_),
                x / fw_, y / fh_, w / fw_, h / fh_,
            ))

    cap.release()

    if not boxes:
        return result

    med = lambda idx: statistics.median([b[idx] for b in boxes])
    cx, cy, area = med(0), med(1), med(2)
    result["face_center"] = (cx, cy)
    result["face_area_ratio"] = area
    result["face_box"] = (med(3), med(4), med(5), med(6))

    # Small face (<15% of the frame) parked in a corner => gaming facecam.
    in_corner = (cx < 0.35 or cx > 0.65) and (cy < 0.35 or cy > 0.65)
    if area < 0.15 and in_corner:
        result["mode"] = "gaming"

    return result


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


def calculate_ass_styles(width: int, height: int):
    """Calculates proportional font sizes based on video dimensions."""
    is_vertical = height > width
    if is_vertical:
        # For vertical videos (9:16), font size should relate to width, but bounded
        font_size = max(14, round(width * 0.055))
        margin_v = max(20, round(height * 0.15))
    else:
        # For landscape (16:9), width is huge, so font size should relate to height
        font_size = max(14, round(height * 0.065))
        margin_v = max(20, round(height * 0.08))
        
    outline = max(1, round(font_size * 0.08))
    shadow = outline
    margin_h = max(20, round(width * 0.05))
    return font_size, outline, shadow, margin_h, margin_v


def srt_to_ass(srt_text: str, width: int, height: int) -> str:
    """Convert SRT text to an ASS subtitle with an explicit script resolution.

    Burning an SRT directly makes libass assume a default script size, so the
    same FontSize renders wildly different (often huge) depending on the build.
    Pinning PlayResX/Y to the actual clip and sizing the font as a fraction of
    clip height keeps captions a sensible, consistent size.
    """
    width = int(width) or 1080
    height = int(height) or 1920
    
    font_size, outline, shadow, margin_h, margin_v = calculate_ass_styles(width, height)

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


def chunk_words_smartly(clip_words, max_chars=25):
    chunks = []
    current_chunk = []
    current_len = 0
    
    for w in clip_words:
        word_len = len(w["word"])
        if current_len + word_len > max_chars and current_chunk:
            chunks.append(current_chunk)
            current_chunk = [w]
            current_len = word_len
        else:
            current_chunk.append(w)
            current_len += word_len + 1 # +1 for space
            
    if current_chunk:
        chunks.append(current_chunk)
    return chunks


def words_to_karaoke_ass(words: list, width: int, height: int, clip_start: float, clip_end: float) -> str:
    """Convert word-level timestamps to Karaoke ASS format for a specific clip."""
    width = int(width) or 1080
    height = int(height) or 1920
    
    font_size, outline, shadow, margin_h, margin_v = calculate_ass_styles(width, height)

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

    # Chunk words into lines logically based on character limits
    chunks = chunk_words_smartly(clip_words, max_chars=25)

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


def build_split_screen_filter(face_box, src_w: int, src_h: int, out_w: int, out_h: int,
                              in_label: str = "0:v", out_label: str = "main") -> str:
    """Build a filter_complex chain that stacks gameplay over a zoomed facecam.

    Top half: the gameplay, scaled to *cover* the top of the canvas (centred,
    overflow cropped — no distortion). Bottom half: the detected facecam box
    (padded for headroom, clamped in-frame), zoomed to cover the bottom half.

    Returns a chain ending in ``[out_label]`` sized ``out_w`` x (2*half), or
    ``None`` if inputs are unusable so the caller can fall back to a plain crop.
    """
    if not face_box or not src_w or not src_h or not out_w or not out_h:
        return None

    cw = (int(out_w) // 2) * 2
    half = (int(out_h) // 2 // 2) * 2  # even half-height
    if cw <= 0 or half <= 0:
        return None

    fx, fy, fw, fh = face_box
    PAD = 1.6
    bw = min(1.0, max(0.0, fw) * PAD)
    bh = min(1.0, max(0.0, fh) * PAD)
    if bw <= 0 or bh <= 0:
        return None
    bcx = fx + fw / 2
    bcy = fy + fh / 2
    bx = min(max(0.0, bcx - bw / 2), 1.0 - bw)
    by = min(max(0.0, bcy - bh / 2), 1.0 - bh)

    px = (int(bx * src_w) // 2) * 2
    py = (int(by * src_h) // 2) * 2
    pw = max(2, (int(bw * src_w) // 2) * 2)
    ph = max(2, (int(bh * src_h) // 2) * 2)
    if px + pw > src_w:
        pw = (int(src_w - px) // 2) * 2
    if py + ph > src_h:
        ph = (int(src_h - py) // 2) * 2
    if pw <= 0 or ph <= 0:
        return None

    return (
        f"[{in_label}]split=2[g0][f0];"
        f"[g0]scale={cw}:{half}:force_original_aspect_ratio=increase,crop={cw}:{half}[game];"
        f"[f0]crop={pw}:{ph}:{px}:{py},scale={cw}:{half}:force_original_aspect_ratio=increase,crop={cw}:{half}[face];"
        f"[game][face]vstack=inputs=2[{out_label}];"
    )


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
                     register_proc=None, should_cancel=None, broll_path: str = None,
                     layout: dict = None) -> str:
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

    # Layout: when the caller supplies one (computed once per job) we reuse its
    # face position and gaming classification instead of re-detecting per clip.
    gaming = False
    face_box = None
    if layout is None:
        center_pct = detect_primary_face_center(input_path, start_time=start_s, end_time=end_s)
    else:
        cx = (layout.get("face_center") or (0.5, 0.5))[0]
        _sw, _sh = _video_dims(input_path)
        if _sw and _sh:
            half_window = (_sh * 9 / 16) / _sw / 2
            lo, hi = half_window, 1 - half_window
            cx = max(lo, min(hi, cx)) if lo <= hi else cx
        center_pct = cx
        # Split-screen only makes sense for the 9:16 target (see design spec).
        gaming = aspect_ratio == "9:16" and layout.get("mode") == "gaming" and bool(layout.get("face_box"))
        face_box = layout.get("face_box")

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
            # Normalize path for FFmpeg, replacing \ with / and escaping it
            ass_name = os.path.basename(clip_ass_path).replace('\\', '/')
            # Escape colons, brackets, and quotes in the path
            escaped_ass_name = ass_name.replace(":", "\\\\:").replace("'", "\\\\'")
            subtitle_vf = f"{crop_filter},ass='{escaped_ass_name}'"

    def build_cmd(use_split: bool = False):
        cmd = [
            "ffmpeg", "-y",
            "-ss", f"{start_s:.3f}",
            "-i", input_path
        ]

        if broll_path and os.path.exists(broll_path):
            cmd.extend(["-i", broll_path])

        cmd.extend(["-t", f"{duration:.3f}"])

        # Build filter_complex
        src_w, src_h = _video_dims(input_path)
        out_w = output_width(aspect_ratio, src_w, src_h)
        out_h = int(src_w * 9 / 16) if aspect_ratio == "16:9" else src_h

        if out_w == 0 or out_h == 0:
            out_w, out_h = 1080, 1920 # fallback

        split_fc = build_split_screen_filter(face_box, src_w, src_h, out_w, out_h) if use_split else None
        fc = split_fc if split_fc else f"[0:v]{crop_filter}[main];"
        current_v = "[main]"
        
        audio_map = "0:a"
        if broll_path and os.path.exists(broll_path):
            # 1. Scale/crop B-Roll to exact output dimensions
            # 2. Apply a slow zoom-in using zoompan (z='1+0.05*time')
            fc += f"[1:v]scale={out_w}:{out_h}:force_original_aspect_ratio=increase,crop={out_w}:{out_h},zoompan=z='1+0.05*time':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':fps=30:s={out_w}x{out_h}[broll];"
            fc += f"{current_v}[broll]overlay=0:0:enable='between(t,0,3)'[v1];"
            current_v = "[v1]"
            
            # Generate synthetic "pop" SFX
            fc += f"aevalsrc='0.3*sin(1200*2*PI*t)*exp(-t*15)':d=0.15[pop1];"
            fc += f"aevalsrc='0.3*sin(1000*2*PI*t)*exp(-t*15)':d=0.15[pop2];"
            fc += f"[pop1]adelay=0|0[sfx1];"
            fc += f"[pop2]adelay=2800|2800[sfx2];"
            fc += f"[0:a][sfx1][sfx2]amix=inputs=3:duration=first:dropout_transition=0[aout];"
            audio_map = "[aout]"
            
        if subtitle_vf is not None:
            # ass_name and escaped_ass_name are already defined in the outer scope
            fc += f"{current_v}ass='{escaped_ass_name}'[vout]"
        else:
            fc += f"{current_v}null[vout]"
            
        cmd.extend([
            "-filter_complex", fc,
            "-map", "[vout]",
            "-map", audio_map,
            "-c:v", "libx264",
            "-pix_fmt", "yuv420p",
            "-preset", "veryfast",
            "-c:a", "aac",
            "-movflags", "+faststart",
            output_path
        ])
        return cmd

    if should_cancel and should_cancel():
        raise RuntimeError("Dibatalkan oleh pengguna.")

    ok, err = _run_ffmpeg(build_cmd(use_split=gaming), cwd=subtitle_cwd, register=register_proc)

    # Gaming split-screen is best-effort: if the complex filter fails, retry with
    # the plain centred crop so the job still produces a clip.
    if not ok and gaming:
        print(f"split-screen ffmpeg failed, falling back to standard crop. Error: {err[-800:]}")
        ok, err = _run_ffmpeg(build_cmd(use_split=False), cwd=subtitle_cwd, register=register_proc)

    # If the user just cancelled, throw error.
    if should_cancel and should_cancel():
        raise RuntimeError("Dibatalkan oleh pengguna.")
        
    if not ok:
        # Fallback to plain crop if complex filter fails (e.g., subtitle issues)
        if subtitle_vf is not None:
            print(f"ffmpeg complex failed, falling back to plain crop. Error: {err[-800:]}")
            fallback_cmd = [
                "ffmpeg", "-y",
                "-ss", f"{start_s:.3f}",
                "-i", input_path,
                "-t", f"{duration:.3f}",
                "-vf", subtitle_vf if subtitle_vf is not None else crop_filter,
                "-c:v", "libx264",
                "-pix_fmt", "yuv420p",
                "-preset", "veryfast",
                "-c:a", "aac",
                "-movflags", "+faststart",
                output_path,
            ]
            ok2, err2 = _run_ffmpeg(fallback_cmd, register=register_proc)
            if not ok2:
                raise RuntimeError(f"ffmpeg fallback failed: {err2[-800:]}")
            return output_path
        else:
            raise RuntimeError(f"ffmpeg failed: {err[-800:]}")
            
    return output_path
