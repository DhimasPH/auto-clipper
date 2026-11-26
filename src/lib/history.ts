// Predicate helpers for the History view.

export interface HistoryJobLike {
  url?: string;
  metadata?: {
    url?: string;
    source_video?: string;
    ai_job?: boolean;
    highlights?: unknown[];
    [key: string]: unknown;
  } | null;
  [key: string]: unknown;
}

export function canResumeJob(job: HistoryJobLike | null | undefined): boolean {
  return !!(job && (job.metadata?.source_video || job.metadata?.url || job.url));
}
