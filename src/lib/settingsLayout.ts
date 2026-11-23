import { version } from "../../package.json";
import type { Caps } from "../platform/types";
import type { AiMode } from "./createFlow";

/** The app version shown in Pengaturan, Bantuan. Read from package.json so it never drifts. */
export const APP_VERSION: string = version;

export interface SettingsVisibility {
  showAiMode: boolean;
  showProviderKeys: boolean;
  /** B-roll needs a Pexels key in manual AI mode too, so it is not tied to the AI mode switch. */
  showPexelsKey: boolean;
  showOutputFolder: boolean;
  showUpdater: boolean;
}

/** Which rows of Lanjutan and Bantuan this platform shows (AGENTS F.6, spec 4.5, Spec gap 12). */
export function settingsVisibility(
  caps: Pick<Caps, "apiKeys" | "localFilePicker" | "updater">,
  aiMode: AiMode,
): SettingsVisibility {
  return {
    showAiMode: caps.apiKeys,
    showProviderKeys: caps.apiKeys && aiMode === "auto",
    showPexelsKey: caps.apiKeys,
    showOutputFolder: caps.localFilePicker,
    showUpdater: caps.updater,
  };
}
