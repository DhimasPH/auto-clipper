import { useEffect, useRef } from "react";

/**
 * When `busy` ends and the focused button went away with it (a request that succeeded and changed
 * the card), move the keyboard focus to `target()` instead of leaving it on the page body.
 * Focus the user moved elsewhere in the meantime is left alone.
 */
export function useKeepFocus(busy: unknown, target: () => HTMLElement | null | undefined): void {
  const wasBusy = useRef(busy);
  // Runs after every render: compares with the last one, so it notices the moment busy ends.
  useEffect(() => {
    const finished = !!wasBusy.current && !busy;
    wasBusy.current = busy;
    if (!finished) return;
    const active = document.activeElement;
    if (active && active !== document.body && active.isConnected) return;
    target()?.focus();
  });
}
