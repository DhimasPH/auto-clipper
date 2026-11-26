import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { sourceFiles } from "./sourceFiles";

describe("sourceFiles", () => {
  const root = mkdtempSync(join(tmpdir(), "ac-src-"));
  afterAll(() => rmSync(root, { recursive: true, force: true }));

  it("walks folders, keeps the asked extensions and skips test files", () => {
    mkdirSync(join(root, "a", "b"), { recursive: true });
    for (const f of ["x.ts", "y.tsx", "x.test.ts", "a/z.ts", "a/b/w.tsx", "a/b/w.test.tsx", "a/b/s.css", "a/note.md"]) {
      writeFileSync(join(root, f), "");
    }
    const rel = (files: string[]) => files.map((f) => relative(root, f).split(sep).join("/")).sort();
    expect(rel(sourceFiles(root))).toEqual(["a/b/w.tsx", "a/z.ts", "x.ts", "y.tsx"]);
    expect(rel(sourceFiles(root, ["css", "md"]))).toEqual(["a/b/s.css", "a/note.md"]);
  });
});
