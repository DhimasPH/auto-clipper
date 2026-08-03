import { useState, useEffect } from "react";
import { setApiUrl } from "../App";
import { Command } from "@tauri-apps/plugin-shell";
import { Stronghold } from "@tauri-apps/plugin-stronghold";
import axios from "axios";

export type Quality = "best" | "2160p" | "1440p" | "1080p" | "720p" | "480p";

const LS_KEYS = "ac_api_keys";
const IS_TAURI = '__TAURI_INTERNALS__' in window;

function decodeLegacy(): Record<string, string> {
  const m: Record<string, string> = {};
  try {
    const lsApi = localStorage.getItem("ac_api_key"); 
    const lsOpenai = localStorage.getItem("ac_openai_key");
    if (lsApi) m.gemini = atob(lsApi);
    if (lsOpenai) m.openai = atob(lsOpenai);
  } catch (e) {}
  return m;
}

let backendPortPromise: Promise<number | null> | null = null;
async function spawnBackend(): Promise<number | null> {
  if (backendPortPromise) return backendPortPromise;
  backendPortPromise = new Promise((resolve) => {
    let resolved = false;
    const finish = (port: number | null) => {
        if (!resolved) {
            resolved = true;
            resolve(port);
        }
    };
    
    // The backend is a large one-file PyInstaller bundle; on a cold start
    // (first launch, CI runners, slower disks, macOS Gatekeeper scanning) it can
    // take over 60s to self-extract and import heavy deps (faster_whisper, cv2,
    // onnxruntime, etc.). The "backend-port-found" listener below still connects
    // late if the process eventually starts, so this is only the pessimistic
    // fallback.
    setTimeout(() => {
        if (!resolved) {
            console.error("Backend spawn timed out after 90 seconds.");
            finish(null);
        }
    }, 90000);

    // Bypass sidecar if VITE_DEV_BACKEND is true
    if (import.meta.env.VITE_DEV_BACKEND === 'true') {
        console.log("Bypassing sidecar, using dev backend at 127.0.0.1:8000");
        const port = 8000;
        const token = "dev-token";
        (window as any).apiToken = token;
        
        axios.interceptors.request.use(config => {
          if (config.url && (config.url.includes('127.0.0.1') || config.url.includes('localhost'))) {
            config.headers.Authorization = `Bearer ${token}`;
          }
          return config;
        });

        setApiUrl(`http://127.0.0.1:${port}`);
        
        resolved = true;
        resolve(port);
        return;
    }

    try {
      const cmd = Command.sidecar("bin/backend");
      cmd.stdout.on("data", (data) => {
        console.log("Backend stdout:", data);
        const lines = data.split(/\r?\n/);
        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (line.startsWith("TOKEN:")) {
            const token = line.replace("TOKEN:", "").trim();
            (window as any).apiToken = token;
            
            axios.interceptors.request.use(config => {
              if (config.url && (config.url.includes('127.0.0.1') || config.url.includes('localhost'))) {
                config.headers['Authorization'] = `Bearer ${token}`;
              }
              return config;
            });
            
            const originalFetch = window.fetch;
            window.fetch = async (...args) => {
              let [resource, config] = args;
              const urlStr = typeof resource === 'string' ? resource : (resource as Request).url;
              if (urlStr.includes('127.0.0.1') || urlStr.includes('localhost')) {
                config = config || {};
                if (config.headers instanceof Headers) {
                  config.headers.set('Authorization', `Bearer ${token}`);
                } else {
                  config.headers = { ...config.headers, 'Authorization': `Bearer ${token}` };
                }
              }
              return originalFetch(resource, config);
            };
          }
          if (line.startsWith("PORT:")) {
            const p = parseInt(line.replace("PORT:", "").trim(), 10);
            if (!isNaN(p)) {
              finish(p);
              window.dispatchEvent(new CustomEvent("backend-port-found", { detail: p }));
            }
          }
        }
      });
      cmd.stderr.on("data", (line) => console.error("Backend stderr:", line));
      cmd.on("close", (data) => {
          console.log("Backend closed:", data.code);
          finish(null);
      });
      cmd.on("error", (e) => {
          console.error("Backend error:", e);
          finish(null);
      });
      cmd.spawn().then((child) => {
          console.log("Backend spawned with pid:", child.pid);
      }).catch((e) => {
        console.error("Failed to spawn backend:", e);
        finish(null);
      });
    } catch (e) {
      console.error(e);
      finish(null);
    }
  });
  return backendPortPromise;
}



async function safeSaveKeys(keys: Record<string, string>) {
    // Always save to localStorage as a reliable backup
    localStorage.setItem(LS_KEYS, btoa(JSON.stringify(keys)));
    
    if (IS_TAURI) {
        try {
            const sh = await Stronghold.load("ac_vault", "ac_pass");
            const client = await sh.createClient("ac_client").catch(() => sh.loadClient("ac_client"));
            const store = await client.getStore();
            const value = new TextEncoder().encode(JSON.stringify(keys));
            await store.insert("apiKeys", Array.from(value));
            await sh.save();
        } catch (e) {
            console.error("Stronghold save error", e);
        }
    }
}

async function safeGetKeys(): Promise<Record<string, string> | null> {
    if (IS_TAURI) {
        try {
            const sh = await Stronghold.load("ac_vault", "ac_pass");
            const client = await sh.createClient("ac_client").catch(() => sh.loadClient("ac_client"));
            const store = await client.getStore();
            const val = await store.get("apiKeys");
            if (val) {
                return JSON.parse(new TextDecoder().decode(new Uint8Array(val)));
            }
        } catch (e) {
             console.error("Stronghold load error", e);
        }
    }
    
    // Fallback to LS if not in Tauri, Stronghold failed, or Stronghold was empty
    const raw = localStorage.getItem(LS_KEYS);
    if (raw) return JSON.parse(atob(raw));
    
    return null;
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
      if (IS_TAURI) {
        window.addEventListener("backend-port-found", ((e: CustomEvent) => {
            console.log("Late backend connection established!");
            const port = e.detail;
            setApiUrl(`http://127.0.0.1:${port}`);
            
            // Start heartbeat
            setInterval(() => {
                fetch(`http://127.0.0.1:${port}/heartbeat`, { method: "POST" }).catch(() => {});
            }, 5000);

            // trigger a re-render or state update if needed
            setApiKey("dummy", "trigger-re-render"); 
        }) as EventListener);

        const port = await spawnBackend();
        if (port) {
          setApiUrl(`http://127.0.0.1:${port}`);
          
          // Start heartbeat
          setInterval(() => {
              fetch(`http://127.0.0.1:${port}/heartbeat`, { method: "POST" }).catch(() => {});
          }, 5000);
        }
      }

      const stored = await safeGetKeys();
      if (stored) {
          setApiKeys(stored);
      } else {
          const legacy = decodeLegacy();
          if (Object.keys(legacy).length) {
              setApiKeys(legacy);
              await safeSaveKeys(legacy);
          }
      }
      setIsInitializing(false);
    }
    init();
  }, []);

  useEffect(() => {
    if (isInitializing) return;
    safeSaveKeys(apiKeys);
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
