import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAuthToken } from "../auth";
import { API_URL } from "../backendUrl";
import { AUTH_CHANGED_EVENT, createPlatform, resolveCloudBackend, saveCloudToken } from "./index";

const storage = (values: Record<string, string>) => ({ getItem: (key: string) => values[key] ?? null });

describe("resolveCloudBackend", () => {
  it("prefers the address built into the app (VITE_API_URL)", () => {
    const info = resolveCloudBackend("https://be.example.com", storage({ AUTO_CLIPPER_API_URL: "https://other" }));
    expect(info.url).toBe("https://be.example.com");
  });

  it("falls back to the address saved in this browser, new key first", () => {
    expect(resolveCloudBackend("", storage({ ac_api_url: "https://old", AUTO_CLIPPER_API_URL: "https://new" })).url).toBe("https://new");
    expect(resolveCloudBackend(undefined, storage({ ac_api_url: "https://old" })).url).toBe("https://old");
  });

  it("uses localhost:8000 when nothing is set, and drops a trailing slash", () => {
    expect(resolveCloudBackend(undefined, storage({})).url).toBe("http://localhost:8000");
    expect(resolveCloudBackend("https://be.example.com/", storage({})).url).toBe("https://be.example.com");
  });

  it("reads the token AuthGate saved, new key first", () => {
    expect(resolveCloudBackend(undefined, storage({ ac_web_token: "old", AUTO_CLIPPER_WEB_TOKEN: "new" })).token).toBe("new");
    expect(resolveCloudBackend(undefined, storage({ ac_web_token: "old" })).token).toBe("old");
    expect(resolveCloudBackend(undefined, storage({})).token).toBe("");
  });
});

describe("cloud platform", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.unstubAllEnvs();
  });

  it("uses the stored address and token, has no API keys and no updater", async () => {
    vi.stubEnv("VITE_API_URL", "");
    localStorage.setItem("AUTO_CLIPPER_API_URL", "https://be.example.com/");
    localStorage.setItem("AUTO_CLIPPER_WEB_TOKEN", "tok-9");

    const p = createPlatform();

    expect(await p.backend()).toEqual({ url: "https://be.example.com", token: "tok-9" });
    expect(API_URL).toBe("https://be.example.com");
    expect(getAuthToken()).toBe("tok-9");
    expect(p.kind).toBe("cloud");
    expect(p.caps.apiKeys).toBe(false);
    expect(p.caps.driveBrowser).toBe(true);
    expect(p.updater).toBeNull();
    expect(typeof p.askNotifyPermission).toBe("function");
    expect(await p.secrets.get("apiKeys")).toBeNull();
  });

  it("saveCloudToken keeps the token under both keys and tells AuthGate", () => {
    const seen = vi.fn();
    window.addEventListener(AUTH_CHANGED_EVENT, seen);

    saveCloudToken("  abc  ");
    expect(localStorage.getItem("AUTO_CLIPPER_WEB_TOKEN")).toBe("abc");
    expect(localStorage.getItem("ac_web_token")).toBe("abc");
    expect(getAuthToken()).toBe("abc");

    saveCloudToken("");
    expect(localStorage.getItem("AUTO_CLIPPER_WEB_TOKEN")).toBeNull();
    expect(getAuthToken()).toBeNull();
    expect(seen).toHaveBeenCalledTimes(2);
  });
});
