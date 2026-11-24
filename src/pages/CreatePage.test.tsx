import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import axios from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppContext } from "../App";
import { BackendStatusContext } from "../hooks/useBackendStatus";
import i18n from "../i18n";
import { DEFAULT_CLIP_CHOICES } from "../lib/clipChoices";
import { CAPS, setPlatform, type Platform } from "../platform";
import { CreatePage } from "./CreatePage";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function makeContext(overrides: Record<string, unknown> = {}) {
  return {
    status: "IDLE",
    isRunning: false,
    current: null,
    liveMeta: null,
    awaiting: null,
    makePhase: false,
    queuePosition: null,
    cancelJob: vi.fn(),
    clips: [],
    failedCount: 0,
    resultJobId: "",
    errorMsg: "",
    errorInfo: null,
    failedJobId: null,
    pendingLocalUpload: false,
    clearPendingLocalUpload: vi.fn(),
    requestDriveBrowser: vi.fn(),
    inputType: "url",
    setInputType: vi.fn(),
    url: "",
    setUrl: vi.fn(),
    localFile: null,
    setLocalFile: vi.fn(),
    choices: DEFAULT_CLIP_CHOICES,
    patchChoices: vi.fn(),
    title: "",
    setTitle: vi.fn(),
    quality: "best",
    setQuality: vi.fn(),
    apiKeys: {},
    aiMode: "manual",
    provider: "openai",
    handleGenerate: vi.fn(),
    whisperModel: "small",
    setWhisperModel: vi.fn(),
    openCookies: vi.fn(),
    requestLocalUpload: vi.fn(),
    handleResumeJob: vi.fn(),
    ...overrides,
  };
}

