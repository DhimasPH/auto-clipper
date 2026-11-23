import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../i18n";
import { AppContext } from "../App";
import { CAPS, setPlatform, type Platform } from "../platform";
import { SettingsPage } from "./SettingsPage";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("axios", () => ({ default: { get: vi.fn(), post: vi.fn() } }));
// Sections with their own network calls are stubbed: this test is about the page layout.
vi.mock("../components/settings/CookiesSection", () => ({ CookiesSection: () => <p>cookies-panel</p> }));
vi.mock("../components/settings/TranscriptionSection", () => ({ TranscriptionSection: () => <p>subtitle-model</p> }));
vi.mock("../components/settings/ProviderSection", () => ({ ProviderSection: () => <p>provider-keys</p> }));
vi.mock("../components/settings/UpdaterSection", () => ({ UpdaterSection: () => <p>updater</p> }));

const makeCtx = (overrides: Record<string, unknown> = {}) =>
  ({
    theme: "system",
    setTheme: vi.fn(),
    aiMode: "manual",
    setAiMode: vi.fn(),
    provider: "openai",
    setProvider: vi.fn(),
    selectedModel: "",
    setSelectedModel: vi.fn(),
    apiKeys: {},
    setApiKey: vi.fn(),
    faceTrackingEngine: "haar",
    setFaceTrackingEngine: vi.fn(),
    outputFolder: "",
    setOutputFolder: vi.fn(),
    quality: "best",
    setQuality: vi.fn(),
    whisperModel: "small",
    setWhisperModel: vi.fn(),
    notify: vi.fn(),
    isRunning: false,
    errorMsg: "",
    errorInfo: null,
    failedJobId: null,
    handleManualGenerate: vi.fn(),
    ...overrides,
  }) as unknown as React.ContextType<typeof AppContext>;

const EMOJI = /\p{Extended_Pictographic}/u;

