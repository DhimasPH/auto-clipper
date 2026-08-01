# Dynamic Speaker Tracking Crop & Cumulative Karaoke Subtitles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement dynamic smooth speaker tracking cropping across portrait/square/vertical aspect ratios and cumulative word-by-word highlight karaoke subtitles without screen flickering.

**Architecture:**
- **Cumulative Karaoke Subtitles**: Update `words_to_karaoke_ass` in `backend/crop_utils.py` to group words into short phrase chunks, emit cumulative line reveals with the active word in yellow (`{\c&H00FFFF&}`), bridge inter-word time gaps to prevent flickering, and clamp minimum word display durations.
- **Dynamic Speaker Tracking Crop**: Add temporal multi-frame face sampling (`detect_face_trajectory`), exponential smoothing (`smooth_trajectory`), and FFmpeg per-frame evaluation expressions in `build_crop_filter` so the camera smoothly pans to track active speakers.

**Tech Stack:** Python 3.11+, OpenCV (`cv2`), FFmpeg, ASS subtitles (libass), pytest.

---

### Task 1: Refactor & Implement Cumulative Karaoke Subtitles

**Files:**
- Modify: `backend/crop_utils.py:389-477`
- Test: `backend/tests/test_crop_utils.py`

- [ ] **Step 1: Write the failing test for cumulative karaoke subtitles**

Add tests to `backend/tests/test_crop_utils.py`:
```python
def test_words_to_karaoke_ass_cumulative_and_continuous():
    from backend.crop_utils import words_to_karaoke_ass
    words = [
        {"word": "Halo", "start": 1.0, "end": 1.4},
        {"word": "semua", "start": 1.5, "end": 2.0},
        {"word": "selamat", "start": 2.2, "end": 2.6},
        {"word": "datang", "start": 2.7, "end": 3.2},
    ]
    # Clip window from 0.0 to 4.0
    ass = words_to_karaoke_ass(words, 1080, 1920, clip_start=0.0, clip_end=4.0)
    assert "PlayResX: 1080" in ass
    assert "PlayResY: 1920" in ass
    # Must contain dialogues
    assert "Dialogue:" in ass
    
    # First dialogue should display first word highlighted in yellow
    assert r"{\c&H00FFFF&}Halo{\c}" in ass
    # Second dialogue should show "Halo" in white (no tag) and "semua" in yellow
    assert r"Halo {\c&H00FFFF&}semua{\c}" in ass
    # Gaps between 1.4 and 1.5 should be bridged so the line doesn't disappear
    assert "0:00:01.00" in ass
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest backend/tests/test_crop_utils.py::test_words_to_karaoke_ass_cumulative_and_continuous -v`
Expected: FAIL (because current implementation displays all words at once or does not build cumulatively).

- [ ] **Step 3: Implement cumulative karaoke subtitle generator**

