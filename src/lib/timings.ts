// Turns the stage timings of a job (backend/stage_timer.py) into rows for "Detail waktu".

export interface StageRow {
  stage: string;
  /** How many times the stage ran (once per clip for tracking and render). */
  count: number;
  seconds: number;
  /** Highest memory use seen in the stage, in MB. null when it was not measured. */
  peakMb: number | null;
  failed: boolean;
}

const DEVICE_FIELDS = ["whisper_device", "encoder", "tracking_engine_used"] as const;
export type DeviceField = (typeof DEVICE_FIELDS)[number];
export type DevicesUsed = Partial<Record<DeviceField, string>>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

/** One row per stage, in the order the stages first ran. */
export function summarizeTimings(timings: unknown): StageRow[] {
  if (!Array.isArray(timings)) return [];
  const rows = new Map<string, StageRow>();
  for (const entry of timings) {
    if (!isRecord(entry) || typeof entry.stage !== "string" || !entry.stage) continue;
    const seconds = typeof entry.seconds === "number" && isFinite(entry.seconds) ? entry.seconds : 0;
    const peak = typeof entry.rss_mb_peak === "number" && isFinite(entry.rss_mb_peak) ? entry.rss_mb_peak : null;
    const row = rows.get(entry.stage) || { stage: entry.stage, count: 0, seconds: 0, peakMb: null, failed: false };
    row.count += 1;
    row.seconds += seconds;
    if (peak !== null) row.peakMb = row.peakMb === null ? peak : Math.max(row.peakMb, peak);
    if (entry.ok === false) row.failed = true;
    rows.set(entry.stage, row);
  }
  return [...rows.values()];
}

export function totalSeconds(rows: StageRow[]): number {
  return rows.reduce((sum, row) => sum + row.seconds, 0);
}

/** The devices that really did the work: from the job metadata, else from the last stage that names one. */
export function devicesUsed(metadata: unknown): DevicesUsed {
  const used: DevicesUsed = {};
  if (!isRecord(metadata)) return used;
  const timings = Array.isArray(metadata.timings) ? metadata.timings : [];
  for (const field of DEVICE_FIELDS) {
    let value = typeof metadata[field] === "string" ? (metadata[field] as string) : "";
    for (const entry of timings) {
      if (isRecord(entry) && typeof entry[field] === "string" && entry[field]) value = entry[field] as string;
    }
    if (value) used[field] = value;
  }
  return used;
}

export interface DurationUnits {
  hour: string;
  minute: string;
  second: string;
}

/** "45 dtk", "3 mnt 12 dtk", "1 jam 4 mnt". */
export function formatDuration(seconds: number, units: DurationUnits): string {
  const total = Math.max(0, Math.round(seconds));
  if (total < 1) return `< 1 ${units.second}`;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return m > 0 ? `${h} ${units.hour} ${m} ${units.minute}` : `${h} ${units.hour}`;
  if (m > 0) return s > 0 ? `${m} ${units.minute} ${s} ${units.second}` : `${m} ${units.minute}`;
  return `${s} ${units.second}`;
}

/** "850 MB", "1,2 GB" (decimal mark follows the locale). */
export function formatMemory(mb: number | null, locale: string): string {
  if (mb === null) return "";
  if (mb >= 1024) return `${(mb / 1024).toLocaleString(locale, { maximumFractionDigits: 1 })} GB`;
  return `${Math.round(mb).toLocaleString(locale)} MB`;
}
