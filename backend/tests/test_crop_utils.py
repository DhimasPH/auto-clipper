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


@patch('backend.crop_utils.subprocess.Popen')
@patch('backend.crop_utils.detect_primary_face_center')
def test_crop_to_vertical(mock_detect, mock_popen):
    mock_detect.return_value = 0.5
    mock_popen.return_value = _fake_proc(0)

    res = crop_to_vertical("in.mp4", "out.mp4", "00:00:00", "00:00:10")
    assert res == "out.mp4"
    mock_popen.assert_called_once()


@patch('backend.crop_utils.subprocess.Popen')
@patch('backend.crop_utils.detect_primary_face_center')
def test_crop_falls_back_when_subtitles_fail(mock_detect, mock_popen, tmp_path):
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
    assert build_crop_filter("1:1", 0.5) == "crop=trunc(ih/2)*2:ih:iw*0.5-ih/2:0"
    assert build_crop_filter("4:5", 0.5) == "crop=trunc(ih*4/5/2)*2:ih:iw*0.5-ih*4/10:0"
    assert build_crop_filter("9:16", 0.5) == "crop=trunc(ih*9/16/2)*2:ih:iw*9/32:0".replace("iw*9/32", "iw*0.5-ih*9/32")
    # Landscape keeps full width and crops height; no comma (feeds "crop,ass=").
    lf = build_crop_filter("16:9", 0.5)
    assert lf.startswith("crop=iw:"), lf
    assert "9/16" in lf
    assert "," not in lf


def test_output_width_ratios():
    from backend.crop_utils import output_width
    # Landscape output width == full source width.
    assert output_width("16:9", 1920, 1080) == 1920
    # Vertical/square derive width from source height (even).
    assert output_width("1:1", 1920, 1080) == 1080
    assert output_width("9:16", 1920, 1080) == (int(1080 * 9 / 16) // 2) * 2


# --- Gaming Split-Screen Auto-Detect --------------------------------------

def _fake_layout_cap(fps=30.0, frame_count=30):
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
    frame = MagicMock()
    frame.shape = (1080, 1920, 3)
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
