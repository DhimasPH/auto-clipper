import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../../i18n";
import { DEFAULT_CLIP_CHOICES } from "../../lib/clipChoices";
import { CAPS, setPlatform, type Platform } from "../../platform";
import { ClipOptions } from "./ClipOptions";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const props = {
  choices: DEFAULT_CLIP_CHOICES,
  onChange: vi.fn(),
  title: "",
  onTitleChange: vi.fn(),
  quality: "best",
  onQualityChange: vi.fn(),
  showQuality: true,
  hasPexelsKey: false,
};

describe("ClipOptions (Atur tampilan klip)", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    setPlatform(null);
  });

  it("is closed by default and holds the advanced choices", () => {
    setPlatform({ caps: CAPS.desktop } as Platform);
    act(() => root.render(<ClipOptions {...props} />));
    const details = container.querySelector("details")!;
    expect(details.open).toBe(false);
    expect(details.querySelector("summary")!.textContent).toBe(i18n.t("create.options"));
    expect(container.textContent).toContain(i18n.t("create.hook"));
    expect(container.textContent).toContain(i18n.t("create.max_clips"));
  });

  it("hides B-roll where there are no API keys", () => {
    setPlatform({ caps: CAPS.cloud } as Platform);
    act(() => root.render(<ClipOptions {...props} />));
    expect(container.textContent).not.toContain(i18n.t("create.broll"));
  });
});
