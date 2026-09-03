import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GOLF_SCORING_ENABLED, SIDE_GAMES_ENABLED, MONETARY_GAME_VALUES_ENABLED, LIVE_LEADERBOARD_ENABLED } from "@/lib/config";
import { ButtonLink } from "@/components/ui/button";
import {
  computeMatchStatus,
  segmentHoleNumbers,
  type Segment,
} from "@/lib/golf/nassau";
import { computeSkins } from "@/lib/golf/skins";
import { computeWolfHoles, type WolfHoleResult, type WolfOrderedParticipant } from "@/lib/golf/wolf";
import { computeVegas } from "@/lib/golf/vegas";
import { computeQuota } from "@/lib/golf/quota";
import { computeNines } from "@/lib/golf/nines";
import { computeTwos } from "@/lib/golf/twos";
import { computeStandings } from "@/lib/golf/scoring";
import {
  computeTeamStrokeFormat,
  computeOneGrossOneNet,
  computeTeamAverage,
  computeLowBallHighBall,
  computeLowBallLowTotal,
  computeLowHandicapHighHandicap,
  bestBallFormula,
  worstBallFormula,
  chaChaChaFormula,
} from "@/lib/golf/team-formats";
import type { PlayerScoreInput, HoleSpec } from "@/lib/golf/scoring";
import { SideGamesSection, type NassauGameView, type SkinsGameView } from "@/components/rounds/side-games-section";
import { WolfSection, type WolfGameView, type WolfHoleView } from "@/components/rounds/wolf-section";
import { VegasSection, type VegasGameView } from "@/components/rounds/vegas-section";
import { QuotaSection, type QuotaGameView } from "@/components/rounds/quota-section";
import { NinesSection, type NinesGameView } from "@/components/rounds/nines-section";
import { TwosSection, type TwosGameView } from "@/components/rounds/twos-section";
import { MatchPlaySection, type MatchPlayGameView } from "@/components/rounds/match-play-section";
import {
  StrokePlaySection,
  type StrokePlayGameView,
  type StablefordGameView,
} from "@/components/rounds/stroke-play-section";
import { TeamStrokeGamesSection, type TeamStrokeGameView } from "@/components/rounds/team-stroke-section";
import {
  TeamPrizeGamesSection,
  type TeamAverageGameView,
  type LowBallLowTotalGameView,
  type LowHighHandicapGameView,
  type LowHighBallGameView,
} from "@/components/rounds/team-prize-section";
import { GameTypePicker } from "@/components/rounds/game-type-picker";
import { RoundPhaseTabs } from "@/components/rounds/round-nav";
import type { SnapshotTeeSet } from "@/components/rounds/mobile-scorecard";

function wolfOutcomeLabel(h: WolfHoleResult, nameById: Map<string, string>): string {
  if (!h.wolfRoundPlayerId || h.outcome == null) return "Not decided yet";
  if (h.outcome === "halved") return "Halved";
  const wolfName = nameById.get(h.wolfRoundPlayerId) ?? "Wolf";
  if (h.isLoneWolf) {
    return h.outcome === "wolfSide" ? `${wolfName} wins (lone wolf)` : `${wolfName} loses (lone wolf)`;
  }
  const partnerName = h.partnerRoundPlayerId ? (nameById.get(h.partnerRoundPlayerId) ?? "Partner") : "Partner";
  return h.outcome === "wolfSide" ? `${wolfName} & ${partnerName} win` : `${wolfName} & ${partnerName} lose`;
}

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Games" };

const SEGMENT_LABEL: Record<Segment, string> = { front: "Front 9", back: "Back 9", overall: "Overall" };

function segmentEndHole(segment: Segment, holeCount: number): number {
  if (segment === "front") return 9;
  return holeCount;
}

