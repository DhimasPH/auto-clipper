import { Stronghold } from "@tauri-apps/plugin-stronghold";
import { readLocalSecret, writeLocalSecret } from "../localSecrets";
import type { Platform } from "../types";

// Moved from useUserSettings.ts (safeSaveKeys/safeGetKeys): same vault, client and store key.

async function openStore() {
  const sh = await Stronghold.load("ac_vault", "ac_pass");
  const client = await sh.createClient("ac_client").catch(() => sh.loadClient("ac_client"));
  const store = await client.getStore();
  return { sh, store };
}

/** Stronghold, with localStorage as the reliable backup (unchanged from before SP1). */
export const strongholdSecrets: Platform["secrets"] = {
  async get(name) {
    try {
      const { store } = await openStore();
      const val = await store.get(name);
      if (val) return new TextDecoder().decode(new Uint8Array(val));
    } catch (e) {
      console.error("Stronghold load error", e);
    }
    // Fallback to localStorage if Stronghold failed or was empty
    return readLocalSecret(name);
  },
  async set(name, value) {
    writeLocalSecret(name, value);
    try {
      const { sh, store } = await openStore();
      await store.insert(name, Array.from(new TextEncoder().encode(value)));
      await sh.save();
    } catch (e) {
      console.error("Stronghold save error", e);
    }
  },
};
