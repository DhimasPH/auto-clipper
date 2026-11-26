import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import axios from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SPLASH_SEEN_KEY } from "../lib/splash";
import { useWebSplash } from "./useWebSplash";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let showing = false;
function Probe({ enabled, ready }: { enabled: boolean; ready: boolean }) {
  const value = useWebSplash(enabled, ready);
  useEffect(() => {
    showing = value;
  });
  return null;
}

describe("useWebSplash", () => {
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    window.sessionStorage.clear();
    root = createRoot(document.createElement("div"));
  });

  afterEach(() => {
    act(() => root.unmount());
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("closes 0.8 s after start when the connection check answers quickly", async () => {
    const get = vi.spyOn(axios, "get").mockResolvedValue({ data: { status: "ok" } });
    await act(async () => root.render(<Probe enabled ready />));
    expect(String(get.mock.calls[0][0])).toMatch(/\/health$/);
    expect(showing).toBe(true);
    await act(async () => vi.advanceTimersByTime(799));
    expect(showing).toBe(true);
    await act(async () => vi.advanceTimersByTime(1));
    expect(showing).toBe(false);
    expect(window.sessionStorage.getItem(SPLASH_SEEN_KEY)).toBe("1");
  });

  it("closes after a failed check too", async () => {
    vi.spyOn(axios, "get").mockRejectedValue(new Error("offline"));
    await act(async () => root.render(<Probe enabled ready />));
    await act(async () => vi.advanceTimersByTime(800));
    expect(showing).toBe(false);
  });

  it("gives up waiting after 2.5 s", async () => {
    vi.spyOn(axios, "get").mockReturnValue(new Promise(() => {}));
    await act(async () => root.render(<Probe enabled ready />));
    await act(async () => vi.advanceTimersByTime(2499));
    expect(showing).toBe(true);
    await act(async () => vi.advanceTimersByTime(1));
    expect(showing).toBe(false);
  });

  it("waits for saved settings before checking, and still stops at 2.5 s", async () => {
    const get = vi.spyOn(axios, "get").mockResolvedValue({ data: {} });
    await act(async () => root.render(<Probe enabled ready={false} />));
    expect(get).not.toHaveBeenCalled();
    await act(async () => vi.advanceTimersByTime(2500));
    expect(showing).toBe(false);
  });

  it("does not show again in the same tab", async () => {
    const get = vi.spyOn(axios, "get").mockResolvedValue({ data: {} });
    window.sessionStorage.setItem(SPLASH_SEEN_KEY, "1");
    await act(async () => root.render(<Probe enabled ready />));
    expect(showing).toBe(false);
    expect(get).not.toHaveBeenCalled();
  });

  it("never shows where the platform keeps the startup splash (desktop)", async () => {
    const get = vi.spyOn(axios, "get").mockResolvedValue({ data: {} });
    await act(async () => root.render(<Probe enabled={false} ready />));
    expect(showing).toBe(false);
    expect(get).not.toHaveBeenCalled();
  });
});