export default async function GamesPage({
  params,
}: {
  params: Promise<{ tripId: string; roundId: string }>;
}) {
  if (!GOLF_SCORING_ENABLED || !SIDE_GAMES_ENABLED) {
    redirect("/dashboard");
  }

  const { tripId, roundId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const [{ data: round }, { data: snapshot }, { data: myMembership }] = await Promise.all([
    supabase.from("rounds").select("*").eq("id", roundId).maybeSingle(),
    supabase.from("round_course_snapshots").select("*").eq("round_id", roundId).maybeSingle(),
    supabase
      .from("trip_members")
      .select("role, status")
      .eq("trip_id", tripId)
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  if (!round || round.trip_id !== tripId) {
    notFound();
  }

  const isCaptain = myMembership?.role === "captain" && myMembership.status === "active";

  const { data: playerRows } = await supabase
    .from("round_players")
    .select("id, tee_set_name, playing_handicap, trip_members(display_name, user_id)")
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
      userId: member?.user_id ?? null,
    };
  });
  const displayNameById = new Map(players.map((p) => [p.roundPlayerId, p.displayName]));
  const myRoundPlayerId = players.find((p) => p.userId === user.id)?.roundPlayerId ?? null;

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

  const { data: gameRows } = await supabase
    .from("side_games")
    .select("*, side_game_participants(*), side_game_presses(*), side_game_wolf_picks(*)")
    .eq("round_id", roundId)
    .order("created_at", { ascending: true });

  const nassauGames: NassauGameView[] = [];
  const skinsGames: SkinsGameView[] = [];
  const wolfGames: WolfGameView[] = [];
  const vegasGames: VegasGameView[] = [];
  const quotaGames: QuotaGameView[] = [];
  const ninesGames: NinesGameView[] = [];
  const twosGames: TwosGameView[] = [];
  const matchPlayGames: MatchPlayGameView[] = [];
  const strokePlayGames: StrokePlayGameView[] = [];
  const stablefordGames: StablefordGameView[] = [];
  const bestBallGames: TeamStrokeGameView[] = [];
  const worstBallGames: TeamStrokeGameView[] = [];
  const shambleGames: TeamStrokeGameView[] = [];
  const loneRangerGames: TeamStrokeGameView[] = [];
  const chaChaChaGames: TeamStrokeGameView[] = [];
  const oneGrossOneNetGames: TeamStrokeGameView[] = [];
  const teamAverageGames: TeamAverageGameView[] = [];
  const lowBallLowTotalGames: LowBallLowTotalGameView[] = [];
  const lowHighHandicapGames: LowHighHandicapGameView[] = [];
  const lowHighBallGames: LowHighBallGameView[] = [];
  const overallHoleNumbers = segmentHoleNumbers("overall", round.hole_count);

  /** Shared by every two-sided Batch 1 format below (team-formats.ts) -- same side-filtering nassau/vegas already do above, factored once since 11 more game types need it. */
  function sidePlayers(participants: { round_player_id: string; side: number | null }[], side: 1 | 2): PlayerScoreInput[] {
    return participants
      .filter((p) => p.side === side)
      .map((p) => scoreInputById.get(p.round_player_id))
      .filter((p): p is PlayerScoreInput => !!p);
  }
  function sideNames(participants: { round_player_id: string; side: number | null }[], side: 1 | 2): string[] {
    return participants.filter((p) => p.side === side).map((p) => displayNameById.get(p.round_player_id) ?? "Golfer");
  }

  for (const game of gameRows ?? []) {
    const participants = game.side_game_participants ?? [];
    const metric = game.scoring_metric;

    if (game.game_type === "nassau") {
      const side1 = participants.filter((p) => p.side === 1).map((p) => scoreInputById.get(p.round_player_id)).filter((p): p is PlayerScoreInput => !!p);
      const side2 = participants.filter((p) => p.side === 2).map((p) => scoreInputById.get(p.round_player_id)).filter((p): p is PlayerScoreInput => !!p);

      const segments = (["front", "back", "overall"] as Segment[]).map((segment) => {
        const holeNumbers = segmentHoleNumbers(segment, round.hole_count).filter((h) => h <= round.hole_count);
        const status = computeMatchStatus(side1, side2, holeNumbers, metric);
        return { segment, label: `${SEGMENT_LABEL[segment]}: ${status.label}`, clinched: status.clinched };
      });

      const presses = (game.side_game_presses ?? []).map((press) => {
        const segment = press.segment as Segment;
        const end = segmentEndHole(segment, round.hole_count);
        const holeNumbers = Array.from({ length: Math.max(0, end - press.starting_hole + 1) }, (_, i) => press.starting_hole + i);
        const status = computeMatchStatus(side1, side2, holeNumbers, metric);
        return {
          id: press.id,
          label: `Press from hole ${press.starting_hole} (${SEGMENT_LABEL[segment]}): ${status.label}`,
        };
      });

      nassauGames.push({
        id: game.id,
        name: game.name,
        scoringMetric: metric,
        isMonetary: game.is_monetary,
        dollarValue: game.dollar_value,
        side1Names: participants.filter((p) => p.side === 1).map((p) => displayNameById.get(p.round_player_id) ?? "Golfer"),
        side2Names: participants.filter((p) => p.side === 2).map((p) => displayNameById.get(p.round_player_id) ?? "Golfer"),
        participantIds: participants.map((p) => p.round_player_id),
        segments,
        presses,
      });
    } else if (game.game_type === "skins") {
      const gamePlayers = participants.map((p) => scoreInputById.get(p.round_player_id)).filter((p): p is PlayerScoreInput => !!p);
      const result = computeSkins(gamePlayers, overallHoleNumbers, metric, game.carryover);

      const standings = Array.from(result.totalsByPlayer.entries())
        .map(([roundPlayerId, skinsWon]) => ({
          roundPlayerId,
          displayName: displayNameById.get(roundPlayerId) ?? "Golfer",
          skinsWon,
        }))
        .sort((a, b) => b.skinsWon - a.skinsWon);

      skinsGames.push({
        id: game.id,
        name: game.name,
        scoringMetric: metric,
        isMonetary: game.is_monetary,
        dollarValue: game.dollar_value,
        carryover: game.carryover,
        standings,
        holes: result.holes.map((h) => ({
          holeNumber: h.holeNumber,
          winnerName: h.winnerRoundPlayerId ? (displayNameById.get(h.winnerRoundPlayerId) ?? "Golfer") : null,
          skinsWon: h.skinsWon,
          carriedOver: h.carriedOver,
        })),
        pendingPot: result.pendingPot,
      });
    } else if (game.game_type === "wolf") {
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
      const holeResults = computeWolfHoles(order, picks, orderPlayers, overallHoleNumbers, metric);

      const holes: WolfHoleView[] = holeResults.map((h) => ({
        holeNumber: h.holeNumber,
        wolfRoundPlayerId: h.wolfRoundPlayerId,
        wolfName: h.wolfRoundPlayerId ? (displayNameById.get(h.wolfRoundPlayerId) ?? "Golfer") : null,
        partnerName: h.partnerRoundPlayerId ? (displayNameById.get(h.partnerRoundPlayerId) ?? "Golfer") : null,
        isLoneWolf: h.isLoneWolf,
        outcomeLabel: wolfOutcomeLabel(h, displayNameById),
        decided: h.outcome != null,
      }));

      wolfGames.push({
        id: game.id,
        name: game.name,
        scoringMetric: metric,
        isMonetary: game.is_monetary,
        dollarValue: game.dollar_value,
        order: order.map((o) => ({ roundPlayerId: o.roundPlayerId, displayName: displayNameById.get(o.roundPlayerId) ?? "Golfer" })),
        holes,
      });
    } else if (game.game_type === "vegas") {
      const side1Ids = participants.filter((p) => p.side === 1).map((p) => p.round_player_id);
      const side2Ids = participants.filter((p) => p.side === 2).map((p) => p.round_player_id);
      const side1 = side1Ids.map((id) => scoreInputById.get(id)).filter((p): p is PlayerScoreInput => !!p);
      const side2 = side2Ids.map((id) => scoreInputById.get(id)).filter((p): p is PlayerScoreInput => !!p);
      const result = computeVegas(side1, side2, overallHoleNumbers, metric);

      let runningDiff = 0;
      for (const h of result.holes) {
        if (h.winner === 1) runningDiff += h.diff;
        else if (h.winner === 2) runningDiff -= h.diff;
      }
      const runningLabel =
        result.holesPlayed === 0
          ? "Not started"
          : runningDiff === 0
            ? `All square thru ${result.holesPlayed}`
            : `Team ${runningDiff > 0 ? 1 : 2} up ${Math.abs(runningDiff)} pts thru ${result.holesPlayed}`;

      vegasGames.push({
        id: game.id,
        name: game.name,
        scoringMetric: metric,
        isMonetary: game.is_monetary,
        dollarValue: game.dollar_value,
        side1Names: side1Ids.map((id) => displayNameById.get(id) ?? "Golfer"),
        side2Names: side2Ids.map((id) => displayNameById.get(id) ?? "Golfer"),
        holes: result.holes.map((h) => ({
          holeNumber: h.holeNumber,
          side1Number: h.side1Number,
          side2Number: h.side2Number,
          winnerLabel: h.winner == null ? "Not decided yet" : h.winner === "halved" ? "Halved" : `Team ${h.winner} by ${h.diff}`,
        })),
        runningLabel,
      });
    } else if (game.game_type === "quota") {
      const participantIds = participants.map((p) => p.round_player_id);
      const gamePlayers = participantIds.map((id) => scoreInputById.get(id)).filter((p): p is PlayerScoreInput => !!p);
      const results = computeQuota(gamePlayers, overallHoleNumbers);

      quotaGames.push({
        id: game.id,
        name: game.name,
        isMonetary: game.is_monetary,
        dollarValue: game.dollar_value,
        players: results
          .map((r) => ({
            roundPlayerId: r.roundPlayerId,
            displayName: displayNameById.get(r.roundPlayerId) ?? "Golfer",
            target: r.target,
            points: r.points,
            differential: r.differential,
            holesCompleted: r.holesCompleted,
          }))
          .sort((a, b) => b.differential - a.differential),
      });
    } else if (game.game_type === "nines") {
      const participantIds = participants.map((p) => p.round_player_id);
      const gamePlayers = participantIds.map((id) => scoreInputById.get(id)).filter((p): p is PlayerScoreInput => !!p);
      const result = computeNines(gamePlayers, overallHoleNumbers, metric);

      ninesGames.push({
        id: game.id,
        name: game.name,
        scoringMetric: metric,
        isMonetary: game.is_monetary,
        dollarValue: game.dollar_value,
        standings: Array.from(result.totalsByPlayer.entries())
          .map(([roundPlayerId, points]) => ({
            roundPlayerId,
            displayName: displayNameById.get(roundPlayerId) ?? "Golfer",
            points,
          }))
          .sort((a, b) => b.points - a.points),
        holesPlayed: result.holes.length,
      });
    } else if (game.game_type === "twos") {
      const participantIds = participants.map((p) => p.round_player_id);
      const gamePlayers = participantIds.map((id) => scoreInputById.get(id)).filter((p): p is PlayerScoreInput => !!p);
      const result = computeTwos(gamePlayers, overallHoleNumbers, metric);

      twosGames.push({
        id: game.id,
        name: game.name,
        scoringMetric: metric,
        isMonetary: game.is_monetary,
        dollarValue: game.dollar_value,
        standings: Array.from(result.totalsByPlayer.entries())
          .map(([roundPlayerId, twosMade]) => ({
            roundPlayerId,
            displayName: displayNameById.get(roundPlayerId) ?? "Golfer",
            twosMade,
          }))
          .sort((a, b) => b.twosMade - a.twosMade),
        holes: result.holes.map((h) => ({
          holeNumber: h.holeNumber,
          winnerNames: h.winnerRoundPlayerIds.map((id) => displayNameById.get(id) ?? "Golfer"),
        })),
      });
    } else if (game.game_type === "match_play") {
      const side1 = sidePlayers(participants, 1);
      const side2 = sidePlayers(participants, 2);
      const status = computeMatchStatus(side1, side2, overallHoleNumbers, metric);
      const side1Names = sideNames(participants, 1);
      const side2Names = sideNames(participants, 2);

      matchPlayGames.push({
        id: game.id,
        name: game.name,
        scoringMetric: metric,
        isMonetary: game.is_monetary,
        dollarValue: game.dollar_value,
        side1Name: side1Names[0] ?? "Golfer 1",
        side2Name: side2Names[0] ?? "Golfer 2",
        label: status.label,
        clinched: status.clinched,
      });
    } else if (game.game_type === "stroke_play") {
      const participantIds = participants.map((p) => p.round_player_id);
      const gamePlayers = participantIds.map((id) => scoreInputById.get(id)).filter((p): p is PlayerScoreInput => !!p);
      const standings = computeStandings(gamePlayers, metric);

      strokePlayGames.push({
        id: game.id,
        name: game.name,
        scoringMetric: metric,
        isMonetary: game.is_monetary,
        dollarValue: game.dollar_value,
        standings: standings.map((s) => ({
          roundPlayerId: s.roundPlayerId,
          displayName: displayNameById.get(s.roundPlayerId) ?? "Golfer",
          rank: s.rank,
          value: s.value,
          thru: s.thru,
        })),
      });
    } else if (game.game_type === "stableford") {
      const participantIds = participants.map((p) => p.round_player_id);
      const gamePlayers = participantIds.map((id) => scoreInputById.get(id)).filter((p): p is PlayerScoreInput => !!p);
      const standings = computeStandings(gamePlayers, "stableford");

      stablefordGames.push({
        id: game.id,
        name: game.name,
        isMonetary: game.is_monetary,
        dollarValue: game.dollar_value,
        standings: standings.map((s) => ({
          roundPlayerId: s.roundPlayerId,
          displayName: displayNameById.get(s.roundPlayerId) ?? "Golfer",
          rank: s.rank,
          value: s.value,
          thru: s.thru,
        })),
      });
    } else if (
      game.game_type === "best_ball" ||
      game.game_type === "worst_ball" ||
      game.game_type === "shamble" ||
      game.game_type === "lone_ranger" ||
      game.game_type === "cha_cha_cha"
    ) {
      const side1 = sidePlayers(participants, 1);
      const side2 = sidePlayers(participants, 2);
      const formula =
        game.game_type === "worst_ball" ? worstBallFormula : game.game_type === "cha_cha_cha" ? chaChaChaFormula : bestBallFormula;
      const result = computeTeamStrokeFormat(side1, side2, overallHoleNumbers, metric, formula);

      const view: TeamStrokeGameView = {
        id: game.id,
        name: game.name,
        isMonetary: game.is_monetary,
        dollarValue: game.dollar_value,
        side1Names: sideNames(participants, 1),
        side2Names: sideNames(participants, 2),
        holes: result.holes,
        side1Total: result.side1Total,
        side2Total: result.side2Total,
        metricLabel: metric === "net" ? "Net" : "Gross",
      };

      if (game.game_type === "best_ball") bestBallGames.push(view);
      else if (game.game_type === "worst_ball") worstBallGames.push(view);
      else if (game.game_type === "shamble") shambleGames.push(view);
      else if (game.game_type === "lone_ranger") loneRangerGames.push(view);
      else chaChaChaGames.push(view);
    } else if (game.game_type === "one_gross_one_net") {
      const side1 = sidePlayers(participants, 1);
      const side2 = sidePlayers(participants, 2);
      const result = computeOneGrossOneNet(side1, side2, overallHoleNumbers);

      oneGrossOneNetGames.push({
        id: game.id,
        name: game.name,
        isMonetary: game.is_monetary,
        dollarValue: game.dollar_value,
        side1Names: sideNames(participants, 1),
        side2Names: sideNames(participants, 2),
        holes: result.holes,
        side1Total: result.side1Total,
        side2Total: result.side2Total,
        metricLabel: null,
      });
    } else if (game.game_type === "team_average") {
      const side1 = sidePlayers(participants, 1);
      const side2 = sidePlayers(participants, 2);
      const result = computeTeamAverage(side1, side2, metric);

      teamAverageGames.push({
        id: game.id,
        name: game.name,
        scoringMetric: metric,
        isMonetary: game.is_monetary,
        dollarValue: game.dollar_value,
        side1Names: sideNames(participants, 1),
        side2Names: sideNames(participants, 2),
        side1Average: result.side1Average,
        side2Average: result.side2Average,
      });
    } else if (game.game_type === "low_ball_low_total") {
      const side1 = sidePlayers(participants, 1);
      const side2 = sidePlayers(participants, 2);
      const result = computeLowBallLowTotal(side1, side2, metric);

      lowBallLowTotalGames.push({
        id: game.id,
        name: game.name,
        scoringMetric: metric,
        isMonetary: game.is_monetary,
        dollarValue: game.dollar_value,
        side1Names: sideNames(participants, 1),
        side2Names: sideNames(participants, 2),
        lowBallWinnerSide: result.lowBallWinnerSide,
        side1BestIndividual: result.side1BestIndividual,
        side2BestIndividual: result.side2BestIndividual,
        lowTotalWinnerSide: result.lowTotalWinnerSide,
        side1Total: result.side1Total,
        side2Total: result.side2Total,
      });
    } else if (game.game_type === "low_handicap_high_handicap") {
      const side1 = sidePlayers(participants, 1);
      const side2 = sidePlayers(participants, 2);
      const result = computeLowHandicapHighHandicap(side1, side2, metric);

      lowHighHandicapGames.push({
        id: game.id,
        name: game.name,
        scoringMetric: metric,
        isMonetary: game.is_monetary,
        dollarValue: game.dollar_value,
        side1Names: sideNames(participants, 1),
        side2Names: sideNames(participants, 2),
        lowHandicapWinnerSide: result.lowHandicapWinnerSide,
        side1LowHandicapTotal: result.side1LowHandicapTotal,
        side2LowHandicapTotal: result.side2LowHandicapTotal,
        highHandicapWinnerSide: result.highHandicapWinnerSide,
        side1HighHandicapTotal: result.side1HighHandicapTotal,
        side2HighHandicapTotal: result.side2HighHandicapTotal,
      });
    } else if (game.game_type === "low_ball_high_ball") {
      const side1 = sidePlayers(participants, 1);
      const side2 = sidePlayers(participants, 2);
      const result = computeLowBallHighBall(side1, side2, overallHoleNumbers, metric);

      lowHighBallGames.push({
        id: game.id,
        name: game.name,
        scoringMetric: metric,
        isMonetary: game.is_monetary,
        dollarValue: game.dollar_value,
        side1Names: sideNames(participants, 1),
        side2Names: sideNames(participants, 2),
        side1Points: result.side1Points,
        side2Points: result.side2Points,
        holesPlayed: result.holesPlayed,
      });
    }
  }

  const playerOptions = players.map((p) => ({ roundPlayerId: p.roundPlayerId, displayName: p.displayName }));
  const hasAnyGames =
    nassauGames.length > 0 ||
    skinsGames.length > 0 ||
    wolfGames.length > 0 ||
    vegasGames.length > 0 ||
    quotaGames.length > 0 ||
    ninesGames.length > 0 ||
    twosGames.length > 0 ||
    matchPlayGames.length > 0 ||
    strokePlayGames.length > 0 ||
    stablefordGames.length > 0 ||
    bestBallGames.length > 0 ||
    worstBallGames.length > 0 ||
    shambleGames.length > 0 ||
    loneRangerGames.length > 0 ||
    chaChaChaGames.length > 0 ||
    oneGrossOneNetGames.length > 0 ||
    teamAverageGames.length > 0 ||
    lowBallLowTotalGames.length > 0 ||
    lowHighHandicapGames.length > 0 ||
    lowHighBallGames.length > 0;

  return (
    <div className="mx-auto max-w-2xl">
      <RoundPhaseTabs
        tripId={tripId}
        roundId={roundId}
        status={round.status}
        sideGamesEnabled={SIDE_GAMES_ENABLED}
        leaderboardEnabled={LIVE_LEADERBOARD_ENABLED}
      />
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl">Games</h1>
        <ButtonLink href={`/trips/${tripId}/rounds/${roundId}`} variant="ghost" size="sm">
          Details
        </ButtonLink>
      </div>

      <GameTypePicker
        roundId={roundId}
        tripId={tripId}
        isCaptain={isCaptain}
        players={playerOptions}
        monetaryEnabled={MONETARY_GAME_VALUES_ENABLED}
      />

      {!hasAnyGames && (
        <p className="mt-6 text-sm text-charcoal-400">
          No games started yet{isCaptain ? " — pick a format above to get one going." : " for this round."}
        </p>
      )}

      <div className="mt-6 space-y-6">
        <SideGamesSection
          tripId={tripId}
          roundId={roundId}
          isCaptain={isCaptain}
          myRoundPlayerId={myRoundPlayerId}
          players={playerOptions}
          nassauGames={nassauGames}
          skinsGames={skinsGames}
          monetaryEnabled={MONETARY_GAME_VALUES_ENABLED}
        />
        <WolfSection
          tripId={tripId}
          roundId={roundId}
          isCaptain={isCaptain}
          myRoundPlayerId={myRoundPlayerId}
          players={playerOptions}
          games={wolfGames}
          monetaryEnabled={MONETARY_GAME_VALUES_ENABLED}
        />
        <VegasSection
          tripId={tripId}
          roundId={roundId}
          isCaptain={isCaptain}
          players={playerOptions}
          games={vegasGames}
          monetaryEnabled={MONETARY_GAME_VALUES_ENABLED}
        />
        <QuotaSection
          tripId={tripId}
          roundId={roundId}
          isCaptain={isCaptain}
          players={playerOptions}
          games={quotaGames}
          monetaryEnabled={MONETARY_GAME_VALUES_ENABLED}
        />
        <NinesSection
          tripId={tripId}
          roundId={roundId}
          isCaptain={isCaptain}
          players={playerOptions}
          games={ninesGames}
          monetaryEnabled={MONETARY_GAME_VALUES_ENABLED}
        />
        <TwosSection
          tripId={tripId}
          roundId={roundId}
          isCaptain={isCaptain}
          players={playerOptions}
          games={twosGames}
          monetaryEnabled={MONETARY_GAME_VALUES_ENABLED}
        />
        <MatchPlaySection tripId={tripId} roundId={roundId} isCaptain={isCaptain} games={matchPlayGames} />
        <StrokePlaySection
          tripId={tripId}
          roundId={roundId}
          isCaptain={isCaptain}
          strokePlayGames={strokePlayGames}
          stablefordGames={stablefordGames}
        />
        <TeamStrokeGamesSection
          tripId={tripId}
          roundId={roundId}
          isCaptain={isCaptain}
          bestBallGames={bestBallGames}
          worstBallGames={worstBallGames}
          shambleGames={shambleGames}
          loneRangerGames={loneRangerGames}
          chaChaChaGames={chaChaChaGames}
          oneGrossOneNetGames={oneGrossOneNetGames}
        />
        <TeamPrizeGamesSection
          tripId={tripId}
          roundId={roundId}
          isCaptain={isCaptain}
          teamAverageGames={teamAverageGames}
          lowBallLowTotalGames={lowBallLowTotalGames}
          lowHighHandicapGames={lowHighHandicapGames}
          lowHighBallGames={lowHighBallGames}
        />
      </div>
    </div>
  );
}
