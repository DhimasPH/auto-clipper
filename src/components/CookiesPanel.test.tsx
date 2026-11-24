import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import axios from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../i18n";
import { CAPS, setPlatform, type Platform } from "../platform";
import { CookiesPanel } from "./CookiesPanel";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("axios", () => ({ default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }));

const STORED = { present: true, valid: true, logged_in: true, latest_expiry: null, uploaded_at: null };

describe("CookiesPanel delete", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    await i18n.changeLanguage("id");
    setPlatform({ caps: CAPS.local } as unknown as Platform);
    vi.mocked(axios.get).mockResolvedValue({ data: { cookies: STORED } });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root.render(<CookiesPanel />));
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    setPlatform(null);
    vi.resetAllMocks();
  });

  const button = (text: string) =>
    [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === text) as HTMLButtonElement | undefined;

  const deleteAndConfirm = async () => {
    const del = button(i18n.t("cookies.btn_delete"))!;
    await act(async () => {
      del.focus();
      del.click();
    });
    await act(async () => button(i18n.t("cookies.delete_yes"))!.click());
  };

  it("moves focus to the upload button after the delete button is gone", async () => {
    vi.mocked(axios.delete).mockResolvedValueOnce({ data: { cookies: { present: false } } });
    await deleteAndConfirm();
    expect(button(i18n.t("cookies.btn_delete"))).toBeUndefined();
    expect(document.activeElement).toBe(button(i18n.t("cookies.btn_choose")));
  });

  it("puts focus back on the delete button when deleting failed", async () => {
    vi.mocked(axios.delete).mockRejectedValueOnce({ message: "Network Error" });
    await deleteAndConfirm();
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    expect(document.activeElement).toBe(button(i18n.t("cookies.btn_delete")));
  });
});
