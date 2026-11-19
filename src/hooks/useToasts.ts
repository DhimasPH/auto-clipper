import { useState } from "react";
import { platform } from "../platform";

export type ToastKind = "info" | "success" | "error";
export type Toast = { id: number; text: string; kind: ToastKind };

/** Ephemeral toast notifications (auto-dismiss), plus an OS/browser notification where allowed. */
export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const notify = (text: string, kind: ToastKind = "info") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, text, kind }]);
    const ttl = kind === "error" ? 8000 : 4000;
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), ttl);
    platform().notify("Auto Clipper", text);
  };

  return { toasts, notify };
}
