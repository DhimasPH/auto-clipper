import { useState } from "react";

export type ToastKind = "info" | "success" | "error";
export type Toast = { id: number; text: string; kind: ToastKind };

/** Ephemeral toast notifications (auto-dismiss). */
export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const notify = (text: string, kind: ToastKind = "info") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, text, kind }]);
    const ttl = kind === "error" ? 8000 : 4000;
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), ttl);
  };

  return { toasts, notify };
}
