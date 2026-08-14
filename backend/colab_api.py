"""Entrypoint for running Auto Clipper backend in Google Colab or cloud environments.

Usage:
    python -m backend.colab_api [OPTIONS]

Example:
    python -m backend.colab_api --cloudflare-token <TOKEN> --api-token <SECRET>
"""

import argparse
import os
import signal
import subprocess
import sys
import time
import threading
from typing import List, Optional


DEFAULT_WORKSPACE = "/content/drive/MyDrive/AutoClipperData"
DEFAULT_HOST = "0.0.0.0"
DEFAULT_PORT = 8000


def parse_args(args: Optional[List[str]] = None) -> argparse.Namespace:
    """Parse CLI arguments with fallbacks to environment variables."""
    parser = argparse.ArgumentParser(
        description="Auto Clipper Cloud / Google Colab Backend Server"
    )

    env_cf_token = os.environ.get("CLOUDFLARE_TOKEN") or os.environ.get("CF_TUNNEL_TOKEN") or ""
    env_api_token = (
        os.environ.get("API_SECRET_TOKEN")
        or os.environ.get("AUTO_CLIPPER_DEV_TOKEN")
        or os.environ.get("AUTO_CLIPPER_WEB_TOKEN")
        or ""
    )
    env_workspace = os.environ.get("AUTO_CLIPPER_WORKSPACE") or DEFAULT_WORKSPACE
    env_host = os.environ.get("HOST") or DEFAULT_HOST
    env_port = int(os.environ.get("PORT") or DEFAULT_PORT)

    parser.add_argument(
        "--cloudflare-token",
        "--tunnel-token",
        dest="cloudflare_token",
        default=env_cf_token,
        help="Cloudflare tunnel token (default: env CLOUDFLARE_TOKEN / CF_TUNNEL_TOKEN)",
    )
    parser.add_argument(
        "--api-token",
        "--token",
        dest="api_token",
        default=env_api_token,
        help="API authentication secret token (default: env API_SECRET_TOKEN / AUTO_CLIPPER_DEV_TOKEN / AUTO_CLIPPER_WEB_TOKEN)",
    )
    parser.add_argument(
        "--workspace",
        default=env_workspace,
        help=f"Path to persistent project workspace (default: {DEFAULT_WORKSPACE} or env AUTO_CLIPPER_WORKSPACE)",
    )
    parser.add_argument(
        "--host",
        default=env_host,
        help=f"Host address to bind uvicorn server (default: {DEFAULT_HOST})",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=env_port,
        help=f"Port to bind uvicorn server (default: {DEFAULT_PORT})",
    )

    return parser.parse_args(args)


def setup_environment(workspace: str, api_token: Optional[str] = None) -> None:
    """Configure environment variables for cloud mode and prepare workspace directory."""
    os.environ["AUTO_CLIPPER_CLOUD_MODE"] = "1"
    os.environ["AUTO_CLIPPER_WORKSPACE"] = workspace

    if api_token:
        os.environ["AUTO_CLIPPER_DEV_TOKEN"] = api_token
        os.environ["AUTO_CLIPPER_WEB_TOKEN"] = api_token
        os.environ["API_SECRET_TOKEN"] = api_token

    try:
        os.makedirs(workspace, exist_ok=True)
        print(f"[Auto Clipper Colab] Workspace directory initialized at: {workspace}")
    except Exception as e:
        print(f"[Auto Clipper Colab] Warning: Could not create workspace directory '{workspace}': {e}", file=sys.stderr)


def start_uvicorn(host: str, port: int) -> subprocess.Popen:
    """Spawn the FastAPI application via uvicorn subprocess."""
    cmd = [
        sys.executable,
        "-m",
        "uvicorn",
        "backend.main:app",
        "--host",
        host,
        "--port",
        str(port),
    ]
    print(f"[Auto Clipper Colab] Starting Uvicorn API server on {host}:{port}...")
    return subprocess.Popen(cmd, env=os.environ.copy())


