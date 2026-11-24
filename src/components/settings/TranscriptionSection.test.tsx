import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import axios from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../../i18n";
import { setApiUrl } from "../../platform/backendUrl";
import { TranscriptionSection, type WhisperModelInfo } from "./TranscriptionSection";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("axios", () => ({ default: { get: vi.fn(), post: vi.fn() } }));

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
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.resetAllMocks();
  });

  const render = async (whisperModel = "small") => {
    const setWhisperModel = vi.fn();
    await act(async () => root.render(<TranscriptionSection whisperModel={whisperModel} setWhisperModel={setWhisperModel} />));
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
});
