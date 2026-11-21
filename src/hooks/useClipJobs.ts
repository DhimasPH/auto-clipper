import { useState, useEffect } from "react";
import axios from "axios";
import { useTranslation } from "react-i18next";
import { API_URL } from "../App";
import { platform } from "../platform";
import { Clip } from "../components/ClipCard";
import { ToastKind } from "./useToasts";
import { CanvasConfig } from "../types/canvas";
import { SubtitleConfig } from "../types/subtitle";
import type { ErrorInfo } from "../types/errorInfo";
import { asErrorInfo, localizedText, requestError, toLang } from "../lib/errorInfo";
import { effectiveProvider, type AiMode } from "../lib/createFlow";
import { asLiveStage, type LiveStage } from "../lib/progress";

export interface ClipJobParams {
  aiMode: AiMode;
  inputType: "url" | "local";
  url: string;
  localFile: File | null;
  provider: string;
  apiKey: string;
  customBaseUrl: string;
  customModelName: string;
  model: string;
  aspectRatio: string;
  trackingMode: string;
  faceTrackingEngine: string;
  captionStyle: string;
  burnSubtitles: boolean;
  canvasConfig?: CanvasConfig;
  subtitleConfig?: SubtitleConfig;
  outputFolder: string;
  quality: string;
  title: string;
  enableBroll: boolean;
  enableHook: boolean;
  pexelsApiKey: string;
  notify: (text: string, kind?: ToastKind) => void;
  closeHistory: () => void;
  maxClips: number;
  isGamingVideo: boolean;
  whisperModel: string;
}

export type CreateJobParams = ClipJobParams;

export interface AwaitingAnswer {
  jobId: string;
  prompt: string;
  title: string;
}

/**
 * Owns the async job lifecycle: create/rerender/rerun-AI requests, status
 * polling, cancellation and the derived progress/running flags.
 */
