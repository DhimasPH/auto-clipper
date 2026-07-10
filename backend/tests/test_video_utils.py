from backend.video_utils import download_youtube_video
from unittest.mock import patch, MagicMock

@patch('backend.video_utils.yt_dlp.YoutubeDL')
def test_download_youtube_video(mock_ytdl, tmp_path):
    # Mock the YoutubeDL context manager and download method
    mock_instance = MagicMock()
    mock_ytdl.return_value.__enter__.return_value = mock_instance
    
    url = "https://www.youtube.com/watch?v=aqz-KE-bpKQ" 
    output_path = tmp_path / "video.mp4"
    
    # Create a dummy file to simulate successful download
    output_path.write_text("dummy video content")
    
    result_path = download_youtube_video(url, str(output_path))
    
    # Verify YoutubeDL was called with correct URL
    mock_instance.download.assert_called_once_with([url])
    assert result_path.exists()
