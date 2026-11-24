import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import axios from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../../i18n";
import { setApiUrl } from "../../platform/backendUrl";
import { CAPS, setPlatform, type Platform } from "../../platform";
import { TranscriptionSection, type WhisperModelInfo } from "./TranscriptionSection";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("axios", () => ({ default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }));

const API = "http://127.0.0.1:5123";
const model = (id: string, downloaded: boolean): WhisperModelInfo => ({
  id,
  name: id.toUpperCase(),
  disk_size: "500 MB",
  vram: "2 GB",
  description_id: `Model ${id}`,
  description_en: `Model ${id}`,
  downloaded,
});

describe("TranscriptionSection (Lanjutan, model subtitle)", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    await i18n.changeLanguage("id");
    setApiUrl(API);
    setPlatform({ caps: CAPS.desktop } as Platform);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.resetAllMocks();
    setPlatform(null);
  });

  const render = async (whisperModel = "small", addonsEnabled = true) => {
    const setWhisperModel = vi.fn();
    await act(async () =>
      root.render(<TranscriptionSection whisperModel={whisperModel} setWhisperModel={setWhisperModel} addonsEnabled={addonsEnabled} />),
    );
    return setWhisperModel;
  };
  const downloadButton = () =>
    [...container.querySelectorAll("button")].find((b) => b.textContent?.trim() === i18n.t("settings.whisper_download_btn"))!;

  it("downloads a model, reloads the list, then makes the new model the one in use", async () => {
    const order: string[] = [];
    vi.mocked(axios.get)
      .mockResolvedValueOnce({ data: { status: "success", models: [model("small", true), model("medium", false)] } })
      .mockImplementationOnce(async () => {
        order.push("reload");
        return { data: { status: "success", models: [model("small", true), model("medium", true)] } };
      });
    vi.mocked(axios.post).mockImplementationOnce(async () => {
      order.push("download");
      return { data: { status: "success" } };
    });
    const setWhisperModel = await render();
    setWhisperModel.mockImplementation(() => order.push("select"));

    expect(vi.mocked(axios.get).mock.calls[0][0]).toBe(`${API}/api/settings/whisper-models`);
    await act(async () => downloadButton().click());

    expect(vi.mocked(axios.post).mock.calls[0]).toEqual([`${API}/api/settings/whisper-models/download`, { model: "medium" }]);
    expect(order).toEqual(["download", "reload", "select"]);
    expect(setWhisperModel).toHaveBeenCalledWith("medium");
    expect(container.querySelector('[role="status"]')?.textContent).toBe(
      i18n.t("settings.whisper_download_success", { name: "MEDIUM" }),
    );
  });

  it("keeps the current model when the download fails and explains why", async () => {
    vi.mocked(axios.get).mockResolvedValueOnce({ data: { status: "success", models: [model("small", true), model("medium", false)] } });
    vi.mocked(axios.post).mockRejectedValueOnce({ message: "Network Error" });
    const setWhisperModel = await render();

    await act(async () => downloadButton().click());

    expect(setWhisperModel).not.toHaveBeenCalled();
    const alert = container.querySelector('[role="alert"]')!;
    expect(alert.textContent).toContain(i18n.t("settings.whisper_download_error", { name: "MEDIUM" }));
    expect(alert.querySelector("details")!.textContent).toContain("Network Error");
  });

  it("treats an error answer from the server as a failed download", async () => {
    vi.mocked(axios.get).mockResolvedValueOnce({ data: { status: "success", models: [model("medium", false)] } });
    vi.mocked(axios.post).mockResolvedValueOnce({ data: { status: "error", message: "disk full" } });
    const setWhisperModel = await render();

    await act(async () => downloadButton().click());

    expect(setWhisperModel).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"] details')!.textContent).toContain("disk full");
  });

  it("selects a model that is already downloaded without a request", async () => {
    vi.mocked(axios.get).mockResolvedValueOnce({ data: { status: "success", models: [model("small", true), model("base", true)] } });
    const setWhisperModel = await render("small");
    const radios = [...container.querySelectorAll<HTMLInputElement>('input[type="radio"]')];
    await act(async () => radios[1].click());
    expect(setWhisperModel).toHaveBeenCalledWith("base");
    expect(axios.post).not.toHaveBeenCalled();
  });

  it("shows CPU warning for medium/large-v3 when gpu_ready is false and renders Windows GPU addon card", async () => {
    vi.mocked(axios.get).mockImplementation(async (url: string) => {
      if (url.endsWith("/api/settings/addons")) {
        return {
          data: {
            status: "success",
            addons: {
              cuda: { id: "cuda", available: true, installed: false, downloading: false, percent: 0, downloaded_mb: 0, total_mb: 0, size_hint_mb: 528, disk_mb: 0 },
              mediapipe: { id: "mediapipe", available: true, installed: false, downloading: false, percent: 0, downloaded_mb: 0, total_mb: 0, size_hint_mb: 35, disk_mb: 0 },
            },
          },
        };
      }
      return { data: { status: "success", models: [model("small", true), model("medium", true)], gpu_ready: false, processor_slow_models: ["medium", "large-v3"] } };
    });
    vi.mocked(axios.post).mockResolvedValueOnce({
      data: { status: "success", addon: { id: "cuda", available: true, installed: false, downloading: true, percent: 10, downloaded_mb: 50, total_mb: 528, size_hint_mb: 528, disk_mb: 0 } },
    });

    await render("medium");

    expect(container.textContent).toContain(i18n.t("settings.whisper_cpu_note"));
    const installBtn = [...container.querySelectorAll("button")].find((b) => b.textContent?.includes(i18n.t("settings.addon_gpu_install")))!;
    expect(installBtn).toBeTruthy();
    await act(async () => installBtn.click());
    expect(vi.mocked(axios.post)).toHaveBeenCalledWith(`${API}/api/settings/addons/cuda/download`);
  });

  const SP3_MODELS = { status: "success", models: [model("small", true), model("medium", false), model("large-v3", true)], processor_slow_models: ["medium", "large-v3"] };
  const cuda = (extra: Record<string, unknown> = {}) => ({
    id: "cuda", available: true, installed: false, downloading: false, percent: 0, downloaded_mb: 0, total_mb: 0, size_hint_mb: 528, disk_mb: 0, ...extra,
  });

  it("notes the processor only under the slow models, and only when the graphics card is not ready", async () => {
    vi.mocked(axios.get).mockImplementation(async (url: string) =>
      url.endsWith("/addons") ? { data: { status: "success", addons: { cuda: cuda({ available: false }) } } } : { data: { ...SP3_MODELS, gpu_ready: false } },
    );
    await render("small");
    const note = i18n.t("settings.whisper_cpu_note");
    const plainNote = i18n.t("settings.whisper_cpu_note_no_gpu");
    expect(container.textContent!.split(plainNote).length - 1).toBe(2);
    // No NVIDIA card: nothing to install, so no card and no talk of a graphics card.
    expect(container.textContent).not.toContain(note);
    expect(container.textContent).not.toContain(i18n.t("settings.addon_gpu_title"));

    act(() => root.unmount());
    root = createRoot(container);
    vi.mocked(axios.get).mockImplementation(async (url: string) =>
      url.endsWith("/addons") ? { data: { status: "success", addons: { cuda: cuda() } } } : { data: { ...SP3_MODELS, gpu_ready: true } },
    );
    await render("small");
    expect(container.textContent).not.toContain(note);
    expect(container.textContent).not.toContain(plainNote);
    expect(container.textContent).not.toContain(i18n.t("settings.addon_gpu_install"));
  });

  it("asks for the add-ons only from a server that reports gpu_ready (Ruling P8: older servers and mocks stay untouched)", async () => {
    vi.mocked(axios.get).mockResolvedValueOnce({ data: { status: "success", models: [model("small", true)] } });
    await render("small");
    expect(vi.mocked(axios.get).mock.calls.map((c) => c[0])).toEqual([`${API}/api/settings/whisper-models`]);
  });

  it("keeps the model list usable when the add-on list fails (Ruling P8)", async () => {
    vi.mocked(axios.get).mockImplementation(async (url: string) => {
      if (url.endsWith("/addons")) throw new Error("Not Found");
      return { data: { ...SP3_MODELS, gpu_ready: false } };
    });
    const setWhisperModel = await render("small");
    expect(container.querySelector('[role="alert"]')).toBeNull();
    const radios = [...container.querySelectorAll<HTMLInputElement>('input[type="radio"]')];
    expect(radios).toHaveLength(2);
    await act(async () => radios[1].click());
    expect(setWhisperModel).toHaveBeenCalledWith("large-v3");
  });

  it("never asks for add-ons where the platform has none (cloud)", async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: { ...SP3_MODELS, gpu_ready: false } });
    await render("small", false);
    expect(vi.mocked(axios.get).mock.calls.map((c) => c[0])).toEqual([`${API}/api/settings/whisper-models`]);
    expect(container.textContent).toContain(i18n.t("settings.whisper_cpu_note_no_gpu"));
    expect(container.textContent).not.toContain(i18n.t("settings.whisper_cpu_note"));
  });

  it("after the graphics card support is installed, reloads the models so the processor notes go away", async () => {
    vi.useFakeTimers();
    let installed = false;
    vi.mocked(axios.get).mockImplementation(async (url: string) => {
      if (url.endsWith("/addons")) {
        const status = installed ? cuda({ installed: true, percent: 100, disk_mb: 527.6 }) : cuda({ downloading: true, percent: 50, downloaded_mb: 264, total_mb: 527.5 });
        return { data: { status: "success", addons: { cuda: status } } };
      }
      return { data: { ...SP3_MODELS, gpu_ready: installed } };
    });
    try {
      await render("small");
      expect(container.textContent).toContain(i18n.t("settings.addon_downloading", { done: "264", total: "528", percent: 50 }));
      expect(container.textContent).toContain(i18n.t("settings.whisper_cpu_note"));

      installed = true;
      await act(async () => vi.advanceTimersByTimeAsync(500));
      expect(container.textContent).toContain(i18n.t("settings.addon_gpu_ready", { mb: "528" }));
      expect(container.textContent).not.toContain(i18n.t("settings.whisper_cpu_note"));
      expect(vi.mocked(axios.get).mock.calls.filter((c) => String(c[0]).endsWith("/whisper-models"))).toHaveLength(2);
      expect([...container.querySelectorAll("button")].some((b) => b.textContent?.includes(i18n.t("settings.addon_gpu_remove")))).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
  it("asks before removing the graphics card support, and removes only after Ya, hapus", async () => {
    vi.mocked(axios.get).mockImplementation(async (url: string) =>
      url.endsWith("/addons")
        ? { data: { status: "success", addons: { cuda: cuda({ installed: true, percent: 100, disk_mb: 527.6 }) } } }
        : { data: { ...SP3_MODELS, gpu_ready: true } },
    );
    vi.mocked(axios.delete).mockResolvedValueOnce({ data: { status: "success", addon: cuda() } });
    await render("small");
    const removeBtn = () => [...container.querySelectorAll("button")].find((b) => b.textContent?.includes(i18n.t("settings.addon_gpu_remove")))!;
    const dialogButton = (label: string) => [...document.querySelectorAll('[role="dialog"] button')].find((b) => b.textContent === label) as HTMLButtonElement;

    await act(async () => removeBtn().click());
    expect(axios.delete).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain(i18n.t("settings.addon_gpu_remove_confirm_title"));
    expect(document.body.textContent).toContain(i18n.t("settings.addon_gpu_remove_confirm_body", { mb: "528" }));
    await act(async () => dialogButton(i18n.t("common.cancel")).click());
    expect(axios.delete).not.toHaveBeenCalled();
    expect(document.querySelector('[role="dialog"]')).toBeNull();

    removeBtn().focus();
    await act(async () => removeBtn().click());
    await act(async () => dialogButton(i18n.t("settings.addon_gpu_remove_confirm")).click());
    expect(vi.mocked(axios.delete)).toHaveBeenCalledWith(`${API}/api/settings/addons/cuda`);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    // The card hides until the models are read again; the focus stays in the section, not on the page.
    expect(document.activeElement).not.toBe(document.body);
    expect(container.contains(document.activeElement)).toBe(true);
  });

  it("names the graphics card download on its progress bar", async () => {
    vi.mocked(axios.get).mockImplementation(async (url: string) =>
      url.endsWith("/addons")
        ? { data: { status: "success", addons: { cuda: cuda({ downloading: true, percent: 10, downloaded_mb: 53, total_mb: 527.5 }) } } }
        : { data: { ...SP3_MODELS, gpu_ready: false } },
    );
    await render("small");
    const bar = container.querySelector('[role="progressbar"]')!;
    expect(bar.getAttribute("aria-label")).toContain(i18n.t("settings.addon_gpu_title"));
  });
});
