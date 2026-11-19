import type { Caps, PlatformKind } from "./types";

/** What each platform can do (spec 4.1 table). Components check these, not the platform kind. */
export const CAPS: Record<PlatformKind, Caps> = {
  desktop: { apiKeys: true, localFilePicker: true, driveBrowser: false, openFolder: true, updater: true, preventSleep: true },
  local: { apiKeys: true, localFilePicker: false, driveBrowser: false, openFolder: true, updater: false, preventSleep: false },
  cloud: { apiKeys: false, localFilePicker: false, driveBrowser: true, openFolder: false, updater: false, preventSleep: false },
};
