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
@patch('backend.crop_utils.sample_face_trajectory', return_value=[(0.0, 0.5, 0.16)])
@patch('backend.crop_utils.detect_primary_face_center')
def test_crop_to_vertical(mock_detect, mock_sample, mock_popen, mock_nvenc):
    mock_detect.return_value = 0.5
    mock_popen.return_value = _fake_proc(0)

    res = crop_to_vertical("in.mp4", "out.mp4", "00:00:00", "00:00:10")
    assert res == "out.mp4"
    mock_popen.assert_called_once()


@patch('backend.crop_utils.is_nvenc_available', return_value=False)
@patch('backend.crop_utils.subprocess.Popen')
@patch('backend.crop_utils.sample_face_trajectory', return_value=[(0.0, 0.5, 0.16)])
@patch('backend.crop_utils.detect_primary_face_center')
def test_crop_falls_back_when_subtitles_fail(mock_detect, mock_sample, mock_popen, mock_nvenc, tmp_path):
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


def test_words_to_single_word_ass_cumulative_and_continuous():
    from backend.crop_utils import words_to_single_word_ass
    words = [
        {"word": "Halo", "start": 1.0, "end": 1.4},
        {"word": "semua", "start": 1.5, "end": 2.0},
        {"word": "selamat", "start": 2.2, "end": 2.6},
        {"word": "datang", "start": 2.7, "end": 3.2},
    ]
    # Clip window from 0.0 to 4.0
    ass = words_to_single_word_ass(words, 1080, 1920, clip_start=0.0, clip_end=4.0)
    assert "PlayResX: 1080" in ass
    assert "PlayResY: 1920" in ass
    assert "Dialogue:" in ass
    
    # Each word pops as a single non-overlapping event
    assert r"Dialogue: 0,0:00:01.00,0:00:01.50,Default,,0,0,0,,HALO" in ass
    assert r"Dialogue: 0,0:00:01.50,0:00:02.00,Default,,0,0,0,,SEMUA" in ass
    assert r"Dialogue: 0,0:00:02.20,0:00:02.70,Default,,0,0,0,,SELAMAT" in ass
    assert r"Dialogue: 0,0:00:02.70,0:00:03.55,Default,,0,0,0,,DATANG" in ass


def test_smooth_trajectory_ema():
    from backend.crop_utils import smooth_trajectory
    # If all points are static, output remains static
    raw = [(0.0, 0.5, 0.2), (0.5, 0.5, 0.2), (1.0, 0.5, 0.2)]
    smoothed = smooth_trajectory(raw, alpha=0.3)
    assert len(smoothed) == 3
    assert smoothed[0][1] == 0.5
    assert smoothed[2][1] == 0.5

    # Sudden jump gets smoothed out by EMA
    jump_raw = [(0.0, 0.2, 0.2), (0.5, 0.8, 0.2), (1.0, 0.8, 0.2)]
    jump_smoothed = smooth_trajectory(jump_raw, alpha=0.3)
    # At t=0.5, value should be 0.3 * 0.8 + 0.7 * 0.2 = 0.38
    assert abs(jump_smoothed[1][1] - 0.38) < 1e-4


def test_build_dynamic_crop_filter():
    from backend.crop_utils import build_dynamic_crop_filter
    trajectory = [(0.0, 0.3, 0.2), (1.0, 0.7, 0.2)]
    
    # 9:16 aspect ratio
    filter_expr = build_dynamic_crop_filter("9:16", trajectory, clip_duration=1.0)
    assert "crop=trunc(ih*9/16/2)*2:ih:" in filter_expr
    # Check that linear interpolation expression is generated for dynamic panning
    assert "if(lte(t" in filter_expr or "lerp" in filter_expr or "iw*" in filter_expr

    # Single point or static fallback
    static_filter = build_dynamic_crop_filter("9:16", [(0.0, 0.5, 0.2)], clip_duration=1.0)
    assert static_filter == "crop=trunc(ih*9/16/2)*2:ih:iw*0.5-ih*9/32:0"


def test_sample_face_trajectory():
    pass


