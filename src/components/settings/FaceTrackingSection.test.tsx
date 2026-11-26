import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import axios from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../../i18n";
import { setApiUrl } from "../../platform/backendUrl";
import { CAPS, setPlatform, type Platform } from "../../platform";
import { SETTINGS_ANCHORS } from "../../lib/routes";
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
    setPlatform({ caps: CAPS.desktop } as Platform);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.resetAllMocks();
    vi.useRealTimers();
    setPlatform(null);
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

  const DOWNLOAD_FAILED = {
    code: "ADDON_DOWNLOAD_FAILED",
    title: "Gagal memasang komponen tambahan",
    message: "Unduhan komponen berhenti atau file tidak lengkap.",
    actions: [{ id: "retry", label: "Coba lagi", label_en: "Try again" }],
    technical: "SHA-256 mismatch for mediapipe.whl",
  };

  it("shows the server's own explanation of a failed download in an error card, with Coba lagi (AGENTS F rule 12)", async () => {
    vi.mocked(axios.get).mockResolvedValue(answer(mp({ error_info: DOWNLOAD_FAILED })));
    await act(async () => root.render(<FaceTrackingSection value="mediapipe" onChange={vi.fn()} addonsEnabled />));
    const alert = container.querySelector('[role="alert"]')!;
    expect(alert.textContent).toContain("Gagal memasang komponen tambahan");
    expect(alert.textContent).toContain("Unduhan komponen berhenti atau file tidak lengkap.");
    // A checksum failure is not "the connection dropped or storage is full".
    expect(alert.textContent).not.toContain(i18n.t("settings.addon_download_failed"));
    expect(alert.querySelector("details")!.textContent).toContain("SHA-256 mismatch");
    // Coba lagi on the card installs again; no second button that does the same.
    expect(button("settings.addon_face_install")).toBeUndefined();
    const retry = [...alert.querySelectorAll("button")].find((b) => b.textContent === "Coba lagi")!;
    let answerPost!: (v: unknown) => void;
    vi.mocked(axios.post).mockReturnValueOnce(new Promise((resolve) => (answerPost = resolve)));
    vi.mocked(axios.get).mockResolvedValue(answer(mp({ downloading: true, percent: 1, downloaded_mb: 0.4, total_mb: 35 })));
    await act(async () => retry.click());
    expect(vi.mocked(axios.post)).toHaveBeenCalledWith(`${API}/api/settings/addons/mediapipe/download`);
    // The old failure goes away as soon as the new try starts.
    expect(container.querySelector('[role="alert"]')).toBeNull();
    await act(async () => answerPost({ data: { status: "success", addon: mp({ downloading: true, percent: 0, total_mb: 35 }) } }));
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(container.querySelector('[role="progressbar"]')).not.toBeNull();
  });

  it("uses its own words only when the request fails without the server's explanation", async () => {
    vi.mocked(axios.get).mockResolvedValue(answer(mp()));
    vi.mocked(axios.post).mockRejectedValueOnce(new Error("Network Error"));
    await act(async () => root.render(<FaceTrackingSection value="mediapipe" onChange={vi.fn()} addonsEnabled />));
    await act(async () => button("settings.addon_face_install")!.click());
    const alert = container.querySelector('[role="alert"]')!;
    expect(alert.textContent).toContain(i18n.t("settings.addon_download_failed"));
    expect(alert.querySelector("details")!.textContent).toContain("Network Error");
    expect(button("settings.addon_face_install")).toBeDefined();
  });

  it("sends one request when the install button is pressed twice quickly", async () => {
    vi.mocked(axios.get).mockResolvedValue(answer(mp()));
    vi.mocked(axios.post).mockReturnValue(new Promise(() => {}));
    await act(async () => root.render(<FaceTrackingSection value="mediapipe" onChange={vi.fn()} addonsEnabled />));
    const install = button("settings.addon_face_install")!;
    await act(async () => {
      install.click();
      install.click();
    });
    expect(vi.mocked(axios.post)).toHaveBeenCalledTimes(1);
  });

  it("stops checking when the page is left during a download", async () => {
    vi.useFakeTimers();
    vi.mocked(axios.get).mockResolvedValue(answer(mp({ downloading: true, percent: 40, downloaded_mb: 14, total_mb: 35 })));
    await act(async () => root.render(<FaceTrackingSection value="mediapipe" onChange={vi.fn()} addonsEnabled />));
    await act(async () => vi.advanceTimersByTimeAsync(500));
    const calls = vi.mocked(axios.get).mock.calls.length;
    expect(calls).toBeGreaterThanOrEqual(2);
    act(() => root.unmount());
    await act(async () => vi.advanceTimersByTimeAsync(3000));
    expect(vi.mocked(axios.get).mock.calls.length).toBe(calls);
    root = createRoot(container);
  });

  it("moves focus to the progress when the download starts, and names the bar after the add-on", async () => {
    vi.mocked(axios.get).mockResolvedValue(answer(mp()));
    vi.mocked(axios.post).mockResolvedValueOnce({ data: { status: "success", addon: mp({ downloading: true, total_mb: 35 }) } });
    await act(async () => root.render(<FaceTrackingSection value="mediapipe" onChange={vi.fn()} addonsEnabled />));
    const install = button("settings.addon_face_install")!;
    install.focus();
    await act(async () => install.click());
    const bar = container.querySelector('[role="progressbar"]')!;
    expect(bar.getAttribute("aria-label")).toContain(i18n.t("settings.addon_face_title"));
    expect(document.activeElement).not.toBe(document.body);
    expect(document.activeElement!.contains(bar)).toBe(true);
  });

  it("keeps the focus in the section after the add-on is removed", async () => {
    vi.mocked(axios.get).mockResolvedValue(answer(mp({ installed: true, disk_mb: 35 })));
    vi.mocked(axios.delete).mockResolvedValueOnce({ data: { status: "success", addon: mp() } });
    await act(async () => root.render(<FaceTrackingSection value="haar" onChange={vi.fn()} addonsEnabled />));
    const remove = button("settings.addon_face_remove")!;
    remove.focus();
    await act(async () => remove.click());
    expect(button("settings.addon_face_remove")).toBeUndefined();
    expect(document.activeElement).not.toBe(document.body);
    expect(container.contains(document.activeElement)).toBe(true);
  });

  it("shows the reason when removing fails (the add-on is in use), then the removal as scheduled, not as installed", async () => {
    vi.mocked(axios.get).mockResolvedValue(answer(mp({ installed: true, disk_mb: 35 })));
    vi.mocked(axios.delete).mockRejectedValueOnce({
      response: {
        status: 409,
        data: {
          status: "error",
          message: "Komponen ini sedang dipakai",
          error_info: {
            code: "ADDON_IN_USE",
            title: "Komponen akan dihapus saat aplikasi dibuka ulang",
            message: "Tutup lalu buka ulang Auto Clipper.",
            actions: [],
            technical: "WinError 32",
          },
        },
      },
    });
    await act(async () => root.render(<FaceTrackingSection value="haar" onChange={vi.fn()} addonsEnabled />));
    const remove = button("settings.addon_face_remove")!;
    remove.focus();
    await act(async () => remove.click());
    const alert = container.querySelector('[role="alert"]')!;
    expect(alert.textContent).toContain("Komponen akan dihapus saat aplikasi dibuka ulang");
    expect(alert.textContent).toContain("Tutup lalu buka ulang Auto Clipper.");
    expect(alert.querySelector("details")!.textContent).toContain("WinError 32");
    // The status is read again after a failed action.
    expect(vi.mocked(axios.get)).toHaveBeenCalledTimes(2);
    // Still on disk until the app opens again, but no longer "installed" with a remove button.
    expect(container.textContent).not.toContain(i18n.t("settings.addon_face_ready", { mb: "35" }));
    expect(button("settings.addon_face_remove")).toBeUndefined();
    expect(container.contains(document.activeElement)).toBe(true);
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

  it("lets cloud users choose Teliti cleanly without claiming it is unavailable", async () => {
    await act(async () => root.render(<FaceTrackingSection value="mediapipe" onChange={vi.fn()} addonsEnabled={false} />));
    expect(container.textContent).not.toContain("tidak tersedia");
    expect(button("settings.addon_face_install")).toBeUndefined();
  });

  it("can be opened from a link (/pengaturan#pelacak-wajah)", async () => {
    vi.mocked(axios.get).mockResolvedValue(answer(mp()));
    await act(async () => root.render(<FaceTrackingSection value="mediapipe" onChange={vi.fn()} addonsEnabled />));
    const target = container.querySelector(`#${SETTINGS_ANCHORS.faceTracking}`) as HTMLElement;
    expect(target).not.toBeNull();
    expect(target.tabIndex).toBe(-1);
  });

  it("stays quiet when the add-on list cannot be read (older server)", async () => {
    vi.mocked(axios.get).mockRejectedValue(new Error("404"));
    await act(async () => root.render(<FaceTrackingSection value="mediapipe" onChange={vi.fn()} addonsEnabled />));
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(container.querySelector("select")).not.toBeNull();
    expect(button("settings.addon_face_install")).toBeUndefined();
  });

  it("remembers a pending removal across reloads when the backend reports pending_remove", async () => {
    vi.mocked(axios.get).mockResolvedValue(answer(mp({ installed: true, pending_remove: true, disk_mb: 35 })));
    await act(async () => root.render(<FaceTrackingSection value="haar" onChange={vi.fn()} addonsEnabled />));
    expect(container.textContent).toContain(i18n.t("settings.addon_removal_scheduled"));
    expect(container.textContent).not.toContain(i18n.t("settings.addon_face_ready", { mb: "35" }));
    expect(button("settings.addon_face_remove")).toBeUndefined();
  });
});
