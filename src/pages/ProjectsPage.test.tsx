import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import axios from "axios";
import i18n from "../i18n";
import { AppContext } from "../App";
import { CAPS, setPlatform, type Platform } from "../platform";
import { ProjectsPage } from "./ProjectsPage";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("axios", () => ({ default: { get: vi.fn(), delete: vi.fn() } }));

function Where() {
  const { pathname } = useLocation();
  return <p data-testid="where">{pathname}</p>;
}

const makeCtx = (overrides: Record<string, unknown> = {}) =>
  ({
    historyVersion: 0,
    isRunning: false,
    jobId: null,
    queuePosition: null,
    provider: "manual_ai",
    apiKeys: {},
    selectedModel: "",
    aiMode: "manual",
    handleRerender: vi.fn(),
    handleRerunAI: vi.fn(),
    handleResumeJob: vi.fn(),
    openAwaiting: vi.fn(),
    openCookies: vi.fn(),
    requestLocalUpload: vi.fn(),
    requestDriveBrowser: vi.fn(),
    ...overrides,
  }) as unknown as React.ContextType<typeof AppContext>;

const doneJob = {
  id: "j1",
  url: "https://youtu.be/abc",
  status: "DONE",
  created_at: "2026-11-20T10:00:00Z",
  result_clips: [{ path: "c1.mp4", description: "a", start: "0", end: "10", subs: true, v: 0 }],
  metadata: { title: "Podcast Pagi", ai_job: true },
};

const buttonWith = (container: HTMLElement, text: string) =>
  [...container.querySelectorAll("button")].filter((b) => b.textContent?.includes(text));

