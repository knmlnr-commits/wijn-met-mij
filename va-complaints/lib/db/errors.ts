/**
 * Maps database errors to messages that are safe to show and log. Postgres constraint errors
 * can carry row values (personal data) in their detail; those are never passed on.
 */
export class DataError extends Error {
  constructor(
    message: string,
    readonly kind: "invalid" | "forbidden" | "not_found" | "unexpected",
  ) {
    super(message);
    this.name = "DataError";
  }
}

interface PgLikeError {
  code?: string;
  message?: string;
}

const FRIENDLY_CONSTRAINTS: Record<string, string> = {
  vulnerability_category_required: "Choose a vulnerability category for a vulnerable customer.",
  dates_not_before_receipt: "Dates cannot be before the received date.",
  soft_delete_consistent: "A deletion needs a reason.",
};

export function toDataError(error: PgLikeError | null | undefined): DataError {
  const code = error?.code ?? "";
  const message = error?.message ?? "";

  // Raised by our own workflow functions with messages written to be shown as is.
  if (code === "22023") return new DataError(message, "invalid");
  if (code === "P0002") return new DataError("Complaint not found.", "not_found");
  if (code === "42501") return new DataError("You do not have permission to do this.", "forbidden");

  if (code === "23514" || code === "23502" || code === "23503" || code === "23505") {
    const constraint = Object.keys(FRIENDLY_CONSTRAINTS).find((name) => message.includes(name));
    if (constraint) return new DataError(FRIENDLY_CONSTRAINTS[constraint], "invalid");
    if (code === "23505") return new DataError("This value already exists.", "invalid");
    if (code === "23503") return new DataError("A selected value is no longer available.", "invalid");
    return new DataError("Some required information is missing or invalid.", "invalid");
  }
  return new DataError("The change could not be saved. Please try again.", "unexpected");
}

/** Throws a safe error when a Supabase call returned one. */
export function check<T>(result: { data: T; error: PgLikeError | null }): T {
  if (result.error) throw toDataError(result.error);
  return result.data;
}
