import cv2
import subprocess
import os

def detect_primary_face_center(video_path: str) -> float:
    """Returns the relative X center (0.0 to 1.0) of the primary face. Defaults to 0.5 if no face."""
    # Use Haar Cascade for fast MVP face detection
    face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
    cap = cv2.VideoCapture(video_path)
    
    if not cap.isOpened():
        return 0.5
        
    # Check a few frames in the middle
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    cap.set(cv2.CAP_PROP_POS_FRAMES, max(0, total_frames // 2))
    
    for _ in range(30): # check up to 30 frames
        ret, frame = cap.read()
        if not ret:
            break
            
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        faces = face_cascade.detectMultiScale(gray, 1.1, 4)
        
        if len(faces) > 0:
            # Get largest face
            x, y, w, h = max(faces, key=lambda rect: rect[2] * rect[3])
            center_x = x + w / 2
            width = frame.shape[1]
            cap.release()
            return center_x / width
            
    cap.release()
    return 0.5

def crop_to_vertical(input_path: str, output_path: str, start_time: str, end_time: str) -> str:
    """Crops video to 9:16 and trims to start/end time."""
    center_pct = detect_primary_face_center(input_path)
    
    # Calculate crop parameters for ffmpeg
    # 9:16 aspect ratio means width = height * 9/16
    crop_filter = f"crop=ih*9/16:ih:iw*{center_pct}-ih*9/32:0"
    
    cmd = [
        "ffmpeg", "-y",
        "-i", input_path,
        "-ss", start_time,
        "-to", end_time,
        "-vf", crop_filter,
        "-c:a", "copy",
        output_path
    ]
    
    # Execute ffmpeg
    subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    return output_path
