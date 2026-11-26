import { describe, expect, it } from "vitest";
import { asUpdateCheck, updateNoticeView } from "./updateNotice";

const ZIP = "https://github.com/DhimasPH/auto-clipper/releases/download/app-v1.20.0/Auto-Clipper-Web-windows.zip";
const PAGE = "https://github.com/DhimasPH/auto-clipper/releases/tag/app-v1.20.0";
const OK = { current: "1.19.0", latest: "1.20.0", update_available: true, download_url: ZIP, release_url: PAGE, checked_at: 1 };

describe("updateNotice (SP4 spec 4.5)", () => {
  it("reads a server answer and keeps only links inside the repository's releases", () => {
    expect(asUpdateCheck(OK)).toEqual({ latest: "1.20.0", updateAvailable: true, link: ZIP, failed: false });
    expect(asUpdateCheck({ ...OK, download_url: "https://evil.example/x.zip" })!.link).toBe(PAGE);
    expect(asUpdateCheck({ ...OK, download_url: null, release_url: "https://github.com/DhimasPH/auto-clipper-evil/releases/x" })!.link).toBeNull();
    expect(asUpdateCheck({ ...OK, error: "offline" })!.failed).toBe(true);
    expect(asUpdateCheck(null)).toBeNull();
    expect(asUpdateCheck("x")).toBeNull();
  });

  it("picks what Bantuan shows", () => {
    const ok = asUpdateCheck(OK);
    expect(updateNoticeView("idle", null)).toBe("checking");
    expect(updateNoticeView("checking", ok)).toBe("checking");
    expect(updateNoticeView("done", ok)).toBe("available");
    expect(updateNoticeView("done", asUpdateCheck({ ...OK, update_available: false }))).toBe("latest");
    expect(updateNoticeView("done", asUpdateCheck({ ...OK, update_available: false, latest: null, error: "offline" }))).toBe("failed");
    expect(updateNoticeView("done", null)).toBe("failed");
    expect(updateNoticeView("done", asUpdateCheck({ ...OK, download_url: null, release_url: null }))).toBe("failed");
  });
});
