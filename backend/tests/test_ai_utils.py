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
    call_kwargs = mock_openai.call_args[1]
    assert call_kwargs.get("api_key") == "key"
    assert call_kwargs.get("base_url") == "https://api.deepseek.com"
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


def test_openai_compat_registry_has_expected_providers():
    from backend.ai_utils import OPENAI_COMPAT_PROVIDERS
    for pid in ("deepseek", "groq", "openrouter", "xai", "mistral"):
        assert pid in OPENAI_COMPAT_PROVIDERS, pid
        cfg = OPENAI_COMPAT_PROVIDERS[pid]
        assert cfg["base_url"].startswith("https://")
        assert cfg["model"]


@patch('backend.ai_utils.get_highlights')
@patch('backend.ai_utils.transcribe_with_faster_whisper')
@patch('backend.ai_utils.extract_audio')
def test_process_with_openai_compatible_routes_provider(mock_extract, mock_tx, mock_hl, tmp_path):
    from backend.ai_utils import process_with_openai_compatible, OPENAI_COMPAT_PROVIDERS
    mock_tx.return_value = "1\n00:00:01,000 --> 00:00:03,000\nhi\n"
    mock_hl.return_value = [{"start_time": "00:00:01.000", "end_time": "00:00:03.000",
                             "description_en": "a", "description_id": "b"}]
    f = tmp_path / "v.mp4"
    f.write_bytes(b"x")
    res = process_with_openai_compatible(str(f), "key", "groq")
    assert res["highlights"] == mock_hl.return_value
    assert res["subtitle_path"].endswith(".srt")
    _, kwargs = mock_hl.call_args
    assert kwargs.get("base_url") == OPENAI_COMPAT_PROVIDERS["groq"]["base_url"]
    assert kwargs.get("model") == OPENAI_COMPAT_PROVIDERS["groq"]["model"]


@patch('backend.ai_utils.get_highlights')
@patch('backend.ai_utils.transcribe_with_faster_whisper')
@patch('backend.ai_utils.extract_audio')
def test_process_with_custom_provider_uses_custom_base_url_and_model(mock_extract, mock_tx, mock_hl, tmp_path):
    from backend.ai_utils import process_with_openai_compatible
    mock_tx.return_value = "1\n00:00:01,000 --> 00:00:03,000\nhi\n"
    mock_hl.return_value = [{"start_time": "00:00:01.000", "end_time": "00:00:03.000",
                             "description_en": "a", "description_id": "b"}]
    f = tmp_path / "v.mp4"
    f.write_bytes(b"x")
    # api_key empty (local server) -> falls back to dummy "-"
    res = process_with_openai_compatible(
        str(f), "", "custom",
        custom_base_url="http://localhost:11434/v1", custom_model_name="llama3",
    )
    assert res["highlights"] == mock_hl.return_value
    args, kwargs = mock_hl.call_args
    assert kwargs.get("base_url") == "http://localhost:11434/v1"
    assert kwargs.get("model") == "llama3"
    # positional: transcript, effective_key, extra_prompt
    assert args[1] == "-"


def test_process_with_custom_provider_requires_base_url_and_model(tmp_path):
    from backend.ai_utils import process_with_openai_compatible
    import pytest
    f = tmp_path / "v.mp4"
    f.write_bytes(b"x")
    with pytest.raises(ValueError):
        process_with_openai_compatible(str(f), "key", "custom",
                                       custom_base_url="", custom_model_name="")


@patch('backend.ai_utils.OpenAI')
def test_ping_custom_provider_uses_custom_endpoint(mock_openai):
    from backend.ai_utils import ping_provider
    client = MagicMock()
    mock_openai.return_value = client
    ping_provider("custom", "", custom_base_url="http://localhost:11434/v1", custom_model_name="llama3")
    call_kwargs = mock_openai.call_args[1]
    assert call_kwargs.get("api_key") == "-"
    assert call_kwargs.get("base_url") == "http://localhost:11434/v1"
    assert call_kwargs.get("timeout") == 10.0
    _, kwargs = client.chat.completions.create.call_args
    assert kwargs["model"] == "llama3"


def test_ping_custom_provider_requires_base_url_and_model():
    from backend.ai_utils import ping_provider
    import pytest
    with pytest.raises(Exception):
        ping_provider("custom", "key", custom_base_url="", custom_model_name="")


def test_get_available_whisper_models():
    from backend.ai_utils import get_available_whisper_models
    models = get_available_whisper_models()
    assert len(models) >= 5
    ids = [m["id"] for m in models]
    assert "small" in ids
    assert "medium" in ids
    assert "large-v3" in ids
    # Default model 'small' should be marked downloaded
    small_info = next(m for m in models if m["id"] == "small")
    assert small_info["downloaded"] is True


