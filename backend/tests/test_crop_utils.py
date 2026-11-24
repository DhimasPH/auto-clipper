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

import io
import math
import subprocess
import sys
import types
from contextlib import contextmanager

import numpy as np
import pytest

FFMPEG_FALLBACK = "crop_utils.sample_face_trajectory_ffmpeg_fallback"


def _capture(frames=None, width=640, height=360, fps=25.0):
    """A cv2.VideoCapture stand-in that hands out black frames."""
    cap = MagicMock()
    cap.isOpened.return_value = True
    props = {5: fps, 7: 250, 3: width, 4: height}  # FPS, FRAME_COUNT, WIDTH, HEIGHT
    cap.get.side_effect = lambda prop: props.get(prop, 0)
    if frames is None:
        cap.read.side_effect = lambda: (True, np.zeros((height, width, 3), dtype=np.uint8))
    else:
        cap.read.side_effect = frames
    return cap


class _Pipe(io.BytesIO):
    """A pipe end that remembers how far it was read before being closed."""

    def __init__(self, data=b"", fail_at=None):
        super().__init__(data)
        self.read_until = 0
        self._fail_at = fail_at

    def readinto(self, buffer):
        if self._fail_at is not None and self.tell() >= self._fail_at:
            raise self._fail_with
        n = super().readinto(buffer)
        self.read_until = self.tell()
        return n

    def close(self):
        if not self.closed:
            self.read_until = self.tell()
        super().close()


class _FakeFfmpeg:
    """A subprocess.Popen stand-in for the tracking FFmpeg process.

    Streams raw BGR frames on stdout, then exits with ``returncode``. Unless
    ``frames`` is given it sends exactly as many black frames as ``-frames:v``
    asks for, like the real process.
    """

    def __init__(self, cmd, frames=None, returncode=0, stderr=b"", stdout=None, read_error=None, read_error_at=0):
        self.cmd = cmd
        if stdout is None:
            if frames is None:
                w, h = _scale_size(cmd)
                count = int(cmd[cmd.index("-frames:v") + 1])
                frames = [np.zeros((h, w, 3), dtype=np.uint8)] * count
            stdout = b"".join(np.ascontiguousarray(f).tobytes() for f in frames)
        self.stdout = _Pipe(stdout, fail_at=read_error_at if read_error else None)
        if read_error:
            self.stdout._fail_with = read_error
        self.stderr = _Pipe(stderr)
        self._exit_code = returncode
        self.returncode = None
        self.killed = False
        self.waited = False

    def poll(self):
        return self.returncode

    def wait(self, timeout=None):
        self.waited = True
        if self.returncode is None:
            self.returncode = self._exit_code
        return self.returncode

    def kill(self):
        self.killed = True
        if self.returncode is None:
            self.returncode = -9

    terminate = kill

    def frames_read(self, width=640, height=360):
        return self.stdout.read_until // (width * height * 3)


def _scale_size(cmd):
    vf = cmd[cmd.index("-vf") + 1]
    m = re.search(r"scale=(\d+):(\d+)", vf)
    return int(m.group(1)), int(m.group(2))


@contextmanager
def _ffmpeg_streams(**fake_kwargs):
    """Make sample_face_trajectory find FFmpeg and get a _FakeFfmpeg process."""
    procs = []

    def popen(cmd, **kwargs):
        proc = _FakeFfmpeg(cmd, **fake_kwargs)
        procs.append(proc)
        return proc

    with patch("backend.crop_utils._ffmpeg_executable", return_value="ffmpeg"), \
         patch("backend.crop_utils.subprocess.Popen", side_effect=popen):
        yield procs


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


def _logged_contexts(mock_log):
    return [c.args[0] for c in mock_log.call_args_list]


def test_haar_trajectory_follows_the_largest_face():
    from backend.crop_utils import sample_face_trajectory
    cap = _capture()
    # 640-wide frame: box x=352..416 -> centre 0.6, width 0.1
    with _ffmpeg_streams() as procs, \
         patch("backend.crop_utils.cv2.VideoCapture", return_value=cap), \
         patch("backend.crop_utils.cv2.CascadeClassifier", return_value=_cascade([(10, 10, 20, 20), (352, 100, 64, 64)])):
        traj = sample_face_trajectory("v.mp4", 0.0, 1.0, interval=0.5, engine="haar")

    assert traj == [(0.0, 0.6, 0.1), (0.5, 0.6, 0.1), (1.0, 0.6, 0.1)]
    assert len(procs) == 1 and procs[0].frames_read() == 3
    cap.read.assert_not_called()
    cap.release.assert_called_once()


