import { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import { API_URL } from "../App";
import { resetAndRespawnBackend } from "./useUserSettings";

export type BackendStatusKey =
  | "connecting"
  | "connected"
  | "disconnected"
  | "reconnecting";

/**
 * Polls the backend /health endpoint and exposes a structured status plus a
 * manual reconnect action.
 *
 * On device wake (window focus / tab visibility change) it self-heals: if the
 * backend is unreachable it transparently respawns it, so the app no longer
 * gets stuck on "Disconnected" after the machine sleeps. The sidebar also
 * surfaces a manual [Reconnect] button wired to `reconnect()`.
 */
export function useBackendHealth() {
  const [status, setStatus] = useState<BackendStatusKey>("connecting");
  // Guards the 3s poller from stomping the "reconnecting" label mid-recovery.
  const reconnectingRef = useRef(false);

  useEffect(() => {
    let active = true;

    const ping = async (overrideUrl?: string): Promise<boolean> => {
      const url = overrideUrl || API_URL;
      try {
        await axios.get(`${url}/health`, { timeout: 2500 });
        return true;
      } catch {
        return false;
      }
    };

    const check = async (overrideUrl?: string): Promise<boolean> => {
      const okay = await ping(overrideUrl);
      if (!active) return okay;
      if (reconnectingRef.current) {
        // Only allow a success to clear the reconnecting label; a failure
        // during recovery keeps showing "reconnecting".
        if (okay) setStatus("connected");
      } else {
        setStatus(okay ? "connected" : "disconnected");
      }
      return okay;
    };

    // Attempt recovery: mark reconnecting, respawn, re-check.
    const heal = async () => {
      if (reconnectingRef.current) return;
      reconnectingRef.current = true;
      if (active) setStatus("reconnecting");
      try {
        await resetAndRespawnBackend();
      } catch {
        // Swallow — the check below reflects the real state.
      }
      reconnectingRef.current = false;
      await check();
    };

    // On wake the poll may briefly fail; do a direct check first and only
    // respawn if the backend is genuinely gone.
    const handleWake = async () => {
      const okay = await check();
      if (!okay) await heal();
    };

    check();

    const handlePortFound = (e: any) => {
      const port = e?.detail;
      check(port ? `http://127.0.0.1:${port}` : undefined);
    };
    const handleReconnected = () => {
      check();
    };
    const handleVisibility = () => {
      if (!document.hidden) handleWake();
    };

    window.addEventListener("backend-port-found", handlePortFound as EventListener);
    window.addEventListener("backend-reconnected", handleReconnected as EventListener);
    window.addEventListener("focus", handleWake);
    document.addEventListener("visibilitychange", handleVisibility);
    const id = setInterval(() => check(), 3000);

    return () => {
      active = false;
      window.removeEventListener("backend-port-found", handlePortFound as EventListener);
      window.removeEventListener("backend-reconnected", handleReconnected as EventListener);
      window.removeEventListener("focus", handleWake);
      document.removeEventListener("visibilitychange", handleVisibility);
      clearInterval(id);
    };
  }, []);

  const reconnect = useCallback(async () => {
    if (reconnectingRef.current) return;
    reconnectingRef.current = true;
    setStatus("reconnecting");
    try {
      await resetAndRespawnBackend();
    } catch {
      // ignore — the final check below reflects reality
    } finally {
      let okay = false;
      try {
        await axios.get(`${API_URL}/health`, { timeout: 2500 });
        okay = true;
      } catch {
        okay = false;
      }
      reconnectingRef.current = false;
      setStatus(okay ? "connected" : "disconnected");
    }
  }, []);

  return { status, reconnect };
}
