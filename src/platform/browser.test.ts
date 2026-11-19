import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// P19: never ask for notification permission on page load; ask once, from the user's first job start.
describe("browser notifications", () => {
  let requestPermission: ReturnType<typeof vi.fn>;
  let shown: { title: string; body?: string }[];

  function installNotification(permission: NotificationPermission) {
    shown = [];
    requestPermission = vi.fn(async () => "granted" as NotificationPermission);
    class FakeNotification {
      static permission = permission;
      static requestPermission = requestPermission;
      constructor(title: string, options?: NotificationOptions) {
        shown.push({ title, body: options?.body });
      }
    }
    vi.stubGlobal("Notification", FakeNotification);
  }

  beforeEach(() => vi.resetModules());
  afterEach(() => vi.unstubAllGlobals());

  it("does not ask for permission when the module loads or when a toast is shown", async () => {
    installNotification("default");
    const { browserNotify } = await import("./browser");
    browserNotify("Auto Clipper", "Selesai");
    expect(requestPermission).not.toHaveBeenCalled();
    expect(shown).toEqual([]);
  });

  it("asks once, only while the user has not decided yet", async () => {
    installNotification("default");
    const { askBrowserNotifyPermission } = await import("./browser");
    askBrowserNotifyPermission();
    askBrowserNotifyPermission();
    expect(requestPermission).toHaveBeenCalledTimes(1);
  });

  it("does not ask again after the user allowed or blocked notifications", async () => {
    for (const decided of ["granted", "denied"] as NotificationPermission[]) {
      vi.resetModules();
      installNotification(decided);
      const { askBrowserNotifyPermission } = await import("./browser");
      askBrowserNotifyPermission();
      expect(requestPermission).not.toHaveBeenCalled();
    }
  });

  it("shows a notification only when allowed", async () => {
    installNotification("granted");
    const { browserNotify } = await import("./browser");
    browserNotify("Auto Clipper", "Klip siap");
    expect(shown).toEqual([{ title: "Auto Clipper", body: "Klip siap" }]);
  });
});

describe("browserDownload", () => {
  it("clicks a download link with the clip's file name", async () => {
    const { browserDownload } = await import("./browser");
    const clicked: { href: string; download: string }[] = [];
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push({ href: this.href, download: this.download });
    });
    await browserDownload({ path: "C:\\a\\clip_1.mp4", filename: "clip_1.mp4", videoUrl: "http://127.0.0.1:8000/video?p=x" });
    expect(clicked).toEqual([{ href: "http://127.0.0.1:8000/video?p=x", download: "clip_1.mp4" }]);
    await expect(browserDownload({ path: "x", filename: "x.mp4" })).rejects.toThrow();
    click.mockRestore();
  });
});
