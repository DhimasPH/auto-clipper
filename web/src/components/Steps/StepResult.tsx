import type React from "react";
import { useState, useEffect } from "react";
import {
  Download,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  Film,
  Share2,
  ExternalLink,
  Ban
} from "lucide-react";
import type { JobStatus, Clip, JobResponse } from "../../types/job";
import { getVideoStreamUrl, getDownloadUrl } from "../../api";

export interface StepResultProps {
  jobId: string;
  status: JobStatus;
  progress: string;
  clips: Clip[];
  failedCount?: number;
  error?: string | null;
  activeJob?: JobResponse | null;
  onReset: () => void;
  onCancel?: () => void;
  onRetry?: () => void;
}

export const StepResult: React.FC<StepResultProps> = ({
  jobId,
  status,
  progress,
  clips,
  error,
  onReset,
  onCancel,
  onRetry,
}) => {
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

  const isProcessing =
    status === "PENDING" ||
    status === "QUEUED" ||
    status === "DOWNLOADING" ||
    status === "TRANSCRIBING" ||
    status === "CROPPING" ||
    status === "PROCESSING";

  const isDone = status === "DONE";
  const isError = status === "ERROR";
  const isCancelled = status === "CANCELLED";

  // Elapsed timer during processing
  useEffect(() => {
    let timer: any;
    if (isProcessing) {
      timer = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isProcessing]);

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainder = secs % 60;
    return `${mins}:${remainder < 10 ? "0" : ""}${remainder}`;
  };

  const handleDownloadClip = (clip: Clip, index: number) => {
    try {
      const cleanName = (clip.description || `clip_${index + 1}`)
        .slice(0, 30)
        .replace(/[\/\\:*?"<>|]/g, "_");
      const filename = `${cleanName}_${jobId.slice(0, 6)}`;
      
      const downloadUrl = getDownloadUrl(clip.path, clip.v, filename);
      
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.target = "_blank"; // Opens a new tab which immediately closes for downloads
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.warn("Failed to trigger download", err);
    }
  };

  const handleShareClip = async (clip: Clip) => {
    const videoUrl = getVideoStreamUrl(clip.path);
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

  return (
    <div className="space-y-6">
      {/* 1. PROCESSING STATE */}
      {isProcessing && (
        <div className="bg-neutral-900/90 border border-neutral-800 rounded-2xl p-6 sm:p-8 text-center space-y-6 shadow-xl">
          {/* Animated Spinner & Status Badge */}
          <div className="relative inline-flex items-center justify-center">
            <div className="w-20 h-20 rounded-full border-4 border-amber-400/20 border-t-amber-400 animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center text-amber-400">
              <Film className="w-8 h-8 animate-pulse" />
            </div>
          </div>

          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-400/10 text-amber-400 border border-amber-400/30">
              <Sparkles className="w-3.5 h-3.5" />
              <span>GPU Pipeline Active</span>
            </div>
            <h3 className="text-lg font-bold text-neutral-100">
              {status === "DOWNLOADING" && "Downloading Source Video..."}
              {status === "TRANSCRIBING" && "Transcribing Speech with Whisper..."}
              {status === "CROPPING" && "Rendering Vertical Clips & Subtitles..."}
              {(status === "PROCESSING" || status === "PENDING" || status === "QUEUED") &&
                "Processing in Google Colab..."}
            </h3>
            <p className="text-xs text-neutral-400 max-w-md mx-auto leading-relaxed">
              {progress || "Colab server is processing your video with FFmpeg GPU acceleration."}
            </p>
          </div>

          {/* Progress Metrics */}
          <div className="grid grid-cols-2 max-w-xs mx-auto gap-3 pt-2">
            <div className="bg-neutral-950/60 p-3 rounded-xl border border-neutral-800/80 text-xs">
              <span className="text-neutral-500 block">Elapsed Time</span>
              <span className="text-sm font-mono font-bold text-neutral-200">
                {formatTime(elapsedSeconds)}
              </span>
            </div>
            <div className="bg-neutral-950/60 p-3 rounded-xl border border-neutral-800/80 text-xs">
              <span className="text-neutral-500 block">Job ID</span>
              <span className="text-sm font-mono font-bold text-neutral-200">
                {jobId.slice(0, 8)}
              </span>
            </div>
          </div>

          {/* Cancel Button */}
          {onCancel && (
            <div className="pt-2">
              <button
                type="button"
                onClick={onCancel}
                className="py-2 px-4 bg-neutral-800/80 hover:bg-red-950/40 hover:border-red-800/60 border border-neutral-700 text-neutral-400 hover:text-red-300 text-xs rounded-xl transition-colors inline-flex items-center gap-1.5"
              >
                <Ban className="w-3.5 h-3.5" />
                <span>Cancel Processing</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* 2. ERROR OR CANCELLED STATE */}
      {(isError || isCancelled) && (
        <div className="bg-neutral-900/90 border border-red-900/40 rounded-2xl p-6 sm:p-8 text-center space-y-5">
          <div className="inline-flex p-3 rounded-2xl bg-red-950/60 border border-red-800/50 text-red-400">
            <AlertCircle className="w-8 h-8" />
          </div>

          <div className="space-y-1.5">
            <h3 className="text-base font-bold text-neutral-100">
              {isCancelled ? "Processing Cancelled" : "Failed to Complete Rendering"}
            </h3>
            <p className="text-xs text-red-300/90 max-w-md mx-auto leading-relaxed">
              {error || progress || "An unexpected error occurred during rendering."}
            </p>
          </div>

          <div className="flex items-center justify-center gap-3 pt-2">
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="py-2.5 px-4 bg-amber-400 hover:bg-amber-300 text-neutral-950 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Retry Job</span>
              </button>
            )}

            <button
              type="button"
              onClick={onReset}
              className="py-2.5 px-4 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium rounded-xl transition-colors flex items-center gap-1.5"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Start New Clip</span>
            </button>
          </div>
        </div>
      )}

      {/* 3. DONE STATE */}
      {isDone && (
        <div className="space-y-6 animate-fadeIn">
          {/* Completion Banner */}
          <div className="bg-emerald-950/40 border border-emerald-800/60 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-400/20 text-emerald-400 border border-emerald-400/30 shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-neutral-100 flex items-center gap-2">
                  <span>Rendering Complete!</span>
                  <span className="text-xs font-normal text-emerald-400">
                    ({clips.length} {clips.length === 1 ? "clip" : "clips"} ready)
                  </span>
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Your vertical videos are rendered and ready for download or mobile sharing.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onReset}
              className="py-2.5 px-4 bg-amber-400 hover:bg-amber-300 active:scale-95 text-neutral-950 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-md shadow-amber-400/10 shrink-0 self-stretch sm:self-auto justify-center"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Create More Clips</span>
            </button>
          </div>

          {/* Clips Grid / List */}
          {clips.length === 0 ? (
            <div className="p-8 text-center bg-neutral-900/60 border border-neutral-800 rounded-2xl text-xs text-neutral-400">
              No clips were generated for this job.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {clips.map((clip, index) => {
                const videoSrc = getVideoStreamUrl(clip.path, clip.v);

                return (
                  <div
                    key={clip.path || index}
                    className="bg-neutral-900/90 border border-neutral-800/90 rounded-2xl overflow-hidden shadow-xl flex flex-col group hover:border-neutral-700 transition-colors"
                  >
                    {/* Video Player Header */}
                    <div className="relative bg-neutral-950 aspect-[9/16] max-h-[380px] w-full overflow-hidden flex items-center justify-center">
                      <video
                        src={videoSrc}
                        controls
                        playsInline
                        preload="metadata"
                        className="w-full h-full object-contain"
                      />
                      <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded bg-neutral-900/80 backdrop-blur-sm border border-neutral-800 text-[10px] font-mono text-neutral-300 pointer-events-none">
                        Clip #{index + 1}
                      </div>
                    </div>

                    {/* Clip Info Card */}
                    <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-4">
                      <div className="space-y-2">
                        <h4 className="text-sm font-semibold text-neutral-100 line-clamp-2 leading-snug">
                          {clip.description || `Highlight Clip #${index + 1}`}
                        </h4>
                        
                        <div className="flex items-center gap-2 text-[11px] font-mono text-neutral-400 flex-wrap">
                          <span className="inline-flex items-center gap-1 bg-neutral-950 px-2 py-0.5 rounded border border-neutral-800">
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
                        <div className="mt-3 p-3 bg-neutral-950/60 rounded-xl border border-neutral-800/80 text-xs text-neutral-300 space-y-2 max-h-[140px] overflow-y-auto custom-scrollbar">
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
                            if (!hasAnyData) return null;
                            
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
                      <div className="pt-2 border-t border-neutral-800/80 flex items-center gap-2 p-4">
                        <button
                          type="button"
                          onClick={() => handleDownloadClip(clip, index)}
                          className="flex-1 py-2.5 px-3 bg-amber-400 hover:bg-amber-300 active:scale-95 text-neutral-950 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-md shadow-amber-400/10"
                        >
                          <Download className="w-4 h-4" />
                          <span>Download Clip</span>
                        </button>

                        {typeof navigator !== "undefined" && typeof navigator.share === "function" && (
                          <button
                            type="button"
                            onClick={() => handleShareClip(clip)}
                            className="p-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl border border-neutral-700 transition-colors"
                            title="Share clip"
                          >
                            <Share2 className="w-4 h-4" />
                          </button>
                        )}

                        <a
                          href={videoSrc}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl border border-neutral-700 transition-colors"
                          title="Open full video in tab"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default StepResult;