describe("ProjectsPage (spec 4.5)", () => {
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

  const renderPage = async (ctx: React.ContextType<typeof AppContext>) => {
    await act(async () => {
      root.render(
        <AppContext.Provider value={ctx}>
          <MemoryRouter initialEntries={["/riwayat"]}>
            <Routes>
              <Route path="/riwayat" element={<ProjectsPage />} />
              <Route path="/" element={<Where />} />
              <Route path="/riwayat/:id" element={<Where />} />
            </Routes>
          </MemoryRouter>
        </AppContext.Provider>,
      );
    });
  };

  it("shows status words, clip counts, one primary action, and error card for failed jobs", async () => {
    vi.mocked(axios.get).mockResolvedValueOnce({
      data: {
        status: "success",
        history: [
          doneJob,
          {
            id: "j2",
            url: "https://youtu.be/def",
            status: "AWAITING_MANUAL",
            created_at: "2026-11-20T09:00:00Z",
            result_clips: [],
            metadata: { title: "Tutorial Masak", manual_prompt: "PROMPT" },
          },
          {
            id: "j3",
            url: "https://youtu.be/ghi",
            status: "ERROR",
            created_at: "2026-11-20T08:00:00Z",
            result_clips: [],
            metadata: {
              title: "Video Gagal",
              error_info: {
                code: "DOWNLOAD_FAILED",
                title: "Video belum bisa diunduh",
                message: "Cek link video lalu coba lagi.",
                title_en: "Could not download",
                message_en: "Try again.",
                actions: ["retry"],
              },
            },
          },
        ],
      },
    });

    await renderPage(makeCtx());

    expect(container.textContent).toContain("Podcast Pagi");
    expect(container.textContent).toContain(i18n.t("projects.status_done"));
    expect(container.textContent).toContain(i18n.t("projects.action_view_clips"));
    expect(container.textContent).toContain("Tutorial Masak");
    expect(container.textContent).toContain(i18n.t("projects.status_awaiting"));
    expect(container.textContent).toContain(i18n.t("projects.action_paste_answer"));
    expect(container.textContent).toContain("Video belum bisa diunduh");

    // In cloud (apiKeys=false), "Pilih ulang momen dengan AI" stays hidden in the menu.
    const menus = [...container.querySelectorAll<HTMLButtonElement>('button[aria-haspopup="menu"]')];
    act(() => menus[0].click());
    expect(container.textContent).toContain(i18n.t("projects.menu_rerender"));
    expect(container.textContent).not.toContain(i18n.t("projects.menu_ai_rerun"));
  });

  it("brings awaiting projects back to step 3 when Tempel jawaban AI is clicked", async () => {
    const openAwaiting = vi.fn();
    vi.mocked(axios.get).mockResolvedValueOnce({
      data: {
        status: "success",
        history: [
          {
            id: "j2",
            url: "https://youtu.be/def",
            status: "AWAITING_MANUAL",
            created_at: "2026-11-20T09:00:00Z",
            result_clips: [],
            metadata: { title: "Tutorial Masak", manual_prompt: "PROMPT" },
          },
        ],
      },
    });

    await renderPage(makeCtx({ openAwaiting }));

    const btn = buttonWith(container, i18n.t("projects.action_paste_answer"))[0];
    // The one filled button on the screen (spec 4.6: one focal point).
    expect(btn.className).toContain("bg-accent");
    act(() => btn.click());
    expect(openAwaiting).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[data-testid="where"]')?.textContent).toBe("/");
  });

  it("opens the project page from Lihat klip, an outline button", async () => {
    vi.mocked(axios.get).mockResolvedValueOnce({ data: { status: "success", history: [doneJob] } });
    await renderPage(makeCtx());

    const btn = buttonWith(container, i18n.t("projects.action_view_clips"))[0];
    expect(btn.className).not.toContain("bg-accent");
    expect(btn.className).toContain("border-border-active");
    expect(btn.className).toContain("min-h-[44px]");
    act(() => btn.click());
    expect(container.querySelector('[data-testid="where"]')?.textContent).toBe("/riwayat/j1");
  });

  it("shows Menunggu giliran for the project this session is waiting to run", async () => {
    const running = { id: "j4", url: "https://youtu.be/q", status: "DOWNLOADING", result_clips: [], metadata: { title: "Antri" } };
    vi.mocked(axios.get)
      .mockResolvedValueOnce({ data: { status: "success", history: [running] } })
      .mockResolvedValueOnce({ data: { status: "success", history: [running] } });

    await renderPage(makeCtx());
    expect(container.querySelector("li")?.textContent).toContain(i18n.t("projects.status_running"));

    await renderPage(makeCtx({ jobId: "j4", queuePosition: 2, historyVersion: 1 }));
    const row = container.querySelector("li")!;
    expect(row.textContent).toContain(i18n.t("projects.status_queued"));
    expect(row.textContent).not.toContain(i18n.t("projects.status_running"));
  });

  it("offers Lanjutkan once: from the error card when it has one, else as the primary button", async () => {
    const handleResumeJob = vi.fn();
    const errorInfo = (actions: unknown[]) => ({
      code: "DOWNLOAD_FAILED",
      title: "Video belum bisa diunduh",
      message: "Cek link video lalu coba lagi.",
      title_en: "Could not download",
      message_en: "Try again.",
      actions,
    });
    vi.mocked(axios.get).mockResolvedValueOnce({
      data: {
        status: "success",
        history: [
          {
            id: "with_action",
            url: "https://youtu.be/a",
            status: "ERROR",
            result_clips: [],
            metadata: { title: "A", error_info: errorInfo([{ id: "resume", label: "Lanjutkan", label_en: "Continue" }]) },
          },
          {
            id: "without_action",
            url: "https://youtu.be/b",
            status: "ERROR",
            result_clips: [],
            metadata: { title: "B", error_info: errorInfo([]) },
          },
        ],
      },
    });
    await renderPage(makeCtx({ handleResumeJob }));

    const rows = [...container.querySelectorAll("li")];
    expect(buttonWith(rows[0], "Lanjutkan")).toHaveLength(1);
    expect(buttonWith(rows[1], i18n.t("projects.action_resume"))).toHaveLength(1);

    act(() => buttonWith(rows[0], "Lanjutkan")[0].click());
    act(() => buttonWith(rows[1], i18n.t("projects.action_resume"))[0].click());
    expect(handleResumeJob).toHaveBeenNthCalledWith(1, "with_action", "history");
    expect(handleResumeJob).toHaveBeenNthCalledWith(2, "without_action", "history");
  });

  it("re-picks moments with an extra instruction where API keys exist", async () => {
    setPlatform({ caps: CAPS.desktop } as unknown as Platform);
    const handleRerunAI = vi.fn();
    vi.mocked(axios.get).mockResolvedValueOnce({ data: { status: "success", history: [doneJob] } });
    await renderPage(makeCtx({ handleRerunAI }));

    act(() => container.querySelector<HTMLButtonElement>('button[aria-haspopup="menu"]')!.click());
    act(() => buttonWith(container, i18n.t("projects.menu_ai_rerun"))[0].click());

    const dialog = document.querySelector('[role="dialog"]')!;
    expect(dialog.textContent).toContain(i18n.t("projects.ai_title"));
    const textarea = dialog.querySelector("textarea")!;
    act(() => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
      setValue.call(textarea, "  fokus ke tips bisnis  ");
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    });
    act(() => buttonWith(dialog as HTMLElement, i18n.t("projects.ai_start"))[0].click());

    expect(handleRerunAI).toHaveBeenCalledWith("j1", "fokus ke tips bisnis");
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it("makes all clips again with the project's saved look", async () => {
    const handleRerender = vi.fn();
    const job = { ...doneJob, metadata: { ...doneJob.metadata, aspect_ratio: "1:1", burn_subs: false } };
    vi.mocked(axios.get).mockResolvedValueOnce({ data: { status: "success", history: [job] } });
    await renderPage(makeCtx({ handleRerender }));

    act(() => container.querySelector<HTMLButtonElement>('button[aria-haspopup="menu"]')!.click());
    act(() => buttonWith(container, i18n.t("projects.menu_rerender"))[0].click());
    const dialog = document.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog.querySelector("select")?.value).toBe("1:1");

    act(() => buttonWith(dialog, i18n.t("projects.rerender_start"))[0].click());
    expect(handleRerender).toHaveBeenCalledTimes(1);
    expect(handleRerender.mock.calls[0].slice(0, 4)).toEqual(["j1", "1:1", "standard", false]);
  });

  it("deletes a project only after confirming, then reloads the list", async () => {
    vi.mocked(axios.get)
      .mockResolvedValueOnce({ data: { status: "success", history: [doneJob] } })
      .mockResolvedValueOnce({ data: { status: "success", history: [] } });
    vi.mocked(axios.delete).mockResolvedValueOnce({ data: { status: "success" } });
    await renderPage(makeCtx());

    act(() => container.querySelector<HTMLButtonElement>('button[aria-haspopup="menu"]')!.click());
    act(() => buttonWith(container, i18n.t("projects.menu_delete"))[0].click());
    expect(axios.delete).not.toHaveBeenCalled();

    const dialog = document.querySelector('[role="dialog"]') as HTMLElement;
    await act(async () => buttonWith(dialog, i18n.t("projects.delete_confirm"))[0].click());
    expect(vi.mocked(axios.delete).mock.calls[0][0]).toMatch(/\/history\/j1$/);
    expect(container.textContent).toContain(i18n.t("projects.empty"));
  });

  it("keeps the project and says what to do when deleting fails, then retries", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(axios.get)
      .mockResolvedValueOnce({ data: { status: "success", history: [doneJob] } })
      .mockResolvedValueOnce({ data: { status: "success", history: [] } });
    vi.mocked(axios.delete)
      .mockRejectedValueOnce(new Error("file in use"))
      .mockResolvedValueOnce({ data: { status: "success" } });
    await renderPage(makeCtx());

    act(() => container.querySelector<HTMLButtonElement>('button[aria-haspopup="menu"]')!.click());
    act(() => buttonWith(container, i18n.t("projects.menu_delete"))[0].click());
    const dialog = document.querySelector('[role="dialog"]') as HTMLElement;
    await act(async () => buttonWith(dialog, i18n.t("projects.delete_confirm"))[0].click());

    const row = container.querySelector("li")!;
    expect(row.textContent).toContain("Podcast Pagi");
    expect(row.querySelector('[role="alert"]')?.textContent).toContain(i18n.t("projects.delete_failed"));
    expect(axios.get).toHaveBeenCalledTimes(1);

    await act(async () => buttonWith(row, i18n.t("projects.delete_retry"))[0].click());
    expect(axios.delete).toHaveBeenCalledTimes(2);
    expect(vi.mocked(axios.delete).mock.calls[1][0]).toMatch(/\/history\/j1$/);
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(container.textContent).toContain(i18n.t("projects.empty"));
    consoleError.mockRestore();
  });

  it("keeps what the user typed or chose when the page re-renders behind an open dialog", async () => {
    setPlatform({ caps: CAPS.desktop } as unknown as Platform);
    vi.mocked(axios.get).mockResolvedValueOnce({ data: { status: "success", history: [doneJob] } });
    await renderPage(makeCtx());

    act(() => container.querySelector<HTMLButtonElement>('button[aria-haspopup="menu"]')!.click());
    act(() => buttonWith(container, i18n.t("projects.menu_ai_rerun"))[0].click());
    let textarea = document.querySelector<HTMLTextAreaElement>('[role="dialog"] textarea')!;
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(textarea, "cari bagian lucu");
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    });
    // A new context object each poll tick, as App gives while a job runs.
    await renderPage(makeCtx());
    await renderPage(makeCtx());
    textarea = document.querySelector<HTMLTextAreaElement>('[role="dialog"] textarea')!;
    expect(textarea.value).toBe("cari bagian lucu");
    act(() => buttonWith(document.querySelector('[role="dialog"]') as HTMLElement, i18n.t("common.cancel"))[0].click());

    act(() => container.querySelector<HTMLButtonElement>('button[aria-haspopup="menu"]')!.click());
    act(() => buttonWith(container, i18n.t("projects.menu_rerender"))[0].click());
    let select = document.querySelector<HTMLSelectElement>('[role="dialog"] select')!;
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!.call(select, "16:9");
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await renderPage(makeCtx());
    await renderPage(makeCtx());
    select = document.querySelector<HTMLSelectElement>('[role="dialog"] select')!;
    expect(select.value).toBe("16:9");
  });

  it("says plainly when the list cannot load and lets the user try again", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(axios.get)
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({ data: { status: "success", history: [doneJob] } });
    await renderPage(makeCtx());

    expect(container.querySelector('[role="alert"]')?.textContent).toContain(i18n.t("projects.load_failed"));
    await act(async () => buttonWith(container, i18n.t("projects.retry_load"))[0].click());
    expect(container.textContent).toContain("Podcast Pagi");
    consoleError.mockRestore();
  });
});
