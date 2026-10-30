import { describe, expect, it } from "vitest";
import { dbTestsEnabled } from "./harness";

// The database tests skip locally without TEST_DATABASE_URL; in CI they must always run.
describe("database tests", () => {
  it("run in CI", () => {
    if (process.env.CI) expect(dbTestsEnabled).toBe(true);
  });
});
