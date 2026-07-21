import datetime
import traceback
import os
from backend.db import get_app_data_dir

def get_error_log_path():
    return os.path.join(get_app_data_dir(), "backend_error.log")

def get_app_log_path():
    return os.path.join(get_app_data_dir(), "backend_app.log")

def get_ai_log_path():
    return os.path.join(get_app_data_dir(), "backend_ai.log")

def log_error(context: str, error_msg: str = None) -> None:
    try:
        timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        with open(get_error_log_path(), "a", encoding="utf-8") as f:
            if error_msg:
                f.write(f"[{timestamp}] {context} ERROR:\n{error_msg}\n")
            else:
                f.write(f"[{timestamp}] {context} ERROR:\n{traceback.format_exc()}\n")
    except Exception:
        pass

def log_app(message: str) -> None:
    try:
        timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        with open(get_app_log_path(), "a", encoding="utf-8") as f:
            f.write(f"[{timestamp}] {message}\n")
    except Exception:
        pass

def log_ai(provider: str, model: str, prompt: str, response: str) -> None:
    try:
        timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        with open(get_ai_log_path(), "a", encoding="utf-8") as f:
            f.write(f"[{timestamp}] === AI REQUEST [{provider} / {model}] ===\n")
            f.write(f"PROMPT:\n{prompt}\n\nRESPONSE:\n{response}\n\n")
    except Exception:
        pass
