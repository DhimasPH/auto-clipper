import { beforeEach, describe, expect, it } from "vitest";
import { localSecretKey, localStorageSecrets, readLocalSecret, writeLocalSecret } from "./localSecrets";

describe("localSecrets", () => {
  beforeEach(() => localStorage.clear());

  it("keeps API keys under the key and format the desktop app already uses", () => {
    expect(localSecretKey("apiKeys")).toBe("ac_api_keys");
    localStorage.setItem("ac_api_keys", btoa(JSON.stringify({ openai: "sk-old" })));
    expect(JSON.parse(readLocalSecret("apiKeys")!)).toEqual({ openai: "sk-old" });
  });

  it("round-trips a value and returns null when nothing or garbage is stored", async () => {
    writeLocalSecret("apiKeys", '{"gemini":"g"}');
    expect(await localStorageSecrets.get("apiKeys")).toBe('{"gemini":"g"}');
    expect(await localStorageSecrets.get("other")).toBeNull();
    localStorage.setItem("ac_api_keys", "%%% not base64 %%%");
    expect(readLocalSecret("apiKeys")).toBeNull();
  });
});
