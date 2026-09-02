"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createTripSchema, updateTripSchema } from "@/lib/validation/trip";
import { trackEvent } from "@/lib/analytics";
import type { ActionState } from "@/actions/auth";

export async function createTripAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = createTripSchema.safeParse({
    name: formData.get("name"),
    destination: formData.get("destination"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    description: formData.get("description"),
  });

  if (!parsed.success) {
    return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_trip", {
    p_name: parsed.data.name,
    p_destination: parsed.data.destination || undefined,
    p_start_date: parsed.data.startDate || undefined,
    p_end_date: parsed.data.endDate || undefined,
    p_currency: "USD",
    p_description: parsed.data.description || undefined,
  });

  if (error || !data) {
    return { status: "error", message: error?.message ?? "Could not create the trip." };
  }

  // owner_id is set to the caller by create_trip() itself — reusing it
  // here avoids a second auth round-trip just for analytics.
  if (data.owner_id) {
    await trackEvent(supabase, data.owner_id, "trip_created", {}, data.id);
  }

  revalidatePath("/dashboard");
  redirect(`/trips/${data.id}`);
}

export async function updateTripAction(
  tripId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = updateTripSchema.safeParse({
    name: formData.get("name"),
    destination: formData.get("destination"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    description: formData.get("description"),
    status: formData.get("status"),
  });

  if (!parsed.success) {
    return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // RLS (trips_update_captain) enforces that only an active captain of
  // this trip can succeed here — there is no separate authorization
  // check to forget in the UI layer.
  const { error } = await supabase
    .from("trips")
    .update({
      name: parsed.data.name,
      destination: parsed.data.destination || null,
      start_date: parsed.data.startDate || null,
      end_date: parsed.data.endDate || null,
      description: parsed.data.description || null,
      status: parsed.data.status,
    })
    .eq("id", tripId);

  if (error) {
    return { status: "error", message: error.message };
  }

  // Trip settings aren't a financial record, but they're still worth an
  // audit trail entry — the same convention every other mutation in
  // this app follows (see activity_log in the RPCs).
  if (user) {
    await supabase.from("activity_log").insert({
      trip_id: tripId,
      actor_user_id: user.id,
      event_type: "trip_updated",
      event_data: { name: parsed.data.name, status: parsed.data.status },
    });
  }

  revalidatePath(`/trips/${tripId}`);
  revalidatePath("/dashboard");
  return { status: "success", message: "Trip updated." };
}

export async function setTripArchivedAction(tripId: string, archived: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("trips")
    .update({ status: archived ? "cancelled" : "planning" })
    .eq("id", tripId);

  if (error) {
    throw new Error(error.message);
  }

  if (user) {
    await supabase.from("activity_log").insert({
      trip_id: tripId,
      actor_user_id: user.id,
      event_type: archived ? "trip_archived" : "trip_restored",
      event_data: {},
    });
  }

  revalidatePath(`/trips/${tripId}`);
  revalidatePath("/dashboard");
}

export async function deleteTripAction(tripId: string) {
  const supabase = await createClient();
  // RLS (trips_delete_captain) enforces captain-only here too.
  const { error } = await supabase.from("trips").delete().eq("id", tripId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/dashboard");
  redirect("/dashboard");
}