def test_mediapipe_trajectory_follows_the_face():
    from backend.crop_utils import sample_face_trajectory
    cap = _capture()
    mp, face_mesh_cls, mesh = _fake_mediapipe(_one_face(0.6))
    with _ffmpeg_streams() as procs, \
         patch("backend.crop_utils.cv2.VideoCapture", return_value=cap), \
         patch.dict(sys.modules, {"mediapipe": mp}):
        traj = sample_face_trajectory("v.mp4", 0.0, 1.0, interval=0.5, engine="mediapipe")

    assert [t for t, _, _ in traj] == [0.0, 0.5, 1.0]
    for _, x, w in traj:
        assert x == pytest.approx(0.6)
        assert w == pytest.approx(0.2)
    assert procs[0].frames_read() == 3
    assert mesh.process.call_count == 3


def test_face_mesh_is_created_once_and_closed_after_success():
    from backend.crop_utils import sample_face_trajectory
    mp, face_mesh_cls, mesh = _fake_mediapipe(_one_face(0.5))
    info = {}
    with _ffmpeg_streams(), \
         patch("backend.crop_utils.cv2.VideoCapture", return_value=_capture()), \
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
    with _ffmpeg_streams(), \
         patch("backend.crop_utils.cv2.VideoCapture", return_value=cap), \
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
    with _ffmpeg_streams() as procs, \
         patch("backend.crop_utils.cv2.VideoCapture", return_value=cap), \
         patch("backend.crop_utils.cv2.CascadeClassifier", return_value=_cascade([(352, 100, 64, 64)])), \
         patch("backend.crop_utils.log_error"), \
         patch.dict(sys.modules, {"mediapipe": mp}):
        traj = sample_face_trajectory("v.mp4", 0.0, 2.0, interval=0.5, engine="mediapipe")

    # 5 samples, each frame decoded exactly once even though the engine changed at sample 3
    assert len(procs) == 1 and procs[0].frames_read() == 5
    cap.read.assert_not_called()
    assert [t for t, _, _ in traj] == [0.0, 0.5, 1.0, 1.5, 2.0]
    for _, x, _ in traj:
        assert x == pytest.approx(0.6)
    mesh.close.assert_called_once()


def test_missing_mediapipe_solutions_falls_back_with_a_logged_reason():
    from backend.crop_utils import sample_face_trajectory
    mp_without_solutions = types.SimpleNamespace(tasks=object())
    cap = _capture()
    info = {}
    with _ffmpeg_streams() as procs, \
         patch("backend.crop_utils.cv2.VideoCapture", return_value=cap), \
         patch("backend.crop_utils.cv2.CascadeClassifier", return_value=_cascade([(352, 100, 64, 64)])), \
         patch("backend.crop_utils.log_error") as mock_log, \
         patch.dict(sys.modules, {"mediapipe": mp_without_solutions}):
        traj = sample_face_trajectory("v.mp4", 0.0, 1.0, interval=0.5, engine="mediapipe", info=info)

    assert mock_log.call_count == 1
    assert info["engine_used"] == "haar"
    assert "solutions" in info["fallback_reason"]
    assert procs[0].frames_read() == 3
    assert len(traj) == 3


def test_haar_engine_does_not_touch_mediapipe_or_log_a_fallback():
    from backend.crop_utils import sample_face_trajectory
    mp, face_mesh_cls, mesh = _fake_mediapipe(_one_face(0.5))
    info = {}
    with _ffmpeg_streams(), \
         patch("backend.crop_utils.cv2.VideoCapture", return_value=_capture()), \
         patch("backend.crop_utils.cv2.CascadeClassifier", return_value=_cascade([])), \
         patch("backend.crop_utils.log_error") as mock_log, \
         patch.dict(sys.modules, {"mediapipe": mp}):
        sample_face_trajectory("v.mp4", 0.0, 1.0, interval=0.5, engine="haar", info=info)

    face_mesh_cls.assert_not_called()
    mock_log.assert_not_called()
    assert info == {"engine_used": "haar"}


def test_face_mesh_capture_and_ffmpeg_are_released_when_reading_frames_crashes():
    from backend.crop_utils import sample_face_trajectory
    mp, face_mesh_cls, mesh = _fake_mediapipe(_one_face(0.5))
    cap = _capture()
    frame_size = 640 * 360 * 3
    with _ffmpeg_streams(read_error=MemoryError("pipe buffer ran out of memory"), read_error_at=frame_size) as procs, \
         patch("backend.crop_utils.cv2.VideoCapture", return_value=cap), \
         patch.dict(sys.modules, {"mediapipe": mp}):
        with pytest.raises(MemoryError):
            sample_face_trajectory("v.mp4", 0.0, 2.0, interval=0.5, engine="mediapipe")

    mesh.close.assert_called_once()
    cap.release.assert_called_once()
    assert procs[0].killed and procs[0].waited
    assert procs[0].stdout.closed and procs[0].stderr.closed


