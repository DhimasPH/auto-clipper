import React from "react";
import { ErrorCard } from "./ErrorCard";
import { JobWarnings } from "./JobWarnings";
import { TimingDetails } from "./TimingDetails";
import { useErrorActions } from "../hooks/useErrorActions";
import { asErrorInfo } from "../lib/errorInfo";
import { canResumeJob, HistoryJobLike } from "../lib/history";

/** What a History entry says about how the job went: its error, its warnings and its timings. */
export const JobReport: React.FC<{ job: HistoryJobLike & { id: string; status?: string } }> = ({ job }) => {
  const meta = (job.metadata || {}) as Record<string, unknown>;
  const failed = job.status === "failed" || job.status === "ERROR";
  const info = failed ? asErrorInfo(meta.error_info) : null;
  const rawError = failed && typeof meta.error === "string" ? meta.error : "";
  const handlers = useErrorActions({ jobId: canResumeJob(job) ? job.id : null });

  return (
    <>
      {info ? (
        <ErrorCard info={info} handlers={handlers} />
      ) : rawError ? (
        // Jobs that failed before structured errors existed only have the raw text.
        <p className="text-body text-error whitespace-pre-wrap break-words m-0">{rawError}</p>
      ) : null}
      <JobWarnings warnings={meta.warnings} />
      <TimingDetails metadata={meta} />
    </>
  );
};

export default JobReport;
