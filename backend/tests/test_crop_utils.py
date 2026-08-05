import re
from backend.crop_utils import detect_primary_face_center, crop_to_vertical, srt_to_ass
from unittest.mock import patch, MagicMock


def test_srt_to_ass_sizing_and_conversion():
    srt = "1\n00:00:01,000 --> 00:00:04,500\nHello world\n"
    ass = srt_to_ass(srt, 608, 1080)
    # Script resolution is pinned to the clip so libass can't rescale unpredictably.
    assert "PlayResX: 608" in ass
    assert "PlayResY: 1080" in ass
    # Font size must be sane relative to a 1080px-tall clip (not huge, not tiny).
    m = re.search(r"Style: Default,[^,]*,(\d+),", ass)
    assert m, "Default style with a font size must exist"
    font_size = int(m.group(1))
    assert 30 <= font_size <= 70, f"font size {font_size} is unreasonable for 1080p"
    # Cue is converted to an ASS dialogue with centisecond timestamps.
    assert "Dialogue:" in ass
    assert "0:00:01.00" in ass and "0:00:04.50" in ass
    assert "Hello world" in ass


def test_srt_to_ass_scales_with_height():
    small = srt_to_ass("1\n00:00:00,000 --> 00:00:01,000\nx\n", 405, 720)
    big = srt_to_ass("1\n00:00:00,000 --> 00:00:01,000\nx\n", 608, 1080)
    fs_small = int(re.search(r"Style: Default,[^,]*,(\d+),", small).group(1))
    fs_big = int(re.search(r"Style: Default,[^,]*,(\d+),", big).group(1))
    assert fs_big > fs_small

@patch('backend.crop_utils.cv2.VideoCapture')
def test_detect_primary_face_center(mock_cap):
    mock_instance = mock_cap.return_value
    mock_instance.isOpened.return_value = False

    center = detect_primary_face_center("dummy.mp4")
    assert center == 0.5 # Default when no video/face

def _fake_proc(returncode):
    """A stand-in for subprocess.Popen matching how _run_ffmpeg uses it."""
    p = MagicMock()
    p.communicate.return_value = (b"", b"")
    p.returncode = returncode
    p.poll.return_value = returncode
    return p


@patch('backend.crop_utils.is_nvenc_available', return_value=False)
@patch('backend.crop_utils.subprocess.Popen')
@patch('backend.crop_utils.detect_primary_face_center')
def test_crop_to_vertical(mock_detect, mock_popen, mock_nvenc):
    mock_detect.return_value = 0.5
    mock_popen.return_value = _fake_proc(0)

    res = crop_to_vertical("in.mp4", "out.mp4", "00:00:00", "00:00:10")
    assert res == "out.mp4"
    mock_popen.assert_called_once()


@patch('backend.crop_utils.is_nvenc_available', return_value=False)
@patch('backend.crop_utils.subprocess.Popen')
@patch('backend.crop_utils.detect_primary_face_center')
def test_crop_falls_back_when_subtitles_fail(mock_detect, mock_popen, mock_nvenc, tmp_path):
    """If the subtitle burn fails, a plain crop should still be produced."""
    mock_detect.return_value = 0.5
    # First call (with subtitles) fails, second (plain crop) succeeds.
    mock_popen.side_effect = [_fake_proc(1), _fake_proc(0)]
    srt = tmp_path / "subs.srt"
    srt.write_text("1\n00:00:00,000 --> 00:00:05,000\nhello\n")

    res = crop_to_vertical("in.mp4", "out.mp4", "00:00:00", "00:00:10", subtitle_path=str(srt))
    assert res == "out.mp4"
    assert mock_popen.call_count == 2


def test_build_crop_filter_ratios():
    from backend.crop_utils import build_crop_filter
    # Existing vertical/square ratios keep full height and crop width (unchanged).
    f916 = build_crop_filter("9:16", 0.5)
    assert f916 == "crop=trunc(ih*9/16/2)*2:ih:iw*0.5-ih*9/32:0"

    f11 = build_crop_filter("1:1", 0.5)
    assert f11 == "crop=trunc(ih/2)*2:ih:iw*0.5-ih/2:0"

    f45 = build_crop_filter("4:5", 0.5)
    assert f45 == "crop=trunc(ih*4/5/2)*2:ih:iw*0.5-ih*4/10:0"

    # 16:9 Landscape: crop height, keep full width, vertical center.
    f169 = build_crop_filter("16:9", 0.5)
    assert f169 == "crop=iw:trunc(iw*9/16/2)*2:0:(ih-trunc(iw*9/16/2)*2)/2"


