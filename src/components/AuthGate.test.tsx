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
    const open = container.querySelector<HTMLButtonElement>("button")!;
    await act(async () => open.click());
    const input = container.querySelector<HTMLInputElement>('input[type="password"]')!;
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    await act(async () => {
      setValue.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => input.form!.requestSubmit());
  }

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
    const open = container.querySelector<HTMLButtonElement>("button")!;
    await act(async () => open.click());

    expect(container.textContent).toContain(i18n.t("auth.error_expired"));
  });
});
