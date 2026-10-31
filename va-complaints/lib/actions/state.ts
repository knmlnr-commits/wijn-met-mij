/** What every form action returns to the page. Messages are safe to show: no personal data. */
export interface ActionResult {
  ok: boolean;
  message: string;
  fieldErrors?: Record<string, string>;
}

export const IDLE: ActionResult = { ok: true, message: "" };
