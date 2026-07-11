#!/usr/bin/env node
// Guard: App.tsx must stay modular (<= 300 lines). Warns on other oversized files.
// Run: node scripts/check_file_size.mjs
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const LIMIT = 300;
const countLines = (rel) => readFileSync(join(root, rel), "utf8").split("\n").length;

const failures = [];
const appLines = countLines("src/App.tsx");
if (appLines > LIMIT) failures.push(`src/App.tsx has ${appLines} lines (limit ${LIMIT})`);

// Informational: list other .tsx/.ts over the limit (non-fatal).
const dirs = ["src", "src/components", "src/hooks"];
const warns = [];
for (const d of dirs) {
  let entries;
  try { entries = readdirSync(join(root, d)); } catch { continue; }
  for (const f of entries) {
    if (!/\.(tsx|ts)$/.test(f)) continue;
    const rel = d + "/" + f;
    if (rel === "src/App.tsx") continue;
    const n = countLines(rel);
    if (n > LIMIT) warns.push(`${rel}: ${n} lines`);
  }
}

if (warns.length) {
  console.log("note: files above soft limit (not fatal):");
  for (const w of warns) console.log("  · " + w);
}
if (failures.length) {
  console.error("file-size check FAILED:");
  for (const f of failures) console.error("  - " + f);
  process.exit(1);
}
console.log(`file-size check passed (App.tsx = ${appLines} lines).`);
