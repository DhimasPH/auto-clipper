import datetime
import traceback
import os
import sys
from typing import Optional, Union

def get_app_data_dir() -> str:
    custom_ws = os.environ.get("AUTO_CLIPPER_WORKSPACE", "").strip()
    if custom_ws:
        custom_ws = os.path.abspath(os.path.expanduser(custom_ws))
        os.makedirs(custom_ws, exist_ok=True)
        return custom_ws

    home = os.path.expanduser("~")
    if sys.platform == "win32":
        base = os.environ.get("APPDATA", os.path.join(home, "AppData", "Roaming"))
    elif sys.platform == "darwin":
        base = os.path.join(home, "Library", "Application Support")
    else:
        base = os.environ.get("XDG_DATA_HOME", os.path.join(home, ".local", "share"))
    
    app_dir = os.path.join(base, "AutoClipper")
    os.makedirs(app_dir, exist_ok=True)
    return app_dir


def get_error_log_path() -> str:
    return os.path.join(get_app_data_dir(), "backend_error.log")

def get_app_log_path() -> str:
    return os.path.join(get_app_data_dir(), "backend_app.log")

def get_ai_log_path() -> str:
    return os.path.join(get_app_data_dir(), "backend_ai.log")

def log_error(context: str, error_msg: Optional[Union[str, Exception]] = None, exc_info: bool = True) -> None:
    try:
        timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        err_text = ""
        if isinstance(error_msg, Exception):
            err_text = str(error_msg)
        elif error_msg is not None:
            err_text = str(error_msg)
            
        stack_text = ""
        if exc_info:
            tb = traceback.format_exc()
            if tb and tb.strip() != "NoneType: None":
                stack_text = f"\n{tb.strip()}"
                
        details = f"{err_text}{stack_text}".strip()
        if not details:
            details = "Unknown error"
            
        entry = f"[{timestamp}] [{context}] ERROR:\n{details}\n"
        
        with open(get_error_log_path(), "a", encoding="utf-8") as f:
            f.write(entry)
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

def get_log_content(log_type: str, max_lines: int = 1000) -> str:
    try:
        path_map = {
            "app": get_app_log_path(),
            "error": get_error_log_path(),
            "ai": get_ai_log_path()
        }
        if log_type not in path_map:
            return ""
        
        target_path = path_map[log_type]
        if not os.path.exists(target_path):
            return ""
            
        with open(target_path, "r", encoding="utf-8", errors="replace") as f:
            lines = f.readlines()
            if max_lines and len(lines) > max_lines:
                lines = lines[-max_lines:]
            return "".join(lines)
    except Exception:
        return ""
