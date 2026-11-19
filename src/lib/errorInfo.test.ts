import { describe, expect, it } from "vitest";
import { asErrorInfo, localizedText, visibleActions } from "./errorInfo";

const RAW = {
  code: "YT_BOT_CHECK",
  title: "YouTube meminta verifikasi",
  message: "Unggah cookies.txt lalu coba lagi.",
  title_en: "YouTube asked for verification",
  message_en: "Upload cookies.txt and try again.",
  actions: [
    { id: "upload_cookies", label: "Unggah cookies.txt", label_en: "Upload cookies.txt" },
    { id: "open_settings", label: "Buka Pengaturan", label_en: "Open Settings" },
  ],
  technical: "Sign in to confirm you're not a bot",
};

describe("errorInfo", () => {
  it("reads a backend error_info", () => {
    const info = asErrorInfo(RAW);
    expect(info?.code).toBe("YT_BOT_CHECK");
    expect(info?.actions.map((a) => a.id)).toEqual(["upload_cookies", "open_settings"]);
  });

  it("returns null for something that is not an error_info", () => {
    expect(asErrorInfo(null)).toBeNull();
    expect(asErrorInfo({ code: "X" })).toBeNull();
  });

  it("shows the English text in English and falls back to Indonesian", () => {
    const info = asErrorInfo(RAW)!;
    expect(localizedText(info, "en").title).toBe("YouTube asked for verification");
    expect(localizedText({ ...info, title_en: "" }, "en").title).toBe("YouTube meminta verifikasi");
  });

  it("draws a button only for actions this app can carry out, with an optional label override", () => {
    const info = asErrorInfo(RAW)!;
    const actions = visibleActions(info, { upload_cookies: () => {} }, "id", { upload_cookies: "Pilih file" });
    expect(actions.map((a) => [a.id, a.label])).toEqual([["upload_cookies", "Pilih file"]]);
  });
});
