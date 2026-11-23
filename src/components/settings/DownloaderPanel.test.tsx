import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import axios from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../../i18n";
import { AppContext } from "../../App";
import { CAPS, setPlatform, type Platform } from "../../platform";
import type { ErrorInfo } from "../../types/errorInfo";
import { DEFAULT_CANVAS_CONFIG } from "../../types/canvas";
import { DEFAULT_SUBTITLE_CONFIG } from "../../types/subtitle";
import { useClipJobs, type ClipJobParams } from "../../hooks/useClipJobs";
import { downloaderLook } from "../../lib/settingsLayout";
import { DownloaderPanel } from "./DownloaderPanel";

function baseParams(): ClipJobParams {
  return {
    aiMode: "manual", inputType: "url", url: "", localFile: null, provider: "openai", apiKey: "",
    customBaseUrl: "", customModelName: "", model: "", aspectRatio: "9:16", trackingMode: "auto",
    faceTrackingEngine: "haar", captionStyle: "single_word", burnSubtitles: true,
    canvasConfig: DEFAULT_CANVAS_CONFIG, subtitleConfig: DEFAULT_SUBTITLE_CONFIG, outputFolder: "",
    quality: "best", title: "", enableBroll: false, enableHook: false, pexelsApiKey: "", notify: vi.fn(),
    closeHistory: vi.fn(), maxClips: 0, isGamingVideo: false, whisperModel: "small",
  };
}

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const makeCtx = (overrides: Record<string, unknown> = {}) =>
  ({
    quality: "best",
    isRunning: false,
    errorMsg: "",
    errorInfo: null,
    failedJobId: null,
    handleManualGenerate: vi.fn().mockResolvedValue(undefined),
    handleResumeJob: vi.fn(),
    setTitle: vi.fn(),
    setQuality: vi.fn(),
    openCookies: vi.fn(),
    requestLocalUpload: vi.fn(),
    requestDriveBrowser: vi.fn(),
    ...overrides,
  }) as unknown as React.ContextType<typeof AppContext>;

const failure: ErrorInfo = {
  code: "VIDEO_UNAVAILABLE",
  title: "Video tidak bisa diambil",
  message: "Videonya privat atau dihapus. Coba link lain.",
  title_en: "The video cannot be fetched",
  message_en: "It is private or removed. Try another link.",
  actions: [],
  technical: "",
};

function setInput(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  setter.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("DownloaderPanel (spec 4.5, Lanjutan #pengunduh)", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    await i18n.changeLanguage("id");
    setPlatform({ caps: CAPS.desktop } as unknown as Platform);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    setPlatform(null);
    vi.useRealTimers();
  });

  const render = async (ctx: React.ContextType<typeof AppContext>) => {
    await act(async () => {
      root.render(
        <AppContext.Provider value={ctx}>
          <MemoryRouter>
            <DownloaderPanel />
          </MemoryRouter>
        </AppContext.Provider>,
      );
    });
  };

  const inputs = () => [...container.querySelectorAll("input")] as HTMLInputElement[];
  const downloadButton = () =>
    [...container.querySelectorAll("button")].find((b) => b.textContent?.includes("Unduh video")) as HTMLButtonElement;

  it("is the #pengunduh anchor and starts closed", async () => {
    await render(makeCtx());
    const details = container.querySelector("details")!;
    expect(details.id).toBe("pengunduh");
    expect(details.open).toBe(false);
  });

  it("opens when the page is reached through #pengunduh (old /downloader links)", async () => {
    await act(async () => {
      root.render(
        <AppContext.Provider value={makeCtx()}>
          <MemoryRouter initialEntries={["/pengaturan#pengunduh"]}>
            <DownloaderPanel />
          </MemoryRouter>
        </AppContext.Provider>,
      );
    });
    expect(container.querySelector("details")!.open).toBe(true);
  });

  it("starts the download with a made-up name and the chosen quality, leaving app state alone", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 23, 14, 5, 9));
    const ctx = makeCtx();
    await render(ctx);
    const [link] = inputs();
    await act(async () => setInput(link, " https://youtu.be/abc "));
    const select = container.querySelector("select")!;
    await act(async () => {
      select.value = "720p";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await act(async () => downloadButton().click());

    expect(ctx.handleManualGenerate).toHaveBeenCalledWith("https://youtu.be/abc", [], true, "YouTube 2026-11-23 14.05.09", "720p", downloaderLook("16:9", false));
    expect(ctx.setTitle).not.toHaveBeenCalled();
    expect(ctx.setQuality).not.toHaveBeenCalled();
  });

  it("uses the typed project name", async () => {
    const ctx = makeCtx();
    await render(ctx);
    const [link, name] = inputs();
    await act(async () => setInput(link, "https://youtu.be/abc"));
    await act(async () => setInput(name, "  Podcast penuh "));
    await act(async () => downloadButton().click());
    expect(ctx.handleManualGenerate).toHaveBeenCalledWith("https://youtu.be/abc", [], true, "Podcast penuh", "best", downloaderLook("16:9", false));
  });

  it("explains an unsupported link under the field and keeps the button off", async () => {
    const ctx = makeCtx();
    await render(ctx);
    expect(downloadButton().disabled).toBe(true);
    await act(async () => setInput(inputs()[0], "https://example.com/video"));
    expect(container.textContent).toContain("Link ini belum bisa dipakai");
    expect(downloadButton().disabled).toBe(true);
    await act(async () => downloadButton().click());
    expect(ctx.handleManualGenerate).not.toHaveBeenCalled();
  });

  it("shows the error card of a download it started, not errors of other jobs", async () => {
    const ctx = makeCtx({ errorMsg: "boom", errorInfo: failure });
    await render(ctx);
    expect(container.textContent).not.toContain("Video tidak bisa diambil");

    await act(async () => setInput(inputs()[0], "https://youtu.be/abc"));
    await act(async () => downloadButton().click());
    expect(container.textContent).toContain("Video tidak bisa diambil");
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
  });

  it("shows a request failure without error_info in plain text", async () => {
    await render(makeCtx({ errorMsg: "Network Error" }));
    await act(async () => setInput(inputs()[0], "https://youtu.be/abc"));
    await act(async () => downloadButton().click());
    const alert = container.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain("Network Error");
  });

  it("says a video is being processed and links to its progress while a job runs", async () => {
    await render(makeCtx({ isRunning: true }));
    expect(container.textContent).toContain("Ada video yang sedang diproses");
    const link = [...container.querySelectorAll("a")].find((a) => a.textContent?.includes("Lihat progres"));
    expect(link?.getAttribute("href")).toBe("/");
    expect(downloadButton().disabled).toBe(true);
  });
});

