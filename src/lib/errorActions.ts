import type { Caps } from "../platform/types";
import type { ActionHandlers } from "./errorInfo";

// What the action buttons of an error card do on each platform
// (ids from backend/errors.py `_ACTIONS`). No React here.

export interface ErrorActionDeps {
  /** Resume the failed job, when there is one. */
  resume?: () => void;
  /** Run the failed step again (the job, or e.g. the quality check). */
  rerun?: () => void;
  openCookies: (onRetry?: () => void) => void;
  /** Pick a video file on this computer. */
  uploadVideo: () => void;
  /** Pick a video from Google Drive (cloud). */
  openDriveBrowser: () => void;
  openSettings: () => void;
}

export function errorActionHandlers(caps: Caps, deps: ErrorActionDeps): ActionHandlers {
  const handlers: ActionHandlers = {
    upload_cookies: () => deps.openCookies(deps.rerun),
    // Cloud takes videos from Google Drive; desktop and local from this computer.
    upload_video: caps.driveBrowser ? deps.openDriveBrowser : deps.uploadVideo,
    retry: deps.rerun,
    resume: deps.resume,
  };
  // open_settings points at the API key; without API keys there is nothing to open.
  if (caps.apiKeys) handlers.open_settings = deps.openSettings;
  return handlers;
}

/** Labels that replace the backend's, where this platform does something more specific. */
export function actionLabels(caps: Caps, t: (key: string, fallback: string) => string): Partial<Record<string, string>> {
  return caps.driveBrowser ? { upload_video: t("action.pick_from_drive", "Pilih video dari Google Drive") } : {};
}
