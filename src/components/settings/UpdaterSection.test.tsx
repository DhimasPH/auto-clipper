import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../../i18n";
import { CAPS, setPlatform, type Platform, type UpdateHandle } from "../../platform";
import { UpdaterSection } from "./UpdaterSection";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("UpdaterSection (Bantuan, desktop)", () => {
  let container: HTMLDivElement;
  let root: Root;
  const check = vi.fn();
  const relaunch = vi.fn(async () => {});

  beforeEach(async () => {
    await i18n.changeLanguage("id");
    setPlatform({ caps: CAPS.desktop, updater: { check, relaunch } } as unknown as Platform);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root.render(<UpdaterSection />));
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    setPlatform(null);
    vi.useRealTimers();
    vi.resetAllMocks();
  });

  const button = (text: string) =>
    [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === text) as HTMLButtonElement | undefined;
  const pressCheck = () => act(async () => button(i18n.t("updater.check_button"))!.click());

  it("says the app is up to date when there is nothing new", async () => {
    check.mockResolvedValueOnce(null);
    await pressCheck();
    expect(check).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[role="status"]')?.textContent).toBe(i18n.t("updater.up_to_date"));
  });

  it("explains a failed check and keeps the raw reason under Detail teknis", async () => {
    check.mockRejectedValueOnce(new Error("network unreachable"));
    await pressCheck();
    const alert = container.querySelector('[role="alert"]')!;
    expect(alert.textContent).toContain(i18n.t("updater.check_failed"));
    expect(alert.querySelector("details")!.textContent).toContain("network unreachable");
  });

  it("asks first, installs with progress, says so and restarts the app", async () => {
    vi.useFakeTimers();
    const downloadAndInstall = vi.fn(async (onEvent: (e: { event: string; data?: Record<string, number> }) => void) => {
      onEvent({ event: "Started", data: { contentLength: 100 } });
      onEvent({ event: "Progress", data: { chunkLength: 40 } });
      onEvent({ event: "Finished" });
    });
    check.mockResolvedValueOnce({ version: "2.1.0", body: "", downloadAndInstall } as unknown as UpdateHandle);
    await pressCheck();

    const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!;
    expect(dialog.textContent).toContain("2.1.0");
    expect(downloadAndInstall).not.toHaveBeenCalled();

    await act(async () => button(i18n.t("updater.install_now"))!.click());
    expect(downloadAndInstall).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[role="status"]')?.textContent).toBe(i18n.t("updater.install_success"));
    expect(relaunch).not.toHaveBeenCalled();

    await act(async () => vi.advanceTimersByTime(1500));
    expect(relaunch).toHaveBeenCalledTimes(1);
  });

  it("Nanti closes the question without installing", async () => {
    const downloadAndInstall = vi.fn();
    check.mockResolvedValueOnce({ version: "2.1.0", downloadAndInstall } as unknown as UpdateHandle);
    await pressCheck();
    await act(async () => button(i18n.t("updater.later"))!.click());
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(downloadAndInstall).not.toHaveBeenCalled();
  });

  it("keeps the old version usable when installing fails and does not restart", async () => {
    const downloadAndInstall = vi.fn(async () => {
      throw new Error("signature mismatch");
    });
    check.mockResolvedValueOnce({ version: "2.1.0", downloadAndInstall } as unknown as UpdateHandle);
    await pressCheck();
    await act(async () => button(i18n.t("updater.install_now"))!.click());

    const alert = container.querySelector('[role="alert"]')!;
    expect(alert.textContent).toContain(i18n.t("updater.install_failed"));
    expect(alert.querySelector("details")!.textContent).toContain("signature mismatch");
    expect(relaunch).not.toHaveBeenCalled();
  });
});
