import { describe, expect, it } from "vitest";
import { blockerInfo, splitPreflight } from "./preflight";

const check = (id: string, level: string, extra: Record<string, string> = {}) => ({
  id,
  level,
  title: `t-${id}`,
  message: `m-${id}`,
  title_en: `te-${id}`,
  message_en: `me-${id}`,
  ...extra,
});

describe("splitPreflight (spec 4.4)", () => {
  it("keeps warnings as notes and blocks as error cards, and drops passed checks", () => {
    const result = splitPreflight([
      check("disk", "ok"),
      check("gpu", "warn"),
      check("ffmpeg", "block", { code: "FFMPEG_MISSING", technical: "not on PATH" }),
    ]);
    expect(result.notes.map((n) => n.id)).toEqual(["gpu"]);
    expect(result.blockers).toEqual([
      {
        code: "FFMPEG_MISSING",
        title: "t-ffmpeg",
        message: "m-ffmpeg",
        title_en: "te-ffmpeg",
        message_en: "me-ffmpeg",
        actions: [],
        technical: "not on PATH",
      },
    ]);
  });

  it("survives a missing or odd answer", () => {
    expect(splitPreflight(undefined)).toEqual({ notes: [], blockers: [] });
    expect(splitPreflight([null, "x", 3])).toEqual({ notes: [], blockers: [] });
  });

  it("names a blocker by its check id when it has no error code", () => {
    expect(blockerInfo(check("drive", "block")).code).toBe("drive");
  });
});
