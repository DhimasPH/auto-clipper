import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../i18n";
import { AppContext } from "../App";
import { CAPS, setPlatform, type Platform } from "../platform";
import { apiCorrectSubtitle, apiCreateClipRerenderJob, apiGetClipWords } from "../api";
import { DEFAULT_CANVAS_CONFIG, type CanvasConfig } from "../types/canvas";
import { DEFAULT_SUBTITLE_CONFIG, type SubtitleConfig } from "../types/subtitle";
import { ClipEditModal } from "./ClipEditModal";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("../api", () => ({
  apiGetClipWords: vi.fn(),
  apiCorrectSubtitle: vi.fn(),
  apiCreateClipRerenderJob: vi.fn(),
}));

const WORDS = [
  { word: "halo", start: 0, end: 0.4 },
  { word: "semua", start: 0.4, end: 0.9 },
];
const CANVAS: CanvasConfig = { ...DEFAULT_CANVAS_CONFIG, enabled: true, background_type: "color", background_color: "#112233" };
const SUBTITLE: SubtitleConfig = { ...DEFAULT_SUBTITLE_CONFIG, style: "karaoke", text_color: "#00FF00", watermark_text: "@kanalku" };

const setValue = (el: HTMLInputElement | HTMLTextAreaElement, value: string) => {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
};

