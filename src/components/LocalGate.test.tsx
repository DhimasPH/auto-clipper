import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import axios from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App";
import { localErrorInfo } from "../lib/localErrors";
import { SPLASH_SEEN_KEY } from "../lib/splash";
import { CAPS, setPlatform, type Platform } from "../platform";
import { UNAUTHORIZED_EVENT, setAuthToken } from "../platform/auth";
import * as localToken from "../platform/local/token";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("LocalGate + update notice gate boundary (SP4 spec 4.5)", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }) as unknown as typeof window.matchMedia;
    window.sessionStorage.setItem(SPLASH_SEEN_KEY, "1");
    setAuthToken(null);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    setPlatform({
      kind: "local",
      caps: CAPS.local,
      secrets: { get: vi.fn().mockResolvedValue(null), set: vi.fn().mockResolvedValue(undefined) },
      backend: vi.fn().mockResolvedValue({ url: "http://127.0.0.1:8000", token: "" }),
      setPreventSleep: vi.fn().mockResolvedValue(undefined),
      askNotifyPermission: vi.fn(),
      notify: vi.fn(),
      updater: null,
    } as unknown as Platform);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    setPlatform(null);
    setAuthToken(null);
    window.sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("does not ask /api/update-check when LocalGate has no token (keeps LOCAL_TOKEN_MISSING intact)", async () => {
    vi.spyOn(localToken, "localEnv").mockReturnValue({ origin: "http://127.0.0.1:8000", dev: false, devBackend: false });
    const get = vi.spyOn(axios, "get").mockImplementation(async () => {
      window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
      throw Object.assign(new Error("401"), { response: { status: 401 } });
    });

    await act(async () => root.render(<App />));
    await act(async () => Promise.resolve());

    const updateCalls = get.mock.calls.filter(([url]) => String(url).includes("/api/update-check"));
    expect(updateCalls).toHaveLength(0);
    expect(container.textContent).toContain(localErrorInfo("LOCAL_TOKEN_MISSING").title);
    expect(container.textContent).not.toContain(localErrorInfo("LOCAL_TOKEN_EXPIRED").title);
  });

  it("only asks /api/update-check after LocalGate confirms the token", async () => {
    const get = vi.spyOn(axios, "get").mockResolvedValue({ data: { current: "1.19.0", latest: "1.19.0", update_available: false, download_url: null, release_url: null, checked_at: 1 } });

    await act(async () => root.render(<App />));
    await act(async () => Promise.resolve());

    const updateCalls = get.mock.calls.filter(([url]) => String(url).includes("/api/update-check"));
    expect(updateCalls).toHaveLength(1);
  });
});
