"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  DEFAULT_NINETEENTH_HOLE_COUNTERS,
  counterLabelSchema,
  recordActivitySchema,
  slugifyCounterKey,
  whoCanRecordSchema,
  type WhoCanRecord,
} from "@/lib/validation/nineteenth-hole";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("You need to be signed in.");
  }
  return { supabase, user };
}

/**
 * Captain turns The 19th Hole on for this trip. Upserts the settings
 * row (creating it the very first time) and seeds the six default
 * counters -- but only the ones that don't already exist, so
 * re-enabling after a captain disabled the feature never resets a
 * renamed/deactivated counter back to its original label or state.
 */
export type EnableNineteenthHoleResult = {
  settings: { enabled: true; whoCanRecord: WhoCanRecord };
  counters: {
    id: string;
    key: string;
    label: string;
    isDefault: boolean;
    isActive: boolean;
    sortOrder: number;
  }[];
};

export async function enableNineteenthHoleAction(tripId: string): Promise<EnableNineteenthHoleResult> {
  const { supabase } = await requireUser();

  const { data: settingsRow, error: settingsError } = await supabase
    .from("nineteenth_hole_settings")
    .upsert({ trip_id: tripId, enabled: true }, { onConflict: "trip_id" })
    .select("who_can_record")
    .single();
  if (settingsError || !settingsRow) {
    throw new Error("Couldn't enable The 19th Hole — you may not have permission to.");
  }

  const { data: existing } = await supabase
    .from("nineteenth_hole_counters")
    .select("key")
    .eq("trip_id", tripId);
  const existingKeys = new Set((existing ?? []).map((c) => c.key));

  const toSeed = DEFAULT_NINETEENTH_HOLE_COUNTERS.filter((c) => !existingKeys.has(c.key)).map(
    (c, i) => ({
      trip_id: tripId,
      key: c.key,
      label: c.label,
      is_default: true,
      is_active: true,
      sort_order: i,
    }),
  );
  if (toSeed.length > 0) {
    const { error: seedError } = await supabase.from("nineteenth_hole_counters").insert(toSeed);
    if (seedError) {
      throw new Error("Enabled, but couldn't set up the default counters. Try refreshing.");
    }
  }

  // Read back the trip's full, authoritative counter list (not just the
  // rows this call happened to insert) so the client can replace its
  // local state with real ids instead of guessing at ones this action
  // didn't actually create -- important on a re-enable, where every
  // counter already existed and `toSeed` above is empty.
  const { data: allCounters } = await supabase
    .from("nineteenth_hole_counters")
    .select("*")
    .eq("trip_id", tripId)
    .order("sort_order", { ascending: true });

  revalidatePath(`/trips/${tripId}`);
  return {
    settings: { enabled: true, whoCanRecord: settingsRow.who_can_record as WhoCanRecord },
    counters: (allCounters ?? []).map((c) => ({
      id: c.id,
      key: c.key,
      label: c.label,
      isDefault: c.is_default,
      isActive: c.is_active,
      sortOrder: c.sort_order,
    })),
  };
}

/** Captain turns the feature off. Leaves settings, counters and every
 * activity record in place — re-enabling later picks up right where
 * the trip left off. */
export async function disableNineteenthHoleAction(tripId: string): Promise<void> {
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("nineteenth_hole_settings")
    .update({ enabled: false })
    .eq("trip_id", tripId);
  if (error) {
    throw new Error("Couldn't disable The 19th Hole.");
  }
  revalidatePath(`/trips/${tripId}`);
}

export async function setWhoCanRecordAction(tripId: string, value: WhoCanRecord): Promise<void> {
  const parsed = whoCanRecordSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error("Invalid setting.");
  }
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("nineteenth_hole_settings")
    .update({ who_can_record: parsed.data })
    .eq("trip_id", tripId);
  if (error) {
    throw new Error("Couldn't update who can record activity.");
  }
  revalidatePath(`/trips/${tripId}`);
}

/** Toggles whether a counter (default or custom) shows up on the Quick
 * Add / Standings screens, without touching any activity already
 * recorded against it. */
export async function setCounterActiveAction(
  tripId: string,
  counterId: string,
  isActive: boolean,
): Promise<void> {
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("nineteenth_hole_counters")
    .update({ is_active: isActive })
    .eq("id", counterId)
    .eq("trip_id", tripId);
  if (error) {
    throw new Error("Couldn't update that counter.");
  }
  revalidatePath(`/trips/${tripId}`);
}

/** Renames any counter's display label (default or custom) — its
 * stable `key` never changes, so past activity keeps resolving to it. */
export async function renameCounterAction(
  tripId: string,
  counterId: string,
  label: string,
): Promise<void> {
  const parsed = counterLabelSchema.safeParse(label);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid name.");
  }
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("nineteenth_hole_counters")
    .update({ label: parsed.data })
    .eq("id", counterId)
    .eq("trip_id", tripId);
  if (error) {
    throw new Error("Couldn't rename that counter.");
  }
  revalidatePath(`/trips/${tripId}`);
}