Update `words_to_karaoke_ass` in `backend/crop_utils.py`:
```python
def chunk_words_smartly(clip_words, max_words=5, max_chars=28):
    """Chunks words into phrases based on word count, character count, or punctuation."""
    chunks = []
    current_chunk = []
    current_len = 0
    
    for w in clip_words:
        word_text = w["word"].strip()
        word_len = len(word_text)
        is_punct = word_text.endswith(('.', '?', '!', ',', ';'))
        
        if (len(current_chunk) >= max_words or (current_len + word_len > max_chars and current_chunk)):
            chunks.append(current_chunk)
            current_chunk = [w]
            current_len = word_len
        else:
            current_chunk.append(w)
            current_len += word_len + 1
            
        if is_punct and len(current_chunk) >= 2:
            chunks.append(current_chunk)
            current_chunk = []
            current_len = 0
            
    if current_chunk:
        chunks.append(current_chunk)
    return chunks


def words_to_karaoke_ass(words: list, width: int, height: int, clip_start: float, clip_end: float) -> str:
    """Convert word-level timestamps to cumulative word-by-word Karaoke ASS format."""
    width = int(width) or 1080
    height = int(height) or 1920
    
    font_size, outline, shadow, margin_h, margin_v = calculate_ass_styles(width, height)
    # Give strong outline and shadow for high contrast
    outline = max(2, outline)
    shadow = max(2, shadow)

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
    
    # Filter and rebase words to clip window
    clip_words = []
    for w in words:
        w_start = float(w.get("start", 0))
        w_end = float(w.get("end", 0))
        if w_start < clip_end and w_end > clip_start:
            s = max(0.0, w_start - clip_start)
            e = min(clip_end - clip_start, w_end - clip_start)
            if e > s:
                clip_words.append({"word": str(w.get("word", "")).strip(), "start": s, "end": e})

    if not clip_words:
        return header

    chunks = chunk_words_smartly(clip_words)

    for chunk in chunks:
        if not chunk:
            continue
            
        chunk_len = len(chunk)
        for i in range(chunk_len):
            curr_word = chunk[i]
            w_start = curr_word["start"]
            
            # Bridge to next word in the chunk if gap is small (< 0.5s) to avoid flickering
            if i < chunk_len - 1:
                next_start = chunk[i+1]["start"]
                w_end = next_start if (next_start - curr_word["end"]) < 0.5 else curr_word["end"]
            else:
                # Last word in chunk stays on screen for a short hold period (350ms)
                w_end = min(clip_end - clip_start, curr_word["end"] + 0.35)
                
            # Enforce minimum word highlight visibility (at least 180ms)
            if w_end - w_start < 0.18:
                w_end = w_start + 0.18
                
            # Build cumulative text: words 0..i-1 are white, word i is yellow
            parts = []
            for j in range(i + 1):
                word_str = chunk[j]["word"]
                if j == i:
                    parts.append(f"{{\\c&H00FFFF&}}{word_str}{{\\c}}")
                else:
                    parts.append(word_str)
                    
            text = " ".join(parts)
            events.append(
                f"Dialogue: 0,{_fmt_ass_ts(w_start)},{_fmt_ass_ts(w_end)},Default,,0,0,0,,{text}"
            )
            
    return header + "\n".join(events) + ("\n" if events else "")
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest backend/tests/test_crop_utils.py::test_words_to_karaoke_ass_cumulative_and_continuous -v`
Expected: PASS

- [ ] **Step 5: Commit changes**

Check `.agent/config.yml` for `auto_commit` setting.
If `auto_commit: true` (default):
```bash
git add backend/crop_utils.py backend/tests/test_crop_utils.py
git commit -m "feat(subtitles): implement cumulative word-by-word karaoke subtitle styling"
```

---

### Task 2: Implement Temporal Face Tracking & Smooth Panning

**Files:**
- Modify: `backend/crop_utils.py:56-118, 518-535`
- Test: `backend/tests/test_crop_utils.py`

- [ ] **Step 1: Write the failing tests for dynamic trajectory and crop filter**

Add tests to `backend/tests/test_crop_utils.py`:
```python
def test_smooth_trajectory():
    from backend.crop_utils import smooth_trajectory
    raw_points = [(0.0, 0.2), (1.0, 0.8), (2.0, 0.8), (3.0, 0.2)]
    smoothed = smooth_trajectory(raw_points, alpha=0.3)
    assert len(smoothed) == len(raw_points)
    assert smoothed[0][1] == 0.2
    # Second point should be smoothed towards 0.8 without jumping directly to 0.8
    assert 0.2 < smoothed[1][1] < 0.8


def test_build_dynamic_crop_filter():
    from backend.crop_utils import build_crop_filter
    # Static center
    static_f = build_crop_filter("9:16", 0.5)
    assert "0.5" in static_f
    
    # Dynamic trajectory with multiple points
    trajectory = [(0.0, 0.4), (2.0, 0.6), (4.0, 0.5)]
    dynamic_f = build_crop_filter("9:16", trajectory)
    assert "between(t" in dynamic_f or "if(" in dynamic_f
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest backend/tests/test_crop_utils.py::test_smooth_trajectory backend/tests/test_crop_utils.py::test_build_dynamic_crop_filter -v`
Expected: FAIL (`smooth_trajectory` not found / signature mismatch).

