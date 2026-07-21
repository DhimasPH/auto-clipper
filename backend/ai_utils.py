import json
import os
import random
import time
from openai import OpenAI
from google import genai
from google.genai import types

from backend.video_utils import extract_audio
from backend.crop_utils import to_seconds, _fmt_srt_ts
from backend.logger import log_ai


_TRANSIENT_MARKERS = (
    "unavailable", "overloaded", "high demand", "temporarily",
    "resource_exhausted", "rate limit", "timeout", "try again",
    "500", "502", "503", "504", "524",
)


def _is_transient(err) -> bool:
    """True for errors worth retrying (server overload, rate spikes, timeouts)."""
    code = getattr(err, "code", None) or getattr(err, "status_code", None)
    if code in (429, 500, 502, 503, 504, 524):
        return True
    msg = str(err).lower()
    return any(marker in msg for marker in _TRANSIENT_MARKERS)


def _with_retry(fn, attempts: int = 4, base_delay: float = 2.0):
    """Call ``fn`` with exponential backoff on transient API errors."""
    for i in range(attempts):
        try:
            return fn()
        except Exception as e:
            if not _is_transient(e) or i == attempts - 1:
                raise
            time.sleep(base_delay * (2 ** i) + random.uniform(0, 0.5))


HIGHLIGHT_GUIDANCE = (
    "Pick the most engaging, self-contained moments for vertical short-form "
    "video (TikTok/Reels/Shorts). Each highlight must: start on a strong hook, "
    "contain a complete thought AND a complete sentence (NEVER cut off mid-sentence or mid-word), be genuinely "
    "interesting/funny/surprising on its own without context, and run about "
    "15-45 seconds. Set start/end precisely on natural speech pauses (silence). "
    "Ensure that the first word is clearly spoken from the beginning and the last word finishes completely. "
    "Return them in chronological order and avoid intros, filler, and dead air."
)


def build_srt_from_segments(segments) -> str:
    """Turn a list of {start_time, end_time, text} into SRT text."""
    lines = []
    idx = 1
    for seg in segments or []:
        if not isinstance(seg, dict):
            continue
        st = to_seconds(seg.get("start_time"))
        et = to_seconds(seg.get("end_time"))
        text = str(seg.get("text") or "").strip()
        if not text or et <= st:
            continue
        lines.append(f"{idx}\n{_fmt_srt_ts(st)} --> {_fmt_srt_ts(et)}\n{text}")
        idx += 1
    return "\n\n".join(lines) + ("\n" if lines else "")


def transcribe_audio(audio_path: str, api_key: str, karaoke: bool = False):
    """Transcribe an audio file using OpenAI Whisper."""
    client = OpenAI(api_key=api_key)
    with open(audio_path, "rb") as audio_file:
        if karaoke:
            transcript = _with_retry(lambda: client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file,
                response_format="verbose_json",
                timestamp_granularities=["word"]
            ))
            # Return dict for verbose_json
            return transcript.model_dump()
        else:
            transcript = _with_retry(lambda: client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file,
                response_format="srt",
            ))
            return transcript


def _parse_highlights(content: str) -> list:
    try:
        parsed = json.loads(content)
    except Exception as e:
        print(f"Failed to parse highlights: {e}")
        return []

    if isinstance(parsed, list):
        return parsed
    if isinstance(parsed, dict):
        if "highlights" in parsed:
            return parsed["highlights"]
        for value in parsed.values():
            if isinstance(value, list):
                return value
    return []


def get_highlights(transcript_srt: str, api_key: str, extra_prompt: str = "", base_url: str = None, model: str = "gpt-4o-mini", limit: int = 3) -> list:
    """Ask the LLM to pick the most engaging short-form highlights.

    ``base_url``/``model`` let OpenAI-compatible providers (e.g. DeepSeek)
    reuse this same flow.
    """
    client = OpenAI(api_key=api_key, base_url=base_url) if base_url else OpenAI(api_key=api_key)
    
    additional_instructions = f"\n\nUSER'S EXTRA INSTRUCTIONS:\n{extra_prompt}" if extra_prompt else ""
    additional_instructions += f"\nFind up to {limit} of the best highlights."
    
    prompt = (
        "Analyze the following video transcript (SRT format). "
        f"{HIGHLIGHT_GUIDANCE}{additional_instructions}\n\n"
        "Return a JSON object with a 'highlights' key holding an array of "
        "objects with 'start_time', 'end_time' (in HH:MM:SS.mmm format), "
        "'description_en' (in English), 'description_id' (in Indonesian), "
        "and 'broll_query_en' (a 1-2 word English search query for B-Roll video matching the topic).\n\n"
        f"Transcript:\n{transcript_srt}"
    )
    response = _with_retry(lambda: client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": "You are a professional short-form video editor who finds viral moments. Always return strictly valid JSON."},
            {"role": "user", "content": prompt},
        ],
        response_format={"type": "json_object"},
    ))
    response_text = response.choices[0].message.content
    log_ai("openai_compatible", model, prompt, response_text)
    return _parse_highlights(response_text)


