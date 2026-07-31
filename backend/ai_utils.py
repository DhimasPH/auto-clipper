import json
import os
import random
import time
from openai import OpenAI
from google import genai
from google.genai import types
from datetime import datetime as _dt, timezone as _tz

from backend.video_utils import extract_audio
from backend.crop_utils import to_seconds, _fmt_srt_ts
from backend.logger import log_ai


BROWSER_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json",
}

_TRANSIENT_MARKERS = (
    "unavailable", "overloaded", "high demand", "temporarily",
    "resource_exhausted", "rate limit", "timeout", "try again",
    "500", "502", "503", "504", "524",
    "getaddrinfo failed", "connecterror", "connectionerror",
    "connection error", "name resolution", "host is unreachable",
    "socket.gaierror", "network is unreachable", "connection aborted",
    "connection reset"
)


def _is_transient(err) -> bool:
    """True for errors worth retrying (server overload, rate spikes, timeouts)."""
    code = getattr(err, "code", None) or getattr(err, "status_code", None)
    try:
        code = int(code) if code is not None else None
    except (ValueError, TypeError):
        code = None
        
    msg = str(err).lower()
    
    # Auth failures are NEVER transient: retrying won't fix a bad/missing
    # key, and ping_provider must not swallow them as "valid".
    if code in (401, 403):
        return False
        
    # Belt-and-braces: some SDKs omit the status code but the message still
    # identifies an auth problem.
    if "api key" in msg and ("provided" in msg or "invalid" in msg or "incorrect" in msg or "missing" in msg):
        return False
    if "authentication" in msg or "unauthorized" in msg or "invalid_api_key" in msg or "invalid token" in msg:
        return False
        
    # A missing/unsupported model is a config error, not a transient blip —
    # retrying won't make the provider serve a model it doesn't have. Some
    # gateways (e.g. livrouter) wrap this in a 503, so check before markers.
    if "model_not_found" in msg or "no available channel" in msg or "does not exist" in msg:
        return False
        
    # If we haven't hit a hard failure above, check if the code or message indicates a transient error.
    if code == 429 or (code is not None and 500 <= code < 600):
        return True
        
    return any(marker in msg for marker in _TRANSIENT_MARKERS)


def _with_retry(fn, attempts: int = 4, base_delay: float = 2.0):
    """Call ``fn`` with exponential backoff on transient API errors."""
    for i in range(attempts):
        try:
            return fn()
        except Exception as e:
            if not _is_transient(e) or i == attempts - 1:
                raise
            delay = base_delay * (2 ** i) + random.uniform(0, 0.5)
            from backend.logger import log_app
            msg = getattr(e, "message", None) or str(e)
            log_app(f"AI API transient error: {msg}. Retrying in {delay:.2f}s (Attempt {i+1} of {attempts-1})")
            time.sleep(delay)


HIGHLIGHT_GUIDANCE = (
    "Pick the most engaging, self-contained moments for vertical short-form "
    "video (TikTok/Reels/Shorts). Each highlight must: start on a STRONG hook that grabs attention in the first 2 seconds, "
    "contain a complete thought AND a complete sentence (NEVER cut mid-sentence or mid-word), be genuinely "
    "interesting/funny/surprising on its own without context, and run strictly between "
    "20-120 seconds. Set start/end PRECISELY on natural speech pauses (silence gaps). "
    "Prefer longer clips (60-90s) when the narrative arc is compelling, but allow shorter (20-30s) for punchy standalone moments. "
    "Ensure that the first word is clearly spoken from the beginning and the last word finishes completely. "
    "Return them in chronological order and avoid intros, filler, and dead air."
)


def _get_user_datetime_context() -> str:
    now = _dt.now().astimezone()
    dt_str = now.strftime("%A, %Y-%m-%d %H:%M")
    tz_offset_hours = now.utcoffset().total_seconds() / 3600
    tz_sign = "+" if tz_offset_hours >= 0 else "-"
    tz_str = f"UTC{tz_sign}{abs(int(tz_offset_hours))}"
    return f"Current user local time: {dt_str} {tz_str}"


