/// <reference types="vite/client" />

interface Window {
  electronAPI: {
    setJobActive: (active: boolean) => void;
    getBackendPort: () => Promise<number | null>;
    getApiKeys: () => Promise<any>;
    saveApiKeys: (keys: any) => Promise<boolean>;
    selectFolder: () => Promise<string | null>;
    openFolder: (path: string) => void;
  };
}
