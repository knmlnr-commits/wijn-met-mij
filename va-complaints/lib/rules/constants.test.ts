import { describe, expect, it } from "vitest";
import { FCA_DEFAULTS, profileWarnings, resolveProfile, RULES } from "./constants";
import { SEEDED_INSURERS } from "./test-fixtures";

describe("SLA profiles", () => {
  it("defaults to the FCA DISP values", () => {
    expect(resolveProfile()).toEqual({
      ackBusinessDays: 5,
      summaryBusinessDays: 3,
      interimDays: 28,
      finalResponseDays: 56,
      fosReferralDays: 182,
      amberWindowDays: 14,
      retentionYears: 3,
    });
  });

  it("clamps overrides to whole numbers of at least 1", () => {
    const p = resolveProfile({ ackBusinessDays: 0, interimDays: -3, finalResponseDays: 40.7 });
    expect(p.ackBusinessDays).toBe(1);
    expect(p.interimDays).toBe(1);
    expect(p.finalResponseDays).toBe(40);
  });

  it("ignores missing or non numeric overrides", () => {
    const p = resolveProfile({ ackBusinessDays: null, interimDays: undefined, finalResponseDays: Number.NaN });
    expect(p).toEqual(resolveProfile());
  });

  it("describes every rule exactly once", () => {
    expect(RULES.map((r) => r.key).sort()).toEqual(Object.keys(FCA_DEFAULTS).sort());
  });
});

describe("statutory limit warnings", () => {
  it("gives no warnings for the FCA defaults or the seeded insurers", () => {
    expect(profileWarnings(resolveProfile())).toEqual([]);
    for (const profile of Object.values(SEEDED_INSURERS)) expect(profileWarnings(profile)).toEqual([]);
  });

  it("warns when a period is longer than DISP allows", () => {
    const keys = profileWarnings(resolveProfile({ finalResponseDays: 60, summaryBusinessDays: 4 })).map((w) => w.key);
    expect(keys).toEqual(["summaryBusinessDays", "finalResponseDays"]);
  });

  it("warns when the FOS window or retention is shorter than DISP requires", () => {
    const warnings = profileWarnings(resolveProfile({ fosReferralDays: 100, retentionYears: 2 }));
    expect(warnings.map((w) => w.key)).toEqual(["fosReferralDays", "retentionYears"]);
    expect(warnings[1].message).toBe("Record retention of 2 years is below the FCA minimum of 3 years.");
  });

  it("does not warn on best practice values such as acknowledgement or interim", () => {
    expect(profileWarnings(resolveProfile({ ackBusinessDays: 10, interimDays: 40, amberWindowDays: 30 }))).toEqual([]);
  });
});
