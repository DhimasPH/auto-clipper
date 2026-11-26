import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CAPS } from "../platform/caps";
import { REPICK_MAX_CLIPS, canRepick, parseClipCount, repickMode } from "./repick";

describe("repick (SP4 spec 4.4)", () => {
  it("is offered for finished projects that kept their spoken text", () => {
    expect(canRepick({ status: "DONE", metadata: { subtitle_path: "/lib/p/subtitles/subtitles.words.json" } })).toBe(true);
    expect(canRepick({ status: "DONE", metadata: { subtitle_path: "" } })).toBe(false);
    expect(canRepick({ status: "DONE", metadata: {} })).toBe(false);
    expect(canRepick({ status: "ERROR", metadata: { subtitle_path: "/s.json" } })).toBe(false);
    expect(canRepick({ status: "AWAITING_MANUAL", metadata: { subtitle_path: "/s.json" } })).toBe(false);
    expect(canRepick(null)).toBe(false);
  });

  it("uses the manual route wherever the app picks manual AI (E.20)", () => {
    expect(repickMode(CAPS.cloud, "auto", "openai")).toBe("manual");
    expect(repickMode(CAPS.desktop, "manual", "openai")).toBe("manual");
    expect(repickMode(CAPS.desktop, "auto", "openai")).toBe("api");
    expect(repickMode(CAPS.local, "auto", "gemini")).toBe("api");
    expect(repickMode(CAPS.local, "auto", "")).toBe("manual");
  });

  it("reads the clip count: empty or not a number means automatic", () => {
    expect(parseClipCount("")).toBe(0);
    expect(parseClipCount("  4 ")).toBe(4);
    expect(parseClipCount("0")).toBe(0);
    expect(parseClipCount("-2")).toBe(0);
    expect(parseClipCount("abc")).toBe(0);
    expect(parseClipCount("999")).toBe(REPICK_MAX_CLIPS);
  });

  it("no code calls the old hyphenated /rerun-ai address", () => {
    const files = (readdirSync("src", { recursive: true }) as string[]).filter(
      (f) => /\.(ts|tsx)$/.test(f) && !f.endsWith("repick.test.ts"),
    );
    const hits = files.filter((f) => readFileSync(join("src", f), "utf8").includes("/rerun-ai"));
    expect(hits).toEqual([]);
  });
});
