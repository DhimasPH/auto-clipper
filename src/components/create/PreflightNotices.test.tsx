import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../../i18n";
import { CAPS, setPlatform, type Platform } from "../../platform";
import { PreflightNotices } from "./PreflightNotices";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const blocker = {
  code: "FFMPEG_MISSING",
  title: "FFmpeg tidak ada",
  message: "Pasang ulang.",
  title_en: "",
  message_en: "",
  actions: [],
  technical: "",
};
const note = { id: "gpu", level: "warn", title: "Tanpa GPU", message: "Proses lebih lama." };

describe("PreflightNotices", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    setPlatform({ caps: CAPS.desktop } as Platform);
    container = document.createElement("div");
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    setPlatform(null);
  });

  it("shows a blocker as an error card with a check-again button", () => {
    const onRecheck = vi.fn();
    act(() => root.render(<PreflightNotices notes={[]} blockers={[blocker]} checking={false} onRecheck={onRecheck} />));
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("FFmpeg tidak ada");
    const button = [...container.querySelectorAll("button")].find((b) => b.textContent === i18n.t("create.recheck"))!;
    act(() => button.click());
    expect(onRecheck).toHaveBeenCalledTimes(1);
  });

  it("shows a warning as a small note and nothing when all is fine", () => {
    act(() => root.render(<PreflightNotices notes={[note]} blockers={[]} checking={false} onRecheck={vi.fn()} />));
    expect(container.textContent).toContain("Tanpa GPU");
    expect(container.querySelector('[role="alert"]')).toBeNull();
    act(() => root.render(<PreflightNotices notes={[]} blockers={[]} checking={false} onRecheck={vi.fn()} />));
    expect(container.innerHTML).toBe("");
  });
});
