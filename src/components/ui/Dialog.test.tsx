import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../../i18n";
import { Dialog } from "./Dialog";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const press = (key: string, shiftKey = false) =>
  act(() => {
    document.dispatchEvent(new KeyboardEvent("keydown", { key, shiftKey, bubbles: true, cancelable: true }));
  });

/** jsdom has no Tab: run the dialog's keydown handler, then move focus like a browser would when it did not stop it. */
function tab(shiftKey = false) {
  const event = new KeyboardEvent("keydown", { key: "Tab", shiftKey, bubbles: true, cancelable: true });
  act(() => {
    document.dispatchEvent(event);
  });
  if (event.defaultPrevented) return;
  const all = [...document.querySelectorAll<HTMLElement>("button, input, textarea")];
  const at = all.indexOf(document.activeElement as HTMLElement);
  all[shiftKey ? at - 1 : at + 1]?.focus();
}

function Harness({ onClose, dirtyText = false }: { onClose: () => void; dirtyText?: boolean }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  return (
    <div>
      <button onClick={() => setOpen(true)}>Buka</button>
      {open && (
        <Dialog
          title="Judul"
          dirty={dirtyText && text !== ""}
          onClose={() => {
            onClose();
            setOpen(false);
          }}
          footer={<button onClick={() => setOpen(false)}>Selesai</button>}
        >
          <input aria-label="isi" value={text} onChange={(e) => setText(e.target.value)} />
        </Dialog>
      )}
    </div>
  );
}

describe("Dialog", () => {
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

  function openWith(props: { onClose?: () => void; dirtyText?: boolean } = {}) {
    const onClose = props.onClose ?? vi.fn();
    act(() => root.render(<Harness onClose={onClose} dirtyText={props.dirtyText} />));
    const opener = container.querySelector("button")!;
    act(() => opener.focus());
    act(() => opener.click());
    return { onClose, opener };
  }

  const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]');

  it("is a labelled modal, moves focus inside and keeps Tab inside", () => {
    openWith();
    const d = dialog()!;
    expect(d.getAttribute("aria-modal")).toBe("true");
    expect(document.getElementById(d.getAttribute("aria-labelledby")!)?.textContent).toBe("Judul");
    expect(d.contains(document.activeElement)).toBe(true);

    const close = d.querySelector<HTMLButtonElement>(`button[aria-label="${i18n.t("common.close")}"]`)!;
    const done = [...d.querySelectorAll("button")].find((b) => b.textContent === "Selesai")!;
    act(() => done.focus());
    tab();
    expect(document.activeElement).toBe(close);
    tab(true);
    expect(document.activeElement).toBe(done);
  });

  it("closes with Escape and gives focus back to the button that opened it", () => {
    const { onClose, opener } = openWith();
    press("Escape");
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it("returns focus to the opener also when the dialog closes from its own button", () => {
    const { opener } = openWith();
    const done = [...dialog()!.querySelectorAll("button")].find((b) => b.textContent === "Selesai")!;
    act(() => done.click());
    expect(document.activeElement).toBe(opener);
  });

  it("asks before throwing away typed input; Escape keeps editing, Discard closes", async () => {
    const { onClose } = openWith({ dirtyText: true });
    const input = dialog()!.querySelector("input")!;
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    act(() => {
      input.focus();
      setValue.call(input, "catatan");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });

    press("Escape");
    expect(onClose).not.toHaveBeenCalled();
    const alert = dialog()!.querySelector('[role="alert"]')!;
    expect(alert.textContent).toContain(i18n.t("dialog.discard_question"));
    expect(document.activeElement?.textContent).toBe(i18n.t("dialog.keep_editing"));

    press("Escape");
    expect(dialog()!.querySelector('[role="alert"]')).toBeNull();
    expect(dialog()!.querySelector("input")!.value).toBe("catatan");
    // Focus goes back to the field, not to <body>.
    await act(async () => new Promise((r) => setTimeout(r, 0)));
    expect(document.activeElement).toBe(dialog()!.querySelector("input"));

    press("Escape");
    const discard = [...dialog()!.querySelectorAll("button")].find((b) => b.textContent === i18n.t("dialog.discard"))!;
    act(() => discard.click());
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(dialog()).toBeNull();
  });

  it("without onClose has no close button and ignores Escape", () => {
    act(() => root.render(<Dialog title="Memasang">x</Dialog>));
    expect(dialog()!.querySelector(`button[aria-label="${i18n.t("common.close")}"]`)).toBeNull();
    press("Escape");
    expect(dialog()).not.toBeNull();
  });
});
