import json
import os
import random
import time
from openai import OpenAI
from google import genai
from google.genai import types

from backend.video_utils import extract_audio
from backend.crop_utils import to_seconds, _fmt_srt_ts


_TRANSIENT_MARKERS = (
    "unavailable", "overloaded", "high demand", "temporarily",
    "resource_exhausted", "rate limit", "timeout", "try again",
    "500", "502", "503", "504",
)


def _is_transient(err) -> bool:
    """True for errors worth retrying (server overload, rate spikes, timeouts)."""
    code = getattr(err, "code", None) or getattr(err, "status_code", None)
    if code in (429, 500, 502, 503, 504):
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


def get_highlights(transcript_srt: str, api_key: str) -> list:
    """Ask the LLM to pick the most engaging short-form highlights."""
    client = OpenAI(api_key=api_key)
    prompt = (
        "Analyze the following video transcript (SRT format). "
        f"{HIGHLIGHT_GUIDANCE}\n\n"
        "Return a JSON object with a 'highlights' key holding an array of "
        "objects with 'start_time', 'end_time' (in HH:MM:SS.mmm format) and "
        "'description'.\n\n"
        f"Transcript:\n{transcript_srt}"
    )
    response = _with_retry(lambda: client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "You are a professional short-form video editor who finds viral moments. Always return strictly valid JSON."},
            {"role": "user", "content": prompt},
        ],
        response_format={"type": "json_object"},
    ))
    return _parse_highlights(response.choices[0].message.content)


def process_with_openai(file_path: str, api_key: str, karaoke: bool = False) -> dict:
    """Full OpenAI pipeline: extract audio -> transcribe -> find highlights."""
    base, _ = os.path.splitext(file_path)
    audio_path = base + "_audio.mp3"

    extract_audio(file_path, audio_path)
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

    highlights = get_highlights(transcript_text, api_key)

    return {
        "transcript": transcript_text,
        "highlights": highlights,
        "subtitle_path": subtitle_path,
    }


def process_with_gemini(file_path: str, api_key: str, karaoke: bool = False) -> dict:
    client = genai.Client(api_key=api_key)

    video_file = client.files.upload(file=file_path)

    while video_file.state.name == "PROCESSING":
        time.sleep(2)
        video_file = client.files.get(name=video_file.name)

    if video_file.state.name == "FAILED":
        raise Exception("Gemini failed to process the video.")

    prompt = (
        "Watch this video. "
        f"{HIGHLIGHT_GUIDANCE}\n\n"
        "Return a JSON object with two keys:\n"
        "1. 'highlights': an array of objects with 'start_time', 'end_time' "
        "(HH:MM:SS.mmm) and 'description'.\n"
        "2. 'transcript': an array of short caption segments covering the "
        "spoken audio, each an object with 'start_time', 'end_time' "
        "(HH:MM:SS.mmm) and 'text'. Keep each segment under ~8 words so it "
        "works as an on-screen subtitle."
    )

    response = _with_retry(lambda: client.models.generate_content(
        model='gemini-2.5-flash',
        contents=[video_file, prompt],
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
        ),
    ))

    highlights = _parse_highlights(response.text)

    # Handle subtitles
    transcript_text = "Transcription skipped for Gemini (Multimodal)"
    subtitle_path = None
    
    try:
        parsed = json.loads(response.text)
        segments = parsed.get("transcript") if isinstance(parsed, dict) else None
        srt = build_srt_from_segments(segments)
        if srt.strip():
            base, _ = os.path.splitext(file_path)
            subtitle_path = base + ".srt"
            with open(subtitle_path, "w", encoding="utf-8") as f:
                f.write(srt)
            transcript_text = srt
    except Exception as e:
        print(f"Gemini transcript unavailable: {e}")

    return {
        "transcript": transcript_text,
        "highlights": highlights,
        "subtitle_path": subtitle_path,
    }
