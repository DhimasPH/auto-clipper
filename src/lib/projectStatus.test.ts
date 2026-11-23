import { describe, expect, it } from "vitest";
import { formatProjectDate, projectPrimaryAction, projectStatusKey } from "./projectStatus";

describe("projectStatus (spec 4.5)", () => {
  it("maps backend statuses to plain status keys", () => {
    expect(projectStatusKey({ status: "DONE" })).toBe("done");
    expect(projectStatusKey({ status: "completed" })).toBe("done");
    expect(projectStatusKey({ status: "ERROR" })).toBe("failed");
    expect(projectStatusKey({ status: "failed" })).toBe("failed");
    expect(projectStatusKey({ status: "AWAITING_MANUAL" })).toBe("awaiting");
    expect(projectStatusKey({ status: "CANCELLED" })).toBe("cancelled");
    expect(projectStatusKey({ status: "PENDING" })).toBe("queued");
    expect(projectStatusKey({ status: "QUEUED" })).toBe("queued");
    expect(projectStatusKey({ status: "DOWNLOADING", queue_position: 2 })).toBe("queued");
    expect(projectStatusKey({ status: "TRANSCRIBING", queue_position: 0 })).toBe("running");
    expect(projectStatusKey({ status: "GENERATING" }, true)).toBe("queued");
  });

  it("picks the one primary action matching status and source availability", () => {
    expect(projectPrimaryAction({ status: "DONE" })).toBe("view_clips");
    expect(projectPrimaryAction({ status: "AWAITING_MANUAL" })).toBe("paste_answer");
    expect(projectPrimaryAction({ status: "ERROR", url: "https://youtu.be/a" })).toBe("resume");
    expect(projectPrimaryAction({ status: "ERROR" })).toBeNull();
    expect(projectPrimaryAction({ status: "CANCELLED", metadata: { source_video: "x.mp4" } })).toBe("retry");
    expect(projectPrimaryAction({ status: "CANCELLED" })).toBeNull();
    expect(projectPrimaryAction({ status: "CROPPING" })).toBe("view_progress");
    expect(projectPrimaryAction({ status: "PENDING" })).toBe("view_progress");
  });

  it("formats dates cleanly without crashing on missing values", () => {
    expect(formatProjectDate("invalid", "id")).toBe("");
    expect(formatProjectDate(undefined, "id")).toBe("");
    expect(formatProjectDate("2026-11-20T14:05:00Z", "id")).toContain("2026");
  });
});
