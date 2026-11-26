import { describe, expect, it, vi } from "vitest";
import { CAPS } from "../platform/caps";
import { actionLabels, errorActionHandlers } from "./errorActions";
import { asErrorInfo, visibleActions } from "./errorInfo";

function deps() {
  return {
    resume: vi.fn(),
    rerun: vi.fn(),
    openCookies: vi.fn(),
    uploadVideo: vi.fn(),
    openDriveBrowser: vi.fn(),
    openSettings: vi.fn(),
  };
}

const INFO = asErrorInfo({
  code: "UPLOAD_MISSING",
  title: "File video yang diunggah sudah tidak ada",
  message: "Unggah videonya lagi.",
  title_en: "The uploaded video is gone",
  message_en: "Upload the video again.",
  actions: [
    { id: "upload_video", label: "Unggah file video", label_en: "Upload a video file" },
    { id: "open_settings", label: "Buka Pengaturan", label_en: "Open Settings" },
    { id: "upload_cookies", label: "Unggah cookies.txt", label_en: "Upload cookies.txt" },
  ],
  technical: "",
})!;

const t = (key: string, fallback: string) => (key === "action.pick_from_drive" ? "Pilih video dari Google Drive" : fallback);

describe("errorActionHandlers", () => {
  it.each(["desktop", "local"] as const)("%s: upload_video picks a file, open_settings opens Settings", (kind) => {
    const d = deps();
    const handlers = errorActionHandlers(CAPS[kind], d);
    handlers.upload_video!();
    handlers.open_settings!();
    expect(d.uploadVideo).toHaveBeenCalledOnce();
    expect(d.openDriveBrowser).not.toHaveBeenCalled();
    expect(d.openSettings).toHaveBeenCalledOnce();
  });

  it("cloud: upload_video opens the Drive browser and open_settings has no button", () => {
    const d = deps();
    const handlers = errorActionHandlers(CAPS.cloud, d);
    handlers.upload_video!();
    expect(d.openDriveBrowser).toHaveBeenCalledOnce();
    expect(d.uploadVideo).not.toHaveBeenCalled();
    expect(handlers.open_settings).toBeUndefined();
    const ids = visibleActions(INFO, handlers, "id", actionLabels(CAPS.cloud, t)).map((a) => [a.id, a.label]);
    expect(ids).toEqual([
      ["upload_video", "Pilih video dari Google Drive"],
      ["upload_cookies", "Unggah cookies.txt"],
    ]);
  });

  it("upload_cookies hands the rerun step to the cookies dialog; retry and resume run the job again", () => {
    const d = deps();
    const handlers = errorActionHandlers(CAPS.desktop, d);
    handlers.upload_cookies!();
    expect(d.openCookies).toHaveBeenCalledWith(d.rerun);
    expect(handlers.retry).toBe(d.rerun);
    expect(handlers.resume).toBe(d.resume);
  });

  it("keeps the backend labels outside cloud", () => {
    expect(actionLabels(CAPS.desktop, t)).toEqual({});
    expect(actionLabels(CAPS.local, t)).toEqual({});
  });

  it("new_project starts over on every platform (RERUN_SOURCE_MISSING)", () => {
    for (const kind of ["desktop", "local", "cloud"] as const) {
      const newProject = vi.fn();
      const handlers = errorActionHandlers(CAPS[kind], { ...deps(), newProject });
      handlers.new_project!();
      expect(newProject).toHaveBeenCalledTimes(1);
    }
  });
});
