import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../i18n";
import { apiBrowseGDrive } from "../api";
import { GDriveBrowserModal } from "./GDriveBrowserModal";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("../api", () => ({ apiBrowseGDrive: vi.fn() }));

const ROOT = "/content/drive/MyDrive";
const VIDEOS = `${ROOT}/Video`;
const listing = (dir: string, parent: string | null, items: { name: string; is_dir: boolean }[]) => ({
  current_dir: dir,
  parent_dir: parent,
  items: items.map((i) => ({ ...i, path: `${dir}/${i.name}` })),
});

describe("GDriveBrowserModal (Colab, pick from Google Drive)", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    await i18n.changeLanguage("id");
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.resetAllMocks();
  });

  const render = (isOpen: boolean, onSelectFile = vi.fn()) =>
    act(async () => root.render(<GDriveBrowserModal isOpen={isOpen} onClose={vi.fn()} onSelectFile={onSelectFile} />));
  const button = (text: string) =>
    [...document.querySelectorAll("button")].find((b) => b.textContent?.includes(text)) as HTMLButtonElement | undefined;

  it("opens again in the folder the user was in last time", async () => {
    vi.mocked(apiBrowseGDrive)
      .mockResolvedValueOnce(listing(ROOT, null, [{ name: "Video", is_dir: true }]))
      .mockResolvedValueOnce(listing(VIDEOS, ROOT, [{ name: "podcast.mp4", is_dir: false }]))
      .mockResolvedValueOnce(listing(VIDEOS, ROOT, [{ name: "podcast.mp4", is_dir: false }]));
    await render(true);
    expect(apiBrowseGDrive).toHaveBeenLastCalledWith("");
    await act(async () => button("Video")!.click());
    expect(apiBrowseGDrive).toHaveBeenLastCalledWith(VIDEOS);

    await render(false);
    await render(true);
    expect(apiBrowseGDrive).toHaveBeenCalledTimes(3);
    expect(apiBrowseGDrive).toHaveBeenLastCalledWith(VIDEOS);
    expect(button("podcast.mp4")).toBeTruthy();
  });

  it("Coba lagi retries the folder that failed, not the one shown before it", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(apiBrowseGDrive)
      .mockResolvedValueOnce(listing(ROOT, null, [{ name: "Video", is_dir: true }]))
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValueOnce(listing(VIDEOS, ROOT, [{ name: "podcast.mp4", is_dir: false }]));
    await render(true);
    await act(async () => button("Video")!.click());
    expect(document.querySelector('[role="alert"]')?.textContent).toContain(i18n.t("drive.load_failed"));

    await act(async () => button(i18n.t("drive.retry"))!.click());
    expect(apiBrowseGDrive).toHaveBeenCalledTimes(3);
    expect(apiBrowseGDrive).toHaveBeenLastCalledWith(VIDEOS);
    expect(button("podcast.mp4")).toBeTruthy();
  });

  it("falls back to the Drive root when the last folder is gone", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(apiBrowseGDrive)
      .mockResolvedValueOnce(listing(ROOT, null, [{ name: "Video", is_dir: true }]))
      .mockResolvedValueOnce(listing(VIDEOS, ROOT, []))
      .mockRejectedValueOnce(new Error("not found"))
      .mockResolvedValueOnce(listing(ROOT, null, [{ name: "Lain", is_dir: true }]));
    await render(true);
    await act(async () => button("Video")!.click());
    await render(false);
    await render(true);
    expect(vi.mocked(apiBrowseGDrive).mock.calls.map((c) => c[0])).toEqual(["", VIDEOS, VIDEOS, ""]);
    expect(button("Lain")).toBeTruthy();
    expect(document.querySelector('[role="alert"]')).toBeNull();
  });

  it("picks a video file", async () => {
    vi.mocked(apiBrowseGDrive).mockResolvedValueOnce(listing(VIDEOS, ROOT, [{ name: "podcast.mp4", is_dir: false }]));
    const onSelectFile = vi.fn();
    await render(true, onSelectFile);
    await act(async () => button("podcast.mp4")!.click());
    expect(onSelectFile).toHaveBeenCalledWith(`${VIDEOS}/podcast.mp4`);
  });
});
