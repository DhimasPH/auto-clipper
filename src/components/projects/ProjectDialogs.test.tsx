import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../../i18n";
import { AiCorrectDialog } from "./AiCorrectDialog";
import { RerenderAllDialog } from "./RerenderAllDialog";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("Riwayat dialogs: Batal goes through the discard guard", () => {
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
  });

  const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]')!;
  const button = (text: string) => [...dialog().querySelectorAll("button")].find((b) => b.textContent?.trim() === text)!;
  const guard = () => dialog().querySelector('[role="alert"]');

  it("AiCorrectDialog: Batal closes when empty, asks first after typing", () => {
    const onClose = vi.fn();
    act(() => root.render(<AiCorrectDialog isOpen onClose={onClose} onConfirm={vi.fn()} />));
    act(() => button(i18n.t("common.cancel")).click());
    expect(onClose).toHaveBeenCalledTimes(1);

    const area = dialog().querySelector("textarea")!;
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(area, "fokus ke bagian lucu");
      area.dispatchEvent(new Event("input", { bubbles: true }));
    });
    act(() => button(i18n.t("common.cancel")).click());
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(guard()?.textContent).toContain(i18n.t("dialog.discard_question"));
  });

  it("RerenderAllDialog: Batal asks first after a choice changed", () => {
    const onClose = vi.fn();
    act(() => root.render(<RerenderAllDialog isOpen initialMeta={{ aspect_ratio: "9:16" }} onClose={onClose} onConfirm={vi.fn()} />));
    const shape = dialog().querySelector("select")!;
    act(() => {
      shape.value = "1:1";
      shape.dispatchEvent(new Event("change", { bubbles: true }));
    });
    act(() => button(i18n.t("common.cancel")).click());
    expect(onClose).not.toHaveBeenCalled();
    expect(guard()?.textContent).toContain(i18n.t("dialog.discard_question"));
    act(() => button(i18n.t("dialog.discard")).click());
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
