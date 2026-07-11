#!/usr/bin/env node
// Behavioural test for the AI-rerun gating predicate + wiring guard.
// Run: node scripts/check_history.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { transformSync } from "esbuild";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];
const fail = (m) => failures.push(m);

// 1) Behavioural: canRerunAI must key off metadata.ai_job, not transcript.
let canRerunAI;
try {
  const tsSrc = readFileSync(join(root, "src/lib/history.ts"), "utf8");
  const js = transformSync(tsSrc, { loader: "ts", format: "esm" }).code;
  const mod = await import("data:text/javascript," + encodeURIComponent(js));
  canRerunAI = mod.canRerunAI;
} catch (e) {
  fail(`Cannot load src/lib/history.ts canRerunAI: ${e.message}`);
}

if (typeof canRerunAI === "function") {
  const cases = [
    [{ metadata: { ai_job: true } }, true, "ai_job=true"],
    [{ metadata: { ai_job: true, highlights: [{}] } }, true, "ai_job with highlights"],
    [{ metadata: { transcript: "x" } }, false, "transcript-only (legacy, never written)"],
    [{ metadata: {} }, false, "empty metadata"],
    [{ metadata: null }, false, "null metadata"],
    [{}, false, "no metadata"],
  ];
  for (const [job, expected, name] of cases) {
    const got = canRerunAI(job);
    if (got !== expected) fail(`canRerunAI(${name}) => ${got}, expected ${expected}`);
  }
} else {
  fail("canRerunAI is not a function");
}

// 2) Wiring guard: HistoryModal must gate via canRerunAI and not the dead transcript flag.
const hm = readFileSync(join(root, "src/pages/HistoryPage.tsx"), "utf8");
if (!/canRerunAI\s*\(/.test(hm)) fail("HistoryPage.tsx must gate the AI button via canRerunAI(...)");
if (/metadata\.transcript/.test(hm)) fail("HistoryPage.tsx must not gate on metadata.transcript (never written)");

if (failures.length) {
  console.error("history checks FAILED:");
  for (const f of failures) console.error("  - " + f);
  process.exit(1);
}
console.log("history checks passed.");
