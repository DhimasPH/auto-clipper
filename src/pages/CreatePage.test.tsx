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
});
