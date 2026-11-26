import { readFileSync } from "node:fs";
import { relative, resolve, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { sourceFiles } from "../test/sourceFiles";

// Like the SP0 thread test: the rule is checked on the source, so a new file cannot slip past it.
const SRC = resolve(process.cwd(), "src");

const rel = (file: string) => relative(SRC, file).split(sep).join("/");
const STATIC_TAURI_IMPORT = /^\s*(import|export)\s[^;]*?from\s+["']@tauri-apps\/|^\s*import\s+["']@tauri-apps\//m;

describe("platform boundaries", () => {
  it("imports @tauri-apps/* statically only in src/platform/desktop", () => {
    const offenders = sourceFiles(SRC)
      .filter((file) => !rel(file).startsWith("platform/desktop/"))
      .filter((file) => STATIC_TAURI_IMPORT.test(readFileSync(file, "utf8")))
      .map(rel);
    expect(offenders).toEqual([]);
  });

  it("checks for Tauri (__TAURI_INTERNALS__) only inside src/platform", () => {
    const offenders = sourceFiles(SRC)
      .filter((file) => !rel(file).startsWith("platform/"))
      .filter((file) => readFileSync(file, "utf8").includes("__TAURI_INTERNALS__"))
      .map(rel);
    expect(offenders).toEqual([]);
  });

  it("loads the desktop adapter only through src/platform/index.ts", () => {
    const offenders = sourceFiles(SRC)
      .filter((file) => !rel(file).startsWith("platform/"))
      .filter((file) => /platform\/desktop/.test(readFileSync(file, "utf8")))
      .map(rel);
    expect(offenders).toEqual([]);
  });
});