describe("DownloaderPanel request body (review ruling: own shape and subtitle switch)", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    await i18n.changeLanguage("id");
    setPlatform({
      caps: CAPS.desktop,
      askNotifyPermission: vi.fn(),
      setPreventSleep: vi.fn().mockResolvedValue(undefined),
    } as unknown as Platform);
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

  // Buat klip choices saved as vertical, subtitles on, game layout, canvas on: none may reach the download.
  const savedChoices: Partial<ClipJobParams> = {
    aspectRatio: "9:16",
    burnSubtitles: true,
    captionStyle: "karaoke",
    isGamingVideo: true,
    trackingMode: "center",
    canvasConfig: { ...DEFAULT_CANVAS_CONFIG, enabled: true, background_type: "color" },
    subtitleConfig: { ...DEFAULT_SUBTITLE_CONFIG, style: "karaoke", font_size_scale: 2 },
  };
  const appSetters = {
    patchChoices: vi.fn(),
    setAspectRatio: vi.fn(),
    setBurnSubtitles: vi.fn(),
    setCaptionStyle: vi.fn(),
    setCanvasConfig: vi.fn(),
    setSubtitleConfig: vi.fn(),
    setTitle: vi.fn(),
    setQuality: vi.fn(),
  };

  function Harness() {
    const jobs = useClipJobs({ ...baseParams(), ...savedChoices });
    return (
      <AppContext.Provider value={makeCtx({ ...jobs, ...appSetters, quality: "best" })}>
        <MemoryRouter>
          <DownloaderPanel />
        </MemoryRouter>
      </AppContext.Provider>
    );
  }

  const start = async (pick?: () => void) => {
    const post = vi.spyOn(axios, "post").mockResolvedValue({ data: { status: "success", job_id: "dl" } });
    vi.spyOn(axios, "get").mockResolvedValue({ data: { status: "DOWNLOADING" } });
    await act(async () => root.render(<Harness />));
    await act(async () => setInput(container.querySelector("input")!, "https://youtu.be/abc"));
    if (pick) await act(async () => pick());
    const button = [...container.querySelectorAll("button")].find((b) => b.textContent?.includes("Unduh video"))!;
    await act(async () => button.click());
    expect(post).toHaveBeenCalledTimes(1);
    return post.mock.calls[0][1] as Record<string, unknown>;
  };

  it("by default sends a wide video without subtitles, nothing from Buat klip", async () => {
    const body = await start();
    expect(body).toMatchObject({
      aspect_ratio: "16:9",
      burn_subs: false,
      is_gaming_video: false,
      tracking_mode: "auto",
      canvas_config: DEFAULT_CANVAS_CONFIG,
      subtitle_config: DEFAULT_SUBTITLE_CONFIG,
      caption_style: DEFAULT_SUBTITLE_CONFIG.style,
      clips: [],
    });
    for (const setter of Object.values(appSetters)) expect(setter).not.toHaveBeenCalled();
  });

  it("sends the chosen shape and the subtitle switch", async () => {
    const body = await start(() => {
      const vertical = [...container.querySelectorAll<HTMLInputElement>('input[type="radio"]')].find(
        (r) => r.value === "9:16",
      )!;
      vertical.click();
      container.querySelector<HTMLInputElement>('input[role="switch"]')!.click();
    });
    expect(body).toMatchObject({ aspect_ratio: "9:16", burn_subs: true, is_gaming_video: false });
    for (const setter of Object.values(appSetters)) expect(setter).not.toHaveBeenCalled();
  });
});
