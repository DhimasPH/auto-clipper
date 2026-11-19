import axios from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The sidecar is mocked: each spawn plays back the stdout chunks queued in `shell.runs`.
const shell = vi.hoisted(() => ({ runs: [] as string[][], spawns: 0 }));

vi.mock("@tauri-apps/plugin-shell", () => ({
  Command: {
    sidecar: vi.fn(() => {
      const chunks = shell.runs.shift() ?? [];
      let onStdout: (data: string) => void = () => {};
      return {
        stdout: { on: (_event: string, cb: (data: string) => void) => (onStdout = cb) },
        stderr: { on: () => {} },
        on: () => {},
        spawn: async () => {
          shell.spawns += 1;
          queueMicrotask(() => chunks.forEach((chunk) => onStdout(chunk)));
          return { pid: 42 };
        },
      };
    }),
  },
}));

const realFetch = window.fetch;
const seenAuth = new Map<string, string | null>();

async function freshModules() {
  vi.resetModules();
  const sidecar = await import("./sidecar");
  const backendUrl = await import("../backendUrl");
  const auth = await import("../auth");
  return { ...sidecar, backendUrl, auth };
}

describe("desktop sidecar", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubEnv("VITE_DEV_BACKEND", "");
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    shell.runs = [];
    shell.spawns = 0;
    seenAuth.clear();
    // auth.ts wraps whatever fetch it finds; record the header it adds.
    window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      seenAuth.set(String(input), new Headers(init?.headers).get("Authorization"));
      return new Response("{}", { status: 200 });
    }) as typeof window.fetch;
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    axios.interceptors.request.clear();
    axios.interceptors.response.clear();
    window.fetch = realFetch;
  });

  it("parses TOKEN/PORT split across stdout chunks and wires the backend URL and token", async () => {
    shell.runs.push(["Backend star", "ting\r\nTOK", "EN: tok-abc\nPO", "RT: 5123", "\n"]);
    const { startSidecar, currentBackend, backendUrl, auth } = await freshModules();
    const found = vi.fn();
    window.addEventListener("backend-port-found", ((e: CustomEvent) => found(e.detail)) as EventListener);

    await expect(startSidecar()).resolves.toEqual({ url: "http://127.0.0.1:5123", token: "tok-abc" });
    expect(found).toHaveBeenCalledWith(5123);
    expect(backendUrl.API_URL).toBe("http://127.0.0.1:5123");
    expect(auth.getAuthToken()).toBe("tok-abc");
    expect(currentBackend()).toEqual({ url: "http://127.0.0.1:5123", token: "tok-abc" });

    await window.fetch("http://127.0.0.1:5123/history");
    await window.fetch("http://127.0.0.1:5124/history");
    expect(seenAuth.get("http://127.0.0.1:5123/history")).toBe("Bearer tok-abc");
    expect(seenAuth.get("http://127.0.0.1:5124/history")).toBeNull();

    const echoed = await axios.get("http://127.0.0.1:5123/jobs", {
      adapter: async (config) => ({ data: config.headers.Authorization, status: 200, statusText: "OK", headers: {}, config }),
    });
    expect(echoed.data).toBe("Bearer tok-abc");

    // The heartbeat goes to the same backend every 5 s.
    await vi.advanceTimersByTimeAsync(5000);
    expect(seenAuth.get("http://127.0.0.1:5123/heartbeat")).toBe("Bearer tok-abc");
  });

  it("rejects when the sidecar does not report a port within 90 s", async () => {
    shell.runs.push(["starting...\n"]);
    const { startSidecar } = await freshModules();
    const started = startSidecar();
    const outcome = expect(started).rejects.toThrow("did not start");
    await vi.advanceTimersByTimeAsync(89_999);
    await vi.advanceTimersByTimeAsync(1);
    await outcome;
  });

  it("respawns when the current backend fails its health check, and says so", async () => {
    shell.runs.push(["TOKEN: tok-1\nPORT: 5123\n"], ["TOKEN: tok-2\nPORT: 5200\n"]);
    const { startSidecar, resetAndRespawnBackend, backendUrl, auth } = await freshModules();
    await startSidecar();

    vi.spyOn(axios, "get").mockRejectedValue(new Error("gone"));
    const reconnected = vi.fn();
    window.addEventListener("backend-reconnected", ((e: CustomEvent) => reconnected(e.detail)) as EventListener);

    await expect(resetAndRespawnBackend()).resolves.toBe(5200);
    expect(shell.spawns).toBe(2);
    expect(reconnected).toHaveBeenCalledWith(5200);
    expect(backendUrl.API_URL).toBe("http://127.0.0.1:5200");
    expect(auth.getAuthToken()).toBe("tok-2");
  });

  it("re-points at a backend that is still healthy without spawning another one", async () => {
    shell.runs.push(["TOKEN: tok-1\nPORT: 5123\n"]);
    const { startSidecar, resetAndRespawnBackend } = await freshModules();
    await startSidecar();

    const health = vi.spyOn(axios, "get").mockResolvedValue({ data: { status: "ok" } });
    const reconnected = vi.fn();
    window.addEventListener("backend-reconnected", ((e: CustomEvent) => reconnected(e.detail)) as EventListener);

    await expect(resetAndRespawnBackend()).resolves.toBe(5123);
    expect(health).toHaveBeenCalledWith("http://127.0.0.1:5123/health", { timeout: 15000 });
    expect(shell.spawns).toBe(1);
    expect(reconnected).toHaveBeenCalledWith(5123);
  });
});