SOCIAL_PROMPT_TEMPLATE = (
    "Return a JSON object with a 'highlights' key holding an array of objects. "
    "Each object must have 'start_time', 'end_time' (in HH:MM:SS.mmm format), "
    "'description_en' (in English), 'description_id' (in Indonesian), "
    "and 'broll_query_en' (STRICTLY 1-2 visual English words, e.g. 'coding man', 'fast car').\n"
    "ALSO, include a nested 'social' object with the following keys:\n"
    "- 'titles_en': Array of 3 English titles (Clickbait, Educational, Minimalist)\n"
    "- 'titles_id': Array of 3 Indonesian titles (Clickbait, Edukatif, Minimalis)\n"
    "- 'thumbnail_layout': English string describing a visual layout and hook text for a thumbnail\n"
    "- 'description_en': English video description with a CTA\n"
    "- 'description_id': Indonesian video description with a CTA\n"
    "- 'hashtags_en': Array of 5-7 English hashtags\n"
    "- 'hashtags_id': Array of 5-7 Indonesian hashtags\n"
    "- 'best_time_to_post_en': English recommendation for the best day+time to post this specific clip for maximum engagement, based on the content type/topic and the user's timezone. Include the specific date and time window.\n"
    "- 'best_time_to_post_id': Same but in Indonesian\n"
    "- 'backsound_en': English recommendation for background music - suggest specific song names and artists that match the clip's mood/vibe/energy, plus the genre. Example: \"Upbeat lo-fi hip hop, e.g. 'Snowman' by WYS or 'Coffee' by beabadoobee\"\n"
    "- 'backsound_id': Same but in Indonesian\n\n"
    "{datetime_context}"
)


def build_srt_from_segments(segments) -> str:
    """Turn a list of {start_time, end_time, text} or {start, end, text} into SRT text."""
    lines = []
    idx = 1
    for seg in segments or []:
        if not isinstance(seg, dict):
            continue
        st = to_seconds(seg.get("start_time") or seg.get("start"))
        et = to_seconds(seg.get("end_time") or seg.get("end"))
        text = str(seg.get("text") or "").strip()
        if not text or et <= st:
            continue
        lines.append(f"{idx}\n{_fmt_srt_ts(st)} --> {_fmt_srt_ts(et)}\n{text}")
        idx += 1
    return "\n\n".join(lines) + ("\n" if lines else "")


def transcribe_audio(audio_path: str, api_key: str, karaoke: bool = False):
    """Transcribe an audio file using OpenAI Whisper."""
    client = OpenAI(api_key=api_key, default_headers=BROWSER_HEADERS)
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


def _clean_json_response(content: str) -> str:
    import re
    content = content.strip()
    # Find JSON block regardless of leading/trailing text
    match = re.search(r"```(?:json)?\s*(.*?)\s*```", content, re.DOTALL)
    if match:
        return match.group(1).strip()
    # Fallback if the AI returned partial markdown or just the JSON
    content = re.sub(r"^```(?:json)?\s*", "", content)
    content = re.sub(r"\s*```$", "", content)
    return content.strip()


def _parse_highlights(content: str) -> list:
    content = _clean_json_response(content)
    
    try:
        parsed = json.loads(content)
        if isinstance(parsed, list):
            return parsed
        if isinstance(parsed, dict):
            if "highlights" in parsed:
                return parsed["highlights"]
            for value in parsed.values():
                if isinstance(value, list):
                    return value
    except Exception as e:
        print(f"Failed to parse highlights as full JSON: {e}")
        # Fallback: Extract just the highlights array by balancing brackets
        idx = content.find('"highlights"')
        if idx != -1:
            start_idx = content.find('[', idx)
            if start_idx != -1:
                bracket_count = 0
                end_idx = -1
                in_string = False
                escape = False
                for i in range(start_idx, len(content)):
                    char = content[i]
                    if escape:
                        escape = False
                        continue
                    if char == '\\':
                        escape = True
                        continue
                    if char == '"':
                        in_string = not in_string
                        continue
                    
                    if not in_string:
                        if char == '[':
                            bracket_count += 1
                        elif char == ']':
                            bracket_count -= 1
                            if bracket_count == 0:
                                end_idx = i
                                break
                
                if end_idx != -1:
                    array_str = content[start_idx:end_idx+1]
                    try:
                        parsed_array = json.loads(array_str)
                        if isinstance(parsed_array, list):
                            return parsed_array
                    except Exception as e2:
                        print(f"Failed to parse extracted highlights array: {e2}")

    return []


