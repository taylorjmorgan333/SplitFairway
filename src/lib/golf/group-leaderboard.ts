import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { computePlayerTotals, type HoleSpec, type PlayerScoreInput } from "@/lib/golf/scoring";

export interface GroupLeaderboardEntry {
  userId: string;
  displayName: string;
  roundsPlayed: number;
  totalToPar: number;
  avgToPar: number;
}

interface TeeSetJson {
  name: string;
  holes: { hole_number: number; par: number; yardage: number | null; stroke_index: number | null }[];
}

function holesForTee(teeSets: TeeSetJson[], teeSetName: string | null): HoleSpec[] {
  const match = (teeSetName && teeSets.find((t) => t.name === teeSetName)) || teeSets[0];
  if (!match) return [];
  return match.holes.map((h) => ({
    holeNumber: h.hole_number,
    par: h.par,
    strokeIndex: h.stroke_index,
  }));
}

/**
 * Aggregates gross-strokes-relative-to-par across every completed round
 * linked to a golf group (trips.golf_group_id), one row per *registered*
 * golfer (user_id not null). Reuses computePlayerTotals() — the exact
 * same per-round scoring function the round Results/leaderboard pages
 * use — for every round rather than re-deriving totals, so this can
 * never disagree with a round's own results about what someone shot.
 *
 * Guests (no user_id) are deliberately excluded here: a guest gets a
 * brand-new trip_members row on every hidden trip a Group Round creates
 * (see start_group_round_trip), so there is no stable id to aggregate
 * their rounds across — they still show up correctly on each round's
 * own results/leaderboard, just not on this cross-round summary.
 */
export async function loadGroupLeaderboard(
  supabase: SupabaseClient<Database>,
  groupId: string,
): Promise<GroupLeaderboardEntry[]> {
  const { data: tripRows } = await supabase.from("trips").select("id").eq("golf_group_id", groupId);
  const tripIds = (tripRows ?? []).map((t) => t.id);
  if (tripIds.length === 0) return [];

  const { data: roundRows } = await supabase
    .from("rounds")
    .select("id")
    .in("trip_id", tripIds)
    .in("status", ["completed", "locked"]);
  const roundIds = (roundRows ?? []).map((r) => r.id);
  if (roundIds.length === 0) return [];

  const [{ data: snapshotRows }, { data: roundPlayerRows }, { data: scoreRows }] = await Promise.all([
    supabase.from("round_course_snapshots").select("round_id, tee_sets").in("round_id", roundIds),
    supabase
      .from("round_players")
      .select("id, round_id, trip_member_id, tee_set_name, playing_handicap")
      .in("round_id", roundIds),
    supabase.from("hole_scores").select("round_player_id, hole_number, gross_strokes").in("round_id", roundIds),
  ]);

  const teeSetsByRound = new Map<string, TeeSetJson[]>();
  for (const s of snapshotRows ?? []) {
    teeSetsByRound.set(s.round_id, (s.tee_sets as unknown as TeeSetJson[] | null) ?? []);
  }

  const tripMemberIds = [...new Set((roundPlayerRows ?? []).map((p) => p.trip_member_id))];
  const { data: memberRows } = tripMemberIds.length
    ? await supabase.from("trip_members").select("id, user_id, display_name").in("id", tripMemberIds)
    : { data: [] as { id: string; user_id: string | null; display_name: string }[] };
  const memberById = new Map((memberRows ?? []).map((m) => [m.id, m]));

  const grossByRoundPlayer = new Map<string, Map<number, number | null>>();
  for (const s of scoreRows ?? []) {
    const map = grossByRoundPlayer.get(s.round_player_id) ?? new Map<number, number | null>();
    map.set(s.hole_number, s.gross_strokes);
    grossByRoundPlayer.set(s.round_player_id, map);
  }

  const totalsByUser = new Map<string, { displayName: string; rounds: number; toPar: number }>();

  for (const rp of roundPlayerRows ?? []) {
    const member = memberById.get(rp.trip_member_id);
    if (!member?.user_id) continue; // guests excluded, see doc comment above

    const holes = holesForTee(teeSetsByRound.get(rp.round_id) ?? [], rp.tee_set_name);
    if (holes.length === 0) continue;

    const input: PlayerScoreInput = {
      roundPlayerId: rp.id,
      playingHandicap: rp.playing_handicap,
      holes,
      grossByHole: grossByRoundPlayer.get(rp.id) ?? new Map(),
    };
    const totals = computePlayerTotals(input);
    if (totals.total.gross == null || totals.total.holesCompleted === 0) continue;

    const toPar = totals.total.gross - totals.total.par;
    const existing = totalsByUser.get(member.user_id);
    if (existing) {
      existing.rounds += 1;
      existing.toPar += toPar;
    } else {
      totalsByUser.set(member.user_id, { displayName: member.display_name, rounds: 1, toPar });
    }
  }

  return [...totalsByUser.entries()]
    .map(([userId, v]) => ({
      userId,
      displayName: v.displayName,
      roundsPlayed: v.rounds,
      totalToPar: v.toPar,
      avgToPar: Math.round((v.toPar / v.rounds) * 10) / 10,
    }))
    .sort((a, b) => a.avgToPar - b.avgToPar);
}
