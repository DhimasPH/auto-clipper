import type { Caps, PlatformKind } from "./types";

/** What each platform can do (spec 4.1 table). Components check these, not the platform kind. */
export const CAPS: Record<PlatformKind, Caps> = {
  desktop: { apiKeys: true, localFilePicker: true, driveBrowser: false, openFolder: true, updater: true, preventSleep: true, keepOpen: "app", addons: true, splash: "startup", updateNotice: false },
  local: { apiKeys: true, localFilePicker: false, driveBrowser: false, openFolder: true, updater: false, preventSleep: false, keepOpen: "window", addons: true, splash: "tab", updateNotice: true },
  cloud: { apiKeys: false, localFilePicker: false, driveBrowser: true, openFolder: false, updater: false, preventSleep: false, keepOpen: "none", addons: false, splash: "tab", updateNotice: false },
};
