import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../../i18n";
import { setPlatform, type Platform } from "../../platform";
import { OutputSection } from "./OutputSection";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("OutputSection (Lanjutan, folder and quality)", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    await i18n.changeLanguage("id");
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    setPlatform(null);
    vi.restoreAllMocks();
  });

  const render = async (pickFolder: () => Promise<string | null>, showFolder = true, setOutputFolder = vi.fn()) => {
    setPlatform({ pickFolder } as unknown as Platform);
    await act(async () =>
      root.render(
        <OutputSection
          showFolder={showFolder}
          outputFolder=""
          setOutputFolder={setOutputFolder}
          quality="best"
          setQuality={vi.fn()}
        />,
      ),
    );
    return setOutputFolder;
  };
  const pickButton = () =>
    [...container.querySelectorAll("button")].find((b) => b.textContent?.includes("Pilih folder")) as HTMLButtonElement;

  it("hides the folder row when the platform has no folder dialog", async () => {
    await render(vi.fn(), false);
    expect(pickButton()).toBeUndefined();
    expect(container.textContent).not.toContain("Folder hasil");
    // Without a folder row the title must not promise one.
    expect(container.querySelector("h3")?.textContent).toBe(i18n.t("settings.output_title_quality"));
  });

  it("saves the picked folder", async () => {
    const setOutputFolder = await render(vi.fn().mockResolvedValue("D:\\Klip"));
    await act(async () => pickButton().click());
    expect(setOutputFolder).toHaveBeenCalledWith("D:\\Klip");
  });

  it("says what to do when the folder dialog fails, and clears it on the next try", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const pickFolder = vi.fn().mockRejectedValueOnce(new Error("dialog failed")).mockResolvedValueOnce(null);
    const setOutputFolder = await render(pickFolder);
    await act(async () => pickButton().click());
    const alert = container.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain("Folder tidak bisa dipilih");
    expect(alert?.textContent).toContain("Coba lagi");
    expect(setOutputFolder).not.toHaveBeenCalled();

    await act(async () => pickButton().click());
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });
});
