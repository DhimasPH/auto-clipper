import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../../i18n";
import { ConfirmDialog } from "./ConfirmDialog";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("ConfirmDialog", () => {
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

  function open(onCancel = vi.fn(), onConfirm = vi.fn()) {
    act(() =>
      root.render(
        <ConfirmDialog isOpen title="Batalkan proses ini?" message="m" confirmLabel="Ya" cancelLabel="Tidak"
          onConfirm={onConfirm} onCancel={onCancel} />,
      ),
    );
    return { onCancel, onConfirm };
  }

  it("is a labelled modal dialog and focuses the safe choice", () => {
    open();
    const dialog = container.querySelector('[role="dialog"]')!;
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(document.getElementById(dialog.getAttribute("aria-labelledby")!)?.textContent).toBe("Batalkan proses ini?");
    expect(document.activeElement?.textContent).toBe("Tidak");
  });

  it("closes with Escape", () => {
    const { onCancel } = open();
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
