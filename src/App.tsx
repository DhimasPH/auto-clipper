import React, { useState, useEffect } from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "./layouts/AppLayout";
import { WorkspacePage } from "./pages/WorkspacePage";
import { SmartEditorPage } from "./pages/SmartEditorPage";
import { ManualAIEditorPage } from "./pages/ManualAIEditorPage";
import { HistoryPage } from "./pages/HistoryPage";
import { ManualDownloaderPage } from "./pages/ManualDownloaderPage";
import { SettingsPage } from "./pages/SettingsPage";
import { HelpPage } from "./pages/HelpPage";
import Toasts from "./components/Toasts";
import { SplashScreen } from "./components/SplashScreen";

import { useTheme } from "./hooks/useTheme";
import { useToasts } from "./hooks/useToasts";
import { useUserSettings } from "./hooks/useUserSettings";
import { useClipJobs } from "./hooks/useClipJobs";
import { useStartupUpdateCheck } from "./hooks/useStartupUpdateCheck";
import { ProviderId, DEFAULT_PROVIDER, LEGACY_PROVIDER_MIGRATION } from "./lib/providers";
import { SHOW_EXPERIMENTAL_FEATURES } from "./config/features";
import { CanvasConfig, DEFAULT_CANVAS_CONFIG } from "./types/canvas";
import { SubtitleConfig, DEFAULT_SUBTITLE_CONFIG } from "./types/subtitle";

export let API_URL = "http://127.0.0.1:8000";
export function setApiUrl(url: string) {
  API_URL = url;
}

export const AppContext = React.createContext<any>(null);

