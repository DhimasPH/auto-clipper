// Riwayat (spec 4.5): a project's status in plain words and its one primary button. No React here.

import { canResumeJob, type HistoryJobLike } from "./history";

export type ProjectStatusKey = "done" | "failed" | "awaiting" | "running" | "queued" | "cancelled";
export type ProjectPrimaryAction = "view_clips" | "paste_answer" | "resume" | "retry" | "view_progress";

export function projectStatusKey(
  job: { status?: string | null; queue_position?: number | null },
  isQueued = false,
): ProjectStatusKey {
  const s = (job.status || "").toUpperCase();
  if (s === "DONE" || s === "COMPLETED") return "done";
  if (s === "ERROR" || s === "FAILED") return "failed";
  if (s === "AWAITING_MANUAL") return "awaiting";
  if (s === "CANCELLED") return "cancelled";
  if (isQueued || s === "PENDING" || s === "QUEUED" || (typeof job.queue_position === "number" && job.queue_position > 0)) {
    return "queued";
  }
  return "running";
}

export function projectPrimaryAction(
  job: HistoryJobLike & { status?: string | null; queue_position?: number | null },
  isQueued = false,
): ProjectPrimaryAction | null {
  const key = projectStatusKey(job, isQueued);
  if (key === "done") return "view_clips";
  if (key === "awaiting") return "paste_answer";
  if (key === "failed") return canResumeJob(job) ? "resume" : null;
  if (key === "cancelled") return canResumeJob(job) ? "retry" : null;
  return "view_progress";
}

export function formatProjectDate(value: string | undefined | null, lang: "id" | "en"): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(lang === "en" ? "en-US" : "id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
