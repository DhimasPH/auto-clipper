import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import axios from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../../i18n";
import { PexelsKeySection } from "./PexelsKeySection";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("axios", () => ({ default: { post: vi.fn() } }));

describe("PexelsKeySection (Lanjutan, B-roll key)", () => {
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

  const render = async (key: string, setApiKey = vi.fn()) => {
    await act(async () => root.render(<PexelsKeySection apiKeys={{ pexels: key }} setApiKey={setApiKey} />));
    return setApiKey;
  };
  const button = (text: string) =>
    [...container.querySelectorAll("button")].find((b) => b.textContent?.includes(text)) as HTMLButtonElement;

  it("hides the key until asked and saves what is typed", async () => {
    const setApiKey = await render("px-123");
    const input = container.querySelector("input")!;
    expect(input.type).toBe("password");
    const toggle = container.querySelector<HTMLButtonElement>('button[aria-label="Tampilkan kunci"]')!;
    await act(async () => toggle.click());
    expect(input.type).toBe("text");

    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    await act(async () => {
      setter.call(input, "px-456");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(setApiKey).toHaveBeenCalledWith("pexels", "px-456");
  });

  it("asks for a key before testing an empty one", async () => {
    await render("");
    await act(async () => button("Tes kunci Pexels").click());
    expect(axios.post).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')?.textContent).toBe("Isi kunci Pexels dulu, lalu tes lagi.");
  });

  it("says the key works", async () => {
    vi.mocked(axios.post).mockResolvedValueOnce({ data: { status: "success" } });
    await render("px-123");
    await act(async () => button("Tes kunci Pexels").click());
    expect(vi.mocked(axios.post).mock.calls[0][0]).toMatch(/\/api\/settings\/test-pexels$/);
    expect(container.querySelector('[role="status"]')?.textContent).toBe("Kunci Pexels bisa dipakai.");
  });

  it("explains a failed test in plain words and keeps the raw reason under Detail teknis", async () => {
    vi.mocked(axios.post).mockRejectedValueOnce({ response: { data: { message: "401 Unauthorized" } }, message: "Request failed" });
    await render("px-bad");
    await act(async () => button("Tes kunci Pexels").click());
    const alert = container.querySelector('[role="alert"]')!;
    expect(alert.textContent).toContain("Kunci Pexels belum bisa dipakai.");
    expect(alert.textContent).toContain("lalu tes lagi");
    const details = alert.querySelector("details")!;
    expect(details.open).toBe(false);
    expect(details.textContent).toContain("Detail teknis");
    expect(details.textContent).toContain("401 Unauthorized");
  });

  it("treats an error answer from the server the same way", async () => {
    vi.mocked(axios.post).mockResolvedValueOnce({ data: { status: "error", message: "invalid key" } });
    await render("px-bad");
    await act(async () => button("Tes kunci Pexels").click());
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("Kunci Pexels belum bisa dipakai.");
  });
});
