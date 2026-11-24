import { describe, expect, it } from "vitest";
import { addonView, asAddonStatus, asAddonStatuses, megabytes } from "./addons";

const status = (extra: Record<string, unknown> = {}) => ({
  id: "mediapipe",
  available: true,
  installed: false,
  downloading: false,
  percent: 0,
  downloaded_mb: 0,
  total_mb: 0,
  size_hint_mb: 35,
  disk_mb: 0,
  ...extra,
});

describe("asAddonStatus (GET /api/settings/addons)", () => {
  it("reads a status and its error", () => {
    const parsed = asAddonStatus(status({ error_info: { code: "ADDON_DOWNLOAD_FAILED", title: "Gagal", message: "x", technical: "SHA-256 mismatch" } }));
    expect(parsed?.id).toBe("mediapipe");
    expect(parsed?.size_hint_mb).toBe(35);
    expect(parsed?.error_info?.technical).toBe("SHA-256 mismatch");
  });

  it("rejects anything that is not a status (old backend, mocked network)", () => {
    expect(asAddonStatus(undefined)).toBeNull();
    expect(asAddonStatus({ id: 3 })).toBeNull();
    expect(asAddonStatuses(undefined)).toEqual({});
    expect(asAddonStatuses({ status: "success" })).toEqual({});
    expect(asAddonStatuses({ status: "success", models: [] })).toEqual({});
    expect(Object.keys(asAddonStatuses({ status: "success", addons: { mediapipe: status(), junk: 1 } }))).toEqual(["mediapipe"]);
  });
});

describe("addonView", () => {
  it("names the state the card shows", () => {
    expect(addonView(null)).toBe("unknown");
    expect(addonView(asAddonStatus(status({ available: false })))).toBe("unavailable");
    expect(addonView(asAddonStatus(status()))).toBe("absent");
    expect(addonView(asAddonStatus(status({ downloading: true, percent: 40 })))).toBe("downloading");
    expect(addonView(asAddonStatus(status({ downloading: true, percent: 99, downloaded_mb: 35, total_mb: 35 })))).toBe("finishing");
    expect(addonView(asAddonStatus(status({ installed: true, available: false })))).toBe("installed");
  });
});

describe("addonView: finishing", () => {
  it("says finished only when every byte has arrived (the server floors the percent at 99)", () => {
    // 99 % of 528 MB still leaves about 5 MB to download.
    expect(addonView(asAddonStatus(status({ downloading: true, percent: 99, downloaded_mb: 523.1, total_mb: 527.5 })))).toBe("downloading");
    expect(addonView(asAddonStatus(status({ downloading: true, percent: 99, downloaded_mb: 527.5, total_mb: 527.5 })))).toBe("finishing");
    // Before the first bytes: 0 of 0 is not finished.
    expect(addonView(asAddonStatus(status({ downloading: true, percent: 99, downloaded_mb: 0, total_mb: 0 })))).toBe("downloading");
  });
});

describe("megabytes", () => {
  it("rounds to whole MB and never shows a negative or missing number", () => {
    expect(megabytes(527.5)).toBe("528");
    expect(megabytes(0.04)).toBe("0");
    expect(megabytes(Number.NaN)).toBe("0");
  });
});
