import { describe, expect, it } from "vitest";
import en from "./en.json";
import id from "./id.json";

function keys(obj: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(obj)
    .flatMap(([key, value]) =>
      value && typeof value === "object" ? keys(value as Record<string, unknown>, `${prefix}${key}.`) : [`${prefix}${key}`],
    )
    .sort();
}

describe("locales", () => {
  it("Indonesian and English have the same keys", () => {
    expect(keys(en as Record<string, unknown>)).toEqual(keys(id as Record<string, unknown>));
  });
});
