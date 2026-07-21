import re

with open(r'c:\Users\dhima\projects\auto-clipper\backend\jobs.py', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('from backend.db import save_history, get_app_data_dir', 'from backend.db import save_history, get_app_data_dir\nfrom backend.logger import log_app, log_error')

old_logger = '''def get_error_log_path():
    return os.path.join(get_app_data_dir(), "backend_error.log")

def log_error(context: str) -> None:
    import datetime
    try:
        timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        with open(get_error_log_path(), "a") as f:
            f.write(f"[{timestamp}] {context} ERROR:\\n{traceback.format_exc()}\\n")
    except Exception:
        pass'''
content = content.replace(old_logger, '')

def repl_progress(match):
    indent = match.group(1)
    full_match = match.group(0)
    val = match.group(2)
    if val.endswith(','):
        return full_match
    return f'{full_match}\n{indent}log_app(f"[{{job_id}}] " + str({val}))'

content = re.sub(r'^([ \t]+)job\["progress"\]\s*=\s*(.+)$', repl_progress, content, flags=re.MULTILINE)
content = re.sub(r'^([ \t]+)job\["status"\]\s*=\s*(.+)$', repl_progress, content, flags=re.MULTILINE)

content = content.replace('print(f"Clip {i+1} failed: {e}")', 'log_error(f"Clip {i+1} failed", str(e))')
content = content.replace('print(f"Manual clip {i+1} failed: {e}")', 'log_error(f"Manual clip {i+1} failed", str(e))')

with open(r'c:\Users\dhima\projects\auto-clipper\backend\jobs.py', 'w', encoding='utf-8') as f:
    f.write(content)
