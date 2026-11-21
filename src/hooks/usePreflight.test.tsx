import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import axios from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePreflight } from "./usePreflight";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let latest: ReturnType<typeof usePreflight>;
function Probe({ connected }: { connected: boolean }) {
  const value = usePreflight(connected);
  useEffect(() => {
    latest = value;
  });
  return null;
}

describe("usePreflight", () => {
  let root: Root;

  beforeEach(() => {
    root = createRoot(document.createElement("div"));
  });

  afterEach(() => {
    act(() => root.unmount());
    vi.restoreAllMocks();
  });

  it("checks on open, again when the connection comes back, and on request", async () => {
    const get = vi.spyOn(axios, "get").mockResolvedValue({ data: { checks: [{ id: "gpu", level: "warn", title: "t", message: "m" }] } });
    await act(async () => root.render(<Probe connected />));
    expect(get).toHaveBeenCalledTimes(1);
    expect(String(get.mock.calls[0][0])).toMatch(/\/api\/preflight$/);
    expect(latest.state).toBe("ready");
    expect(latest.notes).toHaveLength(1);

    await act(async () => root.render(<Probe connected={false} />));
    await act(async () => root.render(<Probe connected />));
    expect(get).toHaveBeenCalledTimes(2);

    await act(async () => latest.recheck());
    expect(get).toHaveBeenCalledTimes(3);
  });

  it("does not block the start when the check itself cannot run", async () => {
    // Ruling P15: suppress expected error log noise in error-path unit test.
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(axios, "get").mockRejectedValue(new Error("offline"));
    await act(async () => root.render(<Probe connected />));
    expect(latest.state).toBe("unavailable");
    expect(latest.blockers).toEqual([]);
    expect(consoleError).toHaveBeenCalled();
  });
});
