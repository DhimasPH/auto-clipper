import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import pkg from "../../../package.json";
import i18n from "../../i18n";
import { SOCIAL_LINKS, SUPPORT_LINK } from "../../lib/appInfo";
import { CAPS, setPlatform, type Platform } from "../../platform";
import { AboutSection } from "./AboutSection";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("AboutSection (SP4 spec 4.2)", () => {
  let container: HTMLDivElement;
  let root: Root;
  let openExternal: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    await i18n.changeLanguage("id");
    openExternal = vi.fn().mockResolvedValue(undefined);
    setPlatform({ caps: CAPS.desktop, openExternal } as unknown as Platform);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    setPlatform(null);
  });

  it("shows the logo, name, tagline, version and copyright", () => {
    act(() => root.render(<AboutSection />));
    expect(container.querySelector("img")!.getAttribute("alt")).toBe(i18n.t("about.logo_alt"));
    expect(container.textContent).toContain(i18n.t("about.title"));
    expect(container.textContent).toContain(i18n.t("app.tagline"));
    expect(container.textContent).toContain(i18n.t("about.version", { version: pkg.version }));
    expect(container.textContent).toContain(`\u00A9 ${new Date().getFullYear()} Dhimas Panjie Herlambang`);
  });

  it("has eight 44 px icon buttons named after their platform, icons hidden from screen readers", () => {
    act(() => root.render(<AboutSection />));
    const icons = [...container.querySelectorAll<HTMLButtonElement>("ul button")];
    expect(icons.map((b) => b.getAttribute("aria-label"))).toEqual(SOCIAL_LINKS.map((l) => l.name));
    for (const button of icons) {
      expect(button.className).toContain("h-11");
      expect(button.className).toContain("w-11");
      expect(button.querySelector("svg")!.getAttribute("aria-hidden")).toBe("true");
    }
  });

  it("opens each link through the platform, and the support button opens Trakteer", async () => {
    act(() => root.render(<AboutSection />));
    const tiktok = container.querySelector<HTMLButtonElement>('ul button[aria-label="TikTok"]')!;
    await act(async () => tiktok.click());
    expect(openExternal).toHaveBeenLastCalledWith("https://www.tiktok.com/@auto_clippers");

    const support = [...container.querySelectorAll("button")].find((b) => b.textContent === i18n.t("about.support"))!;
    expect(support.className).toContain("border-border-active"); // outline: Pengaturan keeps its one filled button
    await act(async () => support.click());
    expect(openExternal).toHaveBeenLastCalledWith(SUPPORT_LINK.href);
    expect(container.textContent).toContain(i18n.t("about.support_note"));
  });
});
