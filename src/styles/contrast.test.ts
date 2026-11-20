import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// WCAG 2.x contrast of the colour tokens in src/index.css (spec 4.6, antislop R-25).
const css = readFileSync("src/index.css", "utf8");

function tokens(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`No "${selector} {" block in src/index.css`);
  const body = css.slice(css.indexOf("{", start) + 1, css.indexOf("}", start));
  const out: Record<string, string> = {};
  for (const m of body.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) out[m[1]] = m[2];
  return out;
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
}

const TEXT: [string, string][] = [
  ["text-primary", "bg-primary"], ["text-primary", "bg-secondary"], ["text-primary", "bg-surface"],
  ["text-secondary", "bg-primary"], ["text-secondary", "bg-secondary"], ["text-secondary", "bg-surface"],
  ["text-tertiary", "bg-secondary"], ["accent", "bg-primary"], ["accent", "bg-secondary"],
  ["accent", "accent-muted"], ["text-primary", "accent-muted"], ["on-accent", "accent"],
  ["on-accent", "accent-hover"], ["error", "bg-primary"], ["error", "bg-secondary"],
  ["warning", "bg-secondary"], ["success", "bg-secondary"],
];
// Control edges and the focus ring (WCAG 1.4.11): 3:1.
const UI: [string, string][] = [
  ["border-active", "bg-primary"], ["border-active", "bg-secondary"], ["accent", "bg-primary"],
];

describe("contrast formula", () => {
  it("matches the antislop-human reference table", () => {
    expect(contrast("#777777", "#FFFFFF")).toBe(4.48);
    expect(contrast("#000000", "#FFFFFF")).toBe(21);
  });
});

describe.each([
  ["dark", ":root"],
  ["light", '[data-theme="light"]'],
])("%s theme tokens", (_name, selector) => {
  const t = tokens(selector);

  it.each(TEXT)("%s on %s is at least 4.5:1", (fg, bg) => {
    expect(t[fg], `--${fg} missing`).toBeDefined();
    expect(t[bg], `--${bg} missing`).toBeDefined();
    expect(contrast(t[fg], t[bg])).toBeGreaterThanOrEqual(4.5);
  });

  it.each(UI)("%s against %s is at least 3:1", (fg, bg) => {
    expect(contrast(t[fg], t[bg])).toBeGreaterThanOrEqual(3);
  });
});