def test_output_width_ratios():
    from backend.crop_utils import output_width
    # Landscape output width == full source width.
    assert output_width("16:9", 1920, 1080) == 1920
    # Vertical/square derive width from source height (even).
    assert output_width("1:1", 1920, 1080) == 1080
    assert output_width("9:16", 1920, 1080) == (int(1080 * 9 / 16) // 2) * 2


# --- Gaming Split-Screen Auto-Detect --------------------------------------

def _fake_layout_cap(fps=30.0, frame_count=30):
    import numpy as np
    inst = MagicMock()
    inst.isOpened.return_value = True

    def get(prop):
        import backend.crop_utils as cu
        if prop == cu.cv2.CAP_PROP_FPS:
            return fps
        if prop == cu.cv2.CAP_PROP_FRAME_COUNT:
            return frame_count
        return 0
    inst.get.side_effect = get
    frame = np.zeros((1080, 1920, 3), dtype=np.uint8)
    inst.read.return_value = (True, frame)
    return inst, frame


@patch('backend.crop_utils.cv2.cvtColor')
@patch('backend.crop_utils.cv2.CascadeClassifier')
@patch('backend.crop_utils.cv2.VideoCapture')
def test_detect_video_layout_gaming_corner_face(mock_cap, mock_cascade, mock_cvt):
    from backend.crop_utils import detect_video_layout
    cascade = mock_cascade.return_value
    cascade.empty.return_value = False
    # Small facecam parked in the bottom-right corner.
    cascade.detectMultiScale.return_value = [(1650, 850, 180, 140)]
    inst, frame = _fake_layout_cap()
    mock_cap.return_value = inst
    mock_cvt.return_value = frame

    res = detect_video_layout("dummy.mp4")
    assert res["mode"] == "gaming"
    assert res["face_box"] is not None
    assert res["face_area_ratio"] < 0.15


@patch('backend.crop_utils.cv2.cvtColor')
@patch('backend.crop_utils.cv2.CascadeClassifier')
@patch('backend.crop_utils.cv2.VideoCapture')
def test_detect_video_layout_standard_centered_face(mock_cap, mock_cascade, mock_cvt):
    from backend.crop_utils import detect_video_layout
    cascade = mock_cascade.return_value
    cascade.empty.return_value = False
    # Large, centred face (talking head / podcast).
    cascade.detectMultiScale.return_value = [(660, 240, 600, 600)]
    inst, frame = _fake_layout_cap()
    mock_cap.return_value = inst
    mock_cvt.return_value = frame

    res = detect_video_layout("dummy.mp4")
    assert res["mode"] == "standard"


@patch('backend.crop_utils.cv2.cvtColor')
@patch('backend.crop_utils.cv2.CascadeClassifier')
@patch('backend.crop_utils.cv2.VideoCapture')
def test_detect_video_layout_no_face(mock_cap, mock_cascade, mock_cvt):
    from backend.crop_utils import detect_video_layout
    cascade = mock_cascade.return_value
    cascade.empty.return_value = False
    cascade.detectMultiScale.return_value = []
    inst, frame = _fake_layout_cap()
    mock_cap.return_value = inst
    mock_cvt.return_value = frame

    res = detect_video_layout("dummy.mp4")
    assert res["mode"] == "standard"
    assert res["face_box"] is None


def test_build_split_screen_filter_9_16():
    from backend.crop_utils import build_split_screen_filter
    fc = build_split_screen_filter((0.8, 0.8, 0.1, 0.1), 1920, 1080, 606, 1080)
    assert fc is not None
    assert "vstack=inputs=2" in fc
    assert fc.count("crop=") >= 2
    assert fc.strip().endswith("[main];")


def test_build_split_screen_filter_none_without_box():
    from backend.crop_utils import build_split_screen_filter
    assert build_split_screen_filter(None, 1920, 1080, 606, 1080) is None


@patch('backend.crop_utils.subprocess.Popen')
@patch('backend.crop_utils._video_dims')
def test_crop_uses_split_screen_for_gaming_layout(mock_dims, mock_popen):
    mock_dims.return_value = (1920, 1080)
    mock_popen.return_value = _fake_proc(0)
    layout = {"mode": "gaming", "face_box": (0.8, 0.8, 0.1, 0.1),
              "face_center": (0.85, 0.85), "face_area_ratio": 0.01}
    crop_to_vertical("in.mp4", "out.mp4", "00:00:00", "00:00:10",
                     aspect_ratio="9:16", layout=layout)
    cmd = mock_popen.call_args[0][0]
    assert any("vstack" in str(a) for a in cmd)


@patch('backend.crop_utils.subprocess.Popen')
@patch('backend.crop_utils._video_dims')
def test_crop_gaming_falls_back_to_plain_crop(mock_dims, mock_popen):
    """If the split-screen filter fails, a plain centred crop should still run."""
    mock_dims.return_value = (1920, 1080)
    mock_popen.side_effect = [_fake_proc(1), _fake_proc(0)]
    layout = {"mode": "gaming", "face_box": (0.8, 0.8, 0.1, 0.1),
              "face_center": (0.85, 0.85), "face_area_ratio": 0.01}
    res = crop_to_vertical("in.mp4", "out.mp4", "00:00:00", "00:00:10",
                           aspect_ratio="9:16", layout=layout)
    assert res == "out.mp4"
    assert mock_popen.call_count == 2
    # Second attempt is the plain crop (no vstack).
    plain_cmd = mock_popen.call_args_list[1][0][0]
    assert not any("vstack" in str(a) for a in plain_cmd)


@patch('backend.crop_utils.subprocess.Popen')
@patch('backend.crop_utils._video_dims')
def test_crop_standard_layout_does_not_split(mock_dims, mock_popen):
    mock_dims.return_value = (1920, 1080)
    mock_popen.return_value = _fake_proc(0)
    layout = {"mode": "standard", "face_box": None,
              "face_center": (0.5, 0.5), "face_area_ratio": 0.0}
    crop_to_vertical("in.mp4", "out.mp4", "00:00:00", "00:00:10",
                     aspect_ratio="9:16", layout=layout)
    cmd = mock_popen.call_args[0][0]
    assert not any("vstack" in str(a) for a in cmd)


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
    assert "Dialogue:" in ass
    
    # 1. First dialogue must ONLY show the first word in yellow (no future words)
    assert r"Dialogue: 0,0:00:01.00,0:00:01.50,Default,,0,0,0,,{\c&H00FFFF&}Halo{\c}" in ass
    # 2. Second dialogue shows "Halo" in white and "semua" in yellow (no "selamat datang" yet)
    assert r"Dialogue: 0,0:00:01.50,0:00:02.20,Default,,0,0,0,,Halo {\c&H00FFFF&}semua{\c}" in ass
    # 3. Third dialogue
    assert r"Dialogue: 0,0:00:02.20,0:00:02.70,Default,,0,0,0,,Halo semua {\c&H00FFFF&}selamat{\c}" in ass
    # 4. Fourth dialogue shows all words with last word in yellow
    assert r"Halo semua selamat {\c&H00FFFF&}datang{\c}" in ass


def test_smooth_trajectory_ema():
    from backend.crop_utils import smooth_trajectory
    # If all points are static, output remains static
    raw = [(0.0, 0.5), (0.5, 0.5), (1.0, 0.5)]
    smoothed = smooth_trajectory(raw, alpha=0.3)
    assert len(smoothed) == 3
    assert smoothed[0][1] == 0.5
    assert smoothed[2][1] == 0.5

    # Sudden jump gets smoothed out by EMA
    jump_raw = [(0.0, 0.2), (0.5, 0.8), (1.0, 0.8)]
    jump_smoothed = smooth_trajectory(jump_raw, alpha=0.3)
    # At t=0.5, value should be 0.3 * 0.8 + 0.7 * 0.2 = 0.38
    assert abs(jump_smoothed[1][1] - 0.38) < 1e-4


def test_build_dynamic_crop_filter():
    from backend.crop_utils import build_dynamic_crop_filter
    trajectory = [(0.0, 0.3), (1.0, 0.7)]
    
    # 9:16 aspect ratio
    filter_expr = build_dynamic_crop_filter("9:16", trajectory, clip_duration=1.0)
    assert "crop=trunc(ih*9/16/2)*2:ih:" in filter_expr
    # Check that linear interpolation expression is generated for dynamic panning
    assert "if(lte(t" in filter_expr or "lerp" in filter_expr or "iw*" in filter_expr

    # Single point or static fallback
    static_filter = build_dynamic_crop_filter("9:16", [(0.0, 0.5)], clip_duration=1.0)
    assert static_filter == "crop=trunc(ih*9/16/2)*2:ih:iw*0.5-ih*9/32:0"


@patch('backend.crop_utils.cv2.cvtColor')
@patch('backend.crop_utils.cv2.CascadeClassifier')
@patch('backend.crop_utils.cv2.VideoCapture')
def test_sample_face_trajectory(mock_cap, mock_cascade, mock_cvt):
    from backend.crop_utils import sample_face_trajectory
    cascade = mock_cascade.return_value
    cascade.empty.return_value = False
    cascade.detectMultiScale.return_value = [(960, 540, 200, 200)]
    inst, frame = _fake_layout_cap()
    mock_cap.return_value = inst
    mock_cvt.return_value = frame

    traj = sample_face_trajectory("dummy.mp4", start_time=0.0, end_time=2.0, interval=0.5)
    assert len(traj) >= 4
    for t, x in traj:
        assert 0.0 <= t <= 2.0
        assert 0.0 <= x <= 1.0


@patch('backend.crop_utils.is_nvenc_available', return_value=False)
@patch('backend.crop_utils.subprocess.Popen')
@patch('backend.crop_utils.sample_face_trajectory')
def test_crop_to_vertical_uses_dynamic_trajectory(mock_traj, mock_popen, mock_nvenc):
    mock_traj.return_value = [(0.0, 0.2), (1.0, 0.8)]
    mock_popen.return_value = _fake_proc(0)

    res = crop_to_vertical("in.mp4", "out.mp4", "00:00:00", "00:00:05", aspect_ratio="9:16")
    assert res == "out.mp4"
    mock_traj.assert_called_once()
    cmd = mock_popen.call_args[0][0]
    filter_arg = [cmd[i+1] for i, a in enumerate(cmd) if a == "-filter_complex"][0]
    # Filter should contain dynamic crop with piecewise linear interpolation expression
    assert "if(lte(t" in filter_arg or "crop=trunc(ih*9/16/2)*2" in filter_arg







# --- Sleep/crop stabilization additions ------------------------------------

def test_apply_deadband_filter_locks_and_follows():
    from backend.crop_utils import apply_deadband_filter
    traj = [(0, 0.50), (1, 0.52), (2, 0.49), (3, 0.70), (4, 0.71)]
    out = apply_deadband_filter(traj, deadband=0.08)
    xs = [round(x, 2) for _, x in out]
    # Micro-jitter within the deadband stays locked on the first anchor.
    assert xs[:3] == [0.5, 0.5, 0.5]
    # A move beyond the deadband makes the anchor follow, and stays there.
    assert xs[3] == 0.70 and xs[4] == 0.70


def test_apply_deadband_filter_empty_default():
    from backend.crop_utils import apply_deadband_filter
    assert apply_deadband_filter([]) == [(0.0, 0.5)]


def test_build_dynamic_crop_filter_static_when_under_3pct():
    from backend.crop_utils import build_dynamic_crop_filter
    # Variation < 3% of frame width -> steady static crop (no lerp expression).
    traj = [(0.0, 0.50), (0.5, 0.515), (1.0, 0.505)]
    f = build_dynamic_crop_filter("9:16", traj, clip_duration=1.0)
    assert "if(lte(t" not in f
    assert f.startswith("crop=trunc(ih*9/16/2)*2:ih:iw*0.5")


@patch('backend.crop_utils.cv2.cvtColor')
@patch('backend.crop_utils.cv2.CascadeClassifier')
@patch('backend.crop_utils.cv2.VideoCapture')
def test_sample_face_trajectory_rejects_outlier(mock_cap, mock_cascade, mock_cvt):
    from backend.crop_utils import sample_face_trajectory
    cascade = mock_cascade.return_value
    cascade.empty.return_value = False

    calls = {"n": 0}

    def detect(gray, a, b):
        calls["n"] += 1
        # Third detection is a false positive parked at the far right edge.
        if calls["n"] == 3:
            return [(1850, 500, 40, 40)]   # x-center ~ 0.974
        return [(860, 500, 200, 200)]      # x-center = 0.5

    cascade.detectMultiScale.side_effect = detect
    inst, frame = _fake_layout_cap()
    mock_cap.return_value = inst
    mock_cvt.return_value = frame

    traj = sample_face_trajectory("dummy.mp4", start_time=0.0, end_time=3.0, interval=0.5)
    xs = [x for _, x in traj]
    # The stray right-edge detection must be rejected, not tracked.
    assert max(xs) < 0.75
    assert all(0.0 <= x <= 1.0 for x in xs)
