import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/** Scroll to `#bantuan` and friends: inside HashRouter the browser cannot do it by itself. */
/** The element id in a hash; a broken %-escape (e.g. "#%E0") is used as it is instead of throwing. */
function hashTarget(hash: string): string {
  const raw = hash.slice(1);
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export function useScrollToHash(): void {
  const { hash } = useLocation();
  useEffect(() => {
    if (!hash) return;
    const target = document.getElementById(hashTarget(hash));
    if (!target) return;
    target.scrollIntoView({ block: "start" });
    target.focus({ preventScroll: true });
  }, [hash]);
}
