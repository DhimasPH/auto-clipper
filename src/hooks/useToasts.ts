import { useState, useEffect } from "react";
import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification';

export type ToastKind = "info" | "success" | "error";
export type Toast = { id: number; text: string; kind: ToastKind };

/** Ephemeral toast notifications (auto-dismiss). */
export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    (async () => {
      try {
        let permissionGranted = await isPermissionGranted();
        if (!permissionGranted) {
          await requestPermission();
        }
      } catch (e) {
        console.error("Failed to request notification permission:", e);
      }
    })();
  }, []);

  const notify = (text: string, kind: ToastKind = "info") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, text, kind }]);
    const ttl = kind === "error" ? 8000 : 4000;
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), ttl);

    (async () => {
      try {
        if (await isPermissionGranted()) {
          sendNotification({ title: "Auto Clipper", body: text });
        }
      } catch (e) {
        console.error("Failed to send OS notification:", e);
      }
    })();
  };

  return { toasts, notify };
}
