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

  it("reloads the active workspace result after a single-clip rerender completes (Ruling P8)", async () => {
    vi.useFakeTimers();
    mockPlatform(CAPS.cloud);
    vi.spyOn(axios, "post").mockResolvedValueOnce({ data: { status: "success", job_id: "ws-1" } });
    const get = vi
      .spyOn(axios, "get")
      .mockResolvedValueOnce({
        data: { status: "DONE", failed: 0, clips: [{ path: "C:\\c1.mp4", description: "v1", start: "0", end: "1", subs: true, v: 0 }], metadata: {} },
      })
      .mockResolvedValueOnce({
        data: { status: "DONE", failed: 0, clips: [] },
      })
      .mockResolvedValueOnce({
        data: { clips: [{ path: "C:\\c1.mp4", description: "v2", start: "0", end: "1", subs: true, v: 0 }], metadata: { reloaded: true } },
      });

    await act(async () => root.render(<Probe params={makeParams({ url: "https://youtu.be/abc", title: "My vid", aiMode: "manual" })} />));
    await act(async () => latest.handleGenerate("manual_ai", "My vid"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    expect(latest.resultJobId).toBe("ws-1");

    act(() => latest.handleRerenderClip("clip-job-2"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });

    expect(get).toHaveBeenLastCalledWith(expect.stringMatching(/\/jobs\/ws-1$/));
    expect(latest.clips[0]?.description).toBe("v2");
    expect(latest.jobMeta).toEqual({ reloaded: true });
  });

  it("restores DONE with existing clips when cancelling a single-clip rerender", async () => {
    vi.useFakeTimers();
    mockPlatform(CAPS.cloud);
    const post = vi
      .spyOn(axios, "post")
      .mockResolvedValueOnce({ data: { status: "success", job_id: "ws-1" } })
      .mockResolvedValueOnce({ data: { status: "cancelled" } });
    vi.spyOn(axios, "get").mockResolvedValueOnce({
      data: { status: "DONE", failed: 0, clips: [{ path: "C:\\c1.mp4", description: "v1", start: "0", end: "1", subs: true, v: 0 }], metadata: {} },
    });

    await act(async () => root.render(<Probe params={makeParams({ url: "https://youtu.be/abc", title: "My vid", aiMode: "manual" })} />));
    await act(async () => latest.handleGenerate("manual_ai", "My vid"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    expect(latest.status).toBe("DONE");
    expect(latest.resultJobId).toBe("ws-1");

    act(() => latest.handleRerenderClip("clip-job-2"));
    expect(latest.status).toBe("CROPPING");
    expect(latest.makePhase).toBe(true);

    await act(async () => latest.cancelJob());
    expect(post).toHaveBeenLastCalledWith(expect.stringMatching(/\/jobs\/clip-job-2\/cancel$/));
    expect(latest.status).toBe("DONE");
    expect(latest.makePhase).toBe(false);
    expect(latest.clips).toHaveLength(1);
    expect(latest.resultJobId).toBe("ws-1");
  });

  it("clears partial clips and returns to IDLE when cancelling an initial job", async () => {
    vi.useFakeTimers();
    mockPlatform(CAPS.cloud);
    const post = vi
      .spyOn(axios, "post")
      .mockResolvedValueOnce({ data: { status: "success", job_id: "ws-part" } })
      .mockResolvedValueOnce({ data: { status: "cancelled" } });
    vi.spyOn(axios, "get").mockResolvedValue({
      data: {
        status: "CROPPING",
        clips: [{ path: "C:\\p1.mp4", description: "partial", start: "0", end: "1", subs: true, v: 0 }],
        metadata: { aspect_ratio: "9:16" },
      },
    });

    await act(async () => root.render(<Probe params={makeParams({ url: "https://youtu.be/abc", title: "My vid", aiMode: "manual" })} />));
    await act(async () => latest.handleGenerate("manual_ai", "My vid"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    expect(latest.status).toBe("CROPPING");
    expect(latest.clips).toHaveLength(1);

    await act(async () => latest.cancelJob());
    expect(post).toHaveBeenLastCalledWith(expect.stringMatching(/\/jobs\/ws-part\/cancel$/));
    expect(latest.status).toBe("IDLE");
    expect(latest.clips).toEqual([]);
    expect(latest.failedCount).toBe(0);
    expect(latest.jobMeta).toBeNull();
    expect(latest.liveMeta).toBeNull();
    expect(latest.makePhase).toBe(false);
  });

  it("clears partial clips when polling receives CANCELLED", async () => {
    vi.useFakeTimers();
    mockPlatform(CAPS.cloud);
    vi.spyOn(axios, "post").mockResolvedValueOnce({ data: { status: "success", job_id: "ws-poll-cancel" } });
    vi.spyOn(axios, "get")
      .mockResolvedValueOnce({
        data: {
          status: "CROPPING",
          clips: [{ path: "C:\\p1.mp4", description: "partial", start: "0", end: "1", subs: true, v: 0 }],
          metadata: { aspect_ratio: "9:16" },
        },
      })
      .mockResolvedValueOnce({ data: { status: "CANCELLED" } });

    await act(async () => root.render(<Probe params={makeParams({ url: "https://youtu.be/abc", title: "My vid", aiMode: "manual" })} />));
    await act(async () => latest.handleGenerate("manual_ai", "My vid"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    expect(latest.clips).toHaveLength(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    expect(latest.status).toBe("IDLE");
    expect(latest.clips).toEqual([]);
    expect(latest.liveMeta).toBeNull();
    expect(latest.makePhase).toBe(false);
  });

  it("watchJob follows a running job started elsewhere and shows its clips when it finishes", async () => {
    vi.useFakeTimers();
    mockPlatform(CAPS.local);
    const get = vi.spyOn(axios, "get")
      .mockResolvedValueOnce({ data: { status: "TRANSCRIBING", current: { stage: "transcribe", started_at: 1 }, metadata: {} } })
      .mockResolvedValueOnce({
        data: { status: "DONE", failed: 0, clips: [{ path: "C:/c1.mp4", description: "d", start: "0", end: "1", subs: true, v: 0 }], metadata: {} },
      });
    await act(async () => root.render(<Probe params={makeParams()} />));
    act(() => latest.watchJob("other-tab-job"));
    expect(latest.isRunning).toBe(true);
    expect(latest.activeJobId).toBe("other-tab-job");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    expect(get).toHaveBeenCalledWith(expect.stringMatching(/\/jobs\/other-tab-job$/));
    expect(latest.status).toBe("TRANSCRIBING");
    expect(latest.current?.stage).toBe("transcribe");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    expect(latest.status).toBe("DONE");
    expect(latest.clips).toHaveLength(1);
  });

  it("watchJob leaves a job that is already followed alone", async () => {
    mockPlatform(CAPS.cloud);
    vi.spyOn(axios, "post").mockResolvedValueOnce({ data: { status: "success", job_id: "mine" } });
    await act(async () => root.render(<Probe params={makeParams({ url: "https://youtu.be/abc", title: "t" })} />));
    await act(async () => latest.handleGenerate("manual_ai", "t"));
    act(() => latest.watchJob("someone-else"));
    expect(latest.activeJobId).toBe("mine");
  });
});

describe("useClipJobs handleManualGenerate overrides (Task 14 downloader)", () => {
  let root: Root;

  beforeEach(() => {
    root = createRoot(document.createElement("div"));
    setPlatform({
      caps: CAPS.desktop,
      askNotifyPermission: vi.fn(),
      setPreventSleep: vi.fn().mockResolvedValue(undefined),
    } as unknown as Platform);
  });

  afterEach(() => {
    act(() => root.unmount());
    setPlatform(null);
    vi.restoreAllMocks();
  });

  it("sends the title and quality passed in, not the ones in app state", async () => {
    const post = vi.spyOn(axios, "post").mockResolvedValue({ data: { status: "success", job_id: "dl1" } });
    await act(async () => root.render(<Probe params={makeParams({ title: "", quality: "best" })} />));
    await act(async () => latest.handleManualGenerate("https://youtu.be/abc", [], true, "  YouTube 2026-11-23  ", "720p"));
    expect(post).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0][0]).toMatch(/\/jobs\/manual$/);
    expect(post.mock.calls[0][1]).toMatchObject({ url: "https://youtu.be/abc", clips: [], title: "YouTube 2026-11-23", quality: "720p" });
  });

  it("still falls back to the app state title and quality without overrides", async () => {
    const post = vi.spyOn(axios, "post").mockResolvedValue({ data: { status: "success", job_id: "dl2" } });
    await act(async () => root.render(<Probe params={makeParams({ title: "Podcast", quality: "1080p" })} />));
    await act(async () => latest.handleManualGenerate("https://youtu.be/abc", [{ start: 0, end: 5 }]));
    expect(post.mock.calls[0][1]).toMatchObject({ title: "Podcast", quality: "1080p" });
  });

  it("replaces the whole Buat klip look when a look is passed", async () => {
    const post = vi.spyOn(axios, "post").mockResolvedValue({ data: { status: "success", job_id: "dl3" } });
    await act(async () =>
      root.render(<Probe params={makeParams({ aspectRatio: "9:16", burnSubtitles: true, isGamingVideo: true, captionStyle: "karaoke" })} />),
    );
    const look = {
      aspectRatio: "16:9",
      burnSubtitles: false,
      captionStyle: "single_word",
      canvasConfig: DEFAULT_CANVAS_CONFIG,
      subtitleConfig: DEFAULT_SUBTITLE_CONFIG,
      isGamingVideo: false,
      trackingMode: "auto",
    };
    await act(async () => latest.handleManualGenerate("https://youtu.be/abc", [], true, "Dl", "best", look));
    expect(post.mock.calls[0][1]).toMatchObject({
      aspect_ratio: "16:9",
      burn_subs: false,
      caption_style: "single_word",
      is_gaming_video: false,
      tracking_mode: "auto",
      canvas_config: DEFAULT_CANVAS_CONFIG,
      subtitle_config: DEFAULT_SUBTITLE_CONFIG,
    });
  });

  it("refuses to start without any title", async () => {
    const notify = vi.fn();
    const post = vi.spyOn(axios, "post");
    await act(async () => root.render(<Probe params={makeParams({ title: "", notify })} />));
    await act(async () => latest.handleManualGenerate("https://youtu.be/abc", [], true, "   "));
    expect(post).not.toHaveBeenCalled();
    expect(notify).toHaveBeenCalledWith(expect.any(String), "error");
  });
});
