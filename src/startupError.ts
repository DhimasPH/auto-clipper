import i18n from "./i18n";

/**
 * Shown instead of the app when the platform cannot load (React never rendered).
 * Plain DOM with textContent: no React, no HTML from the error.
 */
export function renderStartupError(root: HTMLElement, err: unknown): void {
  const box = document.createElement("div");
  box.setAttribute("role", "alert");
  box.style.cssText = "max-width:36rem;margin:3rem auto;padding:0 1rem;font-family:system-ui,sans-serif;line-height:1.5";

  const title = document.createElement("h1");
  title.style.fontSize = "1.25rem";
  title.textContent = i18n.t("startup.title");

  const body = document.createElement("p");
  body.textContent = i18n.t("startup.body");

  const action = document.createElement("p");
  action.textContent = i18n.t("startup.action");

  const details = document.createElement("details");
  const summary = document.createElement("summary");
  summary.textContent = i18n.t("startup.details");
  const pre = document.createElement("pre");
  pre.style.whiteSpace = "pre-wrap";
  pre.textContent = err instanceof Error ? err.message : String(err);
  details.append(summary, pre);

  box.append(title, body, action, details);
  root.replaceChildren(box);
}
