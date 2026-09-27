# Implementation Plan: Enhanced Face Crop & Cinematic Tracking

## Overview
We are enhancing the face crop feature by introducing a "Deadzone" for cinematic tracking (avoiding unnecessary panning) and adding a MediaPipe option for more accurate face detection, alongside the existing Haar Cascade.

## Architecture Decisions
- **Deadzone Logic**: Implemented in `backend/crop_utils.py` inside `sample_face_trajectory` and `smooth_trajectory`. The deadzone dimension will be dynamic, relative to the detected face size.
- **MediaPipe Bundling**: The MediaPipe package will be added as a dependency and bundled directly into the PyInstaller binary.
- **Settings Store**: The preferred engine ("haar" or "mediapipe") will be stored in the app settings, allowing users to choose between Standard/Fast (Haar) and Advanced/Smooth (MediaPipe).

## Task List

### Phase 1: Foundation (Deadzone Implementation)
- [x] Task 1: Add dynamic Deadzone logic to `smooth_trajectory`
- [x] Task 2: Write tests for Deadzone logic in `test_crop_utils.py`

### Checkpoint: Foundation
- [x] `pytest backend/tests/test_crop_utils.py` passes
- [x] Bounding box output remains valid and doesn't cause FFmpeg errors

### Phase 2: Core Features (MediaPipe Integration)
- [x] Task 3: Install `mediapipe` and update `requirements.txt` / `backend.spec`
- [x] Task 4: Implement MediaPipe face detection in `crop_utils.py` as an alternative pipeline

### Checkpoint: Core Features
- [x] Backend runs successfully and MediaPipe successfully detects faces
- [x] Fallback to Haar Cascade works if MediaPipe is not selected

### Phase 3: Polish (UI & Settings Integration)
- [x] Task 5: Add `face_tracking_engine` to settings backend API (`main.py` / `db.py`)
- [x] Task 6: Add Face Tracking Engine dropdown to Desktop React UI (Settings) and Cloud Web UI

### Checkpoint: Complete
- [x] All tests pass
- [x] End-to-end rendering works flawlessly with both Haar and MediaPipe
- [x] UI reflects changes accurately

## Risks and Mitigations
| Risk | Impact | Mitigation |
|------|--------|------------|
| PyInstaller binary size increase | High | MediaPipe will be bundled, but if size exceeds 150MB, we may need to strip unnecessary models. |
| MediaPipe breaking cross-platform builds | Medium | Ensure `mediapipe` wheel is available for Windows/Mac x86/arm in `backend.spec`. |
