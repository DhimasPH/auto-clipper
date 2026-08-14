import { useState, useEffect, useRef, useCallback } from "react";
import type { JobStatus, JobResponse, Clip, CreateJobPayload } from "../types/job";
import { apiGetJob, apiCreateJob, apiResumeManualJob, apiCancelJob } from "../api";

export const STORAGE_ACTIVE_JOB_KEY = "ac_active_job_id";

export interface UseJobPollingReturn {
  jobId: string | null;
  status: JobStatus;
  progress: string;
  prompt: string;
  clips: Clip[];
  error: string | null;
  failedCount: number;
  isPolling: boolean;
  isLoading: boolean;
  activeJob: JobResponse | null;
  startPolling: (id: string) => void;
  stopPolling: () => void;
  resetJob: () => void;
  cancelCurrentJob: () => Promise<void>;
  createAndStartJob: (payload: CreateJobPayload) => Promise<string>;
  resumeJobWithJson: (jsonPayload: string) => Promise<string>;
  fetchJobNow: (id?: string) => Promise<JobResponse | null>;
}

export function useJobPolling(initialJobId?: string | null): UseJobPollingReturn {
  const [jobId, setJobId] = useState<string | null>(() => {
    if (initialJobId) return initialJobId;
    if (typeof window !== "undefined") {
      return localStorage.getItem(STORAGE_ACTIVE_JOB_KEY) || null;
    }
    return null;
  });

  const [status, setStatus] = useState<JobStatus>("IDLE");
  const [progress, setProgress] = useState<string>("");
  const [prompt, setPrompt] = useState<string>("");
  const [clips, setClips] = useState<Clip[]>([]);
  const [failedCount, setFailedCount] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [activeJob, setActiveJob] = useState<JobResponse | null>(null);

  const pollIntervalRef = useRef<any>(null);
  const activeJobIdRef = useRef<string | null>(jobId);

  useEffect(() => {
    activeJobIdRef.current = jobId;
    if (typeof window !== "undefined") {
      if (jobId) {
        localStorage.setItem(STORAGE_ACTIVE_JOB_KEY, jobId);
      } else {
        localStorage.removeItem(STORAGE_ACTIVE_JOB_KEY);
      }
    }
  }, [jobId]);

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    setIsPolling(false);
  }, []);

  const fetchJobNow = useCallback(
    async (targetId?: string): Promise<JobResponse | null> => {
      const idToFetch = targetId || activeJobIdRef.current;
      if (!idToFetch) return null;

      try {
        const job = await apiGetJob(idToFetch);
        setActiveJob(job);
        setStatus(job.status);
        setProgress(job.progress || "");
        
        if (job.metadata?.manual_prompt) {
          setPrompt(job.metadata.manual_prompt);
        }

        if (job.clips && job.clips.length > 0) {
          setClips(job.clips);
        }

        if (job.failed != null) {
          setFailedCount(job.failed);
        }

        if (job.error) {
          setError(job.error);
        }

        // Terminal & awaiting manual states stop polling
        if (
          job.status === "DONE" ||
          job.status === "ERROR" ||
          job.status === "CANCELLED" ||
          job.status === "AWAITING_MANUAL"
        ) {
          stopPolling();
        }

        return job;
      } catch (err: any) {
        console.error("Error polling job:", err);
        if (err?.status === 404) {
          setStatus("ERROR");
          setError("Pekerjaan (Job) tidak ditemukan. Mungkin sudah dihapus atau server di-restart.");
          stopPolling();
        }
        return null;
      }
    },
    [stopPolling]
  );

  const startPolling = useCallback(
    (id: string) => {
      if (!id) return;
      setJobId(id);
      activeJobIdRef.current = id;
      setIsPolling(true);
      setError(null);

      // Immediate first fetch
      fetchJobNow(id);

      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }

      pollIntervalRef.current = setInterval(() => {
        fetchJobNow(id);
      }, 1800);
    },
    [fetchJobNow]
  );

  // Auto-start polling if jobId exists on mount
  useEffect(() => {
    if (jobId) {
      startPolling(jobId);
    }
    return () => {
      stopPolling();
    };
  }, []);

  const createAndStartJob = useCallback(
    async (payload: CreateJobPayload): Promise<string> => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await apiCreateJob(payload);
        if (res.status === "success" && res.job_id) {
          const newId = res.job_id;
          setJobId(newId);
          setStatus("PENDING");
          setProgress("Initializing job...");
          setClips([]);
          setPrompt("");
          startPolling(newId);
          return newId;
        } else {
          throw new Error(res.message || "Failed to create job");
        }
      } catch (err: any) {
        const msg = err?.message || "Failed to submit job to server";
        setError(msg);
        setStatus("ERROR");
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [startPolling]
  );

  const resumeJobWithJson = useCallback(
    async (jsonPayload: string): Promise<string> => {
      const currentId = activeJobIdRef.current;
      if (!currentId) {
        throw new Error("No active job to resume");
      }

      setIsLoading(true);
      setError(null);
      try {
        const res = await apiResumeManualJob(currentId, jsonPayload);
        if (res.status === "success") {
          const resumedJobId = res.job_id || currentId;
          setJobId(resumedJobId);
          setStatus("PENDING");
          setProgress("Rendering highlights...");
          startPolling(resumedJobId);
          return resumedJobId;
        } else {
          throw new Error(res.message || "Failed to resume manual job");
        }
      } catch (err: any) {
        const msg = err?.message || "Failed to submit AI highlights";
        setError(msg);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [startPolling]
  );

  const cancelCurrentJob = useCallback(async () => {
    const currentId = activeJobIdRef.current;
    stopPolling();
    setStatus("CANCELLED");
    setProgress("Cancelled by user.");

    if (currentId) {
      try {
        await apiCancelJob(currentId);
      } catch (err) {
        console.warn("Failed to cancel job on server:", err);
      }
    }
  }, [stopPolling]);

  const resetJob = useCallback(() => {
    stopPolling();
    setJobId(null);
    activeJobIdRef.current = null;
    setStatus("IDLE");
    setProgress("");
    setPrompt("");
    setClips([]);
    setFailedCount(0);
    setError(null);
    setActiveJob(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_ACTIVE_JOB_KEY);
    }
  }, [stopPolling]);

  return {
    jobId,
    status,
    progress,
    prompt,
    clips,
    error,
    failedCount,
    isPolling,
    isLoading,
    activeJob,
    startPolling,
    stopPolling,
    resetJob,
    cancelCurrentJob,
    createAndStartJob,
    resumeJobWithJson,
    fetchJobNow,
  };
}

export default useJobPolling;
