import json
import os
import time
from openai import OpenAI
from google import genai
from google.genai import types

from backend.video_utils import extract_audio
from backend.crop_utils import to_seconds, _fmt_srt_ts


HIGHLIGHT_GUIDANCE = (
    "Pick the most engaging, self-contained moments for vertical short-form "
    "video (TikTok/Reels/Shorts). Each highlight must: start on a strong hook, "
    "contain a complete thought (never cut off mid-sentence), be genuinely "
    "interesting/funny/surprising on its own without context, and run about "
    "20-45 seconds. Set start/end on natural speech pauses. Return them in "
    "chronological order and avoid intros, filler, and dead air."
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


def transcribe_audio(audio_path: str, api_key: str) -> str:
    """Transcribe an audio file to SRT text using OpenAI Whisper."""
    client = OpenAI(api_key=api_key)
    with open(audio_path, "rb") as audio_file:
        transcript = client.audio.transcriptions.create(
            model="whisper-1",
            file=audio_file,
            response_format="srt",
        )
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
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "You are a professional short-form video editor who finds viral moments. Always return strictly valid JSON."},
            {"role": "user", "content": prompt},
        ],
        response_format={"type": "json_object"},
    )
    return _parse_highlights(response.choices[0].message.content)


def process_with_openai(file_path: str, api_key: str) -> dict:
    """Full OpenAI pipeline: extract audio -> transcribe -> find highlights.

    Also writes the transcript to an .srt file next to the source video so the
    cropping step can burn subtitles into each clip.
    """
    base, _ = os.path.splitext(file_path)
    audio_path = base + "_audio.mp3"
    subtitle_path = base + ".srt"

    extract_audio(file_path, audio_path)
    transcript = transcribe_audio(audio_path, api_key)

    with open(subtitle_path, "w", encoding="utf-8") as f:
        f.write(str(transcript))

    highlights = get_highlights(transcript, api_key)

    return {
        "transcript": transcript,
        "highlights": highlights,
        "subtitle_path": subtitle_path,
    }


def process_with_gemini(file_path: str, api_key: str) -> dict:
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

    response = client.models.generate_content(
        model='gemini-2.5-flash',
        contents=[video_file, prompt],
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
        ),
    )

    highlights = _parse_highlights(response.text)

    # Build subtitles from Gemini's transcript when it provides one.
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
