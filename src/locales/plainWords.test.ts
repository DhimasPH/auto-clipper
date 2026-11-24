import { describe, expect, it } from "vitest";
import en from "./en.json";
import id from "./id.json";

// Spec 4.6: no technical words, no decorative emoji and no em dash in main-screen text.
// Each task that adds a main-screen namespace adds it here (Task 10 adds "toast").
// Task 15 adds the look controls on Buat klip and the dialogs opened from a clip or a project.
export const MAIN_NAMESPACES = [
  "nav", "create", "progress", "moment", "result", "projects", "banner", "toast",
  "canvas", "subtitle_custom", "subtitle_preset", "clip_rerender", "social", "dialog", "drive",
];
const BANNED = [
  "transkripsi", "transcription", "render", "encoder", "json", "sidecar", "token",
  "prompt", "backend", "ffmpeg", "nvenc", "cuda", "whisper",
];
const EMOJI = /\p{Extended_Pictographic}/u;

type Entry = [path: string, text: string];

function texts(node: unknown, path: string): Entry[] {
  if (typeof node === "string") return [[path, node]];
  if (Array.isArray(node)) return node.flatMap((v, i) => texts(v, `${path}.${i}`));
  if (node && typeof node === "object") return Object.entries(node).flatMap(([k, v]) => texts(v, `${path}.${k}`));
  return [];
}

export function mainScreenTexts(locale: Record<string, unknown>): Entry[] {
  const out = MAIN_NAMESPACES.flatMap((ns) => (ns in locale ? texts(locale[ns], ns) : []));
  const timing = (locale.timing ?? {}) as Record<string, unknown>;
  for (const [key, value] of Object.entries(timing)) {
    // device_* sits next to the stage rows on the progress screen (Task 15).
    if (key.startsWith("stage_") || key.startsWith("device_")) out.push(...texts(value, `timing.${key}`));
  }
  return out;
}

describe.each([
  ["id", id],
  ["en", en],
])("main-screen text (%s)", (_lang, locale) => {
  const entries = mainScreenTexts(locale as Record<string, unknown>);

  it("has no technical words", () => {
    const hits = entries
      .filter(([, text]) => BANNED.some((word) => text.toLowerCase().includes(word)))
      .map(([path, text]) => `${path}: ${text}`);
    expect(hits).toEqual([]);
  });

  it("has no emoji and no em dash", () => {
    const hits = entries
      .filter(([, text]) => EMOJI.test(text) || text.includes("\u2014"))
      .map(([path, text]) => `${path}: ${text}`);
    expect(hits).toEqual([]);
  });
});

// Settings, gates and error cards are not main screens, so technical words may appear there,
// but decorative emoji and the em dash are banned in every text the app can show (spec 4.6, Task 15).
describe.each([
  ["id", id],
  ["en", en],
])("every text (%s)", (_lang, locale) => {
  it("has no emoji and no em dash", () => {
    const hits = texts(locale, "")
      .filter(([, text]) => EMOJI.test(text) || text.includes("—"))
      .map(([path, text]) => `${path}: ${text}`);
    expect(hits).toEqual([]);
  });
});

// SP3: the add-on rows in Pengaturan are read by everyone who opens Lanjutan, so they use the main-screen
// word list plus the add-on names (technical names only under "Detail teknis").
describe.each([
  ["id", id],
  ["en", en],
])("add-on texts in Pengaturan (%s)", (_lang, locale) => {
  it("use plain words", () => {
    const settings = (locale as { settings: Record<string, unknown> }).settings;
    const keys = Object.keys(settings).filter((k) => k.startsWith("addon_") || k.startsWith("whisper_cpu_note") || k === "face_engine_cloud_note");
    expect(keys).toEqual(expect.arrayContaining(["whisper_cpu_note_no_gpu", "face_engine_cloud_note", "addon_gpu_remove_confirm_body"]));
    expect(keys.length).toBeGreaterThan(10);
    const banned = [...BANNED, "mediapipe", "dll", "cublas"];
    const hits = keys
      .map((k) => [k, String(settings[k])] as const)
      .filter(([, text]) => banned.some((word) => text.toLowerCase().includes(word)))
      .map(([k, text]) => `settings.${k}: ${text}`);
    expect(hits).toEqual([]);
  });
});