export default function App() {
  const {
    isInitializing,
    apiKeys,
    setApiKey,
    outputFolder,
    setOutputFolder,
    quality,
    setQuality,
    whisperModel,
    setWhisperModel,
  } = useUserSettings();
  const { theme, setTheme } = useTheme();
  const { toasts, notify } = useToasts();

  useStartupUpdateCheck({ notify });

  const [url, setUrl] = useState("");
  const [splashComplete, setSplashComplete] = useState(false);
  const [provider, setProvider] = useState<ProviderId>(() => {
    const saved = localStorage.getItem("ac_provider");
    if (saved && LEGACY_PROVIDER_MIGRATION[saved]) {
      return LEGACY_PROVIDER_MIGRATION[saved].provider;
    }
    return (saved as ProviderId) || DEFAULT_PROVIDER;
  });

  const [selectedModel, setSelectedModel] = useState<string>(() => {
    const savedProvider = localStorage.getItem("ac_provider");
    if (savedProvider && LEGACY_PROVIDER_MIGRATION[savedProvider]) {
      return LEGACY_PROVIDER_MIGRATION[savedProvider].model;
    }
    return localStorage.getItem("ac_model") || "";
  });

  const apiKey = apiKeys[provider] || "";
  const customBaseUrl = apiKeys["custom_base_url"] || "";
  const customModelName = apiKeys["custom_model_name"] || "";

  const [inputType, setInputType] = useState<"url" | "local">("url");
  const [localFile, setLocalFile] = useState<File | null>(null);
  const [aspectRatio, setAspectRatio] = useState<
    "1:1" | "4:5" | "9:16" | "16:9"
  >("9:16");
  const [captionStyle, setCaptionStyle] = useState<"standard" | "karaoke">(
    "karaoke",
  );
  const [canvasConfig, setCanvasConfig] = useState<CanvasConfig>(DEFAULT_CANVAS_CONFIG);
  const [subtitleConfig, setSubtitleConfig] = useState<SubtitleConfig>(DEFAULT_SUBTITLE_CONFIG);

  useEffect(() => {
    localStorage.setItem("ac_provider", provider);
  }, [provider]);

  useEffect(() => {
    localStorage.setItem("ac_model", selectedModel);
  }, [selectedModel]);

  const [burnSubtitles, setBurnSubtitles] = useState(true);
  const [title, setTitle] = useState("");
  const [enableBroll, setEnableBroll] = useState(false);
  const [maxClips, setMaxClips] = useState(0);
  const [isGamingVideo, setIsGamingVideo] = useState(false);
  const pexelsApiKey = apiKeys["pexels"] || "";

  // Smart Manual Clipper state, lifted here so it survives route changes
  // (the editor page unmounts on navigation and would otherwise reset).
  const [manualFile, setManualFile] = useState<File | null>(null);
  const [manualLocalUrl, setManualLocalUrl] = useState<string | null>(null);
  const [manualClips, setManualClips] = useState<any[]>([]);
  const [manualMeta, setManualMeta] = useState<any>(null);

  const {
    status,
    progress,
    errorMsg,
    clips,
    failedCount,
    isRunning,
    progressPct,
    historyVersion,
    activeJobId,
    handleGenerate,
    handleManualGenerate,
    handleRerender,
    handleRerunAI,
    handleResumeJob,
    startManualResumePolling,
    cancelJob,
    resetJobState,
  } = useClipJobs({
    inputType,
    url,
    localFile,
    provider,
    apiKey,
    customBaseUrl,
    customModelName,
    model: selectedModel,
    aspectRatio,
    captionStyle: subtitleConfig.style,
    burnSubtitles,
    canvasConfig,
    subtitleConfig,
    outputFolder,
    quality,
    title,
    enableBroll,
    pexelsApiKey,
    notify,
    closeHistory: () => {},
    maxClips,
    isGamingVideo,
    whisperModel,
  });

  const videoSrc = (p: string, v = 0) =>
    `${API_URL}/video?path=${encodeURIComponent(p)}&v=${v}`;

  const handleResetWorkspace = () => {
    setUrl("");
    setTitle("");
    setLocalFile(null);
    setCanvasConfig(DEFAULT_CANVAS_CONFIG);
    setSubtitleConfig(DEFAULT_SUBTITLE_CONFIG);
    resetJobState();
  };

  if (!splashComplete) {
    return (
      <SplashScreen
        isInitializing={isInitializing}
        onFinish={() => setSplashComplete(true)}
      />
    );
  }

  const contextValue = {
    theme,
    setTheme,
    notify,
    provider,
    setProvider,
    selectedModel,
    setSelectedModel,
    apiKeys,
    setApiKey,
    outputFolder,
    setOutputFolder,
    quality,
    setQuality,
    whisperModel,
    setWhisperModel,
    inputType,
    setInputType,
    url,
    setUrl,
    setLocalFile,
    aspectRatio,
    setAspectRatio,
    captionStyle: subtitleConfig.style,
    setCaptionStyle: (style: "standard" | "karaoke") => {
      setCaptionStyle(style);
      setSubtitleConfig((prev) => ({ ...prev, style }));
    },
    burnSubtitles,
    setBurnSubtitles,
    canvasConfig,
    setCanvasConfig,
    subtitleConfig,
    setSubtitleConfig: (cfgOrFn: any) => {
      setSubtitleConfig((prev) => {
        const next = typeof cfgOrFn === "function" ? cfgOrFn(prev) : cfgOrFn;
        if (next.style && next.style !== captionStyle) {
          setCaptionStyle(next.style);
        }
        return next;
      });
    },
    title,
    setTitle,
    enableBroll,
    setEnableBroll,
    maxClips,
    setMaxClips,
    isGamingVideo,
    setIsGamingVideo,
    errorMsg,
    isRunning,
    status,
    progressPct,
    progress,
    jobId: activeJobId,
    handleGenerate,
    handleManualGenerate,
    startManualResumePolling,
    cancelJob,
    manualFile, setManualFile,
    manualLocalUrl, setManualLocalUrl,
    manualClips, setManualClips,
    manualMeta, setManualMeta,
    clips,
    failedCount,
    videoSrc,
    historyVersion,
    handleRerender,
    handleRerunAI,
    handleResumeJob,
    handleResetWorkspace,
  };

  return (
    <AppContext.Provider value={contextValue}>
      <HashRouter>
        <Toasts toasts={toasts} />

        <Routes>
          <Route path="/" element={<AppLayout />}>
            <Route index element={<WorkspacePage />} />
            <Route path="manual-ai" element={<ManualAIEditorPage />} />
            <Route
              path="editor"
              element={SHOW_EXPERIMENTAL_FEATURES ? <SmartEditorPage /> : <Navigate to="/" replace />}
            />
            <Route path="downloader" element={<ManualDownloaderPage />} />
            <Route path="history" element={<HistoryPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="help" element={<HelpPage />} />
          </Route>
        </Routes>
      </HashRouter>
    </AppContext.Provider>
  );
}
