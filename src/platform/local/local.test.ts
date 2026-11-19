import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// No real network in tests: the backend is "gone" whenever reconnect() checks it.
vi.mock("../browser", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../browser")>()),
  checkBackend: vi.fn(async () => false),
}));

import { getAuthToken } from "../auth";
import { API_URL } from "../backendUrl";
import { createPlatform } from "./index";
import {
  BACKEND_LOST_EVENT,
  gateStateAfterCheck,
  initialGateState,
  LOCAL_TOKEN_KEY,
  resolveLocalBackend,
  takeLocalToken,
} from "./token";

const BUILT = { origin: "http://127.0.0.1:5123", dev: false, devBackend: false };

function openAt(hash: string) {
  window.history.replaceState(null, "", `/${hash}`);
}

describe("takeLocalToken", () => {
  beforeEach(() => {
    sessionStorage.clear();
    openAt("");
  });

  it("reads #t= from the address, keeps it for this tab and removes it from the address", () => {
    openAt("#t=tok-123");

    expect(takeLocalToken()).toBe("tok-123");
    expect(sessionStorage.getItem(LOCAL_TOKEN_KEY)).toBe("tok-123");
    expect(window.location.hash).toBe("#/");
    expect(window.location.href).not.toContain("tok-123");
  });

  it("uses the token kept for this tab after a reload and leaves app routes alone", () => {
    sessionStorage.setItem(LOCAL_TOKEN_KEY, "tok-kept");
    openAt("#/history");

    expect(takeLocalToken()).toBe("tok-kept");
    expect(window.location.hash).toBe("#/history");
  });

  it("has no token in a tab opened by hand", () => {
    expect(takeLocalToken()).toBeNull();
  });
});

describe("resolveLocalBackend", () => {
  it("uses the page origin and the launch token in the built app", () => {
    expect(resolveLocalBackend(BUILT, "tok")).toEqual({ url: "http://127.0.0.1:5123", token: "tok" });
  });

  it("uses the backend started by hand under npm run dev", () => {
    expect(resolveLocalBackend({ ...BUILT, dev: true }, null)).toEqual({ url: "http://127.0.0.1:8000", token: "" });
    expect(resolveLocalBackend({ ...BUILT, dev: true, devBackend: true }, null)).toEqual({
      url: "http://127.0.0.1:8000",
      token: "dev-token",
    });
  });
});

describe("LocalGate decisions", () => {
  it("sends the user back to the launcher when the built app has no token", () => {
    expect(initialGateState(BUILT, "")).toBe("no_token");
    expect(initialGateState(BUILT, "tok")).toBe("checking");
    expect(initialGateState({ ...BUILT, dev: true }, "")).toBe("checking");
  });

  it("reads the answer to the token check", () => {
    expect(gateStateAfterCheck(200)).toBe("ok");
    expect(gateStateAfterCheck(500)).toBe("ok"); // the server is there and took the token
    expect(gateStateAfterCheck(401)).toBe("token_expired");
    expect(gateStateAfterCheck(null)).toBe("server_closed");
  });
});

describe("local platform", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.stubEnv("DEV", false);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("talks to the page origin with the token from the address", async () => {
    openAt("#t=tok-launch");

    const p = createPlatform();

    expect(await p.backend()).toEqual({ url: window.location.origin, token: "tok-launch" });
    expect(API_URL).toBe(window.location.origin);
    expect(getAuthToken()).toBe("tok-launch");
    expect(window.location.hash).toBe("#/");
    expect(p.kind).toBe("local");
    expect(p.caps.openFolder).toBe(true);
    expect(p.updater).toBeNull();
  });

  it("reports a closed server so LocalGate can say so", async () => {
    openAt("#t=tok-launch");
    const lost = vi.fn();
    window.addEventListener(BACKEND_LOST_EVENT, lost, { once: true });

    expect(await createPlatform().reconnect()).toBeNull();
    expect(lost).toHaveBeenCalledOnce();
  });
});
