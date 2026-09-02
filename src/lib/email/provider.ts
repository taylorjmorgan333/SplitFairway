/**
 * Server-side transactional email. Two implementations behind one
 * interface:
 *
 *  - ResendEmailProvider, used automatically when RESEND_API_KEY is
 *    set — sends real email via Resend's REST API (a plain `fetch`
 *    call, so no SDK dependency is needed for one endpoint).
 *  - DevLogEmailProvider, the default otherwise — logs a full preview
 *    of what would have been sent and returns `delivered: false`. It
 *    never claims a message went out when it didn't; callers must
 *    check `delivered` rather than assume success.
 *
 * The API key and "from" address never reach the client — this file
 * is only ever imported from server actions and route handlers.
 */

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export type EmailSendResult = {
  delivered: boolean;
  id?: string;
  error?: string;
};

export interface EmailProvider {
  readonly name: string;
  send(message: EmailMessage): Promise<EmailSendResult>;
}

const RESEND_API_URL = "https://api.resend.com/emails";

export class ResendEmailProvider implements EmailProvider {
  readonly name = "resend";

  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  async send(message: EmailMessage): Promise<EmailSendResult> {
    try {
      const response = await fetch(RESEND_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: this.from,
          to: [message.to],
          subject: message.subject,
          html: message.html,
          text: message.text,
        }),
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        return { delivered: false, error: `Resend responded ${response.status}: ${body}` };
      }

      const body = (await response.json().catch(() => ({}))) as { id?: string };
      return { delivered: true, id: body.id };
    } catch (err) {
      return {
        delivered: false,
        error: err instanceof Error ? err.message : "Unknown error sending email",
      };
    }
  }
}

export class DevLogEmailProvider implements EmailProvider {
  readonly name = "dev-log";

  async send(message: EmailMessage): Promise<EmailSendResult> {
    // Deliberately does NOT claim delivery. This is the safe fallback
    // for local development and any environment without an email
    // provider configured — it prints exactly what would have been
    // sent so it can be eyeballed, but `delivered: false` means
    // callers must show the user a preview/copy flow instead of a
    // "sent!" confirmation.
    //
    // Only logs in non-production environments: an email address plus
    // message body is user information, and this provider is meant to
    // be a local-dev convenience, not a way for that data to end up in
    // production server logs if RESEND_API_KEY is ever left unset on a
    // real deployment.
    if (process.env.NODE_ENV !== "production") {
      console.log(
        [
          "─── [dev email preview — NOT delivered] ───",
          `To: ${message.to}`,
          `Subject: ${message.subject}`,
          "",
          message.text,
          "────────────────────────────────────────────",
        ].join("\n"),
      );
    }
    return { delivered: false };
  }
}

let cachedProvider: EmailProvider | null = null;

export function getEmailProvider(): EmailProvider {
  if (cachedProvider) return cachedProvider;

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM_ADDRESS;

  cachedProvider =
    apiKey && from ? new ResendEmailProvider(apiKey, from) : new DevLogEmailProvider();

  return cachedProvider;
}

/** Test-only: reset the cached provider so a test can swap env vars. */
export function _resetEmailProviderCache() {
  cachedProvider = null;
}
