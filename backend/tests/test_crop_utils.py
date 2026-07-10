from backend.crop_utils import detect_primary_face_center, crop_to_vertical
from unittest.mock import patch, MagicMock

@patch('backend.crop_utils.cv2.VideoCapture')
def test_detect_primary_face_center(mock_cap):
    mock_instance = mock_cap.return_value
    mock_instance.isOpened.return_value = False

    center = detect_primary_face_center("dummy.mp4")
    assert center == 0.5 # Default when no video/face

@patch('backend.crop_utils.subprocess.run')
@patch('backend.crop_utils.detect_primary_face_center')
def test_crop_to_vertical(mock_detect, mock_run):
    mock_detect.return_value = 0.5
    mock_run.return_value = MagicMock(returncode=0, stderr=b"")

    res = crop_to_vertical("in.mp4", "out.mp4", "00:00:00", "00:00:10")
    assert res == "out.mp4"
    mock_run.assert_called_once()


@patch('backend.crop_utils.subprocess.run')
@patch('backend.crop_utils.detect_primary_face_center')
def test_crop_falls_back_when_subtitles_fail(mock_detect, mock_run, tmp_path):
    """If the subtitle burn fails, a plain crop should still be produced."""
    mock_detect.return_value = 0.5
    # First call (with subtitles) fails, second (plain crop) succeeds.
    mock_run.side_effect = [
        MagicMock(returncode=1, stderr=b"No such filter: 'subtitles'"),
        MagicMock(returncode=0, stderr=b""),
    ]
    srt = tmp_path / "subs.srt"
    srt.write_text("1\n00:00:00,000 --> 00:00:05,000\nhello\n")

    res = crop_to_vertical("in.mp4", "out.mp4", "00:00:00", "00:00:10", subtitle_path=str(srt))
    assert res == "out.mp4"
    assert mock_run.call_count == 2