describe("CreatePage (Step 1 integration)", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    setPlatform(null);
    vi.restoreAllMocks();
  });

  async function renderPage(ctxOverrides: Record<string, unknown> = {}, backendStatus: "connected" | "disconnected" = "connected") {
    const ctx = makeContext(ctxOverrides);
    await act(async () =>
      root.render(
        <MemoryRouter>
          <BackendStatusContext.Provider value={{ status: backendStatus, reconnect: vi.fn() }}>
            <AppContext.Provider value={ctx}>
              <CreatePage />
            </AppContext.Provider>
          </BackendStatusContext.Provider>
        </MemoryRouter>,
      ),
    );
    return ctx;
  }

  const startButton = () => [...container.querySelectorAll("button")].find((b) => b.textContent === i18n.t("create.start"))!;

  it("shows chosen localFile name and starts with auto title + manual_ai on click", async () => {
    setPlatform({ caps: CAPS.desktop, pickVideo: vi.fn() } as unknown as Platform);
    vi.spyOn(axios, "get").mockResolvedValue({ data: { checks: [] } });
    const file = new File(["video"], "podcast.mp4", { type: "video/mp4" });
    const handleGenerate = vi.fn();
    await renderPage({ inputType: "local", localFile: file, handleGenerate, aiMode: "manual", provider: "openai" });

    expect(container.textContent).toContain(i18n.t("create.chosen_file", { name: "podcast.mp4" }));
    const btn = startButton();
    expect(btn.disabled).toBe(false);
    act(() => btn.click());
    expect(handleGenerate).toHaveBeenCalledWith("manual_ai", expect.stringMatching(/^podcast \d{4}-\d{2}-\d{2} \d{2}\.\d{2}\.\d{2}$/));
  });

  it("disables Start when preflight returns a blocking error", async () => {
    setPlatform({ caps: CAPS.desktop, pickVideo: vi.fn() } as unknown as Platform);
    vi.spyOn(axios, "get").mockResolvedValue({
      data: { checks: [{ id: "ffmpeg", level: "block", code: "FFMPEG_MISSING", title: "FFmpeg tidak ada", message: "Pasang ulang." }] },
    });
    await renderPage({ url: "https://youtu.be/abc123" });

    expect(container.querySelector('[role="alert"]')?.textContent).toContain("FFmpeg tidak ada");
    expect(startButton().disabled).toBe(true);
  });

  it("focuses the file picker button when pendingLocalUpload is true", async () => {
    setPlatform({ caps: CAPS.desktop, pickVideo: vi.fn() } as unknown as Platform);
    vi.spyOn(axios, "get").mockResolvedValue({ data: { checks: [] } });
    const clearPendingLocalUpload = vi.fn();
    await renderPage({ pendingLocalUpload: true, clearPendingLocalUpload });

    const pickBtn = [...container.querySelectorAll("button")].find((b) => b.textContent === i18n.t("create.pick_file"))!;
    expect(document.activeElement).toBe(pickBtn);
    expect(clearPendingLocalUpload).toHaveBeenCalledTimes(1);
  });

  it("uses liveMeta tracking settings over workspace choices in ProgressPanel (Ruling P16)", async () => {
    setPlatform({ caps: CAPS.desktop, pickVideo: vi.fn() } as unknown as Platform);
    vi.spyOn(axios, "get").mockResolvedValue({ data: { checks: [] } });

    // 1. liveMeta aspect_ratio 16:9 overrides choices (9:16 + auto) -> tracking omitted
    await renderPage({
      status: "CROPPING",
      isRunning: true,
      makePhase: true,
      current: null,
      liveMeta: { aspect_ratio: "16:9", tracking_mode: "auto", timings: [] },
      choices: { ...DEFAULT_CLIP_CHOICES, aspectRatio: "9:16", trackingMode: "auto" },
    });
    expect(container.textContent).toContain(i18n.t("timing.stage_render"));
    expect(container.textContent).not.toContain(i18n.t("timing.stage_tracking"));

    // 2. liveMeta tracking_mode center overrides choices (9:16 + auto) -> tracking omitted
    await renderPage({
      status: "CROPPING",
      isRunning: true,
      makePhase: true,
      current: null,
      liveMeta: { aspect_ratio: "9:16", tracking_mode: "center", timings: [] },
      choices: { ...DEFAULT_CLIP_CHOICES, aspectRatio: "9:16", trackingMode: "auto" },
    });
    expect(container.textContent).toContain(i18n.t("timing.stage_render"));
    expect(container.textContent).not.toContain(i18n.t("timing.stage_tracking"));

    // 3. liveMeta enables tracking (9:16 + auto) while choices disables it (16:9 + center) -> tracking shown
    await renderPage({
      status: "CROPPING",
      isRunning: true,
      makePhase: true,
      current: null,
      liveMeta: { aspect_ratio: "9:16", tracking_mode: "auto", timings: [] },
      choices: { ...DEFAULT_CLIP_CHOICES, aspectRatio: "16:9", trackingMode: "center" },
    });
    expect(container.textContent).toContain(i18n.t("timing.stage_tracking"));
  });

  it("renders ProgressPanel above partial ClipsResult while running with existing clips (Ruling P16)", async () => {
    setPlatform({ caps: CAPS.local, saveClips: vi.fn(), saveClip: vi.fn(), openFolder: vi.fn() } as unknown as Platform);
    vi.spyOn(axios, "get").mockResolvedValue({ data: { checks: [] } });
    await renderPage({
      status: "CROPPING",
      isRunning: true,
      makePhase: true,
      current: { stage: "render", started_at: 1, elapsed_seconds: 3, clip: 1, clips_total: 2 },
      clips: [{ path: "C:\\clip_1.mp4", video_url: "/video?p=1&sig=s", description: "Clip A", start: "00:00:00", end: "00:00:15", subs: true, v: 0 }],
    });

    const text = container.textContent!;
    expect(text.indexOf(i18n.t("progress.title_make"))).toBeLessThan(text.indexOf("Clip A"));
  });

  // SP3 4.3 (Ruling P9): the CPU question appears only for medium/large-v3 when the gpu check warns.
  const GPU_WARN = { data: { checks: [{ id: "gpu", level: "warn", code: "NO_GPU_SLOW", title: "Subtitle memakai prosesor", message: "Lambat." }] } };
  const GPU_OK = { data: { checks: [{ id: "gpu", level: "ok", title: "GPU aktif", message: "Cepat." }] } };
  const buttonByText = (text: string) => [...container.querySelectorAll("button")].find((b) => b.textContent === text);

  it("asks before starting medium on the processor; Use Fast switches to small and starts with it", async () => {
    setPlatform({ caps: CAPS.desktop, pickVideo: vi.fn() } as unknown as Platform);
    vi.spyOn(axios, "get").mockResolvedValue(GPU_WARN);
    const file = new File(["video"], "podcast.mp4", { type: "video/mp4" });
    const handleGenerate = vi.fn();
    const setWhisperModel = vi.fn();
    await renderPage({ inputType: "local", localFile: file, whisperModel: "medium", setWhisperModel, handleGenerate });

    act(() => startButton().click());
    expect(handleGenerate).not.toHaveBeenCalled();
    const dialog = container.querySelector('[role="dialog"]')!;
    expect(dialog.textContent).toContain(i18n.t("create.cpu_model_title"));
    expect(dialog.textContent).toContain(i18n.t("create.cpu_model_body"));
    const fast = buttonByText(i18n.t("create.cpu_model_use_fast"))!;
    expect(document.activeElement).toBe(fast);

    act(() => fast.click());
    expect(setWhisperModel).toHaveBeenCalledWith("small");
    expect(handleGenerate).toHaveBeenCalledTimes(1);
    expect(handleGenerate).toHaveBeenCalledWith("manual_ai", expect.stringMatching(/^podcast /), "small");
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it("Keep Accurate starts with the chosen model and leaves the setting alone", async () => {
    setPlatform({ caps: CAPS.desktop, pickVideo: vi.fn() } as unknown as Platform);
    vi.spyOn(axios, "get").mockResolvedValue(GPU_WARN);
    const file = new File(["video"], "short.mp4", { type: "video/mp4" });
    const handleGenerate = vi.fn();
    const setWhisperModel = vi.fn();
    await renderPage({ inputType: "local", localFile: file, whisperModel: "large-v3", setWhisperModel, handleGenerate });

    act(() => startButton().click());
    act(() => buttonByText(i18n.t("create.cpu_model_keep_accurate"))!.click());
    expect(setWhisperModel).not.toHaveBeenCalled();
    expect(handleGenerate).toHaveBeenCalledTimes(1);
    expect(handleGenerate).toHaveBeenCalledWith("manual_ai", expect.stringMatching(/^short /), "large-v3");
  });

  it("closing the CPU question with Escape starts nothing", async () => {
    setPlatform({ caps: CAPS.desktop, pickVideo: vi.fn() } as unknown as Platform);
    vi.spyOn(axios, "get").mockResolvedValue(GPU_WARN);
    const handleGenerate = vi.fn();
    const setWhisperModel = vi.fn();
    await renderPage({ url: "https://youtu.be/abc123", whisperModel: "medium", setWhisperModel, handleGenerate });

    act(() => startButton().click());
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(handleGenerate).not.toHaveBeenCalled();
    expect(setWhisperModel).not.toHaveBeenCalled();
  });

  it("starts medium straight away when the gpu check is ok (cloud with a working GPU too)", async () => {
    for (const caps of [CAPS.desktop, CAPS.cloud]) {
      setPlatform({ caps, pickVideo: vi.fn() } as unknown as Platform);
      vi.spyOn(axios, "get").mockResolvedValue(GPU_OK);
      const handleGenerate = vi.fn();
      await renderPage({ url: "https://youtu.be/abc123", whisperModel: "medium", handleGenerate });

      act(() => startButton().click());
      expect(container.querySelector('[role="dialog"]')).toBeNull();
      // Ruling P9: a direct start keeps the two-argument call.
      expect(handleGenerate).toHaveBeenCalledWith("manual_ai", expect.any(String));
      expect(handleGenerate.mock.calls[0]).toHaveLength(2);
    }
  });

  it("starts small straight away even when the gpu check warns", async () => {
    setPlatform({ caps: CAPS.desktop, pickVideo: vi.fn() } as unknown as Platform);
    vi.spyOn(axios, "get").mockResolvedValue(GPU_WARN);
    const handleGenerate = vi.fn();
    await renderPage({ url: "https://youtu.be/abc123", whisperModel: "small", handleGenerate });

    act(() => startButton().click());
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(handleGenerate.mock.calls[0]).toHaveLength(2);
  });
});
