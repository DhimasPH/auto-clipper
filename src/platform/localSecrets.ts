import type { Platform } from "./types";

// Secrets in localStorage, base64 encoded, in the format the desktop app has
// always used as its backup ("ac_api_keys" = btoa(JSON of all API keys)).

export function localSecretKey(name: string): string {
  return name === "apiKeys" ? "ac_api_keys" : `ac_secret_${name}`;
}

export function readLocalSecret(name: string): string | null {
  const raw = localStorage.getItem(localSecretKey(name));
  if (!raw) return null;
  try {
    return atob(raw);
  } catch {
    return null;
  }
}

export function writeLocalSecret(name: string, value: string): void {
  localStorage.setItem(localSecretKey(name), btoa(value));
}

export const localStorageSecrets: Platform["secrets"] = {
  get: async (name) => readLocalSecret(name),
  set: async (name, value) => writeLocalSecret(name, value),
};
