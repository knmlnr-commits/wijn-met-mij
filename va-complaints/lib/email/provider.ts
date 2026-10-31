import "server-only";
import { redactEmail } from "./redact";

/**
 * Email delivery behind one small interface. `stub` (the default) records a redacted line and
 * reports success, so the sandbox never emails anyone. The real provider is TODO(CONFIRM):
 * AWS SES or another provider approved by VAS (docs/OPEN_ITEMS.md item 8).
 */
export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

export interface EmailResult {
  ok: boolean;
  providerId?: string;
}

export interface EmailProvider {
  readonly name: string;
  send(message: EmailMessage): Promise<EmailResult>;
}

export const stubEmailProvider: EmailProvider = {
  name: "stub",
  async send(message) {
    // No content and no full address in the log: personal data stays out of logs.
    console.info(JSON.stringify({ event: "email.stub", to: redactEmail(message.to), length: message.text.length }));
    return { ok: true, providerId: `stub-${Date.now()}` };
  },
};

export function getEmailProvider(name: string | undefined = process.env.EMAIL_PROVIDER): EmailProvider {
  if (!name || name === "stub") return stubEmailProvider;
  throw new Error(`Email provider "${name}" is not available yet (open item 8).`);
}
