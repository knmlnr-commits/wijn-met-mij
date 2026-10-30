import { describe, expect, it } from "vitest";
import { AuthError, assertRole, type CurrentUser } from "@/lib/auth/roles";
import { toDataError } from "@/lib/db/errors";
import { slaColumnsFrom, slaProfileFor, timelineForComplaint } from "@/lib/db/profile";
import type { FirmSettingsRow, InsurerRow, SlaColumns } from "@/lib/db/types";
import { FCA_DEFAULTS } from "@/lib/rules";

const NO_SLA: SlaColumns = {
  ack_business_days: null,
  summary_business_days: null,
  interim_days: null,
  final_response_days: null,
  fos_referral_days: null,
  amber_window_days: null,
  retention_years: null,
};

describe("assertRole", () => {
  const handler: CurrentUser = { id: "u1", email: "h@example.test", displayName: "Demo", role: "handler" };

  it("rejects a missing or inactive user", () => {
    expect(() => assertRole(null, ["handler"])).toThrow(AuthError);
    expect(() => assertRole(null, ["handler"])).toThrow("Please sign in.");
  });

  it("rejects a user without one of the roles", () => {
    expect(() => assertRole(handler, ["manager"])).toThrow("You do not have permission to do this.");
  });

  it("returns the user when the role matches", () => {
    expect(assertRole(handler, ["handler", "manager"])).toBe(handler);
  });
});

describe("SLA profile precedence", () => {
  it("insurer value, else firm setting, else engine default", () => {
    const insurer = { ...NO_SLA, final_response_days: 40 };
    const firm = { ...NO_SLA, final_response_days: 50, amber_window_days: 10 };
    const profile = slaProfileFor(insurer, firm);
    expect(profile.finalResponseDays).toBe(40);
    expect(profile.amberWindowDays).toBe(10);
    expect(profile.ackBusinessDays).toBe(FCA_DEFAULTS.ackBusinessDays);
  });

  it("round trips to database columns", () => {
    expect(slaColumnsFrom({ ackBusinessDays: 2, retentionYears: null })).toEqual({ ack_business_days: 2, retention_years: null });
  });

  it("applies the firm's bank holiday switch", () => {
    const insurer: InsurerRow = { ...NO_SLA, id: "i", name: "Zurich", is_active: true, is_lloyds: false, ack_business_days: 1 };
    const firm = { ...NO_SLA, bank_holidays_enabled: false } as FirmSettingsRow;
    const holidays = [{ date: "2026-04-03", name: "Good Friday", region: "england-and-wales" }];
    const complaint = {
      received_date: "2026-04-02",
      acknowledged_date: null,
      holding_response_date: null,
      final_response_date: null,
      resolution_path: null,
    };
    expect(timelineForComplaint(complaint, insurer, firm, holidays, "2026-04-02").acknowledgementDue).toBe("2026-04-03");
    const on = { ...firm, bank_holidays_enabled: true };
    expect(timelineForComplaint(complaint, insurer, on, holidays, "2026-04-02").acknowledgementDue).toBe("2026-04-06");
  });
});

describe("safe database errors", () => {
  it("passes on messages written by the workflow functions", () => {
    expect(toDataError({ code: "22023", message: "Complaint is already acknowledged" }).message).toBe("Complaint is already acknowledged");
  });

  it("never passes on constraint details that may hold personal data", () => {
    const error = toDataError({
      code: "23514",
      message: 'new row for relation "complaints" violates check constraint "x"; Failing row contains (Demo Complainant, demo@example.test)',
    });
    expect(error.message).toBe("Some required information is missing or invalid.");
    expect(error.message).not.toMatch(/example\.test/);
  });

  it("maps known constraints and permissions to friendly messages", () => {
    expect(toDataError({ code: "23514", message: 'violates check constraint "vulnerability_category_required"' }).message).toMatch(/vulnerability category/);
    expect(toDataError({ code: "42501", message: "permission denied for table complaints" }).kind).toBe("forbidden");
    expect(toDataError({ code: "XX000", message: "internal" }).kind).toBe("unexpected");
  });
});
