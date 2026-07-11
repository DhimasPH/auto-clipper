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
  try {
    return JSON.parse(readFileSync(join(root, rel), "utf8"));
  } catch (e) {
    fail(`Cannot parse ${rel}: ${e.message}`);
    return null;
  }
}

function loadText(rel) {
  try {
    return readFileSync(join(root, rel), "utf8");
  } catch (e) {
    fail(`Cannot read ${rel}: ${e.message}`);
    return "";
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
let fe = {}, fi = {};

if (en && id) {
  fe = flatten(en);
  fi = flatten(id);
  const ke = new Set(Object.keys(fe));
  const ki = new Set(Object.keys(fi));
  for (const k of ke) if (!ki.has(k)) fail(`Key in en.json but missing in id.json: ${k}`);
  for (const k of ki) if (!ke.has(k)) fail(`Key in id.json but missing in en.json: ${k}`);

  const noteEn = (fe["settings.api_key_note"] || "").toLowerCase();
  const noteId = (fi["settings.api_key_note"] || "").toLowerCase();
  if (/browser/.test(noteEn) || /browser/.test(noteId)) fail(`settings.api_key_note must not mention "browser"`);
  if (!/encrypt/.test(noteEn)) fail(`settings.api_key_note (EN) should mention encryption`);
  if (!/terenkripsi/.test(noteId)) fail(`settings.api_key_note (ID) should mention "terenkripsi"`);
}

const requiredHistoryKeys = [
  "history.title", "history.empty", "history.delete_confirm", "history.download",
  "history.open_folder", "history.rerender_options", "history.aspect_ratio",
  "history.embed_subtitle", "history.sub_yes", "history.sub_no", "history.caption_style",
  "history.start_rerender", "history.cancel", "history.ai_correct", "history.ai_correct_desc",
  "history.ai_prompt_placeholder", "history.run_ai", "history.rerender_btn", "history.delete",
];
for (const k of requiredHistoryKeys) {
  if (!(k in fe)) fail(`Missing i18n key in en.json: ${k}`);
  if (!(k in fi)) fail(`Missing i18n key in id.json: ${k}`);
}

const hm = loadText("src/components/HistoryModal.tsx");
if (hm) {
  if (!/useTranslation/.test(hm)) fail("HistoryModal.tsx must use useTranslation");
  if (!/\bt\(["']history\./.test(hm)) fail("HistoryModal.tsx must reference history.* keys via t()");
  const forbidden = [
    "Belum ada riwayat klip", "Opsi Re-render", "Jalankan AI",
    "Masukkan instruksi khusus", "Apakah Anda yakin ingin menghapus",
    "Buka Folder", "Mulai Re-render", "Gaya Subtitle", "Masukan Subtitle",
  ];
  for (const phrase of forbidden) {
    if (hm.includes(phrase)) fail(`HistoryModal.tsx still contains hardcoded string: "${phrase}"`);
  }
}

if (failures.length) {
  console.error("i18n checks FAILED:");
  for (const f of failures) console.error("  - " + f);
  process.exit(1);
}
console.log("i18n checks passed.");
