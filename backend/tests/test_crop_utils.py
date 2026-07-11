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
