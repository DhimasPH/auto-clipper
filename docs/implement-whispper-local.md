# Auto Clipper Subtitles and Transcriptions Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement local `faster-whisper` for accurate transcription timings and fix ASS subtitle sizing to be proportional across all video aspect ratios.

**Architecture:** We will integrate `faster-whisper` to generate highly accurate transcripts with word-level timestamps on the local GPU. This transcript is passed to Gemini, which is now solely responsible for extracting highlights based on the accurate text and video context. In `crop_utils.py`, font sizing will be recalculated to scale dynamically with video height (or a bounded fraction of width/height) and text lines will be smartly wrapped to prevent screen overflow.

**Tech Stack:** Python, faster-whisper, Gemini API, ffmpeg.

## User Review Required

> [!WARNING]
> **Model Download:** The first time `faster-whisper` runs, it will download a model (defaulting to the 'base' or 'small' model, which is ~150-300MB) to the local cache. Please ensure you have internet access and disk space during the first run.
> **Dependency Addition:** We are adding `faster-whisper` to `backend/requirements.txt`.

## Open Questions

> [!NOTE]
> Which Whisper model size do you prefer for transcription? (e.g., `base`, `small`, `medium`). The `base` model is extremely fast but slightly less accurate; `small` is a great middle-ground for English/Indonesian. We will default to `small`.

---

### Task 1: Add faster-whisper to Requirements

**Files:**

- Modify: `C:/Users/dhima/projects/auto-clipper/backend/requirements.txt`

- [ ] **Step 1: Add faster-whisper**

```text
faster-whisper
```

### Task 2: Implement Local Transcription with faster-whisper

**Files:**

- Modify: `C:/Users/dhima/projects/auto-clipper/backend/ai_utils.py`

- [ ] **Step 1: Add faster-whisper logic**

Import `FasterWhisper` model (handled lazily or globally) and implement `transcribe_with_faster_whisper(audio_path, karaoke=False)` to generate either standard SRT string or word-level JSON structure.

```python
# Add at top of ai_utils.py (import lazily inside function to avoid startup delay if not used)
def transcribe_with_faster_whisper(audio_path: str, karaoke: bool = False):
    from faster_whisper import WhisperModel
    import os

    # Let faster-whisper automatically choose GPU if available, else fallback to CPU.
    # 'default' compute_type uses float16/int8_float16 on GPU, and int8 on CPU for smooth performance.
    model = WhisperModel("small", device="auto", compute_type="default")

    segments, info = model.transcribe(audio_path, word_timestamps=karaoke)

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
```

### Task 3: Refactor Gemini Pipeline

**Files:**

- Modify: `C:/Users/dhima/projects/auto-clipper/backend/ai_utils.py`

- [ ] **Step 1: Update process_with_gemini**

Modify `process_with_gemini` to extract audio, run `transcribe_with_faster_whisper`, write the SRT/JSON subtitle, and pass the text to the Gemini prompt for highlights.

```python
def process_with_gemini(file_path: str, api_key: str, karaoke: bool = False, extra_prompt: str = "") -> dict:
    import json
    import os
    from backend.video_utils import extract_audio

    # 1. Local Transcription via faster-whisper
    base, _ = os.path.splitext(file_path)
    audio_path = base + "_audio.mp3"
    extract_audio(file_path, audio_path)

    transcript_data = transcribe_with_faster_whisper(audio_path, karaoke=karaoke)

    if karaoke:
        subtitle_path = base + ".words.json"
        with open(subtitle_path, "w", encoding="utf-8") as f:
            json.dump(transcript_data, f)
        # We need a plain text transcript to feed into Gemini prompt
        transcript_text = " ".join([w["word"] for w in transcript_data.get("words", [])])
    else:
        subtitle_path = base + ".srt"
        transcript_text = transcript_data
        with open(subtitle_path, "w", encoding="utf-8") as f:
            f.write(transcript_text)

    # 2. Upload Video to Gemini
    client = genai.Client(api_key=api_key)
    video_file = client.files.upload(file=file_path)

    while video_file.state.name == "PROCESSING":
        time.sleep(2)
        video_file = client.files.get(name=video_file.name)

    if video_file.state.name == "FAILED":
        raise Exception("Gemini failed to process the video.")

    additional_instructions = f"\n\nUSER'S EXTRA INSTRUCTIONS:\n{extra_prompt}" if extra_prompt else ""

    # 3. Prompt Gemini for Highlights using the accurate transcript
    prompt = (
        "Watch this video and read the following accurate transcript. "
        f"{HIGHLIGHT_GUIDANCE}{additional_instructions}\n\n"
        "Return a JSON object with a 'highlights' key holding an array of "
        "objects with 'start_time', 'end_time' (HH:MM:SS.mmm) and 'description'.\n\n"
        f"Transcript:\n{transcript_text[:30000]}" # limit to avoid token blowup
    )

    response = _with_retry(lambda: client.models.generate_content(
        model='gemini-2.5-flash',
        contents=[video_file, prompt],
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
        ),
    ))

    highlights = _parse_highlights(response.text)

    return {
        "transcript": transcript_text,
        "highlights": highlights,
        "subtitle_path": subtitle_path,
    }
```

### Task 4: Fix Subtitle Sizing and Wrapping

**Files:**

- Modify: `C:/Users/dhima/projects/auto-clipper/backend/crop_utils.py`

- [ ] **Step 1: Update sizing in `srt_to_ass` and `words_to_karaoke_ass`**

Adjust font_size calculation to take into account aspect ratio or use a bounded fraction of video height/width to ensure it's not gigantic in landscape and not misaligned in portrait. Add word-wrapping logic for karaoke chunking.

```python
# Inside srt_to_ass and words_to_karaoke_ass
def calculate_ass_styles(width: int, height: int):
    """Calculates proportional font sizes based on video dimensions."""
    is_vertical = height > width
    if is_vertical:
        # For vertical videos (9:16), font size should relate to width, but bounded
        font_size = max(14, round(width * 0.055))
        margin_v = max(20, round(height * 0.15))
    else:
        # For landscape (16:9), width is huge, so font size should relate to height
        font_size = max(14, round(height * 0.065))
        margin_v = max(20, round(height * 0.08))

    outline = max(1, round(font_size * 0.08))
    shadow = outline
    margin_h = max(20, round(width * 0.05))
    return font_size, outline, shadow, margin_h, margin_v

# Update words_to_karaoke_ass chunking to use character limits rather than just word counts
def chunk_words_smartly(clip_words, max_chars=25):
    chunks = []
    current_chunk = []
    current_len = 0

    for w in clip_words:
        word_len = len(w["word"])
        if current_len + word_len > max_chars and current_chunk:
            chunks.append(current_chunk)
            current_chunk = [w]
            current_len = word_len
        else:
            current_chunk.append(w)
            current_len += word_len + 1 # +1 for space

    if current_chunk:
        chunks.append(current_chunk)
    return chunks
```

_Note: We will apply these helper functions to replace the existing hardcoded sizing in `srt_to_ass` and `words_to_karaoke_ass`._