/** Adds a trip-specific counter for an inside joke or challenge. The
 * key is derived from the label and de-duplicated against the trip's
 * existing counters (including default ones) so two similarly-named
 * counters never collide. */
export type AddCustomCounterResult = {
  id: string;
  key: string;
  label: string;
  isDefault: boolean;
  isActive: boolean;
  sortOrder: number;
};

export async function addCustomCounterAction(
  tripId: string,
  label: string,
): Promise<AddCustomCounterResult> {
  const parsed = counterLabelSchema.safeParse(label);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid name.");
  }
  const { supabase, user } = await requireUser();

  const { data: existing } = await supabase
    .from("nineteenth_hole_counters")
    .select("key, sort_order")
    .eq("trip_id", tripId);
  const existingKeys = new Set((existing ?? []).map((c) => c.key));
  const maxSortOrder = (existing ?? []).reduce((max, c) => Math.max(max, c.sort_order), -1);

  const base = slugifyCounterKey(parsed.data);
  let key = base;
  let suffix = 2;
  while (existingKeys.has(key)) {
    key = `${base}_${suffix}`;
    suffix += 1;
  }

  const { data: inserted, error } = await supabase
    .from("nineteenth_hole_counters")
    .insert({
      trip_id: tripId,
      key,
      label: parsed.data,
      is_default: false,
      is_active: true,
      sort_order: maxSortOrder + 1,
      created_by: user.id,
    })
    .select("*")
    .single();
  if (error || !inserted) {
    throw new Error("Couldn't add that counter — you may not have permission to.");
  }
  revalidatePath(`/trips/${tripId}`);
  return {
    id: inserted.id,
    key: inserted.key,
    label: inserted.label,
    isDefault: inserted.is_default,
    isActive: inserted.is_active,
    sortOrder: inserted.sort_order,
  };
}

/** Removes a custom counter entirely (its activity history goes with
 * it via ON DELETE CASCADE). Default counters can only be deactivated,
 * never removed — enforced by RLS (nineteenth_hole_counters_delete_captain),
 * so a captain who somehow targets one gets a clear error instead of a
 * silent no-op. */
export async function removeCustomCounterAction(tripId: string, counterId: string): Promise<void> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("nineteenth_hole_counters")
    .delete()
    .eq("id", counterId)
    .eq("trip_id", tripId)
    .select("id");
  if (error || !data || data.length === 0) {
    throw new Error("Couldn't remove that counter — default counters can only be turned off, not removed.");
  }
  revalidatePath(`/trips/${tripId}`);
}

export type RecordActivityResult =
  | { ok: true; activity: { id: string; createdAt: string } }
  | { ok: false; error: string };

/**
 * Records one +1/-1 tap. Called directly from the Quick Add screen
 * (not a <form>/useActionState — every tap needs to fire immediately
 * with optimistic UI, not a page-navigating submit), so it returns a
 * plain result object the same way saveHoleScoreAction does for score
 * entry, rather than throwing.
 */
export async function recordNineteenthHoleActivityAction(
  tripId: string,
  input: { tripMemberId: string; counterId: string; roundId: string | null; quantity: 1 | -1 },
): Promise<RecordActivityResult> {
  const parsed = recordActivitySchema.safeParse({
    tripMemberId: input.tripMemberId,
    counterId: input.counterId,
    roundId: input.roundId ?? "",
    quantity: input.quantity,
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid entry." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "You need to be signed in." };
  }

  const { data, error } = await supabase
    .from("nineteenth_hole_activity")
    .insert({
      trip_id: tripId,
      round_id: parsed.data.roundId || null,
      trip_member_id: parsed.data.tripMemberId,
      counter_id: parsed.data.counterId,
      quantity: parsed.data.quantity,
      recorded_by: user.id,
    })
    .select("id, created_at")
    .single();

  if (error || !data) {
    return { ok: false, error: "Couldn't save that — you may not have permission to record activity on this trip." };
  }

  revalidatePath(`/trips/${tripId}`);
  return { ok: true, activity: { id: data.id, createdAt: data.created_at } };
}

/**
 * Soft-deletes one activity entry — used for both "Undo" (the golfer's
 * own most-recent tap, no confirmation) and "correct" from the Activity
 * list (captain on anyone's entry, or a golfer on their own, with
 * confirmation). RLS (nineteenth_hole_activity_update_own_or_captain)
 * is what actually enforces who's allowed; this just turns a denied
 * update into a friendly message instead of a silent no-op.
 */
export async function correctNineteenthHoleActivityAction(
  tripId: string,
  activityId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("nineteenth_hole_activity")
    .update({ deleted_at: new Date().toISOString(), deleted_by: user.id })
    .eq("id", activityId)
    .eq("trip_id", tripId)
    .is("deleted_at", null)
    .select("id");

  if (error || !data || data.length === 0) {
    return { ok: false, error: "Couldn't remove that entry — you can only correct your own, unless you're the captain." };
  }
  revalidatePath(`/trips/${tripId}`);
  return { ok: true };
}
