import { afterEach, describe, expect, it } from "vitest";
import en from "./locales/en.json";
import id from "./locales/id.json";
import i18n from "./i18n";
import { renderStartupError } from "./startupError";

describe("renderStartupError", () => {
  afterEach(() => i18n.changeLanguage("id"));

  it("has every startup text in Indonesian and English", () => {
    expect(Object.keys(id.startup).sort()).toEqual(Object.keys(en.startup).sort());
    for (const text of [...Object.values(id.startup), ...Object.values(en.startup)]) expect(text.trim()).not.toBe("");
  });

  it("says what happened, why and what to do, with the technical error tucked in details", () => {
    const root = document.createElement("div");
    renderStartupError(root, new Error("<b>sidecar</b> missing"));
    expect(root.querySelector("h1")?.textContent).toBe(id.startup.title);
    const paragraphs = [...root.querySelectorAll("p")].map((p) => p.textContent);
    expect(paragraphs).toEqual([id.startup.body, id.startup.action]);
    expect(root.querySelector("details summary")?.textContent).toBe(id.startup.details);
    expect(root.querySelector("details pre")?.textContent).toBe("<b>sidecar</b> missing");
    expect(root.querySelector("b")).toBeNull(); // the error is text, never HTML
  });

  it("follows the chosen language", async () => {
    await i18n.changeLanguage("en");
    const root = document.createElement("div");
    renderStartupError(root, "boom");
    expect(root.querySelector("h1")?.textContent).toBe(en.startup.title);
    expect(root.querySelector("details pre")?.textContent).toBe("boom");
  });
});
