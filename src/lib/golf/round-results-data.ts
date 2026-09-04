import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  computeStandings,
  computePlayerTotals,
  type PlayerScoreInput,
  type HoleSpec,
} from "@/lib/golf/scoring";
import { computeSkins } from "@/lib/golf/skins";
import { segmentHoleNumbers, type Segment } from "@/lib/golf/nassau";
import { computeWolfHoles, type WolfOrderedParticipant } from "@/lib/golf/wolf";
import { computeVegas } from "@/lib/golf/vegas";
import { computeQuota } from "@/lib/golf/quota";
import { computeNines } from "@/lib/golf/nines";
import { computeTwos } from "@/lib/golf/twos";
import {
  computeNassauSettlement,
  computeSkinsSettlement,
  computeWolfSettlement,
  computeVegasSettlement,
  computeQuotaSettlement,
  computeNinesSettlement,
  computeTwosSettlement,
  mergeNetMaps,
  dollarsToCents,
  type NassauBetSpec,
} from "@/lib/golf/settlement";
import type { SnapshotTeeSet } from "@/components/rounds/mobile-scorecard";

export const SEGMENT_LABEL: Record<Segment, string> = { front: "Front 9", back: "Back 9", overall: "Overall" };

function segmentEndHole(segment: Segment, holeCount: number): number {
  if (segment === "front") return 9;
  return holeCount;
}

/**
 * Shared data loader for the round's Results and Settle Up pages --
 * both screens need the exact same standings/settlement math computed
 * from the exact same scores, so this is the one place that runs it.
 * The redesign splits the old single Results page into "what
 * happened" (Results: final standings, game outcomes) and "who owes
 * whom" (Settle Up: money only) -- this loader is what keeps that a
 * page split rather than a second parallel implementation.
 */
