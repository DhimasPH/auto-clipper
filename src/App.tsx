import { useState, useEffect } from "react";
import axios from "axios";
import FAQModal from "./components/FAQModal";

const API_URL = "http://127.0.0.1:8000";

export default function App() {
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
    "IDLE" | "DOWNLOADING" | "TRANSCRIBING" | "CROPPING" | "DONE" | "ERROR"
  >("IDLE");
  const [errorMsg, setErrorMsg] = useState("");
  const [progress, setProgress] = useState("");

  type Clip = {
    path: string;
    description: string;
    start: string;
    end: string;
    subs: boolean; // whether this clip currently has burned-in captions
    v: number; // cache-buster so the <video> reloads after a re-render
  };
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

  const handleGenerate = async () => {
    if (!url) return setErrorMsg("Please enter a YouTube URL.");
    if (mode === "ai" && !apiKey)
      return setErrorMsg("Please enter an OpenAI API Key for AI mode.");

    setErrorMsg("");
    setProgress("");
    setClips([]);
    setTotalClips(0);
    setSubtitlePath(null);

    try {
      // 1. Download
      setStatus("DOWNLOADING");
      notify("⏬ Mendownload video dari YouTube...");
      const dlRes = await axios.post(`${API_URL}/download`, { url });
      if (dlRes.data.status === "error") throw new Error(dlRes.data.message);
      const videoPath = dlRes.data.file_path;
      setSourcePath(videoPath);
      notify("✅ Video berhasil didownload", "success");

      // 2. Build the list of segments to crop.
      let segments: {
        start_time: string;
        end_time: string;
        description: string;
      }[] = [];
      let srtPath: string | null = null;

      if (mode === "ai") {
        setStatus("TRANSCRIBING");
        notify(
          `🧠 AI (${provider === "gemini" ? "Gemini" : "OpenAI"}) menganalisis video...`,
        );
        const aiRes = await axios.post(`${API_URL}/process-ai`, {
          file_path: videoPath,
          api_key: apiKey,
          provider,
        });
        if (aiRes.data.status === "error") throw new Error(aiRes.data.message);

        const highlights = aiRes.data.highlights;
        srtPath = aiRes.data.subtitle_path || null;
        setSubtitlePath(srtPath);

        if (!highlights || highlights.length === 0) {
          throw new Error("No highlights could be detected.");
        }
        notify(`🎯 ${highlights.length} highlight ditemukan`, "success");

        segments = highlights.slice(0, MAX_CLIPS).map((h: any, i: number) => ({
          start_time: h.start_time,
          end_time: h.end_time,
          description: h.description || `Highlight ${i + 1}`,
        }));
      } else {
        segments = [
          {
            start_time: manualStart,
            end_time: manualEnd,
            description: "Manual custom clip",
          },
        ];
      }

      // 3. Crop every segment into its own vertical clip.
      const useSubs = burnSubtitles && !!srtPath;
      setStatus("CROPPING");
      setTotalClips(segments.length);
      const generated: Clip[] = [];
      for (let i = 0; i < segments.length; i++) {
        setProgress(`Rendering clip ${i + 1} of ${segments.length}`);
        notify(`✂️ Merender clip ${i + 1} dari ${segments.length}...`);
        const seg = segments[i];
        
        try {
          const cropRes = await axios.post(`${API_URL}/crop`, {
            file_path: videoPath,
            start_time: seg.start_time,
            end_time: seg.end_time,
            subtitle_path: useSubs ? srtPath : null,
          });
          if (cropRes.data.status === "error")
            throw new Error(cropRes.data.message);
          generated.push({
            path: cropRes.data.file_path,
            description: seg.description,
            start: seg.start_time,
            end: seg.end_time,
            subs: useSubs,
            v: 0,
          });
          setClips([...generated]);
        } catch (cropErr: any) {
          console.error(`Clip ${i+1} failed:`, cropErr);
          notify(`⚠️ Clip ${i+1} gagal: ${cropErr.response?.data?.message || cropErr.message}`, "error");
        }
      }

      setProgress("");
      setStatus("DONE");
      if (generated.length > 0) {
        notify(`🎉 Selesai! ${generated.length} clip berhasil dibuat`, "success");
        if (window.Notification && Notification.permission === "granted") {
          new Notification("Auto Clipper Selesai", { body: `${generated.length} clip berhasil dibuat!` });
        }
      } else {
        throw new Error("Semua clip gagal dirender.");
      }
    } catch (err: any) {
      console.error(err);
      setStatus("ERROR");
      setProgress("");
      const msg =
        err.response?.data?.message ||
        err.message ||
        "An unknown error occurred.";
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

  const isRunning =
    status !== "IDLE" && status !== "DONE" && status !== "ERROR";
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

      {/* Header */}
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: "2.5rem",
              fontWeight: 700,
              background: "linear-gradient(90deg, #818cf8, #c084fc)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Auto Clipper ⚡️
          </h1>
          <p style={{ margin: "0.5rem 0 0 0", color: "var(--text-secondary)" }}>
            Turn long videos into viral shorts instantly.
          </p>
        </div>
        <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
          <button
            onClick={() => setIsFAQOpen(true)}
            style={{
              background: "rgba(255,255,255,0.1)",
              border: "1px solid rgba(255,255,255,0.2)",
              color: "white",
              width: "32px",
              height: "32px",
              borderRadius: "50%",
              cursor: "pointer",
              fontWeight: "bold",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "background 0.2s"
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.2)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.1)")}
            title="Cara Penggunaan (FAQ)"
          >
            ?
          </button>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              fontSize: "0.875rem",
              background: "rgba(255,255,255,0.05)",
              padding: "0.5rem 1rem",
              borderRadius: "99px",
            }}
          >
            <div
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                backgroundColor:
                  backendStatus === "Connected" ? "#10b981" : "#ef4444",
              }}
            />
            Backend: {backendStatus}
          </div>
        </div>
      </header>

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
            background: "rgba(0,0,0,0.2)",
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
              color: mode === "ai" ? "white" : "var(--text-secondary)",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            ✨ AI Auto Clip
          </button>
          <button
            onClick={() => setMode("manual")}
            style={{
              flex: 1,
              padding: "0.75rem",
              borderRadius: "8px",
              border: "none",
              background: mode === "manual" ? "var(--accent)" : "transparent",
              color: mode === "manual" ? "white" : "var(--text-secondary)",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            ✂️ Manual Clip
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
            YouTube Video URL
          </label>
          <input
            type="text"
            placeholder="https://www.youtube.com/watch?v=..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
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

        {mode === "ai" ? (
          <div
            className="animate-slide-up"
            style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}
          >
            <div
              style={{
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
                AI Provider
              </label>
              <select
                value={provider}
                onChange={(e) =>
                  setProvider(e.target.value as "openai" | "gemini")
                }
                style={{
                  width: "100%",
                  padding: "0.875rem 1rem",
                  borderRadius: "12px",
                  border: "1px solid var(--border)",
                  background: "rgba(0,0,0,0.2)",
                  color: "white",
                  fontSize: "1rem",
                  outline: "none",
                }}
              >
                <option value="openai" style={{ background: "#1e1e2e" }}>
                  OpenAI (GPT-4o + Whisper)
                </option>
                <option value="gemini" style={{ background: "#1e1e2e" }}>
                  Google Gemini (2.5 Flash)
                </option>
              </select>
            </div>
            <div
              style={{
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
                {provider === "openai"
                  ? "OpenAI API Key (For Transcription & Highlights)"
                  : "Gemini API Key"}
              </label>
              <input
                type="password"
                placeholder={provider === "openai" ? "..." : "..."}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
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
              Pasang subtitle ke video (bisa diubah per-clip setelah generate)
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
                Start Time
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
                End Time
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
          </div>
        )}

        {errorMsg && (
          <div
            style={{
              padding: "1rem",
              borderRadius: "12px",
              background: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.2)",
              color: "#f87171",
            }}
          >
            ⚠️ {errorMsg}
          </div>
        )}

        <button
          onClick={handleGenerate}
          disabled={
            status !== "IDLE" && status !== "DONE" && status !== "ERROR"
          }
          style={{
            marginTop: "1rem",
            padding: "1rem",
            borderRadius: "12px",
            border: "none",
            background: "var(--accent)",
            color: "white",
            fontSize: "1rem",
            fontWeight: 600,
            cursor:
              status !== "IDLE" && status !== "DONE" && status !== "ERROR"
                ? "not-allowed"
                : "pointer",
            transition: "all 0.2s",
            opacity:
              status !== "IDLE" && status !== "DONE" && status !== "ERROR"
                ? 0.7
                : 1,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: "0.75rem",
            animation: status === "IDLE" ? "pulse-glow 2s infinite" : "none",
          }}
        >
          {status !== "IDLE" && status !== "DONE" && status !== "ERROR" ? (
            <>
              <div className="spinner" />{" "}
              {status === "DOWNLOADING"
                ? "Downloading video..."
                : status === "TRANSCRIBING"
                  ? "AI is analyzing the audio..."
                  : progress || "Rendering clips..."}
            </>
          ) : mode === "ai" ? (
            "✨ Generate Viral Clips"
          ) : (
            "✂️ Crop Manual Clip"
          )}
        </button>

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
              ? `Generated ${clips.length} clip${clips.length > 1 ? "s" : ""}`
              : "Generating clips..."}
          </h2>
          <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
            {clips.map((clip, i) => (
              <div
                key={clip.path}
                className="glass-panel"
                style={{
                  padding: "1rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "1rem",
                  width: "280px",
                }}
              >
                <div
                  style={{
                    aspectRatio: "9/16",
                    background: "rgba(0,0,0,0.5)",
                    borderRadius: "8px",
                    overflow: "hidden",
                  }}
                >
                  <video
                    key={clip.v}
                    src={videoSrc(clip.path, clip.v)}
                    controls
                    playsInline
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "contain",
                      background: "#000",
                    }}
                  />
                </div>
                <div>
                  <h3 style={{ margin: "0 0 0.5rem 0", fontSize: "1.1rem" }}>
                    {mode === "ai" ? `Clip ${i + 1}` : "Manual clip"}
                  </h3>
                  <p
                    style={{
                      margin: 0,
                      fontSize: "0.875rem",
                      color: "var(--text-secondary)",
                      lineHeight: 1.5,
                    }}
                  >
                    {clip.description}
                  </p>
                  {subtitlePath && (
                    <button
                      onClick={() => toggleClipSubs(i)}
                      disabled={reRendering !== null}
                      style={{
                        display: "block",
                        marginTop: "0.75rem",
                        padding: "0.4rem 0.75rem",
                        borderRadius: "8px",
                        border: "1px solid var(--border)",
                        background: clip.subs
                          ? "var(--accent)"
                          : "rgba(255,255,255,0.06)",
                        color: clip.subs ? "white" : "var(--text-secondary)",
                        fontSize: "0.8rem",
                        cursor:
                          reRendering !== null ? "not-allowed" : "pointer",
                        opacity: reRendering !== null ? 0.6 : 1,
                      }}
                    >
                      {reRendering === i
                        ? "⏳ Merender ulang..."
                        : clip.subs
                          ? "💬 Subtitle: ON (klik untuk matikan)"
                          : "💬 Subtitle: OFF (klik untuk nyalakan)"}
                    </button>
                  )}
                  <a
                    href={videoSrc(clip.path, clip.v)}
                    download
                    style={{
                      display: "inline-block",
                      marginTop: "0.75rem",
                      fontSize: "0.8rem",
                      color: "var(--accent)",
                      textDecoration: "none",
                    }}
                  >
                    ⬇ Download MP4
                  </a>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Task 1.3: Render FAQ Modal */}
      <FAQModal isOpen={isFAQOpen} onClose={() => setIsFAQOpen(false)} />
    </div>
  );
}