def get_highlights(transcript_srt: str, api_key: str, extra_prompt: str = "", base_url: str = None, model: str = "gpt-4o-mini", limit: int = 3) -> list:
    """Ask the LLM to pick the most engaging short-form highlights.

    ``base_url``/``model`` let OpenAI-compatible providers (e.g. DeepSeek)
    reuse this same flow.
    """
    client = OpenAI(api_key=api_key, base_url=base_url, default_headers=BROWSER_HEADERS) if base_url else OpenAI(api_key=api_key, default_headers=BROWSER_HEADERS)
    
    additional_instructions = f"\n\nUSER'S EXTRA INSTRUCTIONS:\n{extra_prompt}" if extra_prompt else ""
    additional_instructions += f"\nFind up to {limit} of the best highlights."
    
    prompt = (
        "Analyze the following video transcript (SRT format). "
        f"{HIGHLIGHT_GUIDANCE}{additional_instructions}\n\n"
        f"{SOCIAL_PROMPT_TEMPLATE.format(datetime_context=_get_user_datetime_context())}\n\n"
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


def generate_manual_prompt(transcript_srt: str, extra_prompt: str = "", limit: int = 3) -> str:
    """Generate the prompt string that users will manually copy to their AI chat."""
    system_prompt = "System Instruction: You are a professional short-form video editor who finds viral moments. Always return strictly valid JSON."
    
    additional_instructions = f"\n\nUSER'S EXTRA INSTRUCTIONS:\n{extra_prompt}" if extra_prompt else ""
    additional_instructions += f"\nFind up to {limit} of the best highlights."
    
    prompt = (
        "Analyze the following video transcript (SRT format). "
        f"{HIGHLIGHT_GUIDANCE}{additional_instructions}\n\n"
        f"{SOCIAL_PROMPT_TEMPLATE.format(datetime_context=_get_user_datetime_context())}\n\n"
        f"Transcript:\n{transcript_srt}"
    )
    return f"{system_prompt}\n\n{prompt}"


def generate_social_kit_only(description: str, api_key: str, provider: str = "openai", base_url: str = None, model: str = None) -> dict:
    """Generate just the social kit for a specific clip description."""
    prompt = (
        "Based on the following short video clip description, generate a social media kit with engaging titles, descriptions, hashtags, best posting times, and background music recommendations.\n"
        "Return strictly valid JSON with NO Markdown formatting.\n"
        "The JSON MUST be a single object with the following keys:\n"
        "- 'titles_en': Array of 3 English titles (Clickbait, Educational, Minimalist)\n"
        "- 'titles_id': Array of 3 Indonesian titles (Clickbait, Edukatif, Minimalis)\n"
        "- 'thumbnail_layout': English string describing a visual layout and hook text for a thumbnail\n"
        "- 'description_en': English video description with a CTA\n"
        "- 'description_id': Indonesian video description with a CTA\n"
        "- 'hashtags_en': Array of 5-7 English hashtags\n"
        "- 'hashtags_id': Array of 5-7 Indonesian hashtags\n"
        "- 'best_time_to_post_en': English recommendation for the best day+time to post this specific clip for maximum engagement, based on the content type/topic and the user's timezone. Include the specific date and time window.\n"
        "- 'best_time_to_post_id': Same but in Indonesian\n"
        "- 'backsound_en': English recommendation for background music - suggest specific song names and artists that match the clip's mood/vibe/energy, plus the genre. Example: \"Upbeat lo-fi hip hop, e.g. 'Snowman' by WYS or 'Coffee' by beabadoobee\"\n"
        "- 'backsound_id': Same but in Indonesian\n\n"
        f"{_get_user_datetime_context()}\n\n"
        f"Clip Description:\n{description}"
    )

    if provider.startswith("gemini"):
        from google import genai
        from google.genai import types
        client = genai.Client(api_key=api_key)
        model_name = provider if provider != "gemini" else "gemini-2.0-flash"
        response = _with_retry(lambda: client.models.generate_content(
            model=model_name,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
            )
        ))
        response_text = response.text
        log_ai("gemini", model_name, prompt, response_text)
    else:
        from openai import OpenAI
        
        effective_base_url = base_url
        effective_model = model
        
        if provider in OPENAI_COMPAT_PROVIDERS:
            cfg = OPENAI_COMPAT_PROVIDERS[provider]
            effective_base_url = effective_base_url or cfg["base_url"]
            effective_model = effective_model or cfg["model"]
            
        client = OpenAI(api_key=api_key, base_url=effective_base_url, default_headers=BROWSER_HEADERS) if effective_base_url else OpenAI(api_key=api_key, default_headers=BROWSER_HEADERS)
        model_name = effective_model or "gpt-4o-mini"
        response = _with_retry(lambda: client.chat.completions.create(
            model=model_name,
            messages=[
                {"role": "system", "content": "You are a professional social media manager. Always return strictly valid JSON."},
                {"role": "user", "content": prompt},
            ],
            response_format={"type": "json_object"},
        ))
        response_text = response.choices[0].message.content
        log_ai("openai_compatible" if effective_base_url else "openai", model_name, prompt, response_text)
        
    try:
        response_text = _clean_json_response(response_text)
        parsed = json.loads(response_text)
        return parsed
    except Exception as e:
        print(f"Failed to parse social kit: {e}")
        return {}

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
        # Build SRT from OpenAI verbose_json segments for the AI prompt
        raw_segments = transcript.get("segments", [])
        srt_segments = [{"start": s.get("start"), "end": s.get("end"), "text": s.get("text")} for s in raw_segments]
        transcript_text = build_srt_from_segments(srt_segments)
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
        segments_data = []
        for segment in segments:
            for word in segment.words:
                words_data.append({
                    "word": word.word.strip(),
                    "start": word.start,
                    "end": word.end
                })
            segments_data.append({
                "start": segment.start,
                "end": segment.end,
                "text": segment.text.strip()
            })
        return {"words": words_data, "segments": segments_data}
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
        transcript_text = build_srt_from_segments(transcript_data.get("segments", []))
    else:
        subtitle_path = base + ".srt"
        transcript_text = transcript_data
        with open(subtitle_path, "w", encoding="utf-8") as f:
            f.write(transcript_text)

    if is_cancelled and is_cancelled(): raise Exception("Cancelled by user")
    video_file = _with_retry(lambda: client.files.upload(file=file_path), attempts=8)

    while video_file.state.name == "PROCESSING":
        if is_cancelled and is_cancelled(): raise Exception("Cancelled by user")
        time.sleep(2)
        video_file = _with_retry(lambda: client.files.get(name=video_file.name), attempts=8)

    if video_file.state.name == "FAILED":
        raise Exception("Gemini failed to process the video.")

    additional_instructions = f"\n\nUSER'S EXTRA INSTRUCTIONS:\n{extra_prompt}" if extra_prompt else ""
    additional_instructions += f"\nFind up to {limit} of the best highlights."

    prompt = (
        "Watch this video and read the following accurate transcript. "
        f"{HIGHLIGHT_GUIDANCE}{additional_instructions}\n\n"
        f"{SOCIAL_PROMPT_TEMPLATE.format(datetime_context=_get_user_datetime_context())}\n\n"
        f"Transcript:\n{transcript_text}"
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
        transcript_text = build_srt_from_segments(transcript_data.get("segments", []))
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
    if provider == "manual_ai":
        return
    if provider == "custom":
        if not custom_base_url or not custom_model_name:
            raise Exception("Custom provider requires a Base URL and Model Name.")
        try:
            # api_key is optional for local servers; the client needs a non-empty string.
            client = OpenAI(api_key=api_key or "-", base_url=custom_base_url, timeout=10.0, default_headers=BROWSER_HEADERS)
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
        raise Exception(f"API Key untuk provider '{provider}' kosong. Jika Anda menggunakan proxy lain, pastikan Anda telah memilih 'Custom OpenAI Compatible' di Pengaturan.")

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
                client = OpenAI(api_key=api_key, base_url=cfg["base_url"], timeout=10.0, default_headers=BROWSER_HEADERS)
                model = cfg["model"]
            else:
                client = OpenAI(api_key=api_key, timeout=10.0, default_headers=BROWSER_HEADERS)
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
