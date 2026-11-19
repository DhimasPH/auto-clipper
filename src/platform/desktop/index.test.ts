import axios from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";

// No Tauri runtime in Vitest: the plugins are mocked, the adapter's own logic is what is checked.
const shellOpen = vi.fn(async (_target: string) => {});
const saveDialog = vi.fn(async (_opts: unknown): Promise<string | null> => null);
const invoke = vi.fn(async (_cmd: string) => {});
const requestPermission = vi.fn(async () => "granted");

vi.mock("@tauri-apps/plugin-shell", () => ({ open: shellOpen, Command: { sidecar: vi.fn() } }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn(async () => null), save: saveDialog }));
vi.mock("@tauri-apps/api/core", () => ({ invoke }));
vi.mock("@tauri-apps/plugin-notification", () => ({
  isPermissionGranted: vi.fn(async () => false),
  requestPermission,
  sendNotification: vi.fn(),
}));
vi.mock("@tauri-apps/plugin-process", () => ({ relaunch: vi.fn() }));
vi.mock("@tauri-apps/plugin-updater", () => ({ check: vi.fn(async () => null) }));
vi.mock("@tauri-apps/plugin-stronghold", () => ({ Stronghold: { load: vi.fn() } }));

const { setApiUrl } = await import("../backendUrl");
const { CAPS } = await import("../caps");
const { createPlatform } = await import("./index");

describe("desktop adapter", () => {
  afterEach(() => vi.restoreAllMocks());

  it("has the desktop caps and asks for OS notification permission at startup, as before SP1", async () => {
    const p = createPlatform();
    expect(p.kind).toBe("desktop");
    expect(p.caps).toEqual(CAPS.desktop);
    expect(p.updater).not.toBeNull();
    await vi.waitFor(() => expect(requestPermission).toHaveBeenCalled());
  });

  it("opens the folder through the backend, never with an empty path", async () => {
    setApiUrl("http://127.0.0.1:5123");
    const post = vi.spyOn(axios, "post").mockResolvedValue({ data: {} });
    const p = createPlatform();
    await p.openFolder("C:\\clips\\clip_1.mp4");
    await p.openFolder("/clip_2.mp4");
    expect(post.mock.calls).toEqual([
      ["http://127.0.0.1:5123/open_folder", { path: "C:\\clips" }],
      ["http://127.0.0.1:5123/open_folder", { path: "/clip_2.mp4" }],
    ]);
  });

  it("falls back to the shell when the backend cannot open the folder", async () => {
    vi.spyOn(axios, "post").mockRejectedValue(new Error("down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    shellOpen.mockClear();
    await createPlatform().openFolder("C:\\clips\\clip_1.mp4");
    expect(shellOpen).toHaveBeenCalledWith("C:\\clips");
  });

  it("saves a clip by copying it on the backend to the place the user chose", async () => {
    setApiUrl("http://127.0.0.1:5123");
    const post = vi.spyOn(axios, "post").mockResolvedValue({ data: {} });
    saveDialog.mockResolvedValueOnce("D:\\out\\clip_1.mp4").mockResolvedValueOnce(null);
    const p = createPlatform();
    await p.saveClip({ path: "C:\\app\\clip_1.mp4", filename: "clip_1.mp4" });
    await p.saveClip({ path: "C:\\app\\clip_1.mp4", filename: "clip_1.mp4" }); // cancelled
    expect(post.mock.calls).toEqual([
      ["http://127.0.0.1:5123/save_file", { src: "C:\\app\\clip_1.mp4", dest: "D:\\out\\clip_1.mp4" }],
    ]);
  });

  it("keeps the computer awake through the Tauri commands", async () => {
    const p = createPlatform();
    await p.setPreventSleep(true);
    await p.setPreventSleep(false);
    expect(invoke.mock.calls).toEqual([["prevent_sleep"], ["allow_sleep"]]);
  });
});
