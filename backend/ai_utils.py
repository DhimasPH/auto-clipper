import json
from openai import OpenAI
from pathlib import Path

def transcribe_audio(file_path: str, api_key: str) -> str:
    """Uses OpenAI Whisper API to transcribe video/audio."""
    client = OpenAI(api_key=api_key)
    
    with open(file_path, "rb") as audio_file:
        transcript = client.audio.transcriptions.create(
            model="whisper-1", 
            file=audio_file,
            response_format="vtt" # Useful for subtitles later
        )
    return transcript

def get_highlights(transcript_vtt: str, api_key: str) -> list:
    """Uses OpenAI GPT to find highlight timestamps from VTT transcript."""
    client = OpenAI(api_key=api_key)
    
    prompt = f"""
    Analyze the following video transcript (in VTT format) and identify the most engaging highlights 
    suitable for short-form content (TikTok, Shorts, Reels).
    Return a JSON array of objects with 'start_time', 'end_time', and 'description'.
    The times should be in HH:MM:SS.mmm format.
    Keep highlights between 15-60 seconds.
    
    Transcript:
    {transcript_vtt}
    """
    
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "You are a professional video editor identifying viral highlights. Always return strictly valid JSON."},
            {"role": "user", "content": prompt}
        ],
        response_format={ "type": "json_object" }
    )
    
    # Safely parse JSON
    try:
        content = response.choices[0].message.content
        # Sometimes the model wraps the array in an object like {"highlights": [...]}
        parsed = json.loads(content)
        if "highlights" in parsed:
            return parsed["highlights"]
        if isinstance(parsed, list):
            return parsed
        # Fallback if wrapped differently
        return list(parsed.values())[0] if isinstance(parsed, dict) else []
    except Exception as e:
        print(f"Failed to parse highlights: {e}")
        return []
