import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// The rules engine must stay pure: only relative imports between its own modules.
describe("rules engine purity", () => {
  it("imports nothing outside lib/rules", () => {
    const sources = readdirSync(__dirname).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));
    const offenders = sources.flatMap((file) => {
      const text = readFileSync(join(__dirname, file), "utf8");
      const specifiers = [...text.matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)].map((m) => m[1]);
      return specifiers.filter((s) => !s.startsWith("./")).map((s) => `${file}: ${s}`);
    });
    expect(sources.length).toBeGreaterThan(0);
    expect(offenders).toEqual([]);
  });
});
