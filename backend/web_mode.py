"""Local web mode launcher: ``backend --web [--ui-dir PATH]`` (SP1, spec 4.4, ADR-013).

Started by "Auto Clipper Web" (scripts/web_launcher.py on Windows, the .command
and .sh scripts on macOS and Linux). One instance per computer:

- web_instance.json in the app data folder holds {port, pid, token} of the
  running server (file mode 0600, refused by path_guard).
- If that server still answers with that token, the launcher only opens a
  browser tab on it and exits.
- Otherwise it takes a port on 127.0.0.1, makes a new token, switches on
  web mode (backend.web_ui), opens http://127.0.0.1:<port>/#t=<token> once the
  server is up, and prints the console message. Closing the window stops the
  server; a file left behind by a killed window is detected as stale.
- The port of the last launch is kept in web_port.json (0600, refused by
  path_guard) and reused while it is free, else a random free port is taken
  (owner decision 2026-11-20). The browser keeps settings and API keys per
  address, port included, so a new port every launch would empty them. The
  token stays new per launch.

The console text goes to the stream ``launch`` is given. Besides main's
__main__ block this is the only backend module that writes to the console
(AGENTS.md A.2); the desktop sidecar handshake is not involved.
"""
import json
import os
import secrets
import socket
import sys
import threading
import time
import urllib.error
import urllib.request
import webbrowser
from typing import Callable, Optional, TextIO

from backend.logger import get_app_data_dir, log_error
from backend.path_guard import write_private_file
from backend.web_ui import UI_DIR_ENV, WEB_MODE_ENV

INSTANCE_FILE_NAME = "web_instance.json"
PORT_FILE_NAME = "web_port.json"
TOKEN_ENV = "AUTO_CLIPPER_WEB_TOKEN"
# Set by the CI smoke test (scripts/smoke_web_package.py): no browser on the build machine.
NO_BROWSER_ENV = "AUTO_CLIPPER_NO_BROWSER"
HOST = "127.0.0.1"

RUNNING_TEXT = (
    "Auto Clipper berjalan. Jangan tutup jendela ini selama memakai aplikasi.\n"
    "Auto Clipper is running. Do not close this window while you use the app.\n"
)
ALREADY_RUNNING_TEXT = (
    "Auto Clipper sudah berjalan di jendela lain. Tab baru dibuka di browser.\n"
    "Auto Clipper is already running in another window. A new tab was opened in your browser.\n"
)
ADDRESS_TEXT = (
    "\nBila browser tidak terbuka sendiri, salin alamat ini ke browser:\n"
    "If your browser did not open, copy this address into it:\n"
    "{url}\n"
)
MISSING_UI_TEXT = (
    "Tampilan aplikasi tidak ditemukan di {folder}. Unduh ulang paket Auto Clipper Web, lalu ekstrak semua isinya.\n"
    "The app's interface was not found in {folder}. Download the Auto Clipper Web package again and extract everything.\n"
)


# --- instance file ------------------------------------------------------------------------------

def valid_port(value) -> bool:
    """A TCP port number. bool is an int subclass in Python, so it is refused explicitly."""
    return type(value) is int and 0 < value < 65536


def instance_path(data_dir: Optional[str] = None) -> str:
    return os.path.join(data_dir or get_app_data_dir(), INSTANCE_FILE_NAME)


def read_instance(path: str) -> Optional[dict]:
    """{port, pid, token} of the last launch, or None when the file is missing or unusable."""
    try:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
    except (OSError, ValueError):
        return None
    if not isinstance(data, dict):
        return None
    port, pid, token = data.get("port"), data.get("pid"), data.get("token")
    if not valid_port(port) or type(pid) is not int or not isinstance(token, str) or not token:
        return None
    return {"port": port, "pid": pid, "token": token}


def write_instance(path: str, port: int, pid: int, token: str) -> None:
    write_private_file(path, json.dumps({"port": port, "pid": pid, "token": token}).encode("utf-8"))


def remove_instance(path: str, pid: int) -> None:
    """Remove the file while it still names this process (a newer launch may have replaced it)."""
    info = read_instance(path)
    if info and info["pid"] == pid:
        try:
            os.remove(path)
        except OSError as e:
            log_error("web_mode.remove_instance", e)


# --- port kept across launches -----------------------------------------------------------------

def port_path(data_dir: Optional[str] = None) -> str:
    return os.path.join(data_dir or get_app_data_dir(), PORT_FILE_NAME)


def read_last_port(path: str) -> Optional[int]:
    """The port of the last launch, or None when the file is missing or unusable."""
    try:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
    except (OSError, ValueError):
        return None
    port = data.get("port") if isinstance(data, dict) else None
    return port if valid_port(port) else None


def write_last_port(path: str, port: int) -> None:
    write_private_file(path, json.dumps({"port": port}).encode("utf-8"))


