/**
 * FCA DISP regulatory defaults. The only place in the codebase where these numbers exist.
 * Each value can be overridden per insurer profile; overrides are clamped to at least 1.
 */
export const FCA_DEFAULTS = {
  /** Prompt written acknowledgement; breaching if unacknowledged past target. */
  ackBusinessDays: 5,
  /** DISP 1.5: summary resolution only if resolved by close of the third business day after receipt. */
  summaryBusinessDays: 3,
  /** Best practice interim holding point (week 4); soft prompt, not a breach. */
  interimDays: 28,
  /** DISP 1.6: final response, or holding response with FOS rights, by the end of eight weeks. */
  finalResponseDays: 56,
  /** FOS referral window from the date the final response is sent. */
  fosReferralDays: 182,
  /** Amber warning window before the final response deadline. */
  amberWindowDays: 14,
  /** DISP 1.9 minimum record retention from receipt. */
  retentionYears: 3,
} as const;

export type SlaProfile = { readonly [K in keyof typeof FCA_DEFAULTS]: number };

export type SlaKey = keyof SlaProfile;

export interface RuleDescription {
  key: SlaKey;
  label: string;
  unit: "business days" | "calendar days" | "years";
  basis: string;
}

/** Human readable description of each rule; drives the Framework page and the settings form. */
export const RULES: readonly RuleDescription[] = [
  {
    key: "ackBusinessDays",
    label: "Acknowledgement target",
    unit: "business days",
    basis: "Prompt written acknowledgement; breaching if unacknowledged past target.",
  },
  {
    key: "summaryBusinessDays",
    label: "Summary resolution route",
    unit: "business days",
    basis: "DISP 1.5; only if resolved by close of the third business day after receipt.",
  },
  {
    key: "interimDays",
    label: "Interim holding point",
    unit: "calendar days",
    basis: "Best practice; soft prompt, not a breach.",
  },
  {
    key: "finalResponseDays",
    label: "Final response deadline",
    unit: "calendar days",
    basis: "DISP 1.6; holding response with FOS rights required if missed.",
  },
  {
    key: "fosReferralDays",
    label: "FOS referral window",
    unit: "calendar days",
    basis: "From the date the final response is sent.",
  },
  {
    key: "amberWindowDays",
    label: "Amber warning window",
    unit: "calendar days",
    basis: "Before the final response deadline.",
  },
  {
    key: "retentionYears",
    label: "Record retention",
    unit: "years",
    basis: "DISP 1.9 minimum from receipt.",
  },
];

/**
 * Where a profile value goes beyond what DISP allows. The settings screen warns on these but
 * does not block, so a Manager can still record an insurer's own contractual terms.
 * `max`: the statutory period may not be longer. `min`: the statutory period may not be shorter.
 */
export const STATUTORY_LIMITS: Partial<Record<SlaKey, { max?: number; min?: number }>> = {
  summaryBusinessDays: { max: FCA_DEFAULTS.summaryBusinessDays },
  finalResponseDays: { max: FCA_DEFAULTS.finalResponseDays },
  fosReferralDays: { min: FCA_DEFAULTS.fosReferralDays },
  retentionYears: { min: FCA_DEFAULTS.retentionYears },
};

/** Builds a complete profile from optional overrides, clamping every value to an integer of at least 1. */
export function resolveProfile(overrides: Partial<Record<SlaKey, number | null | undefined>> = {}): SlaProfile {
  const profile = { ...FCA_DEFAULTS } as Record<SlaKey, number>;
  for (const key of Object.keys(FCA_DEFAULTS) as SlaKey[]) {
    const value = overrides[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      profile[key] = Math.max(1, Math.trunc(value));
    }
  }
  return profile;
}

export interface ProfileWarning {
  key: SlaKey;
  message: string;
}

export function profileWarnings(profile: SlaProfile): ProfileWarning[] {
  const warnings: ProfileWarning[] = [];
  for (const rule of RULES) {
    const limit = STATUTORY_LIMITS[rule.key];
    const value = profile[rule.key];
    if (limit?.max !== undefined && value > limit.max) {
      warnings.push({
        key: rule.key,
        message: `${rule.label} of ${value} ${rule.unit} exceeds the FCA limit of ${limit.max} ${rule.unit}.`,
      });
    }
    if (limit?.min !== undefined && value < limit.min) {
      warnings.push({
        key: rule.key,
        message: `${rule.label} of ${value} ${rule.unit} is below the FCA minimum of ${limit.min} ${rule.unit}.`,
      });
    }
  }
  return warnings;
}
