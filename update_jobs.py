import re

with open("backend/jobs.py", "r", encoding="utf-8") as f:
    content = f.read()

# Replace signatures to add face_tracking_engine: str = "haar"
content = re.sub(
    r'(tracking_mode: str = "auto"(, enable_hook: bool = False)?(\))?)',
    r'\1, face_tracking_engine: str = "haar"\3',
    content
)

# Add to metadata dict where tracking_mode is saved
content = re.sub(
    r'("tracking_mode": tracking_mode,)',
    r'\1\n        "face_tracking_engine": face_tracking_engine,',
    content
)

with open("backend/jobs.py", "w", encoding="utf-8") as f:
    f.write(content)

print("backend/jobs.py updated!")
