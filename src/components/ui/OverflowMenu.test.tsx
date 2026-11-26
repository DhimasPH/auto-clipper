import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../../i18n";
import { OverflowMenu } from "./OverflowMenu";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("OverflowMenu", () => {
  let container: HTMLDivElement;
  let root: Root;
  const edit = vi.fn();
  const folder = vi.fn();

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() =>
      root.render(
        <OverflowMenu
          label="Pilihan lain"
          items={[
            { id: "edit", label: "Ubah", onSelect: edit },
            { id: "folder", label: "Folder", onSelect: folder },
          ]}
        />,
      ),
    );
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.clearAllMocks();
  });

  const toggle = () => container.querySelector<HTMLButtonElement>('button[aria-haspopup="menu"]')!;
  const items = () => [...container.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')];

  it("is a labelled button that opens a menu and focuses its first item", () => {
    expect(toggle().getAttribute("aria-label")).toBe("Pilihan lain");
    expect(toggle().getAttribute("aria-expanded")).toBe("false");
    act(() => toggle().click());
    expect(toggle().getAttribute("aria-expanded")).toBe("true");
    expect(items().map((i) => i.textContent)).toEqual(["Ubah", "Folder"]);
    expect(document.activeElement).toBe(items()[0]);
    expect(items()[0].className).toContain("focus-visible:ring-2");
    expect(items()[0].className).toContain("focus-visible:ring-accent");
  });

  it("moves with the arrow keys, wraps with ArrowUp, and closes with Escape or outside click", () => {
    act(() => toggle().click());
    act(() => {
      items()[0].dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }));
    });
    expect(document.activeElement).toBe(items()[1]);
    act(() => {
      items()[1].dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    });
    expect(document.activeElement).toBe(items()[0]);
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(items()).toHaveLength(0);
    expect(document.activeElement).toBe(toggle());

    act(() => toggle().click());
    expect(items()).toHaveLength(2);
    act(() => {
      document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    });
    expect(items()).toHaveLength(0);
  });

  it("runs the chosen item and closes", () => {
    act(() => toggle().click());
    act(() => items()[1].click());
    expect(folder).toHaveBeenCalledTimes(1);
    expect(items()).toHaveLength(0);
  });

  it("draws nothing without items", () => {
    act(() => root.render(<OverflowMenu label="x" items={[]} />));
    expect(container.innerHTML).toBe("");
  });
});
