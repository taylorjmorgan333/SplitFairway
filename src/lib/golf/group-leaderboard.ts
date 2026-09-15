import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { computePlayerTotals, computePlayerStableford, type HoleSpec, type PlayerScoreInput } from "@/lib/golf/scoring";
import { computeSkins } from "@/lib/golf/skins";
import { segmentHoleNumbers } from "@/lib/golf/nassau";
import { computeSkinsSettlement, computeNassauSettlement, dollarsToCents, type NassauBetSpec } from "@/lib/golf/settlement";
import { resolveCurrentSeason, isDateInSeason, type GroupSeason } from "@/lib/golf/group-seasons";

export interface GroupLeaderboardEntry {
  userId: string;
  displayName: string;
  roundsPlayed: number;
  grossAvg: number;
  netAvg: number;
  wins: number;
  skinsWon: number;
  stablefordPoints: number;
  earningsCents: number;
}

/** Which optional columns have any real data behind them across this leaderboard, so the UI only renders stats this group actually has -- never a column of zeros. */
export interface GroupLeaderboardAvailability {
  stableford: boolean;
  skins: boolean;
  earnings: boolean;
}

export interface GroupLeaderboardResult {
  season: GroupSeason;
  entries: GroupLeaderboardEntry[];
  availability: GroupLeaderboardAvailability;
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

const NASSAU_BETS: NassauBetSpec[] = [
  { key: "front", label: "Front", holeNumbers: [] },
  { key: "back", label: "Back", holeNumbers: [] },
  { key: "overall", label: "Overall", holeNumbers: [] },
];

/**
 * Aggregates a golf group's standings across every completed round
 * linked to it (trips.golf_group_id), one row per *registered* golfer
 * (user_id not null), scoped to a season's date range. Every number
 * here comes from the exact same per-round compute functions the round
 * Results/Games pages already use (computePlayerTotals, computeSkins,
 * computeMatchStatus, the settlement.ts money math) -- nothing is
 * re-derived or estimated, and a round only counts once every one of
 * its holes has a recorded score for a player (never a partial round
 * counted as if it were final).
 *
 * Guests (no user_id) are excluded from this cross-round summary for
 * the same reason documented in Phase 1: a guest gets a brand-new
 * trip_members row on every hidden trip a Group/Quick Round creates,
 * so there is no stable id to aggregate their rounds across. They
 * still appear correctly on each round's own results.
 */
export async function loadGroupLeaderboard(
  supabase: SupabaseClient<Database>,
  groupId: string,
  options?: { seasonId?: string | null; allTime?: boolean },
): Promise<GroupLeaderboardResult> {
  const { data: seasonRows } = await supabase
    .from("golf_group_seasons")
    .select("id, name, start_date, end_date, created_at")
    .eq("group_id", groupId)
    .order("start_date", { ascending: false });
  const seasons = seasonRows ?? [];

  let season: GroupSeason;
  if (options?.allTime) {
    season = { id: null, name: "All-time", startDate: "0001-01-01", endDate: "9999-12-31" };
  } else if (options?.seasonId) {
    const match = seasons.find((s) => s.id === options.seasonId);
    season = match
      ? { id: match.id, name: match.name, startDate: match.start_date, endDate: match.end_date }
      : resolveCurrentSeason(seasons);
  } else {
    season = resolveCurrentSeason(seasons);
  }

  const empty: GroupLeaderboardResult = {
    season,
    entries: [],
    availability: { stableford: false, skins: false, earnings: false },
  };

  const { data: tripRows } = await supabase.from("trips").select("id").eq("golf_group_id", groupId);
  const tripIds = (tripRows ?? []).map((t) => t.id);
  if (tripIds.length === 0) return empty;

  const { data: roundRows } = await supabase
    .from("rounds")
    .select("id, round_date, hole_count")
    .in("trip_id", tripIds)
    .in("status", ["completed", "locked"]);
  const roundsInSeason = (roundRows ?? []).filter((r) => isDateInSeason(r.round_date, season));
  const roundIds = roundsInSeason.map((r) => r.id);
  if (roundIds.length === 0) return empty;
  const holeCountByRound = new Map(roundsInSeason.map((r) => [r.id, r.hole_count]));

  const [{ data: snapshotRows }, { data: roundPlayerRows }, { data: scoreRows }, { data: sideGameRows }] =
    await Promise.all([
      supabase.from("round_course_snapshots").select("round_id, tee_sets").in("round_id", roundIds),
      supabase
        .from("round_players")
        .select("id, round_id, trip_member_id, tee_set_name, playing_handicap")
        .in("round_id", roundIds),
      supabase.from("hole_scores").select("round_player_id, hole_number, gross_strokes").in("round_id", roundIds),
      supabase
        .from("side_games")
        .select("id, round_id, game_type, scoring_metric, carryover, is_monetary, dollar_value")
        .in("round_id", roundIds),
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

  // One PlayerScoreInput per round_player, keyed by id -- built once,
  // reused for every stat below (standings, skins, Nassau/match play,
  // Stableford) instead of re-deriving it per game.
  type RoundPlayerRow = { id: string; round_id: string; trip_member_id: string; tee_set_name: string | null; playing_handicap: number | null };
  const inputByRoundPlayer = new Map<string, PlayerScoreInput>();
  const roundPlayersByRound = new Map<string, RoundPlayerRow[]>();
  for (const rp of (roundPlayerRows ?? []) as RoundPlayerRow[]) {
    const holes = holesForTee(teeSetsByRound.get(rp.round_id) ?? [], rp.tee_set_name);
    inputByRoundPlayer.set(rp.id, {
      roundPlayerId: rp.id,
      playingHandicap: rp.playing_handicap,
      holes,
      grossByHole: grossByRoundPlayer.get(rp.id) ?? new Map(),
    });
    const list = roundPlayersByRound.get(rp.round_id) ?? [];
    list.push(rp);
    roundPlayersByRound.set(rp.round_id, list);
  }

  interface Acc {
    displayName: string;
    rounds: number;
    grossSum: number;
    netSum: number;
    wins: number;
    skins: number;
    points: number;
    earningsCents: number;
  }
  const acc = new Map<string, Acc>();
  const bump = (userId: string, displayName: string, patch: Partial<Omit<Acc, "displayName">>) => {
    const existing = acc.get(userId) ?? {
      displayName,
      rounds: 0,
      grossSum: 0,
      netSum: 0,
      wins: 0,
      skins: 0,
      points: 0,
      earningsCents: 0,
    };
    for (const [k, v] of Object.entries(patch)) {
      (existing as unknown as Record<string, number>)[k] += v as number;
    }
    acc.set(userId, existing);
  };

  let anyStableford = false;
  let anySkins = false;
  let anyEarnings = false;

  // ---- Per-round standings: rounds played, gross/net averages, wins.
  // "Completed" here means every hole in the round has a score for
  // this player -- a golfer who left after 9 of an 18-hole round never
  // counts toward these averages, per "do not count incomplete rounds
  // as final results." ----
  for (const [roundId, players] of roundPlayersByRound) {
    const holeCount = holeCountByRound.get(roundId) ?? 0;
    const finished: { userId: string; displayName: string; gross: number; net: number }[] = [];
    for (const rp of players) {
      const member = memberById.get(rp.trip_member_id);
      if (!member?.user_id) continue;
      const input = inputByRoundPlayer.get(rp.id);
      if (!input) continue;
      const totals = computePlayerTotals(input);
      if (totals.total.holesCompleted !== holeCount || totals.total.gross == null || totals.total.net == null) continue;
      finished.push({ userId: member.user_id, displayName: member.display_name, gross: totals.total.gross, net: totals.total.net });
    }
    if (finished.length === 0) continue;
    const bestNet = Math.min(...finished.map((f) => f.net));
    for (const f of finished) {
      bump(f.userId, f.displayName, {
        rounds: 1,
        grossSum: f.gross,
        netSum: f.net,
        wins: f.net === bestNet ? 1 : 0,
      });
    }
  }

  // ---- Side games: skins, Stableford points, and monetary Nassau /
  // match play / skins earnings -- each via the exact function that
  // round's own Games page already uses. ----
  const sideGameIds = (sideGameRows ?? []).map((g) => g.id);
  const { data: participantRows } = sideGameIds.length
    ? await supabase
        .from("side_game_participants")
        .select("side_game_id, round_player_id, side")
        .in("side_game_id", sideGameIds)
    : { data: [] as { side_game_id: string; round_player_id: string; side: number | null }[] };
  const participantsByGame = new Map<string, { round_player_id: string; side: number | null }[]>();
  for (const p of participantRows ?? []) {
    const list = participantsByGame.get(p.side_game_id) ?? [];
    list.push(p);
    participantsByGame.set(p.side_game_id, list);
  }

  const userAndNameForRoundPlayer = (roundPlayerId: string): { userId: string; displayName: string } | null => {
    const rp = (roundPlayerRows ?? []).find((r) => r.id === roundPlayerId);
    if (!rp) return null;
    const member = memberById.get(rp.trip_member_id);
    if (!member?.user_id) return null;
    return { userId: member.user_id, displayName: member.display_name };
  };

  for (const game of sideGameRows ?? []) {
    const participants = participantsByGame.get(game.id) ?? [];
    const holeCount = holeCountByRound.get(game.round_id) ?? 18;
    const metric = (game.scoring_metric as "gross" | "net" | null) ?? "net";

    if (game.game_type === "skins") {
      anySkins = true;
      const players = participants
        .map((p) => inputByRoundPlayer.get(p.round_player_id))
        .filter((p): p is PlayerScoreInput => !!p);
      if (players.length === 0) continue;
      const result = computeSkins(players, Array.from({ length: holeCount }, (_, i) => i + 1), metric, game.carryover ?? false);
      for (const [roundPlayerId, skins] of result.totalsByPlayer) {
        if (skins === 0) continue;
        const who = userAndNameForRoundPlayer(roundPlayerId);
        if (!who) continue;
        bump(who.userId, who.displayName, { skins });
      }
      if (game.is_monetary && game.dollar_value != null && participants.length > 0) {
        anyEarnings = true;
        const settlement = computeSkinsSettlement(result, participants.map((p) => p.round_player_id), dollarsToCents(game.dollar_value));
        for (const [roundPlayerId, cents] of settlement.netByPlayer) {
          const who = userAndNameForRoundPlayer(roundPlayerId);
          if (!who) continue;
          bump(who.userId, who.displayName, { earningsCents: cents });
        }
      }
      continue;
    }

    if (game.game_type === "stableford") {
      anyStableford = true;
      for (const p of participants) {
        const input = inputByRoundPlayer.get(p.round_player_id);
        const who = userAndNameForRoundPlayer(p.round_player_id);
        if (!input || !who) continue;
        bump(who.userId, who.displayName, { points: computePlayerStableford(input) });
      }
      continue;
    }

    if ((game.game_type === "nassau" || game.game_type === "match_play") && game.is_monetary && game.dollar_value != null) {
      anyEarnings = true;
      const side1Ids = participants.filter((p) => p.side === 1).map((p) => p.round_player_id);
      const side2Ids = participants.filter((p) => p.side === 2).map((p) => p.round_player_id);
      const side1Players = side1Ids.map((id) => inputByRoundPlayer.get(id)).filter((p): p is PlayerScoreInput => !!p);
      const side2Players = side2Ids.map((id) => inputByRoundPlayer.get(id)).filter((p): p is PlayerScoreInput => !!p);
      if (side1Players.length === 0 || side2Players.length === 0) continue;
      const bets = NASSAU_BETS.map((b) => ({ ...b, holeNumbers: segmentHoleNumbers(b.key as "front" | "back" | "overall", holeCount) }));
      const settlement = computeNassauSettlement(side1Players, side2Players, side1Ids, side2Ids, bets, metric, dollarsToCents(game.dollar_value));
      if (!settlement.fullyDecided) continue; // don't book partial/in-progress bets as final winnings
      for (const [roundPlayerId, cents] of settlement.netByPlayer) {
        const who = userAndNameForRoundPlayer(roundPlayerId);
        if (!who) continue;
        bump(who.userId, who.displayName, { earningsCents: cents });
      }
    }
  }

  const entries: GroupLeaderboardEntry[] = [...acc.entries()]
    .filter(([, v]) => v.rounds > 0)
    .map(([userId, v]) => ({
      userId,
      displayName: v.displayName,
      roundsPlayed: v.rounds,
      grossAvg: Math.round((v.grossSum / v.rounds) * 10) / 10,
      netAvg: Math.round((v.netSum / v.rounds) * 10) / 10,
      wins: v.wins,
      skinsWon: v.skins,
      stablefordPoints: v.points,
      earningsCents: v.earningsCents,
    }))
    .sort((a, b) => a.netAvg - b.netAvg);

  return {
    season,
    entries,
    availability: { stableford: anyStableford, skins: anySkins, earnings: anyEarnings },
  };
}