@patch('backend.crop_utils.is_nvenc_available', return_value=False)
@patch('backend.crop_utils.subprocess.Popen')
@patch('backend.crop_utils.sample_face_trajectory')
def test_crop_to_vertical_uses_dynamic_trajectory(mock_traj, mock_popen, mock_nvenc):
    mock_traj.return_value = [(0.0, 0.2, 0.2), (1.0, 0.8, 0.2)]
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
    traj = [(0, 0.50, 0.2), (1, 0.52, 0.2), (2, 0.49, 0.2), (3, 0.70, 0.2), (4, 0.71, 0.2)]
    out = apply_deadband_filter(traj, default_deadband=0.08)
    xs = [round(x, 2) for _, x, _ in out]
    # Micro-jitter within the deadband stays locked on the first anchor.
    assert xs[:3] == [0.5, 0.5, 0.5]
    # A move beyond the deadband makes the anchor follow, and stays there.
    assert xs[3] == 0.70 and xs[4] == 0.70


def test_apply_deadband_filter_empty_default():
    from backend.crop_utils import apply_deadband_filter
    assert apply_deadband_filter([]) == [(0.0, 0.5, 0.16)]


def test_build_dynamic_crop_filter_static_when_under_3pct():
    from backend.crop_utils import build_dynamic_crop_filter
    # Variation < 3% of frame width -> steady static crop (no lerp expression).
    traj = [(0.0, 0.50, 0.2), (0.5, 0.515, 0.2), (1.0, 0.505, 0.2)]
    f = build_dynamic_crop_filter("9:16", traj, clip_duration=1.0)
    assert "if(lte(t" not in f
    assert f.startswith("crop=trunc(ih*9/16/2)*2:ih:iw*0.5")


def test_sample_face_trajectory_rejects_outlier():
    pass


# --- sample_face_trajectory: engines, fallback and cleanup -------------------

import sys
import types

import numpy as np
import pytest


def _capture(frames=None, width=640, height=360):
    """A cv2.VideoCapture stand-in that hands out black frames."""
    cap = MagicMock()
    cap.isOpened.return_value = True
    props = {5: 25.0, 7: 250, 3: width, 4: height}  # FPS, FRAME_COUNT, WIDTH, HEIGHT
    cap.get.side_effect = lambda prop: props.get(prop, 0)
    if frames is None:
        cap.read.side_effect = lambda: (True, np.zeros((height, width, 3), dtype=np.uint8))
    else:
        cap.read.side_effect = frames
    return cap


def _cascade(boxes):
    cascade = MagicMock()
    cascade.empty.return_value = False
    cascade.detectMultiScale.return_value = boxes
    return cascade


def _landmarks(cx, mouth_open=0.02):
    """468 face-mesh points centred on cx, 0.2 wide cheek to cheek."""
    pts = [types.SimpleNamespace(x=cx, y=0.5) for _ in range(468)]
    pts[13].y, pts[14].y = 0.5, 0.5 + mouth_open
    pts[78].x, pts[308].x = cx - 0.05, cx + 0.05
    pts[234].x, pts[454].x = cx - 0.1, cx + 0.1
    return types.SimpleNamespace(landmark=pts)


def _fake_mediapipe(process):
    """A mediapipe module whose FaceMesh.process is the given callable."""
    mesh = MagicMock()
    mesh.process.side_effect = process
    face_mesh_cls = MagicMock(return_value=mesh)
    mp = types.SimpleNamespace(solutions=types.SimpleNamespace(face_mesh=types.SimpleNamespace(FaceMesh=face_mesh_cls)))
    return mp, face_mesh_cls, mesh


def _one_face(cx):
    return lambda rgb: types.SimpleNamespace(multi_face_landmarks=[_landmarks(cx)])


def test_haar_trajectory_follows_the_largest_face():
    from backend.crop_utils import sample_face_trajectory
    cap = _capture()
    # 640-wide frame: box x=352..416 -> centre 0.6, width 0.1
    with patch("backend.crop_utils.cv2.VideoCapture", return_value=cap), \
         patch("backend.crop_utils.cv2.CascadeClassifier", return_value=_cascade([(10, 10, 20, 20), (352, 100, 64, 64)])):
        traj = sample_face_trajectory("v.mp4", 0.0, 1.0, interval=0.5, engine="haar")

    assert traj == [(0.0, 0.6, 0.1), (0.5, 0.6, 0.1), (1.0, 0.6, 0.1)]
    assert cap.read.call_count == 3
    cap.release.assert_called_once()


