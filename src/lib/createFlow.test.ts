import { describe, expect, it } from "vitest";
import { CAPS } from "../platform/caps";
import {
  activeStep,
  asksAboutProcessorModel,
  autoProjectTitle,
  effectiveProvider,
  linkProblem,
  stepStates,
  type FlowState,
} from "./createFlow";

const idle: FlowState = { status: "IDLE", running: false, currentStage: null, awaitingAnswer: false, makePhase: false, hasClips: false };

describe("activeStep (spec 4.2: Video, Siapkan, Pilih momen, Klip)", () => {
  it.each<[string, Partial<FlowState>, number]>([
    ["nothing started", {}, 1],
    ["upload or queue, no stage yet", { running: true, status: "GENERATING" }, 2],
    ["downloading", { running: true, status: "DOWNLOADING", currentStage: "download" }, 2],
    ["making subtitles", { running: true, status: "TRANSCRIBING", currentStage: "transcribe" }, 2],
    ["waiting for the AI answer", { awaitingAnswer: true }, 3],
    ["API key mode picking moments", { running: true, status: "TRANSCRIBING", currentStage: "ai_analysis" }, 3],
    ["tracking faces", { running: true, status: "CROPPING", currentStage: "tracking" }, 4],
    ["answer sent, job still queued", { running: true, status: "PENDING", makePhase: true }, 4],
    ["between two clips", { running: true, status: "CROPPING" }, 4],
    ["clips ready", { status: "DONE", hasClips: true }, 4],
    ["failed before any clip", { status: "ERROR" }, 1],
  ])("%s → step %i", (_name, patch, step) => {
    expect(activeStep({ ...idle, ...patch })).toBe(step);
  });
});

describe("stepStates", () => {
  it("ticks finished steps and marks the active one", () => {
    expect(stepStates(3, false)).toEqual(["done", "done", "active", "todo"]);
  });

  it("ticks every step once the clips are ready", () => {
    expect(stepStates(4, true)).toEqual(["done", "done", "done", "done"]);
  });
});

describe("linkProblem (same list as backend/main.py SUPPORTED_URL_RE)", () => {
  it.each([
    ["https://www.youtube.com/watch?v=abc", null],
    ["youtu.be/abc", null],
    ["https://m.youtube.com/shorts/abc", null],
    ["https://vt.tiktok.com/ZS123/", null],
    ["https://www.instagram.com/reel/abc/", null],
    ["https://x.com/user/status/1", null],
    ["  ", "empty"],
    ["https://vimeo.com/123", "unsupported"],
    ["youtube.com", "unsupported"],
    ["hello", "unsupported"],
  ])("%s → %s", (text, problem) => {
    expect(linkProblem(text)).toBe(problem);
  });
});

describe("autoProjectTitle (the backend needs a unique title)", () => {
  const now = new Date(2026, 10, 20, 14, 5, 9);

  it("names a link after its site and the time", () => {
    expect(autoProjectTitle({ kind: "link", url: "https://youtu.be/abc" }, now)).toBe("YouTube 2026-11-20 14.05.09");
    expect(autoProjectTitle({ kind: "link", url: "https://www.tiktok.com/@a/video/1" }, now)).toBe("TikTok 2026-11-20 14.05.09");
  });

  it("names a file after the file, without characters a folder name cannot hold", () => {
    expect(autoProjectTitle({ kind: "file", name: "Podcast: Radit #12?.mp4" }, now)).toBe("Podcast Radit 12 2026-11-20 14.05.09");
  });
});

describe("effectiveProvider (spec 4.2: manual AI unless API key mode is on)", () => {
  it("uses manual AI by default and on platforms without API keys", () => {
    expect(effectiveProvider(CAPS.desktop, "manual", "openai")).toBe("manual_ai");
    expect(effectiveProvider(CAPS.cloud, "auto", "openai")).toBe("manual_ai");
  });

  it("uses the chosen provider in API key mode", () => {
    expect(effectiveProvider(CAPS.local, "auto", "gemini")).toBe("gemini");
  });
});

describe("asksAboutProcessorModel (SP3 4.3: medium/large-v3 on the processor)", () => {
  const gpuWarn = [{ id: "gpu", level: "warn", title: "Subtitle memakai prosesor", message: "Lambat." }];
  const otherWarn = [{ id: "gpu_render", level: "warn", title: "Video dibuat dengan prosesor", message: "Lambat." }];

  it("asks for medium and large-v3 when the gpu check warns", () => {
    expect(asksAboutProcessorModel("medium", gpuWarn)).toBe(true);
    expect(asksAboutProcessorModel("large-v3", gpuWarn)).toBe(true);
  });

  it("does not ask for small, or when the gpu check is ok, not run yet, or another check warns", () => {
    expect(asksAboutProcessorModel("small", gpuWarn)).toBe(false);
    expect(asksAboutProcessorModel("medium", [])).toBe(false);
    expect(asksAboutProcessorModel("medium", otherWarn)).toBe(false);
    expect(asksAboutProcessorModel(undefined, gpuWarn)).toBe(false);
  });
});
