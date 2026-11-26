import axios from "axios";
import { API_URL, setApiUrl } from "../backendUrl";
import { setAuthToken, wireAuthOnce } from "../auth";
import { browserPlatformParts, checkBackend } from "../browser";
import { CAPS } from "../caps";
import { localStorageSecrets } from "../localSecrets";
import { folderToOpen } from "../paths";
import type { BackendInfo, Platform } from "../types";
import { BACKEND_LOST_EVENT, localEnv, resolveLocalBackend, takeLocalToken } from "./token";

// Local web mode (spec 4.1, 4.4): the page is served by the backend that
// "Auto Clipper Web" started, so the backend is the page origin and the token
// comes from #t=. Under `npm run dev` the backend runs by hand on 127.0.0.1:8000.

let pageToken: string | null = null;

function connect(): BackendInfo {
  const info = resolveLocalBackend(localEnv(), pageToken);
  setApiUrl(info.url);
  setAuthToken(info.token || null);
  wireAuthOnce();
  return info;
}

export function createPlatform(): Platform {
  // Before the first render: HashRouter must not see "#t=…", and LocalGate needs the token.
  pageToken = takeLocalToken();
  connect();
  return {
    ...browserPlatformParts,
    kind: "local",
    caps: CAPS.local,
    backend: async () => connect(),
    async openFolder(path) {
      await axios.post(`${API_URL}/open_folder`, { path: folderToOpen(path) });
    },
    secrets: localStorageSecrets,
    async reconnect() {
      if (await checkBackend(API_URL)) return connect();
      // A new launch uses a new port and token: this tab cannot get the server back.
      window.dispatchEvent(new CustomEvent(BACKEND_LOST_EVENT));
      return null;
    },
  };
}
