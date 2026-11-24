// Everything that differs between the desktop app, the local web app and the
// cloud app (Vercel + Colab) goes through one Platform object (spec 4.1).

export type PlatformKind = "desktop" | "local" | "cloud";

/**
 * What must stay open for a running job to continue (spec 4.3): the desktop app, the
 * "Auto Clipper Web" window, or nothing (cloud: the job runs on Colab).
 */
export type KeepOpen = "app" | "window" | "none";

export interface Caps {
  /** AI providers that need an API key. Cloud: false (manual AI only). */
  apiKeys: boolean;
  /** OS file and folder dialogs. Local and cloud upload through the browser instead. */
  localFilePicker: boolean;
  /** Google Drive browser. Cloud only. */
  driveBrowser: boolean;
  /** Open the result folder on this computer. Desktop and local. */
  openFolder: boolean;
  /** App updater. Desktop only. */
  updater: boolean;
  /** Keep the computer awake while rendering. Desktop only. */
  preventSleep: boolean;
  /** See KeepOpen. Picks the "may I close this?" text and the disconnected-banner text. */
  keepOpen: KeepOpen;
  /**
   * Optional add-ons downloaded from Pengaturan (SP3 spec 4.2): graphics card support for subtitles and the
   * precise face tracker. Desktop and local web only: on cloud the backend runs on Colab, set up by the notebook.
   */
  addons: boolean;
}

export interface BackendInfo {
  url: string;
  token: string;
}

export type VideoSource =
  | { kind: "file"; file: File }
  | { kind: "path"; path: string }
  | { kind: "drive"; path: string };

export interface ClipRef {
  /** Path of the clip on the machine that runs the backend. */
  path: string;
  /** Absolute download URL (a signed /video link with dl=1) for browser downloads. */
  videoUrl?: string;
  /** Suggested file name, e.g. "clip_1.mp4". */
  filename: string;
}

export interface UpdateEvent {
  event: string;
  data?: { contentLength?: number; chunkLength?: number };
}

export interface UpdateHandle {
  version: string;
  body?: string;
  downloadAndInstall(onEvent: (event: UpdateEvent) => void): Promise<void>;
}

export interface UpdaterApi {
  check(): Promise<UpdateHandle | null>;
  relaunch(): Promise<void>;
}

export interface Platform {
  kind: PlatformKind;
  caps: Caps;
  backend(): Promise<BackendInfo>;
  pickVideo(): Promise<VideoSource | null>;
  saveClip(clip: ClipRef): Promise<void>;
  /** Save several clips at once ("Unduh semua"): desktop asks for one folder, browsers download one by one. */
  saveClips(clips: ClipRef[]): Promise<void>;
  openFolder(path: string): Promise<void>;
  secrets: { get(name: string): Promise<string | null>; set(name: string, value: string): Promise<void> };
  notify(title: string, body: string): void;
  /**
   * Ask, once, to show notifications. Called from a user gesture (starting a job),
   * never on page load. Desktop already asks at startup, as before SP1.
   */
  askNotifyPermission(): void;

  // Not in spec 4.1, needed to move every Tauri call (see "Spec gaps" 1 in the plan).
  /** Find the backend again (desktop: respawn the sidecar). Null when it cannot be reached. */
  reconnect(): Promise<BackendInfo | null>;
  openExternal(url: string): Promise<void>;
  /** OS folder dialog; null when cancelled or not available. */
  pickFolder(): Promise<string | null>;
  /** OS image dialog; null when cancelled or not available. */
  pickImage(): Promise<string | null>;
  setPreventSleep(on: boolean): Promise<void>;
  /** Null where caps.updater is false. */
  updater: UpdaterApi | null;
}