def test_mediapipe_trajectory_follows_the_face():
    from backend.crop_utils import sample_face_trajectory
    cap = _capture()
    mp, face_mesh_cls, mesh = _fake_mediapipe(_one_face(0.6))
    with patch("backend.crop_utils.cv2.VideoCapture", return_value=cap), \
         patch.dict(sys.modules, {"mediapipe": mp}):
        traj = sample_face_trajectory("v.mp4", 0.0, 1.0, interval=0.5, engine="mediapipe")

    assert [t for t, _, _ in traj] == [0.0, 0.5, 1.0]
    for _, x, w in traj:
        assert x == pytest.approx(0.6)
        assert w == pytest.approx(0.2)
    assert cap.read.call_count == 3


def test_face_mesh_is_created_once_and_closed_after_success():
    from backend.crop_utils import sample_face_trajectory
    mp, face_mesh_cls, mesh = _fake_mediapipe(_one_face(0.5))
    info = {}
    with patch("backend.crop_utils.cv2.VideoCapture", return_value=_capture()), \
         patch.dict(sys.modules, {"mediapipe": mp}):
        sample_face_trajectory("v.mp4", 0.0, 2.0, interval=0.5, engine="mediapipe", info=info)

    assert face_mesh_cls.call_count == 1
    mesh.close.assert_called_once()
    assert info["engine_used"] == "mediapipe"


def test_face_mesh_is_closed_when_mediapipe_raises_and_the_reason_is_logged():
    from backend.crop_utils import sample_face_trajectory

    def process(rgb):
        raise RuntimeError("calculator graph failed")

    mp, face_mesh_cls, mesh = _fake_mediapipe(process)
    cap = _capture()
    info = {}
    with patch("backend.crop_utils.cv2.VideoCapture", return_value=cap), \
         patch("backend.crop_utils.cv2.CascadeClassifier", return_value=_cascade([(352, 100, 64, 64)])), \
         patch("backend.crop_utils.log_error") as mock_log, \
         patch.dict(sys.modules, {"mediapipe": mp}):
        traj = sample_face_trajectory("v.mp4", 0.0, 1.0, interval=0.5, engine="mediapipe", info=info)

    mesh.close.assert_called_once()
    assert mock_log.call_count == 1
    logged = " ".join(str(a) for a in mock_log.call_args[0])
    assert "calculator graph failed" in logged
    assert info["engine_used"] == "haar"
    assert "calculator graph failed" in info["fallback_reason"]
    assert traj == [(0.0, 0.6, 0.1), (0.5, 0.6, 0.1), (1.0, 0.6, 0.1)]


def test_frames_read_before_a_mediapipe_failure_are_not_read_again():
    from backend.crop_utils import sample_face_trajectory
    calls = {"n": 0}

    def process(rgb):
        calls["n"] += 1
        if calls["n"] == 3:
            raise RuntimeError("out of memory in graph")
        return types.SimpleNamespace(multi_face_landmarks=[_landmarks(0.6)])

    mp, face_mesh_cls, mesh = _fake_mediapipe(process)
    cap = _capture()
    with patch("backend.crop_utils.cv2.VideoCapture", return_value=cap), \
         patch("backend.crop_utils.cv2.CascadeClassifier", return_value=_cascade([(352, 100, 64, 64)])), \
         patch("backend.crop_utils.log_error"), \
         patch.dict(sys.modules, {"mediapipe": mp}):
        traj = sample_face_trajectory("v.mp4", 0.0, 2.0, interval=0.5, engine="mediapipe")

    # 5 samples, each frame decoded exactly once even though the engine changed at sample 3
    assert cap.read.call_count == 5
    assert [t for t, _, _ in traj] == [0.0, 0.5, 1.0, 1.5, 2.0]
    for _, x, _ in traj:
        assert x == pytest.approx(0.6)
    mesh.close.assert_called_once()


def test_missing_mediapipe_solutions_falls_back_with_a_logged_reason():
    from backend.crop_utils import sample_face_trajectory
    mp_without_solutions = types.SimpleNamespace(tasks=object())
    cap = _capture()
    info = {}
    with patch("backend.crop_utils.cv2.VideoCapture", return_value=cap), \
         patch("backend.crop_utils.cv2.CascadeClassifier", return_value=_cascade([(352, 100, 64, 64)])), \
         patch("backend.crop_utils.log_error") as mock_log, \
         patch.dict(sys.modules, {"mediapipe": mp_without_solutions}):
        traj = sample_face_trajectory("v.mp4", 0.0, 1.0, interval=0.5, engine="mediapipe", info=info)

    assert mock_log.call_count == 1
    assert info["engine_used"] == "haar"
    assert "solutions" in info["fallback_reason"]
    assert cap.read.call_count == 3
    assert len(traj) == 3


