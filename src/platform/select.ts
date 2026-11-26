import type { PlatformKind } from "./types";

/** Tauri present → desktop; a VITE_TARGET=cloud build → cloud; anything else → local (spec 4.1). */
export function detectPlatformKind(env: { hasTauri: boolean; target?: string }): PlatformKind {
  if (env.hasTauri) return "desktop";
  if (env.target === "cloud") return "cloud";
  return "local";
}
