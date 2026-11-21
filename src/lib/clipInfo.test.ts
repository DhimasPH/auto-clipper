import { describe, expect, it } from "vitest";
import { clipSeconds, clipTitle, formatClock, timeToSeconds } from "./clipInfo";

describe("clip info for the result card (spec 4.5)", () => {
  it("reads the times the AI wrote", () => {
    expect(timeToSeconds("00:01:05.500")).toBe(65.5);
    expect(timeToSeconds("1:05")).toBe(65);
    expect(timeToSeconds("00:00:07,250")).toBe(7.25);
    expect(timeToSeconds(12)).toBe(12);
    expect(timeToSeconds("soon")).toBeNull();
  });

  it("gives the clip length, or nothing when it is unknown", () => {
    expect(clipSeconds({ start: "00:01:00", end: "00:01:45" })).toBe(45);
    expect(clipSeconds({ start: "00:01:00" })).toBeNull();
    expect(formatClock(45)).toBe("0:45");
    expect(formatClock(3725)).toBe("1:02:05");
  });

  it("takes the AI title in the app language, then the description", () => {
    const clip = { path: "a", description: "desc", start: "", end: "", subs: true, v: 0, social: { titles_id: ["Judul"], titles_en: ["Title"] } };
    expect(clipTitle(clip, "id")).toBe("Judul");
    expect(clipTitle(clip, "en")).toBe("Title");
    expect(clipTitle({ ...clip, social: undefined, description_id: "Deskripsi" }, "id")).toBe("Deskripsi");
    expect(clipTitle({ ...clip, social: undefined, description: "" }, "id")).toBeNull();
  });
});
