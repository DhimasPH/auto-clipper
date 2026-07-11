from backend.ai_utils import transcribe_audio, get_highlights
from unittest.mock import patch, MagicMock

@patch('backend.ai_utils.OpenAI')
def test_transcribe_audio(mock_openai, tmp_path):
    mock_client = MagicMock()
    mock_openai.return_value = mock_client
    mock_client.audio.transcriptions.create.return_value = "WEBVTT\n\n00:00.000 --> 00:05.000\nHello world"
    
    # Create dummy file
    dummy_file = tmp_path / "dummy.mp4"
    dummy_file.write_text("dummy content")
    
    res = transcribe_audio(str(dummy_file), "fake-key")
    assert "WEBVTT" in res
    mock_client.audio.transcriptions.create.assert_called_once()

@patch('backend.ai_utils.OpenAI')
def test_get_highlights(mock_openai):
    mock_client = MagicMock()
    mock_openai.return_value = mock_client
    
    # Mock JSON response
    mock_response = MagicMock()
    mock_response.choices[0].message.content = '{"highlights": [{"start_time": "00:00:00.000", "end_time": "00:00:30.000", "description_en": "Intro", "description_id": "Pembukaan"}]}'
    mock_client.chat.completions.create.return_value = mock_response
    
    res = get_highlights("dummy transcript", "fake-key")
    assert len(res) == 1
    assert res[0]['description_en'] == "Intro"
    assert res[0]['description_id'] == "Pembukaan"


@patch('backend.ai_utils.OpenAI')
def test_get_highlights_uses_base_url_and_model(mock_openai):
    client = MagicMock()
    mock_openai.return_value = client
    resp = MagicMock()
    resp.choices[0].message.content = '{"highlights":[{"start_time":"00:00:01.000","end_time":"00:00:05.000","description_en":"x","description_id":"y"}]}'
    client.chat.completions.create.return_value = resp

    from backend.ai_utils import get_highlights
    hl = get_highlights("1\n00:00:01,000 --> 00:00:05,000\nhi\n", "key",
                        base_url="https://api.deepseek.com", model="deepseek-chat")
    assert len(hl) == 1
    mock_openai.assert_called_with(api_key="key", base_url="https://api.deepseek.com")
    _, kwargs = client.chat.completions.create.call_args
    assert kwargs["model"] == "deepseek-chat"


@patch('backend.ai_utils.get_highlights')
@patch('backend.ai_utils.transcribe_with_faster_whisper')
@patch('backend.ai_utils.extract_audio')
def test_process_with_deepseek(mock_extract, mock_tx, mock_hl, tmp_path):
    mock_tx.return_value = "1\n00:00:01,000 --> 00:00:03,000\nhello\n"
    mock_hl.return_value = [{"start_time": "00:00:01.000", "end_time": "00:00:03.000",
                             "description_en": "a", "description_id": "b"}]
    from backend.ai_utils import process_with_deepseek
    f = tmp_path / "v.mp4"
    f.write_bytes(b"x")
    res = process_with_deepseek(str(f), "key")
    assert res["highlights"] == mock_hl.return_value
    assert res["subtitle_path"].endswith(".srt")
    assert res["transcript"].strip().startswith("1")
    _, kwargs = mock_hl.call_args
    assert kwargs.get("base_url") == "https://api.deepseek.com"
    assert kwargs.get("model") == "deepseek-chat"
