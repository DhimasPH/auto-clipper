import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import axios from "axios";
import i18n from "../i18n";
import { AppContext } from "../App";
import { CAPS, setPlatform, type Platform } from "../platform";
import { ProjectPage } from "./ProjectPage";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("axios", () => ({ default: { get: vi.fn(), delete: vi.fn() } }));
vi.mock("../components/ClipsResult", () => ({
  default: ({ clips, jobId }: { clips: unknown[]; jobId: string }) => (
    <p data-testid="clips">{`${jobId}:${clips.length}`}</p>
  ),
}));

function Where() {
  const { pathname } = useLocation();
  return <p data-testid="where">{pathname}</p>;
}

const makeCtx = (overrides: Record<string, unknown> = {}) =>
  ({
    historyVersion: 0,
    handleRerender: vi.fn(),
    handleRerunAI: vi.fn(),
    handleResumeJob: vi.fn(),
    handleRerenderClip: vi.fn(),
    openAwaiting: vi.fn(),
    openCookies: vi.fn(),
    requestLocalUpload: vi.fn(),
    requestDriveBrowser: vi.fn(),
    ...overrides,
  }) as unknown as React.ContextType<typeof AppContext>;

const buttonWith = (container: HTMLElement, text: string) =>
  [...container.querySelectorAll("button")].filter((b) => b.textContent?.includes(text));

