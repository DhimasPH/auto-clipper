"""CI smoke test of an assembled local web package (SP1, spec 4.6 and 6).

    python scripts/smoke_web_package.py "<package folder>"

Starts "Auto Clipper Web" the way a user does (the .exe, .command or .sh) with the
app data in a temporary folder and no browser (AUTO_CLIPPER_NO_BROWSER), then checks:
the console prints the text and the address with the token; "/" and its script load
without a token; /history needs the token; FFmpeg is found (preflight); a second
launch hands over to the first; the server stops with its window. Exit code 0 when
everything holds.
"""
import json
import os
import re
import signal
import subprocess
import sys
import tempfile
import threading
import time
import urllib.error
import urllib.request
from typing import Optional

ADDRESS = re.compile(r"http://127\.0\.0\.1:(\d+)/#t=([A-Za-z0-9_\-]+)")
ASSET = re.compile(r'src="\.?/?(assets/[^"]+\.js)"')
START_TIMEOUT = 300  # a onefile backend unpacks itself first, and CI disks are slow


def parse_address(line: str) -> Optional[tuple]:
    match = ADDRESS.search(line)
    return (int(match.group(1)), match.group(2)) if match else None


def first_asset(html: str) -> Optional[str]:
    match = ASSET.search(html)
    return match.group(1) if match else None


def launcher_command(package: str) -> list:
    if sys.platform == "win32":
        return [os.path.join(package, "Auto Clipper Web.exe")]
    if sys.platform == "darwin":
        return ["/bin/bash", os.path.join(package, "Auto Clipper Web.command")]
    return ["/bin/bash", os.path.join(package, "Auto Clipper Web.sh")]


def _request(url: str, token: Optional[str] = None, method: str = "GET"):
    """(status, content type, body); status None when nothing answers."""
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    req = urllib.request.Request(url, headers=headers, method=method, data=b"" if method == "POST" else None)
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            return response.status, response.headers.get("Content-Type", ""), response.read()
    except urllib.error.HTTPError as e:
        return e.code, e.headers.get("Content-Type", ""), e.read()
    except OSError:
        return None, "", b""


class Launch:
    """One double-click on the launcher; its console output is collected in a thread."""

    def __init__(self, package: str, env: dict):
        extra = {"creationflags": subprocess.CREATE_NEW_PROCESS_GROUP} if sys.platform == "win32" else {"start_new_session": True}
        self.proc = subprocess.Popen(
            launcher_command(package), stdout=subprocess.PIPE, stderr=subprocess.STDOUT, stdin=subprocess.DEVNULL,
            env=env, text=True, encoding="utf-8", errors="replace", **extra,
        )
        self.lines = []
        self.reader = threading.Thread(target=self._read, daemon=True)
        self.reader.start()

    def _read(self):
        for line in self.proc.stdout:
            sys.stdout.write(f"  | {line}")
            self.lines.append(line)

    def output(self) -> str:
        return "".join(self.lines)

    def wait_for_address(self, timeout: float) -> Optional[tuple]:
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            found = parse_address(self.output())
            if found:
                return found
            if self.proc.poll() is not None:
                self.reader.join(timeout=5)
                return parse_address(self.output())
            time.sleep(0.5)
        return None

    def stop(self):
        if self.proc.poll() is None:
            if sys.platform == "win32":
                subprocess.run(["taskkill", "/F", "/T", "/PID", str(self.proc.pid)], capture_output=True, check=False)
            else:
                os.killpg(self.proc.pid, signal.SIGTERM)
            try:
                self.proc.wait(timeout=30)
            except subprocess.TimeoutExpired:
                self.proc.kill()
        self.reader.join(timeout=5)


def main(argv=None) -> int:
    args = sys.argv[1:] if argv is None else argv
    package = os.path.abspath(args[0])
    results = []

    def check(ok: bool, what: str) -> None:
        results.append((bool(ok), what))
        print(f"{'OK  ' if ok else 'FAIL'} {what}")

    with tempfile.TemporaryDirectory(prefix="ac-web-smoke-", ignore_cleanup_errors=True) as data:
        env = dict(os.environ, AUTO_CLIPPER_WORKSPACE=data, AUTO_CLIPPER_NO_BROWSER="1", PYTHONIOENCODING="utf-8")
        first = Launch(package, env)
        base = None
        try:
            address = first.wait_for_address(START_TIMEOUT)
            check(address is not None, "the launcher prints http://127.0.0.1:<port>/#t=<token>")
            if address:
                port, token = address
                base = f"http://127.0.0.1:{port}"
                check("Auto Clipper berjalan" in first.output() and "Auto Clipper is running" in first.output(),
                      "the console text is in Indonesian and English")
                status, _, body = _request(f"{base}/")
                check(status == 200 and b'id="root"' in body, "GET / serves index.html without a token")
                asset = first_asset(body.decode("utf-8", "replace"))
                check(asset is not None, "index.html links its script")
                if asset:
                    status, content_type, _ = _request(f"{base}/{asset}")
                    check(status == 200 and content_type.startswith("text/javascript"), f"GET /{asset} is JavaScript")
                check(_request(f"{base}/history")[0] == 401, "GET /history without the token is refused")
                status, _, body = _request(f"{base}/history", token)
                check(status == 200 and json.loads(body or b"{}").get("status") == "success", "GET /history with the token works")
                status, _, body = _request(f"{base}/api/preflight", token)
                levels = {c.get("id"): c.get("level") for c in json.loads(body or b"{}").get("checks", [])} if status == 200 else {}
                check(levels.get("ffmpeg") == "ok", f"FFmpeg is found (preflight ffmpeg: {levels.get('ffmpeg')})")

                second = Launch(package, env)
                try:
                    code = second.proc.wait(timeout=START_TIMEOUT)
                except subprocess.TimeoutExpired:
                    code = None
                second.stop()
                check(code == 0 and "sudah berjalan" in second.output() and f":{port}/#t={token}" in second.output(),
                      "a second launch opens the running server instead of a new one")
        finally:
            first.stop()
        if base:
            check(_request(f"{base}/health")[0] is None, "the server stops with its window")

    failed = [what for ok, what in results if not ok]
    print(f"\n{len(results) - len(failed)} of {len(results)} checks passed.")
    return 1 if failed or not results else 0


if __name__ == "__main__":
    sys.exit(main())
