import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../../i18n";
import { setPlatform, type Platform } from "../../platform";
import { CHATGPT_URL, GEMINI_URL, MomentStep } from "./MomentStep";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const good = JSON.stringify({ highlights: [{ start_time: "00:00:10", end_time: "00:00:40" }] });

describe("MomentStep (spec 4.2 step 3)", () => {
  let container: HTMLDivElement;
  let root: Root;
  let openExternal: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    openExternal = vi.fn(async () => {});
    setPlatform({ openExternal } as unknown as Platform);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    setPlatform(null);
    vi.unstubAllGlobals();
  });

  const render = (props: Partial<React.ComponentProps<typeof MomentStep>> = {}) =>
    act(() =>
      root.render(
        <MomentStep prompt="PERINTAH" projectTitle="YouTube 2026" submitting={false} error={null} onSubmit={vi.fn()} onLater={vi.fn()} {...props} />,
      ),
    );
  const button = (label: string) => [...container.querySelectorAll("button")].find((b) => b.textContent === label)!;
  const typeAnswer = (value: string) => {
    const area = container.querySelector("textarea:not([readonly])") as HTMLTextAreaElement;
    const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
    act(() => {
      setValue.call(area, value);
      area.dispatchEvent(new Event("input", { bubbles: true }));
    });
    return area;
  };

  it("copies the instructions in one tap", async () => {
    const writeText = vi.fn(async () => {});
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    render();
    await act(async () => button(i18n.t("moment.copy")).click());
    expect(writeText).toHaveBeenCalledWith("PERINTAH");
    expect(container.textContent).toContain(i18n.t("moment.copied"));
  });

  it("opens ChatGPT and Gemini in a new tab", () => {
    render();
    act(() => button(i18n.t("moment.open_chatgpt")).click());
    act(() => button(i18n.t("moment.open_gemini")).click());
    expect(openExternal.mock.calls).toEqual([[CHATGPT_URL], [GEMINI_URL]]);
  });

  it("explains under the box what is wrong, and sends nothing", () => {
    const onSubmit = vi.fn();
    render({ onSubmit });
    act(() => button(i18n.t("moment.submit")).click());
    let area = container.querySelector("textarea:not([readonly])")!;
    expect(area.getAttribute("aria-invalid")).toBe("true");
    expect(document.getElementById(area.getAttribute("aria-describedby")!)!.textContent).toBe(i18n.t("moment.problem_empty"));
    area = typeAnswer(good.slice(0, 30));
    act(() => button(i18n.t("moment.submit")).click());
    expect(document.getElementById(area.getAttribute("aria-describedby")!)!.textContent).toBe(i18n.t("moment.problem_cut_off"));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("sends a good answer", () => {
    const onSubmit = vi.fn();
    render({ onSubmit });
    typeAnswer("```json\n" + good + "\n```");
    act(() => button(i18n.t("moment.submit")).click());
    expect(onSubmit).toHaveBeenCalledWith(good);
  });

  it("says when the instructions are missing instead of offering an empty copy", () => {
    render({ prompt: "" });
    expect(container.textContent).toContain(i18n.t("moment.prompt_missing"));
    expect(button(i18n.t("moment.copy"))).toBeUndefined();
  });
});
