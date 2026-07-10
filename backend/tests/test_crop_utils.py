from backend.crop_utils import detect_primary_face_center, crop_to_vertical
from unittest.mock import patch

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
    mock_run.return_value = None
    
    res = crop_to_vertical("in.mp4", "out.mp4", "00:00:00", "00:00:10")
    assert res == "out.mp4"
    mock_run.assert_called_once()