def _accepts_connections(port: int) -> bool:
    """True when something already answers on 127.0.0.1:<port>. Short timeout: the launch waits on it."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as c:
        c.settimeout(0.2)
        try:
            return c.connect_ex((HOST, port)) == 0
        except OSError:
            return False  # cannot tell: the bind test below decides


def port_is_free(port: int) -> bool:
    """True when the server can listen on 127.0.0.1:<port> now and no other program listens there.

    The connect test comes first because on Windows and macOS binding 127.0.0.1 succeeds while
    another program listens on 0.0.0.0 at that port; Auto Clipper would then take its loopback traffic.
    """
    if not valid_port(port):
        return False
    if _accepts_connections(port):
        return False
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        if os.name == "posix":
            # Like asyncio (and so uvicorn) on POSIX: a port still in TIME_WAIT after the last
            # launch can be used again. On Windows this option would allow sharing a port, so not there.
            s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            s.bind((HOST, port))
        except OSError:
            return False
    return True


def choose_port(path: str) -> int:
    """The last launch's port while it is free, so the browser keeps this app's settings; else a free one."""
    last = read_last_port(path)
    if last is not None and port_is_free(last):
        return last
    return free_port()


# --- server -------------------------------------------------------------------------------------

def app_url(port: int, token: str) -> str:
    return f"http://{HOST}:{port}/#t={token}"


def _status(request: urllib.request.Request, timeout: float) -> Optional[int]:
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return response.status
    except urllib.error.HTTPError as e:
        return e.code
    except Exception:
        # Not reachable, or an address urllib refuses (InvalidURL, OverflowError on a damaged
        # instance file): no server there. A failing check must never stop the launch.
        return None


def instance_alive(info: dict, timeout: float = 2.0) -> bool:
    """True when an Auto Clipper web server with this token answers on that port.

    "/" answers only in web mode (a desktop sidecar on a reused port does not
    serve the UI), and /heartbeat answers 200 in web mode only with the token.
    """
    base = f"http://{HOST}:{info['port']}"
    if _status(urllib.request.Request(f"{base}/"), timeout) != 200:
        return False
    beat = urllib.request.Request(
        f"{base}/heartbeat", data=b"", method="POST", headers={"Authorization": f"Bearer {info['token']}"},
    )
    return _status(beat, timeout) == 200


def free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind((HOST, 0))
        return s.getsockname()[1]


def make_server(app, port: int):
    """A uvicorn server bound to 127.0.0.1 only: other devices on the network cannot reach it."""
    import uvicorn
    return uvicorn.Server(uvicorn.Config(app, host=HOST, port=port, reload=False, log_level="warning"))


def run_server(app, port: int, on_ready: Callable[[], None]) -> None:
    """Serve until the window is closed (or Ctrl+C); call ``on_ready`` once the port accepts connections."""
    server = make_server(app, port)

    def announce_when_up():
        deadline = time.monotonic() + 120
        while not server.started and not server.should_exit and time.monotonic() < deadline:
            time.sleep(0.1)
        if server.started:
            on_ready()

    threading.Thread(target=announce_when_up, daemon=True).start()
    server.run()


def open_in_browser(url: str) -> bool:
    if os.environ.get(NO_BROWSER_ENV):
        return False
    try:
        return bool(webbrowser.open(url))
    except Exception as e:
        log_error("web_mode.open_in_browser", e)
        return False


# --- arguments ----------------------------------------------------------------------------------

def default_ui_dir() -> str:
    """app/ui next to the backend in the package, else the Vite build (dist/) of a source checkout."""
    if getattr(sys, "frozen", False):
        exe_dir = os.path.dirname(os.path.abspath(sys.executable))
        # Windows/Linux onefile: app/backend(.exe) -> app/ui; macOS onedir: app/backend/backend -> app/ui.
        for candidate in (os.path.join(exe_dir, "ui"), os.path.join(os.path.dirname(exe_dir), "ui")):
            if os.path.isdir(candidate):
                return candidate
        return os.path.join(exe_dir, "ui")
    return os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "dist")


def ui_dir_from_args(argv: list) -> str:
    if "--ui-dir" in argv:
        i = argv.index("--ui-dir")
        if i + 1 < len(argv):
            return os.path.abspath(argv[i + 1])
    return default_ui_dir()


# --- launch -------------------------------------------------------------------------------------

def _say(stream: Optional[TextIO], text: str) -> None:
    try:
        stream.write(text)
        stream.flush()
    except (OSError, ValueError, AttributeError):
        pass  # no console (closed or never attached): the browser tab is enough


def launch(app, argv: list, stream: Optional[TextIO], *,
           serve: Callable = run_server,
           open_browser: Callable[[str], bool] = open_in_browser,
           is_alive: Callable[[dict], bool] = instance_alive,
           data_dir: Optional[str] = None) -> int:
    """Run the local web app, or hand over to the instance that already runs. Returns the exit code."""
    ui = ui_dir_from_args(argv)
    if not os.path.isfile(os.path.join(ui, "index.html")):
        log_error("web_mode.launch", f"index.html not found in {ui}", exc_info=False)
        _say(stream, MISSING_UI_TEXT.format(folder=ui))
        return 1

    path = instance_path(data_dir)
    running = read_instance(path)
    if running and is_alive(running):
        url = app_url(running["port"], running["token"])
        open_browser(url)
        _say(stream, ALREADY_RUNNING_TEXT + ADDRESS_TEXT.format(url=url))
        return 0

    port_file = port_path(data_dir)
    port = choose_port(port_file)
    try:
        write_last_port(port_file, port)
    except OSError as e:
        log_error("web_mode.launch", e)  # only the next launch's port depends on it
    token = secrets.token_urlsafe(32)
    os.environ[WEB_MODE_ENV] = "1"
    os.environ[UI_DIR_ENV] = ui
    os.environ[TOKEN_ENV] = token
    write_instance(path, port, os.getpid(), token)
    url = app_url(port, token)

    def on_ready():
        open_browser(url)
        _say(stream, RUNNING_TEXT + ADDRESS_TEXT.format(url=url))

    try:
        serve(app, port, on_ready)
    finally:
        remove_instance(path, os.getpid())
    return 0
