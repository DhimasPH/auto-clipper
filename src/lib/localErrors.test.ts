import { beforeAll, describe, expect, it } from "vitest";
import i18n from "../i18n";
import { LOCAL_ERROR_CODES, localErrorInfo } from "./localErrors";

describe("localErrorInfo", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("id");
  });

  it.each(LOCAL_ERROR_CODES)("%s has Indonesian and English text from src/locales", (code) => {
    const info = localErrorInfo(code, "detail");

    expect(info.code).toBe(code);
    expect(info.technical).toBe("detail");
    for (const text of [info.title, info.message, info.title_en, info.message_en]) {
      expect(text).toBeTruthy();
      expect(text).not.toContain("local_error.");
    }
    expect(info.title).not.toBe(info.title_en);
    for (const action of info.actions) {
      expect(action.label).not.toContain("local_error.");
      expect(action.label_en).not.toContain("local_error.");
    }
  });

  it("offers to try a refused video link again", () => {
    const info = localErrorInfo("VIDEO_LINK_REFUSED");
    expect(info.actions.map((a) => [a.id, a.label, a.label_en])).toEqual([["retry", "Coba lagi", "Try again"]]);
  });
});
