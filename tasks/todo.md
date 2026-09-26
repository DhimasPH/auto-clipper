## Task 1: Add dynamic Deadzone logic to `smooth_trajectory`

**Description:** Modify `smooth_trajectory` in `backend/crop_utils.py` to implement a deadzone. If the face moves but stays within a dynamic deadzone (proportional to its size), the smoothed trajectory remains static. It only moves when the face breaches this zone.

**Acceptance criteria:**
- [ ] `smooth_trajectory` respects a dynamic deadzone based on face area ratio.
- [ ] Camera panning only occurs when the face moves significantly out of the deadzone.

**Verification:**
- [ ] Manual check: verify math logic in Python shell.
- [ ] Tests pass: `pytest backend/tests/test_crop_utils.py`

**Dependencies:** None

**Files likely touched:**
- `backend/crop_utils.py`

**Estimated scope:** Small

---

## Task 2: Write tests for Deadzone logic

**Description:** Add unit tests to `backend/tests/test_crop_utils.py` to ensure the new deadzone logic works as intended and doesn't produce out-of-bounds coordinates.

**Acceptance criteria:**
- [ ] Test confirms static coordinates for minor face movements.
- [ ] Test confirms correct panning for major face movements.

**Verification:**
- [ ] Tests pass: `pytest backend/tests/test_crop_utils.py`

**Dependencies:** Task 1

**Files likely touched:**
- `backend/tests/test_crop_utils.py`

**Estimated scope:** Small

---

## Checkpoint: Foundation
- [ ] All tests pass

---

## Task 3: Install `mediapipe` and update build config

**Description:** Add `mediapipe` to the project's dependencies and update `backend.spec` (PyInstaller) to ensure it gets bundled correctly.

**Acceptance criteria:**
- [ ] `mediapipe` is added to requirements.
- [ ] `backend.spec` is updated to include MediaPipe hidden imports if necessary.

**Verification:**
- [ ] Build succeeds: verify pyinstaller can bundle it.

**Dependencies:** None

**Files likely touched:**
- `requirements.txt`
- `backend.spec`

**Estimated scope:** Small

---

## Task 4: Implement MediaPipe face detection in `crop_utils.py`

**Description:** Add a new detection path using MediaPipe Face Detection. Modify the detection logic to choose between MediaPipe and Haar Cascade based on a parameter.

**Acceptance criteria:**
- [ ] MediaPipe correctly detects faces and returns coordinates matching the expected Haar output format `(x, y, w, h)`.
- [ ] `detect_faces` or equivalent function accepts an `engine` parameter.

**Verification:**
- [ ] Manual check: run face detection on a sample video using MediaPipe.

**Dependencies:** Task 3

**Files likely touched:**
- `backend/crop_utils.py`

**Estimated scope:** Medium

---

## Checkpoint: Core Features
- [ ] Backend runs without error

---

## Task 5: Add `face_tracking_engine` to settings backend

**Description:** Update the backend API (`main.py` / `db.py`) to expose and store a `face_tracking_engine` setting (default: "haar"). 

**Acceptance criteria:**
- [ ] Settings API returns `face_tracking_engine`.
- [ ] Pipeline reads this setting and passes it down to `crop_utils.py`.

**Verification:**
- [ ] Manual check: curl the settings endpoint.

**Dependencies:** Task 4

**Files likely touched:**
- `backend/main.py`
- `backend/db.py`
- `backend/jobs.py`

**Estimated scope:** Small

---

## Task 6: Add Face Tracking Engine dropdown to React UI (Desktop and Cloud)

**Description:** Update the Settings page in the frontend to include a dropdown for selecting the Face Tracking Engine ("Standard/Fast" vs "Advanced/Smooth"). This must be applied to both the Desktop Tauri UI (`src/`) and the Cloud Web UI (`web/src/`).

**Acceptance criteria:**
- [ ] Dropdown appears in Desktop Settings UI.
- [ ] Dropdown appears in Cloud Web UI Settings/Configuration.
- [ ] Selection is saved and fetched correctly via backend API across both platforms.

**Verification:**
- [ ] Manual check: open Desktop UI, change setting, verify persistence.
- [ ] Manual check: open Web UI, change setting, verify persistence.

**Dependencies:** Task 5

**Files likely touched:**
- `src/pages/SettingsPage.tsx` (or similar in Desktop)
- `web/src/components/SettingsModal.tsx` (or similar in Web UI)
- `src/types/settings.ts`
- `web/src/types/settings.ts`

**Estimated scope:** Medium

---

## Checkpoint: Complete
- [ ] All acceptance criteria met
- [ ] End-to-end rendering verified
