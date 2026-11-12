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


def test_quality_to_format_caps_height():
    from backend.video_utils import quality_to_format
    assert "height<=2160" in quality_to_format("2160p")
    assert "height<=1440" in quality_to_format("1440p")
    assert "height<=1080" in quality_to_format("1080p")
    assert "height<=720" in quality_to_format("720p")
    assert "height<=480" in quality_to_format("480p")


# --- download format selection (H.264 up to 1080p by default) ----------------

import pytest

ALL_LABELS = ["best", "2160p", "1440p", "1080p", "720p", "480p", "weird", "", None]


def _video(fid, height, vcodec, ext="mp4", tbr=1000):
    return {"format_id": fid, "url": f"https://example.com/{fid}", "ext": ext, "vcodec": vcodec, "acodec": "none",
            "height": height, "width": height * 16 // 9, "tbr": tbr, "protocol": "https"}


def _audio(fid, ext="m4a", acodec="mp4a.40.2"):
    return {"format_id": fid, "url": f"https://example.com/{fid}", "ext": ext, "vcodec": "none", "acodec": acodec,
            "abr": 128, "tbr": 128, "protocol": "https"}


def _muxed(fid, height, vcodec="h264", ext="mp4"):
    return {"format_id": fid, "url": f"https://example.com/{fid}", "ext": ext, "vcodec": vcodec, "acodec": "aac",
            "height": height, "width": height * 9 // 16, "tbr": 900, "protocol": "https"}


# What YouTube offers for a 4K upload: H.264 stops at 1080p, AV1/VP9 go higher.
YOUTUBE_4K = [
    _audio("140"), _audio("251", ext="webm", acodec="opus"),
    _video("134", 360, "avc1.4d401e"), _video("136", 720, "avc1.64001f"),
    _video("137", 1080, "avc1.640028", tbr=4000), _video("399", 1080, "av01.0.08M.08", tbr=2000),
    _video("400", 1440, "av01.0.12M.08", tbr=6000), _video("401", 2160, "av01.0.12M.08", tbr=12000),
    _video("313", 2160, "vp9", ext="webm", tbr=14000),
]


def _selected(quality, formats):
    """Run yt-dlp's real format selection for a quality label over fake formats."""
    import yt_dlp
    from backend.video_utils import quality_to_format
    ydl = yt_dlp.YoutubeDL({"format": quality_to_format(quality), "quiet": True, "simulate": True, "no_warnings": True})
    info = {"id": "x", "title": "t", "extractor": "youtube", "webpage_url": "https://example.com", "formats": formats}
    return ydl.process_video_result(info, download=False)["format_id"]


def test_best_means_h264_1080p_not_av1_4k():
    assert _selected("best", YOUTUBE_4K) == "137+140"


def test_unknown_label_behaves_like_best():
    assert _selected("weird", YOUTUBE_4K) == "137+140"
    assert _selected("", YOUTUBE_4K) == "137+140"
    assert _selected(None, YOUTUBE_4K) == "137+140"


def test_higher_resolutions_stay_selectable():
    assert _selected("2160p", YOUTUBE_4K) == "401+140"
    assert _selected("1440p", YOUTUBE_4K) == "400+140"


def test_labels_up_to_1080p_prefer_h264():
    assert _selected("1080p", YOUTUBE_4K) == "137+140"
    assert _selected("720p", YOUTUBE_4K) == "136+140"
    assert _selected("480p", YOUTUBE_4K) == "134+140"


def test_best_falls_back_to_another_codec_when_there_is_no_h264():
    only_av1 = [_audio("140"), _video("399", 1080, "av01.0.08M.08"), _video("401", 2160, "av01.0.12M.08")]
    assert _selected("best", only_av1) == "399+140"


def test_best_still_downloads_when_everything_is_above_1080p():
    only_4k = [_audio("140"), _video("401", 2160, "av01.0.12M.08")]
    assert _selected("best", only_4k) == "401+140"


def test_best_works_for_sites_with_single_file_formats():
    tiktok_like = [_muxed("0", 720), _muxed("1", 1024, vcodec="h265")]
    assert _selected("best", tiktok_like) in ("0", "1")


def test_best_works_when_the_only_audio_is_not_m4a():
    opus_only = [_audio("251", ext="webm", acodec="opus"), _video("137", 1080, "avc1.640028")]
    assert _selected("best", opus_only) == "137+251"


@pytest.mark.parametrize("quality", ALL_LABELS)
def test_every_label_ends_with_a_catch_all_so_downloads_never_get_stricter(quality):
    from backend.video_utils import quality_to_format
    fmt = quality_to_format(quality)
    assert fmt.endswith("/best")
    odd = [{"format_id": "only", "url": "https://example.com/only", "ext": "flv", "vcodec": "vp6", "acodec": "mp3",
            "height": 240, "width": 320, "protocol": "https"}]
    assert _selected(quality, odd) == "only"


@pytest.mark.parametrize("quality, cap", [("best", 1080), ("weird", 1080), ("1080p", 1080), ("720p", 720), ("480p", 480)])
def test_format_string_names_h264_and_the_height_cap(quality, cap):
    from backend.video_utils import quality_to_format
    fmt = quality_to_format(quality)
    assert "vcodec^=avc1" in fmt
    assert f"height<={cap}" in fmt


@patch('backend.video_utils.yt_dlp.YoutubeDL')
def test_probe_formats_returns_sorted_unique_heights(mock_ytdl):
    from backend.video_utils import probe_formats
    inst = MagicMock()
    mock_ytdl.return_value.__enter__.return_value = inst
    inst.extract_info.return_value = {
        "formats": [
            {"height": 720}, {"height": 1080}, {"height": 1080},
            {"height": None}, {"height": 480}, {}, {"height": 2160},
        ]
    }
    heights = probe_formats("https://youtu.be/x")
    assert heights == [2160, 1080, 720, 480]
    _, kwargs = inst.extract_info.call_args
    assert kwargs.get("download") is False
