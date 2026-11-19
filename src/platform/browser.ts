import axios from "axios";
import type { ClipRef, VideoSource } from "./types";

// Browser implementations shared by the local and cloud adapters (and the desktop video picker).

export function pickBrowserFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.addEventListener("change", () => resolve(input.files?.[0] ?? null), { once: true });
    input.addEventListener("cancel", () => resolve(null), { once: true });
    input.click();
  });
}

export async function pickBrowserVideo(): Promise<VideoSource | null> {
  const file = await pickBrowserFile("video/mp4,video/x-m4v,video/*");
  return file ? { kind: "file", file } : null;
}

/** Let the browser download a clip from its signed link. */
export async function browserDownload(clip: ClipRef): Promise<void> {
  if (!clip.videoUrl) throw new Error("This clip has no download link.");
  const a = document.createElement("a");
  a.href = clip.videoUrl;
  a.download = clip.filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

let permissionAsked = false;

/**
 * Ask for notification permission once, while the user has not decided yet. Call it from a
 * user gesture (the first job start), never on page load: browsers block or penalise that.
 */
export function askBrowserNotifyPermission(): void {
  if (permissionAsked) return;
  try {
    if (!("Notification" in window) || Notification.permission !== "default") return;
    permissionAsked = true;
    Notification.requestPermission().catch((e) => console.error("Notification permission request failed:", e));
  } catch (e) {
    console.error("Notification permission request failed:", e);
  }
}

/** A browser notification when the user allowed them; the toast is shown by useToasts either way. */
export function browserNotify(title: string, body: string): void {
  try {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, { body });
    }
  } catch (e) {
    console.error("Browser notification failed:", e);
  }
}

export async function openInBrowser(url: string): Promise<void> {
  window.open(url, "_blank", "noopener");
}

export async function checkBackend(url: string): Promise<boolean> {
  try {
    await axios.get(`${url}/health`, { timeout: 15000 });
    return true;
  } catch {
    return false;
  }
}
