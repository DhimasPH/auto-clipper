import { describe, expect, it } from "vitest";
import pkg from "../../package.json";
import { CAPS } from "../platform/caps";
import { APP_VERSION, settingsVisibility } from "./settingsLayout";

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
