import React, { useState, useEffect } from "react";
import { HashRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "./layouts/AppLayout";
import { WorkspacePage } from "./pages/WorkspacePage";
import { HistoryPage } from "./pages/HistoryPage";
import { SettingsPage } from "./pages/SettingsPage";
import { HelpPage } from "./pages/HelpPage";
import Toasts from "./components/Toasts";
import { SplashScreen } from "./components/SplashScreen";

import { useTheme } from "./hooks/useTheme";
import { useToasts } from "./hooks/useToasts";
import { useUserSettings } from "./hooks/useUserSettings";
import { useClipJobs } from "./hooks/useClipJobs";
import { ProviderId, DEFAULT_PROVIDER } from "./lib/providers";

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
  } = useUserSettings();
  const { theme, setTheme } = useTheme();
  const { toasts, notify } = useToasts();

  const [url, setUrl] = useState("");
  const [splashComplete, setSplashComplete] = useState(false);
  const [provider, setProvider] = useState<ProviderId>(() => {
    return (
      (localStorage.getItem("ac_provider") as ProviderId) || DEFAULT_PROVIDER
    );
  });

  const apiKey = apiKeys[provider] || "";

  const [inputType, setInputType] = useState<"url" | "local">("url");
  const [localFile, setLocalFile] = useState<File | null>(null);
  const [aspectRatio, setAspectRatio] = useState<
    "1:1" | "4:5" | "9:16" | "16:9"
  >("9:16");
  const [captionStyle, setCaptionStyle] = useState<"standard" | "karaoke">(
    "standard",
  );

  useEffect(() => {
    localStorage.setItem("ac_provider", provider);
  }, [provider]);

  const [burnSubtitles, setBurnSubtitles] = useState(true);
  const [title, setTitle] = useState("");
  const [enableBroll, setEnableBroll] = useState(false);
  const [maxClips, setMaxClips] = useState(0);
  const pexelsApiKey = apiKeys["pexels"] || "";

  const {
    status,
    progress,
    errorMsg,
    clips,
    failedCount,
    isRunning,
    progressPct,
    historyVersion,
    handleGenerate,
    handleRerender,
    handleRerunAI,
    cancelJob,
    resetJobState,
  } = useClipJobs({
    inputType,
    url,
    localFile,
    provider,
    apiKey,
    aspectRatio,
    captionStyle,
    burnSubtitles,
    outputFolder,
    quality,
    title,
    enableBroll,
    pexelsApiKey,
    notify,
    closeHistory: () => {},
    maxClips,
  });

  const videoSrc = (p: string, v = 0) =>
    `${API_URL}/video?path=${encodeURIComponent(p)}&v=${v}`;

  const handleResetWorkspace = () => {
    setUrl("");
    setTitle("");
    setLocalFile(null);
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
    provider,
    setProvider,
    apiKeys,
    setApiKey,
    outputFolder,
    setOutputFolder,
    quality,
    setQuality,
    inputType,
    setInputType,
    url,
    setUrl,
    setLocalFile,
    aspectRatio,
    setAspectRatio,
    captionStyle,
    setCaptionStyle,
    burnSubtitles,
    setBurnSubtitles,
    title,
    setTitle,
    enableBroll,
    setEnableBroll,
    maxClips,
    setMaxClips,
    errorMsg,
    isRunning,
    status,
    progressPct,
    progress,
    handleGenerate,
    cancelJob,
    clips,
    failedCount,
    videoSrc,
    historyVersion,
    handleRerender,
    handleRerunAI,
    handleResetWorkspace,
  };

  return (
    <AppContext.Provider value={contextValue}>
      <HashRouter>
        <Toasts toasts={toasts} />

        <Routes>
          <Route path="/" element={<AppLayout />}>
            <Route index element={<WorkspacePage />} />
            <Route path="history" element={<HistoryPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="help" element={<HelpPage />} />
          </Route>
        </Routes>
      </HashRouter>
    </AppContext.Provider>
  );
}
