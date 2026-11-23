import { describe, expect, it } from "vitest";
import pkg from "../../package.json";
import { CAPS } from "../platform/caps";
import { DEFAULT_CANVAS_CONFIG } from "../types/canvas";
import { DEFAULT_SUBTITLE_CONFIG } from "../types/subtitle";
import { APP_VERSION, downloaderLook, settingsVisibility } from "./settingsLayout";

describe("settingsVisibility (spec 4.5 & Spec gaps 12-13)", () => {
  it("hides API key mode, provider keys, output folder and updater on cloud", () => {
    expect(settingsVisibility(CAPS.cloud, "manual")).toEqual({
      showAiMode: false,
      showProviderKeys: false,
      showPexelsKey: false,
      showOutputFolder: false,
      showUpdater: false,
    });
    // Even stale "auto" in storage never exposes keys when caps.apiKeys is false.
    expect(settingsVisibility(CAPS.cloud, "auto").showProviderKeys).toBe(false);
  });

  it("shows API key switch on local web but hides local folder picker and updater", () => {
    expect(settingsVisibility(CAPS.local, "manual")).toEqual({
      showAiMode: true,
      showProviderKeys: false,
      showPexelsKey: true,
      showOutputFolder: false,
      showUpdater: false,
    });
    expect(settingsVisibility(CAPS.local, "auto").showProviderKeys).toBe(true);
  });

  it("shows folder picker and updater on desktop", () => {
    expect(settingsVisibility(CAPS.desktop, "auto")).toEqual({
      showAiMode: true,
      showProviderKeys: true,
      showPexelsKey: true,
      showOutputFolder: true,
      showUpdater: true,
    });
  });

  it("keeps the Pexels key reachable in manual AI mode, where B-roll still works", () => {
    expect(settingsVisibility(CAPS.desktop, "manual").showPexelsKey).toBe(true);
  });
});

describe("APP_VERSION", () => {
  it("is the version in package.json", () => {
    expect(APP_VERSION).toBe(pkg.version);
    expect(APP_VERSION).toBe("1.19.0");
  });
});

describe("downloaderLook (review ruling: the downloader never uses Buat klip choices)", () => {
  it("is a plain shape with subtitles only when switched on", () => {
    expect(downloaderLook("16:9", false)).toEqual({
      aspectRatio: "16:9",
      burnSubtitles: false,
      captionStyle: DEFAULT_SUBTITLE_CONFIG.style,
      canvasConfig: DEFAULT_CANVAS_CONFIG,
      subtitleConfig: DEFAULT_SUBTITLE_CONFIG,
      isGamingVideo: false,
      trackingMode: "auto",
    });
    expect(downloaderLook("9:16", true)).toMatchObject({ aspectRatio: "9:16", burnSubtitles: true });
  });
});
