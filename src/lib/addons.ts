import type { ErrorInfo } from "../types/errorInfo";
import { asErrorInfo } from "./errorInfo";

// Optional add-ons (SP3 spec 4.2.D): the answer of GET /api/settings/addons and what each card shows. No React.

export type AddonId = "cuda" | "mediapipe";

export interface AddonStatus {
  id: string;
  /** This computer can use it (cloud, no NVIDIA card or an Intel Mac: false). */
  available: boolean;
  installed: boolean;
  downloading: boolean;
  percent: number;
  downloaded_mb: number;
  total_mb: number;
  /** Download size before it starts. */
  size_hint_mb: number;
  /** Space it takes once installed. */
  disk_mb: number;
  error_info: ErrorInfo | null;
}

const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);

export function asAddonStatus(value: unknown): AddonStatus | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (typeof v.id !== "string" || !v.id) return null;
  return {
    id: v.id,
    available: v.available === true,
    installed: v.installed === true,
    downloading: v.downloading === true,
    percent: num(v.percent),
    downloaded_mb: num(v.downloaded_mb),
    total_mb: num(v.total_mb),
    size_hint_mb: num(v.size_hint_mb),
    disk_mb: num(v.disk_mb),
    error_info: asErrorInfo(v.error_info),
  };
}

/** The statuses in a GET /api/settings/addons answer; empty for an older server or anything unexpected. */
export function asAddonStatuses(data: unknown): Record<string, AddonStatus> {
  const addons = (data as { addons?: unknown } | null | undefined)?.addons;
  if (!addons || typeof addons !== "object" || Array.isArray(addons)) return {};
  const out: Record<string, AddonStatus> = {};
  for (const [key, raw] of Object.entries(addons)) {
    const status = asAddonStatus(raw);
    if (status) out[key] = status;
  }
  return out;
}

/**
 * What the card shows. "finishing": every byte has arrived and the backend is checking the files
 * and moving them into place, so the last moments are not shown as a stuck download. The percent
 * cannot tell: the backend rounds it down and holds it at 99 until the install is done.
 */
export type AddonView = "unknown" | "unavailable" | "absent" | "downloading" | "finishing" | "installed";

export function addonView(status: AddonStatus | null | undefined): AddonView {
  if (!status) return "unknown";
  if (status.downloading) return status.total_mb > 0 && status.downloaded_mb >= status.total_mb ? "finishing" : "downloading";
  if (status.installed) return "installed";
  if (!status.available) return "unavailable";
  return "absent";
}

/** Whole megabytes for the screen. */
export function megabytes(mb: number): string {
  return String(Number.isFinite(mb) && mb > 0 ? Math.round(mb) : 0);
}
