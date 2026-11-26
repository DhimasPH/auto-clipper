import { detectPlatformKind } from "./select";
import type { Platform } from "./types";

export type * from "./types";
export { CAPS } from "./caps";

let current: Platform | null = null;

/** The platform of this run. Call loadPlatform() before rendering (main.tsx does). */
export function platform(): Platform {
  if (!current) throw new Error("Platform not loaded: call loadPlatform() before rendering.");
  return current;
}

/** For tests. */
export function setPlatform(next: Platform | null): void {
  current = next;
}

/** Choose and load the adapter. Tauri modules are only loaded on desktop. */
export async function loadPlatform(): Promise<Platform> {
  const kind = detectPlatformKind({
    hasTauri: typeof window !== "undefined" && "__TAURI_INTERNALS__" in window,
    target: import.meta.env.VITE_TARGET,
  });
  const adapter =
    kind === "desktop" ? await import("./desktop") : kind === "cloud" ? await import("./cloud") : await import("./local");
  current = adapter.createPlatform();
  return current;
}
