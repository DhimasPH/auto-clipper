import axios from "axios";
import { API_URL } from "../backendUrl";
import { setAuthToken, wireAuthOnce } from "../auth";
import { browserPlatformParts, checkBackend } from "../browser";
import { CAPS } from "../caps";
import { localStorageSecrets } from "../localSecrets";
import { folderToOpen } from "../paths";
import type { BackendInfo, Platform } from "../types";

// Task 3 baseline: the same as running the desktop UI in a plain browser before
// SP1 (backend on 127.0.0.1:8000, token only with VITE_DEV_BACKEND=true).
// Task 12 adds the real local web mode (page origin + #t= token).

function connect(): BackendInfo {
  const token = import.meta.env.VITE_DEV_BACKEND === "true" ? "dev-token" : "";
  setAuthToken(token || null);
  wireAuthOnce();
  return { url: API_URL, token };
}

export function createPlatform(): Platform {
  return {
    ...browserPlatformParts,
    kind: "local",
    caps: CAPS.local,
    backend: async () => connect(),
    async openFolder(path) {
      await axios.post(`${API_URL}/open_folder`, { path: folderToOpen(path) });
    },
    secrets: localStorageSecrets,
    reconnect: async () => ((await checkBackend(API_URL)) ? connect() : null),
  };
}
