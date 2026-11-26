import type { Clip } from "../components/ClipCard";

// What the result card says about a clip (spec 4.5): its AI title and its length.

/** "00:01:05.500", "1:05", "00:00:07,250" or a number of seconds. */
export function timeToSeconds(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) && value >= 0 ? value : null;
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^(\d{1,2}:)?(\d{1,2}):(\d{1,2})([.,]\d+)?$/);
  if (!match) return null;
  const hours = match[1] ? Number(match[1].slice(0, -1)) : 0;
  const fraction = match[4] ? Number(`0.${match[4].slice(1)}`) : 0;
  return hours * 3600 + Number(match[2]) * 60 + Number(match[3]) + fraction;
}

export function clipSeconds(clip: { start?: unknown; end?: unknown }): number | null {
  const start = timeToSeconds(clip.start);
  const end = timeToSeconds(clip.end);
  return start !== null && end !== null && end > start ? Math.round((end - start) * 10) / 10 : null;
}

/** "0:45", "1:02:05". */
export function formatClock(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

export function clipTitle(clip: Clip, lang: "id" | "en"): string | null {
  const titles = lang === "en" ? clip.social?.titles_en : clip.social?.titles_id;
  const description = lang === "en" ? clip.description_en : clip.description_id;
  return titles?.find((x) => x?.trim())?.trim() || description?.trim() || clip.description?.trim() || null;
}
