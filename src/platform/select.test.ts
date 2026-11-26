import { describe, expect, it } from "vitest";
import { detectPlatformKind } from "./select";

describe("detectPlatformKind", () => {
  it("is desktop inside Tauri, whatever the build target", () => {
    expect(detectPlatformKind({ hasTauri: true })).toBe("desktop");
    expect(detectPlatformKind({ hasTauri: true, target: "cloud" })).toBe("desktop");
  });

  it("is cloud for a VITE_TARGET=cloud build in a browser", () => {
    expect(detectPlatformKind({ hasTauri: false, target: "cloud" })).toBe("cloud");
  });

  it("is local for any other browser build", () => {
    expect(detectPlatformKind({ hasTauri: false })).toBe("local");
    expect(detectPlatformKind({ hasTauri: false, target: "" })).toBe("local");
    expect(detectPlatformKind({ hasTauri: false, target: "something-else" })).toBe("local");
  });
});
