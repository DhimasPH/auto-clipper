import cv2
import numpy as np
import os
import re
import subprocess
import threading
import traceback
import math
from fractions import Fraction
from backend.logger import log_error, log_app
from backend.stage_timer import stage

FONTS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'fonts')

_NVENC_AVAILABLE = None

def is_nvenc_available():
    global _NVENC_AVAILABLE
    if _NVENC_AVAILABLE is not None:
        return _NVENC_AVAILABLE
    try:
        # Encode 0.1 s of black to test driver capability. Turing GPUs (Colab's T4)
        # reject h264_nvenc frames narrower than 145 px, so the frame must be larger.
        cmd = [
            "ffmpeg", "-y", "-f", "lavfi", "-i", "color=c=black:s=256x256",
            "-t", "0.1", "-c:v", "h264_nvenc", "-f", "null", "-"
        ]
        res = subprocess.run(cmd, capture_output=True, text=True)
        _NVENC_AVAILABLE = (res.returncode == 0)
        if not _NVENC_AVAILABLE:
            log_app(f"h264_nvenc unavailable, rendering with libx264: {(res.stderr or '')[-300:].strip()}")
    except Exception:
        _NVENC_AVAILABLE = False
    return _NVENC_AVAILABLE

def to_seconds(t) -> float:
    """Parse a flexible timestamp into seconds.

    Handles 'HH:MM:SS.mmm', 'MM:SS', plain seconds, comma decimals, and the
    malformed 'MM:SS:mmm' / 'HH:MM:SS:mmm' shape some models emit (a trailing
    3-digit group is treated as milliseconds).
    """
    if t is None:
        return 0.0
    s = str(t).strip().replace(',', '.')
    if not s:
        return 0.0
    if ':' in s:
        parts = s.split(':')
        if '.' not in s and len(parts) >= 3 and parts[-1].isdigit() and len(parts[-1]) == 3:
            ms = parts.pop()
            parts[-1] = f"{parts[-1]}.{ms}"
        try:
            nums = [float(p) for p in parts]
        except ValueError:
            return 0.0
        if len(nums) == 3:
            return nums[0] * 3600 + nums[1] * 60 + nums[2]
        if len(nums) == 2:
            return nums[0] * 60 + nums[1]
        return nums[0] if nums else 0.0
    try:
        return float(s)
    except ValueError:
        return 0.0