describe("ClipEditModal (Ubah subtitle atau tampilan)", () => {
  let container: HTMLDivElement;
  let root: Root;
  let onClose: ReturnType<typeof vi.fn<() => void>>;
  let onRerenderStart: ReturnType<typeof vi.fn<(id: string) => void>>;

  beforeEach(async () => {
    await i18n.changeLanguage("id");
    setPlatform({ caps: CAPS.local } as unknown as Platform);
    vi.mocked(apiGetClipWords).mockResolvedValue({ words: WORDS.map((w) => ({ ...w })) });
    onClose = vi.fn<() => void>();
    onRerenderStart = vi.fn<(id: string) => void>();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    setPlatform(null);
    vi.resetAllMocks();
  });

  const render = async (ctx: Record<string, unknown> = { aiMode: "manual" }) => {
    await act(async () =>
      root.render(
        <AppContext.Provider value={ctx}>
          <ClipEditModal
            jobId="job-1"
            clipIndex={2}
            clipTitle="Klip 3"
            initialAspectRatio="16:9"
            initialCanvasConfig={CANVAS}
            initialSubtitleConfig={SUBTITLE}
            initialTrackingMode="center"
            initialFaceTrackingEngine="mediapipe"
            initialBurnSubs={true}
            onClose={onClose}
            onRerenderStart={onRerenderStart}
          />
        </AppContext.Provider>,
      ),
    );
  };
  const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]')!;
  const button = (text: string) =>
    [...dialog().querySelectorAll("button")].find((b) => b.textContent?.trim() === text) as HTMLButtonElement | undefined;
  const wordInput = (value: string) =>
    [...dialog().querySelectorAll<HTMLInputElement>('input[type="text"]')].find((i) => i.value === value)!;

  it("loads the words of this clip and sends every choice with the changed words", async () => {
    vi.mocked(apiCreateClipRerenderJob).mockResolvedValueOnce({ status: "success", job_id: "rerender-9" });
    await render();
    expect(apiGetClipWords).toHaveBeenCalledWith("job-1", 2);

    await act(async () => setValue(wordInput("halo"), "hai"));
    await act(async () => button(i18n.t("clip_rerender.save_rerender"))!.click());

    expect(apiCreateClipRerenderJob).toHaveBeenCalledTimes(1);
    expect(vi.mocked(apiCreateClipRerenderJob).mock.calls[0]).toEqual([
      "job-1",
      2,
      {
        words: [{ word: "hai", start: 0, end: 0.4 }, WORDS[1]],
        aspect_ratio: "16:9",
        tracking_mode: "center",
        face_tracking_engine: "mediapipe",
        caption_style: "karaoke",
        burn_subs: true,
        canvas_config: CANVAS,
        subtitle_config: SUBTITLE,
      },
    ]);
    expect(onRerenderStart).toHaveBeenCalledWith("rerender-9");
  });

  it("hides Perbaiki otomatis in the manual AI mode even with a saved key", async () => {
    await render({ aiMode: "manual", provider: "gemini", apiKeys: { gemini: "k-123" } });
    expect(button(i18n.t("clip_rerender.auto_btn"))).toBeUndefined();
    expect(apiCorrectSubtitle).not.toHaveBeenCalled();
  });

  it("hides Perbaiki otomatis where API keys are not allowed (cloud)", async () => {
    setPlatform({ caps: CAPS.cloud } as unknown as Platform);
    await render({ aiMode: "auto", provider: "gemini", apiKeys: { gemini: "k-123" } });
    expect(button(i18n.t("clip_rerender.auto_btn"))).toBeUndefined();
  });

  it("in the API key mode sends the words with the key from settings and uses the corrected words", async () => {
    vi.mocked(apiCorrectSubtitle).mockResolvedValueOnce({
      status: "success",
      words: [{ word: "Halo", start: 0, end: 0.4 }, { word: "semua.", start: 0.4, end: 0.9 }],
    });
    vi.mocked(apiCreateClipRerenderJob).mockResolvedValueOnce({ job_id: "rerender-10" });
    await render({ aiMode: "auto", provider: "gemini", apiKeys: { gemini: "k-123" }, selectedModel: "gemini-3.6-flash" });

    await act(async () => button(i18n.t("clip_rerender.auto_btn"))!.click());
    expect(apiCorrectSubtitle).toHaveBeenCalledWith({
      words: WORDS,
      provider: "gemini",
      api_key: "k-123",
      model: "gemini-3.6-flash",
      custom_base_url: "",
      custom_model_name: "",
    });
    expect(dialog().querySelector('[role="status"]')?.textContent).toBe(i18n.t("clip_rerender.auto_done"));
    expect(wordInput("semua.")).toBeTruthy();

    await act(async () => button(i18n.t("clip_rerender.save_rerender"))!.click());
    expect(vi.mocked(apiCreateClipRerenderJob).mock.calls[0][2].words.map((w: { word: string }) => w.word)).toEqual(["Halo", "semua."]);
  });

  it("Batal closes at once when nothing changed", async () => {
    await render();
    await act(async () => button(i18n.t("common.cancel"))!.click());
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("Batal asks first after a word was changed, like Escape and the close button", async () => {
    await render();
    await act(async () => setValue(wordInput("halo"), "hai"));
    await act(async () => button(i18n.t("common.cancel"))!.click());
    expect(onClose).not.toHaveBeenCalled();
    expect(dialog().querySelector('[role="alert"]')?.textContent).toContain(i18n.t("dialog.discard_question"));

    await act(async () => button(i18n.t("dialog.discard"))!.click());
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("Escape in the search box only clears the search", async () => {
    await render();
    const search = dialog().querySelector<HTMLInputElement>('input[type="search"]')!;
    await act(async () => {
      search.focus();
      setValue(search, "hal");
    });
    await act(async () => {
      search.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    });
    expect(search.value).toBe("");
    expect(onClose).not.toHaveBeenCalled();
    expect(dialog().querySelector('[role="alert"]')).toBeNull();

    // With the search already empty, Escape closes the dialog as usual.
    await act(async () => {
      search.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("says the app did not answer when the request never reached it", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(apiCreateClipRerenderJob).mockRejectedValueOnce({ message: "Network Error" });
    await render();
    await act(async () => button(i18n.t("clip_rerender.save_rerender"))!.click());
    const alert = dialog().querySelector('[role="alert"]')!;
    expect(alert.textContent).toContain(i18n.t("clip_rerender.save_failed"));
    expect(alert.textContent).toContain("Network Error");
  });

  it("says the app refused the request when it answered with an error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(apiCreateClipRerenderJob).mockRejectedValueOnce({
      message: "Request failed with status code 403",
      response: { status: 403, data: { message: "Path is outside the allowed folders" } },
    });
    await render();
    await act(async () => button(i18n.t("clip_rerender.save_rerender"))!.click());
    const alert = dialog().querySelector('[role="alert"]')!;
    expect(alert.textContent).toContain(i18n.t("clip_rerender.save_refused"));
    expect(alert.textContent).not.toContain(i18n.t("clip_rerender.save_failed"));
    expect(alert.textContent).toContain("Path is outside the allowed folders");
  });
});
