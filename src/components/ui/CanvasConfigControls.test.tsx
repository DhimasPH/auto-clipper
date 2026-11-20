import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../../i18n";
import { uploadCanvasImage } from "../../api";
import { CAPS, setPlatform, type Platform } from "../../platform";
import { DEFAULT_CANVAS_CONFIG, type CanvasConfig } from "../../types/canvas";
import { CanvasConfigControls } from "./CanvasConfigControls";

vi.mock("../../api", () => ({ uploadCanvasImage: vi.fn() }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const imageConfig: CanvasConfig = { ...DEFAULT_CANVAS_CONFIG, enabled: true, background_type: "image" };

function fakePlatform(caps: Platform["caps"], pickImage: Platform["pickImage"]): Platform {
  return { caps, pickImage } as Platform;
}

describe("CanvasConfigControls background image picker", () => {
  let container: HTMLDivElement;
  let root: Root;
  let inputClick: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    inputClick = vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(() => {});
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    setPlatform(null);
  });

  function renderControls(onChange: (c: CanvasConfig) => void) {
    act(() => root.render(<CanvasConfigControls config={imageConfig} onChange={onChange} />));
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    return input.nextElementSibling!.querySelector("button")!;
  }

  it("without OS dialogs opens the browser file input in the same click (no await first)", () => {
    const pickImage = vi.fn(async () => null);
    setPlatform(fakePlatform(CAPS.local, pickImage));
    const button = renderControls(vi.fn());
    button.click();
    expect(inputClick).toHaveBeenCalledTimes(1);
    expect(pickImage).not.toHaveBeenCalled();
  });

  it("on desktop uses the OS image dialog and keeps the chosen path", async () => {
    const pickImage = vi.fn(async () => "C:\\bg.png");
    setPlatform(fakePlatform(CAPS.desktop, pickImage));
    const onChange = vi.fn();
    const button = renderControls(onChange);
    await act(async () => button.click());
    expect(pickImage).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({ ...imageConfig, background_image_path: "C:\\bg.png" });
    expect(inputClick).not.toHaveBeenCalled();
  });

  it("on desktop does nothing when the dialog is cancelled, and falls back to the file input when it fails", async () => {
    const pickImage = vi.fn<Platform["pickImage"]>().mockResolvedValueOnce(null).mockRejectedValueOnce(new Error("no dialog"));
    setPlatform(fakePlatform(CAPS.desktop, pickImage));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const onChange = vi.fn();
    const button = renderControls(onChange);
    await act(async () => button.click());
    expect(inputClick).not.toHaveBeenCalled();
    await act(async () => button.click());
    expect(inputClick).toHaveBeenCalledTimes(1);
    expect(onChange).not.toHaveBeenCalled();
  });

  async function chooseFile(file: File) {
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input, "files", { value: [file], configurable: true });
    await act(async () => {
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }

  it("without OS dialogs uploads the image and keeps the backend path, never a blob: address", async () => {
    vi.mocked(uploadCanvasImage).mockResolvedValue("/work/temp_downloads/images/bg_1a2b3c4d_latar.png");
    const createObjectURL = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:http://127.0.0.1/1");
    setPlatform(fakePlatform(CAPS.local, vi.fn(async () => null)));
    const onChange = vi.fn();
    renderControls(onChange);
    const file = new File(["png"], "latar.png", { type: "image/png" });

    await chooseFile(file);

    expect(uploadCanvasImage).toHaveBeenCalledWith(file);
    expect(onChange).toHaveBeenCalledWith({
      ...imageConfig,
      background_type: "image",
      background_image_path: "/work/temp_downloads/images/bg_1a2b3c4d_latar.png",
    });
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it("says under the button that the upload failed and keeps the old image", async () => {
    vi.mocked(uploadCanvasImage).mockRejectedValue(new Error("offline"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    setPlatform(fakePlatform(CAPS.cloud, vi.fn(async () => null)));
    const onChange = vi.fn();
    renderControls(onChange);

    await chooseFile(new File(["png"], "latar.png", { type: "image/png" }));

    expect(onChange).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(i18n.t("canvas.upload_failed"));
  });

  it("disables uploading again while in flight and merges against the latest config", async () => {
    let finish!: (path: string) => void;
    vi.mocked(uploadCanvasImage).mockReturnValue(new Promise<string>((r) => { finish = r; }));
    setPlatform(fakePlatform(CAPS.local, vi.fn(async () => null)));
    const onChange = vi.fn();
    const button = renderControls(onChange);

    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input, "files", {
      value: [new File(["png"], "latar.png", { type: "image/png" })],
      configurable: true,
    });
    act(() => {
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(button.disabled).toBe(true);
    expect(container.querySelector('[role="status"]')?.textContent).toBe(i18n.t("canvas.uploading_image"));

    // User changes enlarge_scale while upload is still in flight.
    act(() => {
      root.render(<CanvasConfigControls config={{ ...imageConfig, enlarge_scale: 1.5 }} onChange={onChange} />);
    });

    await act(async () => {
      finish("/work/temp_downloads/images/bg_new.png");
    });

    expect(button.disabled).toBe(false);
    expect(onChange).toHaveBeenCalledWith({
      ...imageConfig,
      enlarge_scale: 1.5,
      background_image_path: "/work/temp_downloads/images/bg_new.png",
    });
  });
});
