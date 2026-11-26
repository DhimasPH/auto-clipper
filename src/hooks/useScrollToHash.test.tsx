import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useScrollToHash } from "./useScrollToHash";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function Probe() {
  useScrollToHash();
  return null;
}

describe("useScrollToHash", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
  });

  it.each([
    ["#bantuan", "bantuan"],
    ["#%E0", "%E0"],
  ])("focuses the target of %s, and a broken escape does not throw", (hash, id) => {
    const target = document.createElement("section");
    target.id = id;
    target.tabIndex = -1;
    document.body.appendChild(target);
    const scroll = vi.fn();
    (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView = scroll;
    const root = createRoot(document.createElement("div"));

    act(() => root.render(<MemoryRouter initialEntries={[`/pengaturan${hash}`]}><Probe /></MemoryRouter>));

    expect(document.activeElement).toBe(target);
    expect(scroll).toHaveBeenCalled();
    act(() => root.unmount());
  });
});
