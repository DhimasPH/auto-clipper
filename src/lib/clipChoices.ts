import { DEFAULT_CANVAS_CONFIG, type CanvasConfig } from "../types/canvas";
import { DEFAULT_SUBTITLE_CONFIG, type SubtitleConfig } from "../types/subtitle";

// "Atur tampilan klip" (spec 4.2): good defaults, and the last choices are kept for the next video.

export type ShapeValue = "9:16" | "1:1" | "16:9";

export interface ClipChoices {
  aspectRatio: ShapeValue;
  trackingMode: "auto" | "center";
  burnSubtitles: boolean;
  subtitleConfig: SubtitleConfig;
  canvasConfig: CanvasConfig;
  enableHook: boolean;
  enableBroll: boolean;
  maxClips: number;
  isGamingVideo: boolean;
}

export const CLIP_CHOICES_KEY = "ac_clip_choices";
export const MAX_CLIP_OPTIONS = [0, 3, 5, 10, 15, 20];
const SHAPES: ShapeValue[] = ["9:16", "1:1", "16:9"];

export const DEFAULT_CLIP_CHOICES: ClipChoices = {
  aspectRatio: "9:16",
  trackingMode: "auto",
  burnSubtitles: true,
  subtitleConfig: DEFAULT_SUBTITLE_CONFIG,
  canvasConfig: DEFAULT_CANVAS_CONFIG,
  enableHook: false,
  enableBroll: false,
  maxClips: 0,
  isGamingVideo: false,
};

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

function merged<T extends object>(value: unknown, fallback: T): T {
  return isObject(value) ? { ...fallback, ...value } : fallback;
}

export function loadClipChoices(storage: Pick<Storage, "getItem"> | null): ClipChoices {
  let saved: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(storage?.getItem(CLIP_CHOICES_KEY) || "null");
    if (isObject(parsed)) saved = parsed;
  } catch {
    // Damaged or blocked: the defaults.
  }
  const d = DEFAULT_CLIP_CHOICES;
  const flag = (key: keyof ClipChoices) => (typeof saved[key] === "boolean" ? (saved[key] as boolean) : (d[key] as boolean));
  return {
    // "4:5" from before SP2 is not offered any more: back to vertical.
    aspectRatio: SHAPES.includes(saved.aspectRatio as ShapeValue) ? (saved.aspectRatio as ShapeValue) : d.aspectRatio,
    trackingMode: saved.trackingMode === "center" ? "center" : "auto",
    burnSubtitles: flag("burnSubtitles"),
    subtitleConfig: merged(saved.subtitleConfig, d.subtitleConfig),
    canvasConfig: merged(saved.canvasConfig, d.canvasConfig),
    enableHook: flag("enableHook"),
    enableBroll: flag("enableBroll"),
    maxClips: MAX_CLIP_OPTIONS.includes(saved.maxClips as number) ? (saved.maxClips as number) : d.maxClips,
    isGamingVideo: flag("isGamingVideo"),
  };
}

export function saveClipChoices(storage: Pick<Storage, "setItem"> | null, choices: ClipChoices): void {
  // A canvas image lives on one backend's disk (plan Spec gap 16, Ruling P14): never carry background_image_path across videos.
  const canvasConfig: CanvasConfig =
    choices.canvasConfig.background_type === "image"
      ? { ...choices.canvasConfig, background_type: "blur", background_image_path: "" }
      : { ...choices.canvasConfig, background_image_path: "" };
  try {
    storage?.setItem(CLIP_CHOICES_KEY, JSON.stringify({ ...choices, canvasConfig }));
  } catch {
    // Storage blocked: the choices still apply to this video.
  }
}
