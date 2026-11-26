import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import pkg from "../../package.json";
import { AppFooter } from "./AppFooter";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("AppFooter (SP4 spec 4.2)", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    root = createRoot(container);
  });

  afterEach(() => act(() => root.unmount()));

  it("is one line with the copyright of this year and the version, scrolling with the page", () => {
    act(() => root.render(<AppFooter />));
    const footer = container.querySelector("footer")!;
    expect(footer.textContent).toBe(`\u00A9 ${new Date().getFullYear()} Dhimas Panjie Herlambang \u00B7 v${pkg.version}`);
    expect(footer.className).not.toMatch(/\b(fixed|sticky)\b/);
    expect(footer.className).toContain("text-caption");
  });
});
