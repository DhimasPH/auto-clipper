import type { Caps } from "../platform/types";
import { MANUAL_PROVIDER, effectiveProvider, type AiMode } from "./createFlow";
import { projectStatusKey } from "./projectStatus";

// "Pilih ulang momen" (SP4 spec 4.4). No React here.

/** Same limit as REPICK_EXTRA_MAX in backend/main.py. */
export const REPICK_EXTRA_MAX = 500;
/** Same upper bound as RerunManualRequest.max_clips in backend/main.py. */
export const REPICK_MAX_CLIPS = 50;

export type RepickMode = "manual" | "api";

interface RepickJobLike {
  status?: string | null;
  metadata?: { subtitle_path?: unknown; [key: string]: unknown } | null;
}

/** Finished projects that kept their spoken text (the backend reads it again, nothing is transcribed again). */
export function canRepick(job: RepickJobLike | null | undefined): boolean {
  if (!job || projectStatusKey(job) !== "done") return false;
  const path = job.metadata?.subtitle_path;
  return typeof path === "string" && path.trim() !== "";
}

/** The same provider rule as every start and resume (E.20): manual AI means rerun-manual. */
export function repickMode(caps: Pick<Caps, "apiKeys">, aiMode: AiMode, provider: string): RepickMode {
  return effectiveProvider(caps, aiMode, provider) === MANUAL_PROVIDER ? "manual" : "api";
}

/** The optional clip count: empty, zero or not a number means "choose automatically" (0). */
export function parseClipCount(text: string): number {
  const n = Number.parseInt(text.trim(), 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, REPICK_MAX_CLIPS) : 0;
}