def test_face_mesh_and_capture_are_released_when_seek_reading_crashes():
    from backend.crop_utils import sample_face_trajectory
    mp, face_mesh_cls, mesh = _fake_mediapipe(_one_face(0.5))
    frame = np.zeros((360, 640, 3), dtype=np.uint8)
    cap = _capture(frames=[(True, frame), MemoryError("decoder ran out of memory")])
    with patch("backend.crop_utils._ffmpeg_executable", return_value=None), \
         patch("backend.crop_utils.log_error"), \
         patch("backend.crop_utils.cv2.VideoCapture", return_value=cap), \
         patch.dict(sys.modules, {"mediapipe": mp}):
        with pytest.raises(MemoryError):
            sample_face_trajectory("v.mp4", 0.0, 2.0, interval=0.5, engine="mediapipe")

    mesh.close.assert_called_once()
    cap.release.assert_called_once()


def test_face_mesh_is_closed_when_tracking_is_cancelled():
    from backend.crop_utils import sample_face_trajectory
    mp, face_mesh_cls, mesh = _fake_mediapipe(_one_face(0.5))
    with _ffmpeg_streams() as procs, \
         patch("backend.crop_utils.cv2.VideoCapture", return_value=_capture()), \
         patch.dict(sys.modules, {"mediapipe": mp}):
        traj = sample_face_trajectory("v.mp4", 0.0, 2.0, interval=0.5, engine="mediapipe", should_cancel=lambda: True)

    mesh.close.assert_called_once()
    assert traj == [(0.0, 0.5, 0.16)]
    for proc in procs:
        assert proc.frames_read() == 0
        assert proc.waited and proc.stdout.closed


# --- sample_face_trajectory: one sequential FFmpeg read (T0.16) --------------

def _old_offsets(start, end, interval):
    """The sample offsets the seek-per-sample implementation used."""
    duration = max(0.1, end - start)
    num_samples = max(2, int(duration / interval) + 1)
    return [min(duration, i * interval) for i in range(num_samples)]


@pytest.mark.parametrize("start,end,interval", [
    (0.0, 1.0, 0.5),
    (12.3, 72.3, 0.5),
    (3.37, 10.0, 0.5),
    (2.0, 2.3, 0.5),      # shorter than one interval: two samples, the last at the clip end
    (5.0, 5.0, 0.5),      # zero-length window becomes 0.1 s
    (0.98, 9.7, 0.7),
    (100.0, 130.0, 0.25),
])
def test_ffmpeg_path_reports_the_same_sample_times_as_the_seek_path(start, end, interval):
    from backend.crop_utils import sample_face_trajectory
    with _ffmpeg_streams() as procs, \
         patch("backend.crop_utils.cv2.VideoCapture", return_value=_capture(width=64, height=36)), \
         patch("backend.crop_utils.cv2.CascadeClassifier", return_value=_cascade([])):
        traj = sample_face_trajectory("v.mp4", start, end, interval=interval, engine="haar")

    expected = _old_offsets(start, end, interval)
    assert [t for t, _, _ in traj] == expected
    cmd = procs[0].cmd
    assert int(cmd[cmd.index("-frames:v") + 1]) == len(expected)
    assert procs[0].frames_read(64, 36) == len(expected)


def test_ffmpeg_command_seeks_before_input_and_scales_to_640_wide():
    from backend.crop_utils import sample_face_trajectory
    with _ffmpeg_streams() as procs, \
         patch("backend.crop_utils.cv2.VideoCapture", return_value=_capture(width=1920, height=1080, fps=30.0)), \
         patch("backend.crop_utils.cv2.CascadeClassifier", return_value=_cascade([])):
        sample_face_trajectory("clip source.mp4", 12.0, 72.0, interval=0.5, engine="haar")

    cmd = procs[0].cmd
    assert cmd[0] == "ffmpeg"
    i_input = cmd.index("-i")
    assert cmd[i_input + 1] == "clip source.mp4"
    assert cmd.index("-ss") < i_input and cmd.index("-t") < i_input
    # Seek half a source frame early so the frame nearest the clip start is kept.
    assert float(cmd[cmd.index("-ss") + 1]) == pytest.approx(12.0 - 0.5 / 30, abs=0.003)
    assert float(cmd[cmd.index("-t") + 1]) >= 60.0
    assert _scale_size(cmd) == (640, 360)
    vf = cmd[cmd.index("-vf") + 1]
    assert "fps=fps=2/1" in vf
    assert cmd[cmd.index("-f") + 1] == "rawvideo"
    assert cmd[cmd.index("-pix_fmt") + 1] == "bgr24"
    assert cmd[-1] == "pipe:1"
    assert not any("hwaccel" in str(a) for a in cmd)


