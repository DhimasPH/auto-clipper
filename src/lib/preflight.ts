import type { ErrorInfo, JobWarning } from "../types/errorInfo";

// GET /api/preflight results (backend/preflight.py) for the create screen (spec 4.4):
// "warn" becomes a small note, "block" an error card that keeps Mulai off.

export interface PreflightSplit {
  notes: JobWarning[];
  blockers: ErrorInfo[];
}

export function blockerInfo(check: JobWarning): ErrorInfo {
  return {
    code: check.code || check.id,
    title: check.title,
    message: check.message,
    title_en: check.title_en || "",
    message_en: check.message_en || "",
    actions: [],
    technical: check.technical || "",
  };
}

export function splitPreflight(checks: unknown): PreflightSplit {
  const result: PreflightSplit = { notes: [], blockers: [] };
  if (!Array.isArray(checks)) return result;
  for (const item of checks) {
    if (!item || typeof item !== "object") continue;
    const check = item as JobWarning;
    if (check.level === "warn") result.notes.push(check);
    else if (check.level === "block") result.blockers.push(blockerInfo(check));
  }
  return result;
}
