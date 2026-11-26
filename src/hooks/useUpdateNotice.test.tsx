import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import axios from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import pkg from "../../package.json";
import { useUpdateNotice, type UpdateNotice } from "./useUpdateNotice";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ZIP = "https://github.com/DhimasPH/auto-clipper/releases/download/app-v1.20.0/Auto-Clipper-Web-linux.zip";
const OK = { current: pkg.version, latest: "1.20.0", update_available: true, download_url: ZIP, release_url: null, checked_at: 1 };

let latest: UpdateNotice;
function Probe({ enabled }: { enabled: boolean }) {
  const value = useUpdateNotice(enabled);
  useEffect(() => {
    latest = value;
  });
  return null;
}

describe("useUpdateNotice", () => {
  let root: Root;

  beforeEach(() => {
    root = createRoot(document.createElement("div"));
  });

  afterEach(() => {
    act(() => root.unmount());
    vi.restoreAllMocks();
  });

  it("checks once when the app opens, with the app version, and again with force on request", async () => {
    const get = vi.spyOn(axios, "get").mockResolvedValue({ data: OK });
    await act(async () => root.render(<Probe enabled />));
    expect(get).toHaveBeenCalledTimes(1);
    expect(String(get.mock.calls[0][0])).toMatch(/\/api\/update-check$/);
    expect(get.mock.calls[0][1]).toEqual(expect.objectContaining({ params: { current: pkg.version, force: 0 } }));
    expect([latest.view, latest.latest, latest.link]).toEqual(["available", "1.20.0", ZIP]);

    await act(async () => root.render(<Probe enabled />));
    expect(get).toHaveBeenCalledTimes(1);

    await act(async () => latest.recheck());
    expect(get).toHaveBeenCalledTimes(2);
    expect(get.mock.calls[1][1]).toEqual(expect.objectContaining({ params: { current: pkg.version, force: 1 } }));
  });

  it("says it could not check when the request fails", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(axios, "get").mockRejectedValue(new Error("offline"));
    await act(async () => root.render(<Probe enabled />));
    expect(latest.view).toBe("failed");
    expect(latest.link).toBeNull();
  });

  it("asks nothing while disabled", async () => {
    const get = vi.spyOn(axios, "get");
    await act(async () => root.render(<Probe enabled={false} />));
    expect(get).not.toHaveBeenCalled();
  });
});