def process_with_openai(file_path: str, api_key: str, karaoke: bool = False, extra_prompt: str = "", limit: int = 3, is_cancelled: callable = None, register_proc: callable = None) -> dict:
    """Full OpenAI pipeline: extract audio -> transcribe -> find highlights."""
    base, _ = os.path.splitext(file_path)
    audio_path = base + "_audio.mp3"

    extract_audio(file_path, audio_path, register_proc=register_proc)
    if is_cancelled and is_cancelled(): raise Exception("Cancelled by user")
    transcript = transcribe_audio(audio_path, api_key, karaoke=karaoke)

    if karaoke:
        subtitle_path = base + ".words.json"
        with open(subtitle_path, "w", encoding="utf-8") as f:
            json.dump(transcript, f)
        # Convert to SRT for Gemini prompt if needed
        transcript_text = transcript.get("text", "")
    else:
        subtitle_path = base + ".srt"
        with open(subtitle_path, "w", encoding="utf-8") as f:
            f.write(str(transcript))
        transcript_text = str(transcript)

    if is_cancelled and is_cancelled(): raise Exception("Cancelled by user")
    highlights = get_highlights(transcript_text, api_key, extra_prompt, limit=limit)

    return {
        "transcript": transcript_text,
        "highlights": highlights,
        "subtitle_path": subtitle_path,
    }


def transcribe_with_faster_whisper(audio_path: str, karaoke: bool = False, is_cancelled: callable = None):
    import os
    
    # Suppress Windows DLL missing error popups (so it falls back to CPU gracefully)
    if os.name == 'nt':
        import ctypes
        # SEM_FAILCRITICALERRORS (0x0001) | SEM_NOOPENFILEERRORBOX (0x8000)
        ctypes.windll.kernel32.SetErrorMode(0x0001 | 0x8000)
        
        # Add NVIDIA pip packages to DLL path if they exist
        try:
            import nvidia.cublas
            import nvidia.cudnn
            os.add_dll_directory(os.path.join(os.path.dirname(nvidia.cublas.__file__), "bin"))
            os.add_dll_directory(os.path.join(os.path.dirname(nvidia.cudnn.__file__), "bin"))
        except Exception:
            pass

    # Let faster-whisper automatically choose GPU if available, else fallback to CPU.
    try:
        from faster_whisper import WhisperModel
        model = WhisperModel("small", device="auto", compute_type="default")
        segments_gen, info = model.transcribe(audio_path, word_timestamps=karaoke)
        segments = []
        for segment in segments_gen:
            if is_cancelled and is_cancelled():
                raise Exception("Transcription cancelled by user")
            segments.append(segment)
    except Exception as e:
        print(f"Warning: GPU Transcription failed ({e}). Falling back to CPU.")
        from faster_whisper import WhisperModel
        model = WhisperModel("small", device="cpu", compute_type="default")
        segments_gen, info = model.transcribe(audio_path, word_timestamps=karaoke)
        segments = []
        for segment in segments_gen:
            if is_cancelled and is_cancelled():
                raise Exception("Transcription cancelled by user")
            segments.append(segment)
    
    if karaoke:
        words_data = []
        for segment in segments:
            for word in segment.words:
                words_data.append({
                    "word": word.word.strip(),
                    "start": word.start,
                    "end": word.end
                })
        return {"words": words_data}
    else:
        from backend.crop_utils import _fmt_srt_ts
        srt_lines = []
        for idx, segment in enumerate(segments, start=1):
            srt_lines.append(f"{idx}\n{_fmt_srt_ts(segment.start)} --> {_fmt_srt_ts(segment.end)}\n{segment.text.strip()}")
        return "\n\n".join(srt_lines) + "\n"


