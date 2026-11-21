import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import axios from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CAPS, setPlatform, type Platform } from "../platform";
import { DEFAULT_CANVAS_CONFIG } from "../types/canvas";
import { DEFAULT_SUBTITLE_CONFIG } from "../types/subtitle";
import { useClipJobs, type ClipJobParams } from "./useClipJobs";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function makeParams(overrides: Partial<ClipJobParams> = {}): ClipJobParams {
  return {
    aiMode: "manual",
    inputType: "url",
    url: "",
    localFile: null,
    provider: "openai",
    apiKey: "sk-test",
    customBaseUrl: "",
    customModelName: "",
    model: "gpt-4o",
    aspectRatio: "9:16",
    trackingMode: "auto",
    faceTrackingEngine: "haar",
    captionStyle: "single_word",
    burnSubtitles: true,
    canvasConfig: DEFAULT_CANVAS_CONFIG,
    subtitleConfig: DEFAULT_SUBTITLE_CONFIG,
    outputFolder: "",
    quality: "best",
    title: "",
    enableBroll: false,
    enableHook: false,
    pexelsApiKey: "",
    notify: vi.fn(),
    closeHistory: vi.fn(),
    maxClips: 0,
    isGamingVideo: false,
    whisperModel: "small",
    ...overrides,
  };
}

let latest: ReturnType<typeof useClipJobs>;
function Probe({ params }: { params: ClipJobParams }) {
  const value = useClipJobs(params);
  useEffect(() => {
    latest = value;
  });
  return null;
}

describe("useClipJobs handleResumeJob (Ruling P2)", () => {
  let root: Root;

  beforeEach(() => {
    root = createRoot(document.createElement("div"));
  });

  afterEach(() => {
    act(() => root.unmount());
    setPlatform(null);
    vi.restoreAllMocks();
  });

  function mockPlatform(caps: Platform["caps"]) {
    setPlatform({ caps, setPreventSleep: vi.fn().mockResolvedValue(undefined) } as unknown as Platform);
  }

  it("sends manual_ai on cloud even when stored provider is openai", async () => {
    mockPlatform(CAPS.cloud);
    const post = vi.spyOn(axios, "post").mockResolvedValue({ data: { status: "success", job_id: "j2" } });
    await act(async () => root.render(<Probe params={makeParams({ aiMode: "auto", provider: "openai" })} />));
    await act(async () => latest.handleResumeJob("job-1", "workspace"));
    expect(post).toHaveBeenCalledWith(expect.stringMatching(/\/jobs\/job-1\/resume$/), expect.objectContaining({ provider: "manual_ai" }));
  });

  it("sends manual_ai on desktop when aiMode is manual", async () => {
    mockPlatform(CAPS.desktop);
    const post = vi.spyOn(axios, "post").mockResolvedValue({ data: { status: "success", job_id: "j2" } });
    await act(async () => root.render(<Probe params={makeParams({ aiMode: "manual", provider: "openai" })} />));
    await act(async () => latest.handleResumeJob("job-2", "workspace"));
    expect(post).toHaveBeenCalledWith(expect.stringMatching(/\/jobs\/job-2\/resume$/), expect.objectContaining({ provider: "manual_ai" }));
  });

  it("sends configured provider on desktop when aiMode is auto", async () => {
    mockPlatform(CAPS.desktop);
    const post = vi.spyOn(axios, "post").mockResolvedValue({ data: { status: "success", job_id: "j2" } });
    await act(async () => root.render(<Probe params={makeParams({ aiMode: "auto", provider: "openai" })} />));
    await act(async () => latest.handleResumeJob("job-3", "workspace"));
    expect(post).toHaveBeenCalledWith(expect.stringMatching(/\/jobs\/job-3\/resume$/), expect.objectContaining({ provider: "openai" }));
  });
});
