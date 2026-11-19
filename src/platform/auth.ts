import axios from "axios";
import { API_URL } from "./backendUrl";

// The backend token, attached to every request that goes to the backend.
// Moved from useUserSettings.ts (desktop) and the former cloud client (cloud).

let token: string | null = null;
let wired = false;

/** Fired on window when the backend answers 401 (token missing, wrong or from an older launch). */
export const UNAUTHORIZED_EVENT = "ac_unauthorized";

export function setAuthToken(value: string | null): void {
  token = value || null;
}

export function getAuthToken(): string | null {
  return token;
}

/**
 * True when a request goes to our backend and must carry the token: its origin, after resolving
 * a relative URL against the page, equals the backend origin. A relative URL therefore counts only
 * when the backend serves the page (local web). Text inside the URL never decides it.
 */
export function isBackendRequest(url: string, apiUrl: string, pageUrl: string = window.location.href): boolean {
  if (!url || !apiUrl) return false;
  try {
    const backendOrigin = new URL(apiUrl).origin;
    return backendOrigin !== "null" && new URL(url, pageUrl).origin === backendOrigin;
  } catch {
    return false;
  }
}

function requestUrl(resource: RequestInfo | URL): string {
  if (typeof resource === "string") return resource;
  if (resource instanceof URL) return resource.href;
  return resource.url;
}

/** Register the axios interceptors and the fetch wrapper once. They read the latest token. */
export function wireAuthOnce(): void {
  if (wired) return;
  wired = true;

  axios.interceptors.request.use((config) => {
    if (token && config.url && isBackendRequest(config.url, API_URL)) {
      config.headers.set("Authorization", `Bearer ${token}`);
    }
    return config;
  });

  axios.interceptors.response.use(
    (response) => response,
    (error) => {
      const url: string = error?.config?.url || "";
      if (error?.response?.status === 401 && isBackendRequest(url, API_URL)) {
        window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
      }
      return Promise.reject(error);
    },
  );

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (resource: RequestInfo | URL, init?: RequestInit) => {
    const url = requestUrl(resource);
    const toBackend = isBackendRequest(url, API_URL);
    if (token && toBackend) {
      const headers = new Headers(init?.headers || (resource instanceof Request ? resource.headers : undefined));
      headers.set("Authorization", `Bearer ${token}`);
      init = { ...init, headers };
    }
    const response = await originalFetch(resource, init);
    if (response.status === 401 && toBackend) {
      window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
    }
    return response;
  };
}
