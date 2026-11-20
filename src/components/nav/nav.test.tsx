import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../../i18n";
import { BackendStatusContext } from "../../hooks/useBackendStatus";
import { CAPS, setPlatform, type Platform } from "../../platform";
import { BackendBanner } from "./BackendBanner";
import { BottomNav } from "./BottomNav";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("navigation shell", () => {
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
    setPlatform(null);
  });

  it("shows three labelled destinations and marks the current one", () => {
    act(() => root.render(<MemoryRouter initialEntries={["/riwayat/abc"]}><BottomNav /></MemoryRouter>));
    const links = [...container.querySelectorAll("a")];
    expect(links.map((a) => a.textContent)).toEqual([i18n.t("nav.create"), i18n.t("nav.projects"), i18n.t("nav.settings")]);
    expect(links.map((a) => a.getAttribute("aria-current"))).toEqual([null, "page", null]);
  });

  it("explains a lost connection per platform and reconnects on request", () => {
    setPlatform({ caps: CAPS.cloud } as Platform);
    const reconnect = vi.fn(async () => {});
    act(() =>
      root.render(
        <BackendStatusContext.Provider value={{ status: "disconnected", reconnect }}>
          <BackendBanner />
        </BackendStatusContext.Provider>,
      ),
    );
    expect(container.textContent).toContain(i18n.t("banner.lost_none"));
    act(() => container.querySelector("button")!.click());
    expect(reconnect).toHaveBeenCalledTimes(1);
  });

  it("shows no banner while connected", () => {
    setPlatform({ caps: CAPS.desktop } as Platform);
    act(() =>
      root.render(
        <BackendStatusContext.Provider value={{ status: "connected", reconnect: vi.fn(async () => {}) }}>
          <BackendBanner />
        </BackendStatusContext.Provider>,
      ),
    );
    expect(container.innerHTML).toBe("");
  });
});
