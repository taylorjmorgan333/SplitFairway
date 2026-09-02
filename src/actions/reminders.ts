"use server";

import { createClient } from "@/lib/supabase/server";
import { getEmailProvider } from "@/lib/email/provider";
import { buildReminderMessage, type ReminderContext, type ReminderTone } from "@/lib/reminders";

export type SendReminderResult =
  | { status: "sent"; message: string }
  | { status: "previewed"; message: string }
  | { status: "error"; message: string };

/**
 * Sends (or, in dev mode, previews) one reminder email and records it
 * in the activity log via log_reminder_sent(), which independently
 * checks captain authorization and rate-limits (15/hour) server-side —
 * so this can't be abused even if called directly, bypassing the UI.
 */
export async function sendReminderAction(
  tripId: string,
  tone: ReminderTone,
  context: ReminderContext,
  recipientEmail: string,
  targetMemberId: string | null,
): Promise<SendReminderResult> {
  const supabase = await createClient();
  const built = buildReminderMessage(tone, context);

  const provider = getEmailProvider();
  const result = await provider.send({
    to: recipientEmail,
    subject: built.subject,
    html: `<p>${built.emailBody.replace(/\n/g, "<br />")}</p>`,
    text: built.emailBody,
  });

  const { error } = await supabase.rpc("log_reminder_sent", {
    p_trip_id: tripId,
    p_kind: context.kind,
    p_tone: tone,
    p_channel: result.delivered ? "email" : "email-preview",
    p_target_member_id: targetMemberId ?? undefined,
  });

  if (error) {
    return { status: "error", message: error.message };
  }

  if (result.delivered) {
    return { status: "sent", message: `Email sent to ${recipientEmail}.` };
  }

  return {
    status: "previewed",
    message: result.error
      ? `Email isn't configured (${result.error}) — logged as a preview. Use the copyable text below to send it yourself.`
      : "Email delivery isn't configured yet — logged as a preview instead. Use the copyable text below to send it yourself.",
  };
}
