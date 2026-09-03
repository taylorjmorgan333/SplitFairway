"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { grossStrokesSchema, holeNumberSchema } from "@/lib/validation/score";

export type SaveScoreResult = { ok: true } | { ok: false; error: string };

/**
 * Saves one golfer's gross score for one hole. Called directly from the
 * mobile scorecard's +/- controls (not through a <form>/useActionState —
 * the live entry UI needs to fire on every tap, not on a page-navigating
 * submit), so it returns a plain result object the client uses to show a
 * synced/unsynced indicator rather than driving useFormStatus.
 *
 * Upsert-by-design: the same (round_player_id, hole_number) pair is
 * always written to the same row (hole_scores_unique_hole), so a
 * duplicate tap or a retried offline save simply overwrites with the
 * same final value instead of creating a second row -- that's what
 * makes this safe to retry without any separate duplicate-submission
 * guard on the server.
 */
export async function saveHoleScoreAction(
  roundId: string,
  roundPlayerId: string,
  holeNumber: number,
  grossStrokes: number | null,
): Promise<SaveScoreResult> {
  const holeParsed = holeNumberSchema.safeParse(holeNumber);
  const grossParsed = grossStrokesSchema.safeParse(grossStrokes);
  if (!holeParsed.success || !grossParsed.success) {
    return { ok: false, error: "Invalid score." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "You need to be signed in." };
  }

  const { error } = await supabase.from("hole_scores").upsert(
    {
      round_id: roundId,
      round_player_id: roundPlayerId,
      hole_number: holeParsed.data,
      gross_strokes: grossParsed.data,
      entered_by: user.id,
    },
    { onConflict: "round_player_id,hole_number" },
  );

  if (error) {
    return { ok: false, error: "Couldn't save that score — you may not have permission to edit it." };
  }

  revalidatePath(`/trips`);
  return { ok: true };
}

/** Organizer starts play -- moves a scheduled round to in_progress. */
export async function startRoundAction(tripId: string, roundId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("rounds").update({ status: "in_progress" }).eq("id", roundId);
  if (error) {
    throw new Error("Couldn't start this round.");
  }
  revalidatePath(`/trips/${tripId}/rounds/${roundId}`);
}

/**
 * Organizer locks a round -- can_edit_round_score() denies every score
 * edit (including the organizer's own) for a locked round from this
 * point on. The client confirms with the golfer before calling this,
 * matching "confirmation before ending/locking a round."
 */
export async function lockRoundAction(tripId: string, roundId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("rounds").update({ status: "locked" }).eq("id", roundId);
  if (error) {
    throw new Error("Couldn't lock this round.");
  }
  revalidatePath(`/trips/${tripId}/rounds/${roundId}`);
}