- [ ] **Step 3: Implement temporal face sampling and dynamic crop filter**

In `backend/crop_utils.py`:
```python
def smooth_trajectory(points: list, alpha: float = 0.35) -> list:
    """Smooths a sequence of (time, center_pct) points using Exponential Moving Average."""
    if not points:
        return [(0.0, 0.5)]
    if len(points) == 1:
        return points
        
    smoothed = [points[0]]
    for i in range(1, len(points)):
        t, val = points[i]
        prev_val = smoothed[-1][1]
        smooth_val = alpha * val + (1.0 - alpha) * prev_val
        smoothed.append((t, smooth_val))
    return smoothed


def detect_face_trajectory(video_path: str, start_time=None, end_time=None, sample_interval: float = 0.5) -> list:
    """Sample face center positions periodically across the clip window."""
    face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
    if face_cascade.empty():
        return [(0.0, 0.5)]
        
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        cap.release()
        return [(0.0, 0.5)]

    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    dur = total_frames / fps if fps else 0.0

    s = to_seconds(start_time) if start_time is not None else 0.0
    e = to_seconds(end_time) if end_time is not None else dur
    if e <= s:
        e = s + 1.0

    points = []
    curr_t = s
    last_known_x = 0.5
    
    while curr_t <= e:
        cap.set(cv2.CAP_PROP_POS_MSEC, curr_t * 1000.0)
        ret, frame = cap.read()
        rel_t = curr_t - s
        if ret and frame is not None and frame.shape[1] > 0:
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            faces = face_cascade.detectMultiScale(gray, 1.1, 4)
            if len(faces) > 0:
                x, y, w, h = max(faces, key=lambda rect: rect[2] * rect[3])
                last_known_x = (x + w / 2) / frame.shape[1]
        points.append((rel_t, last_known_x))
        curr_t += sample_interval

    cap.release()
    if not points:
        return [(0.0, 0.5)]
    return smooth_trajectory(points)


def build_crop_filter(aspect_ratio: str, center) -> str:
    """Build FFmpeg crop filter, supporting static float or dynamic trajectory [(t, x)]."""
    if aspect_ratio == "16:9":
        return "crop=iw:trunc(iw*9/16/2)*2:0:(ih-trunc(iw*9/16/2)*2)/2"

    # For dynamic trajectory
    if isinstance(center, list) and len(center) > 1:
        # Build piecewise interpolation expression for x
        # x(t) = x0 + (x1-x0)*(t-t0)/(t1-t0)
        parts = []
        for i in range(len(center) - 1):
            t0, x0 = center[i]
            t1, x1 = center[i+1]
            dt = max(0.001, t1 - t0)
            dx = x1 - x0
            part = f"if(between(t,{t0:.2f},{t1:.2f}),{x0:.4f}+({dx:.4f})*(t-{t0:.2f})/{dt:.2f}"
            parts.append(part)
        last_x = center[-1][1]
        # Chain closing parens and fallback
        x_expr = "".join(parts) + f",{last_x:.4f}" + (")" * len(parts))
        
        if aspect_ratio == "1:1":
            return f"crop=trunc(ih/2)*2:ih:max(0\\,min(iw-ih\\,iw*({x_expr})-ih/2)):0"
        elif aspect_ratio == "4:5":
            return f"crop=trunc(ih*4/5/2)*2:ih:max(0\\,min(iw-ih*4/5\\,iw*({x_expr})-ih*4/10)):0"
        else: # 9:16
            return f"crop=trunc(ih*9/16/2)*2:ih:max(0\\,min(iw-ih*9/16\\,iw*({x_expr})-ih*9/32)):0"
            
    # Static float center
    center_pct = center[0][1] if isinstance(center, list) else float(center)
    if aspect_ratio == "1:1":
        return f"crop=trunc(ih/2)*2:ih:max(0\\,min(iw-ih\\,iw*{center_pct:.4f}-ih/2)):0"
    elif aspect_ratio == "4:5":
        return f"crop=trunc(ih*4/5/2)*2:ih:max(0\\,min(iw-ih*4/5\\,iw*{center_pct:.4f}-ih*4/10)):0"
    else:  # 9:16 default
        return f"crop=trunc(ih*9/16/2)*2:ih:max(0\\,min(iw-ih*9/16\\,iw*{center_pct:.4f}-ih*9/32)):0"
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest backend/tests/test_crop_utils.py -v`
Expected: PASS

