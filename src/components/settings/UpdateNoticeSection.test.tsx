import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../../i18n";
import type { UpdateNotice } from "../../hooks/useUpdateNotice";
import { CAPS, setPlatform, type Platform } from "../../platform";
import { UpdateNoticeSection } from "./UpdateNoticeSection";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ZIP = "https://github.com/DhimasPH/auto-clipper/releases/download/app-v1.20.0/Auto-Clipper-Web-windows.zip";

describe("UpdateNoticeSection (SP4 spec 4.5)", () => {
  let container: HTMLDivElement;
  let root: Root;
  let openExternal: ReturnType<typeof vi.fn>;

  const notice = (over: Partial<UpdateNotice> = {}): UpdateNotice => ({
    view: "available", latest: "1.20.0", link: ZIP, recheck: vi.fn().mockResolvedValue(undefined), ...over,
  });
  const button = (key: string) => [...container.querySelectorAll("button")].find((b) => b.textContent?.includes(i18n.t(key)));

  beforeEach(async () => {
    await i18n.changeLanguage("id");
    openExternal = vi.fn().mockResolvedValue(undefined);
    setPlatform({ caps: CAPS.local, openExternal } as unknown as Platform);
    container = document.createElement("div");
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    setPlatform(null);
  });

  it("available: names the version, Unduh opens the zip, three steps, data stays", async () => {
    act(() => root.render(<UpdateNoticeSection notice={notice()} />));
    expect(container.textContent).toContain(i18n.t("update_notice.available", { version: "1.20.0" }));
    expect(container.querySelectorAll("ol li")).toHaveLength(3);
    expect(container.textContent).toContain(i18n.t("update_notice.keeps_data"));
    await act(async () => button("update_notice.download")!.click());
    expect(openExternal).toHaveBeenCalledWith(ZIP);
  });

  it("latest: says so and can check again", async () => {
    const recheck = vi.fn().mockResolvedValue(undefined);
    act(() => root.render(<UpdateNoticeSection notice={notice({ view: "latest", recheck })} />));
    expect(container.textContent).toContain(i18n.t("update_notice.latest"));
    await act(async () => button("update_notice.check")!.click());
    expect(recheck).toHaveBeenCalledTimes(1);
  });

  it("failed: a quiet line and Coba lagi, never an error card", async () => {
    const recheck = vi.fn().mockResolvedValue(undefined);
    act(() => root.render(<UpdateNoticeSection notice={notice({ view: "failed", link: null, recheck })} />));
    expect(container.textContent).toContain(i18n.t("update_notice.failed"));
    expect(container.querySelector('[role="alert"]')).toBeNull();
    await act(async () => button("update_notice.retry")!.click());
    expect(recheck).toHaveBeenCalledTimes(1);
  });

  it("checking: says it is checking and offers no button", () => {
    act(() => root.render(<UpdateNoticeSection notice={notice({ view: "checking" })} />));
    expect(container.textContent).toContain(i18n.t("update_notice.checking"));
    expect(container.querySelectorAll("button")).toHaveLength(0);
  });
});
