from backend.video_utils import download_youtube_video

def test_download_youtube_video(tmp_path):
    # Use a very short test video URL
    url = "https://www.youtube.com/watch?v=BaW_jenozKc" 
    output_path = tmp_path / "video.mp4"
    result_path = download_youtube_video(url, str(output_path))
    
    assert result_path.exists()