- [ ] **Step 5: Commit changes**

Check `.agent/config.yml` for `auto_commit` setting.
If `auto_commit: true`:
```bash
git add backend/crop_utils.py backend/tests/test_crop_utils.py
git commit -m "feat(crop): implement temporal face tracking and dynamic panning filter"
```

---

### Task 3: Integrate Dynamic Cropping into `crop_to_vertical` and Update Pipeline

**Files:**
- Modify: `backend/crop_utils.py:633-652`
- Test: `backend/tests/test_crop_utils.py`

- [ ] **Step 1: Write test for dynamic crop integration in `crop_to_vertical`**

Add test in `backend/tests/test_crop_utils.py`:
```python
@patch('backend.crop_utils.subprocess.Popen')
@patch('backend.crop_utils.detect_face_trajectory')
def test_crop_to_vertical_uses_dynamic_trajectory(mock_trajectory, mock_popen):
    mock_trajectory.return_value = [(0.0, 0.3), (2.0, 0.7)]
    mock_popen.return_value = _fake_proc(0)
    
    res = crop_to_vertical("in.mp4", "out.mp4", "00:00:00", "00:00:05", aspect_ratio="9:16")
    assert res == "out.mp4"
    mock_popen.assert_called_once()
    cmd = mock_popen.call_args[0][0]
    # Check that filter_complex contains the dynamic crop expression
    fc_idx = cmd.index("-filter_complex")
    fc = cmd[fc_idx + 1]
    assert "between(t" in fc
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest backend/tests/test_crop_utils.py::test_crop_to_vertical_uses_dynamic_trajectory -v`
Expected: FAIL (currently calls `detect_primary_face_center`).

- [ ] **Step 3: Update `crop_to_vertical` in `backend/crop_utils.py`**

Modify `crop_to_vertical` in `backend/crop_utils.py`:
```python
    # Layout & Face tracking:
    gaming = False
    face_box = None
    if layout is None:
        center_trajectory = detect_face_trajectory(input_path, start_time=start_s, end_time=end_s)
    else:
        cx = (layout.get("face_center") or (0.5, 0.5))[0]
        center_trajectory = cx
        gaming = aspect_ratio == "9:16" and layout.get("mode") == "gaming" and bool(layout.get("face_box"))
        face_box = layout.get("face_box")

    # Calculate crop dimensions and filter based on aspect ratio
    crop_filter = build_crop_filter(aspect_ratio, center_trajectory)
```

- [ ] **Step 4: Run full test suite to verify everything passes**

Run: `pytest backend/tests/test_crop_utils.py -v`
Expected: All tests PASS.

- [ ] **Step 5: Commit changes**

Check `.agent/config.yml` for `auto_commit` setting.
If `auto_commit: true`:
```bash
git add backend/crop_utils.py backend/tests/test_crop_utils.py
git commit -m "feat: wire dynamic face tracking trajectory into crop_to_vertical"
```

---

### Task 4: Complete Pipeline Test Verification

**Files:**
- Test: `backend/tests/`

- [ ] **Step 1: Run complete backend pytest suite**

Run: `pytest backend/tests/ -v`
Expected: All backend unit tests pass without regressions.

- [ ] **Step 2: Commit any final test updates**

```bash
git status
```
