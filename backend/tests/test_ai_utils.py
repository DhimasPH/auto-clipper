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
