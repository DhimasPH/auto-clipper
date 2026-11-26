import React, { useState, useEffect } from "react";
import { HashRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "./layouts/AppLayout";
import { CreatePage } from "./pages/CreatePage";
import { ProjectsPage } from "./pages/ProjectsPage";
import { ProjectPage } from "./pages/ProjectPage";
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
import { useWebSplash } from "./hooks/useWebSplash";
import { useUpdateNotice } from "./hooks/useUpdateNotice";
import { splashVisible } from "./lib/splash";
import { ProviderId, DEFAULT_PROVIDER, LEGACY_PROVIDER_MIGRATION } from "./lib/providers";
import { loadClipChoices, saveClipChoices, type ClipChoices, type ShapeValue } from "./lib/clipChoices";
import { CanvasConfig } from "./types/canvas";
import { SubtitleConfig } from "./types/subtitle";

export { API_URL, setApiUrl } from "./platform/backendUrl";

export const AppContext = React.createContext<any>(null);

function storageOrNull(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

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
    aiMode,
    setAiMode,
  } = useUserSettings();
  const { theme, setTheme } = useTheme();
  const { toasts, notify } = useToasts();

  useStartupUpdateCheck({ notify });

  const splashMode = platform().caps.splash;
  // Web (SP4 spec 4.3): once per tab, until the first connection check; desktop: while settings load.
  const webSplash = useWebSplash(splashMode === "tab", !isInitializing);
  // Auto Clipper Web (SP4 spec 4.5): one check per app start, shown in Pengaturan, Bantuan.
  const updateNotice = useUpdateNotice(platform().caps.updateNotice && !isInitializing);

  const [url, setUrl] = useState("");
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
  // "Atur tampilan klip" (spec 4.2): remembered for the next video.
  const [choices, setChoices] = useState<ClipChoices>(() => loadClipChoices(storageOrNull()));
  useEffect(() => saveClipChoices(storageOrNull(), choices), [choices]);
  const patchChoices = (patch: Partial<ClipChoices>) => setChoices((c) => ({ ...c, ...patch }));
  const { aspectRatio, trackingMode, burnSubtitles, canvasConfig, subtitleConfig, enableBroll, enableHook, maxClips, isGamingVideo } = choices;
  const [faceTrackingEngine, setFaceTrackingEngine] = useState<"haar" | "mediapipe">(() => (localStorage.getItem("ac_face_engine") as any) || "haar");

  useEffect(() => {
    localStorage.setItem("ac_face_engine", faceTrackingEngine);
  }, [faceTrackingEngine]);

  useEffect(() => {
    localStorage.setItem("ac_provider", provider);
  }, [provider]);

  useEffect(() => {
    localStorage.setItem("ac_model", selectedModel);
  }, [selectedModel]);

  const [title, setTitle] = useState("");
  const pexelsApiKey = apiKeys["pexels"] || "";

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
    current,
    liveMeta,
    makePhase,
    jobOrigin,
    awaiting,
    sendingAnswer,
    answerError,
    submitAiAnswer,
    openAwaiting,
    leaveAwaiting,
    watchJob,
    resultJobId,
    handleGenerate,
    handleManualGenerate,
    handleRerender,
    handleRerunAI,
    handleRerunManual,
    handleResumeJob,
    handleRerenderClip,
    cancelJob,
    resetJobState,
  } = useClipJobs({
    aiMode,
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
    maxClips,
    isGamingVideo,
    whisperModel,
  });

  const handleResetWorkspace = () => {
    setUrl("");
    setTitle("");
    setLocalFile(null);
    setInputType("url");
    resetJobState();
  };

  if (splashVisible(splashMode, isInitializing, webSplash)) {
    return <SplashScreen />;
  }
  // A reload in a tab that already saw the splash: a plain background for the few ms settings take.
  if (isInitializing) {
    return <div className="min-h-dvh bg-bg-primary" />;
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
    localFile,
    setLocalFile,
    choices,
    patchChoices,
    aiMode,
    setAiMode,
    aspectRatio,
    setAspectRatio: (v: ShapeValue) => patchChoices({ aspectRatio: v }),
    trackingMode,
    setTrackingMode: (v: "auto" | "center") => patchChoices({ trackingMode: v }),
    faceTrackingEngine,
    setFaceTrackingEngine,
    captionStyle: subtitleConfig.style,
    setCaptionStyle: (style: SubtitleConfig["style"]) =>
      setChoices((c) => ({ ...c, subtitleConfig: { ...c.subtitleConfig, style } })),
    burnSubtitles,
    setBurnSubtitles: (v: boolean) => patchChoices({ burnSubtitles: v }),
    canvasConfig,
    setCanvasConfig: (v: CanvasConfig) => patchChoices({ canvasConfig: v }),
    subtitleConfig,
    setSubtitleConfig: (cfgOrFn: SubtitleConfig | ((prev: SubtitleConfig) => SubtitleConfig)) =>
      setChoices((c) => ({ ...c, subtitleConfig: typeof cfgOrFn === "function" ? cfgOrFn(c.subtitleConfig) : cfgOrFn })),
    title,
    setTitle,
    enableBroll,
    setEnableBroll: (v: boolean) => patchChoices({ enableBroll: v }),
    enableHook,
    setEnableHook: (v: boolean) => patchChoices({ enableHook: v }),
    maxClips,
    setMaxClips: (v: number) => patchChoices({ maxClips: v }),
    isGamingVideo,
    setIsGamingVideo: (v: boolean) => patchChoices({ isGamingVideo: v }),
    errorMsg,
    errorInfo,
    failedJobId,
    queuePosition,
    jobMeta,
    openCookies: (onRetry?: () => void) => setCookiesModal({ onRetry }),
    pendingLocalUpload,
    // Ruling P6: keep existing url/local inputType intact until a local file is actually chosen.
    requestLocalUpload: () => setPendingLocalUpload(true),
    clearPendingLocalUpload: () => setPendingLocalUpload(false),
    requestDriveBrowser: () => setDriveBrowserOpen(true),
    isRunning,
    status,
    progress,
    current,
    liveMeta,
    makePhase,
    jobOrigin,
    awaiting,
    sendingAnswer,
    answerError,
    submitAiAnswer,
    openAwaiting,
    leaveAwaiting,
    watchJob,
    resultJobId,
    jobId: activeJobId,
    handleGenerate,
    handleManualGenerate,
    cancelJob,
    clips,
    failedCount,
    historyVersion,
    handleRerender,
    handleRerunAI,
    handleRerunManual,
    handleResumeJob,
    handleRerenderClip,
    handleResetWorkspace,
    updateNotice,
  };

  const routes = (
    <Routes>
      <Route path="/" element={<AppLayout />}>
        <Route index element={<CreatePage />} />
        <Route path="riwayat" element={<ProjectsPage />} />
        <Route path="riwayat/:id" element={<ProjectPage />} />
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
              setLocalFile(null);
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
