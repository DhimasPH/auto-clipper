import sys

with open("backend/crop_utils.py", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Update apply_deadband_filter
old_deadband = '''def apply_deadband_filter(raw_trajectory: list[tuple[float, float]], deadband: float = 0.08) -> list[tuple[float, float]]:
    """Lock the crop position until the subject moves beyond ``deadband``.

    Small, jittery face movements (breathing, micro-shifts while a speaker sits
    still) would otherwise make the crop window wobble frame to frame. We hold
    an anchor position and only let it follow the face once the face has moved
    further than ``deadband`` (as a fraction of frame width) from that anchor —
    then the anchor snaps to the new spot. Downstream EMA smoothing turns each
    snap into a gentle pan rather than a hard jump.
    """
    if not raw_trajectory:
        return [(0.0, 0.5)]
    result = []
    anchor = raw_trajectory[0][1]
    for t, x in raw_trajectory:
        if abs(x - anchor) >= deadband:
            anchor = x
        result.append((t, anchor))
    return result'''

new_deadband = '''def apply_deadband_filter(raw_trajectory: list[tuple], default_deadband: float = 0.08) -> list[tuple[float, float]]:
    """Lock the crop position until the subject moves beyond a deadband.
    If the tuple provides a face width ratio (t, x, w), the deadband is dynamically
    set to a fraction of the face width (e.g. w/2).
    """
    if not raw_trajectory:
        return [(0.0, 0.5)]
    result = []
    anchor = raw_trajectory[0][1]
    for pt in raw_trajectory:
        t = pt[0]
        x = pt[1]
        # Dynamic deadzone: 50% of the face width if available, else default
        deadband = (pt[2] * 0.5) if len(pt) >= 3 else default_deadband
        if abs(x - anchor) >= deadband:
            anchor = x
        result.append((t, anchor))
    return result'''
content = content.replace(old_deadband, new_deadband)

# 2. Update sample_face_trajectory signature
old_sig = '''def sample_face_trajectory(video_path: str, start_time: float, end_time: float, interval: float = 0.5, should_cancel = None) -> list[tuple[float, float]]:'''
new_sig = '''def sample_face_trajectory(video_path: str, start_time: float, end_time: float, interval: float = 0.5, should_cancel = None, engine: str = "haar") -> list[tuple]:'''
content = content.replace(old_sig, new_sig)

# 3. Update sample_face_trajectory Mediapipe engine check
old_mp_try = '''    # Try MediaPipe Face Mesh
    try:'''
new_mp_try = '''    # Try MediaPipe Face Mesh if engine is "mediapipe"
    if engine == "mediapipe":
      try:'''
content = content.replace(old_mp_try, new_mp_try)

old_mp_except = '''            if trajectory:
                cap.release()
                return trajectory
                
    except Exception as e:
        # Graceful fallback to OpenCV Haar Cascade
        pass'''
new_mp_except = '''            if trajectory:
                cap.release()
                return trajectory
                
      except Exception as e:
          # Graceful fallback to OpenCV Haar Cascade
          pass'''
content = content.replace(old_mp_except, new_mp_except)

# 4. Update Mediapipe face width extraction
old_mp_mar = '''                    mar = np.linalg.norm(p13 - p14) / (np.linalg.norm(p78 - p308) + 1e-6)
                    frame_faces.append({'cx': cx, 'mar': mar})'''
new_mp_mar = '''                    mar = np.linalg.norm(p13 - p14) / (np.linalg.norm(p78 - p308) + 1e-6)
                    # Extract face width (cheek to cheek roughly)
                    p234 = np.array([face_landmarks.landmark[234].x, face_landmarks.landmark[234].y])
                    p454 = np.array([face_landmarks.landmark[454].x, face_landmarks.landmark[454].y])
                    w = np.linalg.norm(p234 - p454)
                    frame_faces.append({'cx': cx, 'mar': mar, 'w': w})'''
content = content.replace(old_mp_mar, new_mp_mar)

# 5. Update Mediapipe track matching (just add 'w' propagation if needed, but wait, the fallback uses face['cx'], we need to retrieve face['w'] when appending to trajectory)
# Wait, look at line 250:
old_mp_traj_append = '''                if speaker_face:
                    x = speaker_face['cx']
                    clamped_center = max(lo, min(hi, x)) if lo <= hi else x
                    last_valid_x = clamped_center
                    trajectory.append((rel_t, clamped_center))
                else:
                    trajectory.append((rel_t, last_valid_x))'''
new_mp_traj_append = '''                if speaker_face:
                    x = speaker_face['cx']
                    w = speaker_face['w']
                    clamped_center = max(lo, min(hi, x)) if lo <= hi else x
                    last_valid_x = clamped_center
                    last_valid_w = w
                    trajectory.append((rel_t, clamped_center, w))
                else:
                    trajectory.append((rel_t, last_valid_x, getattr(locals(), 'last_valid_w', 0.16)))'''
content = content.replace(old_mp_traj_append, new_mp_traj_append)

# 6. Update Haar Cascade fallback to append width
old_haar = '''            if lo <= hi:
                clamped_center = max(lo, min(hi, raw_center))
            else:
                clamped_center = raw_center
            last_valid_x = clamped_center
            trajectory.append((rel_t, clamped_center))
        else:
            trajectory.append((rel_t, last_valid_x))'''
new_haar = '''            w_ratio = w / small_w
            if lo <= hi:
                clamped_center = max(lo, min(hi, raw_center))
            else:
                clamped_center = raw_center
            last_valid_x = clamped_center
            last_valid_w = w_ratio
            trajectory.append((rel_t, clamped_center, w_ratio))
        else:
            trajectory.append((rel_t, last_valid_x, locals().get('last_valid_w', 0.16)))'''
content = content.replace(old_haar, new_haar)

# 7. Update caller in detect_video_layout (we are in _run_crop_job usually, wait it's in process_clip maybe?)
# Actually line 1397 is the caller
old_caller = '''            else:
                raw_traj = sample_face_trajectory(input_path, start_time=start_s, end_time=end_s, interval=0.5, should_cancel=should_cancel)
                if should_cancel and should_cancel():'''
new_caller = '''            else:
                engine = layout.get("face_tracking_engine", "haar") if layout else "haar"
                raw_traj = sample_face_trajectory(input_path, start_time=start_s, end_time=end_s, interval=0.5, should_cancel=should_cancel, engine=engine)
                if should_cancel and should_cancel():'''
content = content.replace(old_caller, new_caller)

with open("backend/crop_utils.py", "w", encoding="utf-8") as f:
    f.write(content)
print("Updated backend/crop_utils.py")
