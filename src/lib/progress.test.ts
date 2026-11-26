import { describe, expect, it } from "vitest";
import { asLiveStage, deviceNotes, progressRows, stagesFor, type LiveStage } from "./progress";

const live = (stage: string, extra: Partial<LiveStage> = {}): LiveStage => ({ stage, started_at: 1, elapsed_seconds: 5, ...extra });
const timing = (stage: string, seconds: number, extra: Record<string, unknown> = {}) => ({
  stage,
  seconds,
  rss_mb_peak: 1,
  ok: true,
  ...extra,
});
const states = (rows: { stage: string; state: string }[]) => rows.map((r) => `${r.stage}:${r.state}`);

describe("asLiveStage", () => {
  it("reads the current object of the job status", () => {
    expect(asLiveStage({ stage: "render", started_at: 3, elapsed_seconds: 2.5, clip: 2, clips_total: 4, device: "libx264", extra: 1 })).toEqual({
      stage: "render",
      started_at: 3,
      elapsed_seconds: 2.5,
      clip: 2,
      clips_total: 4,
      device: "libx264",
    });
  });

  it("is null for nothing or nonsense", () => {
    expect(asLiveStage(null)).toBeNull();
    expect(asLiveStage({ stage: "" })).toBeNull();
    expect(asLiveStage("render")).toBeNull();
  });
});

describe("stagesFor", () => {
  it("lists the stages of each step", () => {
    expect(stagesFor(2, { autoAi: false, tracking: true })).toEqual(["download", "extract_audio", "transcribe"]);
    expect(stagesFor(2, { autoAi: true, tracking: true })).toEqual(["download", "extract_audio", "transcribe", "ai_analysis"]);
    expect(stagesFor(4, { autoAi: false, tracking: true })).toEqual(["tracking", "render", "publish"]);
    expect(stagesFor(4, { autoAi: false, tracking: false })).toEqual(["render", "publish"]);
  });
});

describe("progressRows (spec 4.3: real progress only)", () => {
  const prepare = ["download", "extract_audio", "transcribe"];
  const make = ["tracking", "render", "publish"];

  it("shows every stage as waiting before anything runs", () => {
    expect(states(progressRows(prepare, [], null))).toEqual(["download:todo", "extract_audio:todo", "transcribe:todo"]);
  });

  it("shows the download percent while downloading", () => {
    const rows = progressRows(prepare, [], live("download", { percent: 42.5 }));
    expect(rows[0]).toEqual({ stage: "download", state: "running", seconds: 5, percent: 42.5, clip: null, clipsTotal: null });
    expect(states(rows).slice(1)).toEqual(["extract_audio:todo", "transcribe:todo"]);
  });

  it("ticks finished stages with how long they took", () => {
    const rows = progressRows(prepare, [timing("download", 10), timing("extract_audio", 3)], live("transcribe"));
    expect(states(rows)).toEqual(["download:done", "extract_audio:done", "transcribe:running"]);
    expect(rows[0].seconds).toBe(10);
  });

  it("hides a stage this video does not use", () => {
    expect(states(progressRows(prepare, [timing("download", 10)], live("transcribe")))).toEqual(["download:done", "transcribe:running"]);
  });

  it("says which clip of how many, and does not tick a stage that runs again for the next clip", () => {
    const rows = progressRows(make, [timing("tracking", 4, { clip: 1 }), timing("render", 20, { clip: 1 })], live("tracking", { clip: 2, clips_total: 3 }));
    expect(states(rows)).toEqual(["tracking:running", "render:todo", "publish:todo"]);
    expect([rows[0].clip, rows[0].clipsTotal]).toEqual([2, 3]);
  });

  it("counts adding the opening hook as making the clip", () => {
    expect(states(progressRows(make, [timing("tracking", 4)], live("hook_concat", { clip: 1 })))).toEqual([
      "tracking:done",
      "render:running",
      "publish:todo",
    ]);
  });

  it("shows a running stage from outside the list first", () => {
    expect(states(progressRows(make, [], live("download")))).toEqual(["download:running", "tracking:todo", "render:todo", "publish:todo"]);
  });
});

