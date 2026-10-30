import { describe, expect, it } from "vitest";
import {
  finalResponseSchema,
  gbpAmount,
  registerComplaintSchema,
  updateDetailsSchema,
} from "@/lib/validation/complaint";
import { EDITABLE_FIELDS } from "@/lib/domain/complaint";

const TODAY = "2026-10-30";
const INSURER = "3f1c2a4e-8b7d-4c6a-9e5f-1a2b3c4d5e6f";
const base = { insurer_id: INSURER, received_date: "2026-10-01", complainant_name: "Demo Complainant", summary: "Synthetic summary" };

describe("register complaint validation", () => {
  const schema = registerComplaintSchema(TODAY);

  it("accepts the required fields and normalises empty optionals to null", () => {
    const parsed = schema.parse({ ...base, complainant_email: "", town: "  " });
    expect(parsed.complainant_email).toBeNull();
    expect(parsed.town).toBeNull();
    expect(parsed.vulnerable_customer).toBe(false);
  });

  it("rejects a received date in the future", () => {
    const result = schema.safeParse({ ...base, received_date: "2026-10-31" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("Date cannot be in the future");
  });

  it("requires name, summary and an insurer", () => {
    expect(schema.safeParse({ ...base, complainant_name: " " }).success).toBe(false);
    expect(schema.safeParse({ ...base, summary: "" }).success).toBe(false);
    expect(schema.safeParse({ ...base, insurer_id: "not-a-uuid" }).success).toBe(false);
  });

  it("requires a vulnerability category when vulnerable", () => {
    const result = schema.safeParse({ ...base, vulnerable_customer: true });
    expect(result.error?.issues[0].path).toEqual(["vulnerability_category"]);
    expect(schema.safeParse({ ...base, vulnerable_customer: true, vulnerability_category: "CODE" }).success).toBe(true);
  });

  it("does not echo submitted values in error messages", () => {
    const result = schema.safeParse({ ...base, complainant_email: "not an email demo@example" });
    expect(JSON.stringify(result.error?.issues)).not.toMatch(/demo@example/);
  });
});

describe("edit details validation", () => {
  const schema = updateDetailsSchema(TODAY);

  it("rejects locked fields such as the received date and insurer", () => {
    expect(schema.safeParse({ received_date: "2026-10-02" }).success).toBe(false);
    expect(schema.safeParse({ insurer_id: INSURER }).success).toBe(false);
    expect(schema.safeParse({ status: "closed" }).success).toBe(false);
  });

  it("accepts a partial change and rejects an empty one", () => {
    expect(schema.parse({ town: "Testtown" })).toEqual({ town: "Testtown" });
    expect(schema.safeParse({}).success).toBe(false);
  });
});

describe("final response validation", () => {
  const schema = finalResponseSchema(TODAY);
  const id = INSURER;

  it("requires upheld against unless not upheld, and a payer when compensation is offered", () => {
    expect(schema.safeParse({ complaintId: id, date: TODAY, outcome: "upheld" }).success).toBe(false);
    expect(schema.safeParse({ complaintId: id, date: TODAY, outcome: "not_upheld" }).success).toBe(true);
    expect(schema.safeParse({ complaintId: id, date: TODAY, outcome: "upheld", upheldAgainst: "firm", compensationAmount: 10 }).success).toBe(false);
  });
});

describe("GBP amounts", () => {
  it("allows two decimals and rejects more or negatives", () => {
    expect(gbpAmount.safeParse(120.5).success).toBe(true);
    expect(gbpAmount.safeParse(0.1 + 0.2).success).toBe(true);
    expect(gbpAmount.safeParse(10.005).success).toBe(false);
    expect(gbpAmount.safeParse(-1).success).toBe(false);
  });
});

describe("edit details never resets the vulnerability flag", () => {
  it("leaves vulnerable_customer out of a partial change", () => {
    expect("vulnerable_customer" in updateDetailsSchema(TODAY).parse({ summary: "Changed" })).toBe(false);
  });
});

describe("editable fields stay in step", () => {
  it("the edit schema accepts exactly the editable fields", () => {
    const shape = Object.keys(updateDetailsSchema(TODAY).shape).sort();
    expect(shape).toEqual([...EDITABLE_FIELDS].sort());
  });
});
