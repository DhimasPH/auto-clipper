import json
import time
from openai import OpenAI
from google import genai
from google.genai import types
from pathlib import Path

def process_with_openai(file_path: str, api_key: str) -> dict:
    client = OpenAI(api_key=api_key)
    # 1. Transcribe
    with open(file_path, "rb") as audio_file:
        transcript = client.audio.transcriptions.create(
            model="whisper-1", 
            file=audio_file,
            response_format="vtt"
        )
    # 2. Highlights
    prompt = f"Analyze the following video transcript (in VTT format) and identify the most engaging highlights suitable for short-form content. Return a JSON array of objects with 'start_time', 'end_time' (in HH:MM:SS.mmm format), and 'description'. Keep highlights between 15-60 seconds.\n\nTranscript:\n{transcript}"
    
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "You are a professional video editor identifying viral highlights. Always return strictly valid JSON."},
            {"role": "user", "content": prompt}
        ],
        response_format={ "type": "json_object" }
    )
    # Parse JSON
    try:
        content = response.choices[0].message.content
        parsed = json.loads(content)
        if "highlights" in parsed:
            highlights = parsed["highlights"]
        elif isinstance(parsed, list):
            highlights = parsed
        else:
            highlights = list(parsed.values())[0] if isinstance(parsed, dict) else []
    except Exception as e:
        print(f"Failed to parse highlights: {e}")
        highlights = []
        
    return {"transcript": transcript, "highlights": highlights}

def process_with_gemini(file_path: str, api_key: str) -> dict:
    client = genai.Client(api_key=api_key)
    
    # Upload video
    video_file = client.files.upload(file=file_path)
    
    # Wait for processing
    while video_file.state.name == "PROCESSING":
        time.sleep(2)
        video_file = client.files.get(name=video_file.name)
        
    if video_file.state.name == "FAILED":
        raise Exception("Gemini failed to process the video.")
        
    prompt = "Analyze this video and identify the most engaging highlights suitable for short-form content. Return a JSON array of objects with 'start_time', 'end_time' (in HH:MM:SS.mmm format), and 'description'. Keep highlights between 15-60 seconds. Wrap it in a JSON object with a 'highlights' key."
    
    response = client.models.generate_content(
        model='gemini-2.5-flash',
        contents=[video_file, prompt],
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
        ),
    )
    
    try:
        parsed = json.loads(response.text)
        if "highlights" in parsed:
            highlights = parsed["highlights"]
        elif isinstance(parsed, list):
            highlights = parsed
        else:
            highlights = []
    except Exception as e:
        print(f"Failed to parse highlights: {e}")
        highlights = []
        
    return {"transcript": "Transcription skipped for Gemini (Multimodal)", "highlights": highlights}
