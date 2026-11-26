import { describe, expect, it } from "vitest";
import { DEFAULT_CANVAS_CONFIG } from "../types/canvas";
import { CLIP_CHOICES_KEY, DEFAULT_CLIP_CHOICES, loadClipChoices, saveClipChoices } from "./clipChoices";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (k: string) => (k in data ? data[k] : null),
    setItem: (k: string, v: string) => {
      data[k] = v;
    },
  };
}

describe("remembered clip choices (spec 4.2)", () => {
  it("starts from good defaults", () => {
    expect(loadClipChoices(null)).toEqual(DEFAULT_CLIP_CHOICES);
    expect(DEFAULT_CLIP_CHOICES.aspectRatio).toBe("9:16");
    expect(DEFAULT_CLIP_CHOICES.burnSubtitles).toBe(true);
  });

  it("keeps the last choices for the next video", () => {
    const storage = memoryStorage();
    const choices = { ...DEFAULT_CLIP_CHOICES, aspectRatio: "1:1" as const, enableHook: true, maxClips: 5 };
    saveClipChoices(storage, choices);
    expect(loadClipChoices(storage)).toEqual(choices);
  });

  it("ignores damaged or unknown values", () => {
    expect(loadClipChoices(memoryStorage({ [CLIP_CHOICES_KEY]: "{not json" }))).toEqual(DEFAULT_CLIP_CHOICES);
    const odd = JSON.stringify({ aspectRatio: "4:5", maxClips: 7, enableHook: "yes", trackingMode: "left" });
    expect(loadClipChoices(memoryStorage({ [CLIP_CHOICES_KEY]: odd }))).toEqual(DEFAULT_CLIP_CHOICES);
  });

  it("does not carry a canvas image to the next video (it lives on one backend's disk)", () => {
    const storage = memoryStorage();
    const canvasConfig = { ...DEFAULT_CANVAS_CONFIG, enabled: true, background_type: "image" as const, background_image_path: "/work/bg.png" };
    saveClipChoices(storage, { ...DEFAULT_CLIP_CHOICES, aspectRatio: "16:9", canvasConfig });
    const loaded = loadClipChoices(storage);
    expect(loaded.canvasConfig.enabled).toBe(true);
    expect(loaded.canvasConfig.background_type).toBe("blur");
    expect(loaded.canvasConfig.background_image_path).toBe("");
  });

  it("clears any leftover canvas image path even when background_type was switched away from image (P14)", () => {
    const storage = memoryStorage();
    const canvasConfig = { ...DEFAULT_CANVAS_CONFIG, enabled: true, background_type: "color" as const, background_image_path: "/work/stale.png" };
    saveClipChoices(storage, { ...DEFAULT_CLIP_CHOICES, aspectRatio: "16:9", canvasConfig });
    const loaded = loadClipChoices(storage);
    expect(loaded.canvasConfig.background_type).toBe("color");
    expect(loaded.canvasConfig.background_image_path).toBe("");
  });

  it("survives blocked storage", () => {
    const blocked = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
    expect(loadClipChoices(blocked)).toEqual(DEFAULT_CLIP_CHOICES);
    expect(() => saveClipChoices(blocked, DEFAULT_CLIP_CHOICES)).not.toThrow();
  });
});
