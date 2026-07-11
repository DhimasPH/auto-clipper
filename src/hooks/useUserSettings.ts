import { useState, useEffect } from "react";
import { setApiUrl } from "../App";

export type Quality = "best" | "1080p" | "720p";

/**
 * User settings that persist across sessions: API keys (via Electron
 * safeStorage with localStorage migration), output folder and quality.
 * Also resolves the backend port on startup.
 */
export function useUserSettings() {
  const [isInitializing, setIsInitializing] = useState(true);
  const [openaiKey, setOpenaiKey] = useState("");
  const [geminiKey, setGeminiKey] = useState("");
  const [outputFolder, setOutputFolder] = useState(() => localStorage.getItem("ac_output_folder") || "");
  const [quality, setQuality] = useState<Quality>(() => (localStorage.getItem("ac_quality") as Quality) || "best");

  useEffect(() => {
    async function init() {
      if (window.electronAPI) {
        const port = await window.electronAPI.getBackendPort();
        if (port) {
          setApiUrl(`http://127.0.0.1:${port}`);
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
    localStorage.setItem("ac_output_folder", outputFolder);
  }, [outputFolder]);

  useEffect(() => {
    localStorage.setItem("ac_quality", quality);
  }, [quality]);

  return {
    isInitializing,
    openaiKey, setOpenaiKey,
    geminiKey, setGeminiKey,
    outputFolder, setOutputFolder,
    quality, setQuality,
  };
}
