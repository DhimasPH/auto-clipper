import { afterEach, describe, expect, it } from "vitest";
import i18n from "./i18n";

describe("language", () => {
  afterEach(() => i18n.changeLanguage("id"));

  it("sets <html lang> so screen readers read the right language", async () => {
    await i18n.changeLanguage("en");
    expect(document.documentElement.lang).toBe("en");
    await i18n.changeLanguage("id");
    expect(document.documentElement.lang).toBe("id");
  });

  it("remembers the chosen language for the next visit", async () => {
    await i18n.changeLanguage("en");
    expect(localStorage.getItem("ac_lang")).toBe("en");
  });
});
