import React, { useState, useEffect } from "react";
import { HashRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "./layouts/AppLayout";
import { WorkspacePage } from "./pages/WorkspacePage";
import { ManualAIEditorPage } from "./pages/ManualAIEditorPage";
import { HistoryPage } from "./pages/HistoryPage";
import { SettingsPage } from "./pages/SettingsPage";
import Toasts from "./components/Toasts";
import { CookiesModal } from "./components/CookiesModal";
import { AuthGate } from "./components/AuthGate";
import { LocalGate } from "./components/LocalGate";
import { GDriveBrowserModal } from "./components/GDriveBrowserModal";
import { SplashScreen } from "./components/SplashScreen";
import { legacyRouteElements } from "./components/nav/legacyRoutes";
import { platform } from "./platform";

import { useTheme } from "./hooks/useTheme";
import { useToasts } from "./hooks/useToasts";
import { useUserSettings } from "./hooks/useUserSettings";
import { useClipJobs } from "./hooks/useClipJobs";
import { useStartupUpdateCheck } from "./hooks/useStartupUpdateCheck";
import { ProviderId, DEFAULT_PROVIDER, LEGACY_PROVIDER_MIGRATION } from "./lib/providers";
import { CanvasConfig, DEFAULT_CANVAS_CONFIG } from "./types/canvas";
import { SubtitleConfig, DEFAULT_SUBTITLE_CONFIG } from "./types/subtitle";

export { API_URL, setApiUrl } from "./platform/backendUrl";

export const AppContext = React.createContext<any>(null);

/** The sign-in step of each platform: the one place that checks the platform kind. */
function gate(content: React.ReactNode): React.ReactNode {
  const kind = platform().kind;
  if (kind === "cloud") return <AuthGate>{content}</AuthGate>;
  if (kind === "local") return <LocalGate>{content}</LocalGate>;
  return content;
}

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
  const [trackingMode, setTrackingMode] = useState<"auto" | "center">("auto");
  const [faceTrackingEngine, setFaceTrackingEngine] = useState<"haar" | "mediapipe">(() => (localStorage.getItem("ac_face_engine") as any) || "haar");
  const [captionStyle, setCaptionStyle] = useState<"standard" | "karaoke" | "single_word">(
    "single_word",
  );
  const [canvasConfig, setCanvasConfig] = useState<CanvasConfig>(DEFAULT_CANVAS_CONFIG);
  const [subtitleConfig, setSubtitleConfig] = useState<SubtitleConfig>(DEFAULT_SUBTITLE_CONFIG);

  useEffect(() => {
    localStorage.setItem("ac_face_engine", faceTrackingEngine);
  }, [faceTrackingEngine]);

  useEffect(() => {
    localStorage.setItem("ac_provider", provider);
  }, [provider]);

  useEffect(() => {
    localStorage.setItem("ac_model", selectedModel);
  }, [selectedModel]);

  const [burnSubtitles, setBurnSubtitles] = useState(true);
  const [title, setTitle] = useState("");
  const [enableBroll, setEnableBroll] = useState(false);
  const [enableHook, setEnableHook] = useState(false);
  const [maxClips, setMaxClips] = useState(0);
  const [isGamingVideo, setIsGamingVideo] = useState(false);
  const pexelsApiKey = apiKeys["pexels"] || "";

  // Smart Manual Clipper state, lifted here so it survives route changes
  // (the editor page unmounts on navigation and would otherwise reset).
  const [manualFile, setManualFile] = useState<File | null>(null);
  const [manualLocalUrl, setManualLocalUrl] = useState<string | null>(null);
  const [manualClips, setManualClips] = useState<any[]>([]);
  const [manualMeta, setManualMeta] = useState<any>(null);

  // Cookies upload opened from an error card. `onRetry` runs the failed step again.
  const [cookiesModal, setCookiesModal] = useState<{ onRetry?: () => void } | null>(null);
  // Set by the "Unggah file video" action; the workspace form focuses its file input once.
  const [pendingLocalUpload, setPendingLocalUpload] = useState(false);
  const [driveBrowserOpen, setDriveBrowserOpen] = useState(false);

  const {
    status,
    progress,
    errorMsg,
    errorInfo,
    failedJobId,
    queuePosition,
    jobMeta,
    clips,
    failedCount,
    isRunning,
    historyVersion,
    activeJobId,
    handleGenerate,
    handleManualGenerate,
    handleRerender,
    handleRerunAI,
    handleResumeJob,
    handleRerenderClip,
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
    trackingMode,
    faceTrackingEngine,
    captionStyle: subtitleConfig.style,
    burnSubtitles,
    canvasConfig,
    subtitleConfig,
    outputFolder,
    quality,
    title,
    enableBroll,
    enableHook,
    pexelsApiKey,
    notify,
    closeHistory: () => {},
    maxClips,
    isGamingVideo,
    whisperModel,
  });

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
    trackingMode,
    setTrackingMode,
    faceTrackingEngine,
    setFaceTrackingEngine,
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
    enableHook,
    setEnableHook,
    maxClips,
    setMaxClips,
    isGamingVideo,
    setIsGamingVideo,
    errorMsg,
    errorInfo,
    failedJobId,
    queuePosition,
    jobMeta,
    openCookies: (onRetry?: () => void) => setCookiesModal({ onRetry }),
    pendingLocalUpload,
    requestLocalUpload: () => {
      setInputType("local");
      setPendingLocalUpload(true);
    },
    clearPendingLocalUpload: () => setPendingLocalUpload(false),
    requestDriveBrowser: () => setDriveBrowserOpen(true),
    isRunning,
    status,
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
    historyVersion,
    handleRerender,
    handleRerunAI,
    handleResumeJob,
    handleRerenderClip,
    handleResetWorkspace,
  };

  const routes = (
    <Routes>
      <Route path="/" element={<AppLayout />}>
        {/* Replaced by CreatePage in Task 8. Cloud has no API keys: the manual page. */}
        <Route index element={platform().caps.apiKeys ? <WorkspacePage /> : <ManualAIEditorPage />} />
        <Route path="riwayat" element={<HistoryPage />} />
        <Route path="riwayat/:id" element={<HistoryPage />} />
        <Route path="pengaturan" element={<SettingsPage />} />
        {legacyRouteElements()}
      </Route>
    </Routes>
  );

  return (
    <AppContext.Provider value={contextValue}>
      <HashRouter>
        <Toasts toasts={toasts} />
        {cookiesModal && (
          <CookiesModal onClose={() => setCookiesModal(null)} onRetry={cookiesModal.onRetry} />
        )}
        {platform().caps.driveBrowser && (
          <GDriveBrowserModal
            isOpen={driveBrowserOpen}
            onClose={() => setDriveBrowserOpen(false)}
            onSelectFile={(filePath) => {
              setDriveBrowserOpen(false);
              setInputType("url");
              setUrl(`local:${filePath}`);
            }}
          />
        )}
        {gate(routes)}
      </HashRouter>
    </AppContext.Provider>
  );
}
