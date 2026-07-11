import { useState, useEffect } from "react";
import FAQModal from "./components/FAQModal";
import Header from "./components/Header";
import SettingsModal from "./components/SettingsModal";
import HistoryModal from "./components/HistoryModal";
import Toasts from "./components/Toasts";
import GenerateForm from "./components/GenerateForm";
import ClipsResult from "./components/ClipsResult";
import { useTheme } from "./hooks/useTheme";
import { useToasts } from "./hooks/useToasts";
import { useBackendHealth } from "./hooks/useBackendHealth";
import { useUserSettings } from "./hooks/useUserSettings";
import { useClipJobs } from "./hooks/useClipJobs";

export let API_URL = "http://127.0.0.1:8000";
export function setApiUrl(url: string) {
  API_URL = url;
}

export default function App() {
  const {
    isInitializing,
    openaiKey, setOpenaiKey,
    geminiKey, setGeminiKey,
    outputFolder, setOutputFolder,
    quality, setQuality,
  } = useUserSettings();
  const { theme, setTheme } = useTheme();
  const { toasts, notify } = useToasts();
  const backendStatus = useBackendHealth();

  const [url, setUrl] = useState("");
  const [provider, setProvider] = useState<"openai" | "gemini">(() => {
    return (localStorage.getItem("ac_provider") as any) || "openai";
  });

  const [inputType, setInputType] = useState<"url" | "local">("url");
  const [localFile, setLocalFile] = useState<File | null>(null);
  const [aspectRatio, setAspectRatio] = useState<"1:1" | "4:5" | "9:16" | "16:9">("9:16");
  const [captionStyle, setCaptionStyle] = useState<"standard" | "karaoke">("standard");

  useEffect(() => {
    localStorage.setItem("ac_provider", provider);
    if (provider === "gemini" && captionStyle === "karaoke") {
      setCaptionStyle("standard");
    }
  }, [provider]);

  const [mode, setMode] = useState<"ai" | "manual">("ai");
  const [manualStart, setManualStart] = useState("00:00:00");
  const [manualEnd, setManualEnd] = useState("00:00:15");

  // Global subtitle toggle applied before generating (per-clip live toggle was
  // removed — use this + History re-render to change captions).
  const [burnSubtitles, setBurnSubtitles] = useState(true);

  const [isFAQOpen, setIsFAQOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const {
    status, progress, errorMsg, clips, failedCount,
    isRunning, progressPct,
    handleGenerate, handleRerender, handleRerunAI, cancelJob,
  } = useClipJobs({
    inputType, url, localFile, mode, provider, openaiKey, geminiKey,
    manualStart, manualEnd, aspectRatio, captionStyle, burnSubtitles,
    outputFolder, quality,
    notify,
    closeHistory: () => setIsHistoryOpen(false),
  });

  const videoSrc = (p: string, v = 0) =>
    `${API_URL}/video?path=${encodeURIComponent(p)}&v=${v}`;

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
      <Toasts toasts={toasts} />

      <Header
        onOpenSettings={() => setIsSettingsOpen(true)}
        backendStatus={backendStatus}
        onOpenFAQ={() => setIsFAQOpen(true)}
        onOpenHistory={() => setIsHistoryOpen(true)}
      />

      <GenerateForm
        mode={mode} setMode={setMode}
        inputType={inputType} setInputType={setInputType}
        url={url} setUrl={setUrl}
        setLocalFile={setLocalFile}
        aspectRatio={aspectRatio} setAspectRatio={setAspectRatio}
        captionStyle={captionStyle} setCaptionStyle={setCaptionStyle}
        provider={provider}
        burnSubtitles={burnSubtitles} setBurnSubtitles={setBurnSubtitles}
        manualStart={manualStart} setManualStart={setManualStart}
        manualEnd={manualEnd} setManualEnd={setManualEnd}
        quality={quality} setQuality={setQuality}
        errorMsg={errorMsg}
        isRunning={isRunning}
        status={status}
        progressPct={progressPct}
        progress={progress}
        handleGenerate={handleGenerate}
        cancelJob={cancelJob}
      />

      <ClipsResult
        clips={clips}
        status={status}
        failedCount={failedCount}
        mode={mode}
        videoSrc={videoSrc}
      />

      <FAQModal isOpen={isFAQOpen} onClose={() => setIsFAQOpen(false)} />
      <HistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        onRerender={handleRerender}
        onRerunAI={handleRerunAI}
      />

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
