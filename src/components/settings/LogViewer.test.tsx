import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import axios from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../../i18n";
import { copyText } from "../../lib/clipboard";
import { LogViewer } from "./LogViewer";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("axios", () => ({ default: { get: vi.fn() } }));
vi.mock("../../lib/clipboard", () => ({ copyText: vi.fn() }));

describe("LogViewer (Bantuan, Detail teknis)", () => {
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

  const open = async () => {
    const details = container.querySelector("details")!;
    await act(async () => {
      details.open = true;
      details.dispatchEvent(new Event("toggle"));
    });
  };
  const button = (text: string) =>
    [...container.querySelectorAll("button")].find((b) => b.textContent?.includes(text)) as HTMLButtonElement;

  it("stays closed and asks for nothing until opened", async () => {
    await act(async () => root.render(<LogViewer />));
    expect(container.querySelector("details")!.open).toBe(false);
    expect(container.querySelector("summary")!.textContent).toContain("Detail teknis");
    expect(axios.get).not.toHaveBeenCalled();
  });

  it("loads the app log when opened and another log when its kind is picked", async () => {
    vi.mocked(axios.get).mockResolvedValueOnce({ data: { content: "[INFO] started" } });
    await act(async () => root.render(<LogViewer />));
    await open();
    expect(vi.mocked(axios.get).mock.calls[0][0]).toMatch(/\/logs\/app$/);
    expect(container.textContent).toContain("[INFO] started");
    expect(button("Aplikasi").getAttribute("aria-pressed")).toBe("true");

    vi.mocked(axios.get).mockResolvedValueOnce({ data: { content: "" } });
    await act(async () => button("Masalah").click());
    expect(vi.mocked(axios.get).mock.calls[1][0]).toMatch(/\/logs\/error$/);
    expect(container.textContent).toContain("Belum ada catatan.");
  });

  it("says what went wrong and what to do when the log cannot be loaded", async () => {
    vi.mocked(axios.get).mockRejectedValueOnce(new Error("Network Error"));
    await act(async () => root.render(<LogViewer />));
    await open();
    const alert = container.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain("Catatan tidak bisa dimuat");
    expect(alert?.textContent).toContain("Muat ulang");

    vi.mocked(axios.get).mockResolvedValueOnce({ data: { content: "back again" } });
    await act(async () => button("Muat ulang").click());
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(container.textContent).toContain("back again");
  });

  it("copies the log and tells the user when copying did not work", async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: { content: "line 1" } });
    vi.mocked(copyText).mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    await act(async () => root.render(<LogViewer />));
    await open();

    await act(async () => button("Salin catatan").click());
    expect(copyText).toHaveBeenCalledWith("line 1");
    expect(container.textContent).toContain("Tersalin");

    await act(async () => button("Tersalin").click());
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("Tidak bisa menyalin otomatis");
  });
});
