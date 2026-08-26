import React, { useEffect, useState } from "react";
import { apiGetHistory, apiDeleteHistory, apiCreateRerenderJob, apiCreateRerunAiJob } from "../api";
import type { JobResponse } from "../types/job";
import { Trash2, Play, CheckCircle2, Clock, AlertCircle, RotateCcw, Sparkles, Film } from "lucide-react";
import { OutputStyleSelector, type OutputStyle } from "./OutputStyleSelector";
import { SubtitlePresetBar } from "./SubtitlePresetBar";
import { FontSelector } from "./FontSelector";
import { SUBTITLE_PRESETS, DEFAULT_SUBTITLE_CONFIG, type SubtitlePresetKey, type SubtitleConfig } from "../types/subtitle";
import { DEFAULT_CANVAS_CONFIG } from "../types/canvas";

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
  const [subtitlePreset, setSubtitlePreset] = useState<SubtitlePresetKey>("viral_pop");
  const [customFont, setCustomFont] = useState<string>("");

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
      const presetBase = SUBTITLE_PRESETS[subtitlePreset]?.config || {};
      const finalFont = customFont || presetBase.font_family || "Arial";
      
      const subtitleConfig: SubtitleConfig = {
        ...DEFAULT_SUBTITLE_CONFIG,
        ...presetBase,
        font_family: finalFont,
      };

      let aspectRatio = "9:16";
      if (outputStyle === "landscape") aspectRatio = "16:9";
      if (outputStyle === "square") aspectRatio = "1:1";

      const payload = {
        aspect_ratio: aspectRatio,
        caption_style: subtitlePreset === "podcast" ? "karaoke" : subtitlePreset === "viral_pop" ? "single_word" : "standard",
        canvas_config: { ...DEFAULT_CANVAS_CONFIG, enabled: outputStyle === "canvas_blur" },
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
    <div className="grid grid-cols-1 gap-6">
      {jobs.map((job) => {
        const isRealDone = job.status === "DONE";
        const isError = job.status === "ERROR";
        const clips = (job as any).result_clips || job.clips || [];

        return (
        <div
          key={job.id}
          className="bg-neutral-900 border border-neutral-800 rounded-lg p-5 flex flex-col hover:border-amber-500/30 transition-colors"
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
            
            <div className="space-y-2 mb-4 text-sm text-neutral-400 max-w-sm">
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
              
              {/* Job Metadata Details inline */}
              {job.metadata?.duration_seconds && (
                <div className="flex justify-between items-center bg-neutral-800/50 px-3 py-2 rounded">
                  <span className="font-medium text-neutral-300">Duration</span>
                  <span className="text-xs px-2 py-1 bg-neutral-800 rounded-md">
                    {job.metadata.duration_seconds}s
                  </span>
                </div>
              )}
              {job.metadata?.quality && (
                <div className="flex justify-between items-center bg-neutral-800/50 px-3 py-2 rounded">
                  <span className="font-medium text-neutral-300">Quality</span>
                  <span className="text-xs px-2 py-1 bg-neutral-800 rounded-md">
                    {job.metadata.quality}
                  </span>
                </div>
              )}
              {job.created_at && (
                <div className="flex justify-between items-center bg-neutral-800/50 px-3 py-2 rounded">
                  <span className="font-medium text-neutral-300">Created At</span>
                  <span className="text-xs px-2 py-1 bg-neutral-800 rounded-md">
                    {new Date(job.created_at).toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end flex-wrap gap-2 pt-4 border-t border-neutral-800">
            {(isRealDone || job.status === "AWAITING_MANUAL" || isError) && (
              <button
                onClick={() => {
                  if (onResumeManual && (job.metadata as any)?.ai_prompt) {
                    onResumeManual(job.id, (job.metadata as any).ai_prompt);
                  } else {
                    onResume(job.id); // fallback
                  }
                }}
                className="flex items-center px-3 py-1.5 text-sm font-medium text-neutral-900 bg-amber-400 hover:bg-amber-500 rounded-md transition-colors"
              >
                <Play className="w-4 h-4 mr-1" />
                {job.status === "AWAITING_MANUAL" ? "Edit Prompt / JSON" : "Rerun from JSON"}
              </button>
            )}
            {isError && (
              <button
                onClick={() => onResume(job.id)}
                className="flex items-center px-3 py-1.5 text-sm font-medium text-neutral-900 bg-amber-400 hover:bg-amber-500 rounded-md transition-colors"
              >
                <RotateCcw className="w-4 h-4 mr-1" />
                Retry
              </button>
            )}
            {(isRealDone || job.status === "AWAITING_MANUAL" || isError) && (
              <button
                onClick={() => {
                  setActiveRerenderId(activeRerenderId === job.id ? null : job.id);
                  setCustomFont("");
                }}
                className="flex items-center px-3 py-1.5 text-sm font-medium text-neutral-300 bg-neutral-800 hover:bg-neutral-700 rounded-md transition-colors"
              >
                <Film className="w-4 h-4 mr-1" />
                Rerender
              </button>
            )}
            {(isRealDone || job.status === "AWAITING_MANUAL" || isError) && job.metadata?.highlight_prompt && (
              <button
                onClick={() => {
                  setActiveAiId(activeAiId === job.id ? null : job.id);
                  setExtraPrompt("");
                  setCustomFont(""); // Reset as requested
                }}
                className="flex items-center px-3 py-1.5 text-sm font-medium text-neutral-300 bg-neutral-800 hover:bg-neutral-700 rounded-md transition-colors"
              >
                <Sparkles className="w-4 h-4 mr-1" />
                AI Correct
              </button>
            )}
            {(isRealDone || clips.length > 0) && (
              <button
                onClick={() => onViewResults && onViewResults(job)}
                className="px-3 py-1.5 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
              >
                <Film className="w-4 h-4" />
                View Clips ({clips.length})
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
          
          {/* Rerender Panel */}
          {activeRerenderId === job.id && (
            <div className="mt-4 p-4 border border-neutral-800 rounded-lg bg-neutral-950 animate-fadeIn">
              <h4 className="font-medium text-neutral-200 mb-3">Rerender Settings</h4>
              <div className="space-y-4">
                <OutputStyleSelector value={outputStyle} onChange={(val) => setOutputStyle(val)} disabled={isSubmittingPanel} />
                <SubtitlePresetBar value={subtitlePreset} onChange={(val) => setSubtitlePreset(val)} disabled={isSubmittingPanel} />
                <FontSelector value={customFont} onChange={setCustomFont} />
                <button
                  onClick={() => handleRerenderSubmit(job.id)}
                  disabled={isSubmittingPanel}
                  className="w-full py-2 bg-amber-400 hover:bg-amber-300 text-neutral-900 font-medium rounded-md transition-colors disabled:opacity-50"
                >
                  {isSubmittingPanel ? "Submitting..." : "Submit Rerender"}
                </button>
              </div>
            </div>
          )}

          {/* AI Correction Panel */}
          {activeAiId === job.id && (
            <div className="mt-4 p-4 border border-neutral-800 rounded-lg bg-neutral-950 animate-fadeIn">
              <h4 className="font-medium text-neutral-200 mb-2">AI Correction</h4>
              <p className="text-xs text-neutral-400 mb-3">Provide extra instructions to adjust how AI creates highlights.</p>
              <textarea
                value={extraPrompt}
                onChange={(e) => setExtraPrompt(e.target.value)}
                placeholder="E.g. Focus more on the funny moments..."
                className="w-full bg-neutral-900 border border-neutral-800 rounded p-3 text-sm text-neutral-200 mb-3 focus:outline-none focus:border-amber-400/80"
                rows={3}
              />
              <button
                onClick={() => handleAiCorrectSubmit(job.id)}
                disabled={isSubmittingPanel || !extraPrompt.trim()}
                className="w-full py-2 bg-amber-400 hover:bg-amber-300 text-neutral-900 font-medium rounded-md transition-colors disabled:opacity-50"
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
