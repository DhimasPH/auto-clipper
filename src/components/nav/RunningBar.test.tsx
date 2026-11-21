import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppContext } from "../../App";
import i18n from "../../i18n";
import { ROUTES } from "../../lib/routes";
import { RunningBar } from "./RunningBar";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("RunningBar", () => {
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

  it("shows on non-create routes while a job is running and hides on Create or when idle", () => {
    act(() =>
      root.render(
        <MemoryRouter key="projects-running" initialEntries={[ROUTES.projects]}>
          <AppContext.Provider value={{ isRunning: true }}>
            <RunningBar />
          </AppContext.Provider>
        </MemoryRouter>,
      ),
    );
    expect(container.querySelector('[role="status"]')?.textContent).toContain(i18n.t("progress.running_bar"));
    expect(container.querySelector("a")?.getAttribute("href")).toBe(ROUTES.create);

    act(() =>
      root.render(
        <MemoryRouter key="create-running" initialEntries={[ROUTES.create]}>
          <AppContext.Provider value={{ isRunning: true }}>
            <RunningBar />
          </AppContext.Provider>
        </MemoryRouter>,
      ),
    );
    expect(container.innerHTML).toBe("");

    act(() =>
      root.render(
        <MemoryRouter key="projects-idle" initialEntries={[ROUTES.projects]}>
          <AppContext.Provider value={{ isRunning: false }}>
            <RunningBar />
          </AppContext.Provider>
        </MemoryRouter>,
      ),
    );
    expect(container.innerHTML).toBe("");
  });
});