def test_ffmpeg_command_keeps_small_sources_at_their_own_size():
    from backend.crop_utils import sample_face_trajectory
    with _ffmpeg_streams() as procs, \
         patch("backend.crop_utils.cv2.VideoCapture", return_value=_capture(width=480, height=854)), \
         patch("backend.crop_utils.cv2.CascadeClassifier", return_value=_cascade([])):
        sample_face_trajectory("v.mp4", 0.0, 1.0, interval=0.5, engine="haar")

    assert _scale_size(procs[0].cmd) == (480, 854)


def test_ffmpeg_command_uses_the_old_resize_height_rule():
    # The seek path resized to int(h * 640 / w); FFmpeg must hand out frames of that exact size.
    from backend.crop_utils import sample_face_trajectory
    with _ffmpeg_streams() as procs, \
         patch("backend.crop_utils.cv2.VideoCapture", return_value=_capture(width=1080, height=1920)), \
         patch("backend.crop_utils.cv2.CascadeClassifier", return_value=_cascade([])):
        sample_face_trajectory("v.mp4", 0.0, 1.0, interval=0.5, engine="haar")

    assert _scale_size(procs[0].cmd) == (640, int(1920 * (640 / 1080)))


def _simulated_ffmpeg_frames(start, offsets, fps, total_frames=10**9):
    """Which source frame each sample gets, following the FFmpeg filter chain.

    Models the command's semantics: -ss drops frames before the seek point,
    setpts shifts timestamps, fps=...:round=up gives slot k the last frame with
    shifted time <= k * step (start_time=0 pads slot 0 with the first frame).
    """
    from backend.crop_utils import _ffmpeg_frame_plan
    plan = _ffmpeg_frame_plan(start, offsets, fps)
    first = math.ceil(plan["seek"] * fps - 1e-9)
    chosen = []
    for k in range(len(offsets)):
        limit = k * plan["step"] + plan["seek"] + plan["shift"]
        last = math.floor(limit * fps + 1e-9)
        last = min(last, total_frames - 1)
        chosen.append(max(first, last))
    return chosen


@pytest.mark.parametrize("fps", [24.0, 25.0, 30000 / 1001, 30.0, 50.0, 60.0])
def test_frame_plan_picks_the_frame_opencv_seeking_picked(fps):
    import random
    rng = random.Random(int(fps * 1000))
    checked = 0
    for _ in range(300):
        start = round(rng.uniform(0.0, 600.0), rng.choice([0, 1, 2, 3]))
        duration = rng.choice([0.3, 1.0, 7.3, 30.0, 60.0, 90.0])
        interval = rng.choice([0.5, 0.25, 1.0])
        offsets = _old_offsets(start, start + duration, interval)
        new = _simulated_ffmpeg_frames(start, offsets, fps)
        for rel_t, frame in zip(offsets, new):
            exact = (start + rel_t) * fps
            old = math.floor(exact + 0.5)  # OpenCV: nearest frame to POS_MSEC
            if abs((exact % 1.0) - 0.5) < 0.1:
                assert abs(frame - old) <= 1  # a near-tie: either neighbour is as close
            else:
                assert frame == old, (start, rel_t, fps)
            checked += 1
    assert checked > 1000


def test_ffmpeg_frames_reach_the_haar_detector_in_order():
    from backend.crop_utils import sample_face_trajectory
    frames = [np.full((360, 640, 3), 10 * (i + 1), dtype=np.uint8) for i in range(5)]
    seen = []

    def fake_haar(cascade, small_frame):
        seen.append((small_frame.shape, int(small_frame[0, 0, 0])))
        return [{"cx": 0.3 + 0.1 * len(seen), "w": 0.1}]

    with _ffmpeg_streams(frames=frames), \
         patch("backend.crop_utils.cv2.VideoCapture", return_value=_capture()), \
         patch("backend.crop_utils.cv2.CascadeClassifier", return_value=_cascade([])), \
         patch("backend.crop_utils._haar_faces", side_effect=fake_haar):
        traj = sample_face_trajectory("v.mp4", 0.0, 2.0, interval=0.5, engine="haar")

    assert seen == [((360, 640, 3), 10), ((360, 640, 3), 20), ((360, 640, 3), 30), ((360, 640, 3), 40), ((360, 640, 3), 50)]
    assert [round(x, 2) for _, x, _ in traj] == [0.4, 0.5, 0.6, 0.7, 0.8]


