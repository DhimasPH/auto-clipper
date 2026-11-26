import { setAuthToken } from "../auth";

export const CLOUD_TOKEN_KEYS = ["AUTO_CLIPPER_WEB_TOKEN", "ac_web_token"] as const;
/** Fired on window when the saved token changes (detail: { token }). */
export const AUTH_CHANGED_EVENT = "ac_auth_changed";

/** Save (or with "" forget) the access token and tell AuthGate. */
export function saveCloudToken(token: string, storage: Storage = localStorage): void {
  const clean = token.trim();
  for (const key of CLOUD_TOKEN_KEYS) {
    if (clean) storage.setItem(key, clean);
    else storage.removeItem(key);
  }
  setAuthToken(clean || null);
  window.dispatchEvent(new CustomEvent(AUTH_CHANGED_EVENT, { detail: { token: clean } }));
}
