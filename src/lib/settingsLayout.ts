import { version } from "../../package.json";
import type { Caps } from "../platform/types";
import type { AiMode } from "./createFlow";
import type { ManualLook } from "../hooks/useClipJobs";
import { DEFAULT_CANVAS_CONFIG } from "../types/canvas";
import { DEFAULT_SUBTITLE_CONFIG } from "../types/subtitle";

/** The app version shown in Pengaturan, Bantuan. Read from package.json so it never drifts. */
export const APP_VERSION: string = version;

export interface SettingsVisibility {
  showAiMode: boolean;
  showProviderKeys: boolean;
  /** B-roll needs a Pexels key in manual AI mode too, so it is not tied to the AI mode switch. */
  showPexelsKey: boolean;
  showOutputFolder: boolean;
  showUpdater: boolean;
  /** Install and remove buttons for the optional add-ons (SP3 spec 4.2). */
  showAddons: boolean;
}

/** Which rows of Lanjutan and Bantuan this platform shows (AGENTS F.6, spec 4.5, Spec gap 12). */
export function settingsVisibility(
  caps: Pick<Caps, "apiKeys" | "localFilePicker" | "updater" | "addons">,
  aiMode: AiMode,
): SettingsVisibility {
  return {
    showAiMode: caps.apiKeys,
    showProviderKeys: caps.apiKeys && aiMode === "auto",
    showPexelsKey: caps.apiKeys,
    showOutputFolder: caps.localFilePicker,
    showUpdater: caps.updater,
    showAddons: caps.addons,
  };
}

export type DownloadShape = "16:9" | "9:16";

/**
 * The look of a download from Pengaturan (spec 4.5, review ruling): only its own shape and
 * subtitle switch, never the remembered Buat klip choices. Without subtitles nothing is transcribed.
 */
export function downloaderLook(shape: DownloadShape, subtitles: boolean): ManualLook {
  return {
    aspectRatio: shape,
    burnSubtitles: subtitles,
    captionStyle: DEFAULT_SUBTITLE_CONFIG.style,
    canvasConfig: DEFAULT_CANVAS_CONFIG,
    subtitleConfig: DEFAULT_SUBTITLE_CONFIG,
    isGamingVideo: false,
    trackingMode: "auto",
  };
}