export function useClipJobs(p: ClipJobParams) {
  const { t, i18n } = useTranslation();
  const { notify } = p;

  const [status, setStatus] = useState<
    "IDLE" | "GENERATING" | "PENDING" | "DOWNLOADING" | "TRANSCRIBING" | "ANALYZING" | "CROPPING" | "DONE" | "ERROR"
  >("IDLE");
  const [errorMsg, setErrorMsg] = useState("");
  // Structured form of the error, when the backend sent one (error_info).
  const [errorInfo, setErrorInfo] = useState<ErrorInfo | null>(null);
  // The job the error belongs to, so its Resume button knows what to run.
  const [failedJobId, setFailedJobId] = useState<string | null>(null);
  // 1 = next in line, 2 = after that; null while running or not queued.
  const [queuePosition, setQueuePosition] = useState<number | null>(null);
  // Metadata of the last finished workspace job (timings, warnings).
  const [jobMeta, setJobMeta] = useState<any>(null);
  const [progress, setProgress] = useState("");
  const [clips, setClips] = useState<Clip[]>([]);
  const [failedCount, setFailedCount] = useState(0);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [jobOrigin, setJobOrigin] = useState<"workspace" | "history">("workspace");
  const [historyVersion, setHistoryVersion] = useState(0);
  // Spec 4.3/4.4: the stage running now and the job's live metadata (finished stage timings).
  const [current, setCurrent] = useState<LiveStage | null>(null);
  const [liveMeta, setLiveMeta] = useState<Record<string, unknown> | null>(null);
  // The running job started at clip making (answer sent, re-render): "no stage yet" means step 4.
  const [makePhase, setMakePhase] = useState(false);
  // Step 3 (spec 4.2): a project waits for the pasted AI answer.
  const [awaiting, setAwaiting] = useState<AwaitingAnswer | null>(null);
  const [sendingAnswer, setSendingAnswer] = useState(false);
  const [answerError, setAnswerError] = useState<{ message: string; info: ErrorInfo | null } | null>(null);

  const clearError = () => {
    setErrorMsg("");
    setErrorInfo(null);
    setFailedJobId(null);
  };

  /** Show a failed request: the structured card when the backend sent error_info, else the raw text. */
  const showRequestError = (err: unknown, fallback: string) => {
    const { message, info } = requestError(err, fallback);
    setErrorMsg(message);
    setErrorInfo(info);
    setFailedJobId(null);
    notify(info ? localizedText(info, toLang(i18n.language)).title : message, "error");
  };

  // Polling effect for async job status.
  useEffect(() => {
    // Task 4.2: Block exit if job is running (Handle in Tauri Rust side if needed)

    if (status === "IDLE" || status === "DONE" || status === "ERROR") return;
    let interval: any;
    if (activeJobId) {
      interval = setInterval(async () => {
        try {
          const res = await axios.get(`${API_URL}/jobs/${activeJobId}`);
          const job = res.data;

          if (job.status === "DONE") {
            const failedN = job.failed || 0;
            setStatus("DONE");
            setCurrent(null);
            setLiveMeta(job.metadata || null);
            if (jobOrigin === "workspace") {
              setClips(job.clips);
              setFailedCount(failedN);
              setJobMeta(job.metadata || null);
            } else {
              // History-origin job (re-render / AI correction): refresh History, leave Workspace untouched.
              setHistoryVersion((v) => v + 1);
            }
            setActiveJobId(null);
            setProgress("");
            setQueuePosition(null);
            const doneMsg = failedN > 0
              ? t('toast.done_partial', { count: job.clips.length, failed: failedN })
              : t('toast.done_all', { count: job.clips.length });
            notify(doneMsg, "success");

          } else if (job.status === "ERROR") {
            const info = asErrorInfo(job.error_info);
            setStatus("ERROR");
            setCurrent(null);
            setErrorMsg(job.error || "Unknown error occurred.");
            setErrorInfo(info);
            setFailedJobId(activeJobId);
            notify(info ? localizedText(info, toLang(i18n.language)).title : (job.error || "Unknown error"), "error");
            setActiveJobId(null);
            setProgress("");
            setQueuePosition(null);
            // The failed job is in History now, with its own error card.
            setHistoryVersion((v) => v + 1);
          } else if (job.status === "CANCELLED") {
            setStatus("IDLE");
            setCurrent(null);
            notify(t('toast.cancelled'), "error");
            setActiveJobId(null);
            setProgress("");
            setQueuePosition(null);
          } else if (job.status === "AWAITING_MANUAL") {
            setStatus("IDLE");
            setCurrent(null);
            setHistoryVersion((v) => v + 1);
            // Ruling P9: always notify and open MomentStep on workspace jobs or when user is already on CreatePage.
            notify(t("toast.manual_prompt_ready"), "success");
            const onCreateRoute = !window.location.hash || window.location.hash === "#/" || window.location.hash === "#";
            if (jobOrigin === "workspace" || onCreateRoute) {
              setAwaiting({ jobId: activeJobId, prompt: job.metadata?.manual_prompt || "", title: job.metadata?.title || "" });
              setAnswerError(null);
            }
            setActiveJobId(null);
            setProgress("");
            setQueuePosition(null);
          } else {
            // In progress
            setStatus(job.status as any);
            setProgress(job.progress);
            setCurrent(asLiveStage(job.current));
            setLiveMeta(job.metadata || null);
            setQueuePosition(typeof job.queue_position === "number" && job.queue_position > 0 ? job.queue_position : null);
            if (jobOrigin === "workspace" && job.clips && job.clips.length > clips.length) {
              setClips(job.clips);
            }
          }
        } catch (e) {
          console.error("Polling error", e);
        }
      }, 1500);
    }
    return () => clearInterval(interval);
  }, [activeJobId, status, clips.length, jobOrigin]);

  const cancelJob = async () => {
    const jid = activeJobId;
    setStatus("IDLE");
    setCurrent(null);
    setActiveJobId(null);
    setProgress("");
    setQueuePosition(null);
    notify(t('toast.cancelled'), "error");
    setHistoryVersion((v) => v + 1);

    if (jid) {
      try {
        await axios.post(`${API_URL}/jobs/${jid}/cancel`);
      } catch (e) {
        console.error("Cancel job request error", e);
      }
    }
  };

  const handleGenerate = async (overrideProvider?: string, overrideTitle?: string) => {
    const title = (overrideTitle ?? p.title ?? "").trim();
    if (p.inputType === "url" && !p.url) {
      notify(t('toast.clip_failed', { msg: t('toast.url_empty') }), "error");
      return;
    }
    if (p.inputType === "local" && !p.localFile) {
      notify(t('toast.clip_failed', { msg: t('toast.local_file_empty') }), "error");
      return;
    }
    const currentProvider = overrideProvider || p.provider;
    if (currentProvider === "custom") {
      if (!p.customBaseUrl || !p.customModelName) {
        notify(t('toast.clip_failed', { msg: t('toast.custom_config_req') }), "error");
        return;
      }
    } else if (currentProvider !== "manual_ai" && !p.apiKey) {
      notify(t('toast.clip_failed', { msg: t('toast.api_key_req') }), "error");
      return;
    }
    if (!title) {
      notify(t('toast.clip_failed', { msg: t('toast.title_required') }), "error");
      return;
    }

    // Still inside the click: browsers only allow the permission prompt from a user gesture.
    platform().askNotifyPermission();
    clearError();
    setProgress("");
    setClips([]);
    setFailedCount(0);
    setJobMeta(null);
    setJobOrigin("workspace");
    setMakePhase(false);
    setLiveMeta(null);

    try {
      setStatus("GENERATING");

      let finalUrl = p.url;
      if (p.inputType === "local" && p.localFile) {
        notify(t('toast.uploading'));
        const formData = new FormData();
        formData.append("file", p.localFile);
        const uploadRes = await axios.post(`${API_URL}/upload`, formData, {
          headers: { "Content-Type": "multipart/form-data" }
        });
        if (uploadRes.data.status !== "success") throw new Error("Upload failed");
        finalUrl = uploadRes.data.url;
      }

      notify(t('toast.starting_bg'));

      const res = await axios.post(`${API_URL}/jobs`, {
        url: finalUrl,
        provider: overrideProvider || p.provider,
        api_key: p.apiKey,
        aspect_ratio: p.aspectRatio,
        tracking_mode: p.trackingMode,
        face_tracking_engine: p.faceTrackingEngine,
        caption_style: p.captionStyle,
        burn_subs: p.burnSubtitles,
        canvas_config: p.canvasConfig,
        subtitle_config: p.subtitleConfig,
        output_dir: p.outputFolder,
        quality: p.quality,
        title,
        enable_broll: p.enableBroll,
        enable_hook: p.enableHook,
        pexels_api_key: p.pexelsApiKey,
        max_clips: p.maxClips,
        custom_base_url: p.customBaseUrl,
        custom_model_name: p.customModelName,
        is_gaming_video: p.isGamingVideo,
        whisper_model: p.whisperModel,
        model: p.model
      });

      if (res.data.status === "error") throw new Error(res.data.message);
      setActiveJobId(res.data.job_id);
    } catch (err: any) {
      console.error(err);
      setStatus("IDLE");
      setProgress("");
      showRequestError(err, "An unknown error occurred.");
    }
  };

  const handleManualGenerate = async (sourceUrl: string, manualClips: { start: number; end: number }[], allowEmptyClips: boolean = false) => {
    if (!sourceUrl || (!allowEmptyClips && manualClips.length === 0)) {
      notify(t('toast.clip_failed', { msg: t('smartEditor.noClips') }), "error");
      return;
    }
    if (!p.title || !p.title.trim()) {
      notify(t('toast.clip_failed', { msg: t('toast.title_required') }), "error");
      return;
    }
    platform().askNotifyPermission();
    clearError();
    setProgress("");
    setClips([]);
    setFailedCount(0);
    setJobMeta(null);
    setJobOrigin("workspace");
    setMakePhase(false);
    setLiveMeta(null);

    try {
      setStatus("GENERATING");
      notify(t('toast.starting_bg'));
      const res = await axios.post(`${API_URL}/jobs/manual`, {
        url: sourceUrl,
        clips: manualClips,
        aspect_ratio: p.aspectRatio,
        caption_style: p.captionStyle,
        burn_subs: p.burnSubtitles,
        canvas_config: p.canvasConfig,
        subtitle_config: p.subtitleConfig,
        output_dir: p.outputFolder,
        quality: p.quality,
        title: p.title,
        is_gaming_video: p.isGamingVideo,
        whisper_model: p.whisperModel,
      });
      if (res.data.status === "error") throw new Error(res.data.message);
      setActiveJobId(res.data.job_id);
    } catch (err: any) {
      console.error(err);
      setStatus("IDLE");
      setProgress("");
      showRequestError(err, "An unknown error occurred.");
    }
  };

  const handleRerender = async (
    historyJobId: string,
    customAspectRatio: string,
    customCaptionStyle: string,
    customBurnSubs: boolean,
    customCanvasConfig?: CanvasConfig,
    customSubtitleConfig?: SubtitleConfig
  ) => {
    setJobOrigin("history");
    setMakePhase(true);
    setLiveMeta(null);
    setStatus("TRANSCRIBING");
    setProgress("");
    clearError();

    try {
      const res = await axios.post(`${API_URL}/jobs/${historyJobId}/rerender`, {
        url: "dummy",
        provider: "openai",
        api_key: "dummy",
        aspect_ratio: customAspectRatio,
        caption_style: customCaptionStyle,
        burn_subs: customBurnSubs,
        canvas_config: customCanvasConfig,
        subtitle_config: customSubtitleConfig || p.subtitleConfig,
        output_dir: p.outputFolder,
        quality: p.quality,
        title: "", // re-render keeps the existing title in backend if not overridden
        enable_broll: p.enableBroll,
        pexels_api_key: p.pexelsApiKey,
        max_clips: p.maxClips,
        whisper_model: p.whisperModel
      });

      if (res.data.status === "error") throw new Error(res.data.message);

      setActiveJobId(res.data.job_id);
      p.closeHistory();
      notify(t('toast.starting_rerender'));
    } catch (err: any) {
      console.error(err);
      setStatus("ERROR");
      setProgress("");
      showRequestError(err, t('toast.rerender_fail'));
    }
  };

  const handleRerunAI = async (historyJobId: string, extraPrompt: string) => {
    setJobOrigin("history");
    setMakePhase(false);
    setLiveMeta(null);
    setStatus("TRANSCRIBING");
    setProgress("");
    clearError();

    try {
      const res = await axios.post(`${API_URL}/jobs/${historyJobId}/rerun_ai`, {
        url: "dummy",
        provider: p.provider,
        api_key: p.apiKey,
        aspect_ratio: p.aspectRatio,
        caption_style: p.captionStyle,
        burn_subs: p.burnSubtitles,
        canvas_config: p.canvasConfig,
        subtitle_config: p.subtitleConfig,
        output_dir: p.outputFolder,
        quality: p.quality,
        title: "", // re-run AI keeps the existing title in backend
        enable_broll: p.enableBroll,
        pexels_api_key: p.pexelsApiKey,
        extra_prompt: extraPrompt,
        max_clips: p.maxClips,
        custom_base_url: p.customBaseUrl,
        custom_model_name: p.customModelName,
        whisper_model: p.whisperModel,
        model: p.model
      });

      if (res.data.status === "error") throw new Error(res.data.message);

      setActiveJobId(res.data.job_id);
      p.closeHistory();
      notify(t('toast.starting_ai_correct'));
    } catch (err: any) {
      console.error(err);
      setStatus("IDLE");
      setProgress("");
      showRequestError(err, t('toast.ai_correct_fail'));
    }
  };

  // origin "workspace": the clips of the resumed job appear in the Workspace
  // (Resume pressed on the Workspace error card). Default: History is refreshed.
  const handleResumeJob = async (historyJobId: string, origin: "workspace" | "history" = "history") => {
    setJobOrigin(origin);
    setMakePhase(false);
    setLiveMeta(null);
    setStatus("TRANSCRIBING");
    setProgress("");
    clearError();

    try {
      // History keeps no API keys, so the keys from Settings go with every resume.
      const res = await axios.post(`${API_URL}/jobs/${historyJobId}/resume`, {
        api_key: p.apiKey,
        pexels_api_key: p.pexelsApiKey,
        provider: effectiveProvider(platform().caps, p.aiMode, p.provider),
        custom_base_url: p.customBaseUrl,
        custom_model_name: p.customModelName,
        whisper_model: p.whisperModel,
        model: p.model
      });

      if (res.data.status === "error") throw new Error(res.data.message);

      setActiveJobId(res.data.job_id);
      p.closeHistory();
      notify(t('toast.starting_resume'));
    } catch (err: any) {
      console.error(err);
      setStatus("IDLE");
      setProgress("");
      showRequestError(err, t('toast.resume_fail'));
    }
  };

  const handleRerenderClip = (newJobId: string) => {
    setJobOrigin("history");
    setMakePhase(true);
    setLiveMeta(null);
    setStatus("CROPPING");
    setProgress("");
    clearError();
    setActiveJobId(newJobId);
    // Polling loop in useEffect will pick up the new job automatically
  };

  const resetJobState = () => {
    setStatus("IDLE");
    setClips([]);
    clearError();
    setProgress("");
    setActiveJobId(null);
    setFailedCount(0);
    setQueuePosition(null);
    setJobMeta(null);
    setCurrent(null);
    setLiveMeta(null);
    setMakePhase(false);
    setAwaiting(null);
    setAnswerError(null);
  };

  const submitAiAnswer = async (payload: string) => {
    if (!awaiting) return;
    setSendingAnswer(true);
    setAnswerError(null);
    try {
      // History keeps no API keys: B-roll needs the Pexels key from Settings.
      const res = await axios.post(`${API_URL}/jobs/${awaiting.jobId}/resume-manual`, {
        json_payload: payload,
        pexels_api_key: p.pexelsApiKey,
      });
      if (res.data.status !== "success") throw new Error(res.data.message || "resume-manual failed");
      platform().askNotifyPermission();
      clearError();
      setAwaiting(null);
      setClips([]);
      setFailedCount(0);
      setJobMeta(null);
      setLiveMeta(null);
      setJobOrigin("workspace");
      setMakePhase(true);
      setStatus("PENDING");
      setActiveJobId(res.data.job_id);
    } catch (err) {
      console.error(err);
      setAnswerError(requestError(err, t("moment.send_failed")));
    } finally {
      setSendingAnswer(false);
    }
  };

  /** "Tempel jawaban AI" in Riwayat: back to step 3 for that project. */
  const openAwaiting = (job: { id: string; metadata?: { manual_prompt?: string; title?: string } | null }) => {
    resetJobState();
    setAwaiting({ jobId: job.id, prompt: job.metadata?.manual_prompt || "", title: job.metadata?.title || "" });
  };

  const leaveAwaiting = () => {
    setAwaiting(null);
    setAnswerError(null);
  };

  const startManualResumePolling = (jobId: string) => {
    setActiveJobId(jobId);
    setJobOrigin("history");
    setMakePhase(true);
    setLiveMeta(null);
    setStatus("CROPPING");
    setProgress("Memproses klip manual...");
    clearError();
    p.closeHistory();
  };

  const isRunning = !!activeJobId || status === "GENERATING";

  useEffect(() => {
    if (!platform().caps.preventSleep) return;
    platform().setPreventSleep(isRunning).catch(console.error);
  }, [isRunning]);

  return {
    status, progress, errorMsg, errorInfo, failedJobId, queuePosition, jobMeta, clips, failedCount,
    isRunning, historyVersion, activeJobId, current, liveMeta, makePhase, jobOrigin,
    awaiting, sendingAnswer, answerError, submitAiAnswer, openAwaiting, leaveAwaiting,
    handleGenerate, handleManualGenerate, handleRerender, handleRerunAI, handleResumeJob, handleRerenderClip, startManualResumePolling, cancelJob, resetJobState,
  };
}
