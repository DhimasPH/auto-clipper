/// <reference types="vite/client" />

interface Window {
  electronAPI: {
    setJobActive: (active: boolean) => void;
    getBackendPort: () => Promise<number | null>;
    getApiKeys: () => Promise<{ geminiKey: string; openaiKey: string }>;
    saveApiKeys: (keys: { geminiKey: string; openaiKey: string }) => Promise<boolean>;
    selectFolder: () => Promise<string | null>;
    openFolder: (path: string) => void;
  };
}
