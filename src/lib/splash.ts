// When the splash closes (SP4 spec 4.3). No React here.

export const SPLASH_MIN_MS = 800;
export const SPLASH_MAX_MS = 2500;
/** sessionStorage key: the web splash shows once per tab. */
export const SPLASH_SEEN_KEY = "ac_splash_seen";

export function splashSeen(storage: Pick<Storage, "getItem"> | null): boolean {
  try {
    return storage?.getItem(SPLASH_SEEN_KEY) === "1";
  } catch {
    return false; // unreadable (private mode, blocked): show it once more
  }
}

export function markSplashSeen(storage: Pick<Storage, "setItem"> | null): void {
  try {
    storage?.setItem(SPLASH_SEEN_KEY, "1");
  } catch {
    // Not writable: the splash shows once per page load instead.
  }
}

/** How long the splash still stays: until 0.8 s once the connection check answered, else until 2.5 s. */
export function msUntilSplashCloses(elapsedMs: number, checked: boolean): number {
  return Math.max(0, (checked ? SPLASH_MIN_MS : SPLASH_MAX_MS) - elapsedMs);
}

/** Desktop ("startup") shows it while settings load, as before; the web ("tab") follows useWebSplash. */
export function splashVisible(mode: "startup" | "tab", isInitializing: boolean, webSplashShowing: boolean): boolean {
  return mode === "startup" ? isInitializing : webSplashShowing;
}
