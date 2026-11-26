import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import pkg from "../../package.json";
import i18n from "../i18n";
import { SplashScreen } from "./SplashScreen";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("SplashScreen (SP4 spec 4.3)", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    await i18n.changeLanguage("id");
    container = document.createElement("div");
    root = createRoot(container);
  });

  afterEach(() => act(() => root.unmount()));

  it("shows the logo, name, tagline and version, and a spinner that stops for reduced motion", () => {
    act(() => root.render(<SplashScreen />));
    expect(container.querySelector("img")!.getAttribute("src")).toBe("/logo.png");
    expect(container.querySelector("h1")!.textContent).toBe("Auto Clipper");
    expect(container.textContent).toContain(i18n.t("app.tagline"));
    expect(container.textContent).toContain(i18n.t("about.version", { version: pkg.version }));
    expect(container.querySelector('[role="status"]')!.textContent).toContain(i18n.t("startup.loading"));
    expect(container.querySelector(".animate-spin")!.className).toContain("motion-reduce:animate-none");
  });
});
