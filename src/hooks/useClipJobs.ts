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
  mode: "ai" | "manual";
  provider: string;
  apiKey: string;
  manualStart: string;
  manualEnd: string;
  aspectRatio: string;
  captionStyle: string;
  burnSubtitles: boolean;
  outputFolder: string;
  quality: string;
  notify: (text: string, kind?: ToastKind) => void;
  closeHistory: () => void;
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

  // Task 1.2: Request Notification permission once.
  useEffect(() => {
    if (window.Notification && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // Polling effect for async job status.
  useEffect(() => {
    // Task 4.2: Block exit if job is running
    if (window.electronAPI) {
      window.electronAPI.setJobActive(!!activeJobId);
    }

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
            setClips(job.clips);
            setFailedCount(failedN);
            setActiveJobId(null);
            setProgress("");
            const doneMsg = failedN > 0
              ? `🎉 Selesai! ${job.clips.length} klip berhasil, ${failedN} gagal`
              : `🎉 Selesai! ${job.clips.length} clip berhasil dibuat`;
            notify(doneMsg, "success");
            if (shouldNotifyOS()) {
              new Notification("Auto Clipper Selesai", { body: failedN > 0 ? `${job.clips.length} berhasil, ${failedN} gagal` : `${job.clips.length} clip berhasil dibuat!` });
            }
          } else if (job.status === "ERROR") {
            setStatus("ERROR");
            setErrorMsg(job.error || "Unknown error occurred.");
            notify(`⚠️ ${job.error || "Unknown error"}`, "error");
            setActiveJobId(null);
            setProgress("");
          } else if (job.status === "CANCELLED") {
            setStatus("IDLE");
            notify("⛔ Proses dibatalkan.", "error");
            setActiveJobId(null);
            setProgress("");
          } else {
            // In progress
            setStatus(job.status as any);
            setProgress(job.progress);
            if (job.clips && job.clips.length > clips.length) {
              setClips(job.clips);
            }
          }
        } catch (e) {
          console.error("Polling error", e);
        }
      }, 1500);
    }
    return () => clearInterval(interval);
  }, [activeJobId, status, clips.length]);

  const cancelJob = async () => {
    if (activeJobId) {
      await axios.post(`${API_URL}/jobs/${activeJobId}/cancel`);
      // the polling will catch the CANCELLED status on the next tick
    }
  };

  const handleGenerate = async () => {
    if (p.inputType === "url" && !p.url) {
      notify(t('toast.clip_failed', { num: '', msg: 'URL kosong!' }), "error");
      return;
    }
    if (p.inputType === "local" && !p.localFile) {
      notify(t('toast.clip_failed', { num: '', msg: 'Video lokal belum dipilih!' }), "error");
      return;
    }
    if (p.mode === "ai" && !p.apiKey) {
      notify(t('toast.clip_failed', { num: '', msg: 'API Key belum diisi! Silakan isi di Settings.' }), "error");
      return;
    }

    setErrorMsg("");
    setProgress("");
    setClips([]);
    setTotalClips(0);
    setFailedCount(0);

    try {
      setStatus("GENERATING");

      let finalUrl = p.url;
      if (p.inputType === "local" && p.localFile) {
        notify("🚀 Mengunggah video lokal...");
        const formData = new FormData();
        formData.append("file", p.localFile);
        const uploadRes = await axios.post(`${API_URL}/upload`, formData, {
          headers: { "Content-Type": "multipart/form-data" }
        });
        if (uploadRes.data.status !== "success") throw new Error("Upload failed");
        finalUrl = uploadRes.data.url;
      }

      notify("🚀 Memulai proses di latar belakang...");

      const res = await axios.post(`${API_URL}/jobs`, {
        url: finalUrl,
        provider: p.provider,
        api_key: p.apiKey,
        mode: p.mode,
        manual_start: p.manualStart,
        manual_end: p.manualEnd,
        aspect_ratio: p.aspectRatio,
        caption_style: p.captionStyle,
        burn_subs: p.burnSubtitles,
        output_dir: p.outputFolder,
        quality: p.quality
      });

      if (res.data.status === "error") throw new Error(res.data.message);
      setActiveJobId(res.data.job_id);
    } catch (err: any) {
      console.error(err);
      setStatus("ERROR");
      setProgress("");
      const msg = err.response?.data?.message || err.message || "An unknown error occurred.";
      setErrorMsg(msg);
      notify(`⚠️ ${msg}`, "error");
    }
  };

  const handleRerender = async (historyJobId: string, customAspectRatio: string, customCaptionStyle: string, customBurnSubs: boolean) => {
    setStatus("TRANSCRIBING");
    setProgress("");
    setErrorMsg("");

    try {
      const res = await axios.post(`${API_URL}/jobs/${historyJobId}/rerender`, {
        url: "dummy",
        provider: "openai",
        api_key: "dummy",
        mode: "rerender",
        manual_start: "00:00:00",
        manual_end: "00:00:00",
        aspect_ratio: customAspectRatio,
        caption_style: customCaptionStyle,
        burn_subs: customBurnSubs,
        output_dir: p.outputFolder,
        quality: p.quality
      });

      if (res.data.status === "error") throw new Error(res.data.message);

      setActiveJobId(res.data.job_id);
      p.closeHistory();
      notify("🚀 Memulai re-render dari history...");
    } catch (err: any) {
      console.error(err);
      setStatus("ERROR");
      setProgress("");
      const msg = err.response?.data?.message || err.message || "Gagal memulai re-render.";
      setErrorMsg(msg);
      notify(`⚠️ ${msg}`, "error");
    }
  };

  const handleRerunAI = async (historyJobId: string, extraPrompt: string) => {
    setStatus("TRANSCRIBING");
    setProgress("");
    setErrorMsg("");

    try {
      const res = await axios.post(`${API_URL}/jobs/${historyJobId}/rerun_ai`, {
        url: "dummy",
        provider: p.provider,
        api_key: p.apiKey,
        mode: "rerun_ai",
        manual_start: "00:00:00",
        manual_end: "00:00:00",
        aspect_ratio: p.aspectRatio,
        caption_style: p.captionStyle,
        burn_subs: p.burnSubtitles,
        output_dir: p.outputFolder,
        quality: p.quality,
        extra_prompt: extraPrompt
      });

      if (res.data.status === "error") throw new Error(res.data.message);

      setActiveJobId(res.data.job_id);
      p.closeHistory();
      notify("✨ Memulai proses AI Koreksi dari history...");
    } catch (err: any) {
      console.error(err);
      setStatus("ERROR");
      setProgress("");
      const msg = err.response?.data?.message || err.message || "Gagal memulai AI Koreksi.";
      setErrorMsg(msg);
      notify(`⚠️ ${msg}`, "error");
    }
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
    isRunning, progressPct,
    handleGenerate, handleRerender, handleRerunAI, cancelJob,
  };
}
