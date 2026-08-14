import React, { useEffect, useState } from "react";
import { apiGetHistory, apiDeleteHistory } from "../api";
import type { JobResponse } from "../types/job";
import { Trash2, Play, CheckCircle2, Clock, AlertCircle } from "lucide-react";

interface HistoryListProps {
  onResume: (jobId: string) => void;
}

export const HistoryList: React.FC<HistoryListProps> = ({ onResume }) => {
  const [jobs, setJobs] = useState<JobResponse[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const data = await apiGetHistory();
      // Handle potential mismatch between TS type and actual API response structure
      // Spec note says: API returns { status: string, history: JobResponse[] }
      const historyList = Array.isArray(data) ? data : (data as any)?.history || [];
      setJobs(historyList);
      setError(null);
    } catch (err: any) {
      console.error("Failed to fetch history:", err);
      setError("Failed to load history.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleDelete = async (jobId: string) => {
    const previousJobs = [...jobs];
    setJobs((prev) => prev.filter((j) => j.id !== jobId));
    try {
      await apiDeleteHistory(jobId);
    } catch (err) {
      console.error("Failed to delete job:", err);
      setJobs(previousJobs);
      setError("Failed to delete job.");
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "DONE":
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case "AWAITING_MANUAL":
        return <Clock className="w-5 h-5 text-amber-400" />;
      case "ERROR":
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Clock className="w-5 h-5 text-amber-500 animate-spin" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 text-neutral-400">
        <Clock className="w-6 h-6 animate-spin mr-2" />
        <span>Loading history...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-900/20 border border-red-500/20 rounded-lg text-red-400">
        {error}
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="p-8 text-center bg-neutral-900 border border-neutral-800 rounded-lg">
        <p className="text-neutral-400">No processing history found.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {jobs.map((job) => (
        <div
          key={job.id}
          className="bg-neutral-900 border border-neutral-800 rounded-lg p-5 flex flex-col justify-between hover:border-amber-500/30 transition-colors"
        >
          <div>
            <div className="flex items-start justify-between mb-3">
              <h3 className="font-medium text-neutral-100 line-clamp-2" title={job.metadata?.title || job.id}>
                {job.metadata?.title || job.id}
              </h3>
              <div className="flex-shrink-0 ml-3" title={job.status}>
                {getStatusIcon(job.status)}
              </div>
            </div>
            
            <div className="space-y-2 mb-4 text-sm text-neutral-400">
              <div className="flex justify-between items-center bg-neutral-800/50 px-3 py-2 rounded">
                <span className="font-medium text-neutral-300">Status</span>
                <span className="text-xs px-2 py-1 bg-neutral-800 rounded-md">
                  {job.status.replace(/_/g, " ")}
                </span>
              </div>
              <div className="flex justify-between items-center bg-neutral-800/50 px-3 py-2 rounded">
                <span className="font-medium text-neutral-300">Progress</span>
                <span className="text-amber-400 font-medium">
                  {job.progress}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-neutral-800">
            {job.status === "AWAITING_MANUAL" && (
              <button
                onClick={() => onResume(job.id)}
                className="flex items-center px-3 py-1.5 text-sm font-medium text-neutral-900 bg-amber-400 hover:bg-amber-500 rounded-md transition-colors"
              >
                <Play className="w-4 h-4 mr-1" />
                Resume
              </button>
            )}
            <button
              onClick={() => handleDelete(job.id)}
              className="flex items-center px-3 py-1.5 text-sm font-medium text-red-400 hover:bg-red-900/30 hover:text-red-300 rounded-md transition-colors"
              title="Delete Job"
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};
