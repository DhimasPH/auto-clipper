import axios from "axios";
import { Command } from "@tauri-apps/plugin-shell";
import { setApiUrl } from "../backendUrl";
import { setAuthToken, wireAuthOnce } from "../auth";
import type { BackendInfo } from "../types";

// Spawn, handshake, heartbeat and respawn of the backend sidecar (moved from useUserSettings.ts).

let backendPortPromise: Promise<number | null> | null = null;
// Tracked at module scope so the sidebar Reconnect button and the sleep/wake
// auto-heal can respawn the backend and re-wire auth without a full app reload.
let currentPort: number | null = null;
let currentToken: string | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let lateListenerAdded = false;

const sidecarUrl = (port: number) => `http://127.0.0.1:${port}`;

// Not named use…: oxlint's rules-of-hooks would treat it as a React hook.
function applyToken(token: string) {
  currentToken = token;
  setAuthToken(token);
  wireAuthOnce();
}

/** (Re)start the heartbeat loop against a given port, clearing any prior one. */
function startHeartbeat(port: number) {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  heartbeatTimer = setInterval(() => {
    fetch(`${sidecarUrl(port)}/heartbeat`, { method: "POST" }).catch(() => {});
  }, 5000);
}

export function currentBackend(): BackendInfo | null {
  return currentPort ? { url: sidecarUrl(currentPort), token: currentToken || "" } : null;
}

async function spawnBackend(): Promise<number | null> {
  if (backendPortPromise) return backendPortPromise;
  backendPortPromise = new Promise((resolve) => {
    let resolved = false;
    const finish = (port: number | null) => {
      if (!resolved) {
        resolved = true;
        resolve(port);
      }
    };

    // The backend is a large one-file PyInstaller bundle; on a cold start
    // (first launch, CI runners, slower disks, macOS Gatekeeper scanning) it can
    // take over 60s to self-extract and import heavy deps (faster_whisper, cv2,
    // onnxruntime, etc.). The "backend-port-found" listener still connects
    // late if the process eventually starts, so this is only the pessimistic
    // fallback.
    setTimeout(() => {
      if (!resolved) {
        console.error("Backend spawn timed out after 90 seconds.");
        finish(null);
      }
    }, 90000);

    // Bypass sidecar if VITE_DEV_BACKEND is true
    if (import.meta.env.VITE_DEV_BACKEND === "true") {
      console.log("Bypassing sidecar, using dev backend at 127.0.0.1:8000");
      const port = 8000;
      applyToken("dev-token");
      setApiUrl(sidecarUrl(port));
      currentPort = port;
      finish(port);
      return;
    }

    try {
      const cmd = Command.sidecar("bin/backend");
      let outBuffer = "";
      cmd.stdout.on("data", (data) => {
        console.log("Backend stdout chunk:", data);
        outBuffer += data;
        const lines = outBuffer.split(/\r?\n/);
        outBuffer = lines.pop() || "";
        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (line.startsWith("TOKEN:")) {
            applyToken(line.replace("TOKEN:", "").trim());
          }
          if (line.startsWith("PORT:")) {
            const p = parseInt(line.replace("PORT:", "").trim(), 10);
            if (!isNaN(p)) {
              currentPort = p;
              finish(p);
              window.dispatchEvent(new CustomEvent("backend-port-found", { detail: p }));
            }
          }
        }
      });
      cmd.stderr.on("data", (line) => console.error("Backend stderr:", line));
      cmd.on("close", (data) => {
        console.log("Backend closed:", data.code);
        finish(null);
      });
      cmd.on("error", (e) => {
        console.error("Backend error:", e);
        finish(null);
      });
      cmd.spawn().then((child) => {
        console.log("Backend spawned with pid:", child.pid);
      }).catch((e) => {
        console.error("Failed to spawn backend:", e);
        finish(null);
      });
    } catch (e) {
      console.error(e);
      finish(null);
    }
  });
  return backendPortPromise;
}

/** Start the sidecar (once) and point the app at it. Rejects when it does not start within 90 s. */
export async function startSidecar(): Promise<BackendInfo> {
  if (!lateListenerAdded) {
    lateListenerAdded = true;
    window.addEventListener("backend-port-found", ((e: CustomEvent) => {
      console.log("Late backend connection established!");
      const port = e.detail as number;
      currentPort = port;
      setApiUrl(sidecarUrl(port));
      startHeartbeat(port);
    }) as EventListener);
  }
  const port = await spawnBackend();
  if (!port) throw new Error("The backend sidecar did not start.");
  setApiUrl(sidecarUrl(port));
  startHeartbeat(port);
  return { url: sidecarUrl(port), token: currentToken || "" };
}

/**
 * Recover the backend connection without restarting the whole app.
 *
 * Used by the sidebar's Reconnect button and by the sleep/wake auto-heal. If a
 * backend is already alive we simply re-point at it and make sure the heartbeat
 * is running (no duplicate process). Otherwise we clear the memoised spawn
 * promise and launch a fresh sidecar.
 */
export async function resetAndRespawnBackend(): Promise<number | null> {
  if (currentPort) {
    try {
      await axios.get(`${sidecarUrl(currentPort)}/health`, { timeout: 15000 });
      setApiUrl(sidecarUrl(currentPort));
      startHeartbeat(currentPort);
      window.dispatchEvent(new CustomEvent("backend-reconnected", { detail: currentPort }));
      return currentPort;
    } catch {
      // Current backend is genuinely gone — fall through to respawn.
    }
  }

  backendPortPromise = null;
  const port = await spawnBackend();
  if (port) {
    setApiUrl(sidecarUrl(port));
    startHeartbeat(port);
    window.dispatchEvent(new CustomEvent("backend-reconnected", { detail: port }));
  }
  return port;
}
