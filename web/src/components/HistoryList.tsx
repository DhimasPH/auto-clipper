import React, { useEffect, useState } from "react";
import { apiGetHistory, apiDeleteHistory, apiCreateRerenderJob, apiCreateRerunAiJob } from "../api";
import type { JobResponse } from "../types/job";
import { Trash2, Play, CheckCircle2, Clock, AlertCircle, RotateCcw, Sparkles, Film } from "lucide-react";
import { OutputStyleSelector, type OutputStyle } from "./OutputStyleSelector";
import { CanvasConfigControls } from "./ui/CanvasConfigControls";
import { SubtitleConfigControls } from "./ui/SubtitleConfigControls";
import { DEFAULT_SUBTITLE_CONFIG, type SubtitleConfig } from "../types/subtitle";
import { DEFAULT_CANVAS_CONFIG, type CanvasConfig } from "../types/canvas";

interface HistoryListProps {
  onResume: (jobId: string) => void;
  onResumeManual?: (jobId: string, prompt: string) => void;
  onViewResults?: (job: JobResponse) => void;
}

export const HistoryList: React.FC<HistoryListProps> = ({ onResume, onResumeManual, onViewResults }) => {
  const [jobs, setJobs] = useState<JobResponse[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [activeRerenderId, setActiveRerenderId] = useState<string | null>(null);
  const [outputStyle, setOutputStyle] = useState<OutputStyle>("face_crop");
  const [canvasConfig, setCanvasConfig] = useState<CanvasConfig>(DEFAULT_CANVAS_CONFIG);
  const [subtitleConfig, setSubtitleConfig] = useState<SubtitleConfig>(DEFAULT_SUBTITLE_CONFIG);

  const [activeAiId, setActiveAiId] = useState<string | null>(null);
  const [extraPrompt, setExtraPrompt] = useState<string>("");
  const [isSubmittingPanel, setIsSubmittingPanel] = useState(false);

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
      alert("Failed to delete job.");
    }
  };

  const handleRerenderSubmit = async (jobId: string) => {
    if (isSubmittingPanel) return;
    setIsSubmittingPanel(true);
    try {
      let aspectRatio = "9:16";
      if (outputStyle === "landscape" || (!canvasConfig.enabled && outputStyle === "canvas_blur")) aspectRatio = "16:9";
      if (outputStyle === "square") aspectRatio = "1:1";

      const payload = {
        aspect_ratio: aspectRatio,
        caption_style: subtitleConfig.style,
        canvas_config: canvasConfig,
        subtitle_config: subtitleConfig,
        burn_subs: true,
      };

      const res = await apiCreateRerenderJob(jobId, payload);
      if (res.job_id) {
        onResume(res.job_id);
      }
    } catch (err: any) {
      console.error("Failed to rerender:", err);
      alert(err.message || "Failed to start rerender job.");
    } finally {
      setIsSubmittingPanel(false);
      setActiveRerenderId(null);
    }
  };

  const handleAiCorrectSubmit = async (jobId: string) => {
    if (isSubmittingPanel) return;
    setIsSubmittingPanel(true);
    try {
      const res = await apiCreateRerunAiJob(jobId, { extra_prompt: extraPrompt });
      if (res.job_id) {
        onResume(res.job_id);
      }
    } catch (err: any) {
      console.error("Failed to rerun AI:", err);
      alert(err.message || "Failed to start AI correction job.");
    } finally {
      setIsSubmittingPanel(false);
      setActiveAiId(null);
      setExtraPrompt("");
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
      <div className="flex items-center justify-center p-12 text-text-tertiary">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-purple-600/30 border-t-purple-600 rounded-full animate-spin" />
          <span className="text-xs font-mono">Loading history...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
        {error}
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="p-12 text-center bg-white border border-border rounded-2xl shadow-sm">
        <p className="text-text-secondary text-sm">No processing history found.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6">
      {jobs.map((job) => {
        const isRealDone = job.status === "DONE";
        const isError = job.status === "ERROR";
        const clips = (job as any).result_clips || job.clips || [];

        return (
        <div
          key={job.id}
          className="bg-white border border-border rounded-2xl p-6 flex flex-col hover:border-purple-300 hover:shadow-md transition-all shadow-sm"
        >
          <div>
            <div className="flex items-start justify-between mb-3">
              <h3 className="font-semibold text-text-primary text-base line-clamp-2" title={job.metadata?.title || job.id}>
                {job.metadata?.title || job.id}
              </h3>
              <div className="flex-shrink-0 ml-3" title={job.status}>
                {getStatusIcon(job.status)}
              </div>
            </div>
            
            <div className="space-y-2 mb-4 text-sm text-text-secondary max-w-sm">
              <div className="flex justify-between items-center bg-bg-surface/60 px-3 py-2 rounded-xl">
                <span className="font-medium text-text-secondary">Status</span>
                <span className="text-xs px-2.5 py-1 bg-white border border-border rounded-lg text-text-primary font-medium">
                  {job.status.replace(/_/g, " ")}
                </span>
              </div>
              <div className="flex justify-between items-center bg-bg-surface/60 px-3 py-2 rounded-xl">
                <span className="font-medium text-text-secondary">Progress</span>
                <span className="text-purple-600 font-semibold text-xs">
                  {job.progress}
                </span>
              </div>
              
              {/* Job Metadata Details inline */}
              {job.metadata?.duration_seconds && (
                <div className="flex justify-between items-center bg-bg-surface/60 px-3 py-2 rounded-xl">
                  <span className="font-medium text-text-secondary">Duration</span>
                  <span className="text-xs px-2.5 py-1 bg-white border border-border rounded-lg text-text-primary font-medium">
                    {job.metadata.duration_seconds}s
                  </span>
                </div>
              )}
              {job.metadata?.quality && (
                <div className="flex justify-between items-center bg-bg-surface/60 px-3 py-2 rounded-xl">
                  <span className="font-medium text-text-secondary">Quality</span>
                  <span className="text-xs px-2.5 py-1 bg-white border border-border rounded-lg text-text-primary font-medium">
                    {job.metadata.quality}
                  </span>
                </div>
              )}
              {job.created_at && (
                <div className="flex justify-between items-center bg-bg-surface/60 px-3 py-2 rounded-xl">
                  <span className="font-medium text-text-secondary">Created At</span>
                  <span className="text-xs px-2.5 py-1 bg-white border border-border rounded-lg text-text-primary font-medium">
                    {new Date(job.created_at).toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end flex-wrap gap-2 pt-4 border-t border-border">
            {(isRealDone || job.status === "AWAITING_MANUAL" || isError) && (
              <button
                onClick={() => {
                  if (onResumeManual) {
                    onResumeManual(job.id, (job.metadata as any)?.ai_prompt || "");
                  } else {
                    onResume(job.id); // fallback
                  }
                }}
                className="flex items-center px-3.5 py-2 text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-700 hover:to-pink-600 rounded-xl transition-all shadow-sm shadow-purple-500/20"
              >
                <Play className="w-4 h-4 mr-1.5" />
                {job.status === "AWAITING_MANUAL" ? "Edit Prompt / JSON" : "Rerun from JSON"}
              </button>
            )}
            {isError && (
              <button
                onClick={() => onResume(job.id)}
                className="flex items-center px-3.5 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-xl transition-colors shadow-sm"
              >
                <RotateCcw className="w-4 h-4 mr-1.5" />
                Retry
              </button>
            )}
            {(isRealDone || job.status === "AWAITING_MANUAL" || isError) && (
              <button
                onClick={() => {
                  setActiveRerenderId(activeRerenderId === job.id ? null : job.id);
                  setSubtitleConfig(DEFAULT_SUBTITLE_CONFIG);
                  setCanvasConfig(DEFAULT_CANVAS_CONFIG);
                }}
                className="flex items-center px-3.5 py-2 text-sm font-medium text-text-secondary bg-bg-surface hover:bg-slate-200 border border-border rounded-xl transition-colors"
              >
                <Film className="w-4 h-4 mr-1.5 text-purple-600" />
                Rerender
              </button>
            )}
            {(isRealDone || job.status === "AWAITING_MANUAL" || isError) && job.metadata?.highlight_prompt && (
              <button
                onClick={() => {
                  setActiveAiId(activeAiId === job.id ? null : job.id);
                  setExtraPrompt("");
                  setSubtitleConfig(DEFAULT_SUBTITLE_CONFIG);
                  setCanvasConfig(DEFAULT_CANVAS_CONFIG);
                }}
                className="flex items-center px-3.5 py-2 text-sm font-medium text-text-secondary bg-bg-surface hover:bg-slate-200 border border-border rounded-xl transition-colors"
              >
                <Sparkles className="w-4 h-4 mr-1.5 text-purple-600" />
                AI Correct
              </button>
            )}
            {(isRealDone || clips.length > 0) && (
              <button
                onClick={() => onViewResults && onViewResults(job)}
                className="px-3.5 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2"
              >
                <Film className="w-4 h-4" />
                View Clips ({clips.length})
              </button>
            )}
            <button
              onClick={() => handleDelete(job.id)}
              className="flex items-center px-3 py-2 text-sm font-medium text-red-500 hover:bg-red-50 hover:text-red-600 rounded-xl transition-colors"
              title="Delete Job"
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Delete
            </button>
          </div>
          
          {/* Rerender Panel */}
          {activeRerenderId === job.id && (
            <div className="mt-4 p-5 border border-border rounded-2xl bg-bg-surface/30 animate-fadeIn">
              <h4 className="font-semibold text-text-primary mb-3">Rerender Settings</h4>
              <div className="space-y-4">
                <OutputStyleSelector value={outputStyle} onChange={(val) => {
                  setOutputStyle(val);
                  setCanvasConfig(prev => ({ ...prev, enabled: val === "canvas_blur" }));
                }} disabled={isSubmittingPanel} />
                {outputStyle === "canvas_blur" && (
                  <CanvasConfigControls config={canvasConfig} onChange={setCanvasConfig} showModeSwitch={false} />
                )}
                <SubtitleConfigControls config={subtitleConfig} onChange={setSubtitleConfig} showModeSwitch={true} />
                <button
                  onClick={() => handleRerenderSubmit(job.id)}
                  disabled={isSubmittingPanel}
                  className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-700 hover:to-pink-600 text-white font-bold rounded-xl transition-all shadow-md shadow-purple-500/20 disabled:opacity-50"
                >
                  {isSubmittingPanel ? "Submitting..." : "Submit Rerender"}
                </button>
              </div>
            </div>
          )}

          {/* AI Correction Panel */}
          {activeAiId === job.id && (
            <div className="mt-4 p-5 border border-border rounded-2xl bg-bg-surface/30 animate-fadeIn">
              <h4 className="font-semibold text-text-primary mb-1">AI Correction</h4>
              <p className="text-xs text-text-secondary mb-3">Provide extra instructions to adjust how AI creates highlights.</p>
              <textarea
                value={extraPrompt}
                onChange={(e) => setExtraPrompt(e.target.value)}
                placeholder="E.g. Focus more on the funny moments..."
                className="w-full bg-white border border-border rounded-xl p-3 text-sm text-text-primary mb-3 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
                rows={3}
              />
              <button
                onClick={() => handleAiCorrectSubmit(job.id)}
                disabled={isSubmittingPanel || !extraPrompt.trim()}
                className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-700 hover:to-pink-600 text-white font-bold rounded-xl transition-all shadow-md shadow-purple-500/20 disabled:opacity-50"
              >
                {isSubmittingPanel ? "Submitting..." : "Submit AI Correction"}
              </button>
            </div>
          )}

        </div>
      )})}
    </div>
  );
};
