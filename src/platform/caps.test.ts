import { describe, expect, it } from "vitest";
import { CAPS } from "./caps";

describe("CAPS (spec 4.1)", () => {
  it("desktop can do everything except browse Google Drive", () => {
    expect(CAPS.desktop).toEqual({
      apiKeys: true, localFilePicker: true, driveBrowser: false, openFolder: true, updater: true, preventSleep: true,
    });
  });

  it("local web keeps API keys and opening folders, has no OS dialogs, updater or sleep control", () => {
    expect(CAPS.local).toEqual({
      apiKeys: true, localFilePicker: false, driveBrowser: false, openFolder: true, updater: false, preventSleep: false,
    });
  });

  it("cloud is manual AI only, browses Drive, cannot open folders", () => {
    expect(CAPS.cloud).toEqual({
      apiKeys: false, localFilePicker: false, driveBrowser: true, openFolder: false, updater: false, preventSleep: false,
    });
  });
});
