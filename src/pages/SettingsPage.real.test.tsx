import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import axios from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../i18n";
import { AppContext } from "../App";
import { CAPS, setPlatform, type Platform } from "../platform";
import { SettingsPage } from "./SettingsPage";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// SettingsPage.test.tsx stubs the sections with network calls to test the layout. This file
// renders every real section (Task 15 audit): no emoji, no leftover English in id.

const EMOJI = /\p{Extended_Pictographic}/u;

const MODELS = [
  { id: "small", name: "Small", disk_size: "466 MB", vram: "~2 GB", description_id: "Cepat", description_en: "Fast", downloaded: true },
  { id: "large-v3", name: "Large-v3", disk_size: "3 GB", vram: "~10 GB", description_id: "Teliti", description_en: "Precise", downloaded: false },
];

const makeCtx = (overrides: Record<string, unknown> = {}) =>
  ({
    theme: "system",
    setTheme: vi.fn(),
    aiMode: "auto",
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

describe("SettingsPage with its real sections", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    vi.spyOn(axios, "get").mockImplementation(async (url: string) => {
      if (url.endsWith("/api/settings/whisper-models")) return { data: { status: "success", models: MODELS } };
      if (url.endsWith("/api/settings/cookies")) return { data: { cookies: { present: false, valid: false } } };
      return { data: {} };
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    setPlatform(null);
    vi.restoreAllMocks();
  });

  const render = async (lang: "id" | "en") => {
    await i18n.changeLanguage(lang);
    setPlatform({ caps: CAPS.desktop, updater: { check: vi.fn(), relaunch: vi.fn() } } as unknown as Platform);
    await act(async () => {
      root.render(
        <AppContext.Provider value={makeCtx()}>
          <MemoryRouter initialEntries={["/pengaturan"]}>
            <SettingsPage />
          </MemoryRouter>
        </AppContext.Provider>,
      );
    });
  };

  it.each(["id", "en"] as const)("shows no emoji (%s)", async (lang) => {
    await render(lang);
    const text = container.textContent ?? "";
    expect(text).toContain(lang === "id" ? "Penyedia AI" : "AI provider");
    expect(text).toContain("Large-v3");
    expect(EMOJI.test(text)).toBe(false);
    await i18n.changeLanguage("id");
  });

  it("id: no English labels left over from the old sections", async () => {
    await render("id");
    const text = container.textContent ?? "";
    for (const english of ["AI Provider", "Test AI Connection", "Download Model", "Base URL", "Model Name", "Check for Updates", "Regenerate"]) {
      expect(text).not.toContain(english);
    }
  });

  it("every button has a name and every form field a label", async () => {
    await render("id");
    for (const button of container.querySelectorAll("button")) {
      expect((button.getAttribute("aria-label") || button.textContent || "").trim()).not.toBe("");
    }
    for (const field of container.querySelectorAll<HTMLElement>("input:not([type=hidden]):not([tabindex='-1']), select, textarea")) {
      const id = field.id;
      const labelled =
        !!field.getAttribute("aria-label") ||
        !!field.getAttribute("aria-labelledby") ||
        !!field.closest("label") ||
        (!!id && [...container.querySelectorAll("label")].some((l) => l.htmlFor === id));
      expect(labelled, field.outerHTML).toBe(true);
    }
  });
});
