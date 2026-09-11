import type { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import type {
  NineteenthHoleActivityEntry,
  NineteenthHoleCounter,
  NineteenthHoleRound,
  NineteenthHoleSettings,
} from "@/components/nineteenth-hole/types";
import type { WhoCanRecord } from "@/lib/validation/nineteenth-hole";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export type NineteenthHoleTripData = {
  settings: NineteenthHoleSettings | null;
  counters: NineteenthHoleCounter[];
  activity: NineteenthHoleActivityEntry[];
  rounds: NineteenthHoleRound[];
};

/**
 * Everything the trip-level "19th Hole" tab and the round-scoped
 * "/rounds/[roundId]/nineteenth-hole" page both need -- pulled into one
 * place so the two entry points (see <persisted UX spec>: it has to
 * appear both alongside Scorecard/Games on a round AND as its own trip
 * tab) fetch and shape this identically instead of drifting apart.
 * Caller is responsible for checking NINETEENTH_HOLE_ENABLED first.
 */
export async function loadNineteenthHoleTripData(
  supabase: SupabaseServerClient,
  tripId: string,
): Promise<NineteenthHoleTripData> {
  const [{ data: settingsRow }, { data: counterRows }, { data: activityRows }, { data: roundRows }] =
    await Promise.all([
      supabase.from("nineteenth_hole_settings").select("*").eq("trip_id", tripId).maybeSingle(),
      supabase.from("nineteenth_hole_counters").select("*").eq("trip_id", tripId),
      supabase
        .from("nineteenth_hole_activity")
        .select("*")
        .eq("trip_id", tripId)
        .order("created_at", { ascending: false })
        .limit(500),
      supabase
        .from("rounds")
        .select("id, name, round_date")
        .eq("trip_id", tripId)
        .order("round_date", { ascending: true }),
    ]);

  return {
    settings: settingsRow
      ? { enabled: settingsRow.enabled, whoCanRecord: settingsRow.who_can_record as WhoCanRecord }
      : null,
    counters: (counterRows ?? []).map((c) => ({
      id: c.id,
      key: c.key,
      label: c.label,
      isDefault: c.is_default,
      isActive: c.is_active,
      sortOrder: c.sort_order,
    })),
    activity: (activityRows ?? []).map((a) => ({
      id: a.id,
      tripMemberId: a.trip_member_id,
      counterId: a.counter_id,
      roundId: a.round_id,
      quantity: a.quantity as 1 | -1,
      recordedBy: a.recorded_by,
      createdAt: a.created_at,
      deletedAt: a.deleted_at,
    })),
    rounds: (roundRows ?? []).map((r) => ({
      id: r.id,
      label: r.name || formatDate(r.round_date),
    })),
  };
}

/** user_id -> display_name, for showing "who recorded" in the Activity
 * list without a second round-trip per row. */
export function buildRecorderNameByUserId(
  memberRows: { user_id: string | null; display_name: string }[],
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const m of memberRows) {
    if (m.user_id) map[m.user_id] = m.display_name;
  }
  return map;
}
