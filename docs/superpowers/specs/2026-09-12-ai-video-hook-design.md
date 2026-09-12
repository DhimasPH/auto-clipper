# AI Video Hook Integration Design

## 1. Overview
Implementing an automated "Hook" at the beginning of generated short-form videos. The system will extract a 3-5 second engaging clip (using AI), place it at the start of the video, and insert a glitch/swoosh transition before the main video starts.

## 2. Platform Support
This feature must be supported on both:
- **Auto Clipper Desktop**: Packaged via PyInstaller (asset bundled).
- **Auto Clipper Cloud (Web UI + Colab)**: Asset accessible in the source tree and UI toggle exposed in the web front-end.

## 3. UI & Configuration
- **Toggle Control**: Add a checkbox/toggle "Enable Auto Hook" (default: false).
- **Desktop UI**: Placed in the AI Settings or Pipeline settings before creating a job.
- **Web UI**: Added to the Web UI workflow options.
- **Wording**: Clear explanation that a 3-5 second highlight will be duplicated at the front.

## 4. Backend Processing (Python)
- **Asset Generation**: A 0.5-second `glitch_transition.mp4` will be generated using FFmpeg and placed in `backend/assets/`.
- **AI Extraction (`ai_utils.py`)**: 
  - Update the LLM prompt to identify `hook_start` and `hook_end` timestamps (within the highlight bounds).
  - Modify `VideoHighlight` metadata model to accept these fields.
- **Video Pipeline (`jobs.py` & `crop_utils.py`)**:
  - If `enable_hook` is true:
    1. Render the Hook (using `hook_start`/`end`) to `hook.mp4`.
    2. Render the Main Clip to `main.mp4`.
    3. Use `ffmpeg concat` demuxer to merge `hook.mp4` + `assets/glitch_transition.mp4` + `main.mp4` into the final output.
- **Packaging (`backend.spec`)**: Include `backend/assets/` in the PyInstaller build so the transition file is available in the desktop executable.

## 5. Transition Asset Specs
- 0.5 seconds duration.
- Vertical 9:16 aspect ratio (or compatible scaling).
- Glitch/static noise visual.
- Static/swoosh audio track.
