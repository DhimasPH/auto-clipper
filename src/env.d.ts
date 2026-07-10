/// <reference types="vite/client" />

interface Window {
  electronAPI: {
    setJobActive: (active: boolean) => void;
    getBackendPort: () => Promise<number | null>;
    getApiKeys: () => Promise<{ apiKey: string; openaiKey: string }>;
    saveApiKeys: (keys: { apiKey: string; openaiKey: string }) => Promise<boolean>;
  };
}
