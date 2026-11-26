import { describe, expect, it } from "vitest";
import { CAPS } from "./caps";

describe("CAPS (spec 4.1)", () => {
  it("desktop can do everything except browse Google Drive", () => {
    expect(CAPS.desktop).toEqual({
      apiKeys: true, localFilePicker: true, driveBrowser: false, openFolder: true, updater: true, preventSleep: true, keepOpen: "app", addons: true, splash: "startup",
    });
  });

  it("local web keeps API keys and opening folders, has no OS dialogs, updater or sleep control", () => {
    expect(CAPS.local).toEqual({
      apiKeys: true, localFilePicker: false, driveBrowser: false, openFolder: true, updater: false, preventSleep: false, keepOpen: "window", addons: true, splash: "tab",
    });
  });

  it("cloud is manual AI only, browses Drive, cannot open folders", () => {
    expect(CAPS.cloud).toEqual({
      apiKeys: false, localFilePicker: false, driveBrowser: true, openFolder: false, updater: false, preventSleep: false, keepOpen: "none", addons: false, splash: "tab",
    });
  });

  it("says what must stay open while a job runs (spec 4.3)", () => {
    expect([CAPS.desktop.keepOpen, CAPS.local.keepOpen, CAPS.cloud.keepOpen]).toEqual(["app", "window", "none"]);
  });

  it("offers the optional add-ons only where the backend runs on the user's computer (SP3 spec 4.2)", () => {
    expect([CAPS.desktop.addons, CAPS.local.addons, CAPS.cloud.addons]).toEqual([true, true, false]);
  });

  it("shows the splash while the desktop app starts, once per tab on the web (SP4 spec 4.3)", () => {
    expect([CAPS.desktop.splash, CAPS.local.splash, CAPS.cloud.splash]).toEqual(["startup", "tab", "tab"]);
  });
});