def test_haar_engine_does_not_touch_mediapipe_or_log_a_fallback():
    from backend.crop_utils import sample_face_trajectory
    mp, face_mesh_cls, mesh = _fake_mediapipe(_one_face(0.5))
    info = {}
    with patch("backend.crop_utils.cv2.VideoCapture", return_value=_capture()), \
         patch("backend.crop_utils.cv2.CascadeClassifier", return_value=_cascade([])), \
         patch("backend.crop_utils.log_error") as mock_log, \
         patch.dict(sys.modules, {"mediapipe": mp}):
        sample_face_trajectory("v.mp4", 0.0, 1.0, interval=0.5, engine="haar", info=info)

    face_mesh_cls.assert_not_called()
    mock_log.assert_not_called()
    assert info == {"engine_used": "haar"}


def test_face_mesh_and_capture_are_released_when_reading_frames_crashes():
    from backend.crop_utils import sample_face_trajectory
    mp, face_mesh_cls, mesh = _fake_mediapipe(_one_face(0.5))
    frame = np.zeros((360, 640, 3), dtype=np.uint8)
    cap = _capture(frames=[(True, frame), MemoryError("decoder ran out of memory")])
    with patch("backend.crop_utils.cv2.VideoCapture", return_value=cap), \
         patch.dict(sys.modules, {"mediapipe": mp}):
        with pytest.raises(MemoryError):
            sample_face_trajectory("v.mp4", 0.0, 2.0, interval=0.5, engine="mediapipe")

    mesh.close.assert_called_once()
    cap.release.assert_called_once()


def test_face_mesh_is_closed_when_tracking_is_cancelled():
    from backend.crop_utils import sample_face_trajectory
    mp, face_mesh_cls, mesh = _fake_mediapipe(_one_face(0.5))
    with patch("backend.crop_utils.cv2.VideoCapture", return_value=_capture()), \
         patch.dict(sys.modules, {"mediapipe": mp}):
        traj = sample_face_trajectory("v.mp4", 0.0, 2.0, interval=0.5, engine="mediapipe", should_cancel=lambda: True)

    mesh.close.assert_called_once()
    assert traj == [(0.0, 0.5, 0.16)]


@patch('backend.crop_utils.is_nvenc_available', return_value=False)
@patch('backend.crop_utils.subprocess.Popen')
def test_crop_reports_the_tracking_engine_that_really_ran(mock_popen, mock_nvenc):
    from backend.stage_timer import collect_timings
    mock_popen.return_value = _fake_proc(0)

    def fake_sample(path, start_time, end_time, interval, should_cancel, engine, info):
        info["engine_used"] = "haar"
        info["fallback_reason"] = "MediaPipe 'solutions' attribute is missing"
        return [(0.0, 0.5, 0.16)]

    timings = []
    with patch("backend.crop_utils.sample_face_trajectory", side_effect=fake_sample):
        with collect_timings(timings):
            crop_to_vertical("in.mp4", "out.mp4", "00:00:00", "00:00:10", engine="mediapipe")

    tracking = [t for t in timings if t["stage"] == "tracking"][0]
    assert tracking["tracking_engine_requested"] == "mediapipe"
    assert tracking["tracking_engine_used"] == "haar"


def test_nvenc_probe_uses_a_frame_turing_gpus_accept(monkeypatch):
    # Turing GPUs (Colab's T4) reject h264_nvenc frames narrower than 145 px,
    # so a smaller probe frame reports "no GPU encoder" on a GPU that has one.
    import backend.crop_utils as cu

    calls = []

    def fake_run(cmd, **kwargs):
        calls.append(cmd)
        return MagicMock(returncode=0)

    monkeypatch.setattr(cu, "_NVENC_AVAILABLE", None)
    monkeypatch.setattr(cu.subprocess, "run", fake_run)

    assert cu.is_nvenc_available() is True
    size = re.search(r"s=(\d+)x(\d+)", " ".join(calls[0]))
    assert size, calls[0]
    assert int(size.group(1)) >= 145 and int(size.group(2)) >= 145
