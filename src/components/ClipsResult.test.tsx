import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../i18n";
import { CAPS, setPlatform, type Platform } from "../platform";
import { setApiUrl } from "../platform/backendUrl";
import ClipsResult from "./ClipsResult";

vi.mock("./SocialKitModal", () => ({ SocialKitModal: () => null }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const clip = (n: number) => ({
  path: `C:\\lib\\clip_${n}.mp4`,
  video_url: `/video?p=clip_${n}&sig=s`,
  description: `Momen ${n}`,
  start: "00:00:10",
  end: "00:00:40",
  subs: true,
  v: 0,
});

describe("ClipsResult (spec 4.5)", () => {
  let container: HTMLDivElement;
  let root: Root;
  const saveClips = vi.fn(async () => {});

  beforeEach(() => {
    setApiUrl("http://127.0.0.1:5123");
    setPlatform({ caps: CAPS.local, saveClips, saveClip: vi.fn(), openFolder: vi.fn() } as unknown as Platform);
    container = document.createElement("div");
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    setPlatform(null);
    vi.restoreAllMocks();
  });

  it("downloads every clip with one button above the list", async () => {
    saveClips.mockResolvedValueOnce(undefined);
    act(() => root.render(<ClipsResult clips={[clip(1), clip(2)]} status="DONE" failedCount={0} jobId="j1" />));
    const all = [...container.querySelectorAll("button")].find((b) => b.textContent === i18n.t("result.download_all"))!;
    await act(async () => all.click());
    expect(saveClips).toHaveBeenCalledWith([
      { path: "C:\\lib\\clip_1.mp4", filename: "clip_1.mp4", videoUrl: "http://127.0.0.1:5123/video?p=clip_1&sig=s&dl=1" },
      { path: "C:\\lib\\clip_2.mp4", filename: "clip_2.mp4", videoUrl: "http://127.0.0.1:5123/video?p=clip_2&sig=s&dl=1" },
    ]);
  });

  it("shows an inline alert if saving all clips fails (Ruling P10)", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    saveClips.mockRejectedValueOnce(new Error("blocked"));
    act(() => root.render(<ClipsResult clips={[clip(1), clip(2)]} status="DONE" failedCount={0} jobId="j1" />));
    const all = [...container.querySelectorAll("button")].find((b) => b.textContent === i18n.t("result.download_all"))!;
    await act(async () => all.click());
    expect(consoleError).toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(i18n.t("result.download_all_failed"));
  });

  it("gives every clip Unduh, Bagikan and its duration", () => {
    act(() => root.render(<ClipsResult clips={[clip(1)]} status="DONE" failedCount={0} jobId="j1" />));
    const text = container.textContent!;
    expect(text).toContain(i18n.t("result.download"));
    expect(text).toContain(i18n.t("result.share"));
    expect(text).toContain("0:30");
  });

  it("hides Unduh semua for a single clip and while cropping", () => {
    act(() => root.render(<ClipsResult clips={[clip(1)]} status="DONE" failedCount={0} jobId="j1" />));
    expect(container.textContent).not.toContain(i18n.t("result.download_all"));

    act(() => root.render(<ClipsResult clips={[clip(1), clip(2)]} status="CROPPING" failedCount={0} jobId="j1" />));
    expect(container.textContent).not.toContain(i18n.t("result.download_all"));
  });
});
