"use server";

import { createClient } from "@/lib/supabase/server";
import { getEmailProvider } from "@/lib/email/provider";
import type { ActionState } from "@/actions/auth";

const MAX_MESSAGE_LENGTH = 4000;
// Generous but real — stops one runaway client from spamming the table
// or an email provider, without needing a dedicated rate-limit RPC for
// a low-stakes, append-only, self-scoped table.
const MAX_SUBMISSIONS_PER_HOUR = 10;

export async function submitFeedbackAction(
  pagePath: string,
  tripId: string | null,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const message = String(formData.get("message") ?? "").trim();

  if (message.length === 0) {
    return { status: "error", fieldErrors: { message: ["Enter some feedback first."] } };
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return {
      status: "error",
      fieldErrors: { message: [`Keep it under ${MAX_MESSAGE_LENGTH} characters.`] },
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { status: "error", message: "You need to be signed in to send feedback." };
  }

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("beta_feedback")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", oneHourAgo);

  if ((count ?? 0) >= MAX_SUBMISSIONS_PER_HOUR) {
    return {
      status: "error",
      message: "You've sent a lot of feedback in the last hour — thank you! Try again a bit later.",
    };
  }

  const { error } = await supabase.from("beta_feedback").insert({
    user_id: user.id,
    trip_id: tripId,
    page_path: pagePath,
    message,
  });

  if (error) {
    return { status: "error", message: "Could not send feedback — please try again." };
  }

  // Best-effort notification — feedback is already durably saved above
  // regardless of whether this succeeds, so a missing/misconfigured
  // provider (or address) never blocks the person's feedback from
  // being recorded.
  const notifyAddress = process.env.FEEDBACK_TO_ADDRESS;
  if (notifyAddress) {
    const provider = getEmailProvider();
    await provider
      .send({
        to: notifyAddress,
        subject: "New beta feedback — SplitFairway",
        text: `From: ${user.email ?? user.id}\nPage: ${pagePath}\nTrip: ${tripId ?? "(none)"}\n\n${message}`,
        html: `<p><strong>From:</strong> ${user.email ?? user.id}<br/><strong>Page:</strong> ${pagePath}<br/><strong>Trip:</strong> ${tripId ?? "(none)"}</p><p>${message.replace(/\n/g, "<br/>")}</p>`,
      })
      .catch(() => {
        // Notification is a courtesy, not the record of truth — the
        // beta_feedback row above already exists either way.
      });
  }

  return { status: "success", message: "Thanks — your feedback was sent to the team." };
}
