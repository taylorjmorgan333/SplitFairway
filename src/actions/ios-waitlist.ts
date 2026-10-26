"use server";

import { createClient } from "@/lib/supabase/server";
import { getEmailProvider } from "@/lib/email/provider";
import type { ActionState } from "@/actions/auth";
import {
  classifyWaitlistSubmission,
  waitlistMigrationMissing,
  type WaitlistSource,
} from "@/lib/waitlist";

type WaitlistRpc = {
  rpc: (
    fn: "join_ios_waitlist",
    args: { p_email: string; p_source: string },
  ) => Promise<{
    data: { status?: string } | null;
    error: { message: string } | null;
  }>;
};

const SUCCESS = "You're on the list. We'll email you when the iOS app is ready.";

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}

async function notifyOwner(email: string, source: WaitlistSource, stored: boolean): Promise<boolean> {
  const to = process.env.FEEDBACK_TO_ADDRESS;
  if (!to) return false;

  const where = stored
    ? "Stored in public.ios_waitlist."
    : "The ios_waitlist migration has not been applied, so this signup was not stored in the database.";

  const result = await getEmailProvider().send({
    to,
    subject: "iOS waitlist signup — SplitFairway",
    text: `Email: ${email}\nSource: ${source}\n\n${where}`,
    html: `<p><strong>Email:</strong> ${escapeHtml(email)}<br/><strong>Source:</strong> ${escapeHtml(source)}</p><p>${escapeHtml(where)}</p>`,
  });

  return result.delivered;
}

export async function joinIosWaitlistAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const classified = classifyWaitlistSubmission({
    email: formData.get("email"),
    website: formData.get("website"),
    source: formData.get("source"),
  });

  if (!classified.ok) {
    if (classified.reason === "spam") {
      return { status: "success", message: SUCCESS };
    }
    return { status: "error", fieldErrors: { email: ["Enter a valid email address."] } };
  }

  const supabase = (await createClient()) as unknown as WaitlistRpc;
  const { data, error } = await supabase.rpc("join_ios_waitlist", {
    p_email: classified.email,
    p_source: classified.source,
  });

  if (!error && data?.status === "ok") {
    await notifyOwner(classified.email, classified.source, true).catch(() => false);
    return { status: "success", message: SUCCESS };
  }

  if (!error && data?.status === "invalid") {
    return { status: "error", fieldErrors: { email: ["Enter a valid email address."] } };
  }

  if (!error && data?.status === "rate_limited") {
    return {
      status: "error",
      message: "Too many people just signed up. Try again in a little while.",
    };
  }

  if (error && waitlistMigrationMissing(error.message)) {
    const delivered = await notifyOwner(classified.email, classified.source, false).catch(() => false);
    if (delivered) {
      return { status: "success", message: SUCCESS };
    }
    return {
      status: "error",
      message: "The iOS waitlist isn't turned on for this site yet. Please try again later.",
    };
  }

  return { status: "error", message: "Could not save that email. Please try again." };
}