def start_cloudflared(token: str) -> Optional[subprocess.Popen]:
    """Spawn cloudflared tunnel subprocess if token is provided."""
    if not token or not token.strip():
        print("[Auto Clipper Colab] No Cloudflare tunnel token provided. Cloudflare Tunnel will not be started.")
        return None

    cmd = ["cloudflared", "tunnel", "run", "--token", token.strip()]
    print("[Auto Clipper Colab] Starting Cloudflare Tunnel...")
    try:
        return subprocess.Popen(cmd, env=os.environ.copy())
    except FileNotFoundError:
        print(
            "[Auto Clipper Colab] Warning: 'cloudflared' executable not found in PATH. "
            "Please ensure cloudflared is installed (e.g. 'pip install cloudflared' or apt package).",
            file=sys.stderr,
        )
        return None
    except Exception as e:
        print(f"[Auto Clipper Colab] Error starting cloudflared: {e}", file=sys.stderr)
        return None


def gpu_keep_alive() -> None:
    """Background thread to keep GPU utilization > 0% occasionally so Colab doesn't reclaim it."""
    try:
        import torch
        if not torch.cuda.is_available():
            return
        
        print("[Auto Clipper Colab] Starting GPU keep-alive thread to prevent Colab timeout...")
        while True:
            # Perform a small matrix multiplication on GPU to register utilization
            a = torch.randn(1024, 1024, device="cuda")
            b = torch.randn(1024, 1024, device="cuda")
            _ = a @ b
            del a, b, _
            # Clear cache to avoid memory leak
            torch.cuda.empty_cache()
            time.sleep(60)  # Pulse every 60 seconds
    except ImportError:
        pass
    except Exception as e:
        print(f"[Auto Clipper Colab] GPU keep-alive stopped: {e}", file=sys.stderr)


def terminate_processes(processes: List[subprocess.Popen], timeout: float = 5.0) -> None:
    """Terminate and clean up child processes gracefully."""
    print("\n[Auto Clipper Colab] Shutting down subprocesses...")
    for proc in processes:
        if proc and proc.poll() is None:
            try:
                proc.terminate()
            except Exception as e:
                print(f"[Auto Clipper Colab] Error sending SIGTERM to PID {proc.pid}: {e}", file=sys.stderr)

    start_time = time.monotonic()
    for proc in processes:
        if proc and proc.poll() is None:
            remaining = max(0.1, timeout - (time.monotonic() - start_time))
            try:
                proc.wait(timeout=remaining)
            except subprocess.TimeoutExpired:
                print(f"[Auto Clipper Colab] Process {proc.pid} did not terminate within {timeout}s, killing...")
                try:
                    proc.kill()
                except Exception:
                    pass


def run_server(args: Optional[List[str]] = None) -> int:
    """Main execution loop for Colab entrypoint."""
    parsed = parse_args(args)

    setup_environment(parsed.workspace, parsed.api_token)

    running_procs: List[subprocess.Popen] = []
    shutdown_initiated = False

    def handle_signal(signum, frame):
        nonlocal shutdown_initiated
        if not shutdown_initiated:
            shutdown_initiated = True
            print(f"\n[Auto Clipper Colab] Received signal {signum}, initiating graceful shutdown...")
            terminate_processes(running_procs)
            sys.exit(0)

    try:
        signal.signal(signal.SIGINT, handle_signal)
    except Exception:
        pass

    try:
        if hasattr(signal, "SIGTERM"):
            signal.signal(signal.SIGTERM, handle_signal)
    except Exception:
        pass

    # Start GPU keep-alive thread
    keep_alive_thread = threading.Thread(target=gpu_keep_alive, daemon=True)
    keep_alive_thread.start()

    api_proc = start_uvicorn(parsed.host, parsed.port)
    running_procs.append(api_proc)

    cf_proc = start_cloudflared(parsed.cloudflare_token)
    if cf_proc:
        running_procs.append(cf_proc)

    print("[Auto Clipper Colab] Services started successfully. Press Ctrl+C to terminate.")

    exit_code = 0
    try:
        while True:
            # Check API server status
            if api_proc.poll() is not None:
                print(f"[Auto Clipper Colab] FastAPI uvicorn process exited with code {api_proc.returncode}")
                exit_code = api_proc.returncode
                break

            # Check Cloudflare tunnel status (if running)
            if cf_proc and cf_proc.poll() is not None:
                print(f"[Auto Clipper Colab] Cloudflare tunnel process exited with code {cf_proc.returncode}")
                exit_code = cf_proc.returncode
                break

            time.sleep(1)
    except KeyboardInterrupt:
        print("\n[Auto Clipper Colab] KeyboardInterrupt received.")
    finally:
        terminate_processes(running_procs)

    return exit_code


if __name__ == "__main__":
    sys.exit(run_server())
