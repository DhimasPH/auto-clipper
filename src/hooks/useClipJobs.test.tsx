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
    vi.useRealTimers();
    vi.restoreAllMocks();
    window.location.hash = "";
  });

  function mockPlatform(caps: Platform["caps"]) {
    setPlatform({
      caps,
      setPreventSleep: vi.fn().mockResolvedValue(undefined),
      askNotifyPermission: vi.fn(),
    } as unknown as Platform);
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

  it("sets awaiting on AWAITING_MANUAL when on Create route even if jobOrigin was history (P9) and submits AI answer", async () => {
    vi.useFakeTimers();
    window.location.hash = "#/";
    mockPlatform(CAPS.cloud);
    const notify = vi.fn();
    vi.spyOn(axios, "post")
      .mockResolvedValueOnce({ data: { status: "success", job_id: "job-aw" } })
      .mockResolvedValueOnce({ data: { status: "success", job_id: "job-aw" } });
    vi.spyOn(axios, "get").mockResolvedValue({
      data: { status: "AWAITING_MANUAL", metadata: { manual_prompt: "PROMPT", title: "Vid" } },
    });

    await act(async () => root.render(<Probe params={makeParams({ notify, pexelsApiKey: "px-1" })} />));
    await act(async () => latest.handleResumeJob("job-aw", "history"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });

    expect(notify).toHaveBeenCalledWith(expect.any(String), "success");
    expect(latest.awaiting).toEqual({ jobId: "job-aw", prompt: "PROMPT", title: "Vid" });

    await act(async () => latest.submitAiAnswer('{"highlights":[]}'));
    expect(axios.post).toHaveBeenLastCalledWith(
      expect.stringMatching(/\/jobs\/job-aw\/resume-manual$/),
      { json_payload: '{"highlights":[]}', pexels_api_key: "px-1" },
    );
    expect(latest.awaiting).toBeNull();
    expect(latest.status).toBe("PENDING");
    expect(latest.makePhase).toBe(true);
  });

  it("keeps awaiting null when AWAITING_MANUAL arrives while viewing #/riwayat (P9)", async () => {
    vi.useFakeTimers();
    window.location.hash = "#/riwayat";
    mockPlatform(CAPS.cloud);
    const notify = vi.fn();
    vi.spyOn(axios, "post").mockResolvedValueOnce({ data: { status: "success", job_id: "job-hist" } });
    vi.spyOn(axios, "get").mockResolvedValue({
      data: { status: "AWAITING_MANUAL", metadata: { manual_prompt: "PROMPT", title: "Vid" } },
    });

    await act(async () => root.render(<Probe params={makeParams({ notify })} />));
    await act(async () => latest.handleResumeJob("job-hist", "history"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });

    expect(notify).toHaveBeenCalledWith(expect.any(String), "success");
    expect(latest.awaiting).toBeNull();
  });

  it("preserves awaiting and sets answerError when submitAiAnswer fails", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    mockPlatform(CAPS.cloud);
    vi.spyOn(axios, "post").mockRejectedValueOnce(new Error("network down"));

    await act(async () => root.render(<Probe params={makeParams()} />));
    act(() => latest.openAwaiting({ id: "job-err", metadata: { manual_prompt: "P", title: "T" } }));
    await act(async () => latest.submitAiAnswer('{"highlights":[]}'));

    expect(consoleError).toHaveBeenCalled();
    expect(latest.awaiting).toEqual({ jobId: "job-err", prompt: "P", title: "T" });
    expect(latest.answerError?.message).toBe("network down");
  });

  it("clears stale awaiting and answerError when handleResumeJob or handleRerender starts another job", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    mockPlatform(CAPS.cloud);
    vi.spyOn(axios, "post")
      .mockRejectedValueOnce(new Error("first submit failed"))
      .mockResolvedValueOnce({ data: { status: "success", job_id: "job-2" } })
      .mockResolvedValueOnce({ data: { status: "success", job_id: "job-3" } });

    await act(async () => root.render(<Probe params={makeParams()} />));
    act(() => latest.openAwaiting({ id: "job-1", metadata: { manual_prompt: "P", title: "T" } }));
    await act(async () => latest.submitAiAnswer('{"highlights":[]}'));
    expect(latest.answerError).not.toBeNull();

    await act(async () => latest.handleResumeJob("job-2", "history"));
    expect(latest.awaiting).toBeNull();
    expect(latest.answerError).toBeNull();

    act(() => latest.openAwaiting({ id: "job-1", metadata: { manual_prompt: "P", title: "T" } }));
    await act(async () => latest.handleRerender("job-3", "9:16", "single_word", true));
    expect(latest.awaiting).toBeNull();
    expect(latest.answerError).toBeNull();
    expect(consoleError).toHaveBeenCalled();
  });
});
