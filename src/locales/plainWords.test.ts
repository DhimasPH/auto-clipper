import { describe, expect, it } from "vitest";
import en from "./en.json";
import id from "./id.json";

// Spec 4.6: no technical words, no decorative emoji and no em dash in main-screen text.
// Each task that adds a main-screen namespace adds it here (Task 10 adds "toast").
export const MAIN_NAMESPACES = ["nav", "create", "progress", "moment", "result", "projects", "banner", "toast"];
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
    if (key.startsWith("stage_")) out.push(...texts(value, `timing.${key}`));
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
