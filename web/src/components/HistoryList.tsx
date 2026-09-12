import React, { useEffect, useState } from "react";
import { apiGetHistory, apiDeleteHistory, apiCreateRerenderJob, apiCreateRerunAiJob } from "../api";
import type { JobResponse } from "../types/job";
import { Trash2, Play, CheckCircle2, Clock, AlertCircle, RotateCcw, Sparkles, Film } from "lucide-react";
import { OutputStyleSelector, type OutputStyle } from "./OutputStyleSelector";
import { CanvasConfigControls } from "./ui/CanvasConfigControls";
import { SubtitleConfigControls } from "./ui/SubtitleConfigControls";
import { DEFAULT_SUBTITLE_CONFIG, type SubtitleConfig } from "../types/subtitle";
import { DEFAULT_CANVAS_CONFIG, type CanvasConfig } from "../types/canvas";
import { ClipCard } from "./ClipCard";
import { ClipEditModal } from "./ClipEditModal";
import { SocialKitModal } from "./SocialKitModal";

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

  // Subtitle edit modal state (matching desktop Auto Clipper)
  const [activeEditClip, setActiveEditClip] = useState<{ job: JobResponse; index: number } | null>(null);
  
  // Social Kit modal state
  const [activeSocialClip, setActiveSocialClip] = useState<{ clip: any; title: string } | null>(null);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const data = await apiGetHistory();
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
    if (!window.confirm("Are you sure you want to delete this job and its clips?")) return;
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
        return <Clock className="w-5 h-5 text-amber-500" />;
      case "ERROR":
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Clock className="w-5 h-5 text-purple-600 animate-spin" />;
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
      <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-600 text-sm">
        {error}
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="p-8 sm:p-12 text-center bg-white border border-border rounded-3xl shadow-sm">
        <p className="text-text-secondary text-sm">No processing history found.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-5 sm:gap-6">
      {jobs.map((job) => {
        const isRealDone = job.status === "DONE";
        const isError = job.status === "ERROR";
        const clips = (job as any).result_clips || job.clips || [];

        return (
          <div
            key={job.id}
            className="bg-white border border-border rounded-2xl sm:rounded-3xl p-4 sm:p-6 flex flex-col hover:border-purple-200 hover:shadow-md transition-all shadow-sm"
          >
            {/* Header: Title & Status Icon */}
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex-1 min-w-0">
                <h3
                  className="font-bold text-text-primary text-base sm:text-lg line-clamp-2 leading-snug"
                  title={job.metadata?.title || job.id}
                >
                  {job.metadata?.title || `Job: ${job.id}`}
                </h3>
                {job.metadata?.source_video && (
                  <p className="text-xs font-mono text-text-tertiary truncate mt-0.5" title={job.metadata.source_video}>
                    {job.metadata.source_video}
                  </p>
                )}
              </div>
              <div className="flex-shrink-0" title={job.status}>
                {getStatusIcon(job.status)}
              </div>
            </div>

            {/* Job Metadata Badges (Responsive Grid) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4 text-xs text-text-secondary">
              <div className="bg-bg-surface/70 px-3 py-2 rounded-xl flex flex-col justify-center">
                <span className="text-[10px] uppercase font-semibold text-text-tertiary">Status</span>
                <span className="font-semibold text-text-primary capitalize truncate">
                  {job.status.replace(/_/g, " ").toLowerCase()}
                </span>
              </div>

              <div className="bg-bg-surface/70 px-3 py-2 rounded-xl flex flex-col justify-center">
                <span className="text-[10px] uppercase font-semibold text-text-tertiary">Progress</span>
                <span className="font-semibold text-purple-600 truncate">
                  {job.progress || "Idle"}
                </span>
              </div>

              {job.metadata?.duration_seconds && (
                <div className="bg-bg-surface/70 px-3 py-2 rounded-xl flex flex-col justify-center">
                  <span className="text-[10px] uppercase font-semibold text-text-tertiary">Duration</span>
                  <span className="font-semibold text-text-primary">
                    {Math.floor(job.metadata.duration_seconds / 60)}m {job.metadata.duration_seconds % 60}s
                  </span>
                </div>
              )}

              {job.created_at && (
                <div className="bg-bg-surface/70 px-3 py-2 rounded-xl flex flex-col justify-center">
                  <span className="text-[10px] uppercase font-semibold text-text-tertiary">Date</span>
                  <span className="font-semibold text-text-primary truncate">
                    {new Date(job.created_at).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>

            {/* Generated Clips Carousel with Subtitle Correction Button (Persis Desktop) */}
            {clips && clips.length > 0 && (
              <div className="mt-2 mb-4 pt-4 border-t border-border">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Film className="w-4 h-4 text-purple-600" />
                    <h4 className="text-xs sm:text-sm font-bold text-text-primary">
                      Klip Hasil Render ({clips.length})
                    </h4>
                  </div>
                  <span className="text-[11px] text-text-tertiary hidden sm:inline">
                    Klik "Koreksi Subtitle" untuk mengedit teks per klip
                  </span>
                </div>

                <div className="flex gap-4 overflow-x-auto pb-3 pt-1 scroll-smooth snap-x -mx-2 px-2 sm:mx-0 sm:px-0 custom-scrollbar">
                  {clips.map((clip: any, idx: number) => (
                    <ClipCard
                      key={clip.path || idx}
                      clip={clip}
                      index={idx}
                      jobId={job.id}
                      onEditSubtitle={() => setActiveEditClip({ job, index: idx })}
                      onOpenSocialKit={() =>
                        setActiveSocialClip({
                          clip,
                          title: clip.social?.title || `Clip #${idx + 1}`,
                        })
                      }
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons Row (Fully Mobile Friendly) */}
            <div className="flex items-center justify-start sm:justify-end flex-wrap gap-2 pt-3 border-t border-border mt-auto">
              {(isRealDone || job.status === "AWAITING_MANUAL" || isError) && (
                <button
                  onClick={() => {
                    if (onResumeManual) {
                      onResumeManual(job.id, (job.metadata as any)?.ai_prompt || "");
                    } else {
                      onResume(job.id);
                    }
                  }}
                  className="flex items-center px-3.5 py-2 text-xs sm:text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-700 hover:to-pink-600 rounded-xl transition-all shadow-sm shadow-purple-500/20"
                >
                  <Play className="w-3.5 h-3.5 mr-1.5" />
                  {job.status === "AWAITING_MANUAL" ? "Edit Prompt / JSON" : "Rerun from JSON"}
                </button>
              )}

              {isError && (
                <button
                  onClick={() => onResume(job.id)}
                  className="flex items-center px-3.5 py-2 text-xs sm:text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-xl transition-colors shadow-sm"
                >
                  <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
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
                  className="flex items-center px-3.5 py-2 text-xs sm:text-sm font-semibold text-text-secondary bg-bg-surface hover:bg-slate-200 border border-border rounded-xl transition-colors"
                >
                  <Film className="w-3.5 h-3.5 mr-1.5 text-purple-600" />
                  Rerender All
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
                  className="flex items-center px-3.5 py-2 text-xs sm:text-sm font-semibold text-text-secondary bg-bg-surface hover:bg-slate-200 border border-border rounded-xl transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5 mr-1.5 text-purple-600" />
                  AI Correct
                </button>
              )}

              {(isRealDone || clips.length > 0) && (
                <button
                  onClick={() => onViewResults && onViewResults(job)}
                  className="px-3.5 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 rounded-xl text-xs sm:text-sm font-semibold transition-colors flex items-center gap-1.5"
                >
                  <Film className="w-3.5 h-3.5" />
                  Modal View ({clips.length})
                </button>
              )}

              <button
                onClick={() => handleDelete(job.id)}
                className="flex items-center px-3 py-2 text-xs sm:text-sm font-medium text-red-500 hover:bg-red-50 hover:text-red-600 rounded-xl transition-colors ml-auto sm:ml-0"
                title="Delete Job"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1" />
                Delete
              </button>
            </div>

            {/* Rerender All Panel */}
            {activeRerenderId === job.id && (
              <div className="mt-4 p-4 sm:p-5 border border-border rounded-2xl bg-bg-surface/40 animate-fadeIn">
                <h4 className="font-bold text-text-primary text-sm mb-3">Rerender All Clips</h4>
                <div className="space-y-4">
                  <OutputStyleSelector
                    value={outputStyle}
                    onChange={(val) => {
                      setOutputStyle(val);
                      setCanvasConfig((prev) => ({ ...prev, enabled: val === "canvas_blur" }));
                    }}
                    disabled={isSubmittingPanel}
                  />
                  {outputStyle === "canvas_blur" && (
                    <CanvasConfigControls config={canvasConfig} onChange={setCanvasConfig} showModeSwitch={false} />
                  )}
                  <SubtitleConfigControls config={subtitleConfig} onChange={setSubtitleConfig} showModeSwitch={true} />
                  <button
                    onClick={() => handleRerenderSubmit(job.id)}
                    disabled={isSubmittingPanel}
                    className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-700 hover:to-pink-600 text-white font-bold rounded-xl transition-all shadow-md shadow-purple-500/20 disabled:opacity-50 text-xs sm:text-sm"
                  >
                    {isSubmittingPanel ? "Submitting..." : "Submit Rerender All"}
                  </button>
                </div>
              </div>
            )}

            {/* AI Correction Panel */}
            {activeAiId === job.id && (
              <div className="mt-4 p-4 sm:p-5 border border-border rounded-2xl bg-bg-surface/40 animate-fadeIn">
                <h4 className="font-bold text-text-primary text-sm mb-1">AI Correction</h4>
                <p className="text-xs text-text-secondary mb-3">Provide extra instructions to adjust how AI creates highlights.</p>
                <textarea
                  value={extraPrompt}
                  onChange={(e) => setExtraPrompt(e.target.value)}
                  placeholder="E.g. Focus more on the funny moments..."
                  className="w-full bg-white border border-border rounded-xl p-3 text-xs sm:text-sm text-text-primary mb-3 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
                  rows={3}
                />
                <button
                  onClick={() => handleAiCorrectSubmit(job.id)}
                  disabled={isSubmittingPanel || !extraPrompt.trim()}
                  className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-700 hover:to-pink-600 text-white font-bold rounded-xl transition-all shadow-md shadow-purple-500/20 disabled:opacity-50 text-xs sm:text-sm"
                >
                  {isSubmittingPanel ? "Submitting..." : "Submit AI Correction"}
                </button>
              </div>
            )}
          </div>
        );
      })}

      {/* Clip Edit Modal for Subtitle Correction (Exact match with Desktop Auto Clipper) */}
      {activeEditClip && (
        <ClipEditModal
          jobId={activeEditClip.job.id}
          clipIndex={activeEditClip.index}
          clipTitle={`Clip #${activeEditClip.index + 1}`}
          initialOutputStyle={
            activeEditClip.job.metadata?.aspect_ratio === "16:9" &&
            activeEditClip.job.metadata?.canvas_config?.enabled
              ? "canvas_blur"
              : activeEditClip.job.metadata?.aspect_ratio === "16:9"
                ? "landscape"
                : activeEditClip.job.metadata?.aspect_ratio === "1:1"
                  ? "square"
                  : "face_crop"
          }
          initialCanvasConfig={activeEditClip.job.metadata?.canvas_config || DEFAULT_CANVAS_CONFIG}
          initialSubtitleConfig={activeEditClip.job.metadata?.subtitle_config || DEFAULT_SUBTITLE_CONFIG}
          initialTrackingMode={activeEditClip.job.metadata?.tracking_mode || "auto"}
          onClose={() => setActiveEditClip(null)}
          onRerenderStart={(newJobId) => {
            setActiveEditClip(null);
            onResume(newJobId);
            fetchHistory();
          }}
        />
      )}

      {/* Social Kit Modal */}
      {activeSocialClip && (
        <SocialKitModal
          isOpen={Boolean(activeSocialClip)}
          onClose={() => setActiveSocialClip(null)}
          clipTitle={activeSocialClip.title}
          social={activeSocialClip.clip.social}
        />
      )}
    </div>
  );
};
