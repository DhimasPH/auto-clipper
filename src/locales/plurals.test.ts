import { afterEach, describe, expect, it } from "vitest";
import i18n from "../i18n";

describe("plural texts (SP2 deferred minor)", () => {
  afterEach(() => i18n.changeLanguage("id"));

  it("says 1 clip, not 1 clips, in English", async () => {
    await i18n.changeLanguage("en");
    expect(i18n.t("result.title_done", { count: 1 })).toBe("1 clip ready");
    expect(i18n.t("result.title_done", { count: 2 })).toBe("2 clips ready");
    expect(i18n.t("result.title_partial", { count: 1 })).toBe("1 clip done, the rest are being made");
    expect(i18n.t("result.failed", { count: 1 })).toBe("1 clip could not be made.");
  });

  it("keeps the one Indonesian form", async () => {
    await i18n.changeLanguage("id");
    expect(i18n.t("result.title_done", { count: 1 })).toBe("1 klip siap");
    expect(i18n.t("result.failed", { count: 3 })).toBe("3 klip gagal dibuat.");
  });
});