def detect_primary_face_center(video_path: str, start_time=None, end_time=None) -> float:
    """Return the relative X center (0.0-1.0) to center the 9:16 crop on.

    Samples several frames spread across the clip window (not just the start),
    takes the *median* face position so a brief detection glitch can't throw the
    framing off, and clamps the result so the crop window stays fully in-frame
    (which also keeps the face from being cut off at the edges). Defaults to 0.5
    if no face is found.
    """
    face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
    if face_cascade.empty():
        return 0.5
    cap = cv2.VideoCapture(video_path)

    if not cap.isOpened():
        cap.release()
        return 0.5

    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    frame_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
    frame_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)

    if start_time is not None:
        s = to_seconds(start_time)
        e = to_seconds(end_time) if end_time is not None else s + 30.0
    else:
        dur = total_frames / fps if fps else 0.0
        s, e = (dur * 0.4, dur * 0.6) if dur else (0.0, 1.0)
    if e <= s:
        e = s + 1.0

    centers = []
    samples = 10
    for i in range(samples):
        t = s + (e - s) * (i / (samples - 1) if samples > 1 else 0.5)
        cap.set(cv2.CAP_PROP_POS_MSEC, t * 1000.0)
        ret, frame = cap.read()
        if not ret:
            continue
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        faces = face_cascade.detectMultiScale(gray, 1.1, 4)
        if len(faces) > 0:
            x, y, w, h = max(faces, key=lambda rect: rect[2] * rect[3])
            centers.append((x + w / 2) / frame.shape[1])

    cap.release()

    if not centers:
        return 0.5

    centers.sort()
    center = centers[len(centers) // 2]  # median

    # Clamp so the 9:16 window never runs off either edge.
    if frame_w and frame_h:
        half_window = (frame_h * 9 / 16) / frame_w / 2
        lo, hi = half_window, 1 - half_window
        if lo <= hi:
            center = max(lo, min(hi, center))

    return center


def _open_face_mesh():
    """Create a MediaPipe FaceMesh, or raise when this mediapipe build has none."""
    import mediapipe as mp
    # Some versions of mediapipe hide solutions if initialization fails (e.g. tensorflow missing)
    if not hasattr(mp, 'solutions'):
        raise ImportError("MediaPipe 'solutions' attribute is missing")
    return mp.solutions.face_mesh.FaceMesh(
        static_image_mode=False,
        max_num_faces=5,
        refine_landmarks=True,
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5
    )


def _close_face_mesh(face_mesh) -> None:
    try:
        face_mesh.close()
    except Exception as e:
        log_error("crop_utils.close_face_mesh", e)


def _mediapipe_faces(face_mesh, small_frame) -> list:
    """Faces in one frame as dicts: centre x, mouth aspect ratio, width (all 0..1)."""
    import numpy as np

    rgb_frame = cv2.cvtColor(small_frame, cv2.COLOR_BGR2RGB)
    results = face_mesh.process(rgb_frame)
    del rgb_frame

    frame_faces = []
    if results.multi_face_landmarks:
        for face_landmarks in results.multi_face_landmarks:
            xs = [lm.x for lm in face_landmarks.landmark]
            cx = sum(xs) / len(xs)

            p13 = np.array([face_landmarks.landmark[13].x, face_landmarks.landmark[13].y])
            p14 = np.array([face_landmarks.landmark[14].x, face_landmarks.landmark[14].y])
            p78 = np.array([face_landmarks.landmark[78].x, face_landmarks.landmark[78].y])
            p308 = np.array([face_landmarks.landmark[308].x, face_landmarks.landmark[308].y])

            mar = np.linalg.norm(p13 - p14) / (np.linalg.norm(p78 - p308) + 1e-6)

            # Estimate face width (cheek to cheek)
            p234 = np.array([face_landmarks.landmark[234].x, face_landmarks.landmark[234].y])
            p454 = np.array([face_landmarks.landmark[454].x, face_landmarks.landmark[454].y])
            w = float(np.linalg.norm(p234 - p454))

            frame_faces.append({'cx': cx, 'mar': mar, 'w': w})
    return frame_faces


def _haar_faces(face_cascade, small_frame) -> list:
    """The largest Haar face in one frame as a one-item list, or [] when none."""
    small_w = small_frame.shape[1]
    gray = cv2.cvtColor(small_frame, cv2.COLOR_BGR2GRAY)
    faces = face_cascade.detectMultiScale(gray, 1.1, 4)
    del gray
    if len(faces) == 0:
        return []
    x, y, w, h = max(faces, key=lambda rect: rect[2] * rect[3])
    return [{'cx': (x + w / 2) / small_w, 'w': w / small_w}]


def _speaker_trajectory(raw_frames: list, lo: float, hi: float) -> list:
    """Follow the face whose mouth moves the most (needs MediaPipe faces in every frame)."""
    import numpy as np

    trajectory = []
    tracks = []
    for rel_t, faces in raw_frames:
        for face in faces:
            matched = False
            for track in tracks:
                if abs(track['last_cx'] - face['cx']) < 0.1:
                    track['mars'].append(face['mar'])
                    track['cxs'].append(face['cx'])
                    track['last_cx'] = face['cx']
                    matched = True
                    break
            if not matched:
                tracks.append({
                    'mars': [face['mar']],
                    'cxs': [face['cx']],
                    'last_cx': face['cx']
                })

    best_track_cx = 0.5
    if tracks:
        valid_tracks = [t for t in tracks if len(t['mars']) > 1]
        if valid_tracks:
            best_track = max(valid_tracks, key=lambda t: np.var(t['mars']))
            best_track_cx = np.median(best_track['cxs'])
        else:
            best_track = max(tracks, key=lambda t: len(t['cxs']))
            best_track_cx = np.median(best_track['cxs'])

    last_valid_x = best_track_cx
    last_valid_w = 0.16
    for rel_t, faces in raw_frames:
        speaker_face = None
        min_dist = 0.15
        for face in faces:
            dist = abs(face['cx'] - last_valid_x)
            if dist < min_dist:
                speaker_face = face
                min_dist = dist

        if speaker_face:
            x = speaker_face['cx']
            w = speaker_face['w']
            clamped_center = max(lo, min(hi, x)) if lo <= hi else x
            last_valid_x = clamped_center
            last_valid_w = w
            trajectory.append((rel_t, clamped_center, w))
        else:
            trajectory.append((rel_t, last_valid_x, last_valid_w))
    return trajectory


def _largest_face_trajectory(raw_frames: list, lo: float, hi: float) -> list:
    """Follow the largest face per frame; hold the last position when none is found."""
    trajectory = []
    last_valid_x = 0.5
    last_valid_w = 0.16
    for rel_t, faces in raw_frames:
        if faces:
            face = max(faces, key=lambda f: f['w'])
            raw_center = face['cx']
            last_valid_x = max(lo, min(hi, raw_center)) if lo <= hi else raw_center
            last_valid_w = face['w']
        trajectory.append((rel_t, last_valid_x, last_valid_w))
    return trajectory


_FFMPEG_FALLBACK_CONTEXT = "crop_utils.sample_face_trajectory_ffmpeg_fallback"
_TRACKING_WIDTH = 640


def _ffmpeg_executable():
    """The FFmpeg binary the rest of the backend uses, or None when there is none."""
    from backend.video_utils import get_ffmpeg_path
    return get_ffmpeg_path()


def _sample_offsets(start_time: float, end_time: float, interval: float):
    """Clip duration and the sample offsets (seconds from the clip start)."""
    duration = max(0.1, end_time - start_time)
    num_samples = max(2, int(duration / interval) + 1)
    return duration, [min(duration, i * interval) for i in range(num_samples)]


def _tracking_frame_size(width: int, height: int):
    """Detection frame size: 640 wide when the source is wider, else the source size."""
    if width > _TRACKING_WIDTH:
        return _TRACKING_WIDTH, int(height * (_TRACKING_WIDTH / width))
    return width, height


def _ffmpeg_frame_plan(start_time: float, offsets: list, fps: float) -> dict:
    """Seek point, timestamp shift and output grid that make FFmpeg pick the sample frames.

    The seek path asked OpenCV for ``POS_MSEC = start + offset``, and OpenCV
    returns the source frame nearest to that time (frame ``floor(t * fps + 0.5)``,
    ties going to the later frame). Here the same frames come from one decode:

    * ``-ss`` lands half a source frame (``h``) before ``start`` plus ``eps``, so
      the frame nearest the clip start is still decoded, and the one exactly
      half a frame earlier (which loses the tie) is not.
    * ``setpts`` moves every frame back by ``shift``, so a frame's new time is
      its source time minus ``start + h + eps``.
    * ``fps=...:round=up:start_time=0`` gives output slot ``k`` the last frame
      whose new time is at most ``k * step``, i.e. the last frame at or before
      ``start + k * step + h``: the nearest frame to the sample time.

    ``eps`` (0.5 ms) breaks exact ties the way OpenCV does and absorbs
    container timestamp rounding. The offsets are always ``k * step`` with
    ``step = offsets[1]`` (the interval, or the whole window when the clip is
    shorter than one interval), so slot ``k`` is sample ``k``. The fps filter
    repeats a frame when the source has a gap longer than ``step``, so a gap
    never shifts the later samples.
    """
    step = offsets[1]
    half_frame = 0.5 / fps
    eps = min(0.0005, half_frame / 4)
    seek = max(0.0, start_time - half_frame + eps)
    shift = start_time + half_frame + eps - seek
    rate = Fraction(step).limit_denominator(1_000_000)
    return {
        "seek": seek,
        "shift": shift,
        "step": step,
        "rate": f"{rate.denominator}/{rate.numerator}",
        # Half a second past the last sample, so the fps filter sees the frame
        # after it instead of the end of the input.
        "window": (start_time - seek) + offsets[-1] + half_frame + 0.5,
    }


def _ffmpeg_sample_command(ffmpeg: str, video_path: str, start_time: float, offsets: list, fps: float, width: int, height: int) -> list:
    """FFmpeg command that writes the sample frames as raw BGR to stdout."""
    plan = _ffmpeg_frame_plan(start_time, offsets, fps)
    video_filter = (
        f"setpts=PTS-{plan['shift']:.6f}/TB,"
        f"fps=fps={plan['rate']}:start_time=0:round=up,"
        f"scale={width}:{height}:flags=bilinear"
    )
    return [
        ffmpeg, "-hide_banner", "-nostdin", "-loglevel", "error",
        "-ss", f"{plan['seek']:.6f}", "-t", f"{plan['window']:.6f}",
        "-i", video_path,
        "-map", "0:V:0", "-an", "-sn", "-dn",
        "-vf", video_filter,
        "-frames:v", str(len(offsets)),
        "-f", "rawvideo", "-pix_fmt", "bgr24", "pipe:1",
    ]


class _FfmpegFrameError(Exception):
    """The FFmpeg tracking process stopped or failed before sending every frame."""


class _FfmpegFrameReader:
    """One FFmpeg process that streams the sample frames of a clip, one per read()."""

    def __init__(self, cmd: list, width: int, height: int):
        self.cmd = cmd
        self.width = width
        self.height = height
        self.frame_size = width * height * 3
        self._stderr_tail = b""
        self.proc = subprocess.Popen(cmd, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        # FFmpeg blocks if nobody empties its stderr pipe, so drain it alongside.
        self._stderr_thread = threading.Thread(target=self._drain_stderr, daemon=True)
        self._stderr_thread.start()

    def _drain_stderr(self):
        try:
            for chunk in iter(lambda: self.proc.stderr.read(4096), b""):
                self._stderr_tail = (self._stderr_tail + chunk)[-2000:]
        except (OSError, ValueError):
            pass

    def stderr_text(self) -> str:
        return self._stderr_tail.decode("utf-8", "ignore").strip()

    def read(self):
        """The next frame, or None when FFmpeg exited normally with no frame left.

        Raises _FfmpegFrameError when FFmpeg failed or sent a partial frame.
        """
        buf = bytearray(self.frame_size)
        view = memoryview(buf)
        got = 0
        while got < self.frame_size:
            n = self.proc.stdout.readinto(view[got:])
            if not n:
                break
            got += n
        if got == self.frame_size:
            return np.frombuffer(buf, dtype=np.uint8).reshape(self.height, self.width, 3)

        try:
            code = self.proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            raise _FfmpegFrameError("FFmpeg closed its output but did not exit")
        self._stderr_thread.join(timeout=2)
        if got == 0 and code == 0:
            return None
        raise _FfmpegFrameError(
            f"FFmpeg exit code {code}, {got} of {self.frame_size} bytes of a frame received. "
            f"stderr: {self.stderr_text()[-600:]}"
        )

    def close(self):
        """Stop FFmpeg if it still runs, reap it, and close its pipes."""
        try:
            if self.proc.poll() is None:
                self.proc.kill()
        except OSError:
            pass
        try:
            self.proc.wait(timeout=10)
        except subprocess.TimeoutExpired as e:
            log_error("crop_utils.sample_face_trajectory_ffmpeg_cleanup", e)
        self._stderr_thread.join(timeout=2)
        for stream in (self.proc.stdout, self.proc.stderr):
            try:
                stream.close()
            except (OSError, ValueError):
                pass


def _seek_tracking_frame(cap, abs_t: float):
    """One detection frame read by seeking the capture (the pre-T0.16 way), or None."""
    cap.set(cv2.CAP_PROP_POS_MSEC, abs_t * 1000.0)
    ret, frame = cap.read()
    if not ret:
        return None
    fh, fw = frame.shape[:2]
    if fw > _TRACKING_WIDTH:
        small_w, small_h = _tracking_frame_size(fw, fh)
        return cv2.resize(frame, (small_w, small_h))
    return frame


def sample_face_trajectory(video_path: str, start_time: float, end_time: float, interval: float = 0.5, should_cancel = None, engine: str = "haar", info: dict = None) -> list[tuple]:
    """Sample face positions at periodic intervals across a clip window.

    The sample frames are decoded in one sequential FFmpeg read of the clip
    (see ``_ffmpeg_frame_plan``). If FFmpeg is missing or fails, the reason is
    logged and the remaining samples are read by seeking with OpenCV.

    ``engine="mediapipe"`` uses MediaPipe Face Mesh (speaker picked by Mouth
    Aspect Ratio). If MediaPipe cannot start or fails on a frame, the reason is
    logged and OpenCV Haar Cascade takes over from that frame on. Every sample
    frame is decoded once, whichever engine ends up handling it.

    ``info``, when given, receives ``engine_used`` ("mediapipe" or "haar") and,
    after a fallback, ``fallback_reason``.
    """
    return _sample_face_trajectory(video_path, start_time, end_time, interval, should_cancel, engine, info, use_ffmpeg=True)


def _sample_face_trajectory(video_path, start_time, end_time, interval=0.5, should_cancel=None, engine="haar", info=None, use_ffmpeg=True):
    """sample_face_trajectory; ``use_ffmpeg=False`` reads every sample by seeking (the old path)."""
    if info is None:
        info = {}
    info["engine_used"] = "haar"

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        cap.release()
        return [(0.0, 0.5)]

    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    frame_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
    frame_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)

    duration, offsets = _sample_offsets(start_time, end_time, interval)

    half_window = (frame_h * 9 / 16) / frame_w / 2 if (frame_w and frame_h) else 0.28
    lo, hi = half_window, 1.0 - half_window

    def note_fallback(reason):
        info["fallback_reason"] = str(reason)
        log_error(
            "crop_utils.sample_face_trajectory_mediapipe_fallback",
            f"MediaPipe face tracking failed, using OpenCV Haar Cascade instead. Reason: {reason}",
        )

    def note_ffmpeg_fallback(reason, done):
        log_error(
            _FFMPEG_FALLBACK_CONTEXT,
            f"Sequential FFmpeg read of the tracking frames stopped after {done} of {len(offsets)} frames; "
            f"the rest are read by seeking with OpenCV (slower). Video: {video_path}. Reason: {reason}",
        )

    face_mesh = None
    face_cascade = None
    reader = None
    raw_frames = []
    try:
        if engine == "mediapipe":
            try:
                face_mesh = _open_face_mesh()
            except Exception as e:
                note_fallback(e)

        if use_ffmpeg:
            ffmpeg = _ffmpeg_executable()
            if not ffmpeg:
                note_ffmpeg_fallback("FFmpeg executable not found", 0)
            elif not (frame_w and frame_h):
                note_ffmpeg_fallback("OpenCV reported no frame size for this video", 0)
            else:
                small_w, small_h = _tracking_frame_size(frame_w, frame_h)
                cmd = _ffmpeg_sample_command(ffmpeg, video_path, start_time, offsets, fps, small_w, small_h)
                try:
                    reader = _FfmpegFrameReader(cmd, small_w, small_h)
                except (OSError, ValueError, subprocess.SubprocessError) as e:
                    note_ffmpeg_fallback(f"FFmpeg could not start: {e}", 0)

        for i, rel_t in enumerate(offsets):
            if should_cancel and should_cancel():
                break

            small_frame = None
            if reader is not None:
                try:
                    small_frame = reader.read()
                    if small_frame is None:
                        raise _FfmpegFrameError(
                            f"FFmpeg finished after {i} of {len(offsets)} frames "
                            "(normal when the clip runs to the end of the video)"
                        )
                except (_FfmpegFrameError, OSError, ValueError) as e:
                    note_ffmpeg_fallback(e, i)
                    reader.close()
                    reader = None
            if reader is None:
                small_frame = _seek_tracking_frame(cap, start_time + rel_t)
            if small_frame is None:
                raw_frames.append((rel_t, []))
                continue

            faces = None
            if face_mesh is not None:
                try:
                    faces = _mediapipe_faces(face_mesh, small_frame)
                except Exception as e:
                    note_fallback(e)
                    _close_face_mesh(face_mesh)
                    face_mesh = None
            if faces is None:
                if face_cascade is None:
                    face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
                    if face_cascade.empty():
                        return [(0.0, 0.5)]
                faces = _haar_faces(face_cascade, small_frame)
            del small_frame
            raw_frames.append((rel_t, faces))
    finally:
        if reader is not None:
            reader.close()
        if face_mesh is not None:
            _close_face_mesh(face_mesh)
        cap.release()

    if engine == "mediapipe" and "fallback_reason" not in info:
        info["engine_used"] = "mediapipe"
        trajectory = _speaker_trajectory(raw_frames, lo, hi)
    else:
        trajectory = _largest_face_trajectory(raw_frames, lo, hi)

    return trajectory if trajectory else [(0.0, 0.5, 0.16)]




def smooth_trajectory(trajectory: list[tuple], alpha: float = 0.25) -> list[tuple]:
    """Smooth the x of (t, x) or (t, x, w) points with an Exponential Moving Average (EMA).

    Anything after x (the face width) is passed through unchanged.
    """
    if not trajectory:
        return [(0.0, 0.5)]
    if len(trajectory) == 1:
        return list(trajectory)

    smoothed = [tuple(trajectory[0])]
    current_val = trajectory[0][1]

    for pt in trajectory[1:]:
        current_val = alpha * pt[1] + (1.0 - alpha) * current_val
        smoothed.append((pt[0], current_val, *pt[2:]))

    return smoothed


def apply_deadband_filter(raw_trajectory: list[tuple], default_deadband: float = 0.08) -> list[tuple]:
    """Lock the crop position until the subject moves beyond a deadband.
    
    Small, jittery face movements (breathing, micro-shifts while a speaker sits
    still) would otherwise make the crop window wobble frame to frame. We hold
    an anchor position and only let it follow the face once the face has moved
    further than the deadband.

    If the tuple provides a face width ratio (t, x, w), the deadband is dynamically
    set to a fraction of the face width to adapt to how close the subject is.
    The width is kept on the returned points.
    """
    if not raw_trajectory:
        return [(0.0, 0.5, 0.16)]
    result = []
    anchor = raw_trajectory[0][1]
    for pt in raw_trajectory:
        t = pt[0]
        x = pt[1]
        deadband = (pt[2] * 0.5) if len(pt) >= 3 else default_deadband
        if abs(x - anchor) >= deadband:
            anchor = x
        result.append((t, anchor, *pt[2:]))
    return result


def detect_video_layout(video_path: str, start_time=None, end_time=None, samples: int = 12, should_cancel=None) -> dict:
    """Classify a video as gaming split-screen vs. a standard centred crop.

    Samples a *fixed* number of frames spread across the window. Detects all faces,
    then clusters them by spatial position. If a cluster of faces is found statically
    in a corner across many frames, it identifies it as a gaming facecam.

    Returns a dict with normalised (0-1) geometry so callers don't depend on the
    source resolution::

        {"mode": "gaming"|"standard",
         "face_box": (x, y, w, h) | None,
         "face_area_ratio": float,
         "face_center": (cx, cy)}
    """
    import statistics

    result = {"mode": "standard", "face_box": None, "face_area_ratio": 0.0, "face_center": (0.5, 0.5)}

    cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
    cascade_alt = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_alt2.xml')
    cascade_prof = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_profileface.xml')
    
    if cascade.empty():
        return result
        
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        cap.release()
        return result

    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    dur = total_frames / fps if fps else 0.0

    if start_time is not None:
        s = to_seconds(start_time)
        e = to_seconds(end_time) if end_time is not None else s + 30.0
    else:
        s, e = 0.0, (dur if dur else 1.0)
    if e <= s:
        e = s + 1.0

    # Collect all small faces from all sampled frames
    corner_faces = []
    
    for i in range(samples):
        if should_cancel and should_cancel():
            break
        t = s + (e - s) * (i / (samples - 1) if samples > 1 else 0.5)
        cap.set(cv2.CAP_PROP_POS_MSEC, t * 1000.0)
        ret, frame = cap.read()
        if not ret:
            continue
        fh_, fw_ = frame.shape[0], frame.shape[1]
        if not fw_ or not fh_:
            continue
            
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        all_faces = []
        
        faces = cascade.detectMultiScale(gray, scaleFactor=1.05, minNeighbors=4, minSize=(15, 15))
        if len(faces) > 0:
            all_faces.extend(faces)
            
        if not all_faces and not cascade_alt.empty():
            faces_alt = cascade_alt.detectMultiScale(gray, scaleFactor=1.05, minNeighbors=4, minSize=(15, 15))
            if len(faces_alt) > 0:
                all_faces.extend(faces_alt)
                
        if not all_faces and not cascade_prof.empty():
            faces_prof = cascade_prof.detectMultiScale(gray, scaleFactor=1.05, minNeighbors=4, minSize=(15, 15))
            if len(faces_prof) > 0:
                all_faces.extend(faces_prof)
                
            gray_flip = cv2.flip(gray, 1)
            faces_prof_flip = cascade_prof.detectMultiScale(gray_flip, scaleFactor=1.05, minNeighbors=4, minSize=(15, 15))
            if len(faces_prof_flip) > 0:
                for (x, y, w, h) in faces_prof_flip:
                    all_faces.append((fw_ - x - w, y, w, h))

        for (x, y, w, h) in all_faces:
            area = (w * h) / (fw_ * fh_)
            if area < 0.25:  # Consider faces up to 25% of screen area
                cx = (x + w / 2) / fw_
                cy = (y + h / 2) / fh_
                # Pre-filter: facecam is usually off-center
                if abs(cx - 0.5) > 0.1 or abs(cy - 0.5) > 0.1:
                    corner_faces.append((cx, cy, area, x / fw_, y / fh_, w / fw_, h / fh_))

    cap.release()

    if not corner_faces:
        return result

    # Cluster faces by spatial proximity to find the static facecam
    clusters = []
    for f in corner_faces:
        cx, cy = f[0], f[1]
        added = False
        for c in clusters:
            # If within 10% spatial distance, it's the same facecam position
            if abs(c['cx'] - cx) < 0.1 and abs(c['cy'] - cy) < 0.1:
                c['faces'].append(f)
                # Update cluster center
                c['cx'] = sum(x[0] for x in c['faces']) / len(c['faces'])
                c['cy'] = sum(x[1] for x in c['faces']) / len(c['faces'])
                added = True
                break
        if not added:
            clusters.append({'cx': cx, 'cy': cy, 'faces': [f]})

    # Find the cluster with the most detections
    best_cluster = max(clusters, key=lambda c: len(c['faces']))
    
    # Require facecam to be detected in at least 20% of sampled frames (or 2 frames min)
    min_detections = max(2, int(samples * 0.2))
    if len(best_cluster['faces']) >= min_detections:
        med = lambda idx: statistics.median([b[idx] for b in best_cluster['faces']])
        cx, cy, area = med(0), med(1), med(2)
        
        result["face_center"] = (cx, cy)
        result["face_area_ratio"] = area
        result["face_box"] = (med(3), med(4), med(5), med(6))
        result["mode"] = "gaming"

    return result


def _parse_srt_ts(ts: str) -> float:
    ts = ts.strip().replace('.', ',')
    h, m, rest = ts.split(':')
    s, ms = rest.split(',')
    return int(h) * 3600 + int(m) * 60 + int(s) + int(ms) / 1000.0


def _fmt_srt_ts(sec: float) -> str:
    if sec < 0:
        sec = 0
    h = int(sec // 3600); sec -= h * 3600
    m = int(sec // 60); sec -= m * 60
    s = int(sec); ms = int(round((sec - s) * 1000))
    if ms == 1000:
        s += 1; ms = 0
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def shift_srt_for_clip(srt_text: str, start_time, end_time) -> str:
    """Slice a full-video SRT down to a clip window and rebase timestamps to 0.

    Burning the full transcript onto a trimmed clip would show the wrong lines,
    because the clip's timeline restarts at 0. This keeps only the cues that
    overlap [start, end] and shifts them relative to the clip start.
    """
    start_s = to_seconds(start_time)
    end_s = to_seconds(end_time)
    out = []
    idx = 1
    for block in re.split(r'\n\s*\n', srt_text.strip()):
        lines = block.strip().split('\n')
        if len(lines) < 2:
            continue
        tline = ti = None
        for i, ln in enumerate(lines):
            if '-->' in ln:
                tline, ti = ln, i
                break
        if tline is None:
            continue
        a, _, z = tline.partition('-->')
        try:
            cue_start = _parse_srt_ts(a)
            cue_end = _parse_srt_ts(z)
        except Exception:
            continue
        if cue_end <= start_s or cue_start >= end_s:
            continue
        new_start = max(cue_start, start_s) - start_s
        new_end = min(cue_end, end_s) - start_s
        text = '\n'.join(lines[ti + 1:]).strip()
        if not text:
            continue
        out.append(f"{idx}\n{_fmt_srt_ts(new_start)} --> {_fmt_srt_ts(new_end)}\n{text}")
        idx += 1
    return '\n\n'.join(out) + ('\n' if out else '')


def _fmt_ass_ts(sec: float) -> str:
    if sec < 0:
        sec = 0
    h = int(sec // 3600); sec -= h * 3600
    m = int(sec // 60); sec -= m * 60
    s = int(sec); cs = int(round((sec - s) * 100))
    if cs == 100:
        s += 1; cs = 0
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"


def hex_to_ass_style_color(hex_str: str, default: str = "&H0000E6FF") -> str:
    """Konversi '#RRGGBB' ke format PrimaryColour ASS: '&H00BBGGRR'."""
    if not hex_str or not isinstance(hex_str, str):
        return default
    clean = hex_str.strip().lstrip('#')
    if len(clean) == 6:
        try:
            int(clean, 16)
            r, g, b = clean[0:2], clean[2:4], clean[4:6]
            return f"&H00{b.upper()}{g.upper()}{r.upper()}"
        except ValueError:
            return default
    return default


def normalize_subtitle_config(raw_config: dict = None, legacy_style: str = "standard") -> dict:
    """Menjamin konfigurasi subtitle selalu lengkap dengan fallback yang aman."""
    # Legacy mapping: caller lama yang mengirim legacy_style="karaoke"
    # sebenarnya bermaksud single_word (ADR-009 taxonomy fix).
    _LEGACY_MAP = {"karaoke": "single_word"}
    default_style = _LEGACY_MAP.get(legacy_style, legacy_style)
    if default_style not in ("standard", "karaoke", "single_word"):
        default_style = "single_word"

    if not isinstance(raw_config, dict):
        raw_config = {}

    style = raw_config.get("style", default_style)
    if style not in ("standard", "karaoke", "single_word"):
        style = default_style

    return {
        "style": style,
        "highlight_color": str(raw_config.get("highlight_color", "#FFE600")),
        "text_color": str(raw_config.get("text_color", "#FFFFFF")),
        "outline_color": str(raw_config.get("outline_color", "#000000")),
        "shadow_color": str(raw_config.get("shadow_color", "#000000")),
        "font_family": str(raw_config.get("font_family", "Arial")),
        "font_size_scale": float(raw_config.get("font_size_scale", 1.0)),
        "font_weight": str(raw_config.get("font_weight", "bold")),
        "italic": bool(raw_config.get("italic", False)),
        "uppercase": bool(raw_config.get("uppercase", (style in ("single_word",)))),
        "outline_width": max(1, min(5, int(raw_config.get("outline_width", 2)))),
        "shadow_depth": max(0, min(10, int(raw_config.get("shadow_depth", 2)))),
        "animation_pop": bool(raw_config.get("animation_pop", False)),
        "watermark_text": str(raw_config.get("watermark_text", "")),
        "watermark_opacity": float(raw_config.get("watermark_opacity", 0.5)),
        "position_x": int(raw_config.get("position_x", 50)),
        "position_y": int(raw_config.get("position_y", 85)),
    }


def calculate_ass_styles(width: int, height: int, custom_margin_v: int = None, subtitle_config: dict = None):
    """Calculates proportional font sizes based on video dimensions and custom scale."""
    cfg = normalize_subtitle_config(subtitle_config)
    scale = max(0.5, min(2.0, cfg.get("font_size_scale", 1.0)))

    is_vertical = height > width
    if is_vertical:
        font_size = max(14, round(width * 0.055 * scale))
        margin_v = max(20, round(height * 0.15))
    else:
        font_size = max(14, round(height * 0.065 * scale))
        margin_v = max(20, round(height * 0.08))
        
    if custom_margin_v is not None and custom_margin_v > 0:
        margin_v = custom_margin_v

    # Gunakan outline_width & shadow_depth dari config jika tersedia
    outline = cfg.get("outline_width", max(1, round(font_size * 0.08)))
    shadow = cfg.get("shadow_depth", outline)
    margin_h = max(20, round(width * 0.05))
    return font_size, outline, shadow, margin_h, margin_v


def srt_to_ass(srt_text: str, width: int, height: int, custom_margin_v: int = None, subtitle_config: dict = None) -> str:
    """Convert SRT text to an ASS subtitle with an explicit script resolution and custom typography."""
    width = int(width) or 1080
    height = int(height) or 1920
    cfg = normalize_subtitle_config(subtitle_config, legacy_style="standard")
    
    font_size, outline, shadow, margin_h, margin_v = calculate_ass_styles(width, height, custom_margin_v=custom_margin_v, subtitle_config=cfg)

    font_name = cfg.get("font_family", "Arial")
    bold_val = -1 if cfg.get("font_weight") == "bold" else 0
    italic_val = -1 if cfg.get("italic") else 0
    is_uppercase = cfg.get("uppercase", False)

    header = (
        "[Script Info]\n"
        "ScriptType: v4.00+\n"
        "WrapStyle: 1\n"  # 1 = Smart word wrapping if line is too long
        f"PlayResX: {width}\n"
        f"PlayResY: {height}\n\n"
        "[V4+ Styles]\n"
        "Format: Name, Fontname, Fontsize, PrimaryColour, OutlineColour, BackColour, "
        "Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, "
        "Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n"
        f"Style: Default,{font_name},{font_size},&H00FFFFFF,&H00000000,&H80000000,"
        f"{bold_val},{italic_val},0,0,100,100,0,0,1,{outline},{shadow},2,{margin_h},{margin_h},{margin_v},1\n"
    )

    watermark_text = cfg.get("watermark_text", "").strip()
    watermark_opacity = float(cfg.get("watermark_opacity", 0.5))
    if watermark_text:
        wm_alpha = int((1.0 - watermark_opacity) * 255)
        wm_alpha_hex = f"{wm_alpha:02X}"
        wm_font_size = max(12, int(font_size * 0.75))
        wm_margin_v = int(height * 0.08) if height > width else int(height * 0.05)
        header += f"Style: Watermark,{font_name},{wm_font_size},&H{wm_alpha_hex}FFFFFF,&H{wm_alpha_hex}000000,&H{wm_alpha_hex}000000,0,0,0,0,100,100,0,0,1,1,1,8,10,10,{wm_margin_v},1\n"

    header += (
        "\n[Events]\n"
        "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n"
    )
    events = []
    if watermark_text:
        events.append(f"Dialogue: 0,0:00:00.00,9:59:59.99,Watermark,,0,0,0,,{watermark_text}")
    for block in re.split(r'\n\s*\n', srt_text.strip()):
        lines = block.strip().split('\n')
        if len(lines) < 2:
            continue
        tline = ti = None
        for i, ln in enumerate(lines):
            if '-->' in ln:
                tline, ti = ln, i
                break
        if tline is None:
            continue
        a, _, z = tline.partition('-->')
        try:
            st = _parse_srt_ts(a)
            et = _parse_srt_ts(z)
        except Exception:
            continue
        raw_text = '\\N'.join(ln.strip() for ln in lines[ti + 1:] if ln.strip())
        if not raw_text:
            continue
        text = raw_text.upper() if is_uppercase else raw_text
        
        pos_x = cfg.get("position_x", 50)
        pos_y = cfg.get("position_y", 85)
        if pos_x != 50 or pos_y != 85:
            x_px = int(width * pos_x / 100)
            y_px = int(height * pos_y / 100)
            text = f"{{\\pos({x_px},{y_px})}}{text}"
            
        events.append(
            f"Dialogue: 0,{_fmt_ass_ts(st)},{_fmt_ass_ts(et)},Default,,0,0,0,,{text}"
        )
    return header + "\n".join(events) + ("\n" if events else "")


def chunk_words_smartly(clip_words, max_words=5, max_chars=28):
    """Chunks words into phrases based on word count, character count, or punctuation."""
    chunks = []
    current_chunk = []
    current_len = 0
    
    for w in clip_words:
        word_text = w["word"].strip()
        word_len = len(word_text)
        is_punct = word_text.endswith(('.', '?', '!', ',', ';'))
        
        if (len(current_chunk) >= max_words or (current_len + word_len > max_chars and current_chunk)):
            chunks.append(current_chunk)
            current_chunk = [w]
            current_len = word_len
        else:
            current_chunk.append(w)
            current_len += word_len + 1
            
        if is_punct and len(current_chunk) >= 2:
            chunks.append(current_chunk)
            current_chunk = []
            current_len = 0
            
    if current_chunk:
        chunks.append(current_chunk)
    return chunks


def words_to_single_word_ass(words: list, width: int, height: int, clip_start: float, clip_end: float, custom_margin_v: int = None, subtitle_config: dict = None) -> str:
    """Convert word-level timestamps to single-word pop ASS subtitles with strict zero-overlap."""
    width = int(width) or 1080
    height = int(height) or 1920
    cfg = normalize_subtitle_config(subtitle_config, legacy_style="karaoke")
    
    font_size, outline, shadow, margin_h, margin_v = calculate_ass_styles(width, height, custom_margin_v=custom_margin_v, subtitle_config=cfg)

    font_name = cfg.get("font_family", "Arial")
    bold_val = -1 if cfg.get("font_weight") == "bold" else 0
    italic_val = -1 if cfg.get("italic") else 0
    ass_primary_color = hex_to_ass_style_color(cfg.get("highlight_color", "#FFE600"))
    ass_outline_color = hex_to_ass_style_color(cfg.get("outline_color", "#000000"))
    ass_shadow_color = hex_to_ass_style_color(cfg.get("shadow_color", "#000000"), default="&H80000000")
    is_uppercase = cfg.get("uppercase", True)
    use_pop = cfg.get("animation_pop", False)

    header = (
        "[Script Info]\n"
        "ScriptType: v4.00+\n"
        "WrapStyle: 1\n"
        f"PlayResX: {width}\n"
        f"PlayResY: {height}\n\n"
        "[V4+ Styles]\n"
        "Format: Name, Fontname, Fontsize, PrimaryColour, OutlineColour, BackColour, "
        "Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, "
        "Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n"
        f"Style: Default,{font_name},{font_size},{ass_primary_color},{ass_outline_color},{ass_shadow_color},"
        f"{bold_val},{italic_val},0,0,100,100,0,0,1,{outline},{shadow},2,{margin_h},{margin_h},{margin_v},1\n"
    )

    watermark_text = cfg.get("watermark_text", "").strip()
    watermark_opacity = float(cfg.get("watermark_opacity", 0.5))
    if watermark_text:
        wm_alpha = int((1.0 - watermark_opacity) * 255)
        wm_alpha_hex = f"{wm_alpha:02X}"
        wm_font_size = max(12, int(font_size * 0.75))
        wm_margin_v = int(height * 0.08) if height > width else int(height * 0.05)
        header += f"Style: Watermark,{font_name},{wm_font_size},&H{wm_alpha_hex}FFFFFF,&H{wm_alpha_hex}000000,&H{wm_alpha_hex}000000,0,0,0,0,100,100,0,0,1,1,1,8,10,10,{wm_margin_v},1\n"

    header += (
        "\n[Events]\n"
        "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n"
    )

    clip_words = []
    for w in words:
        w_start = float(w.get("start", 0))
        w_end = float(w.get("end", 0))
        if w_start < clip_end and w_end > clip_start:
            s = max(0.0, w_start - clip_start)
            e = min(clip_end - clip_start, w_end - clip_start)
            if e > s:
                raw_w = str(w.get("word", "")).strip()
                if raw_w:
                    clip_words.append({"word": raw_w, "start": s, "end": e})

    if not clip_words and not watermark_text:
        return header

    events = []
    if watermark_text:
        dur = max(0.0, clip_end - clip_start)
        events.append(f"Dialogue: 0,0:00:00.00,{_fmt_ass_ts(dur)},Watermark,,0,0,0,,{watermark_text}")
        
    num_words = len(clip_words)
    
    for i in range(num_words):
        curr_word = clip_words[i]
        w_start = curr_word["start"]
        raw_end = curr_word["end"]
        
        if i < num_words - 1:
            next_start = clip_words[i+1]["start"]
            gap = next_start - raw_end
            if 0 <= gap < 0.2:
                w_end = next_start
            else:
                w_end = raw_end
            w_end = min(w_end, next_start)
        else:
            w_end = min(clip_end - clip_start, raw_end + 0.35)
            
        if i < num_words - 1:
            w_end = min(max(w_end, w_start + 0.08), clip_words[i+1]["start"])
        else:
            w_end = max(w_end, w_start + 0.08)
            
        # Jika timestamp anomali w_end <= w_start, lewati untuk mencegah glitch render
        if w_end <= w_start:
            continue

        text = curr_word["word"].upper() if is_uppercase else curr_word["word"]

        # Sisipkan tag animasi pop jika diaktifkan
        if use_pop:
            text = r"{\t(0,50,\fscx120\fscy120)\t(50,150,\fscx100\fscy100)}" + text

        pos_x = cfg.get("position_x", 50)
        pos_y = cfg.get("position_y", 85)
        if pos_x != 50 or pos_y != 85:
            x_px = int(width * pos_x / 100)
            y_px = int(height * pos_y / 100)
            text = f"{{\\pos({x_px},{y_px})}}{text}"

        events.append(
            f"Dialogue: 0,{_fmt_ass_ts(w_start)},{_fmt_ass_ts(w_end)},Default,,0,0,0,,{text}"
        )

    return header + "\n".join(events) + ("\n" if events else "")


def words_to_karaoke_ass(words: list, width: int, height: int, clip_start: float, clip_end: float, custom_margin_v: int = None, subtitle_config: dict = None) -> str:
    """Render kalimat penuh dengan highlight warna per-kata sesuai timestamp (true karaoke)."""
    width = int(width) or 1080
    height = int(height) or 1920
    cfg = normalize_subtitle_config(subtitle_config, legacy_style="standard")

    font_size, outline, shadow, margin_h, margin_v = calculate_ass_styles(width, height, custom_margin_v=custom_margin_v, subtitle_config=cfg)

    font_name = cfg.get("font_family", "Arial")
    bold_val = -1 if cfg.get("font_weight") == "bold" else 0
    italic_val = -1 if cfg.get("italic") else 0
    is_uppercase = cfg.get("uppercase", False)
    use_pop = cfg.get("animation_pop", False)

    ass_text_color = hex_to_ass_style_color(cfg.get("text_color", "#FFFFFF"))
    ass_highlight_color = hex_to_ass_style_color(cfg.get("highlight_color", "#FFE600"))
    ass_outline_color = hex_to_ass_style_color(cfg.get("outline_color", "#000000"))
    ass_shadow_color = hex_to_ass_style_color(cfg.get("shadow_color", "#000000"), default="&H80000000")

    header = (
        "[Script Info]\n"
        "ScriptType: v4.00+\n"
        "WrapStyle: 1\n"
        f"PlayResX: {width}\n"
        f"PlayResY: {height}\n\n"
        "[V4+ Styles]\n"
        "Format: Name, Fontname, Fontsize, PrimaryColour, OutlineColour, BackColour, "
        "Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, "
        "Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n"
        f"Style: Default,{font_name},{font_size},{ass_text_color},{ass_outline_color},{ass_shadow_color},"
        f"{bold_val},{italic_val},0,0,100,100,0,0,1,{outline},{shadow},2,{margin_h},{margin_h},{margin_v},1\n"
    )

    watermark_text = cfg.get("watermark_text", "").strip()
    watermark_opacity = float(cfg.get("watermark_opacity", 0.5))
    if watermark_text:
        wm_alpha = int((1.0 - watermark_opacity) * 255)
        wm_alpha_hex = f"{wm_alpha:02X}"
        wm_font_size = max(12, int(font_size * 0.75))
        wm_margin_v = int(height * 0.08) if height > width else int(height * 0.05)
        header += f"Style: Watermark,{font_name},{wm_font_size},&H{wm_alpha_hex}FFFFFF,&H{wm_alpha_hex}000000,&H{wm_alpha_hex}000000,0,0,0,0,100,100,0,0,1,1,1,8,10,10,{wm_margin_v},1\n"

    header += (
        "\n[Events]\n"
        "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n"
    )

    clip_words = []
    for w in words:
        w_start = float(w.get("start", 0))
        w_end = float(w.get("end", 0))
        if w_start < clip_end and w_end > clip_start:
            s = max(0.0, w_start - clip_start)
            e = min(clip_end - clip_start, w_end - clip_start)
            if e > s:
                raw_w = str(w.get("word", "")).strip()
                if raw_w:
                    clip_words.append({"word": raw_w, "start": s, "end": e})

    if not clip_words and not watermark_text:
        return header

    events = []
    if watermark_text:
        dur = max(0.0, clip_end - clip_start)
        events.append(f"Dialogue: 0,0:00:00.00,{_fmt_ass_ts(dur)},Watermark,,0,0,0,,{watermark_text}")

    if not clip_words:
        return header + "\n".join(events) + ("\n" if events else "")

    # Kelompokkan kata menjadi kalimat (max 7 kata atau jeda > 0.4s)
    chunks = []
    current_chunk = [clip_words[0]]
    for w in clip_words[1:]:
        prev_w = current_chunk[-1]
        gap = w["start"] - prev_w["end"]
        if gap > 0.4 or len(current_chunk) >= 7 or prev_w["word"].endswith(('.', '!', '?')):
            chunks.append(current_chunk)
            current_chunk = [w]
        else:
            current_chunk.append(w)
    if current_chunk:
        chunks.append(current_chunk)

    for chunk in chunks:
        c_end = chunk[-1]["end"]
        num_chunk_words = len(chunk)

        for wi, active_word in enumerate(chunk):
            w_start = active_word["start"]
            if wi < num_chunk_words - 1:
                w_end = chunk[wi + 1]["start"]
            else:
                w_end = c_end

            if w_end <= w_start:
                continue

            parts = []
            for wj, cw in enumerate(chunk):
                word_text = cw["word"].upper() if is_uppercase else cw["word"]
                if wj == wi:
                    prefix = r"{\c" + ass_highlight_color + r"}"
                    suffix = r"{\c" + ass_text_color + r"}"
                    if use_pop:
                        prefix += r"{\t(0,50,\fscx120\fscy120)\t(50,150,\fscx100\fscy100)}"
                        suffix += r"{\fscx100\fscy100}"
                    parts.append(prefix + word_text + suffix)
                else:
                    parts.append(word_text)

            full_text = " ".join(parts)
            
            pos_x = cfg.get("position_x", 50)
            pos_y = cfg.get("position_y", 85)
            if pos_x != 50 or pos_y != 85:
                x_px = int(width * pos_x / 100)
                y_px = int(height * pos_y / 100)
                full_text = f"{{\\pos({x_px},{y_px})}}{full_text}"
                
            events.append(
                f"Dialogue: 0,{_fmt_ass_ts(w_start)},{_fmt_ass_ts(w_end)},Default,,0,0,0,,{full_text}"
            )

    return header + "\n".join(events) + ("\n" if events else "")


def words_to_standard_ass(words: list, width: int, height: int, clip_start: float, clip_end: float, custom_margin_v: int = None, subtitle_config: dict = None) -> str:
    """Mengonversi word timestamps menjadi subtitle baris kalimat standar yang rapi."""
    width = int(width) or 1080
    height = int(height) or 1920
    cfg = normalize_subtitle_config(subtitle_config, legacy_style="standard")
    
    font_size, outline, shadow, margin_h, margin_v = calculate_ass_styles(width, height, custom_margin_v=custom_margin_v, subtitle_config=cfg)
    font_name = cfg.get("font_family", "Arial")
    bold_val = -1 if cfg.get("font_weight") == "bold" else 0
    italic_val = -1 if cfg.get("italic") else 0
    is_uppercase = cfg.get("uppercase", False)

    header = (
        "[Script Info]\n"
        "ScriptType: v4.00+\n"
        "WrapStyle: 1\n"
        f"PlayResX: {width}\n"
        f"PlayResY: {height}\n\n"
        "[V4+ Styles]\n"
        "Format: Name, Fontname, Fontsize, PrimaryColour, OutlineColour, BackColour, "
        "Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, "
        "Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n"
        f"Style: Default,{font_name},{font_size},&H00FFFFFF,&H00000000,&H80000000,"
        f"{bold_val},{italic_val},0,0,100,100,0,0,1,{outline},{shadow},2,{margin_h},{margin_h},{margin_v},1\n"
    )

    watermark_text = cfg.get("watermark_text", "").strip()
    watermark_opacity = float(cfg.get("watermark_opacity", 0.5))
    if watermark_text:
        wm_alpha = int((1.0 - watermark_opacity) * 255)
        wm_alpha_hex = f"{wm_alpha:02X}"
        wm_font_size = max(12, int(font_size * 0.75))
        wm_margin_v = int(height * 0.08) if height > width else int(height * 0.05)
        header += f"Style: Watermark,{font_name},{wm_font_size},&H{wm_alpha_hex}FFFFFF,&H{wm_alpha_hex}000000,&H{wm_alpha_hex}000000,0,0,0,0,100,100,0,0,1,1,1,8,10,10,{wm_margin_v},1\n"

    header += (
        "\n[Events]\n"
        "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n"
    )

    clip_words = []
    for w in words:
        w_start = float(w.get("start", 0))
        w_end = float(w.get("end", 0))
        if w_start < clip_end and w_end > clip_start:
            s = max(0.0, w_start - clip_start)
            e = min(clip_end - clip_start, w_end - clip_start)
            if e > s:
                raw_w = str(w.get("word", "")).strip()
                if raw_w:
                    clip_words.append({"word": raw_w, "start": s, "end": e})

    if not clip_words and not watermark_text:
        return header

    events = []
    if watermark_text:
        dur = max(0.0, clip_end - clip_start)
        events.append(f"Dialogue: 0,0:00:00.00,{_fmt_ass_ts(dur)},Watermark,,0,0,0,,{watermark_text}")

    if clip_words:
        # Kelompokkan kata menjadi kalimat berdasarkan jeda > 0.4s atau max 7 kata
        chunks = []
        current_chunk = [clip_words[0]]
        for w in clip_words[1:]:
            prev_w = current_chunk[-1]
            gap = w["start"] - prev_w["end"]
            if gap > 0.4 or len(current_chunk) >= 7 or prev_w["word"].endswith(('.', '!', '?')):
                chunks.append(current_chunk)
                current_chunk = [w]
            else:
                current_chunk.append(w)
        if current_chunk:
            chunks.append(current_chunk)

        for chunk in chunks:
            c_start = chunk[0]["start"]
            c_end = chunk[-1]["end"]
            sentence = " ".join(w["word"] for w in chunk)
            text = sentence.upper() if is_uppercase else sentence
            
            pos_x = cfg.get("position_x", 50)
            pos_y = cfg.get("position_y", 85)
            if pos_x != 50 or pos_y != 85:
                x_px = int(width * pos_x / 100)
                y_px = int(height * pos_y / 100)
                text = f"{{\\pos({x_px},{y_px})}}{text}"
                
            events.append(
                f"Dialogue: 0,{_fmt_ass_ts(c_start)},{_fmt_ass_ts(c_end)},Default,,0,0,0,,{text}"
            )

    return header + "\n".join(events) + ("\n" if events else "")


def _video_dims(path: str):
    """Return (width, height) of the video, or (0, 0) if unreadable."""
    cap = cv2.VideoCapture(path)
    if not cap.isOpened():
        cap.release()
        return (0, 0)
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)
    cap.release()
    return (w, h)


def _run_ffmpeg(cmd, cwd=None, register=None):
    """Run ffmpeg, returning (ok, stderr_text).

    Uses Popen (not subprocess.run) so the caller can register the live process
    handle and kill it mid-render on cancel.
    """
    # Diagnostic logging: capture the full command for debugging EINVAL etc.
    try:
        cmd_str = ' '.join(str(c) for c in cmd)
        log_app(f"[ffmpeg] CMD: {cmd_str}")
    except Exception:
        pass
    proc = subprocess.Popen(cmd, cwd=cwd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if register:
        register(proc)
    _, stderr = proc.communicate()
    ok = proc.returncode == 0
    if not ok:
        try:
            stderr_text = (stderr or b"").decode("utf-8", "ignore")
            log_error("crop_utils._run_ffmpeg_fail", f"RC={proc.returncode} CWD={cwd} STDERR(last 600): {stderr_text[-600:]}")
        except Exception:
            pass
    return ok, (stderr or b"").decode("utf-8", "ignore")


def _video_duration(path: str):
    """Return the video duration in seconds, or None if it can't be read."""
    cap = cv2.VideoCapture(path)
    if not cap.isOpened():
        cap.release()
        return None
    fps = cap.get(cv2.CAP_PROP_FPS) or 0
    frames = cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0
    cap.release()
    if fps > 0 and frames > 0:
        return frames / fps
    return None


def build_crop_filter(aspect_ratio: str, center_pct: float) -> str:
    """ffmpeg crop expression for a given target aspect ratio.

    Portrait/square ratios keep the full source height and crop the width,
    horizontally centred on the detected face. Landscape (16:9) instead keeps
    the full width and crops the height, centred vertically. The returned
    string must not contain a comma (it is concatenated with ",ass=...").
    """
    if aspect_ratio == "1:1":
        return f"crop=trunc(ih/2)*2:ih:iw*{center_pct}-ih/2:0"
    elif aspect_ratio == "4:5":
        return f"crop=trunc(ih*4/5/2)*2:ih:iw*{center_pct}-ih*4/10:0"
    elif aspect_ratio == "16:9":
        return "crop=iw:trunc(iw*9/16/2)*2:0:(ih-trunc(iw*9/16/2)*2)/2"
    else:  # 9:16 default
        return f"crop=trunc(ih*9/16/2)*2:ih:iw*{center_pct}-ih*9/32:0"


def _build_lerp_expr(trajectory: list[tuple[float, float]]) -> str:
    """Build a piecewise linear interpolation expression for FFmpeg using a Binary Search Tree structure."""
    if not trajectory:
        return "0.5"
    if len(trajectory) == 1:
        return f"{trajectory[0][1]:.4f}"

    def _build_bst(start_idx: int, end_idx: int) -> str:
        if start_idx == end_idx - 1:
            t0, x0 = trajectory[start_idx][:2]
            t1, x1 = trajectory[end_idx][:2]
            dt = t1 - t0
            if dt <= 0:
                return f"{x1:.4f}"
            dx = x1 - x0
            return f"({x0:.4f}+{dx:.4f}*(t-{t0:.2f})/{dt:.2f})"
            
        mid_idx = (start_idx + end_idx) // 2
        t_mid = trajectory[mid_idx][0]
        
        left = _build_bst(start_idx, mid_idx)
        right = _build_bst(mid_idx, end_idx)
        
        return f"if(lte(t\\,{t_mid:.2f})\\,{left}\\,{right})"

    return _build_bst(0, len(trajectory) - 1)


def build_dynamic_crop_filter(aspect_ratio: str, trajectory: list[tuple[float, float]], clip_duration: float = 0.0) -> str:
    """Build a dynamic or static ffmpeg crop expression based on tracking trajectory."""
    if aspect_ratio == "16:9":
        return build_crop_filter("16:9", 0.5)

    if not trajectory:
        return build_crop_filter(aspect_ratio, 0.5)

    if len(trajectory) == 1:
        return build_crop_filter(aspect_ratio, trajectory[0][1])

    # If the subject barely moves across the whole clip (< 3% of frame width),
    # a static crop is steadier than a dynamic one that chases sub-pixel noise.
    xs = [pt[1] for pt in trajectory]
    if max(xs) - min(xs) < 0.03:
        # Anchor on the median so a stray endpoint doesn't bias the static frame.
        mid = sorted(xs)[len(xs) // 2]
        return build_crop_filter(aspect_ratio, mid)

    # We use a Binary Search Tree (BST) for the lerp expression, which has an AST depth of log2(N).
    # This avoids FFmpeg's recursion limit. We set a max of 400 points to prevent 
    # exceeding the Windows command line max length limit (32,767 chars).
    MAX_POINTS = 400
    if len(trajectory) > MAX_POINTS:
        step = (len(trajectory) - 1) / (MAX_POINTS - 1)
        downsampled = [trajectory[int(round(i * step))] for i in range(MAX_POINTS)]
        # Ensure exact end point is preserved
        downsampled[-1] = trajectory[-1]
        trajectory = downsampled

    lerp_expr = _build_lerp_expr(trajectory)

    if aspect_ratio == "1:1":
        return f"crop=trunc(ih/2)*2:ih:iw*({lerp_expr})-ih/2:0"
    elif aspect_ratio == "4:5":
        return f"crop=trunc(ih*4/5/2)*2:ih:iw*({lerp_expr})-ih*4/10:0"
    else:  # 9:16 default
        return f"crop=trunc(ih*9/16/2)*2:ih:iw*({lerp_expr})-ih*9/32:0"


def build_split_screen_filter(face_box, src_w: int, src_h: int, out_w: int, out_h: int,
                              in_label: str = "0:v", out_label: str = "main") -> str:
    """Build a filter_complex chain that stacks gameplay over a zoomed facecam.

    Top half: the gameplay, scaled to *cover* the top of the canvas (centred,
    overflow cropped — no distortion). Bottom half: the detected facecam box
    (padded for headroom, clamped in-frame), zoomed to cover the bottom half.

    Returns a chain ending in ``[out_label]`` sized ``out_w`` x (2*half), or
    ``None`` if inputs are unusable so the caller can fall back to a plain crop.
    """
    if not face_box or not src_w or not src_h or not out_w or not out_h:
        return None

    cw = (int(out_w) // 2) * 2
    half = (int(out_h) // 2 // 2) * 2  # even half-height
    if cw <= 0 or half <= 0:
        return None

    fx, fy, fw, fh = face_box
    if fw <= 0 or fh <= 0:
        return None

    # Size the facecam crop from a TARGET face-fill instead of a tight padded
    # box. The old approach cropped ~1.6x the detected face and then scaled that
    # to fill the whole bottom panel, so a small facecam got zoomed ~4x and the
    # face looked huge. Here we pick a crop region big enough that the face only
    # occupies ~FACE_FILL of the panel height (leaving headroom + shoulders),
    # and match the crop's aspect ratio to the panel so nothing gets over-cropped.
    FACE_FILL = 0.45          # face ≈ 45% of the panel height
    panel_ar = cw / half      # target width/height of the bottom panel

    # crop_h / crop_w are normalised (fractions of src_h / src_w).
    crop_h = min(1.0, fh / FACE_FILL)
    # width chosen so crop_w_px / crop_h_px == panel_ar
    crop_w = min(1.0, crop_h * panel_ar * (src_h / src_w)) if src_w else min(1.0, fw)
    if crop_h <= 0 or crop_w <= 0:
        return None

    # Centre on the face, biased slightly downward so we keep a little headroom
    # above and show the shoulders below (more natural than a centred head).
    bcx = fx + fw / 2
    bcy = fy + fh / 2 + 0.12 * crop_h
    bx = min(max(0.0, bcx - crop_w / 2), max(0.0, 1.0 - crop_w))
    by = min(max(0.0, bcy - crop_h / 2), max(0.0, 1.0 - crop_h))

    px = (int(bx * src_w) // 2) * 2
    py = (int(by * src_h) // 2) * 2
    pw = max(2, (int(crop_w * src_w) // 2) * 2)
    ph = max(2, (int(crop_h * src_h) // 2) * 2)
    if px + pw > src_w:
        pw = (int(src_w - px) // 2) * 2
    if py + ph > src_h:
        ph = (int(src_h - py) // 2) * 2
    if pw <= 0 or ph <= 0:
        return None

    return (
        f"[{in_label}]split=2[g0][f0];"
        f"[g0]scale={cw}:{half}:force_original_aspect_ratio=increase,crop={cw}:{half}[game];"
        f"[f0]crop={pw}:{ph}:{px}:{py},scale={cw}:{half}:force_original_aspect_ratio=increase,crop={cw}:{half}[face];"
        f"[game][face]vstack=inputs=2[{out_label}];"
    )


def output_dimensions(aspect_ratio: str, src_w: int = 0, src_h: int = 0) -> tuple[int, int]:
    """Target output resolution (width, height) for standard social media clips."""
    if aspect_ratio == "1:1":
        return 1080, 1080
    elif aspect_ratio == "4:5":
        return 1080, 1350
    elif aspect_ratio == "16:9":
        return 1920, 1080
    else:  # 9:16 default
        return 1080, 1920


def output_width(aspect_ratio: str, src_w: int, src_h: int) -> int:
    """Rendered clip width (even) for subtitle sizing, per aspect ratio."""
    if aspect_ratio == "1:1":
        return (int(src_h) // 2) * 2
    elif aspect_ratio == "4:5":
        return (int(src_h * 4 / 5) // 2) * 2
    elif aspect_ratio == "16:9":
        return (int(src_w) // 2) * 2 if src_w else 0
    else:  # 9:16 default
        return (int(src_h * 9 / 16) // 2) * 2 if src_h else 0


def build_canvas_background_filter(canvas_config: dict, src_w: int, src_h: int, out_w: int, out_h: int, duration: float, bg_img_stream_idx: int = None) -> str:
    """Build FFmpeg filter graph for landscape video placed on a styled 9:16 portrait canvas."""
    cfg = canvas_config or {}
    bg_type = str(cfg.get("background_type") or "blur").lower().strip()
    enlarge_scale = float(cfg.get("enlarge_scale") or 1.0)
    
    # Calculate foreground dimensions
    fw = int(out_w * enlarge_scale)
    fw = (fw // 2) * 2
    if fw <= 0:
        fw = out_w

    if bg_type == "color":
        color_hex = str(cfg.get("background_color") or "#000000").strip()
        clean_c = "0x" + color_hex.lstrip("#") if re.match(r"^#?[0-9a-fA-F]{6}$", color_hex) else "black"
        return f"color=c={clean_c}:s={out_w}x{out_h}:d={duration:.3f}[bg];[0:v]scale={fw}:-2[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2[main];"

    elif bg_type == "image" and bg_img_stream_idx is not None:
        return f"[{bg_img_stream_idx}:v]scale={out_w}:{out_h}:force_original_aspect_ratio=increase,crop={out_w}:{out_h}[bg];[0:v]scale={fw}:-2[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2[main];"

    else:  # default: "blur"
        blur_level = str(cfg.get("blur_level") or "medium").lower().strip()
        radius_map = {"light": 10, "medium": 25, "strong": 45}
        radius = radius_map.get(blur_level, 25)
        return (
            f"[0:v]split=2[bg_raw][fg_raw];"
            f"[bg_raw]scale=360:640:force_original_aspect_ratio=increase,crop=360:640,"
            f"boxblur=luma_radius={radius}:luma_power=2,scale={out_w}:{out_h}[bg];"
            f"[fg_raw]scale={fw}:-2[fg];"
            f"[bg][fg]overlay=(W-w)/2:(H-h)/2[main];"
        )


def crop_to_vertical(input_path: str, output_path: str, start_time: str,
                     end_time: str, subtitle_path: str = None, aspect_ratio: str = "9:16",
                     register_proc=None, should_cancel=None, broll_path: str = None,
                     layout: dict = None, canvas_config: dict = None,
                     subtitle_config: dict = None, tracking_mode: str = "auto",
                     engine: str = "haar") -> str:
    """Crop to 9:16 (or chosen ratio), trim to [start, end], scale to standard dimensions,
    and optionally burn subtitles with custom typography and zero-overlap single-word pop.
    Supports canvas conversion (blur, color, image backgrounds with scaling) for 16:9 sources.

    ``subtitle_path`` should point at a full-video .srt or .json; a per-clip subtitle is
    generated automatically so the captions line up with the trimmed clip.
    """
    if should_cancel and should_cancel():
        raise RuntimeError("Dibatalkan oleh pengguna.")

    start_s = to_seconds(start_time)
    end_s = to_seconds(end_time)

    # Small padding so clips don't cut off the first/last word of a sentence.
    PAD = 0.5
    start_s = max(0.0, start_s - PAD)
    end_s = end_s + PAD

    # Guard against out-of-range AI timestamps, which otherwise make ffmpeg
    # emit an empty (unplayable) file while still exiting successfully.
    total = _video_duration(input_path)
    if total:
        if start_s >= total:
            raise ValueError(
                f"Highlight start {start_s:.0f}s is past the video length "
                f"{total:.0f}s — the AI returned an out-of-range timestamp."
            )
        end_s = min(end_s, total)

    duration = end_s - start_s
    if duration < 0.5:
        raise ValueError(
            f"Highlight window is invalid (start {start_s:.1f}s, end {end_s:.1f}s)."
        )

    # Standard target dimensions for social media (ensures NVENC 16-pixel alignment & crisp 1080p)
    src_w, src_h = _video_dims(input_path)
    if src_w <= 0 or src_h <= 0:
        log_error("crop_utils.crop_to_vertical", f"Cannot read video dimensions for {input_path}, got {src_w}x{src_h}")
    
    is_canvas_mode = bool(canvas_config and canvas_config.get("enabled"))
    if is_canvas_mode:
        out_w, out_h = 1080, 1920
        scale_filter = f"scale={out_w}:{out_h},setsar=1"
        crop_filter = ""
        gaming = False
        face_box = None
        
        enlarge_scale = float(canvas_config.get("enlarge_scale") or 1.0)
        fw = (int(out_w * enlarge_scale) // 2) * 2
        fh = int(round(fw * (src_h / src_w))) if (src_w and src_h) else int(round(fw * 9 / 16))
        fh = (fh // 2) * 2
        custom_margin_v = max(40, round((out_h - fh) / 3))
    else:
        out_w, out_h = output_dimensions(aspect_ratio, src_w, src_h)
        scale_filter = f"scale={out_w}:{out_h},setsar=1"
        custom_margin_v = None

        # Layout: when the caller supplies one (computed once per job) we reuse its
        # face position and gaming classification instead of re-detecting per clip.
        gaming = False
        face_box = None
        if layout is None:
            if should_cancel and should_cancel():
                raise RuntimeError("Dibatalkan oleh pengguna.")
            
            if tracking_mode == "center":
                trajectory = [(0.0, 0.5)]
            else:
                with stage("tracking") as tracking:
                    tracking["tracking_engine_requested"] = engine
                    track_info = {}
                    raw_traj = sample_face_trajectory(input_path, start_time=start_s, end_time=end_s, interval=0.5, should_cancel=should_cancel, engine=engine, info=track_info)
                    tracking["tracking_engine_used"] = track_info.get("engine_used", engine)
                if should_cancel and should_cancel():
                    raise RuntimeError("Dibatalkan oleh pengguna.")
                # Deadband first (lock out micro-jitter), then EMA smoothing turns any
                # larger repositioning into a gentle pan.
                stabilized = apply_deadband_filter(raw_traj, default_deadband=0.08)
                trajectory = smooth_trajectory(stabilized, alpha=0.25)
                
            crop_filter = build_dynamic_crop_filter(aspect_ratio, trajectory, clip_duration=duration)
        else:
            cx = (layout.get("face_center") or (0.5, 0.5))[0]
            if src_w and src_h:
                half_window = (src_h * 9 / 16) / src_w / 2
                lo, hi = half_window, 1 - half_window
                cx = max(lo, min(hi, cx)) if lo <= hi else cx
            center_pct = cx
            # Split-screen only makes sense for the 9:16 target (see design spec).
            gaming = aspect_ratio == "9:16" and layout.get("mode") == "gaming" and bool(layout.get("face_box"))
            face_box = layout.get("face_box")
            crop_filter = build_crop_filter(aspect_ratio, center_pct)

    # Build an optional subtitle-burning variant. We generate an .ass sized to
    # the clip and reference it by basename while running ffmpeg from that
    # folder, which sidesteps the fragile Windows drive-letter escaping
    # (C:\ -> C\:) inside the subtitle filter.
    subtitle_vf = None
    subtitle_cwd = None
    if subtitle_path and os.path.exists(subtitle_path):
        import json
        is_json = subtitle_path.endswith(".json")
        cfg = normalize_subtitle_config(subtitle_config, legacy_style="karaoke" if is_json else "standard")
        desired_style = cfg.get("style", "karaoke" if is_json else "standard")
            
        ass_text = ""
        
        try:
            with open(subtitle_path, "r", encoding="utf-8") as f:
                content = f.read()
                
            if is_json:
                data = json.loads(content)
                words = data.get("words", [])
                if desired_style == "standard":
                    ass_text = words_to_standard_ass(words, out_w, out_h, start_s, end_s, custom_margin_v=custom_margin_v, subtitle_config=cfg)
                elif desired_style == "karaoke":
                    ass_text = words_to_karaoke_ass(words, out_w, out_h, start_s, end_s, custom_margin_v=custom_margin_v, subtitle_config=cfg)
                else: # single_word (default)
                    ass_text = words_to_single_word_ass(words, out_w, out_h, start_s, end_s, custom_margin_v=custom_margin_v, subtitle_config=cfg)
            else:
                # File .srt legacy (hanya bisa mode standard)
                clip_srt = shift_srt_for_clip(content, start_s, end_s)
                if clip_srt.strip():
                    ass_text = srt_to_ass(clip_srt, out_w, out_h, custom_margin_v=custom_margin_v, subtitle_config=cfg)
        except Exception as e:
            log_error("crop_utils.generate_ass", f"Failed to generate ASS: {e}")
            ass_text = ""
            
        if ass_text:
            clip_ass_path = output_path.rsplit('.', 1)[0] + ".ass"
            with open(clip_ass_path, "w", encoding="utf-8") as f:
                f.write(ass_text)
            subtitle_cwd = os.path.dirname(clip_ass_path) or None
            # Normalize path for FFmpeg, replacing \ with / and escaping it
            ass_name = os.path.basename(clip_ass_path).replace('\\', '/')
            # Escape colons, brackets, and quotes in the path
            escaped_ass_name = ass_name.replace(":", "\\\\:").replace("'", "\\\\'")
            fonts_dir_escaped = FONTS_DIR.replace('\\', '/').replace(":", "\\\\:").replace("'", "\\\\'")
            base_vf = f"{crop_filter},{scale_filter}" if crop_filter else scale_filter
            subtitle_vf = f"{base_vf},ass='{escaped_ass_name}':fontsdir='{fonts_dir_escaped}'"

    def build_cmd(use_split: bool = False, force_cpu: bool = False):
        cmd = [
            "ffmpeg", "-y",
            "-ss", f"{start_s:.3f}",
            "-i", input_path
        ]

        next_stream_idx = 1
        bg_img_idx = None
        if is_canvas_mode and (canvas_config.get("background_type") or "").lower() == "image":
            bg_img_path = canvas_config.get("background_image_path")
            if bg_img_path and os.path.exists(bg_img_path):
                bg_img_idx = next_stream_idx
                cmd.extend(["-i", bg_img_path])
                next_stream_idx += 1

        broll_idx = None
        if broll_path and os.path.exists(broll_path):
            broll_idx = next_stream_idx
            cmd.extend(["-i", broll_path])
            next_stream_idx += 1

        cmd.extend(["-t", f"{duration:.3f}"])

        # Build filter_complex
        if is_canvas_mode:
            fc = build_canvas_background_filter(canvas_config, src_w, src_h, out_w, out_h, duration, bg_img_stream_idx=bg_img_idx)
        else:
            split_fc = build_split_screen_filter(face_box, src_w, src_h, out_w, out_h) if use_split else None
            fc = split_fc if split_fc else f"[0:v]{crop_filter},{scale_filter}[main];"
            
        current_v = "[main]"
        
        audio_map = "0:a"
        if broll_idx is not None:
            # 1. Scale/crop B-Roll to exact output dimensions
            # 2. Apply a slow zoom-in using zoompan (z='1+0.05*time')
            fc += f"[{broll_idx}:v]scale={out_w}:{out_h}:force_original_aspect_ratio=increase,crop={out_w}:{out_h},zoompan=z='1+0.05*time':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':fps=30:s={out_w}x{out_h}[broll];"
            fc += f"{current_v}[broll]overlay=0:0:enable='between(t,0,3)'[v1];"
            current_v = "[v1]"
            
            # Generate synthetic "pop" SFX
            fc += f"aevalsrc='0.3*sin(1200*2*PI*t)*exp(-t*15)':d=0.15[pop1];"
            fc += f"aevalsrc='0.3*sin(1000*2*PI*t)*exp(-t*15)':d=0.15[pop2];"
            fc += f"[pop1]adelay=0|0[sfx1];"
            fc += f"[pop2]adelay=2800|2800[sfx2];"
            fc += f"[0:a][sfx1][sfx2]amix=inputs=3:duration=first:dropout_transition=0[aout];"
            audio_map = "[aout]"
            
        if subtitle_vf is not None:
            # ass_name and escaped_ass_name are already defined in the outer scope
            fc += f"{current_v}ass='{escaped_ass_name}':fontsdir='{fonts_dir_escaped}'[vout]"
        else:
            fc += f"{current_v}null[vout]"
            
        use_nvenc = is_nvenc_available() and not force_cpu
        cmd.extend([
            "-filter_complex", fc,
            "-map", "[vout]",
            "-map", audio_map,
            "-c:v", "h264_nvenc" if use_nvenc else "libx264",
            "-pix_fmt", "yuv420p",
            "-preset", "p4" if use_nvenc else "veryfast",
            "-c:a", "aac",
            "-movflags", "+faststart",
            output_path
        ])
        return cmd

    if should_cancel and should_cancel():
        raise RuntimeError("Dibatalkan oleh pengguna.")

    with stage("render") as timing:
        timing["encoder"] = "h264_nvenc" if is_nvenc_available() else "libx264"
        ok, err = _run_ffmpeg(build_cmd(use_split=gaming), cwd=subtitle_cwd, register=register_proc)

        # Gaming split-screen is best-effort: if the complex filter fails, retry with
        # the plain centred crop so the job still produces a clip.
        if not ok and gaming:
            if should_cancel and should_cancel():
                raise RuntimeError("Dibatalkan oleh pengguna.")
            log_error("crop_utils.crop_to_vertical_split_fallback", f"split-screen ffmpeg failed, falling back to standard crop. Error: {err[-800:]}")
            ok, err = _run_ffmpeg(build_cmd(use_split=False), cwd=subtitle_cwd, register=register_proc)

        # If the user just cancelled, throw error.
        if should_cancel and should_cancel():
            raise RuntimeError("Dibatalkan oleh pengguna.")
        
        if not ok:
            timing["encoder"] = "libx264"
            # If NVENC failed or complex filter encountered an error, retry with CPU libx264
            if is_nvenc_available():
                log_error("crop_utils.crop_to_vertical_nvenc_fallback", f"NVENC ffmpeg failed, falling back to CPU libx264. Error: {err[-800:]}")
                ok, err = _run_ffmpeg(build_cmd(use_split=False, force_cpu=True), cwd=subtitle_cwd, register=register_proc)
                if ok:
                    return output_path

            # Fallback to plain crop if complex filter fails (e.g., subtitle issues)
            if subtitle_vf is not None:
                if should_cancel and should_cancel():
                    raise RuntimeError("Dibatalkan oleh pengguna.")
                log_error("crop_utils.crop_to_vertical_complex_fallback", f"ffmpeg complex failed, falling back to plain crop. Error: {err[-800:]}")
                fallback_cmd = [
                    "ffmpeg", "-y",
                    "-ss", f"{start_s:.3f}",
                    "-i", input_path,
                    "-t", f"{duration:.3f}",
                    "-vf", subtitle_vf,
                    "-c:v", "libx264",
                    "-pix_fmt", "yuv420p",
                    "-preset", "veryfast",
                    "-c:a", "aac",
                    "-movflags", "+faststart",
                    output_path,
                ]
                ok2, err2 = _run_ffmpeg(fallback_cmd, cwd=subtitle_cwd, register=register_proc)
                if should_cancel and should_cancel():
                    raise RuntimeError("Dibatalkan oleh pengguna.")
                if ok2:
                    return output_path

                # Final fallback: drop subtitles entirely and just crop+scale
                log_error("crop_utils.crop_to_vertical_nosub_fallback", f"subtitle fallback also failed, trying without subtitles. Error: {err2[-800:]}")

            # Last-resort: crop + scale only, no subtitles, CPU libx264
            if should_cancel and should_cancel():
                raise RuntimeError("Dibatalkan oleh pengguna.")
            nosub_cmd = [
                "ffmpeg", "-y",
                "-ss", f"{start_s:.3f}",
                "-i", input_path,
                "-t", f"{duration:.3f}",
                "-vf", f"{crop_filter},{scale_filter}" if crop_filter else scale_filter,
                "-c:v", "libx264",
                "-pix_fmt", "yuv420p",
                "-preset", "veryfast",
                "-c:a", "aac",
                "-movflags", "+faststart",
                output_path,
            ]
            ok3, err3 = _run_ffmpeg(nosub_cmd, register=register_proc)
            if should_cancel and should_cancel():
                raise RuntimeError("Dibatalkan oleh pengguna.")
            if not ok3:
                raise RuntimeError(f"ffmpeg final fallback failed: {err3[-800:]}")

        # Validate output file integrity if file exists on disk
        if os.path.isfile(output_path) and os.path.getsize(output_path) == 0:
            try:
                os.remove(output_path)
            except OSError:
                pass
            raise RuntimeError(f"FFmpeg produced an empty output file (0 bytes): {output_path}")

        return output_path
