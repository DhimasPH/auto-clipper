import { useState, useEffect } from "react";
import axios from "axios";
import { useTranslation } from "react-i18next";
import FAQModal from "./components/FAQModal";
import Header from "./components/Header";
import ClipCard, { Clip } from "./components/ClipCard";
import SettingsModal from "./components/SettingsModal";
import HistoryModal from "./components/HistoryModal";

export let API_URL = "http://127.0.0.1:8000";

export default function App() {
  const { t } = useTranslation();
  const [isInitializing, setIsInitializing] = useState(true);
  const [backendStatus, setBackendStatus] = useState("Checking...");
  const [url, setUrl] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [geminiKey, setGeminiKey] = useState("");
  const [outputFolder, setOutputFolder] = useState(() => {
    return localStorage.getItem("ac_output_folder") || "";
  });
  const [quality, setQuality] = useState<"best" | "1080p" | "720p">(() => {
    return (localStorage.getItem("ac_quality") as any) || "best";
  });
  const [provider, setProvider] = useState<"openai" | "gemini">(() => {
    return (localStorage.getItem("ac_provider") as any) || "openai";
  });

  const [inputType, setInputType] = useState<"url" | "local">("url");
  const [localFile, setLocalFile] = useState<File | null>(null);
  const [aspectRatio, setAspectRatio] = useState<"1:1" | "4:5" | "9:16">("9:16");
  const [captionStyle, setCaptionStyle] = useState<"standard" | "karaoke">("standard");

  useEffect(() => {
    async function init() {
      if (window.electronAPI) {
        const port = await window.electronAPI.getBackendPort();
        if (port) {
          API_URL = `http://127.0.0.1:${port}`;
        }
        
        const keys = await window.electronAPI.getApiKeys();
        if (keys && (keys.openaiKey || keys.geminiKey)) {
          setOpenaiKey(keys.openaiKey || "");
          setGeminiKey(keys.geminiKey || "");
        } else {
          // Migration from localStorage
          const lsApi = localStorage.getItem("ac_api_key");
          const lsOpenai = localStorage.getItem("ac_openai_key");
          if (lsApi || lsOpenai) {
             const keyA = lsApi ? atob(lsApi) : "";
             const keyB = lsOpenai ? atob(lsOpenai) : "";
             // During migration, we assume ac_api_key was used for whichever provider was selected, but to be safe we can just put it in both or one.
             await window.electronAPI.saveApiKeys({ openaiKey: keyB, geminiKey: keyA });
             setOpenaiKey(keyB);
             setGeminiKey(keyA);
             localStorage.removeItem("ac_api_key");
             localStorage.removeItem("ac_openai_key");
          }
        }
      } else {
        // Fallback for browser (development)
        try {
          const lsApi = localStorage.getItem("ac_api_key");
          const lsOpenai = localStorage.getItem("ac_openai_key");
          if (lsApi) setGeminiKey(atob(lsApi));
          if (lsOpenai) setOpenaiKey(atob(lsOpenai));
        } catch (e) {}
      }
      setIsInitializing(false);
    }
    init();
  }, []);

  useEffect(() => {
    if (!isInitializing) {
      if (window.electronAPI) {
        window.electronAPI.saveApiKeys({ openaiKey, geminiKey });
      } else {
        if (geminiKey) localStorage.setItem("ac_api_key", btoa(geminiKey));
        else localStorage.removeItem("ac_api_key");
        if (openaiKey) localStorage.setItem("ac_openai_key", btoa(openaiKey));
        else localStorage.removeItem("ac_openai_key");
      }
    }
  }, [openaiKey, geminiKey, isInitializing]);

  useEffect(() => {
    localStorage.setItem("ac_provider", provider);
    if (provider === "gemini" && captionStyle === "karaoke") {
      setCaptionStyle("standard");
    }
  }, [provider]);

  useEffect(() => {
    localStorage.setItem("ac_output_folder", outputFolder);
  }, [outputFolder]);

  useEffect(() => {
    localStorage.setItem("ac_quality", quality);
  }, [quality]);

  const [mode, setMode] = useState<"ai" | "manual">("ai");
  const [manualStart, setManualStart] = useState("00:00:00");
  const [manualEnd, setManualEnd] = useState("00:00:15");

  const [status, setStatus] = useState<
    "IDLE" | "GENERATING" | "DOWNLOADING" | "TRANSCRIBING" | "CROPPING" | "DONE" | "ERROR"
  >("IDLE");
  const [errorMsg, setErrorMsg] = useState("");
  const [progress, setProgress] = useState("");

  const [clips, setClips] = useState<Clip[]>([]);
  const [totalClips, setTotalClips] = useState(0);
  const [failedCount, setFailedCount] = useState(0);

  // Global subtitle toggle applied before generating (per-clip live toggle was
  // removed — use this + History re-render to change captions).
  const [burnSubtitles, setBurnSubtitles] = useState(true);

  // Task 1.3: FAQ Modal state
  const [isFAQOpen, setIsFAQOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);


  // Task 3.2: Theme state
  const [theme, setTheme] = useState<"dark" | "light" | "system">(() => {
    return (localStorage.getItem("ac_theme") as any) || "system";
  });

  useEffect(() => {
    localStorage.setItem("ac_theme", theme);
    const root = document.documentElement;
    if (theme === "system") {
      const prefersLight = window.matchMedia("(prefers-color-scheme: light)").matches;
      root.setAttribute("data-theme", prefersLight ? "light" : "dark");
    } else {
      root.setAttribute("data-theme", theme);
    }
  }, [theme]);

  type Toast = { id: number; text: string; kind: "info" | "success" | "error" };
  const [toasts, setToasts] = useState<Toast[]>([]);

  const notify = (text: string, kind: Toast["kind"] = "info") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, text, kind }]);
    const ttl = kind === "error" ? 8000 : 4000;
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), ttl);
  };

  const videoSrc = (p: string, v = 0) =>
    `${API_URL}/video?path=${encodeURIComponent(p)}&v=${v}`;

  // Poll health so the indicator self-heals once the backend finishes booting
  // (it starts as an Electron child process and isn't ready immediately).
  useEffect(() => {
    // Task 1.2: Request Notification Permission
    if (window.Notification && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  // Polling effect for backend status
  useEffect(() => {
    let active = true;
    const check = () => {
      axios
        .get(`${API_URL}/health`, { timeout: 2500 })
        .then(() => active && setBackendStatus("Connected"))
        .catch(() => active && setBackendStatus("Disconnected"));
    };
    check();
    const id = setInterval(check, 3000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  // Polling effect for Async Job
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
             if (window.Notification && Notification.permission === "granted") {
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
    if (inputType === "url" && !url) {
      notify(t('toast.clip_failed', { num: '', msg: 'URL kosong!' }), "error");
      return;
    }
    if (inputType === "local" && !localFile) {
      notify(t('toast.clip_failed', { num: '', msg: 'Video lokal belum dipilih!' }), "error");
      return;
    }
    
    if (mode === "ai" && provider === "openai" && !openaiKey) {
      notify(t('toast.clip_failed', { num: '', msg: 'API Key OpenAI belum diisi! Silakan isi di Settings.' }), "error");
      return;
    }
    
    if (mode === "ai" && provider === "gemini" && !geminiKey) {
      notify(t('toast.clip_failed', { num: '', msg: 'API Key Gemini belum diisi! Silakan isi di Settings.' }), "error");
      return;
    }

    setErrorMsg("");
    setProgress("");
    setClips([]);
    setTotalClips(0);
    setFailedCount(0);

    try {
      setStatus("GENERATING");
      
      let finalUrl = url;
      if (inputType === "local" && localFile) {
         notify("🚀 Mengunggah video lokal...");
         const formData = new FormData();
         formData.append("file", localFile);
         const uploadRes = await axios.post(`${API_URL}/upload`, formData, {
            headers: { "Content-Type": "multipart/form-data" }
         });
         if (uploadRes.data.status !== "success") throw new Error("Upload failed");
         finalUrl = uploadRes.data.url;
      }
      
      notify("🚀 Memulai proses di latar belakang...");
      
      const res = await axios.post(`${API_URL}/jobs`, {
        url: finalUrl,
        provider,
        api_key: provider === "openai" ? openaiKey : geminiKey,
        mode,
        manual_start: manualStart,
        manual_end: manualEnd,
        aspect_ratio: aspectRatio,
        caption_style: captionStyle,
        burn_subs: burnSubtitles,
        output_dir: outputFolder,
        quality: quality
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
        output_dir: outputFolder,
        quality: quality
      });
      
      if (res.data.status === "error") throw new Error(res.data.message);
      
      setActiveJobId(res.data.job_id);
      setIsHistoryOpen(false);
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
        provider: provider,
        api_key: provider === "openai" ? openaiKey : geminiKey,
        mode: "rerun_ai",
        manual_start: "00:00:00",
        manual_end: "00:00:00",
        aspect_ratio: aspectRatio,
        caption_style: captionStyle,
        burn_subs: burnSubtitles,
        output_dir: outputFolder,
        quality: quality,
        extra_prompt: extraPrompt
      });
      
      if (res.data.status === "error") throw new Error(res.data.message);
      
      setActiveJobId(res.data.job_id);
      setIsHistoryOpen(false);
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

  if (isInitializing) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner" />
        <span style={{ marginLeft: '1rem', color: 'var(--text-secondary)' }}>Memuat pengaturan...</span>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: "2rem",
        maxWidth: "900px",
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: "2rem",
        minHeight: "100vh"
      }}
    >
      {/* Toast notifications */}
      <div
        style={{
          position: "fixed",
          top: "1rem",
          right: "1rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem",
          zIndex: 1000,
          maxWidth: "320px",
        }}
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className="animate-slide-up"
            style={{
              padding: "0.75rem 1rem",
              borderRadius: "12px",
              fontSize: "0.875rem",
              color: "white",
              background:
                t.kind === "error"
                  ? "rgba(239, 68, 68, 0.95)"
                  : t.kind === "success"
                    ? "rgba(16, 185, 129, 0.95)"
                    : "rgba(30, 30, 46, 0.95)",
              border: "1px solid rgba(255,255,255,0.12)",
              boxShadow: "0 4px 20px rgba(0,0,0,0.35)",
            }}
          >
            {t.text}
          </div>
        ))}
      </div>

      <Header 
        onOpenSettings={() => setIsSettingsOpen(true)} 
        backendStatus={backendStatus} 
        onOpenFAQ={() => setIsFAQOpen(true)} 
        onOpenHistory={() => setIsHistoryOpen(true)}
      />

      {/* Main Panel */}
      <main
        className="glass-panel animate-slide-up"
        style={{
          padding: "2rem",
          display: "flex",
          flexDirection: "column",
          gap: "1.5rem",
        }}
      >
        {/* Mode Selector */}
        <div
          style={{
            display: "flex",
            gap: "1rem",
            background: "var(--input-bg)",
            padding: "0.5rem",
            borderRadius: "12px",
          }}
        >
          <button
            onClick={() => setMode("ai")}
            style={{
              flex: 1,
              padding: "0.75rem",
              borderRadius: "8px",
              border: "none",
              background: mode === "ai" ? "var(--accent)" : "transparent",
              color: mode === "ai" ? "#fff" : "var(--text-secondary)",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            {t('main.ai_mode')}
          </button>
          <button
            onClick={() => setMode("manual")}
            style={{
              flex: 1,
              padding: "0.75rem",
              borderRadius: "8px",
              border: "none",
              background: mode === "manual" ? "var(--accent)" : "transparent",
              color: mode === "manual" ? "#fff" : "var(--text-secondary)",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            {t('main.manual_mode')}
          </button>
        </div>

        {/* Input Type Selector */}
        <div style={{ display: "flex", gap: "1rem", background: "var(--input-bg)", padding: "0.5rem", borderRadius: "12px" }}>
          <button
            onClick={() => setInputType("url")}
            style={{
              flex: 1, padding: "0.75rem", borderRadius: "8px", border: "none",
              background: inputType === "url" ? "var(--accent)" : "transparent",
              color: inputType === "url" ? "#fff" : "var(--text-secondary)",
              fontWeight: 600, cursor: "pointer", transition: "all 0.2s",
            }}
          >
            URL Video (YouTube)
          </button>
          <button
            onClick={() => setInputType("local")}
            style={{
              flex: 1, padding: "0.75rem", borderRadius: "8px", border: "none",
              background: inputType === "local" ? "var(--accent)" : "transparent",
              color: inputType === "local" ? "#fff" : "var(--text-secondary)",
              fontWeight: 600, cursor: "pointer", transition: "all 0.2s",
            }}
          >
            Video Lokal (.mp4)
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <label style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--text-secondary)" }}>
            {inputType === "url" ? t('main.url_label') : "Pilih File Video Lokal"}
          </label>
          
          {inputType === "url" ? (
            <input
              type="text"
              placeholder={t('main.url_placeholder')}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              style={{
                width: "100%", padding: "0.875rem 1rem", borderRadius: "12px",
                border: "1px solid var(--border)", background: "var(--input-bg)",
                color: "var(--text-primary)", fontSize: "1rem", outline: "none",
              }}
              onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
              onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
            />
          ) : (
            <input
              type="file"
              accept="video/mp4,video/x-m4v,video/*"
              onChange={(e) => setLocalFile(e.target.files?.[0] || null)}
              style={{
                width: "100%", padding: "0.875rem 1rem", borderRadius: "12px",
                border: "1px solid var(--border)", background: "var(--input-bg)",
                color: "var(--text-primary)", fontSize: "1rem", outline: "none",
              }}
            />
          )}
        </div>

        {/* Aspect Ratio Selector */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <label style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--text-secondary)" }}>
            Rasio Video (Aspect Ratio)
          </label>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            {(["1:1", "4:5", "9:16"] as const).map((ratio) => (
              <button
                key={ratio}
                onClick={() => setAspectRatio(ratio)}
                style={{
                  flex: 1, padding: "0.5rem", borderRadius: "8px", border: "1px solid",
                  borderColor: aspectRatio === ratio ? "var(--accent)" : "var(--border)",
                  background: aspectRatio === ratio ? "rgba(99, 102, 241, 0.1)" : "var(--input-bg)",
                  color: aspectRatio === ratio ? "var(--accent)" : "var(--text-primary)",
                  cursor: "pointer", fontWeight: 600
                }}
              >
                {ratio === "9:16" ? "9:16 (Vertical)" : ratio === "4:5" ? "4:5 (Portrait)" : "1:1 (Square)"}
              </button>
            ))}
          </div>
        </div>

        {mode === "ai" ? (
          <div
            className="animate-slide-up"
            style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}
          >
            {/* Caption Style Selector */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <label style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--text-secondary)" }}>
                Gaya Subtitle
              </label>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                {(["standard", "karaoke"] as const).map((style) => {
                  const disabled = provider === "gemini" && style === "karaoke";
                  return (
                    <button
                      key={style}
                      disabled={disabled}
                      onClick={() => setCaptionStyle(style)}
                      style={{
                        flex: 1, padding: "0.5rem", borderRadius: "8px", border: "1px solid",
                        borderColor: captionStyle === style ? "var(--accent)" : "var(--border)",
                        background: captionStyle === style ? "rgba(99, 102, 241, 0.1)" : "var(--input-bg)",
                        color: captionStyle === style ? "var(--accent)" : "var(--text-primary)",
                        cursor: disabled ? "not-allowed" : "pointer", fontWeight: 600,
                        opacity: disabled ? 0.5 : 1
                      }}
                    >
                      {style === "standard" ? "Standard (Baris)" : "Karaoke (Word-by-word)"}
                    </button>
                  );
                })}
              </div>
            </div>

            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.6rem",
                fontSize: "0.875rem",
                color: "var(--text-secondary)",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={burnSubtitles}
                onChange={(e) => setBurnSubtitles(e.target.checked)}
              />
              {t('main.subtitle_label')}
            </label>
          </div>
        ) : (
          <div
            className="animate-slide-up"
            style={{ display: "flex", gap: "1rem" }}
          >
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
              }}
            >
              <label
                style={{
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  color: "var(--text-secondary)",
                }}
              >
                {t('main.manual_range_label')}
              </label>
              <input
                type="text"
                placeholder="00:00:00"
                value={manualStart}
                onChange={(e) => setManualStart(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.875rem 1rem",
                  borderRadius: "12px",
                  border: "1px solid var(--border)",
                  background: "rgba(0,0,0,0.2)",
                  color: "white",
                  fontSize: "1rem",
                  outline: "none",
                  transition: "border-color 0.2s",
                }}
                onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
                onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
              />
            </div>
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
              }}
            >
              <label
                style={{
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  color: "var(--text-secondary)",
                }}
              >
                {t('main.manual_end')}
              </label>
              <input
                type="text"
                placeholder="00:00:15"
                value={manualEnd}
                onChange={(e) => setManualEnd(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.875rem 1rem",
                  borderRadius: "12px",
                  border: "1px solid var(--border)",
                  background: "var(--input-bg)",
                  color: "var(--text-primary)",
                  fontSize: "1rem",
                  outline: "none",
                  transition: "border-color 0.2s",
                }}
                onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
                onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
              />
            </div>
            
            {/* Kualitas Download */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "1rem" }}>
              <label style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--text-secondary)" }}>
                Kualitas Video (Download)
              </label>
              <select
                value={quality}
                onChange={(e) => setQuality(e.target.value as any)}
                style={{
                  padding: "0.75rem",
                  borderRadius: "8px",
                  border: "1px solid var(--border)",
                  background: "var(--input-bg)",
                  color: "var(--text-primary)",
                  outline: "none",
                  fontWeight: 500
                }}
              >
                <option value="best">Best (Otomatis)</option>
                <option value="1080p">1080p (Maksimal)</option>
                <option value="720p">720p (Lebih cepat)</option>
              </select>
            </div>
          </div>
        )}

        {errorMsg && (
          <div
            style={{
              padding: "1rem",
              borderRadius: "12px",
              background: "var(--error-bg)",
              border: "1px solid var(--error-bg)",
              color: "var(--error-text)",
            }}
          >
            ⚠️ {errorMsg}
          </div>
        )}

        {isRunning ? (
          <button
            onClick={cancelJob}
            style={{
              padding: "1rem",
              borderRadius: "12px",
              border: "none",
              background: "#ef4444",
              color: "#fff",
              fontSize: "1rem",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.2s",
              boxShadow: "0 4px 14px 0 rgba(239, 68, 68, 0.39)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.75rem",
              animation: "pulse-glow-red 2s infinite",
            }}
          >
            <div className="spinner" />
            Batal
          </button>
        ) : (
          <button
            onClick={handleGenerate}
            disabled={false}
            style={{
              padding: "1rem",
              borderRadius: "12px",
              border: "none",
              background: "var(--accent)",
              color: "#fff",
              fontSize: "1rem",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.2s",
              boxShadow: "0 4px 14px 0 rgba(99, 102, 241, 0.39)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.75rem",
              animation: "pulse-glow 2s infinite",
            }}
          >
            {mode === "ai" ? t('main.btn_generate') : t('main.btn_manual_clip')}
          </button>
        )}

        {(isRunning || status === "DONE") && (
          <div
            style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}
          >
            <div
              style={{
                width: "100%",
                height: "8px",
                borderRadius: "99px",
                background: "rgba(255,255,255,0.1)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${progressPct}%`,
                  height: "100%",
                  borderRadius: "99px",
                  background: "var(--accent)",
                  transition: "width 0.4s ease",
                }}
              />
            </div>
            <div
              style={{
                fontSize: "0.75rem",
                color: "var(--text-secondary)",
                textAlign: "right",
              }}
            >
              {progressPct}%{progress ? ` · ${progress}` : ""}
            </div>
          </div>
        )}
      </main>

      {/* Results Section */}
      {clips.length > 0 && (
        <section
          className="animate-slide-up"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
            marginTop: "1rem",
          }}
        >
          <h2 style={{ fontSize: "1.5rem", margin: 0 }}>
            {status === "DONE"
              ? `Generated ${clips.length} clip${clips.length > 1 ? "s" : ""}${failedCount > 0 ? ` (${failedCount} gagal)` : ""}`
              : "Generating clips..."}
          </h2>
          <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
            {clips.map((clip, i) => (
              <ClipCard
                key={clip.path}
                clip={clip}
                index={i}
                mode={mode}
                videoSrc={videoSrc}
              />
            ))}
          </div>
        </section>
      )}

      {/* Task 1.3: Render FAQ Modal */}
      <FAQModal isOpen={isFAQOpen} onClose={() => setIsFAQOpen(false)} />
      <HistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        onRerender={handleRerender}
        onRerunAI={handleRerunAI}
      />
      
      {/* Settings Modal */}
      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        theme={theme}
        setTheme={setTheme}
        provider={provider}
        setProvider={setProvider}
        openaiKey={openaiKey}
        setOpenaiKey={setOpenaiKey}
        geminiKey={geminiKey}
        setGeminiKey={setGeminiKey}
        outputFolder={outputFolder}
        setOutputFolder={setOutputFolder}
        quality={quality}
        setQuality={setQuality}
      />
    </div>
  );
}
