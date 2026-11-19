// SP1 one-off proof: every text of web/src/lib/strings.ts that SP1 moves exists in
// src/locales/{id,en}.json with the same wording. Delete together with web/ (Task 14).
import { readFileSync } from "node:fs";

// Keys of web pages that SP1 does not move (spec 4.2); desktop has its own Settings page.
const NOT_MOVED = new Set(["error.start_over", "nav.settings", "settings.subtitle", "settings.language_title", "settings.language_note"]);
// The web wording names Google Drive, so it lives under its own key, shown only on Colab.
const RENAMED = { "cookies.privacy": "cookies.privacy_cloud" };

const source = readFileSync("web/src/lib/strings.ts", "utf8");
const literal = source.slice(source.indexOf("= {") + 2, source.lastIndexOf("};") + 1);
const STRINGS = Function(`return (${literal});`)();

const get = (obj, key) => key.split(".").reduce((node, part) => (node == null ? undefined : node[part]), obj);
const failures = [];
let checked = 0;
for (const lang of ["id", "en"]) {
  const locale = JSON.parse(readFileSync(`src/locales/${lang}.json`, "utf8"));
  for (const [key, text] of Object.entries(STRINGS[lang])) {
    if (NOT_MOVED.has(key)) continue;
    const target = RENAMED[key] ?? key;
    const actual = get(locale, target);
    checked += 1;
    if (actual !== text) failures.push(`${lang}: ${target} = ${JSON.stringify(actual)}, web has ${JSON.stringify(text)}`);
  }
}
if (failures.length) {
  console.error(`${failures.length} of ${checked} web texts are missing or different:\n${failures.join("\n")}`);
  process.exit(1);
}
console.log(`All ${checked} web texts that SP1 moves are in src/locales.`);
