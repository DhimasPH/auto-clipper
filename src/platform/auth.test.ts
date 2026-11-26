import axios from "axios";
import { describe, expect, it, vi } from "vitest";
import { getAuthToken, isBackendRequest, setAuthToken, UNAUTHORIZED_EVENT, wireAuthOnce } from "./auth";
import { setApiUrl } from "./backendUrl";

// The token goes only where the request's resolved origin is the backend origin.
// Relative URLs resolve against the page, so they count only when the backend serves the page (local web).
describe("isBackendRequest", () => {
  const desktopPage = "http://tauri.localhost/index.html";

  it("sends the token to an absolute backend URL", () => {
    expect(isBackendRequest("https://be.example.com/jobs", "https://be.example.com", desktopPage)).toBe(true);
    expect(isBackendRequest("http://127.0.0.1:5123/health", "http://127.0.0.1:5123", desktopPage)).toBe(true);
  });

  it("does not send the token to another origin", () => {
    expect(isBackendRequest("https://api.openai.com/v1/chat/completions", "http://127.0.0.1:8000", desktopPage)).toBe(false);
    expect(isBackendRequest("https://fonts.googleapis.com/css2", "https://be.example.com", desktopPage)).toBe(false);
    expect(isBackendRequest("http://127.0.0.1:5124/health", "http://127.0.0.1:5123", desktopPage)).toBe(false);
    expect(isBackendRequest("http://localhost:8000/health", "http://127.0.0.1:8000", desktopPage)).toBe(false);
    expect(isBackendRequest("https://be.example.com.evil.net/jobs", "https://be.example.com", desktopPage)).toBe(false);
  });

  it("does not send the token because a loopback address appears somewhere in the URL", () => {
    expect(
      isBackendRequest("https://evil.example/collect?next=http://127.0.0.1:8000/", "http://127.0.0.1:8000", desktopPage),
    ).toBe(false);
    expect(isBackendRequest("https://localhost.evil.example/x", "http://127.0.0.1:8000", desktopPage)).toBe(false);
  });

  it("sends the token for a relative URL only when the backend serves the page", () => {
    expect(isBackendRequest("/history", "http://127.0.0.1:8000", desktopPage)).toBe(false);
    expect(isBackendRequest("/history", "http://127.0.0.1:8000", "http://127.0.0.1:8000/")).toBe(true);
    expect(isBackendRequest("history?x=1", "http://127.0.0.1:8000", "http://127.0.0.1:8000/#t=abc")).toBe(true);
    expect(isBackendRequest("//evil.example/x", "http://127.0.0.1:8000", "http://127.0.0.1:8000/")).toBe(false);
  });

  it("resolves relative URLs against the current page by default", () => {
    expect(isBackendRequest("/history", window.location.origin)).toBe(true);
    expect(isBackendRequest("/history", "https://be.example.com")).toBe(false);
  });

  it("never matches an empty or unparseable URL", () => {
    expect(isBackendRequest("", "https://be.example.com", desktopPage)).toBe(false);
    expect(isBackendRequest("/history", "", desktopPage)).toBe(false);
    expect(isBackendRequest("http://[bad", "https://be.example.com", desktopPage)).toBe(false);
  });
});

describe("wireAuthOnce", () => {
  it("adds the token to backend requests (axios and fetch) and reports a 401 once per response", async () => {
    const seen: (string | null)[] = [];
    const fakeFetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      seen.push(new Headers(init?.headers).get("Authorization"));
      return new Response("{}", { status: 401 });
    });
    window.fetch = fakeFetch as typeof window.fetch;
    setApiUrl("https://be.example.com");
    setAuthToken("tok-1");
    wireAuthOnce();
    wireAuthOnce(); // second call is a no-op

    const unauthorized = vi.fn();
    window.addEventListener(UNAUTHORIZED_EVENT, unauthorized);

    const echoed = await axios.get("https://be.example.com/history", {
      adapter: async (config) => ({ data: config.headers.Authorization, status: 200, statusText: "OK", headers: {}, config }),
    });
    expect(echoed.data).toBe("Bearer tok-1");

    const other = await axios.get("https://example.org/x", {
      adapter: async (config) => ({ data: config.headers.Authorization ?? null, status: 200, statusText: "OK", headers: {}, config }),
    });
    expect(other.data).toBeNull();

    await expect(
      axios.get("https://be.example.com/history", {
        adapter: async (config) => Promise.reject(Object.assign(new Error("401"), { config, response: { status: 401 } })),
      }),
    ).rejects.toThrow();

    await window.fetch("https://be.example.com/jobs");
    await window.fetch("https://api.openai.com/v1/models"); // another origin: no token, and its 401 is not ours
    expect(seen).toEqual(["Bearer tok-1", null]);
    expect(unauthorized).toHaveBeenCalledTimes(2); // axios 401 + backend fetch 401
    expect(getAuthToken()).toBe("tok-1");
  });
});
