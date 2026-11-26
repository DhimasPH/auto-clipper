import { describe, expect, it } from "vitest";
import { SPLASH_SEEN_KEY, markSplashSeen, msUntilSplashCloses, splashSeen, splashVisible } from "./splash";

function memory(): Storage {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  } as unknown as Storage;
}

const broken = {
  getItem: () => {
    throw new Error("blocked");
  },
  setItem: () => {
    throw new Error("blocked");
  },
} as unknown as Storage;

describe("splash (SP4 spec 4.3)", () => {
  it("remembers per tab that the splash was shown", () => {
    const s = memory();
    expect(splashSeen(s)).toBe(false);
    markSplashSeen(s);
    expect(s.getItem(SPLASH_SEEN_KEY)).toBe("1");
    expect(splashSeen(s)).toBe(true);
  });

  it("shows the splash once more when the tab storage cannot be used", () => {
    expect(splashSeen(broken)).toBe(false);
    expect(() => markSplashSeen(broken)).not.toThrow();
    expect(splashSeen(null)).toBe(false);
  });

  it("stays at least 0.8 s once the check answered and at most 2.5 s", () => {
    expect(msUntilSplashCloses(0, false)).toBe(2500);
    expect(msUntilSplashCloses(1000, false)).toBe(1500);
    expect(msUntilSplashCloses(100, true)).toBe(700);
    expect(msUntilSplashCloses(1200, true)).toBe(0);
    expect(msUntilSplashCloses(3000, false)).toBe(0);
  });

  it("desktop keeps today's rule, the web follows its own timer", () => {
    expect(splashVisible("startup", true, false)).toBe(true);
    expect(splashVisible("startup", false, true)).toBe(false);
    expect(splashVisible("tab", true, false)).toBe(false);
    expect(splashVisible("tab", false, true)).toBe(true);
  });
});
