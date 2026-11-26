import type { BackendInfo } from "../types";

// Local web mode (spec 4.4, 5): the launcher opens http://127.0.0.1:<port>/#t=<token>.
// The token is kept in sessionStorage (this tab only) and removed from the address.
// No side effects on import: LocalGate imports this file directly.

export const LOCAL_TOKEN_KEY = "ac_local_token";
/** Fired on window when the backend cannot be reached any more (the launcher window was closed). */
export const BACKEND_LOST_EVENT = "ac_backend_lost";

const TOKEN_HASH = /^#t=([^&/]+)$/;

/** The launch token: from #t= (then removed from the address), else the one kept for this tab. */
export function takeLocalToken(win: Window = window): string | null {
  const match = TOKEN_HASH.exec(win.location.hash);
  if (match) {
    const token = decodeURIComponent(match[1]);
    try {
      win.sessionStorage.setItem(LOCAL_TOKEN_KEY, token);
    } catch {
      // Storage blocked: the token still works until this page is reloaded.
    }
    // HashRouter owns the hash: give it the start route, and keep the token out of history and bookmarks.
    win.history.replaceState(null, "", `${win.location.pathname}${win.location.search}#/`);
    return token;
  }
  try {
    return win.sessionStorage.getItem(LOCAL_TOKEN_KEY);
  } catch {
    return null;
  }
}

export interface LocalEnv {
  /** Origin of this page: the backend itself in web mode. */
  origin: string;
  /** `npm run dev`: the page comes from Vite and the backend runs by hand on 127.0.0.1:8000. */
  dev: boolean;
  /** VITE_DEV_BACKEND=true: that backend checks the token "dev-token". */
  devBackend: boolean;
}

export function localEnv(): LocalEnv {
  return {
    origin: window.location.origin,
    dev: import.meta.env.DEV,
    devBackend: import.meta.env.VITE_DEV_BACKEND === "true",
  };
}

export function resolveLocalBackend(env: LocalEnv, pageToken: string | null): BackendInfo {
  if (env.dev) return { url: "http://127.0.0.1:8000", token: env.devBackend ? "dev-token" : "" };
  return { url: env.origin, token: pageToken || "" };
}

export type LocalGateState = "checking" | "ok" | "no_token" | "token_expired" | "server_closed";

/** A built page without a token cannot work; `npm run dev` may run without one. */
export function initialGateState(env: LocalEnv, token: string): LocalGateState {
  return !env.dev && !token ? "no_token" : "checking";
}

/** What the answer to the token check means (null: no answer at all). */
export function gateStateAfterCheck(status: number | null): LocalGateState {
  if (status === null) return "server_closed";
  if (status === 401) return "token_expired";
  return "ok";
}
