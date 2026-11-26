import React, { createContext, useContext } from "react";
import { useBackendHealth, type BackendStatusKey } from "./useBackendHealth";

export interface BackendStatus {
  status: BackendStatusKey;
  reconnect: () => Promise<void>;
}

/** One /health poller for the whole app (header dot, banner, preflight re-check). */
export const BackendStatusContext = createContext<BackendStatus | null>(null);

export const BackendStatusProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const value = useBackendHealth();
  return <BackendStatusContext.Provider value={value}>{children}</BackendStatusContext.Provider>;
};

export function useBackendStatus(): BackendStatus {
  const value = useContext(BackendStatusContext);
  if (!value) throw new Error("useBackendStatus needs <BackendStatusProvider>.");
  return value;
}
