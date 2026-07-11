#!/usr/bin/env node
// Guard: no hardcoded colors in .tsx — all colors must come from CSS tokens.
// Run: node scripts/check_colors.mjs
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const files = [
  "src/App.tsx",
  ...readdirSync(join(root, "src/components")).filter((f) => f.endsWith(".tsx")).map((f) => "src/components/" + f),
];

const patterns = [
  /#[0-9a-fA-F]{3,8}\b/,           // hex colors
  /\brgba?\s*\(/,                   // rgb()/rgba()
  /["'](white|black)["']/,          // quoted colour keywords
  /\blinear-gradient\s*\(/,         // gradients (contain hex)
];

const failures = [];
for (const rel of files) {
  const text = readFileSync(join(root, rel), "utf8");
  text.split("\n").forEach((line, i) => {
    // ignore lines that only reference tokens
    for (const re of patterns) {
      if (re.test(line)) {
        failures.push(`${rel}:${i + 1}: ${line.trim()}`);
        break;
      }
    }
  });
}

if (failures.length) {
  console.error(`Hardcoded colors found in .tsx (${failures.length}):`);
  for (const f of failures) console.error("  - " + f);
  process.exit(1);
}
console.log("color-token check passed.");