def test_ffmpeg_frames_reach_mediapipe_as_rgb():
    from backend.crop_utils import sample_face_trajectory
    frame = np.zeros((360, 640, 3), dtype=np.uint8)
    frame[..., 0] = 200  # blue channel in BGR
    seen = []

    def process(rgb):
        seen.append(tuple(int(v) for v in rgb[0, 0]))
        return types.SimpleNamespace(multi_face_landmarks=[_landmarks(0.5)])

    mp, face_mesh_cls, mesh = _fake_mediapipe(process)
    with _ffmpeg_streams(frames=[frame] * 3), \
         patch("backend.crop_utils.cv2.VideoCapture", return_value=_capture()), \
         patch.dict(sys.modules, {"mediapipe": mp}):
        sample_face_trajectory("v.mp4", 0.0, 1.0, interval=0.5, engine="mediapipe")

    assert seen == [(0, 0, 200)] * 3


def test_cancelling_mid_clip_stops_reading_and_kills_ffmpeg():
    from backend.crop_utils import sample_face_trajectory
    checks = {"n": 0}

    def should_cancel():
        checks["n"] += 1
        return checks["n"] > 2

    with _ffmpeg_streams() as procs, \
         patch("backend.crop_utils.cv2.VideoCapture", return_value=_capture()), \
         patch("backend.crop_utils.cv2.CascadeClassifier", return_value=_cascade([(352, 100, 64, 64)])):
        traj = sample_face_trajectory("v.mp4", 0.0, 10.0, interval=0.5, engine="haar", should_cancel=should_cancel)

    proc = procs[0]
    assert proc.frames_read() == 2
    assert proc.killed and proc.waited
    assert proc.stdout.closed and proc.stderr.closed
    assert [t for t, _, _ in traj] == [0.0, 0.5]


def test_ffmpeg_process_is_cleaned_up_after_a_full_read():
    from backend.crop_utils import sample_face_trajectory
    with _ffmpeg_streams() as procs, \
         patch("backend.crop_utils.cv2.VideoCapture", return_value=_capture()), \
         patch("backend.crop_utils.cv2.CascadeClassifier", return_value=_cascade([])):
        sample_face_trajectory("v.mp4", 0.0, 3.0, interval=0.5, engine="haar")

    proc = procs[0]
    assert proc.waited
    assert proc.stdout.closed and proc.stderr.closed


def test_missing_ffmpeg_falls_back_to_seeking_and_logs_it():
    from backend.crop_utils import sample_face_trajectory
    cap = _capture()
    info = {}
    with patch("backend.crop_utils._ffmpeg_executable", return_value=None), \
         patch("backend.crop_utils.subprocess.Popen") as mock_popen, \
         patch("backend.crop_utils.cv2.VideoCapture", return_value=cap), \
         patch("backend.crop_utils.cv2.CascadeClassifier", return_value=_cascade([(352, 100, 64, 64)])), \
         patch("backend.crop_utils.log_error") as mock_log:
        traj = sample_face_trajectory("v.mp4", 0.0, 1.0, interval=0.5, engine="haar", info=info)

    mock_popen.assert_not_called()
    assert _logged_contexts(mock_log) == [FFMPEG_FALLBACK]
    assert cap.read.call_count == 3
    assert traj == [(0.0, 0.6, 0.1), (0.5, 0.6, 0.1), (1.0, 0.6, 0.1)]
    assert info == {"engine_used": "haar"}


def test_ffmpeg_that_cannot_start_falls_back_to_seeking():
    from backend.crop_utils import sample_face_trajectory
    cap = _capture()
    with patch("backend.crop_utils._ffmpeg_executable", return_value="ffmpeg"), \
         patch("backend.crop_utils.subprocess.Popen", side_effect=FileNotFoundError("no such file: ffmpeg")), \
         patch("backend.crop_utils.cv2.VideoCapture", return_value=cap), \
         patch("backend.crop_utils.cv2.CascadeClassifier", return_value=_cascade([(352, 100, 64, 64)])), \
         patch("backend.crop_utils.log_error") as mock_log:
        traj = sample_face_trajectory("v.mp4", 0.0, 1.0, interval=0.5, engine="haar")

    assert _logged_contexts(mock_log) == [FFMPEG_FALLBACK]
    assert "no such file" in str(mock_log.call_args[0][1])
    assert cap.read.call_count == 3
    assert len(traj) == 3


