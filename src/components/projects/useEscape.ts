import { useEffect, useRef } from "react";

/** Escape runs the latest `onEscape` while the caller is mounted (dialogs here mount only while open). */
export function useEscape(onEscape: () => void): void {
  const ref = useRef(onEscape);
  useEffect(() => {
    ref.current = onEscape;
  }, [onEscape]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") ref.current();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
}
