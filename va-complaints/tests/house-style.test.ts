import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * House style: the long dash (U+2014) and the en dash (U+2013) are never used in UI copy,
 * letters, seed data or docs. Use ; or , instead. Scans every authored source file.
 */
const FORBIDDEN = new RegExp("[\\u2013\\u2014]");
const ROOT = join(__dirname, "..");
const SCAN_DIRS = ["app", "components", "lib", "supabase", "scripts", "docs", "tests", "e2e"];
const SCAN_FILES = ["README.md", "CLAUDE.md", ".env.example"];
const EXTENSIONS = new Set([".ts", ".tsx", ".css", ".sql", ".md", ".json", ".csv", ".txt", ".html"]);

function walk(dir: string): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }
  return entries.flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return walk(full);
    return EXTENSIONS.has(extname(name)) ? [full] : [];
  });
}

function filesToScan(): string[] {
  const files = SCAN_DIRS.flatMap((d) => walk(join(ROOT, d)));
  for (const f of SCAN_FILES) {
    try {
      if (statSync(join(ROOT, f)).isFile()) files.push(join(ROOT, f));
    } catch {
      // Optional file; skip when absent.
    }
  }
  return files;
}

describe("house style", () => {
  it("detects both forbidden characters", () => {
    expect(FORBIDDEN.test(String.fromCharCode(0x2014))).toBe(true);
    expect(FORBIDDEN.test(String.fromCharCode(0x2013))).toBe(true);
    expect(FORBIDDEN.test("plain - hyphen; semicolon, comma")).toBe(false);
  });

  it("finds files to scan", () => {
    expect(filesToScan().length).toBeGreaterThan(0);
  });

  it("uses no long dash or en dash anywhere in authored content", () => {
    const offenders: string[] = [];
    for (const file of filesToScan()) {
      readFileSync(file, "utf8")
        .split("\n")
        .forEach((line, i) => {
          if (FORBIDDEN.test(line)) offenders.push(`${relative(ROOT, file)}:${i + 1}`);
        });
    }
    expect(offenders).toEqual([]);
  });
});