describe("ProjectPage (spec 4.5)", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    await i18n.changeLanguage("id");
    setPlatform({ caps: CAPS.cloud } as unknown as Platform);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    setPlatform(null);
    vi.resetAllMocks();
  });

  const renderPage = async (ctx: React.ContextType<typeof AppContext>, id = "j1") => {
    await act(async () => {
      root.render(
        <AppContext.Provider value={ctx}>
          <MemoryRouter initialEntries={[`/riwayat/${id}`]}>
            <Routes>
              <Route path="/riwayat/:id" element={<ProjectPage />} />
              <Route path="/riwayat" element={<Where />} />
              <Route path="/" element={<Where />} />
            </Routes>
          </MemoryRouter>
        </AppContext.Provider>,
      );
    });
  };

  it("shows a finished project's name, status, clips and a way back", async () => {
    vi.mocked(axios.get).mockResolvedValueOnce({
      data: {
        id: "j1",
        status: "DONE",
        clips: [{ path: "a.mp4" }, { path: "b.mp4" }],
        failed: 0,
        metadata: { title: "Podcast Pagi" },
      },
    });
    await renderPage(makeCtx());

    expect(vi.mocked(axios.get).mock.calls[0][0]).toMatch(/\/jobs\/j1$/);
    expect(container.querySelector("h1")?.textContent).toBe("Podcast Pagi");
    expect(container.textContent).toContain(i18n.t("projects.status_done"));
    expect(container.textContent).toContain(i18n.t("projects.clip_count", { count: 2 }));
    expect(container.querySelector('[data-testid="clips"]')?.textContent).toBe("j1:2");
    expect(container.querySelector('a[href="/riwayat"]')?.textContent).toContain(i18n.t("projects.back"));
  });

  it("shows the error card of a failed project and Lanjutkan when the card has none", async () => {
    const handleResumeJob = vi.fn();
    vi.mocked(axios.get).mockResolvedValueOnce({
      data: {
        id: "j1",
        status: "ERROR",
        clips: [],
        error: "download failed",
        error_info: {
          code: "DOWNLOAD_FAILED",
          title: "Video belum bisa diunduh",
          message: "Cek link video lalu coba lagi.",
          actions: [],
        },
        metadata: { title: "Video Gagal", url: "https://youtu.be/x" },
      },
    });
    await renderPage(makeCtx({ handleResumeJob }));

    expect(container.textContent).toContain(i18n.t("projects.status_failed"));
    expect(container.textContent).toContain("Video belum bisa diunduh");
    act(() => buttonWith(container, i18n.t("projects.action_resume"))[0].click());
    expect(handleResumeJob).toHaveBeenCalledWith("j1", "history");
  });

  it("brings a waiting project back to step 3", async () => {
    const openAwaiting = vi.fn();
    const job = { id: "j1", status: "AWAITING_MANUAL", clips: [], metadata: { title: "Tutorial", manual_prompt: "P" } };
    vi.mocked(axios.get).mockResolvedValueOnce({ data: job });
    await renderPage(makeCtx({ openAwaiting }));

    act(() => buttonWith(container, i18n.t("projects.action_paste_answer"))[0].click());
    expect(openAwaiting).toHaveBeenCalledWith(job);
    expect(container.querySelector('[data-testid="where"]')?.textContent).toBe("/");
  });

  it("goes back to Riwayat after deleting the project", async () => {
    vi.mocked(axios.get).mockResolvedValueOnce({
      data: { id: "j1", status: "DONE", clips: [{ path: "a.mp4" }], metadata: { title: "Podcast" } },
    });
    vi.mocked(axios.delete).mockResolvedValueOnce({ data: { status: "success" } });
    await renderPage(makeCtx());

    act(() => container.querySelector<HTMLButtonElement>('button[aria-haspopup="menu"]')!.click());
    act(() => buttonWith(container, i18n.t("projects.menu_delete"))[0].click());
    const dialog = document.querySelector('[role="dialog"]') as HTMLElement;
    await act(async () => buttonWith(dialog, i18n.t("projects.delete_confirm"))[0].click());
    // The clip players leave the page before the files are deleted.
    expect(container.querySelector('[data-testid="clips"]')).toBeNull();
    await act(() => new Promise((resolve) => setTimeout(resolve, 100)));

    expect(vi.mocked(axios.delete).mock.calls[0][0]).toMatch(/\/history\/j1$/);
    expect(container.querySelector('[data-testid="where"]')?.textContent).toBe("/riwayat");
  });

  it("stays on the project and says what to do when deleting fails, then retries", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(axios.get).mockResolvedValueOnce({
      data: { id: "j1", status: "DONE", clips: [{ path: "a.mp4" }], metadata: { title: "Podcast" } },
    });
    vi.mocked(axios.delete)
      .mockRejectedValueOnce(new Error("file in use"))
      .mockResolvedValueOnce({ data: { status: "success" } });
    await renderPage(makeCtx());

    act(() => container.querySelector<HTMLButtonElement>('button[aria-haspopup="menu"]')!.click());
    act(() => buttonWith(container, i18n.t("projects.menu_delete"))[0].click());
    const dialog = document.querySelector('[role="dialog"]') as HTMLElement;
    await act(async () => buttonWith(dialog, i18n.t("projects.delete_confirm"))[0].click());
    await act(() => new Promise((resolve) => setTimeout(resolve, 100)));

    expect(container.querySelector("h1")?.textContent).toBe("Podcast");
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(i18n.t("projects.delete_failed"));
    // The clips come back so the user can still see them.
    expect(container.querySelector('[data-testid="clips"]')).not.toBeNull();

    await act(async () => buttonWith(container, i18n.t("projects.delete_retry"))[0].click());
    await act(() => new Promise((resolve) => setTimeout(resolve, 100)));
    expect(axios.delete).toHaveBeenCalledTimes(2);
    expect(container.querySelector('[data-testid="where"]')?.textContent).toBe("/riwayat");
    consoleError.mockRestore();
  });

  it("says plainly when the project cannot load, and lets the user try again", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(axios.get)
      .mockRejectedValueOnce(new Error("Network Error"))
      .mockResolvedValueOnce({ data: { id: "j1", status: "DONE", clips: [], metadata: { title: "Podcast" } } });
    await renderPage(makeCtx());

    expect(container.querySelector('[role="alert"]')?.textContent).toContain(i18n.t("projects.load_failed"));
    await act(async () => buttonWith(container, i18n.t("projects.retry_load"))[0].click());
    expect(container.querySelector("h1")?.textContent).toBe("Podcast");
    consoleError.mockRestore();
  });

  it("says the project is gone when the backend no longer has it", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(axios.get).mockRejectedValueOnce({ response: { status: 404 } });
    await renderPage(makeCtx(), "gone");

    expect(container.querySelector('[role="alert"]')?.textContent).toContain(i18n.t("projects.not_found"));
    expect(buttonWith(container, i18n.t("projects.retry_load"))).toHaveLength(0);
    consoleError.mockRestore();
  });
});
