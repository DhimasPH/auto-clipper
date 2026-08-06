import json
import os
import tempfile
import pytest
from backend.crop_utils import (
    hex_to_ass_style_color,
    normalize_subtitle_config,
    calculate_ass_styles,
    srt_to_ass,
    words_to_karaoke_ass,
    words_to_standard_ass,
)

def _parse_dialogue_times(ass_content: str):
    times = []
    for line in ass_content.splitlines():
        if line.startswith("Dialogue:"):
            parts = line.split(",", 9)
            st_str = parts[1].strip()
            et_str = parts[2].strip()
            text = parts[9].strip() if len(parts) > 9 else ""
            def ass_ts_to_sec(s):
                h, m, sec = s.split(":")
                return int(h) * 3600 + int(m) * 60 + float(sec)
            times.append({
                "start": ass_ts_to_sec(st_str),
                "end": ass_ts_to_sec(et_str),
                "text": text
            })
    return times

def test_hex_to_ass_style_color():
    # Format harus 8-karakter hex &H00BBGGRR tanpa trailing &
    assert hex_to_ass_style_color("#FFE600") == "&H0000E6FF"
    assert hex_to_ass_style_color("#00FF00") == "&H0000FF00"
    assert hex_to_ass_style_color("#FFFFFF") == "&H00FFFFFF"
    assert hex_to_ass_style_color("#EC4899") == "&H009948EC"
    # Fallback jika invalid
    assert hex_to_ass_style_color("") == "&H0000E6FF"
    assert hex_to_ass_style_color("invalid") == "&H0000E6FF"
    assert hex_to_ass_style_color(None) == "&H0000E6FF"

def test_normalize_subtitle_config():
    # Fallback dari config kosong / legacy style
    cfg = normalize_subtitle_config(None, legacy_style="standard")
    assert cfg["style"] == "standard"
    assert cfg["highlight_color"] == "#FFE600"
    assert cfg["font_family"] == "Arial"
    assert cfg["font_weight"] == "bold"
    assert cfg["font_size_scale"] == 1.0
    assert cfg["uppercase"] is False

    # Mode karaoke default uppercase = True
    cfg_k = normalize_subtitle_config({}, legacy_style="karaoke")
    assert cfg_k["style"] == "karaoke"
    assert cfg_k["uppercase"] is True

def test_calculate_ass_styles_with_config():
    cfg = {
        "font_family": "Impact",
        "font_size_scale": 1.2,
        "font_weight": "bold",
        "italic": False,
        "highlight_color": "#FFE600"
    }
    font_size, outline, shadow, margin_h, margin_v = calculate_ass_styles(1080, 1920, subtitle_config=cfg)
    expected_size = round(1080 * 0.055 * 1.2)
    assert abs(font_size - expected_size) <= 1

def test_srt_to_ass_with_subtitle_config():
    srt_content = "1\n00:00:01,000 --> 00:00:03,000\nHalo dunia"
    cfg = {
        "style": "standard",
        "font_family": "Trebuchet MS",
        "font_weight": "normal",
        "italic": True,
        "uppercase": True,
    }
    ass_text = srt_to_ass(srt_content, 1080, 1920, subtitle_config=cfg)
    assert "Trebuchet MS" in ass_text
    assert ",0,-1,0,0,100,100" in ass_text
    assert "HALO DUNIA" in ass_text

def test_words_to_karaoke_ass_zero_overlap_invariant():
    words = [
        {"word": "Halo", "start": 0.0, "end": 0.15},        # short word (<180ms)
        {"word": "semuanya", "start": 0.20, "end": 0.70},    # gap = 0.05s (<0.2s, bridged)
        {"word": "selamat", "start": 1.50, "end": 1.90},     # gap = 0.80s (natural pause)
        {"word": "datang", "start": 1.95, "end": 2.30},      # gap = 0.05s
    ]
    cfg = {
        "style": "karaoke",
        "highlight_color": "#FFE600",
        "font_family": "Impact",
        "font_weight": "bold",
        "uppercase": True
    }
    ass_out = words_to_karaoke_ass(words, 1080, 1920, clip_start=0.0, clip_end=3.0, subtitle_config=cfg)
    dialogues = _parse_dialogue_times(ass_out)
    assert len(dialogues) == 4
    
    # Assert Strict Global Invariant: end_i <= start_{i+1}
    for i in range(len(dialogues) - 1):
        assert dialogues[i]["end"] <= dialogues[i+1]["start"], (
            f"OVERLAP DETECTED between '{dialogues[i]['text']}' ({dialogues[i]['end']}) "
            f"and '{dialogues[i+1]['text']}' ({dialogues[i+1]['start']})"
        )

    # Single-word content
    assert dialogues[0]["text"] == "HALO"
    assert dialogues[1]["text"] == "SEMUANYA"
    assert dialogues[2]["text"] == "SELAMAT"
    assert dialogues[3]["text"] == "DATANG"
    assert "&H0000E6FF" in ass_out

def test_words_to_standard_ass():
    words = [
        {"word": "Halo", "start": 0.0, "end": 0.4},
        {"word": "semua", "start": 0.5, "end": 0.9},
        {"word": "selamat", "start": 1.0, "end": 1.4},
        {"word": "pagi.", "start": 1.5, "end": 2.0},
    ]
    cfg = {"style": "standard", "uppercase": False}
    ass_out = words_to_standard_ass(words, 1080, 1920, clip_start=0.0, clip_end=3.0, subtitle_config=cfg)
    dialogues = _parse_dialogue_times(ass_out)
    assert len(dialogues) >= 1
    # Standard mode groups words into sentence text
    assert "Halo semua" in dialogues[0]["text"] or "selamat" in dialogues[0]["text"]

def test_render_dispatch_json_to_standard():
    # Simulasi klip asal .words.json tapi user me-rerender dengan style="standard"
    with tempfile.NamedTemporaryFile("w", delete=False, suffix=".words.json", encoding="utf-8") as f:
        json.dump({"words": [{"word": "Test", "start": 0.0, "end": 1.0}]}, f)
        json_path = f.name
    try:
        cfg = {"style": "standard"}
        with open(json_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        ass_text = words_to_standard_ass(data["words"], 1080, 1920, 0.0, 2.0, subtitle_config=cfg)
        assert "Dialogue:" in ass_text
        assert "Test" in ass_text
    finally:
        os.remove(json_path)