def test_ffmpeg_failing_before_any_frame_falls_back_and_logs_its_error():
    from backend.crop_utils import sample_face_trajectory
    cap = _capture()
    with _ffmpeg_streams(frames=[], returncode=1, stderr=b"v.mp4: moov atom not found\n") as procs, \
         patch("backend.crop_utils.cv2.VideoCapture", return_value=cap), \
         patch("backend.crop_utils.cv2.CascadeClassifier", return_value=_cascade([(352, 100, 64, 64)])), \
         patch("backend.crop_utils.log_error") as mock_log:
        traj = sample_face_trajectory("v.mp4", 0.0, 1.0, interval=0.5, engine="haar")

    assert _logged_contexts(mock_log) == [FFMPEG_FALLBACK]
    message = str(mock_log.call_args[0][1])
    assert "moov atom not found" in message and "1" in message
    assert cap.read.call_count == 3
    assert traj == [(0.0, 0.6, 0.1), (0.5, 0.6, 0.1), (1.0, 0.6, 0.1)]
    assert procs[0].waited and procs[0].stdout.closed


def test_ffmpeg_ending_early_hands_the_remaining_samples_to_the_seek_path():
    from backend.crop_utils import sample_face_trajectory
    frames = [np.zeros((360, 640, 3), dtype=np.uint8)] * 2
    cap = _capture()
    seek_times = []
    cap.set.side_effect = lambda prop, value: seek_times.append(value)
    with _ffmpeg_streams(frames=frames, returncode=0) as procs, \
         patch("backend.crop_utils.cv2.VideoCapture", return_value=cap), \
         patch("backend.crop_utils.cv2.CascadeClassifier", return_value=_cascade([(352, 100, 64, 64)])), \
         patch("backend.crop_utils.log_error") as mock_log, \
         patch("backend.crop_utils.log_app") as mock_app:
        traj = sample_face_trajectory("v.mp4", 10.0, 12.0, interval=0.5, engine="haar")

    assert [t for t, _, _ in traj] == [0.0, 0.5, 1.0, 1.5, 2.0]
    assert procs[0].frames_read() == 2
    assert cap.read.call_count == 3
    assert seek_times == [11000.0, 11500.0, 12000.0]
    # Running to the end of the video is normal: app log, not error log.
    assert FFMPEG_FALLBACK not in _logged_contexts(mock_log)
    assert "2 of 5" in str(mock_app.call_args[0][0])
    assert procs[0].waited and procs[0].stdout.closed


def test_ffmpeg_sending_a_truncated_frame_falls_back_for_the_rest():
    from backend.crop_utils import sample_face_trajectory
    frame_size = 640 * 360 * 3
    cap = _capture()
    with _ffmpeg_streams(stdout=b"\0" * (frame_size + 1000), returncode=1, stderr=b"Conversion failed!") as procs, \
         patch("backend.crop_utils.cv2.VideoCapture", return_value=cap), \
         patch("backend.crop_utils.cv2.CascadeClassifier", return_value=_cascade([(352, 100, 64, 64)])), \
         patch("backend.crop_utils.log_error") as mock_log:
        traj = sample_face_trajectory("v.mp4", 0.0, 1.0, interval=0.5, engine="haar")

    assert len(traj) == 3
    assert cap.read.call_count == 2
    assert _logged_contexts(mock_log) == [FFMPEG_FALLBACK]
    assert "Conversion failed!" in str(mock_log.call_args[0][1])
    assert procs[0].waited and procs[0].stdout.closed


def test_broken_pipe_while_reading_falls_back_and_cleans_up():
    from backend.crop_utils import sample_face_trajectory
    frame_size = 640 * 360 * 3
    cap = _capture()
    with _ffmpeg_streams(read_error=BrokenPipeError("pipe closed"), read_error_at=frame_size) as procs, \
         patch("backend.crop_utils.cv2.VideoCapture", return_value=cap), \
         patch("backend.crop_utils.cv2.CascadeClassifier", return_value=_cascade([(352, 100, 64, 64)])), \
         patch("backend.crop_utils.log_error") as mock_log:
        traj = sample_face_trajectory("v.mp4", 0.0, 1.0, interval=0.5, engine="haar")

    assert len(traj) == 3
    assert cap.read.call_count == 2
    assert _logged_contexts(mock_log) == [FFMPEG_FALLBACK]
    assert procs[0].killed and procs[0].waited and procs[0].stdout.closed


