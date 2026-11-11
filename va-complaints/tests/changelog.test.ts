import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { APP_VERSION, CHANGELOG } from "@/lib/changelog";
import { helpFor, SCREEN_HELP } from "@/lib/help";

describe("version and changelog", () => {
  it("the header version is the newest changelog entry and matches package.json", () => {
    const pkg = JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf8")) as { version: string };
    expect(CHANGELOG[0].version).toBe(APP_VERSION);
    expect(pkg.version).toBe(APP_VERSION);
  });
});

describe("in-app help", () => {
  it("explains every screen", () => {
    for (const path of ["/", "/register", "/complaints/abc", "/reports", "/settings/users", "/framework", "/changelog"]) {
      const help = helpFor(path);
      expect(help.key, path).not.toBe("default");
      expect(help.purpose.length).toBeGreaterThan(20);
    }
    expect(new Set(SCREEN_HELP.map((s) => s.key)).size).toBe(SCREEN_HELP.length);
  });
});
