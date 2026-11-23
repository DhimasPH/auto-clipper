import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import axios from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../i18n";
import { setAuthToken, UNAUTHORIZED_EVENT } from "../platform/auth";
import { AuthGate } from "./AuthGate";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// The backend answers a wrong or expired token with 401 and CORS headers (backend/main.py),
// so the cloud app sees the status and must say "token" rather than "server offline".

describe("AuthGate token errors", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    setAuthToken(null);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    setAuthToken(null);
  });

  async function submitToken(value: string) {
    await act(async () => root.render(<AuthGate>app</AuthGate>));
    const input = container.querySelector<HTMLInputElement>('input[type="password"]')!;
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    await act(async () => {
      setValue.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => input.form!.requestSubmit());
  }

  it("shows the access code form on the page, labelled, with a show/hide button", async () => {
    await act(async () => root.render(<AuthGate>app</AuthGate>));
    const input = container.querySelector<HTMLInputElement>('input[type="password"]')!;
    expect(container.querySelector(`label[for="${input.id}"]`)?.textContent).toBe(i18n.t("auth.token_placeholder"));
    const toggle = container.querySelector<HTMLButtonElement>(`button[aria-label="${i18n.t("auth.show_code")}"]`)!;
    await act(async () => toggle.click());
    expect(input.type).toBe("text");
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
  });

  it("says the access code was refused when the backend answers 401", async () => {
    vi.spyOn(axios, "get").mockRejectedValue(Object.assign(new Error("401"), { response: { status: 401 } }));

    await submitToken("wrong-token");

    expect(container.textContent).toContain(i18n.t("auth.error_invalid"));
    expect(container.textContent).not.toContain(i18n.t("auth.error_offline"));
  });

  it("says the server cannot be reached when there is no response at all", async () => {
    vi.spyOn(axios, "get").mockRejectedValue(new Error("Network Error"));

    await submitToken("any-token");

    expect(container.textContent).toContain(i18n.t("auth.error_offline"));
  });

  it("asks for the code again when a later request answers 401", async () => {
    vi.spyOn(axios, "get").mockResolvedValue({ status: 200, data: {} });
    await submitToken("good-token");
    expect(container.textContent).toContain("app");

    await act(async () => window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT)));

    expect(container.textContent).toContain(i18n.t("auth.error_expired"));
  });
});
