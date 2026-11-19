import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../../i18n";
import { CAPS, setPlatform, type Platform } from "../../platform";
import { DEFAULT_CANVAS_CONFIG, type CanvasConfig } from "../../types/canvas";
import { CanvasConfigControls } from "./CanvasConfigControls";

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
});
