import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../../i18n";
import { VideoStep, type VideoStepProps } from "./VideoStep";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const base: VideoStepProps = {
  link: "",
  onLinkChange: vi.fn(),
  chosenFile: null,
  onClearFile: vi.fn(),
  onPickFile: vi.fn(),
  shape: "9:16",
  onShapeChange: vi.fn(),
};

describe("VideoStep (spec 4.2 step 1)", () => {
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
  });

  const render = (props: Partial<typeof base> & { onPickDrive?: () => void }) =>
    act(() => root.render(<VideoStep {...base} {...props} />));
  const button = (label: string) => [...container.querySelectorAll("button")].find((b) => b.textContent === label)!;

  it("says under the field when a link cannot be used", () => {
    render({ link: "https://vimeo.com/1" });
    const input = container.querySelector("input[type='url']")!;
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(document.getElementById(input.getAttribute("aria-describedby")!)?.textContent).toContain(
      i18n.t("create.link_unsupported"),
    );
  });

  it("accepts a YouTube link without a message", () => {
    render({ link: "https://youtu.be/abc" });
    expect(container.textContent).not.toContain(i18n.t("create.link_unsupported"));
    expect(container.querySelector("input[type='url']")!.getAttribute("aria-invalid")).toBeNull();
  });

  it("picks a file, and offers Google Drive only where it exists", () => {
    const onPickFile = vi.fn();
    render({ onPickFile });
    act(() => button(i18n.t("create.pick_file")).click());
    expect(onPickFile).toHaveBeenCalledTimes(1);
    expect(container.textContent).not.toContain(i18n.t("create.pick_drive"));

    const onPickDrive = vi.fn();
    render({ onPickDrive });
    act(() => button(i18n.t("create.pick_drive")).click());
    expect(onPickDrive).toHaveBeenCalledTimes(1);
  });

  it("shows the chosen file instead of the link box, with a way to change it", () => {
    const onClearFile = vi.fn();
    render({ chosenFile: "podcast.mp4", onClearFile });
    expect(container.textContent).toContain(i18n.t("create.chosen_file", { name: "podcast.mp4" }));
    expect(container.querySelector("input[type='url']")).toBeNull();
    act(() => button(i18n.t("create.clear_file")).click());
    expect(onClearFile).toHaveBeenCalledTimes(1);
  });

  it("offers the three clip shapes, vertical first", () => {
    const onShapeChange = vi.fn();
    render({ onShapeChange });
    const radios = [...container.querySelectorAll<HTMLInputElement>("input[type='radio']")];
    expect(radios.map((r) => r.value)).toEqual(["9:16", "1:1", "16:9"]);
    expect(radios[0].checked).toBe(true);
    act(() => radios[1].click());
    expect(onShapeChange).toHaveBeenCalledWith("1:1");
  });
});
