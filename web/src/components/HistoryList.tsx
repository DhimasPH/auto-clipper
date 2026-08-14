import React, { useEffect, useState } from "react";
import { apiGetHistory, apiDeleteHistory, apiCreateRerenderJob, apiCreateRerunAiJob, API_URL } from "../api";
import type { JobResponse } from "../types/job";
import { Trash2, Play, CheckCircle2, Clock, AlertCircle, RotateCcw, Sparkles, Film, Download, Share2, ExternalLink, Pencil } from "lucide-react";
import { OutputStyleSelector, type OutputStyle } from "./OutputStyleSelector";
import { SubtitlePresetBar } from "./SubtitlePresetBar";
import { SUBTITLE_PRESETS, DEFAULT_SUBTITLE_CONFIG, type SubtitlePresetKey, type SubtitleConfig } from "../types/subtitle";
import { DEFAULT_CANVAS_CONFIG } from "../types/canvas";
import { ClipEditModal } from "./ClipEditModal";

interface HistoryListProps {
  onResume: (jobId: string) => void;
}

export const HistoryList: React.FC<HistoryListProps> = ({ onResume }) => {
  const [jobs, setJobs] = useState<JobResponse[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [activeRerenderId, setActiveRerenderId] = useState<string | null>(null);
  const [outputStyle, setOutputStyle] = useState<OutputStyle>("face_crop");
  const [subtitlePreset, setSubtitlePreset] = useState<SubtitlePresetKey>("viral_pop");

  const [activeAiId, setActiveAiId] = useState<string | null>(null);
  const [extraPrompt, setExtraPrompt] = useState<string>("");
  const [isSubmittingPanel, setIsSubmittingPanel] = useState(false);
  const [downloadingIndex, setDownloadingIndex] = useState<string | null>(null);
  const [editingClip, setEditingClip] = useState<{jobId: string, index: number, title: string, job: any} | null>(null);

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

  const handleRerenderSubmit = async (jobId: string) => {
    if (isSubmittingPanel) return;
    setIsSubmittingPanel(true);
    try {
      const presetBase = SUBTITLE_PRESETS[subtitlePreset]?.config || {};
      const subtitleConfig: SubtitleConfig = {
        ...DEFAULT_SUBTITLE_CONFIG,
        ...presetBase,
      };

      let aspectRatio = "9:16";
      if (outputStyle === "landscape") aspectRatio = "16:9";
      if (outputStyle === "square") aspectRatio = "1:1";

      const payload = {
        aspect_ratio: aspectRatio,
        caption_style: subtitlePreset === "podcast" ? "karaoke" : subtitlePreset === "viral_pop" ? "single_word" : "standard",
        canvas_config: { ...DEFAULT_CANVAS_CONFIG, enabled: outputStyle === "canvas_blur" },
        subtitle_config: subtitleConfig,
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

  const handleDownloadClip = async (clip: any, jobId: string, index: number) => {
    try {
      const dlId = `${jobId}-${index}`;
      setDownloadingIndex(dlId);
      const videoUrl = `${API_URL}/video?path=${encodeURIComponent(clip.path)}&v=${clip.v || 0}`;
      
      const response = await fetch(videoUrl);
      if (!response.ok) throw new Error("Failed to fetch clip file");
      
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      
      const link = document.createElement("a");
      link.href = blobUrl;
      const cleanName = (clip.description || `clip_${index + 1}`)
        .slice(0, 30)
        .replace(/[^a-zA-Z0-9_-]/g, "_");
      link.download = `${cleanName}_${jobId.slice(0, 6)}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.warn("Direct blob download failed, opening in new tab", err);
      window.open(`${API_URL}/video?path=${encodeURIComponent(clip.path)}&v=${clip.v || 0}`, "_blank");
    } finally {
      setDownloadingIndex(null);
    }
  };

  const handleShareClip = async (clip: any) => {
    const videoUrl = `${API_URL}/video?path=${encodeURIComponent(clip.path)}&v=${clip.v || 0}`;
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: clip.description || "Auto Clipper Video",
          text: `Check out this clip: ${clip.description || ""}`,
          url: videoUrl,
        });
      } catch (err) {
        // Ignore cancel
      }
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
            {job.status === "AWAITING_MANUAL" && (
              <button
                onClick={() => onResume(job.id)}
                className="flex items-center px-3 py-1.5 text-sm font-medium text-neutral-900 bg-amber-400 hover:bg-amber-500 rounded-md transition-colors"
              >
                <Play className="w-4 h-4 mr-1" />
                Resume
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
                onClick={() => setActiveRerenderId(activeRerenderId === job.id ? null : job.id)}
                className="flex items-center px-3 py-1.5 text-sm font-medium text-neutral-300 bg-neutral-800 hover:bg-neutral-700 rounded-md transition-colors"
              >
                <Film className="w-4 h-4 mr-1" />
                Rerender
              </button>
            )}
            {(isRealDone || job.status === "AWAITING_MANUAL" || isError) && job.metadata?.highlight_prompt && (
              <button
                onClick={() => setActiveAiId(activeAiId === job.id ? null : job.id)}
                className="flex items-center px-3 py-1.5 text-sm font-medium text-neutral-300 bg-neutral-800 hover:bg-neutral-700 rounded-md transition-colors"
              >
                <Sparkles className="w-4 h-4 mr-1" />
                AI Correct
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

          {/* Clips Viewer */}
          {isRealDone && clips.length > 0 && (
            <div className="mt-6 pt-6 border-t border-neutral-800">
              <h4 className="font-medium text-neutral-200 mb-4">Generated Clips ({clips.length})</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {clips.map((clip: any, index: number) => {
                  const videoSrc = `${API_URL}/video?path=${encodeURIComponent(clip.path)}&v=${clip.v || 0}`;
                  
                  return (
                    <div
                      key={clip.path || index}
                      className="bg-neutral-950 border border-neutral-800 rounded-2xl overflow-hidden flex flex-col group hover:border-neutral-700 transition-colors shadow-xl"
                    >
                      {/* Video Player Header */}
                      <div className="relative bg-black aspect-[9/16] w-full overflow-hidden flex items-center justify-center">
                        <video
                          src={videoSrc}
                          controls
                          playsInline
                          preload="metadata"
                          className="w-full h-full object-contain"
                        />
                        <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-neutral-900/80 backdrop-blur-sm border border-neutral-800 text-[10px] font-mono text-neutral-300 pointer-events-none">
                          Clip #{index + 1}
                        </div>
                      </div>

                      {/* Clip Info Card */}
                      <div className="p-4 flex-1 flex flex-col justify-between space-y-4">
                        <div className="space-y-2">
                          <h4 className="text-sm font-semibold text-neutral-100 line-clamp-2 leading-snug">
                            {clip.description || `Highlight Clip #${index + 1}`}
                          </h4>
                          
                          <div className="flex items-center gap-2 text-[11px] font-mono text-neutral-400 flex-wrap">
                            <span className="inline-flex items-center gap-1 bg-neutral-900 px-2 py-0.5 rounded border border-neutral-800">
                              <Clock className="w-3 h-3 text-amber-400" />
                              {clip.start} - {clip.end}
                            </span>
                            {clip.subs && (
                              <span className="bg-neutral-800 text-neutral-300 px-2 py-0.5 rounded text-[10px]">
                                Subtitles Embedded
                              </span>
                            )}
                          </div>
                        </div>

                        {clip.social && (
                          <div className="mt-3 p-3 bg-neutral-900/60 rounded-xl border border-neutral-800/80 text-xs text-neutral-300 space-y-2 max-h-[140px] overflow-y-auto custom-scrollbar">
                            <div className="font-semibold text-neutral-200 flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Social Kit
                            </div>
                            {(() => {
                              const thumbnail = clip.social.thumbnail_layout;
                              
                              const renderLang = (lang: string, titles: any, caption: any, tags: any, bestTime: any, backsound: any) => {
                                if (!titles?.length && !caption && !tags?.length) return null;
                                return (
                                  <div className="mb-4 last:mb-0 pb-4 last:pb-0 border-b last:border-b-0 border-neutral-800/50">
                                    <div className="text-[10px] font-black text-amber-400 mb-2 bg-amber-400/10 inline-block px-1.5 py-0.5 rounded">[{lang} VERSION]</div>
                                    {titles && titles.length > 0 && (
                                      <div className="space-y-1.5 mb-2">
                                        <span className="text-neutral-500 block">Titles:</span>
                                        <ul className="list-disc pl-4 space-y-1">
                                          {titles.map((t: string, idx: number) => (
                                            <li key={idx} className="font-medium text-neutral-200 text-[11px] leading-tight">{t}</li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}
                                    {caption && (
                                      <div className="mb-2"><span className="text-neutral-500 block mb-0.5">Caption:</span> <span className="text-neutral-300 whitespace-pre-wrap">{caption}</span></div>
                                    )}
                                    {tags && tags.length > 0 && (
                                      <div className="mb-2"><span className="text-neutral-500 block mb-0.5">Tags:</span> <span className="text-blue-400 leading-relaxed">{tags.join(" ")}</span></div>
                                    )}
                                    {bestTime && (
                                      <div className="mb-2"><span className="text-neutral-500 block mb-0.5">Best Time to Post:</span> <span className="text-neutral-300">{bestTime}</span></div>
                                    )}
                                    {backsound && (
                                      <div><span className="text-neutral-500 block mb-0.5">Backsound:</span> <span className="text-neutral-300">{backsound}</span></div>
                                    )}
                                  </div>
                                );
                              };

                              const hasAnyData = clip.social.titles_en?.length || clip.social.titles_id?.length || clip.social.description_en || clip.social.description_id;
                              if (!hasAnyData) return <div className="text-neutral-500 italic">No Social Kit Data Generated</div>;
                              
                              return (
                                <>
                                  {thumbnail && (
                                    <div className="mb-4 pb-4 border-b border-neutral-800/50"><span className="text-neutral-500 block mb-1">Thumbnail Idea:</span> <span className="text-neutral-300 font-medium">{thumbnail}</span></div>
                                  )}
                                  {renderLang("ID", clip.social.titles_id, clip.social.description_id, clip.social.hashtags_id, clip.social.best_time_to_post_id, clip.social.backsound_id)}
                                  {renderLang("EN", clip.social.titles_en, clip.social.description_en, clip.social.hashtags_en, clip.social.best_time_to_post_en, clip.social.backsound_en)}
                                </>
                              );
                            })()}
                          </div>
                        )}
                        
                        {/* Download & Share Actions */}
                        <div className="pt-2 border-t border-neutral-800/80 flex items-center gap-2 mt-4">
                          <button
                            type="button"
                            onClick={() => setEditingClip({ jobId: job.id, index, title: clip.social?.titles_en?.[0] || clip.social?.titles_id?.[0] || `Clip ${index + 1}`, job })}
                            className="p-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg border border-neutral-700 transition-colors"
                            title="Edit Subtitles"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDownloadClip(clip, job.id, index)}
                            disabled={downloadingIndex === `${job.id}-${index}`}
                            className="flex-1 py-2 px-3 bg-amber-400 hover:bg-amber-300 active:scale-95 text-neutral-950 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                          >
                            {downloadingIndex === `${job.id}-${index}` ? (
                              <>
                                <div className="w-3 h-3 border-2 border-neutral-950/30 border-t-neutral-950 rounded-full animate-spin" />
                                <span>Saving...</span>
                              </>
                            ) : (
                              <>
                                <Download className="w-3.5 h-3.5" />
                                <span>Download</span>
                              </>
                            )}
                          </button>

                          {typeof navigator !== "undefined" && typeof navigator.share === "function" && (
                            <button
                              type="button"
                              onClick={() => handleShareClip(clip)}
                              className="p-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg border border-neutral-700 transition-colors"
                              title="Share clip"
                            >
                              <Share2 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <a
                            href={videoSrc}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg border border-neutral-700 transition-colors"
                            title="Open full video in tab"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )})}
      {editingClip && (
        <ClipEditModal
          jobId={editingClip.jobId}
          clipIndex={editingClip.index}
          clipTitle={editingClip.title}
          initialOutputStyle={editingClip.job.metadata?.aspect_ratio === "16:9" ? "landscape" : editingClip.job.metadata?.aspect_ratio === "1:1" ? "square" : "face_crop"}
          onClose={() => setEditingClip(null)}
          onRerenderStart={(jobId) => {
            setEditingClip(null);
            onResume(jobId);
          }}
        />
      )}
    </div>
  );
};
