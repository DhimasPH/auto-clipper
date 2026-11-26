import { useEffect, useState } from "react";
import axios from "axios";
import { API_URL } from "../platform/backendUrl";
import { SPLASH_MAX_MS, markSplashSeen, msUntilSplashCloses, splashSeen } from "../lib/splash";

function tabStorage(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/**
 * The web splash (SP4 spec 4.3): once per tab, from the first load until the first connection
 * check answers (either way), at least 0.8 s and at most 2.5 s. `ready`: saved settings are
 * loaded, so `platform().backend()` has set API_URL and the check can go out.
 * Returns whether the splash shows now.
 */
export function useWebSplash(enabled: boolean, ready: boolean): boolean {
  const [show] = useState(() => enabled && !splashSeen(tabStorage()));
  const [startedAt] = useState(() => Date.now());
  const [checked, setChecked] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (show) markSplashSeen(tabStorage());
  }, [show]);

  useEffect(() => {
    if (!show || !ready) return;
    let alive = true;
    axios
      .get(`${API_URL}/health`, { timeout: SPLASH_MAX_MS })
      .catch(() => undefined)
      .finally(() => {
        if (alive) setChecked(true);
      });
    return () => {
      alive = false;
    };
  }, [show, ready]);

  useEffect(() => {
    if (!show || done) return;
    const timer = setTimeout(() => setDone(true), msUntilSplashCloses(Date.now() - startedAt, checked));
    return () => clearTimeout(timer);
  }, [show, done, checked, startedAt]);

  return show && !done;
}
