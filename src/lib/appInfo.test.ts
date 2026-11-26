import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import pkg from "../../package.json";
import {
  APP_NAME,
  COPYRIGHT_HOLDER,
  RELEASES_URL_PREFIX,
  REPO_URL,
  SOCIAL_LINKS,
  SUPPORT_LINK,
  appVersion,
  copyrightLine,
} from "./appInfo";

describe("appInfo (SP4 spec 4.1)", () => {
  it("names the app and its maker", () => {
    expect(APP_NAME).toBe("Auto Clipper");
    expect(COPYRIGHT_HOLDER).toBe("Dhimas Panjie Herlambang");
  });

  it("reads the version Vite put in from package.json", () => {
    expect(appVersion()).toBe(pkg.version);
  });

  it("keeps the desktop app version equal to package.json", () => {
    const tauri = JSON.parse(readFileSync("src-tauri/tauri.conf.json", "utf8"));
    expect(tauri.version).toBe(pkg.version);
    const cargo = readFileSync("src-tauri/Cargo.toml", "utf8");
    expect(cargo).toMatch(new RegExp(`^version = "${pkg.version.replace(/\./g, "\\.")}"`, "m"));
  });

  it("writes the copyright with the year of the given date", () => {
    expect(copyrightLine(new Date(2031, 0, 1))).toBe("\u00A9 2031 Dhimas Panjie Herlambang");
    expect(copyrightLine()).toBe(`\u00A9 ${new Date().getFullYear()} Dhimas Panjie Herlambang`);
  });

  it("lists the eight links in the agreed order, each unique and https", () => {
    expect(SOCIAL_LINKS.map((l) => l.id)).toEqual([
      "tiktok", "youtube", "instagram", "threads", "github", "facebook", "discord", "trakteer",
    ]);
    expect(new Set(SOCIAL_LINKS.map((l) => l.href)).size).toBe(8);
    for (const link of SOCIAL_LINKS) {
      expect(link.href.startsWith("https://"), link.id).toBe(true);
      expect(link.iconPath.length, link.id).toBeGreaterThan(40);
      expect(link.name.trim(), link.id).not.toBe("");
    }
    expect(SOCIAL_LINKS.find((l) => l.id === "discord")!.kind).toBe("community");
    expect(SUPPORT_LINK.id).toBe("trakteer");
    expect(SOCIAL_LINKS.filter((l) => l.kind === "support")).toEqual([SUPPORT_LINK]);
  });

  it("keeps the release links inside the repository", () => {
    expect(SOCIAL_LINKS.find((l) => l.id === "github")!.href).toBe(REPO_URL);
    expect(RELEASES_URL_PREFIX).toBe(`${REPO_URL}/releases/`);
  });

  it("is the only app file in src/ that holds the link addresses", () => {
    // Tests may name an address to check it; app code must import it from here.
    const files = (readdirSync("src", { recursive: true }) as string[]).filter(
      (f) => /\.(ts|tsx)$/.test(f) && !/\.test\.tsx?$/.test(f) && !/appInfo\.ts$/.test(f),
    );
    const needles = SOCIAL_LINKS.map((l) => {
      const url = new URL(l.href);
      return `${url.host}${url.pathname}`.replace(/\/$/, "");
    });
    const hits = files.flatMap((f) => {
      const text = readFileSync(join("src", f), "utf8");
      return needles.filter((n) => text.includes(n)).map((n) => `${f}: ${n}`);
    });
    expect(hits).toEqual([]);
  });
});
