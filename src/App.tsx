import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { HashRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "./layouts/AppLayout";
import { WorkspacePage } from "./pages/WorkspacePage";
import { HistoryPage } from "./pages/HistoryPage";
import { SettingsPage } from "./pages/SettingsPage";
import { HelpPage } from "./pages/HelpPage";
import Toasts from "./components/Toasts";

import { useTheme } from "./hooks/useTheme";
import { useToasts } from "./hooks/useToasts";
import { useUserSettings } from "./hooks/useUserSettings";
import { useClipJobs } from "./hooks/useClipJobs";

export let API_URL = "http://127.0.0.1:8000";
export function setApiUrl(url: string) {
  API_URL = url;
}

export const AppContext = React.createContext<any>(null);

export default function App() {
  const { t } = useTranslation();
  const {
    isInitializing,
    openaiKey, setOpenaiKey,
    geminiKey, setGeminiKey,
    outputFolder, setOutputFolder,
    quality, setQuality,
  } = useUserSettings();
  const { theme, setTheme } = useTheme();
  const { toasts, notify } = useToasts();

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
  }, [provider, captionStyle]);

  const [mode, setMode] = useState<"ai" | "manual">("ai");
  const [manualStart, setManualStart] = useState("00:00:00");
  const [manualEnd, setManualEnd] = useState("00:00:15");
  const [burnSubtitles, setBurnSubtitles] = useState(true);

  const {
    status, progress, errorMsg, clips, failedCount,
    isRunning, progressPct,
    handleGenerate, handleRerender, handleRerunAI, cancelJob,
  } = useClipJobs({
    inputType, url, localFile, mode, provider, openaiKey, geminiKey,
    manualStart, manualEnd, aspectRatio, captionStyle, burnSubtitles,
    outputFolder, quality,
    notify,
    closeHistory: () => {},
  });

  const videoSrc = (p: string, v = 0) =>
    `${API_URL}/video?path=${encodeURIComponent(p)}&v=${v}`;

  if (isInitializing) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg-primary text-text-secondary">
        <div className="spinner mr-4" />
        <span>{t('main.loading_settings', 'Loading settings...')}</span>
      </div>
    );
  }

  const contextValue = {
    theme, setTheme,
    provider, setProvider,
    openaiKey, setOpenaiKey,
    geminiKey, setGeminiKey,
    outputFolder, setOutputFolder,
    quality, setQuality,
    mode, setMode,
    inputType, setInputType,
    url, setUrl,
    setLocalFile,
    aspectRatio, setAspectRatio,
    captionStyle, setCaptionStyle,
    burnSubtitles, setBurnSubtitles,
    manualStart, setManualStart,
    manualEnd, setManualEnd,
    errorMsg, isRunning, status, progressPct, progress,
    handleGenerate, cancelJob,
    clips, failedCount, videoSrc,
    handleRerender, handleRerunAI
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
