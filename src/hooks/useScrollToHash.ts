import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/** Scroll to `#bantuan` and friends: inside HashRouter the browser cannot do it by itself. */
export function useScrollToHash(): void {
  const { hash } = useLocation();
  useEffect(() => {
    if (!hash) return;
    const target = document.getElementById(decodeURIComponent(hash.slice(1)));
    if (!target) return;
    target.scrollIntoView({ block: "start" });
    target.focus({ preventScroll: true });
  }, [hash]);
}
