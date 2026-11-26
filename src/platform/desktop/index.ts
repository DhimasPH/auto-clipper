import axios from "axios";
import { invoke } from "@tauri-apps/api/core";
import { open as openDialog, save as saveDialog } from "@tauri-apps/plugin-dialog";
import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";
import { relaunch } from "@tauri-apps/plugin-process";
import { open as shellOpen } from "@tauri-apps/plugin-shell";
import { check } from "@tauri-apps/plugin-updater";
import { API_URL } from "../backendUrl";
import { pickBrowserVideo } from "../browser";
import { CAPS } from "../caps";
import { folderToOpen } from "../paths";
import type { Platform, UpdateHandle } from "../types";
import { strongholdSecrets } from "./secrets";
import { currentBackend, resetAndRespawnBackend, startSidecar } from "./sidecar";

// The only module (with its siblings) that talks to Tauri. Loaded with a dynamic
// import from ../index.ts, so local and cloud builds never run Tauri code.

async function askNotificationPermission(): Promise<void> {
  try {
    if (!(await isPermissionGranted())) await requestPermission();
  } catch (e) {
    console.error("Failed to request notification permission:", e);
  }
}

export function createPlatform(): Platform {
  // Asked at startup, as useToasts did before SP1.
  void askNotificationPermission();

  return {
    kind: "desktop",
    caps: CAPS.desktop,
    backend: startSidecar,
    // Spec 4.1 says plugin-dialog; the desktop app has always uploaded through
    // the browser file input. Kept as is (plan question 3).
    pickVideo: pickBrowserVideo,
    async saveClip(clip) {
      const dest = await saveDialog({
        defaultPath: clip.filename,
        filters: [{ name: "Video", extensions: ["mp4"] }],
      });
      if (dest) await axios.post(`${API_URL}/save_file`, { src: clip.path, dest });
    },
    async saveClips(clips) {
      if (clips.length === 0) return;
      // One folder for all clips, not one save dialog per clip (plan Spec gap 8).
      const folder = await openDialog({ directory: true, multiple: false });
      if (typeof folder !== "string") return;
      for (const clip of clips) await axios.post(`${API_URL}/save_file`, { src: clip.path, dest: folder });
    },
    async openFolder(path) {
      const dir = folderToOpen(path);
      try {
        await axios.post(`${API_URL}/open_folder`, { path: dir });
      } catch (err) {
        console.error("Open folder API failed", err);
        // fallback to old tauri open
        try {
          await shellOpen(dir);
        } catch {
          await shellOpen(path);
        }
      }
    },
    secrets: strongholdSecrets,
    notify(title, body) {
      (async () => {
        try {
          if (await isPermissionGranted()) sendNotification({ title, body });
        } catch (e) {
          console.error("Failed to send OS notification:", e);
        }
      })();
    },
    // Already asked at startup (above).
    askNotifyPermission() {},
    async reconnect() {
      const port = await resetAndRespawnBackend();
      return port ? currentBackend() : null;
    },
    async openExternal(url) {
      await shellOpen(url);
    },
    async pickFolder() {
      const folder = await openDialog({ directory: true, multiple: false });
      return typeof folder === "string" ? folder : null;
    },
    async pickImage() {
      const selected = await openDialog({
        multiple: false,
        filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp"] }],
      });
      return typeof selected === "string" ? selected : null;
    },
    async setPreventSleep(on) {
      await invoke(on ? "prevent_sleep" : "allow_sleep");
    },
    updater: {
      async check() {
        const update = await check();
        if (!update) return null;
        const handle: UpdateHandle = {
          version: update.version,
          body: update.body,
          downloadAndInstall: (onEvent) => update.downloadAndInstall((event) => onEvent(event as Parameters<typeof onEvent>[0])),
        };
        return handle;
      },
      relaunch,
    },
  };
}