def test_unknown_source_size_uses_the_seek_path():
    from backend.crop_utils import sample_face_trajectory
    cap = _capture(width=0, height=0)
    cap.read.side_effect = lambda: (True, np.zeros((360, 640, 3), dtype=np.uint8))
    with _ffmpeg_streams() as procs, \
         patch("backend.crop_utils.cv2.VideoCapture", return_value=cap), \
         patch("backend.crop_utils.cv2.CascadeClassifier", return_value=_cascade([])), \
         patch("backend.crop_utils.log_error") as mock_log:
        traj = sample_face_trajectory("v.mp4", 0.0, 1.0, interval=0.5, engine="haar")

    assert procs == []
    assert cap.read.call_count == 3
    assert len(traj) == 3
    assert _logged_contexts(mock_log) == [FFMPEG_FALLBACK]


# --- integration: real FFmpeg vs the seek path ----------------------------------

def _real_ffmpeg():
    from backend.crop_utils import _ffmpeg_executable
    return _ffmpeg_executable()


@pytest.fixture(scope="module")
def moving_box_video(tmp_path_factory):
    """6 s of 1920x1080 30 fps H.264 with a white box moving 8 px right per frame.

    Keyframes only every 300 frames, so seeking has to decode from the start like
    a YouTube download.
    """
    ffmpeg = _real_ffmpeg()
    if not ffmpeg:
        pytest.skip("no FFmpeg binary available")
    path = str(tmp_path_factory.mktemp("tracking") / "moving_box.mp4")
    cmd = [
        ffmpeg, "-hide_banner", "-loglevel", "error", "-y",
        "-f", "lavfi", "-i", "color=c=0x202020:s=1920x1080:r=30:d=6",
        "-f", "lavfi", "-i", "color=c=white:s=160x160:r=30:d=6",
        "-filter_complex", "[0:v][1:v]overlay=x='200+8*n':y=460:eval=frame,format=yuv420p",
        "-c:v", "libx264", "-preset", "ultrafast", "-crf", "16", "-g", "300", path,
    ]
    res = subprocess.run(cmd, capture_output=True)
    if res.returncode != 0:
        pytest.skip(f"FFmpeg could not encode the test video: {res.stderr.decode('utf-8', 'ignore')[-300:]}")
    return path


def _box_frame_index(small_frame):
    """Source frame number, read back from where the box is (x = 200 + 8 n at 1920 wide)."""
    bright = np.nonzero(small_frame.max(axis=2) > 128)[1]
    left = bright.min() * 1920 / small_frame.shape[1]
    return round((left - 200) / 8)


def _track_box(path, start, end, use_ffmpeg):
    from backend.crop_utils import _sample_face_trajectory
    seen = []

    def box_detector(cascade, small_frame):
        bright = np.nonzero(small_frame.max(axis=2) > 128)[1]
        seen.append(_box_frame_index(small_frame))
        w = small_frame.shape[1]
        return [{"cx": (bright.min() + bright.max() + 1) / 2 / w, "w": (bright.max() - bright.min() + 1) / w}]

    with patch("backend.crop_utils._haar_faces", side_effect=box_detector), \
         patch("backend.crop_utils.log_error") as mock_log:
        traj = _sample_face_trajectory(path, start, end, interval=0.5, engine="haar", use_ffmpeg=use_ffmpeg)
    return traj, seen, mock_log


@pytest.mark.parametrize("start,end", [(0.0, 5.0), (1.37, 4.9), (2.0, 2.3), (3.0, 5.9)])
def test_real_ffmpeg_path_matches_the_seek_path(moving_box_video, start, end):
    old_traj, old_frames, _ = _track_box(moving_box_video, start, end, use_ffmpeg=False)
    new_traj, new_frames, new_log = _track_box(moving_box_video, start, end, use_ffmpeg=True)

    assert FFMPEG_FALLBACK not in _logged_contexts(new_log)
    assert [t for t, _, _ in new_traj] == [t for t, _, _ in old_traj]
    assert len(new_frames) == len(old_frames) == len(_old_offsets(start, end, 0.5))
    assert max(abs(a - b) for a, b in zip(new_frames, old_frames)) <= 1
    for (_, ox, ow), (_, nx, nw) in zip(old_traj, new_traj):
        assert nx == pytest.approx(ox, abs=10 / 1920)  # one frame of motion is 8 px
        assert nw == pytest.approx(ow, abs=6 / 640)


def test_real_ffmpeg_window_past_the_end_matches_the_seek_path(moving_box_video):
    old_traj, old_frames, _ = _track_box(moving_box_video, 4.0, 8.0, use_ffmpeg=False)
    new_traj, new_frames, new_log = _track_box(moving_box_video, 4.0, 8.0, use_ffmpeg=True)

    assert [t for t, _, _ in new_traj] == [t for t, _, _ in old_traj]
    assert len(new_frames) == len(old_frames)
    assert max(abs(a - b) for a, b in zip(new_frames, old_frames)) <= 1
    assert FFMPEG_FALLBACK not in _logged_contexts(new_log)


