import { useState, useEffect } from "react";
import { setApiUrl } from "../App";

export type Quality = "best" | "2160p" | "1440p" | "1080p" | "720p" | "480p";

const LS_KEYS = "ac_api_keys";

function decodeLegacy(): Record<string, string> {
  const m: Record<string, string> = {};
  try {
    const lsApi = localStorage.getItem("ac_api_key"); // legacy: gemini key
    const lsOpenai = localStorage.getItem("ac_openai_key");
    if (lsApi) m.gemini = atob(lsApi);
    if (lsOpenai) m.openai = atob(lsOpenai);
  } catch (e) {}
  return m;
}

/**
 * Persisted user settings: a per-provider API key map (Electron safeStorage,
 * with migration from the old openaiKey/geminiKey shape), output folder and
 * download quality. Also resolves the backend port on startup.
 */
export function useUserSettings() {
  const [isInitializing, setIsInitializing] = useState(true);
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [outputFolder, setOutputFolder] = useState(() => localStorage.getItem("ac_output_folder") || "");
  const [quality, setQuality] = useState<Quality>(() => (localStorage.getItem("ac_quality") as Quality) || "best");

  const setApiKey = (id: string, value: string) =>
    setApiKeys((prev) => ({ ...prev, [id]: value }));

  useEffect(() => {
    async function init() {
      if (window.electronAPI) {
        const port = await window.electronAPI.getBackendPort();
        if (port) {
          setApiUrl(`http://127.0.0.1:${port}`);
        }

        const stored: any = await window.electronAPI.getApiKeys();
        if (stored && stored.apiKeys && typeof stored.apiKeys === "object") {
          setApiKeys(stored.apiKeys);
        } else if (stored && (stored.openaiKey || stored.geminiKey)) {
          // Migrate old flat shape -> provider map.
          const migrated = { openai: stored.openaiKey || "", gemini: stored.geminiKey || "" };
          setApiKeys(migrated);
          await window.electronAPI.saveApiKeys({ apiKeys: migrated });
        } else {
          const legacy = decodeLegacy();
          if (Object.keys(legacy).length) {
            setApiKeys(legacy);
            await window.electronAPI.saveApiKeys({ apiKeys: legacy });
            localStorage.removeItem("ac_api_key");
            localStorage.removeItem("ac_openai_key");
          }
        }
      } else {
        // Browser dev fallback.
        try {
          const raw = localStorage.getItem(LS_KEYS);
          if (raw) {
            setApiKeys(JSON.parse(atob(raw)));
          } else {
            const legacy = decodeLegacy();
            if (Object.keys(legacy).length) setApiKeys(legacy);
          }
        } catch (e) {}
      }
      setIsInitializing(false);
    }
    init();
  }, []);

  useEffect(() => {
    if (isInitializing) return;
    if (window.electronAPI) {
      window.electronAPI.saveApiKeys({ apiKeys });
    } else {
      try {
        localStorage.setItem(LS_KEYS, btoa(JSON.stringify(apiKeys)));
      } catch (e) {}
    }
  }, [apiKeys, isInitializing]);

  useEffect(() => {
    localStorage.setItem("ac_output_folder", outputFolder);
  }, [outputFolder]);

  useEffect(() => {
    localStorage.setItem("ac_quality", quality);
  }, [quality]);

  return {
    isInitializing,
    apiKeys, setApiKey,
    outputFolder, setOutputFolder,
    quality, setQuality,
  };
}
