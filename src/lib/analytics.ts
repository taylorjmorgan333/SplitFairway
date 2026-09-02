import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/database.types";

/**
 * Basic, first-party product analytics — no third-party script, no
 * cookies, no IP/user-agent/device fingerprinting. Records that a
 * signed-in user did a named thing, with a small caller-controlled
 * JSON payload, into analytics_events (insert-only from the app; read
 * via the Supabase dashboard). Best-effort: a failure here never blocks
 * or fails the action it's attached to, since analytics is a courtesy,
 * not a requirement.
 *
 * Call this from Server Actions after the real mutation succeeds —
 * never as a substitute for activity_log, which is the trip-facing
 * audit trail (see src/actions/*.ts).
 */
export async function trackEvent(
  supabase: SupabaseClient<Database>,
  userId: string,
  eventName: string,
  properties: Record<string, Json> = {},
  tripId?: string | null,
) {
  try {
    await supabase.from("analytics_events").insert({
      user_id: userId,
      trip_id: tripId ?? null,
      event_name: eventName,
      properties,
    });
  } catch {
    // Analytics must never break the feature it's attached to.
  }
}
