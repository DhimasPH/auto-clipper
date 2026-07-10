import { useState, useEffect } from "react";
import axios from "axios";
import { useTranslation } from "react-i18next";
import FAQModal from "./components/FAQModal";
import Header from "./components/Header";
import ClipCard, { Clip } from "./components/ClipCard";
import SettingsModal from "./components/SettingsModal";
import HistoryModal from "./components/HistoryModal";

export const API_URL = "http://127.0.0.1:8000";

export default function App() {
  const { t } = useTranslation();
  const [backendStatus, setBackendStatus] = useState("Checking...");
  const [url, setUrl] = useState("");
  // Task 1.4: Load from localStorage
  const [apiKey, setApiKey] = useState(() => {
    try {
      const saved = localStorage.getItem("ac_api_key");
      return saved ? atob(saved) : "";
    } catch {
      return "";
    }
  });
  const [provider, setProvider] = useState<"openai" | "gemini">(() => {
    return (localStorage.getItem("ac_provider") as any) || "openai";
  });

  // Task 1.4: Save to localStorage on change
  useEffect(() => {
    if (apiKey) localStorage.setItem("ac_api_key", btoa(apiKey));
    else localStorage.removeItem("ac_api_key");
  }, [apiKey]);
  useEffect(() => {
    localStorage.setItem("ac_provider", provider);
  }, [provider]);

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

  // Subtitle controls: default on before generate; the source .srt path is kept
  // so a clip can be re-rendered with captions toggled after generation.
  const [burnSubtitles, setBurnSubtitles] = useState(true);
  const [subtitlePath, setSubtitlePath] = useState<string | null>(null);
  const [sourcePath, setSourcePath] = useState("");
  const [reRendering, setReRendering] = useState<number | null>(null);
  
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

  const MAX_CLIPS = 3; // Demo: generate up to 3 shorts per video.
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
    // Notify electron main process
    try {
      const { ipcRenderer } = window.require('electron');
      ipcRenderer.send('set-job-active', !!activeJobId);
    } catch(e) {
      // Not in electron
    }

    let interval: any;
    if (activeJobId) {
      interval = setInterval(async () => {
        try {
          const res = await axios.get(`${API_URL}/jobs/${activeJobId}`);
          const job = res.data;
          
          if (job.status === "DONE") {
             setStatus("DONE");
             setClips(job.clips);
             setActiveJobId(null);
             setProgress("");
             notify(`🎉 Selesai! ${job.clips.length} clip berhasil dibuat`, "success");
             if (window.Notification && Notification.permission === "granted") {
               new Notification("Auto Clipper Selesai", { body: `${job.clips.length} clip berhasil dibuat!` });
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
    if (!url) {
      notify(t('toast.clip_failed', { num: '', msg: 'URL kosong!' }), "error");
      return;
    }
    
    if (mode === "ai" && !apiKey) {
      notify(t('toast.clip_failed', { num: '', msg: 'API Key belum diisi! Silakan isi di Settings.' }), "error");
      return;
    }

    setErrorMsg("");
    setProgress("");
    setClips([]);
    setTotalClips(0);
    setSubtitlePath(null);

    try {
      setStatus("GENERATING");
      notify("🚀 Memulai proses di latar belakang...");
      
      const res = await axios.post(`${API_URL}/jobs`, {
        url,
        provider,
        api_key: apiKey,
        mode,
        manual_start: manualStart,
        manual_end: manualEnd
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

  // Re-render one already-generated clip with captions turned on/off.
  const toggleClipSubs = async (index: number) => {
    const clip = clips[index];
    if (!clip || !sourcePath) return;
    const wantSubs = !clip.subs;
    setReRendering(index);
    notify(
      `✂️ ${wantSubs ? "Menambahkan" : "Menghapus"} subtitle di clip ${index + 1}...`,
    );
    try {
      const res = await axios.post(`${API_URL}/crop`, {
        file_path: sourcePath,
        start_time: clip.start,
        end_time: clip.end,
        subtitle_path: wantSubs ? subtitlePath : null,
      });
      if (res.data.status === "error") throw new Error(res.data.message);
      setClips((prev) =>
        prev.map((c, i) =>
          i === index
            ? { ...c, path: res.data.file_path, subs: wantSubs, v: c.v + 1 }
            : c,
        ),
      );
      notify(
        `✅ Clip ${index + 1}: subtitle ${wantSubs ? "aktif" : "nonaktif"}`,
        "success",
      );
    } catch (err: any) {
      notify(
        `⚠️ ${err.response?.data?.message || err.message || "Gagal render ulang"}`,
        "error",
      );
    } finally {
      setReRendering(null);
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

  return (
    <div
      style={{
        padding: "2rem",
        maxWidth: "900px",
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: "2rem",
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

        <div
          style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
        >
          <label
            style={{
              fontSize: "0.875rem",
              fontWeight: 500,
              color: "var(--text-secondary)",
            }}
          >
            {t('main.url_label')}
          </label>
          <input
            type="text"
            placeholder={t('main.url_placeholder')}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
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

        {mode === "ai" ? (
          <div
            className="animate-slide-up"
            style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}
          >
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
              <span
                style={{
                  fontSize: "0.875rem",
                  color: "var(--text-primary)",
                  fontWeight: 500,
                }}
              >
                {t('main.subtitle_label')}
              </span>
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
              ? `Generated ${clips.length} clip${clips.length > 1 ? "s" : ""}`
              : "Generating clips..."}
          </h2>
          <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
            {clips.map((clip, i) => (
              <ClipCard
                key={clip.v}
                clip={clip}
                index={i}
                mode={mode}
                subtitlePath={subtitlePath}
                reRendering={reRendering === i}
                onToggleSubs={() => toggleClipSubs(i)}
                videoSrc={videoSrc}
              />
            ))}
          </div>
        </section>
      )}

      {/* Task 1.3: Render FAQ Modal */}
      <FAQModal isOpen={isFAQOpen} onClose={() => setIsFAQOpen(false)} />
      <HistoryModal isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} />
      
      {/* Settings Modal */}
      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        theme={theme}
        setTheme={setTheme}
        provider={provider}
        setProvider={setProvider}
        apiKey={apiKey}
        setApiKey={setApiKey}
      />
    </div>
  );
}