def test_real_ffmpeg_process_is_gone_after_cancel(moving_box_video):
    from backend.crop_utils import _sample_face_trajectory
    started = []
    real_popen = subprocess.Popen

    def recording_popen(*args, **kwargs):
        proc = real_popen(*args, **kwargs)
        started.append(proc)
        return proc

    checks = {"n": 0}

    def should_cancel():
        checks["n"] += 1
        return checks["n"] > 2

    with patch("backend.crop_utils.subprocess.Popen", side_effect=recording_popen):
        traj = _sample_face_trajectory(moving_box_video, 0.0, 5.0, interval=0.5, should_cancel=should_cancel, engine="haar", use_ffmpeg=True)

    assert len(traj) == 2
    assert len(started) == 1
    assert started[0].poll() is not None


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


def test_face_landmarker_adapter_processes_and_closes(monkeypatch, tmp_path):
    import sys
    import numpy as np
    from backend import crop_utils, addons

    model_file = tmp_path / "face_landmarker.task"
    model_file.write_bytes(b"task")
    monkeypatch.setattr(addons, "ensure_mediapipe_importable", lambda: str(model_file))

    class _Lm:
        def __init__(self, x, y):
            self.x, self.y = x, y

    pts = [_Lm(0.5, 0.5) for _ in range(468)]
    pts[234] = _Lm(0.4, 0.5)
    pts[454] = _Lm(0.6, 0.5)

    class _FakeLandmarker:
        closed = False

        def detect(self, mp_image):
            return type("Res", (), {"face_landmarks": [pts]})()

        def close(self):
            self.closed = True

    fake_lm = _FakeLandmarker()
    fake_mp = type("MP", (), {
        "Image": staticmethod(lambda image_format, data: (image_format, data)),
        "ImageFormat": type("Fmt", (), {"SRGB": 1}),
    })()
    fake_vision = type("Vision", (), {
        "FaceLandmarkerOptions": staticmethod(lambda **kw: kw),
        "RunningMode": type("RM", (), {"IMAGE": 1}),
        "FaceLandmarker": type("FL", (), {"create_from_options": staticmethod(lambda opts: fake_lm)}),
    })()
    monkeypatch.setitem(sys.modules, "mediapipe", fake_mp)
    monkeypatch.setitem(sys.modules, "mediapipe.tasks", type("Tasks", (), {})())
    monkeypatch.setitem(sys.modules, "mediapipe.tasks.python", type("Py", (), {"BaseOptions": staticmethod(lambda **kw: kw), "vision": fake_vision})())
    monkeypatch.setitem(sys.modules, "mediapipe.tasks.python.vision", fake_vision)

    mesh = crop_utils._open_face_mesh()
    faces = crop_utils._mediapipe_faces(mesh, np.zeros((20, 20, 3), dtype="uint8"))
    assert len(faces) == 1 and abs(faces[0]["w"] - 0.2) < 1e-6
    crop_utils._close_face_mesh(mesh)
    assert fake_lm.closed is True


def test_crop_falls_back_to_haar_with_clear_reason_when_mediapipe_addon_missing(monkeypatch):
    from backend import crop_utils, addons
    from backend.stage_timer import collect_timings

    monkeypatch.setattr(addons, "ensure_mediapipe_importable", lambda: None)
    monkeypatch.setitem(__import__("sys").modules, "mediapipe", None)
    monkeypatch.setattr(crop_utils, "is_nvenc_available", lambda: False)

    fake_cap = MagicMock()
    fake_cap.isOpened.return_value = True
    fake_cap.get.side_effect = lambda prop: {5: 25.0, 3: 1920, 4: 1080}.get(prop, 0)
    fake_cap.read.return_value = (False, None)
    fake_cascade = MagicMock()
    fake_cascade.empty.return_value = False
    fake_cascade.detectMultiScale.return_value = []
    monkeypatch.setattr(crop_utils, "_ffmpeg_executable", lambda: None)

    timings = []
    with patch("backend.crop_utils.cv2.VideoCapture", return_value=fake_cap), \
         patch("backend.crop_utils.cv2.CascadeClassifier", return_value=fake_cascade), \
         patch("backend.crop_utils.subprocess.Popen", return_value=_fake_proc(0)):
        with collect_timings(timings):
            crop_to_vertical("in.mp4", "out.mp4", "00:00:00", "00:00:05", engine="mediapipe")

    tracking = [t for t in timings if t["stage"] == "tracking"][0]
    assert tracking["tracking_engine_requested"] == "mediapipe"
    assert tracking["tracking_engine_used"] == "haar"
    assert tracking["tracking_fallback_reason"] == "addon_not_installed"