export async function loadRoundResultsData(tripId: string, roundId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { redirectToLogin: true as const };
  }

  const [{ data: round }, { data: snapshot }] = await Promise.all([
    supabase.from("rounds").select("*").eq("id", roundId).maybeSingle(),
    supabase.from("round_course_snapshots").select("*").eq("round_id", roundId).maybeSingle(),
  ]);

  if (!round || round.trip_id !== tripId) {
    notFound();
  }

  const { data: playerRows } = await supabase
    .from("round_players")
    .select("id, tee_set_name, playing_handicap, trip_members(display_name)")
    .eq("round_id", roundId);

  const rows = playerRows ?? [];
  const roundPlayerIds = rows.map((r) => r.id);

  const { data: scoreRows } =
    roundPlayerIds.length > 0
      ? await supabase
          .from("hole_scores")
          .select("round_player_id, hole_number, gross_strokes")
          .in("round_player_id", roundPlayerIds)
      : { data: [] };

  const teeSets = (snapshot?.tee_sets as SnapshotTeeSet[] | null) ?? [];
  const holesByTeeSet = new Map<string, SnapshotTeeSet["holes"]>();
  for (const ts of teeSets) holesByTeeSet.set(ts.name, ts.holes);

  const players = rows.map((r) => {
    const member = Array.isArray(r.trip_members) ? r.trip_members[0] : r.trip_members;
    return {
      roundPlayerId: r.id,
      displayName: member?.display_name ?? "Unknown golfer",
      teeSetName: r.tee_set_name,
      playingHandicap: r.playing_handicap,
    };
  });
  const displayNameById = new Map(players.map((p) => [p.roundPlayerId, p.displayName]));

  const grossByPlayer = new Map<string, Map<number, number | null>>();
  for (const p of players) {
    const m = new Map<number, number | null>();
    for (let h = 1; h <= round.hole_count; h++) m.set(h, null);
    grossByPlayer.set(p.roundPlayerId, m);
  }
  for (const s of scoreRows ?? []) {
    grossByPlayer.get(s.round_player_id)?.set(s.hole_number, s.gross_strokes);
  }

  const scoreInputById = new Map<string, PlayerScoreInput>(
    players.map((p) => {
      const holes: HoleSpec[] = ((p.teeSetName ? holesByTeeSet.get(p.teeSetName) : undefined) ?? teeSets[0]?.holes ?? []).map(
        (h) => ({ holeNumber: h.hole_number, par: h.par, strokeIndex: h.stroke_index }),
      );
      return [
        p.roundPlayerId,
        {
          roundPlayerId: p.roundPlayerId,
          playingHandicap: p.playingHandicap,
          holes,
          grossByHole: grossByPlayer.get(p.roundPlayerId) ?? new Map(),
        },
      ];
    }),
  );
  const allScoreInputs = [...scoreInputById.values()];

  const { data: gameRows } = await supabase
    .from("side_games")
    .select("*, side_game_participants(*), side_game_presses(*), side_game_wolf_picks(*)")
    .eq("round_id", roundId)
    .order("created_at", { ascending: true });

  const netMaps: Map<string, number>[] = [];
  const overallHoleNumbers = segmentHoleNumbers("overall", round.hole_count);

  const nassauSections = (gameRows ?? [])
    .filter((g) => g.game_type === "nassau" && g.is_monetary && g.dollar_value != null)
    .map((game) => {
      const participants = game.side_game_participants ?? [];
      const side1Ids = participants.filter((p) => p.side === 1).map((p) => p.round_player_id);
      const side2Ids = participants.filter((p) => p.side === 2).map((p) => p.round_player_id);
      const side1 = side1Ids.map((id) => scoreInputById.get(id)).filter((p): p is PlayerScoreInput => !!p);
      const side2 = side2Ids.map((id) => scoreInputById.get(id)).filter((p): p is PlayerScoreInput => !!p);

      const bets: NassauBetSpec[] = (["front", "back", "overall"] as Segment[]).map((segment) => ({
        key: segment,
        label: SEGMENT_LABEL[segment],
        holeNumbers: segmentHoleNumbers(segment, round.hole_count).filter((h) => h <= round.hole_count),
      }));
      for (const press of game.side_game_presses ?? []) {
        const segment = press.segment as Segment;
        const end = segmentEndHole(segment, round.hole_count);
        bets.push({
          key: press.id,
          label: `Press from hole ${press.starting_hole} (${SEGMENT_LABEL[segment]})`,
          holeNumbers: Array.from({ length: Math.max(0, end - press.starting_hole + 1) }, (_, i) => press.starting_hole + i),
        });
      }

      const settlement = computeNassauSettlement(
        side1,
        side2,
        side1Ids,
        side2Ids,
        bets,
        game.scoring_metric,
        dollarsToCents(game.dollar_value!),
      );
      netMaps.push(settlement.netByPlayer);

      return {
        id: game.id,
        name: game.name,
        dollarValue: game.dollar_value!,
        side1Names: side1Ids.map((id) => displayNameById.get(id) ?? "Golfer"),
        side2Names: side2Ids.map((id) => displayNameById.get(id) ?? "Golfer"),
        settlement,
      };
    });

  const skinsSections = (gameRows ?? [])
    .filter((g) => g.game_type === "skins" && g.is_monetary && g.dollar_value != null)
    .map((game) => {
      const participantIds = (game.side_game_participants ?? []).map((p) => p.round_player_id);
      const gamePlayers = participantIds.map((id) => scoreInputById.get(id)).filter((p): p is PlayerScoreInput => !!p);
      const result = computeSkins(gamePlayers, overallHoleNumbers, game.scoring_metric, game.carryover);
      const settlement = computeSkinsSettlement(result, participantIds, dollarsToCents(game.dollar_value!));
      netMaps.push(settlement.netByPlayer);

      return {
        id: game.id,
        name: game.name,
        dollarValue: game.dollar_value!,
        settlement,
      };
    });

  const wolfSections = (gameRows ?? [])
    .filter((g) => g.game_type === "wolf" && g.is_monetary && g.dollar_value != null)
    .map((game) => {
      const participants = game.side_game_participants ?? [];
      const order: WolfOrderedParticipant[] = participants
        .filter((p) => p.wolf_order != null)
        .map((p) => ({ roundPlayerId: p.round_player_id, wolfOrder: p.wolf_order! }))
        .sort((a, b) => a.wolfOrder - b.wolfOrder);
      const orderPlayers = order.map((o) => scoreInputById.get(o.roundPlayerId)).filter((p): p is PlayerScoreInput => !!p);
      const picks = (game.side_game_wolf_picks ?? []).map((pk) => ({
        holeNumber: pk.hole_number,
        partnerRoundPlayerId: pk.partner_round_player_id,
        isLoneWolf: pk.is_lone_wolf,
      }));
      const holeResults = computeWolfHoles(order, picks, orderPlayers, overallHoleNumbers, game.scoring_metric);
      const settlement = computeWolfSettlement(holeResults, order, dollarsToCents(game.dollar_value!));
      netMaps.push(settlement.netByPlayer);

      return {
        id: game.id,
        name: game.name,
        dollarValue: game.dollar_value!,
        orderNames: order.map((o) => displayNameById.get(o.roundPlayerId) ?? "Golfer"),
        settlement,
      };
    });

  const vegasSections = (gameRows ?? [])
    .filter((g) => g.game_type === "vegas" && g.is_monetary && g.dollar_value != null)
    .map((game) => {
      const participants = game.side_game_participants ?? [];
      const side1Ids = participants.filter((p) => p.side === 1).map((p) => p.round_player_id);
      const side2Ids = participants.filter((p) => p.side === 2).map((p) => p.round_player_id);
      const side1 = side1Ids.map((id) => scoreInputById.get(id)).filter((p): p is PlayerScoreInput => !!p);
      const side2 = side2Ids.map((id) => scoreInputById.get(id)).filter((p): p is PlayerScoreInput => !!p);
      const result = computeVegas(side1, side2, overallHoleNumbers, game.scoring_metric);
      const settlement = computeVegasSettlement(result, side1Ids, side2Ids, dollarsToCents(game.dollar_value!));
      netMaps.push(settlement.netByPlayer);

      return {
        id: game.id,
        name: game.name,
        dollarValue: game.dollar_value!,
        side1Names: side1Ids.map((id) => displayNameById.get(id) ?? "Golfer"),
        side2Names: side2Ids.map((id) => displayNameById.get(id) ?? "Golfer"),
        settlement,
      };
    });

  const quotaSections = (gameRows ?? [])
    .filter((g) => g.game_type === "quota" && g.is_monetary && g.dollar_value != null)
    .map((game) => {
      const participantIds = (game.side_game_participants ?? []).map((p) => p.round_player_id);
      const gamePlayers = participantIds.map((id) => scoreInputById.get(id)).filter((p): p is PlayerScoreInput => !!p);
      const results = computeQuota(gamePlayers, overallHoleNumbers);
      const settlement = computeQuotaSettlement(results, overallHoleNumbers.length, dollarsToCents(game.dollar_value!));
      netMaps.push(settlement.netByPlayer);

      return {
        id: game.id,
        name: game.name,
        dollarValue: game.dollar_value!,
        settlement,
      };
    });

  const ninesSections = (gameRows ?? [])
    .filter((g) => g.game_type === "nines" && g.is_monetary && g.dollar_value != null)
    .map((game) => {
      const participantIds = (game.side_game_participants ?? []).map((p) => p.round_player_id);
      const gamePlayers = participantIds.map((id) => scoreInputById.get(id)).filter((p): p is PlayerScoreInput => !!p);
      const result = computeNines(gamePlayers, overallHoleNumbers, game.scoring_metric);
      const settlement = computeNinesSettlement(result, participantIds, dollarsToCents(game.dollar_value!));
      netMaps.push(settlement.netByPlayer);

      return {
        id: game.id,
        name: game.name,
        dollarValue: game.dollar_value!,
        settlement,
        players: participantIds
          .map((id) => ({
            roundPlayerId: id,
            displayName: displayNameById.get(id) ?? "Golfer",
            points: settlement.totalsByPlayer.get(id) ?? 0,
            netCents: settlement.netByPlayer.get(id) ?? 0,
          }))
          .sort((a, b) => b.points - a.points),
      };
    });

  const twosSections = (gameRows ?? [])
    .filter((g) => g.game_type === "twos" && g.is_monetary && g.dollar_value != null)
    .map((game) => {
      const participantIds = (game.side_game_participants ?? []).map((p) => p.round_player_id);
      const gamePlayers = participantIds.map((id) => scoreInputById.get(id)).filter((p): p is PlayerScoreInput => !!p);
      const result = computeTwos(gamePlayers, overallHoleNumbers, game.scoring_metric);
      const settlement = computeTwosSettlement(result, participantIds, dollarsToCents(game.dollar_value!));
      netMaps.push(settlement.netByPlayer);

      return {
        id: game.id,
        name: game.name,
        dollarValue: game.dollar_value!,
        settlement,
      };
    });

  const roundNet = mergeNetMaps(netMaps);
  const roundNetEntries = [...roundNet.entries()]
    .filter(([, cents]) => cents !== 0)
    .sort((a, b) => b[1] - a[1]);

  const standings = computeStandings(allScoreInputs, "net");
  const totalsById = new Map(allScoreInputs.map((p) => [p.roundPlayerId, computePlayerTotals(p)]));
  const hasAnyMonetaryGame =
    nassauSections.length > 0 ||
    skinsSections.length > 0 ||
    wolfSections.length > 0 ||
    vegasSections.length > 0 ||
    quotaSections.length > 0 ||
    ninesSections.length > 0 ||
    twosSections.length > 0;

  return {
    redirectToLogin: false as const,
    round,
    displayNameById,
    standings,
    totalsById,
    hasAnyMonetaryGame,
    roundNetEntries,
    nassauSections,
    skinsSections,
    wolfSections,
    vegasSections,
    quotaSections,
    ninesSections,
    twosSections,
  };
}