def process_with_gemini(file_path: str, api_key: str, karaoke: bool = False, extra_prompt: str = "", model_name: str = "gemini-2.0-flash", limit: int = 3, is_cancelled: callable = None, register_proc: callable = None) -> dict:
    import json
    import os
    import time
    from backend.video_utils import extract_audio
    
    client = genai.Client(api_key=api_key)

    base, _ = os.path.splitext(file_path)
    audio_path = base + "_audio.mp3"
    extract_audio(file_path, audio_path, register_proc=register_proc)
    
    if is_cancelled and is_cancelled(): raise Exception("Cancelled by user")
    transcript_data = transcribe_with_faster_whisper(audio_path, karaoke=karaoke, is_cancelled=is_cancelled)
    
    if karaoke:
        subtitle_path = base + ".words.json"
        with open(subtitle_path, "w", encoding="utf-8") as f:
            json.dump(transcript_data, f)
        transcript_text = " ".join([w["word"] for w in transcript_data.get("words", [])])
    else:
        subtitle_path = base + ".srt"
        transcript_text = transcript_data
        with open(subtitle_path, "w", encoding="utf-8") as f:
            f.write(transcript_text)

    if is_cancelled and is_cancelled(): raise Exception("Cancelled by user")
    video_file = client.files.upload(file=file_path)

    while video_file.state.name == "PROCESSING":
        if is_cancelled and is_cancelled(): raise Exception("Cancelled by user")
        time.sleep(2)
        video_file = client.files.get(name=video_file.name)

    if video_file.state.name == "FAILED":
        raise Exception("Gemini failed to process the video.")

    additional_instructions = f"\n\nUSER'S EXTRA INSTRUCTIONS:\n{extra_prompt}" if extra_prompt else ""
    additional_instructions += f"\nFind up to {limit} of the best highlights."

    prompt = (
        "Watch this video and read the following accurate transcript. "
        f"{HIGHLIGHT_GUIDANCE}{additional_instructions}\n\n"
        "Return a JSON object with a 'highlights' key holding an array of "
        "objects with 'start_time', 'end_time' (HH:MM:SS.mmm), 'description_en' (in English), 'description_id' (in Indonesian), "
        "and 'broll_query_en' (a 1-2 word English search query for B-Roll video matching the topic).\n\n"
        f"Transcript:\n{transcript_text[:30000]}"
    )

    if is_cancelled and is_cancelled(): raise Exception("Cancelled by user")
    response = _with_retry(lambda: client.models.generate_content(
        model=model_name,
        contents=[video_file, prompt],
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
        ),
    ))

    response_text = response.text
    log_ai("gemini", model_name, prompt, response_text)
    highlights = _parse_highlights(response_text)

    return {
        "transcript": transcript_text,
        "highlights": highlights,
        "subtitle_path": subtitle_path,
    }


# OpenAI-compatible providers: transcription is local (faster-whisper), and
# these endpoints only pick highlights from the transcript text via the
# standard chat.completions API, so one code path serves them all.
OPENAI_COMPAT_PROVIDERS = {
    "deepseek": {"base_url": "https://api.deepseek.com", "model": "deepseek-chat"},
    "groq": {"base_url": "https://api.groq.com/openai/v1", "model": "llama-3.3-70b-versatile"},
    "openrouter": {"base_url": "https://openrouter.ai/api/v1", "model": "openai/gpt-4o-mini"},
    "xai": {"base_url": "https://api.x.ai/v1", "model": "grok-2-latest"},
    "mistral": {"base_url": "https://api.mistral.ai/v1", "model": "mistral-large-latest"},
}


