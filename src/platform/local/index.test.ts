import axios from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getAuthToken, setAuthToken } from "../auth";
import { setApiUrl } from "../backendUrl";
import { CAPS } from "../caps";
import { createPlatform } from "./index";

describe("local adapter (Task 3 baseline)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    setAuthToken(null);
  });

  it("has the local caps and no updater", () => {
    const p = createPlatform();
    expect(p.kind).toBe("local");
    expect(p.caps).toEqual(CAPS.local);
    expect(p.updater).toBeNull();
  });

  it("uses the dev token only with VITE_DEV_BACKEND=true", async () => {
    setApiUrl("http://127.0.0.1:8000");
    vi.stubEnv("VITE_DEV_BACKEND", "true");
    expect(await createPlatform().backend()).toEqual({ url: "http://127.0.0.1:8000", token: "dev-token" });
    expect(getAuthToken()).toBe("dev-token");

    vi.stubEnv("VITE_DEV_BACKEND", "");
    expect(await createPlatform().backend()).toEqual({ url: "http://127.0.0.1:8000", token: "" });
    expect(getAuthToken()).toBeNull();
  });

  it("asks the backend to open the clip's folder, never with an empty path", async () => {
    setApiUrl("http://127.0.0.1:8000");
    const post = vi.spyOn(axios, "post").mockResolvedValue({ data: {} });
    const p = createPlatform();
    await p.openFolder("C:\\clips\\clip_1.mp4");
    await p.openFolder("clip_2.mp4");
    expect(post.mock.calls).toEqual([
      ["http://127.0.0.1:8000/open_folder", { path: "C:\\clips" }],
      ["http://127.0.0.1:8000/open_folder", { path: "clip_2.mp4" }],
    ]);
  });
});
