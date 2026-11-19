// Adds keys to src/locales/id.json and src/locales/en.json.
// Input on stdin: {"id": {...nested keys...}, "en": {...}}. A key that already exists with the
// same text is left alone; one that exists with another text stops the script before anything
// is written (exit 1).
import { readFileSync, writeFileSync } from "node:fs";

const input = JSON.parse(readFileSync(0, "utf8"));
const conflicts = [];

function merge(target, source, path) {
  for (const [key, value] of Object.entries(source)) {
    const here = `${path}.${key}`;
    if (value && typeof value === "object") {
      if (target[key] === undefined) target[key] = {};
      if (typeof target[key] !== "object") {
        conflicts.push(here);
        continue;
      }
      merge(target[key], value, here);
    } else if (target[key] === undefined) {
      target[key] = value;
    } else if (target[key] !== value) {
      conflicts.push(`${here}: has ${JSON.stringify(target[key])}`);
    }
  }
}

const updated = {};
for (const lang of ["id", "en"]) {
  if (!input[lang]) {
    console.error(`The input has no "${lang}" object.`);
    process.exit(1);
  }
  const file = `src/locales/${lang}.json`;
  const data = JSON.parse(readFileSync(file, "utf8"));
  merge(data, input[lang], lang);
  updated[file] = data;
}
if (conflicts.length) {
  console.error(`Not written. These keys already exist with another text:\n${conflicts.join("\n")}`);
  process.exit(1);
}
for (const [file, data] of Object.entries(updated)) writeFileSync(file, JSON.stringify(data, null, 2));
console.log(`Updated ${Object.keys(updated).join(" and ")}.`);
