#!/usr/bin/env node
// Behavioural test for shouldNotifyOS() — suppress OS notif when app focused.
// Run: node scripts/check_notify.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { transformSync } from "esbuild";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];
const fail = (m) => failures.push(m);

let shouldNotifyOS;
try {
  const ts = readFileSync(join(root, "src/lib/notify.ts"), "utf8");
  const js = transformSync(ts, { loader: "ts", format: "esm" }).code;
  const mod = await import("data:text/javascript," + encodeURIComponent(js));
  shouldNotifyOS = mod.shouldNotifyOS;
} catch (e) {
  fail(`Cannot load shouldNotifyOS: ${e.message}`);
}

function withEnv({ permission, focused, supported = true }, fn) {
  const g = globalThis;
  const savedN = g.Notification, savedD = g.document;
  g.Notification = supported ? { permission } : undefined;
  g.document = { hasFocus: () => focused };
  try { return fn(); } finally { g.Notification = savedN; g.document = savedD; }
}

if (typeof shouldNotifyOS === "function") {
  const cases = [
    [{ permission: "granted", focused: false }, true, "granted + unfocused"],
    [{ permission: "granted", focused: true }, false, "granted + focused (suppress)"],
    [{ permission: "default", focused: false }, false, "not granted"],
    [{ permission: "denied", focused: false }, false, "denied"],
    [{ permission: "granted", focused: false, supported: false }, false, "no Notification API"],
  ];
  for (const [env, expected, name] of cases) {
    const got = withEnv(env, () => shouldNotifyOS());
    if (got !== expected) fail(`shouldNotifyOS(${name}) => ${got}, expected ${expected}`);
  }
} else {
  fail("shouldNotifyOS is not a function");
}

// Wiring guard: useClipJobs must gate the OS notification via shouldNotifyOS().
try {
  const uc = readFileSync(join(root, "src/hooks/useClipJobs.ts"), "utf8");
  if (!/shouldNotifyOS\s*\(/.test(uc)) fail("useClipJobs.ts must gate new Notification via shouldNotifyOS()");
} catch (e) {
  fail(`Cannot read useClipJobs.ts: ${e.message}`);
}

if (failures.length) {
  console.error("notify checks FAILED:");
  for (const f of failures) console.error("  - " + f);
  process.exit(1);
}
console.log("notify checks passed.");
