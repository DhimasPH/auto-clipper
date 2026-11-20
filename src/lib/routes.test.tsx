import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { legacyRouteElements } from "../components/nav/legacyRoutes";
import { LEGACY_REDIRECTS, projectPath } from "./routes";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function Where() {
  const location = useLocation();
  return <p>{location.pathname + location.hash}</p>;
}

describe("routes (spec 4.1)", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    root = createRoot(container);
  });

  afterEach(() => act(() => root.unmount()));

  it("keeps every old address working", () => {
    expect(LEGACY_REDIRECTS).toEqual({
      "/manual-ai": "/",
      "/downloader": "/pengaturan#pengunduh",
      "/history": "/riwayat",
      "/settings": "/pengaturan",
      "/help": "/pengaturan#bantuan",
    });
  });

  it.each(Object.entries(LEGACY_REDIRECTS))("%s opens %s", (from, to) => {
    act(() =>
      root.render(
        <MemoryRouter initialEntries={[from]}>
          <Routes>
            {legacyRouteElements()}
            <Route path="*" element={<Where />} />
          </Routes>
        </MemoryRouter>,
      ),
    );
    expect(container.textContent).toBe(to);
  });

  it("builds a project address that survives odd ids", () => {
    expect(projectPath("a b/c")).toBe("/riwayat/a%20b%2Fc");
  });
});
