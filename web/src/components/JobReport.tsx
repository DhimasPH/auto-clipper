import React from "react";
import { ErrorCard } from "./ErrorCard";
import { JobWarnings } from "./JobWarnings";
import { TimingDetails } from "./TimingDetails";
import { useErrorActions } from "../hooks/useErrorActions";
import { asErrorInfo } from "../lib/errorInfo";
import type { JobResponse } from "../types/job";

interface JobReportProps {
  job: JobResponse;
  /** Runs the failed job again (History resumes it and opens the Workspace). */
  onResume: (jobId: string) => void;
}

/** What a History entry says about how the job went: its error, its warnings and its timings. */
export const JobReport: React.FC<JobReportProps> = ({ job, onResume }) => {
  const meta = job.metadata || {};
  const failed = job.status === "ERROR";
  const info = failed ? asErrorInfo(meta.error_info ?? job.error_info) : null;
  const rawError = failed ? meta.error || job.error || "" : "";
  const { handlers, labels } = useErrorActions({ jobId: job.id, onResume });

  return (
    <>
      {info ? (
        <ErrorCard info={info} handlers={handlers} labels={labels} className="mb-4" />
      ) : rawError ? (
        // Jobs that failed before structured errors existed only have the raw text.
        <p className="text-sm text-red-600 whitespace-pre-wrap break-words mb-4">{rawError}</p>
      ) : null}
      <JobWarnings warnings={meta.warnings} className="mb-4" />
      <TimingDetails metadata={meta} className="mb-4" />
    </>
  );
};

export default JobReport;
