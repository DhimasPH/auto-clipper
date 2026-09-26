# Enhanced Face Crop & Cinematic Tracking

## Problem Statement
How might we enhance the face crop and tracking feature so that the resulting video feels naturally framed, fluidly tracked without causing motion sickness, and looks highly professional without requiring manual intervention, while remaining accessible for low-spec devices?

## Recommended Direction
We will pursue a dual-pronged approach focusing on **Logika Pergerakan (The Cinematic Tracking Engine)** and **Akurasi Deteksi (Multi-Model AI Registry)**:

1.  **Cinematic Tracking Engine (Deadzone & Look-ahead):** Introduce a "Deadzone" algorithm in the trajectory calculation. If the detected face moves within a defined central box (e.g., center 30% of the screen), the camera panning remains completely static. The camera only initiates smooth panning when the face breaches this deadzone, eliminating micro-jitters and unnecessary movements that cause motion sickness.
2.  **Multi-Model AI Registry:** Offer users a choice of face detection engines in the Settings UI. 
    *   **Standard (Haar Cascade):** The current lightweight implementation, defaulting for performance and low-spec machines.
    *   **Advanced (MediaPipe):** A new, highly robust integration for high-end PCs that provides rock-solid bounding boxes (resolving the inherent Haar Cascade jitter) and perfectly handles profile (side-facing) angles.

## Key Assumptions to Validate
- [ ] **Binary Size:** Adding `mediapipe` to the Python backend will increase the PyInstaller executable size. *Validation:* Build a test PyInstaller one-file with MediaPipe and check if the size increase (expected ~50-100MB) is acceptable for distribution.
- [ ] **Performance Impact:** The new Deadzone logic can be seamlessly integrated into `sample_face_trajectory` and `smooth_trajectory` without breaking existing `filter_complex` expressions or the Gaming Mode layout. *Validation:* Write unit tests in `test_crop_utils.py` to ensure the bounding box output remains valid for FFmpeg.
- [ ] **User Understanding:** Users might not understand technical terms like "Haar Cascade". *Validation:* Use clear, benefit-driven UI copywriting (e.g., "Standard/Fast" vs. "Advanced/Smooth").

## MVP Scope
*   **Backend (`crop_utils.py`):** 
    *   Implement the mathematical `Deadzone` logic inside the trajectory smoothing pipeline.
    *   Integrate `mediapipe` as an alternative face detection pipeline alongside the existing `cv2.CascadeClassifier`.
*   **Backend (`main.py` / `db.py`):**
    *   Update the settings API and database to store the user's preferred `face_tracking_engine`.
*   **Frontend (UI):**
    *   Add a dropdown selector in the global Settings page for "Face Tracking Engine" with informative tooltips explaining the hardware trade-offs.

## Not Doing (and Why)
- **Speaker-Aware Auto-Switch (for podcasts):** We are not building a system to dynamically switch crops between multiple faces based on who is speaking (audio syncing). *Reason:* Too complex for MVP, prone to desync, and requires deep integration with Whisper word timestamps which distracts from solving the core "smoothness" issue for single subjects.
- **Dynamic Zoom In/Out during panning:** We will maintain a fixed scale/zoom level during the crop. *Reason:* Dynamically altering the `zoom` parameter in FFmpeg `filter_complex` over time requires complex math (evaluating `zoompan` or `sendcmd`) which drastically increases rendering errors and encoding time.
- **YOLOv8-Face Integration:** *Reason:* MediaPipe is sufficient for high-accuracy tracking and is generally easier to package with PyInstaller than a full PyTorch/Ultralytics stack.

## Resolved Questions
- **What should be the default dimension of the "Deadzone"?** Dynamic based on the detected face size.
- **Do we need to prompt the user to download the MediaPipe model weights dynamically?** No, they are small enough to be bundled directly into the backend binary.
