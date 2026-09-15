import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { computeStandings, type PlayerScoreInput, type HoleSpec, type StandingsEntry } from "@/lib/golf/scoring";
import { computeSkins } from "@/lib/golf/skins";
import { segmentHoleNumbers } from "@/lib/golf/nassau";
import { computeSkinsSettlement, computeNassauSettlement, dollarsToCents, type NassauBetSpec } from "@/lib/golf/settlement";

export interface RecapLeaderboardEntry extends StandingsEntry {
  displayName: string;
}

export interface RecapSkinsLine {
  displayName: string;
  skins: number;
}

export interface RecapMoneyLine {
  displayName: string;
  cents: number;
}

export interface RecapGameSummary {
  id: string;
  name: string;
  gameType: string;
  /** Only set for the formats this recap computes money for directly (skins/nassau/match_play) -- every other type still shows in "otherGames" below, just without a money line here (see the doc comment on loadRoundRecap). */
  moneyLines: RecapMoneyLine[];
}

export interface RoundRecap {
  isFinal: boolean;
  courseName: string;
  grossLeaderboard: RecapLeaderboardEntry[];
  netLeaderboard: RecapLeaderboardEntry[];
  skinsLines: RecapSkinsLine[];
  gameSummaries: RecapGameSummary[];
  otherGameNames: string[];
}

const NASSAU_BETS: NassauBetSpec[] = [
  { key: "front", label: "Front", holeNumbers: [] },
  { key: "back", label: "Back", holeNumbers: [] },
  { key: "overall", label: "Overall", holeNumbers: [] },
];

/**
 * Post-round Group Recap data (spec item 7): gross/net leaderboard,
 * skins in the exact "Name — N skins" shape the spec names, and money
 * results. Computes skins/Nassau/match play itself (same functions as
 * every other page: computeSkins, computeNassauSettlement,
 * settlement.ts) rather than reusing round-results-data.ts's loader,
 * because that loader's game sections are monetary-only and skins
 * counts need to show up whether or not the game was for money. Every
 * other game type still appears (by name, in otherGameNames) with a
 * link to the round's own Games/Results pages for its full detail --
 * fully replicating all ~20 game engines' result displays a second
 * time here was judged out of scope for this phase (see the Phase 2
 * report's deferred list).
 */
