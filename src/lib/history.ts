// Predicate helpers for the History view.

export interface HistoryJobLike {
  metadata?: {
    ai_job?: boolean;
    highlights?: unknown[];
    [key: string]: unknown;
  } | null;
}

/**
 * Whether a history entry can be re-run through the AI selection ("AI Koreksi").
 *
 * The backend sets metadata.ai_job on AI jobs that produced highlights
 * (see _finalize_job). The button previously keyed off metadata.transcript,
 * which is never written, so it never appeared.
 */
export function canRerunAI(job: HistoryJobLike | null | undefined): boolean {
  return !!(job && job.metadata && job.metadata.ai_job);
}
