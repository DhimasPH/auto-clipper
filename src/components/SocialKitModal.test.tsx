import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import axios from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../i18n";
import { AppContext } from "../App";
import { CAPS, setPlatform, type Platform } from "../platform";
import { setApiUrl } from "../platform/backendUrl";
import { copyText } from "../lib/clipboard";
import type { Clip } from "./ClipCard";
import { SocialKitModal } from "./SocialKitModal";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("axios", () => ({ default: { post: vi.fn() } }));
vi.mock("../lib/clipboard", () => ({ copyText: vi.fn() }));

const API = "http://127.0.0.1:5123";
const CLIP = {
  path: "C:/klip/clip_1.mp4",
  video_url: "/video?p=clip_1",
  description: "Momen lucu",
  description_id: "Pembicara bercerita soal kucingnya.",
  description_en: "The speaker talks about the cat.",
  start: "00:00:10",
  end: "00:00:40",
  subs: true,
  v: 0,
} as unknown as Clip;

describe("SocialKitModal (Bagikan)", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    await i18n.changeLanguage("id");
    setApiUrl(API);
    setPlatform({ caps: CAPS.local } as unknown as Platform);
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

  const render = async (ctx: Record<string, unknown>, clip: Clip = CLIP, onUpdate = vi.fn()) => {
    await act(async () =>
      root.render(
        <AppContext.Provider value={ctx}>
          <SocialKitModal isOpen onClose={vi.fn()} clip={clip} jobId="job-7" clipIndex={1} onUpdate={onUpdate} />
        </AppContext.Provider>,
      ),
    );
    return onUpdate;
  };
  const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]')!;
  const button = (text: string) =>
    [...dialog().querySelectorAll("button")].find((b) => b.textContent?.trim() === text) as HTMLButtonElement | undefined;

  it("in the API key mode posts the clip description with the key and model from settings", async () => {
    const social = { titles_id: ["Kucing yang suka kopi"], hashtags_id: ["#kucing"] };
    vi.mocked(axios.post).mockResolvedValueOnce({ data: { status: "success", social } });
    const onUpdate = await render({
      aiMode: "auto",
      provider: "openai",
      apiKeys: { openai: "sk-test" },
      selectedModel: "gpt-4o-mini",
    });

    await act(async () => button(i18n.t("social.generate"))!.click());

    expect(vi.mocked(axios.post).mock.calls[0]).toEqual([
      `${API}/jobs/job-7/clips/1/social`,
      {
        description: "The speaker talks about the cat.",
        provider: "openai",
        api_key: "sk-test",
        custom_base_url: "",
        custom_model_name: "",
        model: "gpt-4o-mini",
      },
    ]);
    expect(onUpdate).toHaveBeenCalledWith(social);
  });

  it("offers no generate button in the manual AI mode, even with a saved key", async () => {
    await render({ aiMode: "manual", provider: "openai", apiKeys: { openai: "sk-test" } });
    expect(button(i18n.t("social.generate"))).toBeUndefined();
    expect(dialog().textContent).toContain(i18n.t("social.empty_needs_key"));
    expect(axios.post).not.toHaveBeenCalled();
  });

  it("offers no generate button in the API key mode without a key", async () => {
    await render({ aiMode: "auto", provider: "openai", apiKeys: {} });
    expect(button(i18n.t("social.generate"))).toBeUndefined();
  });

  it("where keys are not allowed, points at the description it shows", async () => {
    setPlatform({ caps: CAPS.cloud } as unknown as Platform);
    await render({ aiMode: "auto", provider: "openai", apiKeys: { openai: "sk-test" } });
    expect(button(i18n.t("social.generate"))).toBeUndefined();
    expect(dialog().textContent).toContain(i18n.t("social.copy_description"));
    expect(dialog().textContent).toContain(i18n.t("social.empty"));
  });

  it("does not point at a description that is not there", async () => {
    setPlatform({ caps: CAPS.cloud } as unknown as Platform);
    const bare = { ...CLIP, description: "", description_id: "", description_en: "" } as unknown as Clip;
    await render({ aiMode: "manual" }, bare);
    expect(dialog().textContent).not.toContain(i18n.t("social.empty"));
    expect(dialog().textContent).toContain(i18n.t("social.empty_no_text"));
  });

  it("tells a screen reader that the text was copied", async () => {
    vi.mocked(copyText).mockResolvedValueOnce(true);
    await render({ aiMode: "manual" });
    const copy = dialog().querySelector<HTMLButtonElement>(`button[aria-label="${i18n.t("social.copy_description")}"]`)!;
    await act(async () => copy.click());
    expect(copyText).toHaveBeenCalledWith("Pembicara bercerita soal kucingnya.");
    const status = dialog().querySelector('[role="status"]');
    expect(status?.textContent).toBe(i18n.t("social.copied"));
  });
});
