"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { golfProfileSchema } from "@/lib/validation/golf";
import type { ActionState } from "@/actions/auth";

/**
 * Manual "Enter information manually" path for the Golf Profile section.
 * Always writes handicap_source = 'manual' — the GHIN-screenshot-import
 * path (phase 3) is the only other writer of this table and is
 * responsible for setting handicap_source = 'ghin_screenshot_import'
 * itself, only after the golfer has reviewed and confirmed every
 * extracted value. See supabase/migrations/20260903000000_golf_profiles.sql
 * for how handicap_updated_at and handicap_history are kept in sync
 * server-side regardless of which path wrote here.
 */
export async function updateGolfProfileAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = golfProfileSchema.safeParse({
    ghinNumber: formData.get("ghinNumber"),
    handicapIndex: formData.get("handicapIndex"),
    handicapRevisionDate: formData.get("handicapRevisionDate"),
    homeClub: formData.get("homeClub"),
    golfAssociation: formData.get("golfAssociation"),
    preferredTee: formData.get("preferredTee"),
    dominantHand: formData.get("dominantHand"),
  });

  if (!parsed.success) {
    return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { status: "error", message: "You need to be signed in to update your golf profile." };
  }

  const { ghinNumber, handicapIndex, handicapRevisionDate, homeClub, golfAssociation, preferredTee, dominantHand } =
    parsed.data;

  const { error } = await supabase.from("golf_profiles").upsert(
    {
      user_id: user.id,
      ghin_number: ghinNumber || null,
      handicap_index: handicapIndex ? Number(handicapIndex) : null,
      handicap_revision_date: handicapRevisionDate || null,
      handicap_source: "manual",
      home_club: homeClub || null,
      golf_association: golfAssociation || null,
      preferred_tee: preferredTee || null,
      dominant_hand: dominantHand || null,
    },
    { onConflict: "user_id" },
  );

  if (error) {
    return {
      status: "error",
      message: "Something went wrong saving your golf profile. Please try again.",
    };
  }

  revalidatePath("/account");
  return { status: "success", message: "Golf profile updated." };
}

/**
 * "Remove GHIN number" — clears only the GHIN number itself. Leaves
 * handicap_index and everything else untouched, since a golfer can
 * still track a manual handicap with no GHIN number on file (the
 * "manual handicap option for golfers without GHIN" requirement).
 */
// Both params are required by useActionState's signature; this action
// takes no input from the form itself.
/* eslint-disable @typescript-eslint/no-unused-vars */
export async function removeGhinNumberAction(
  _prevState: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  /* eslint-enable @typescript-eslint/no-unused-vars */
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { status: "error", message: "You need to be signed in to do that." };
  }

  const { error } = await supabase
    .from("golf_profiles")
    .update({ ghin_number: null })
    .eq("user_id", user.id);

  if (error) {
    return { status: "error", message: "Couldn't remove your GHIN number. Please try again." };
  }

  revalidatePath("/account");
  return { status: "success", message: "GHIN number removed." };
}