describe("deviceNotes (spec 4.3: the device really used)", () => {
  const prepare = ["download", "extract_audio", "transcribe"];

  it("notes subtitles made on the processor", () => {
    expect(deviceNotes(live("transcribe", { device: "cpu" }), [], prepare)).toEqual(["cpu_subtitle"]);
    expect(deviceNotes(null, [timing("transcribe", 30, { whisper_device: "cpu" })], prepare)).toEqual(["cpu_subtitle"]);
  });

  it("says nothing when the GPU did the work", () => {
    expect(deviceNotes(live("transcribe", { device: "cuda" }), [], prepare)).toEqual([]);
  });

  it("notes clips made on the processor, only on the step that makes them", () => {
    const timings = [timing("transcribe", 30, { whisper_device: "cpu" }), timing("render", 9, { encoder: "libx264" })];
    expect(deviceNotes(null, timings, ["tracking", "render", "publish"])).toEqual(["cpu_render"]);
  });
});

describe("deviceNotes: Teliti fell back to Standar (SP3 spec 4.2.C)", () => {
  const make = ["tracking", "render", "publish"];
  const fellBack = { tracking_engine_requested: "mediapipe", tracking_engine_used: "haar" };

  it("reports fallback_tracking when mediapipe was requested but haar ran", () => {
    expect(
      deviceNotes(null, [timing("tracking", 5, fellBack)], make),
    ).toContain("fallback_tracking");
  });

  it("reads the finished tracking rows and the live stage", () => {
    expect(deviceNotes(null, [timing("tracking", 5, { ...fellBack, tracking_fallback_reason: "addon_not_installed" })], make)).toEqual([
      "fallback_tracking",
    ]);
    expect(deviceNotes(live("tracking", { device: "haar_fallback" }), [], make)).toEqual(["fallback_tracking"]);
  });

  it("tells a failure of an installed tracker apart from a missing one", () => {
    const failed = timing("tracking", 5, { ...fellBack, tracking_fallback_reason: "mediapipe crashed on frame 12" });
    expect(deviceNotes(live("tracking", { device: "haar_fallback" }), [failed], make)).toEqual(["fallback_tracking_failed"]);
    expect(deviceNotes(null, [failed], make)).toEqual(["fallback_tracking_failed"]);
  });

  it("reads tracking facts only from this run's tracking rows, ignoring extra metadata or other stages (Resume, re-render)", () => {
    const stale = { ...fellBack, tracking_fallback_reason: "addon_not_installed" };
    // Even if a caller still passed a legacy 4th object or another stage carried fields, only tracking rows count.
    expect((deviceNotes as (...args: unknown[]) => string[])(null, [], make, stale)).toEqual([]);
    expect((deviceNotes as (...args: unknown[]) => string[])(live("render", { clip: 1 }), [timing("download", 3, stale)], make, stale)).toEqual([]);
    expect((deviceNotes as (...args: unknown[]) => string[])(null, [timing("tracking", 5)], make, stale)).toEqual([]);
    expect(deviceNotes(null, [timing("tracking", 5, { ...fellBack, tracking_fallback_reason: "addon_not_installed" })], make)).toEqual([
      "fallback_tracking",
    ]);
  });

  it("says nothing when Teliti ran, Standar was chosen, or no face tracking happens", () => {
    expect(deviceNotes(null, [timing("tracking", 5, { tracking_engine_requested: "mediapipe", tracking_engine_used: "mediapipe" })], make)).toEqual([]);
    expect(deviceNotes(null, [timing("tracking", 5, { tracking_engine_requested: "haar", tracking_engine_used: "haar" })], make)).toEqual([]);
    expect(deviceNotes(null, [timing("tracking", 5, fellBack)], ["render", "publish"])).toEqual([]);
  });
});
