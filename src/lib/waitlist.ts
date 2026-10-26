import { z } from "zod";

export const WAITLIST_SOURCES = ["home_footer", "trip_mode"] as const;

export type WaitlistSource = (typeof WAITLIST_SOURCES)[number];

const emailSchema = z.string().trim().min(3).max(320).email();

export type WaitlistClassification =
  | { ok: true; email: string; source: WaitlistSource }
  | { ok: false; reason: "spam" | "invalid" };

/**
 * Honeypot field `website` must be empty. A filled value is treated as
 * a bot and is not stored. The caller should still show success so the
 * bot is not told it failed.
 */
export function classifyWaitlistSubmission(input: {
  email: unknown;
  website: unknown;
  source: unknown;
}): WaitlistClassification {
  if (typeof input.website === "string" && input.website.trim() !== "") {
    return { ok: false, reason: "spam" };
  }

  const email = emailSchema.safeParse(input.email);
  const source = WAITLIST_SOURCES.find((allowed) => allowed === input.source);
  if (!email.success || !source) {
    return { ok: false, reason: "invalid" };
  }

  return { ok: true, email: email.data.toLowerCase(), source };
}

export function waitlistMigrationMissing(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("join_ios_waitlist") ||
    lower.includes("schema cache") ||
    lower.includes("could not find the function") ||
    lower.includes("does not exist")
  );
}
