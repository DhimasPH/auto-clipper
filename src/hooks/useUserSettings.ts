import { useState, useEffect } from "react";
import { platform } from "../platform";

export type Quality = "best" | "2160p" | "1440p" | "1080p" | "720p" | "480p";

// All API keys are stored as one JSON string under this secret name
// (desktop: Stronghold + localStorage backup; local: localStorage; cloud: none).
const API_KEYS_SECRET = "apiKeys";

function decodeLegacy(): Record<string, string> {
  const m: Record<string, string> = {};
  try {
    const lsApi = localStorage.getItem("ac_api_key");
    const lsOpenai = localStorage.getItem("ac_openai_key");
    if (lsApi) m.gemini = atob(lsApi);
    if (lsOpenai) m.openai = atob(lsOpenai);
  } catch {
    // Old values that are not base64: ignore them.
  }
  return m;
}

async function saveKeys(keys: Record<string, string>): Promise<void> {
  await platform().secrets.set(API_KEYS_SECRET, JSON.stringify(keys));
}

async function loadKeys(): Promise<Record<string, string> | null> {
  const raw = await platform().secrets.get(API_KEYS_SECRET);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function useUserSettings() {
  const [isInitializing, setIsInitializing] = useState(true);
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [outputFolder, setOutputFolder] = useState(() => localStorage.getItem("ac_output_folder") || "");
  const [quality, setQuality] = useState<Quality>(() => (localStorage.getItem("ac_quality") as Quality) || "best");
  const [whisperModel, setWhisperModel] = useState(() => localStorage.getItem("ac_whisper_model") || "small");

  const setApiKey = (id: string, value: string) =>
    setApiKeys((prev) => ({ ...prev, [id]: value }));

  useEffect(() => {
    async function init() {
      try {
        await platform().backend();
      } catch (e) {
        // The sidebar shows "Terputus" and offers Reconnect; the app still opens.
        console.error("Backend not available at startup:", e);
      }

      const stored = await loadKeys();
      if (stored) {
        setApiKeys(stored);
      } else {
        const legacy = decodeLegacy();
        if (Object.keys(legacy).length) {
          setApiKeys(legacy);
          await saveKeys(legacy);
        }
      }
      setIsInitializing(false);
    }
    init();
  }, []);

  useEffect(() => {
    if (isInitializing) return;
    saveKeys(apiKeys);
  }, [apiKeys, isInitializing]);

  useEffect(() => {
    localStorage.setItem("ac_output_folder", outputFolder);
  }, [outputFolder]);

  useEffect(() => {
    localStorage.setItem("ac_quality", quality);
  }, [quality]);

  useEffect(() => {
    localStorage.setItem("ac_whisper_model", whisperModel);
  }, [whisperModel]);

  return {
    isInitializing,
    apiKeys, setApiKey,
    outputFolder, setOutputFolder,
    quality, setQuality,
    whisperModel, setWhisperModel,
  };
}
