import { useState, useEffect } from "react";
import axios from "axios";
import { useTranslation } from "react-i18next";
import { API_URL } from "../App";
import { Clip } from "../components/ClipCard";
import { ToastKind } from "./useToasts";
import { shouldNotifyOS } from "../lib/notify";

export interface ClipJobParams {
  inputType: "url" | "local";
  url: string;
  localFile: File | null;
  provider: string;
  apiKey: string;
  customBaseUrl: string;
  customModelName: string;
  aspectRatio: string;
  captionStyle: string;
  burnSubtitles: boolean;
  outputFolder: string;
  quality: string;
  title: string;
  enableBroll: boolean;
  pexelsApiKey: string;
  notify: (text: string, kind?: ToastKind) => void;
  closeHistory: () => void;
  maxClips: number;
}

/**
 * Owns the async job lifecycle: create/rerender/rerun-AI requests, status
 * polling, cancellation and the derived progress/running flags.
 */
export function useClipJobs(p: ClipJobParams) {
  const { t } = useTranslation();
  const { notify } = p;

  const [status, setStatus] = useState<
    "IDLE" | "GENERATING" | "DOWNLOADING" | "TRANSCRIBING" | "CROPPING" | "DONE" | "ERROR"
  >("IDLE");
  const [errorMsg, setErrorMsg] = useState("");
  const [progress, setProgress] = useState("");
  const [clips, setClips] = useState<Clip[]>([]);
  const [totalClips, setTotalClips] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [jobOrigin, setJobOrigin] = useState<"workspace" | "history">("workspace");
  const [historyVersion, setHistoryVersion] = useState(0);

  // Task 1.2: Request Notification permission once.
  useEffect(() => {
    if (window.Notification && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

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
            if (jobOrigin === "workspace") {
              setClips(job.clips);
              setFailedCount(failedN);
            } else {
              // History-origin job (re-render / AI correction): refresh History, leave Workspace untouched.
              setHistoryVersion((v) => v + 1);
            }
            setActiveJobId(null);
            setProgress("");
            const doneMsg = failedN > 0
              ? t('toast.done_partial', { count: job.clips.length, failed: failedN, defaultValue: `🎉 Selesai! ${job.clips.length} klip berhasil, ${failedN} gagal` })
              : t('toast.done_all', { count: job.clips.length, defaultValue: `🎉 Selesai! ${job.clips.length} clip berhasil dibuat` });
            notify(doneMsg, "success");
            if (shouldNotifyOS()) {
              new Notification(t('toast.os_notify_title', 'Auto Clipper Selesai'), { body: failedN > 0 ? t('toast.done_partial', { count: job.clips.length, failed: failedN, defaultValue: `${job.clips.length} berhasil, ${failedN} gagal` }) : t('toast.done_all', { count: job.clips.length, defaultValue: `${job.clips.length} clip berhasil dibuat!` }) });
            }
          } else if (job.status === "ERROR") {
            setStatus("ERROR");
            setErrorMsg(job.error || "Unknown error occurred.");
            notify(`⚠️ ${job.error || "Unknown error"}`, "error");
            setActiveJobId(null);
            setProgress("");
          } else if (job.status === "CANCELLED") {
            setStatus("IDLE");
            notify(t('toast.cancelled', '⛔ Proses dibatalkan.'), "error");
            setActiveJobId(null);
            setProgress("");
          } else {
            // In progress
            setStatus(job.status as any);
            setProgress(job.progress);
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
    if (activeJobId) {
      await axios.post(`${API_URL}/jobs/${activeJobId}/cancel`);
      // the polling will catch the CANCELLED status on the next tick
    }
  };

  const handleGenerate = async () => {
    if (p.inputType === "url" && !p.url) {
      notify(t('toast.clip_failed', { num: '', msg: t('toast.url_empty', 'URL kosong!') }), "error");
      return;
    }
    if (p.inputType === "local" && !p.localFile) {
      notify(t('toast.clip_failed', { num: '', msg: t('toast.local_file_empty', 'Video lokal belum dipilih!') }), "error");
      return;
    }
    if (p.provider === "custom") {
      if (!p.customBaseUrl || !p.customModelName) {
        notify(t('toast.clip_failed', { num: '', msg: t('toast.custom_config_req', 'Base URL dan Model Name custom belum diisi! Silakan atur di Settings.') }), "error");
        return;
      }
    } else if (!p.apiKey) {
      notify(t('toast.clip_failed', { num: '', msg: t('toast.api_key_req', 'API Key belum diisi! Silakan isi di Settings.') }), "error");
      return;
    }
    if (!p.title || !p.title.trim()) {
      notify(t('toast.clip_failed', { num: '', msg: t('toast.title_required', 'Judul Proyek wajib diisi!') }), "error");
      return;
    }

    setErrorMsg("");
    setProgress("");
    setClips([]);
    setTotalClips(0);
    setFailedCount(0);
    setJobOrigin("workspace");

    try {
      setStatus("GENERATING");

      let finalUrl = p.url;
      if (p.inputType === "local" && p.localFile) {
        notify(t('toast.uploading', '🚀 Mengunggah video lokal...'));
        const formData = new FormData();
        formData.append("file", p.localFile);
        const uploadRes = await axios.post(`${API_URL}/upload`, formData, {
          headers: { "Content-Type": "multipart/form-data" }
        });
        if (uploadRes.data.status !== "success") throw new Error("Upload failed");
        finalUrl = uploadRes.data.url;
      }

      notify(t('toast.starting_bg', '🚀 Memulai proses di latar belakang...'));

      const res = await axios.post(`${API_URL}/jobs`, {
        url: finalUrl,
        provider: p.provider,
        api_key: p.apiKey,
        aspect_ratio: p.aspectRatio,
        caption_style: p.captionStyle,
        burn_subs: p.burnSubtitles,
        output_dir: p.outputFolder,
        quality: p.quality,
        title: p.title,
        enable_broll: p.enableBroll,
        pexels_api_key: p.pexelsApiKey,
        max_clips: p.maxClips,
        custom_base_url: p.customBaseUrl,
        custom_model_name: p.customModelName
      });

      if (res.data.status === "error") throw new Error(res.data.message);
      setActiveJobId(res.data.job_id);
    } catch (err: any) {
      console.error(err);
      setStatus("IDLE");
      setProgress("");
      const msg = err.response?.data?.message || err.message || "An unknown error occurred.";
      setErrorMsg(msg);
      notify(`⚠️ ${msg}`, "error");
    }
  };

  const handleManualGenerate = async (sourceUrl: string, manualClips: { start: number; end: number }[]) => {
    if (!sourceUrl || manualClips.length === 0) {
      notify(t('toast.clip_failed', { num: '', msg: t('smartEditor.noClips', 'Belum ada klip.') }), "error");
      return;
    }
    setErrorMsg("");
    setProgress("");
    setClips([]);
    setTotalClips(manualClips.length);
    setFailedCount(0);
    setJobOrigin("workspace");

    try {
      setStatus("GENERATING");
      notify(t('smartEditor.submitted', '🚀 Memproses klip manual...'));
      const res = await axios.post(`${API_URL}/jobs/manual`, {
        url: sourceUrl,
        clips: manualClips,
        aspect_ratio: p.aspectRatio,
        caption_style: p.captionStyle,
        burn_subs: p.burnSubtitles,
        output_dir: p.outputFolder,
        quality: p.quality,
        title: p.title,
      });
      if (res.data.status === "error") throw new Error(res.data.message);
      setActiveJobId(res.data.job_id);
    } catch (err: any) {
      console.error(err);
      setStatus("IDLE");
      setProgress("");
      const msg = err.response?.data?.message || err.message || "An unknown error occurred.";
      setErrorMsg(msg);
      notify(`⚠️ ${msg}`, "error");
    }
  };

  const handleRerender = async (historyJobId: string, customAspectRatio: string, customCaptionStyle: string, customBurnSubs: boolean) => {
    setJobOrigin("history");
    setStatus("TRANSCRIBING");
    setProgress("");
    setErrorMsg("");

    try {
      const res = await axios.post(`${API_URL}/jobs/${historyJobId}/rerender`, {
        url: "dummy",
        provider: "openai",
        api_key: "dummy",
        aspect_ratio: customAspectRatio,
        caption_style: customCaptionStyle,
        burn_subs: customBurnSubs,
        output_dir: p.outputFolder,
        quality: p.quality,
        title: "", // re-render keeps the existing title in backend if not overridden
        enable_broll: p.enableBroll,
        pexels_api_key: p.pexelsApiKey,
        max_clips: p.maxClips
      });

      if (res.data.status === "error") throw new Error(res.data.message);

      setActiveJobId(res.data.job_id);
      p.closeHistory();
      notify(t('toast.starting_rerender', '🚀 Memulai re-render dari history...'));
    } catch (err: any) {
      console.error(err);
      setStatus("ERROR");
      setProgress("");
      const msg = err.response?.data?.message || err.message || t('toast.rerender_fail', 'Gagal memulai re-render.');
      setErrorMsg(msg);
      notify(`⚠️ ${msg}`, "error");
    }
  };

  const handleRerunAI = async (historyJobId: string, extraPrompt: string) => {
    setJobOrigin("history");
    setStatus("TRANSCRIBING");
    setProgress("");
    setErrorMsg("");

    try {
      const res = await axios.post(`${API_URL}/jobs/${historyJobId}/rerun_ai`, {
        url: "dummy",
        provider: p.provider,
        api_key: p.apiKey,
        aspect_ratio: p.aspectRatio,
        caption_style: p.captionStyle,
        burn_subs: p.burnSubtitles,
        output_dir: p.outputFolder,
        quality: p.quality,
        title: "", // re-run AI keeps the existing title in backend
        enable_broll: p.enableBroll,
        pexels_api_key: p.pexelsApiKey,
        extra_prompt: extraPrompt,
        max_clips: p.maxClips,
        custom_base_url: p.customBaseUrl,
        custom_model_name: p.customModelName
      });

      if (res.data.status === "error") throw new Error(res.data.message);

      setActiveJobId(res.data.job_id);
      p.closeHistory();
      notify(t('toast.starting_ai_correct', '✨ Memulai proses AI Koreksi dari history...'));
    } catch (err: any) {
      console.error(err);
      setStatus("IDLE");
      setProgress("");
      const msg = err.response?.data?.message || err.message || t('toast.ai_correct_fail', 'Gagal memulai AI Koreksi.');
      setErrorMsg(msg);
      notify(`⚠️ ${msg}`, "error");
    }
  };

  const resetJobState = () => {
    setStatus("IDLE");
    setClips([]);
    setErrorMsg("");
    setProgress("");
    setActiveJobId(null);
    setFailedCount(0);
    setTotalClips(0);
  };

  const isRunning = !!activeJobId || status === "GENERATING";
  const progressPct =
    status === "DOWNLOADING"
      ? 15
      : status === "TRANSCRIBING"
        ? 45
        : status === "CROPPING"
          ? totalClips
            ? 60 + Math.round((clips.length / totalClips) * 35)
            : 60
          : status === "DONE"
            ? 100
            : 0;

  return {
    status, progress, errorMsg, clips, failedCount,
    isRunning, progressPct, historyVersion,
    handleGenerate, handleManualGenerate, handleRerender, handleRerunAI, cancelJob, resetJobState,
  };
}