def process_with_openai_compatible(file_path: str, api_key: str, provider: str,
                                   karaoke: bool = False, extra_prompt: str = "", limit: int = 3, is_cancelled: callable = None, register_proc: callable = None,
                                   custom_base_url: str = None, custom_model_name: str = None) -> dict:
    """Local faster-whisper transcript -> an OpenAI-compatible LLM picks highlights.

    For ``provider == "custom"`` the caller supplies ``custom_base_url`` and
    ``custom_model_name`` (e.g. a local Ollama/LMStudio/vLLM server). Otherwise
    the built-in ``OPENAI_COMPAT_PROVIDERS`` registry is used.
    """
    if provider == "custom":
        if not custom_base_url or not custom_model_name:
            raise ValueError("Custom provider requires a Base URL and Model Name.")
        base_url, model = custom_base_url, custom_model_name
    else:
        cfg = OPENAI_COMPAT_PROVIDERS.get(provider)
        if not cfg:
            raise ValueError(f"Unknown OpenAI-compatible provider: {provider}")
        base_url, model = cfg["base_url"], cfg["model"]

    base, _ = os.path.splitext(file_path)
    audio_path = base + "_audio.mp3"
    extract_audio(file_path, audio_path, register_proc=register_proc)

    if is_cancelled and is_cancelled(): raise Exception("Cancelled by user")
    transcript_data = transcribe_with_faster_whisper(audio_path, karaoke=karaoke, is_cancelled=is_cancelled)

    if karaoke:
        subtitle_path = base + ".words.json"
        with open(subtitle_path, "w", encoding="utf-8") as f:
            json.dump(transcript_data, f)
        transcript_text = " ".join([w["word"] for w in transcript_data.get("words", [])])
    else:
        subtitle_path = base + ".srt"
        transcript_text = transcript_data
        with open(subtitle_path, "w", encoding="utf-8") as f:
            f.write(transcript_text)

    if is_cancelled and is_cancelled(): raise Exception("Cancelled by user")
    # Local servers (Ollama/LMStudio) often need no key; the OpenAI client still
    # wants a non-empty string, so fall back to a dummy for the custom provider.
    effective_key = api_key or "-" if provider == "custom" else api_key
    highlights = get_highlights(
        transcript_text, effective_key, extra_prompt,
        base_url=base_url, model=model, limit=limit
    )

    return {
        "transcript": transcript_text,
        "highlights": highlights,
        "subtitle_path": subtitle_path,
    }


def process_with_deepseek(file_path: str, api_key: str, karaoke: bool = False, extra_prompt: str = "", limit: int = 3, is_cancelled: callable = None, register_proc: callable = None) -> dict:
    """Back-compat wrapper -> process_with_openai_compatible(..., "deepseek")."""
    return process_with_openai_compatible(file_path, api_key, "deepseek", karaoke=karaoke, extra_prompt=extra_prompt, limit=limit, is_cancelled=is_cancelled, register_proc=register_proc)

def ping_provider(provider: str, api_key: str, custom_base_url: str = None, custom_model_name: str = None) -> None:
    """Pre-flight check to fail-fast on invalid keys, bad URLs or exhausted quotas."""
    if provider == "custom":
        if not custom_base_url or not custom_model_name:
            raise Exception("Custom provider requires a Base URL and Model Name.")
        try:
            # api_key is optional for local servers; the client needs a non-empty string.
            client = OpenAI(api_key=api_key or "-", base_url=custom_base_url, timeout=10.0)
            client.chat.completions.create(
                model=custom_model_name,
                messages=[{"role": "user", "content": "ping"}],
                max_tokens=1,
            )
        except Exception as e:
            if _is_transient(e):
                return
            msg = getattr(e, "message", None) or str(e)
            raise Exception(f"AI Provider Error: {msg}")
        return

    if not api_key:
        raise Exception(f"API Key for {provider} is missing.")

    try:
        if provider.startswith("gemini"):
            client = genai.Client(api_key=api_key)
            model_name = provider if provider != "gemini" else "gemini-2.0-flash"
            # We use genai's built-in timeout via http_options if available, or rely on normal timeout
            try:
                client.models.generate_content(
                    model=model_name,
                    contents="ping",
                    config=types.GenerateContentConfig(max_output_tokens=1)
                )
            except Exception as e:
                # Fallback if the default 2.0 is not available in their region
                if model_name == "gemini-2.0-flash":
                    client.models.generate_content(
                        model="gemini-1.5-flash",
                        contents="ping",
                        config=types.GenerateContentConfig(max_output_tokens=1)
                    )
                else:
                    raise e
        else:
            cfg = OPENAI_COMPAT_PROVIDERS.get(provider)
            if cfg:
                client = OpenAI(api_key=api_key, base_url=cfg["base_url"], timeout=10.0)
                model = cfg["model"]
            else:
                client = OpenAI(api_key=api_key, timeout=10.0)
                model = "gpt-4o-mini"
            
            client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": "ping"}],
                max_tokens=1
            )
    except Exception as e:
        if _is_transient(e):
            # Transient error (server overloaded, etc.) - let it pass.
            # The actual job uses retry logic, so it might succeed later.
            return
            
        msg = getattr(e, "message", None) or str(e)
        raise Exception(f"AI Provider Error: {msg}")
