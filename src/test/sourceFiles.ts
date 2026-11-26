import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Every source file under `root` (recursively) with one of the given extensions, test files excluded.
 * Shared by the tests that check a rule on the source itself, so a new file cannot slip past them.
 */
export function sourceFiles(root: string, exts: string[] = ["ts", "tsx"]): string[] {
  const group = exts.join("|");
  const source = new RegExp(`\\.(${group})$`);
  const test = new RegExp(`\\.test\\.(${group})$`);
  return readdirSync(root).flatMap((name) => {
    const full = join(root, name);
    if (statSync(full).isDirectory()) return sourceFiles(full, exts);
    return source.test(name) && !test.test(name) ? [full] : [];
  });
}
