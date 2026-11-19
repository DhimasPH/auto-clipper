import { afterEach, describe, expect, it } from "vitest";
import { loadPlatform, platform, setPlatform } from "./index";

describe("platform loader", () => {
  afterEach(() => setPlatform(null));

  it("throws when used before loadPlatform()", () => {
    expect(() => platform()).toThrow(/loadPlatform/);
  });

  it("loads the local adapter in a plain browser", async () => {
    const loaded = await loadPlatform();
    expect(loaded.kind).toBe("local");
    expect(platform()).toBe(loaded);
  });
});
