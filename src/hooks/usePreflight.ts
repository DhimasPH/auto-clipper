import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { API_URL } from "../platform/backendUrl";
import { splitPreflight, type PreflightSplit } from "../lib/preflight";

export type PreflightState = "loading" | "ready" | "unavailable";

/** Runs the environment check when the create screen opens, when the connection comes back, and on request. */
export function usePreflight(connected: boolean) {
  const [state, setState] = useState<PreflightState>("loading");
  const [split, setSplit] = useState<PreflightSplit>({ notes: [], blockers: [] });
  const [round, setRound] = useState(0);
  const recheck = useCallback(() => setRound((n) => n + 1), []);

  useEffect(() => {
    if (!connected) return;
    let active = true;
    setState("loading");
    axios
      .get(`${API_URL}/api/preflight`, { timeout: 30000 })
      .then((res) => {
        if (!active) return;
        setSplit(splitPreflight(res.data?.checks));
        setState("ready");
      })
      .catch((err) => {
        if (!active) return;
        // The check could not run (backend gone): the connection banner explains it; nothing is blocked here.
        console.error("Preflight check failed:", err);
        setSplit({ notes: [], blockers: [] });
        setState("unavailable");
      });
    return () => {
      active = false;
    };
  }, [connected, round]);

  return { state, ...split, recheck };
}
