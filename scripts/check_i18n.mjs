#!/usr/bin/env node
// Lightweight i18n regression checks (no test framework required).
// Run: node scripts/check_i18n.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];
const fail = (msg) => failures.push(msg);

function loadJson(rel) {
  const p = join(root, rel);
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch (e) {
    fail(`Cannot parse ${rel}: ${e.message}`);
    return null;
  }
}

function flatten(obj, prefix = "", out = {}) {
  for (const [k, v] of Object.entries(obj ?? {})) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) flatten(v, key, out);
    else out[key] = v;
  }
  return out;
}

const en = loadJson("src/locales/en.json");
const id = loadJson("src/locales/id.json");

if (en && id) {
  const fe = flatten(en);
  const fi = flatten(id);
  const ke = new Set(Object.keys(fe));
  const ki = new Set(Object.keys(fi));
  for (const k of ke) if (!ki.has(k)) fail(`Key present in en.json but missing in id.json: ${k}`);
  for (const k of ki) if (!ke.has(k)) fail(`Key present in id.json but missing in en.json: ${k}`);

  // T1: api_key_note must reflect encrypted OS-level storage, not "browser"/local-only.
  const noteEn = (fe["settings.api_key_note"] || "").toLowerCase();
  const noteId = (fi["settings.api_key_note"] || "").toLowerCase();
  if (/browser/.test(noteEn) || /browser/.test(noteId)) {
    fail(`settings.api_key_note must not mention "browser" (EN="${fe["settings.api_key_note"]}", ID="${fi["settings.api_key_note"]}")`);
  }
  if (!/encrypt/.test(noteEn)) fail(`settings.api_key_note (EN) should mention encryption, got "${fe["settings.api_key_note"]}"`);
  if (!/terenkripsi/.test(noteId)) fail(`settings.api_key_note (ID) should mention "terenkripsi", got "${fi["settings.api_key_note"]}"`);
}

if (failures.length) {
  console.error("i18n checks FAILED:");
  for (const f of failures) console.error("  - " + f);
  process.exit(1);
}
console.log("i18n checks passed.");
