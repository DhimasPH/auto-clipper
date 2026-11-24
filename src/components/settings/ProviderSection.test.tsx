import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import axios from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../../i18n";
import { setApiUrl } from "../../platform/backendUrl";
import type { ProviderId } from "../../lib/providers";
import { ProviderSection } from "./ProviderSection";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("axios", () => ({ default: { post: vi.fn() } }));

const API = "http://127.0.0.1:5123";

const setValue = (el: HTMLInputElement, value: string) => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
};

describe("ProviderSection (Lanjutan, API key)", () => {
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
  });

  const render = async (provider: ProviderId, apiKeys: Record<string, string>, selectedModel = "") => {
    const setApiKey = vi.fn();
    const setSelectedModel = vi.fn();
    await act(async () =>
      root.render(
        <ProviderSection
          provider={provider}
          setProvider={vi.fn()}
          selectedModel={selectedModel}
          setSelectedModel={setSelectedModel}
          apiKeys={apiKeys}
          setApiKey={setApiKey}
        />,
      ),
    );
    return { setApiKey, setSelectedModel };
  };
  const button = (text: string, scope: ParentNode = document) =>
    [...scope.querySelectorAll("button")].find((b) => b.textContent?.trim() === text) as HTMLButtonElement | undefined;

  it("tests the connection with the provider, key and model, then loads the model list", async () => {
    vi.mocked(axios.post)
      .mockResolvedValueOnce({ data: { status: "success" } })
      .mockResolvedValueOnce({ data: { status: "success", models: [{ id: "gpt-4o-mini", label: "GPT-4o mini" }] } });
    await render("openai", { openai: "sk-test" }, "gpt-4o-mini");

    await act(async () => button(i18n.t("settings.test_ai_btn"))!.click());

    expect(vi.mocked(axios.post).mock.calls[0]).toEqual([
      `${API}/api/settings/test-ai`,
      { provider: "openai", api_key: "sk-test", custom_base_url: "", custom_model_name: "", model: "gpt-4o-mini" },
    ]);
    expect(vi.mocked(axios.post).mock.calls[1]).toEqual([`${API}/api/providers/models`, { provider: "openai", api_key: "sk-test" }]);
    expect(container.querySelector('[role="status"]')?.textContent).toBe(i18n.t("settings.test_ai_success"));
  });

  it("asks for a key before testing and sends nothing", async () => {
    await render("openai", {});
    await act(async () => button(i18n.t("settings.test_ai_btn"))!.click());
    expect(axios.post).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(i18n.t("settings.test_ai_empty"));
  });

  it("explains a refused key and keeps the raw reason under Detail teknis", async () => {
    vi.mocked(axios.post).mockResolvedValueOnce({ data: { status: "error", message: "401 invalid api key" } });
    await render("openai", { openai: "sk-bad" }, "gpt-4o-mini");
    await act(async () => button(i18n.t("settings.test_ai_btn"))!.click());
    const alert = container.querySelector('[role="alert"]')!;
    expect(alert.textContent).toContain(i18n.t("settings.test_ai_failed"));
    expect(alert.querySelector("details")!.textContent).toContain("401 invalid api key");
  });

  it("sends the own server address and model with the test for a custom server", async () => {
    vi.mocked(axios.post).mockResolvedValueOnce({ data: { status: "success" } });
    await render("custom", { custom_base_url: "http://localhost:11434/v1", custom_model_name: "llama3", custom: "" });
    await act(async () => button(i18n.t("settings.test_ai_btn"))!.click());
    expect(vi.mocked(axios.post).mock.calls[0][1]).toEqual({
      provider: "custom",
      api_key: "",
      custom_base_url: "http://localhost:11434/v1",
      custom_model_name: "llama3",
      model: "",
    });
  });

  it("saves the own server settings trimmed", async () => {
    const { setApiKey } = await render("custom", {});
    await act(async () => button(i18n.t("settings.custom_config_btn"))!.click());
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!;
    const [url, model, key] = [...dialog.querySelectorAll<HTMLInputElement>("input")];
    await act(async () => {
      setValue(url, " http://localhost:11434/v1 ");
      setValue(model, "llama3 ");
      setValue(key, " sk-local");
    });
    await act(async () => button(i18n.t("common.save"), dialog)!.click());
    expect(setApiKey.mock.calls).toEqual([
      ["custom_base_url", "http://localhost:11434/v1"],
      ["custom_model_name", "llama3"],
      ["custom", "sk-local"],
    ]);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it("asks before Batal throws away typed server settings", async () => {
    const { setApiKey } = await render("custom", {});
    await act(async () => button(i18n.t("settings.custom_config_btn"))!.click());
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!;
    await act(async () => setValue(dialog.querySelector("input")!, "http://x"));
    await act(async () => button(i18n.t("common.cancel"), dialog)!.click());
    expect(dialog.querySelector('[role="alert"]')?.textContent).toContain(i18n.t("dialog.discard_question"));
    expect(setApiKey).not.toHaveBeenCalled();
  });
});
