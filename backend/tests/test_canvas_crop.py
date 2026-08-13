import pytest
from unittest.mock import patch, MagicMock
from backend.crop_utils import build_canvas_background_filter, crop_to_vertical, srt_to_ass, words_to_single_word_ass


def test_build_canvas_background_filter_blur():
    cfg = {
        "enabled": True,
        "background_type": "blur",
        "blur_level": "medium",
        "enlarge_scale": 1.0
    }
    filter_complex = build_canvas_background_filter(cfg, 1920, 1080, 1080, 1920, 5.0)
    assert "boxblur=luma_radius=25" in filter_complex
    assert "overlay=(W-w)/2:(H-h)/2" in filter_complex


def test_build_canvas_background_filter_color():
    cfg = {
        "enabled": True,
        "background_type": "color",
        "background_color": "#1E293B",
        "enlarge_scale": 1.2
    }
    filter_complex = build_canvas_background_filter(cfg, 1920, 1080, 1080, 1920, 5.0)
    assert "color=c=0x1E293B:s=1080x1920:d=5.000" in filter_complex
    assert "overlay=(W-w)/2:(H-h)/2" in filter_complex


def test_build_canvas_background_filter_image():
    cfg = {
        "enabled": True,
        "background_type": "image",
        "enlarge_scale": 1.5
    }
    filter_complex = build_canvas_background_filter(cfg, 1920, 1080, 1080, 1920, 5.0, bg_img_stream_idx=1)
    assert "[1:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920[bg]" in filter_complex
    assert "scale=1620:-2" in filter_complex


def test_srt_to_ass_with_custom_margin():
    srt = "1\n00:00:01,000 --> 00:00:04,500\nHello Canvas\n"
    ass = srt_to_ass(srt, 1080, 1920, custom_margin_v=450)
    assert "PlayResX: 1080" in ass
    assert "PlayResY: 1920" in ass
    assert "450" in ass


def test_words_to_single_word_ass_with_custom_margin():
    words = [
        {"word": "Test", "start": 0.0, "end": 0.5},
        {"word": "Margin", "start": 0.5, "end": 1.0},
    ]
    ass = words_to_single_word_ass(words, 1080, 1920, 0.0, 1.0, custom_margin_v=400)
    assert "PlayResX: 1080" in ass
    assert "PlayResY: 1920" in ass
    assert "400" in ass


def _fake_proc(returncode):
    p = MagicMock()
    p.communicate.return_value = (b"", b"")
    p.returncode = returncode
    p.poll.return_value = returncode
    return p


@patch('backend.crop_utils.is_nvenc_available', return_value=False)
@patch('backend.crop_utils.subprocess.Popen')
def test_crop_to_vertical_canvas_mode(mock_popen, mock_nvenc):
    mock_popen.return_value = _fake_proc(0)
    canvas_cfg = {
        "enabled": True,
        "background_type": "blur",
        "blur_level": "medium",
        "enlarge_scale": 1.0
    }
    res = crop_to_vertical("in.mp4", "out.mp4", "00:00:00", "00:00:05", aspect_ratio="9:16", canvas_config=canvas_cfg)
    assert res == "out.mp4"
    mock_popen.assert_called_once()
    cmd = mock_popen.call_args[0][0]
    assert "-filter_complex" in cmd
    fc_idx = cmd.index("-filter_complex")
    fc = cmd[fc_idx + 1]
    assert "boxblur" in fc
