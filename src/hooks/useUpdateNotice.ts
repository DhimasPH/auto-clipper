import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { appVersion } from "../lib/appInfo";
import { asUpdateCheck, updateNoticeView, type UpdateCheck, type UpdateNoticeView, type UpdatePhase } from "../lib/updateNotice";
import { API_URL } from "../platform/backendUrl";

export interface UpdateNotice {
  view: UpdateNoticeView;
  latest: string | null;
  link: string | null;
  /** "Coba lagi" / "Periksa pembaruan": asks GitHub again, past the server's 24 h cache. */
  recheck: () => Promise<void>;
}

/** Checks once when the app opens (the server caches the answer for 24 h). No pop-up: Bantuan shows the result. */
export function useUpdateNotice(enabled: boolean): UpdateNotice {
  const [phase, setPhase] = useState<UpdatePhase>("idle");
  const [result, setResult] = useState<UpdateCheck | null>(null);
  const started = useRef(false);

  const run = useCallback(async (force: boolean) => {
    setPhase("checking");
    try {
      const res = await axios.get(`${API_URL}/api/update-check`, {
        params: { current: appVersion(), force: force ? 1 : 0 },
        timeout: 15000,
      });
      setResult(asUpdateCheck(res.data));
    } catch (err) {
      console.warn("Update check unavailable:", err);
      setResult(null);
    } finally {
      setPhase("done");
    }
  }, []);

  useEffect(() => {
    if (!enabled || started.current) return;
    started.current = true;
    void run(false);
  }, [enabled, run]);

  return {
    view: updateNoticeView(phase, result),
    latest: result?.latest ?? null,
    link: result?.link ?? null,
    recheck: () => run(true),
  };
}