export async function loadRoundRecap(
  supabase: SupabaseClient<Database>,
  roundId: string,
): Promise<RoundRecap | null> {
  const { data: round } = await supabase.from("rounds").select("id, hole_count, status").eq("id", roundId).maybeSingle();
  if (!round) return null;

  const [{ data: snapshot }, { data: playerRows }] = await Promise.all([
    supabase.from("round_course_snapshots").select("course_name, tee_sets").eq("round_id", roundId).maybeSingle(),
    supabase
      .from("round_players")
      .select("id, tee_set_name, playing_handicap, trip_members(display_name)")
      .eq("round_id", roundId),
  ]);

  const players = (playerRows ?? []).map((r) => {
    const member = Array.isArray(r.trip_members) ? r.trip_members[0] : r.trip_members;
    return {
      roundPlayerId: r.id,
      displayName: member?.display_name ?? "Golfer",
      teeSetName: r.tee_set_name,
      playingHandicap: r.playing_handicap,
    };
  });
  const displayNameById = new Map(players.map((p) => [p.roundPlayerId, p.displayName]));
  const roundPlayerIds = players.map((p) => p.roundPlayerId);

  const { data: scoreRows } = roundPlayerIds.length
    ? await supabase.from("hole_scores").select("round_player_id, hole_number, gross_strokes").in("round_player_id", roundPlayerIds)
    : { data: [] as { round_player_id: string; hole_number: number; gross_strokes: number | null }[] };

  const grossByPlayer = new Map<string, Map<number, number | null>>();
  for (const s of scoreRows ?? []) {
    const map = grossByPlayer.get(s.round_player_id) ?? new Map<number, number | null>();
    map.set(s.hole_number, s.gross_strokes);
    grossByPlayer.set(s.round_player_id, map);
  }

  type TeeSetJson = { name: string; holes: { hole_number: number; par: number; yardage: number | null; stroke_index: number | null }[] };
  const teeSets = ((snapshot?.tee_sets as unknown as TeeSetJson[] | null) ?? []);
  const holesForTee = (teeSetName: string | null): HoleSpec[] => {
    const match = (teeSetName && teeSets.find((t) => t.name === teeSetName)) || teeSets[0];
    if (!match) return [];
    return match.holes.map((h) => ({ holeNumber: h.hole_number, par: h.par, strokeIndex: h.stroke_index }));
  };

  const inputs: PlayerScoreInput[] = players.map((p) => ({
    roundPlayerId: p.roundPlayerId,
    playingHandicap: p.playingHandicap,
    holes: holesForTee(p.teeSetName),
    grossByHole: grossByPlayer.get(p.roundPlayerId) ?? new Map(),
  }));

  const isFinal =
    round.status === "locked" &&
    inputs.length > 0 &&
    inputs.every((p) => [...p.grossByHole.values()].filter((v) => v != null).length === round.hole_count);

  const withNames = (entries: StandingsEntry[]): RecapLeaderboardEntry[] =>
    entries.map((e) => ({ ...e, displayName: displayNameById.get(e.roundPlayerId) ?? "Golfer" }));

  const grossLeaderboard = withNames(computeStandings(inputs, "gross"));
  const netLeaderboard = withNames(computeStandings(inputs, "net"));

  const { data: gameRows } = await supabase
    .from("side_games")
    .select("id, game_type, name, scoring_metric, carryover, is_monetary, dollar_value, side_game_participants(round_player_id, side)")
    .eq("round_id", roundId);

  const skinsTotals = new Map<string, number>();
  const gameSummaries: RecapGameSummary[] = [];
  const otherGameNames: string[] = [];

  for (const game of gameRows ?? []) {
    const participants = game.side_game_participants ?? [];
    const metric = (game.scoring_metric as "gross" | "net" | null) ?? "net";

    if (game.game_type === "skins") {
      const gamePlayers = participants
        .map((p) => inputs.find((i) => i.roundPlayerId === p.round_player_id))
        .filter((p): p is PlayerScoreInput => !!p);
      if (gamePlayers.length > 0) {
        const result = computeSkins(gamePlayers, segmentHoleNumbers("overall", round.hole_count), metric, game.carryover ?? false);
        for (const [rpId, skins] of result.totalsByPlayer) {
          skinsTotals.set(rpId, (skinsTotals.get(rpId) ?? 0) + skins);
        }
        const moneyLines: RecapMoneyLine[] =
          game.is_monetary && game.dollar_value != null
            ? [...computeSkinsSettlement(result, participants.map((p) => p.round_player_id), dollarsToCents(game.dollar_value)).netByPlayer]
                .map(([rpId, cents]) => ({ displayName: displayNameById.get(rpId) ?? "Golfer", cents }))
            : [];
        gameSummaries.push({ id: game.id, name: game.name, gameType: game.game_type, moneyLines });
      }
      continue;
    }

    if (game.game_type === "nassau" || game.game_type === "match_play") {
      const side1Ids = participants.filter((p) => p.side === 1).map((p) => p.round_player_id);
      const side2Ids = participants.filter((p) => p.side === 2).map((p) => p.round_player_id);
      const side1 = side1Ids.map((id) => inputs.find((i) => i.roundPlayerId === id)).filter((p): p is PlayerScoreInput => !!p);
      const side2 = side2Ids.map((id) => inputs.find((i) => i.roundPlayerId === id)).filter((p): p is PlayerScoreInput => !!p);
      let moneyLines: RecapMoneyLine[] = [];
      if (side1.length > 0 && side2.length > 0 && game.is_monetary && game.dollar_value != null) {
        const bets = NASSAU_BETS.map((b) => ({ ...b, holeNumbers: segmentHoleNumbers(b.key as "front" | "back" | "overall", round.hole_count) }));
        const settlement = computeNassauSettlement(side1, side2, side1Ids, side2Ids, bets, metric, dollarsToCents(game.dollar_value));
        if (settlement.fullyDecided) {
          moneyLines = [...settlement.netByPlayer].map(([rpId, cents]) => ({ displayName: displayNameById.get(rpId) ?? "Golfer", cents }));
        }
      }
      gameSummaries.push({ id: game.id, name: game.name, gameType: game.game_type, moneyLines });
      continue;
    }

    otherGameNames.push(game.name);
  }

  const skinsLines: RecapSkinsLine[] = [...skinsTotals.entries()]
    .filter(([, skins]) => skins > 0)
    .map(([rpId, skins]) => ({ displayName: displayNameById.get(rpId) ?? "Golfer", skins }))
    .sort((a, b) => b.skins - a.skins);

  return {
    isFinal,
    courseName: snapshot?.course_name ?? "Course",
    grossLeaderboard,
    netLeaderboard,
    skinsLines,
    gameSummaries,
    otherGameNames,
  };
}
