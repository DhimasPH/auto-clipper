import { RELEASES_URL_PREFIX } from "./appInfo";

// Auto Clipper Web's update notice (SP4 spec 4.5): GET /api/update-check and what Bantuan shows. No React here.

export interface UpdateCheck {
  latest: string | null;
  updateAvailable: boolean;
  /** The zip for this system, else the release page; only links inside the repository's releases. */
  link: string | null;
  /** The server could not ask GitHub (offline, rate limit, odd answer). */
  failed: boolean;
}

const trusted = (value: unknown): string | null =>
  typeof value === "string" && value.startsWith(RELEASES_URL_PREFIX) ? value : null;

export function asUpdateCheck(data: unknown): UpdateCheck | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const d = data as Record<string, unknown>;
  return {
    latest: typeof d.latest === "string" ? d.latest : null,
    updateAvailable: d.update_available === true,
    link: trusted(d.download_url) ?? trusted(d.release_url),
    failed: typeof d.error === "string" && d.error !== "",
  };
}

export type UpdatePhase = "idle" | "checking" | "done";
export type UpdateNoticeView = "checking" | "available" | "latest" | "failed";

export function updateNoticeView(phase: UpdatePhase, result: UpdateCheck | null): UpdateNoticeView {
  if (phase !== "done") return "checking";
  if (!result || result.failed) return "failed";
  if (result.updateAvailable) return result.latest && result.link ? "available" : "failed";
  return "latest";
}