describe("SettingsPage (spec 4.5: Umum, YouTube, Lanjutan, Bantuan)", () => {
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
    setPlatform(null);
  });

  const render = async (caps: Platform["caps"], ctx = makeCtx()) => {
    setPlatform({ caps } as unknown as Platform);
    await act(async () => {
      root.render(
        <AppContext.Provider value={ctx}>
          <MemoryRouter initialEntries={["/pengaturan"]}>
            <SettingsPage />
          </MemoryRouter>
        </AppContext.Provider>,
      );
    });
    return ctx;
  };

  const section = (id: string) => container.querySelector<HTMLElement>(`section#${id}`)!;

  it("has four sections in order with their anchors and headings", async () => {
    await render(CAPS.desktop);
    const sections = [...container.querySelectorAll("section")];
    expect(sections.map((s) => s.id)).toEqual(["umum", "youtube", "lanjutan", "bantuan"]);
    expect(sections.map((s) => s.querySelector("h2")?.textContent)).toEqual(["Umum", "YouTube", "Lanjutan", "Bantuan"]);
    expect(section("youtube").textContent).toContain("cookies-panel");
    expect(section("lanjutan").querySelector("#pengunduh")).not.toBeNull();
    expect(container.querySelector("h1")?.textContent).toBe("Pengaturan");
  });

  it("shows no emoji anywhere on the page", async () => {
    await render(CAPS.desktop);
    expect(EMOJI.test(container.textContent ?? "")).toBe(false);
  });

  it("cloud: no API key switch, keys, folder picker or updater", async () => {
    await render(CAPS.cloud, makeCtx({ aiMode: "auto" }));
    const advanced = section("lanjutan");
    expect(advanced.textContent).not.toContain("Pakai API key");
    expect(advanced.textContent).not.toContain("provider-keys");
    expect(advanced.textContent).not.toContain("Pexels");
    expect(advanced.textContent).not.toContain("Folder hasil");
    expect(advanced.textContent).toContain("subtitle-model");
    expect(container.textContent).not.toContain("updater");
  });

  it("desktop, manual AI: the switch is off, provider keys hidden, Pexels key still there", async () => {
    const ctx = await render(CAPS.desktop);
    const advanced = section("lanjutan");
    const toggle = advanced.querySelector<HTMLInputElement>('input[role="switch"]')!;
    expect(toggle.checked).toBe(false);
    expect(advanced.textContent).not.toContain("provider-keys");
    expect(advanced.textContent).toContain("Pexels");
    expect(advanced.textContent).toContain("Folder hasil");
    expect(section("bantuan").textContent).toContain("updater");

    await act(async () => toggle.click());
    expect(ctx.setAiMode).toHaveBeenCalledWith("auto");
  });

  it("desktop, automatic AI: provider keys show", async () => {
    await render(CAPS.desktop, makeCtx({ aiMode: "auto" }));
    expect(section("lanjutan").textContent).toContain("provider-keys");
  });

  it("face engine choice is in Lanjutan: Standar or Teliti", async () => {
    const ctx = await render(CAPS.local);
    const select = [...section("lanjutan").querySelectorAll("select")].find((s) =>
      [...s.options].some((o) => o.value === "mediapipe"),
    )!;
    expect([...select.options].map((o) => [o.value, o.text])).toEqual([
      ["haar", "Standar"],
      ["mediapipe", "Teliti"],
    ]);
    await act(async () => {
      select.value = "mediapipe";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(ctx.setFaceTrackingEngine).toHaveBeenCalledWith("mediapipe");
  });

  it("Bantuan has the four steps, questions and the version", async () => {
    await render(CAPS.cloud);
    const help = section("bantuan");
    for (const step of ["Video", "Siapkan", "Pilih momen", "Klip"]) expect(help.textContent).toContain(step);
    expect(help.textContent).toContain("Apakah Auto Clipper gratis?");
    expect(help.textContent).toContain("Versi 1.19.0");
    expect(help.textContent).toContain("Detail teknis");
  });

  it("Bantuan keeps platform-only questions to the platforms they fit", async () => {
    await render(CAPS.cloud);
    expect(section("bantuan").textContent).not.toContain("Ollama");
    expect(section("bantuan").textContent).not.toContain("macOS");
    act(() => root.unmount());
    root = createRoot(container);
    await render(CAPS.desktop);
    expect(section("bantuan").textContent).toContain("Ollama");
    expect(section("bantuan").textContent).toContain("macOS");
  });

  it("Bantuan mentions API key actions only where API keys exist", async () => {
    await render(CAPS.cloud);
    const cloudHelp = section("bantuan").textContent ?? "";
    expect(cloudHelp).not.toContain("API key");
    expect(cloudHelp).not.toContain("Pilih ulang momen dengan AI");
    expect(cloudHelp).toContain("Buat klip lagi dari video yang sama");
    act(() => root.unmount());
    root = createRoot(container);
    await render(CAPS.local);
    const localHelp = section("bantuan").textContent ?? "";
    expect(localHelp).toContain("Pilih ulang momen dengan AI");
    expect(localHelp).toContain("API key hanya untuk AI otomatis");
    expect(localHelp).toContain("Dengan API key, langkah ini berjalan sendiri.");
  });

  it("Umum: theme buttons say which one is on, without icons or emoji", async () => {
    const ctx = await render(CAPS.cloud, makeCtx({ theme: "dark" }));
    const general = section("umum");
    const themeButtons = [...general.querySelectorAll("button")].filter((b) =>
      ["Gelap", "Terang", "Sistem"].includes(b.textContent ?? ""),
    );
    expect(themeButtons.map((b) => b.getAttribute("aria-pressed"))).toEqual(["true", "false", "false"]);
    expect(general.textContent).toContain("Bahasa Indonesia");
    expect(general.textContent).toContain("English");
    await act(async () => themeButtons[1].click());
    expect(ctx.setTheme).toHaveBeenCalledWith("light");
  });
});
