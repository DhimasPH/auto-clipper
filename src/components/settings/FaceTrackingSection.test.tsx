import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import axios from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../../i18n";
import { setApiUrl } from "../../platform/backendUrl";
import { FaceTrackingSection } from "./FaceTrackingSection";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("axios", () => ({ default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }));

const mp = (extra: Record<string, unknown> = {}) => ({
  id: "mediapipe",
  available: true,
  installed: false,
  downloading: false,
  percent: 0,
  downloaded_mb: 0,
  total_mb: 0,
  size_hint_mb: 35,
  disk_mb: 0,
  ...extra,
});
const answer = (status: Record<string, unknown>) => ({ data: { status: "success", addons: { mediapipe: status } } });

describe("FaceTrackingSection", () => {
  const API = "http://127.0.0.1:5123";
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    await i18n.changeLanguage("id");
    setApiUrl(API);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.resetAllMocks();
    vi.useRealTimers();
  });

  const button = (key: string) => [...container.querySelectorAll("button")].find((b) => b.textContent?.includes(i18n.t(key)));

  it("shows fallback note and install button when Teliti is chosen without addon installed", async () => {
    vi.mocked(axios.get).mockResolvedValue({
      data: {
        status: "success",
        addons: {
          mediapipe: { id: "mediapipe", available: true, installed: false, downloading: false, percent: 0, downloaded_mb: 0, total_mb: 0, size_hint_mb: 35, disk_mb: 0 },
        },
      },
    });
    vi.mocked(axios.post).mockResolvedValueOnce({
      data: { status: "success", addon: { id: "mediapipe", available: true, installed: false, downloading: true, percent: 25, downloaded_mb: 8, total_mb: 35, size_hint_mb: 35, disk_mb: 0 } },
    });

    await act(async () => root.render(<FaceTrackingSection value="mediapipe" onChange={vi.fn()} addonsEnabled />));

    expect(container.textContent).toContain(i18n.t("settings.addon_face_fallback_note"));
    expect(container.textContent).toContain(i18n.t("settings.addon_size", { mb: "35" }));
    const installBtn = [...container.querySelectorAll("button")].find((b) => b.textContent?.includes(i18n.t("settings.addon_face_install")))!;
    await act(async () => installBtn.click());
    expect(vi.mocked(axios.post)).toHaveBeenCalledWith(`${API}/api/settings/addons/mediapipe/download`);
    // The answer of the POST shows right away: real MB and percent, and the page may be left.
    expect(container.textContent).toContain(i18n.t("settings.addon_downloading", { done: "8", total: "35", percent: 25 }));
    const bar = container.querySelector('[role="progressbar"]')!;
    expect(bar.getAttribute("aria-valuenow")).toBe("25");
    expect(button("settings.addon_face_install")).toBeUndefined();
  });

  it("shows remove button when mediapipe addon is installed", async () => {
    vi.mocked(axios.get).mockResolvedValue({
      data: {
        status: "success",
        addons: {
          mediapipe: { id: "mediapipe", available: true, installed: true, downloading: false, percent: 100, downloaded_mb: 35, total_mb: 35, size_hint_mb: 35, disk_mb: 35 },
        },
      },
    });
    vi.mocked(axios.delete).mockResolvedValueOnce({
      data: { status: "success", addon: { id: "mediapipe", available: true, installed: false, downloading: false, percent: 0, downloaded_mb: 0, total_mb: 0, size_hint_mb: 35, disk_mb: 0 } },
    });

    await act(async () => root.render(<FaceTrackingSection value="mediapipe" onChange={vi.fn()} addonsEnabled />));

    expect(container.textContent).toContain(i18n.t("settings.addon_face_ready", { mb: "35" }));
    expect(container.textContent).not.toContain(i18n.t("settings.addon_face_fallback_note"));
    const removeBtn = [...container.querySelectorAll("button")].find((b) => b.textContent?.includes(i18n.t("settings.addon_face_remove")))!;
    await act(async () => removeBtn.click());
    expect(vi.mocked(axios.delete)).toHaveBeenCalledWith(`${API}/api/settings/addons/mediapipe`);
    expect(container.textContent).toContain(i18n.t("settings.addon_face_fallback_note"));
  });

  it("checks again every half second while downloading, until the add-on is installed", async () => {
    vi.useFakeTimers();
    vi.mocked(axios.get)
      .mockResolvedValueOnce(answer(mp({ downloading: true, percent: 40, downloaded_mb: 14, total_mb: 35 })))
      .mockResolvedValueOnce(answer(mp({ downloading: true, percent: 99, downloaded_mb: 35, total_mb: 35 })))
      .mockResolvedValue(answer(mp({ installed: true, percent: 100, disk_mb: 36.4 })));

    await act(async () => root.render(<FaceTrackingSection value="mediapipe" onChange={vi.fn()} addonsEnabled />));
    expect(container.textContent).toContain(i18n.t("settings.addon_downloading", { done: "14", total: "35", percent: 40 }));

    await act(async () => vi.advanceTimersByTimeAsync(500));
    expect(container.textContent).toContain(i18n.t("settings.addon_finishing"));

    await act(async () => vi.advanceTimersByTimeAsync(500));
    expect(container.textContent).toContain(i18n.t("settings.addon_face_ready", { mb: "36" }));
    const calls = vi.mocked(axios.get).mock.calls.length;
    await act(async () => vi.advanceTimersByTimeAsync(2000));
    expect(vi.mocked(axios.get).mock.calls.length).toBe(calls);
  });

  it("leaves the graphics card download to its own section (no second poll)", async () => {
    vi.useFakeTimers();
    vi.mocked(axios.get).mockResolvedValue({
      data: { status: "success", addons: { mediapipe: mp(), cuda: { ...mp({ downloading: true, percent: 10 }), id: "cuda" } } },
    });
    await act(async () => root.render(<FaceTrackingSection value="haar" onChange={vi.fn()} addonsEnabled />));
    await act(async () => vi.advanceTimersByTimeAsync(2000));
    expect(vi.mocked(axios.get)).toHaveBeenCalledTimes(1);
  });

  it("explains a failed download and offers to try again", async () => {
    vi.mocked(axios.get).mockResolvedValue(
      answer(mp({ error_info: { code: "ADDON_DOWNLOAD_FAILED", title: "Gagal memasang komponen tambahan", message: "x", technical: "SHA-256 mismatch" } })),
    );
    await act(async () => root.render(<FaceTrackingSection value="mediapipe" onChange={vi.fn()} addonsEnabled />));
    const alert = container.querySelector('[role="alert"]')!;
    expect(alert.textContent).toContain(i18n.t("settings.addon_download_failed"));
    expect(alert.querySelector("details")!.textContent).toContain("SHA-256 mismatch");
    expect(button("settings.addon_face_install")).toBeDefined();
  });

  it("shows the reason when removing fails (the add-on is in use)", async () => {
    vi.mocked(axios.get).mockResolvedValue(answer(mp({ installed: true, disk_mb: 35 })));
    vi.mocked(axios.delete).mockRejectedValueOnce({
      response: {
        status: 409,
        data: {
          status: "error",
          error_info: {
            code: "ADDON_IN_USE",
            title: "Komponen akan dihapus saat aplikasi dibuka ulang",
            message: "Tutup lalu buka ulang Auto Clipper.",
            technical: "WinError 32",
          },
        },
      },
    });
    await act(async () => root.render(<FaceTrackingSection value="haar" onChange={vi.fn()} addonsEnabled />));
    await act(async () => button("settings.addon_face_remove")!.click());
    const alert = container.querySelector('[role="alert"]')!;
    expect(alert.textContent).toContain("Komponen akan dihapus saat aplikasi dibuka ulang");
    expect(alert.textContent).toContain("WinError 32");
  });

  it("says Teliti is not available on computers without a build of the add-on", async () => {
    vi.mocked(axios.get).mockResolvedValue(answer(mp({ available: false })));
    await act(async () => root.render(<FaceTrackingSection value="mediapipe" onChange={vi.fn()} addonsEnabled />));
    expect(container.textContent).toContain(i18n.t("settings.addon_face_unavailable"));
    expect(button("settings.addon_face_install")).toBeUndefined();
  });

  it("keeps the Standar/Teliti choice working without add-ons (cloud) and asks nothing from the server", async () => {
    const onChange = vi.fn();
    await act(async () => root.render(<FaceTrackingSection value="mediapipe" onChange={onChange} addonsEnabled={false} />));
    expect(axios.get).not.toHaveBeenCalled();
    expect(container.textContent).not.toContain(i18n.t("settings.addon_face_fallback_note"));
    const select = container.querySelector("select")!;
    await act(async () => {
      select.value = "haar";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(onChange).toHaveBeenCalledWith("haar");
  });

  it("stays quiet when the add-on list cannot be read (older server)", async () => {
    vi.mocked(axios.get).mockRejectedValue(new Error("404"));
    await act(async () => root.render(<FaceTrackingSection value="mediapipe" onChange={vi.fn()} addonsEnabled />));
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(container.querySelector("select")).not.toBeNull();
    expect(button("settings.addon_face_install")).toBeUndefined();
  });
});
