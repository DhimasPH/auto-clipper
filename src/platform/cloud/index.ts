import { API_URL, setApiUrl } from "../backendUrl";
import { setAuthToken, wireAuthOnce } from "../auth";
import { browserPlatformParts, checkBackend } from "../browser";
import { CAPS } from "../caps";
import type { BackendInfo, Platform } from "../types";
import { AUTH_CHANGED_EVENT, CLOUD_TOKEN_KEYS, saveCloudToken } from "./token";

export { AUTH_CHANGED_EVENT, CLOUD_TOKEN_KEYS, saveCloudToken };

// The Vercel app for a backend on Google Colab (spec 4.7). Same lookup as the former cloud client:
// VITE_API_URL from the build, else the address saved in this browser, else localhost:8000;
// the token is the one the user typed into AuthGate.

export const CLOUD_URL_KEYS = ["AUTO_CLIPPER_API_URL", "ac_api_url"] as const;
const DEFAULT_URL = "http://localhost:8000";

type Reader = Pick<Storage, "getItem">;

function firstStored(storage: Reader, keys: readonly string[]): string {
  for (const key of keys) {
    try {
      const value = storage.getItem(key);
      if (value) return value;
    } catch {
      // Storage blocked: same as not set.
    }
  }
  return "";
}

export function resolveCloudBackend(envUrl: string | undefined, storage: Reader): BackendInfo {
  const url = (envUrl || firstStored(storage, CLOUD_URL_KEYS) || DEFAULT_URL).trim().replace(/\/+$/, "");
  return { url, token: firstStored(storage, CLOUD_TOKEN_KEYS).trim() };
}

function connect(): BackendInfo {
  const info = resolveCloudBackend(import.meta.env.VITE_API_URL, localStorage);
  setApiUrl(info.url);
  setAuthToken(info.token || null);
  wireAuthOnce();
  return info;
}

export function createPlatform(): Platform {
  // Before the first render, so AuthGate already sees a saved token.
  connect();
  return {
    ...browserPlatformParts,
    kind: "cloud",
    caps: CAPS.cloud,
    backend: async () => connect(),
    openFolder: async () => {
      throw new Error("Opening folders is not available in the cloud app.");
    },
    secrets: { get: async () => null, set: async () => {} },
    reconnect: async () => ((await checkBackend(API_URL)) ? connect() : null),
  };
}