@patch('faster_whisper.download_model')
def test_download_whisper_model_success(mock_download_model):
    from backend.ai_utils import download_whisper_model
    mock_download_model.return_value = "C:/fake/path/medium"
    res = download_whisper_model("medium")
    assert res["status"] == "success"
    assert res["model"] == "medium"
    assert res["path"] == "C:/fake/path/medium"
    mock_download_model.assert_called_once_with("medium")


def test_download_whisper_model_invalid():
    from backend.ai_utils import download_whisper_model
    import pytest
    with pytest.raises(ValueError):
        download_whisper_model("nonexistent-model-xyz")


def test_fetch_provider_models_gemini():
    from backend.ai_utils import fetch_provider_models
    from unittest.mock import MagicMock, patch

    mock_model_1 = MagicMock()
    mock_model_1.name = "models/gemini-2.5-flash"
    mock_model_1.display_name = "Gemini 2.5 Flash"
    mock_model_1.supported_actions = ["generateContent"]

    mock_model_2 = MagicMock()
    mock_model_2.name = "models/text-embedding-004"
    mock_model_2.display_name = "Embedding 004"
    mock_model_2.supported_actions = ["embedContent"]

    mock_client = MagicMock()
    mock_client.models.list.return_value = [mock_model_1, mock_model_2]

    with patch("google.genai.Client", return_value=mock_client):
        models = fetch_provider_models("gemini", "fake-key")
        assert len(models) == 1
        assert models[0]["id"] == "gemini-2.5-flash"
        assert "Gemini 2.5 Flash" in models[0]["label"]


def test_fetch_provider_models_openai():
    from backend.ai_utils import fetch_provider_models
    from unittest.mock import MagicMock, patch

    mock_model_1 = MagicMock()
    mock_model_1.id = "gpt-4o"

    mock_model_2 = MagicMock()
    mock_model_2.id = "text-embedding-3-small"

    mock_client = MagicMock()
    mock_resp = MagicMock()
    mock_resp.data = [mock_model_1, mock_model_2]
    mock_client.models.list.return_value = mock_resp

    with patch("backend.ai_utils.OpenAI", return_value=mock_client):
        models = fetch_provider_models("openai", "fake-key")
        assert len(models) == 1
        assert models[0]["id"] == "gpt-4o"


def test_transcribe_with_faster_whisper_vad_success():
    from backend.ai_utils import transcribe_with_faster_whisper
    from unittest.mock import MagicMock, patch

    mock_seg = MagicMock()
    mock_seg.start = 0.0
    mock_seg.end = 2.0
    mock_seg.text = "Hello world"
    mock_word = MagicMock()
    mock_word.word = "Hello"
    mock_word.start = 0.0
    mock_word.end = 1.0
    mock_seg.words = [mock_word]

    mock_model = MagicMock()
    mock_model.transcribe.return_value = ([mock_seg], MagicMock())

    with patch("faster_whisper.WhisperModel", return_value=mock_model):
        res = transcribe_with_faster_whisper("dummy.mp3", karaoke=False)
        assert "Hello world" in res
        mock_model.transcribe.assert_called_once_with("dummy.mp3", word_timestamps=False, vad_filter=True)

        res_k = transcribe_with_faster_whisper("dummy.mp3", karaoke=True)
        assert len(res_k["words"]) == 1
        assert res_k["words"][0]["word"] == "Hello"


def test_transcribe_with_faster_whisper_vad_fallback_on_error():
    from backend.ai_utils import transcribe_with_faster_whisper
    from unittest.mock import MagicMock, patch

    mock_seg = MagicMock()
    mock_seg.start = 0.0
    mock_seg.end = 2.0
    mock_seg.text = "Fallback text"
    mock_seg.words = []

    mock_model = MagicMock()
    
    # First call with vad_filter=True raises ONNXRuntimeError, second call with vad_filter=False succeeds
    def side_effect(path, word_timestamps=False, vad_filter=True):
        if vad_filter:
            def err_gen():
                raise RuntimeError("ONNXRuntimeError: Load model silero_vad_v6.onnx failed")
                yield
            return err_gen(), MagicMock()
        else:
            return [mock_seg], MagicMock()

    mock_model.transcribe.side_effect = side_effect

    with patch("faster_whisper.WhisperModel", return_value=mock_model):
        res = transcribe_with_faster_whisper("dummy.mp3", karaoke=False)
        assert "Fallback text" in res
        assert mock_model.transcribe.call_count == 2



