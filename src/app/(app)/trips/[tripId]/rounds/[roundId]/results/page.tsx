import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GOLF_SCORING_ENABLED } from "@/lib/config";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { computeStandings, computePlayerTotals, type PlayerScoreInput, type StandingsMetric, type HoleSpec } from "@/lib/golf/scoring";
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
  formatCents,
  formatSignedCents,
  type NassauBetSpec,
} from "@/lib/golf/settlement";
import type { SnapshotTeeSet } from "@/components/rounds/mobile-scorecard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Results" };

const SEGMENT_LABEL: Record<Segment, string> = { front: "Front 9", back: "Back 9", overall: "Overall" };
const METRIC_LABEL: Record<StandingsMetric, string> = { gross: "Gross", net: "Net", stableford: "Points" };

function segmentEndHole(segment: Segment, holeCount: number): number {
  if (segment === "front") return 9;
  return holeCount;
}

export default async function ResultsPage({
  params,
}: {
  params: Promise<{ tripId: string; roundId: string }>;
}) {
  if (!GOLF_SCORING_ENABLED) {
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

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl">{round.name || "Results"}</h1>
        <ButtonLink href={`/trips/${tripId}/rounds/${roundId}`} variant="ghost" size="sm">
          Details
        </ButtonLink>
      </div>

      {round.status !== "locked" && round.status !== "completed" && (
        <p className="mb-4 rounded-lg bg-cream-100 px-3.5 py-2.5 text-xs text-charcoal-500">
          This round isn&apos;t locked yet — scores (and everything below) can still change. Lock it
          from the scorecard once everyone&apos;s done.
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Final standings</CardTitle>
          <CardDescription>Net score — each golfer&apos;s own playing handicap applied.</CardDescription>
        </CardHeader>
        <CardContent>
          {standings.length === 0 ? (
            <p className="text-sm text-charcoal-400">No scores entered yet.</p>
          ) : (
            <ul className="divide-y divide-charcoal-400/10">
              {standings.map((s) => {
                const totals = totalsById.get(s.roundPlayerId);
                return (
                  <li key={s.roundPlayerId} className="flex items-center justify-between py-2.5">
                    <div className="flex items-center gap-3">
                      <span className="w-6 text-sm font-medium text-charcoal-400">{s.rank}</span>
                      <div>
                        <p className="text-sm font-medium text-charcoal-800">
                          {displayNameById.get(s.roundPlayerId) ?? "Golfer"}
                        </p>
                        <p className="text-xs text-charcoal-400">
                          thru {s.thru}
                          {totals?.front.gross != null && totals?.back.gross != null
                            ? ` · gross ${totals.front.gross + totals.back.gross}`
                            : ""}
                        </p>
                      </div>
                    </div>
                    <span className="font-serif text-lg text-forest-900">{s.value}</span>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-3 text-xs text-charcoal-400">{METRIC_LABEL.net} shown here — Gross and Points are on the live leaderboard.</p>
        </CardContent>
      </Card>

      {hasAnyMonetaryGame && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Round settlement</CardTitle>
            <CardDescription>
              Net across every monetary game below. This is what the numbers say — SplitFairway doesn&apos;t
              process or move any money; golfers settle up between themselves.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {roundNetEntries.length === 0 ? (
              <p className="text-sm text-charcoal-400">Nothing settled yet — games are still in progress.</p>
            ) : (
              <ul className="divide-y divide-charcoal-400/10">
                {roundNetEntries.map(([roundPlayerId, cents]) => (
                  <li key={roundPlayerId} className="flex items-center justify-between py-2.5 text-sm">
                    <span className="font-medium text-charcoal-800">{displayNameById.get(roundPlayerId) ?? "Golfer"}</span>
                    <span className={cents > 0 ? "font-medium text-emerald-700" : "font-medium text-red-700"}>
                      {formatSignedCents(cents)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {nassauSections.map((game) => (
        <Card className="mt-6" key={game.id}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{game.name}</CardTitle>
              <Badge variant="gold">{formatCents(dollarsToCents(game.dollarValue))}/bet</Badge>
            </div>
            <CardDescription>
              {game.side1Names.join(" & ") || "Side 1"} vs {game.side2Names.join(" & ") || "Side 2"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <ul className="space-y-1.5">
              {game.settlement.bets.map((bet) => (
                <li key={bet.key} className="flex items-center justify-between text-sm text-charcoal-700">
                  <span>{bet.label}</span>
                  <span className="text-charcoal-500">
                    {bet.outcome === "undecided" && "Not decided yet"}
                    {bet.outcome === "push" && "Push — no money changes hands"}
                    {bet.outcome === "side1" && `${game.side1Names.join(" & ")} win ${formatCents(bet.amountCents!)}`}
                    {bet.outcome === "side2" && `${game.side2Names.join(" & ")} win ${formatCents(bet.amountCents!)}`}
                  </span>
                </li>
              ))}
            </ul>
            {!game.settlement.fullyDecided && (
              <p className="text-xs text-charcoal-400">Some bets are still in progress and aren&apos;t reflected in the total yet.</p>
            )}
          </CardContent>
        </Card>
      ))}

      {skinsSections.map((game) => (
        <Card className="mt-6" key={game.id}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{game.name}</CardTitle>
              <Badge variant="gold">{formatCents(dollarsToCents(game.dollarValue))}/skin</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {game.settlement.holes.length === 0 ? (
              <p className="text-sm text-charcoal-400">No skins settled yet.</p>
            ) : (
              <ul className="space-y-1.5">
                {game.settlement.holes.map((h) => (
                  <li key={h.holeNumber} className="flex items-center justify-between text-sm text-charcoal-700">
                    <span>Hole {h.holeNumber}</span>
                    <span className="text-charcoal-500">
                      {displayNameById.get(h.winnerRoundPlayerId) ?? "Golfer"} wins {formatCents(h.amountCents)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {game.settlement.pendingCents > 0 && (
              <p className="text-xs text-charcoal-400">
                {formatCents(game.settlement.pendingCents)} still riding on tied holes not yet resolved — not
                included above.
              </p>
            )}
          </CardContent>
        </Card>
      ))}

      {wolfSections.map((game) => (
        <Card className="mt-6" key={game.id}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{game.name}</CardTitle>
              <Badge variant="gold">{formatCents(dollarsToCents(game.dollarValue))}/hole</Badge>
            </div>
            <CardDescription>{game.orderNames.join(" → ")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {game.settlement.holes.every((h) => h.outcome == null) ? (
              <p className="text-sm text-charcoal-400">No holes decided yet.</p>
            ) : (
              <ul className="space-y-1.5">
                {game.settlement.holes
                  .filter((h) => h.outcome != null)
                  .map((h) => {
                    const wolfName = h.wolfRoundPlayerId ? (displayNameById.get(h.wolfRoundPlayerId) ?? "Golfer") : "Wolf";
                    const partnerName = h.partnerRoundPlayerId ? (displayNameById.get(h.partnerRoundPlayerId) ?? "Golfer") : null;
                    const wolfSideLabel = partnerName ? `${wolfName} & ${partnerName}` : wolfName;
                    return (
                      <li key={h.holeNumber} className="flex items-center justify-between text-sm text-charcoal-700">
                        <span>Hole {h.holeNumber}</span>
                        <span className="text-charcoal-500">
                          {h.outcome === "halved"
                            ? "Halved"
                            : h.outcome === "wolfSide"
                              ? `${wolfSideLabel} win ${formatCents(h.amountCents!)}`
                              : `${wolfSideLabel} lose ${formatCents(h.amountCents!)}`}
                        </span>
                      </li>
                    );
                  })}
              </ul>
            )}
            {game.settlement.holesDecided < game.settlement.holesTotal && (
              <p className="text-xs text-charcoal-400">
                {game.settlement.holesTotal - game.settlement.holesDecided} hole(s) not decided yet — not reflected above.
              </p>
            )}
          </CardContent>
        </Card>
      ))}

      {vegasSections.map((game) => (
        <Card className="mt-6" key={game.id}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{game.name}</CardTitle>
              <Badge variant="gold">{formatCents(dollarsToCents(game.dollarValue))}/point</Badge>
            </div>
            <CardDescription>
              {game.side1Names.join(" & ") || "Team 1"} vs {game.side2Names.join(" & ") || "Team 2"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {game.settlement.holes.length === 0 ? (
              <p className="text-sm text-charcoal-400">No holes settled yet.</p>
            ) : (
              <ul className="space-y-1.5">
                {game.settlement.holes.map((h) => (
                  <li key={h.holeNumber} className="flex items-center justify-between text-sm text-charcoal-700">
                    <span>Hole {h.holeNumber}</span>
                    <span className="text-charcoal-500">
                      {h.winner == null || h.winner === "halved" || h.amountCents === 0
                        ? "Halved"
                        : `Team ${h.winner} wins ${formatCents(h.amountCents)}`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ))}

      {quotaSections.map((game) => (
        <Card className="mt-6" key={game.id}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{game.name}</CardTitle>
              <Badge variant="gold">{formatCents(dollarsToCents(game.dollarValue))} ante</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {!game.settlement.fullyDecided ? (
              <p className="text-sm text-charcoal-400">
                Not settled yet — every golfer needs to finish all their holes.
              </p>
            ) : game.settlement.players.every((p) => !p.beatQuota) ? (
              <p className="text-sm text-charcoal-400">
                No one beat their quota — the pot is returned, nothing changes hands.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {game.settlement.players
                  .filter((p) => p.beatQuota)
                  .map((p) => (
                    <li key={p.roundPlayerId} className="flex items-center justify-between text-sm text-charcoal-700">
                      <span>{displayNameById.get(p.roundPlayerId) ?? "Golfer"}</span>
                      <span className="text-charcoal-500">+{p.differential} pts</span>
                    </li>
                  ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ))}

      {ninesSections.map((game) => (
        <Card className="mt-6" key={game.id}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{game.name}</CardTitle>
              <Badge variant="gold">{formatCents(dollarsToCents(game.dollarValue))}/point</Badge>
            </div>
            <CardDescription>Settled against the 3-point-per-hole average.</CardDescription>
          </CardHeader>
          <CardContent>
            {game.players.length === 0 ? (
              <p className="text-sm text-charcoal-400">No points yet.</p>
            ) : (
              <ul className="space-y-1.5">
                {game.players.map((p) => (
                  <li key={p.roundPlayerId} className="flex items-center justify-between text-sm text-charcoal-700">
                    <span>{p.displayName}</span>
                    <span className={p.netCents > 0 ? "text-emerald-700" : p.netCents < 0 ? "text-red-700" : "text-charcoal-500"}>
                      {formatSignedCents(p.netCents)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ))}

      {twosSections.map((game) => (
        <Card className="mt-6" key={game.id}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{game.name}</CardTitle>
              <Badge variant="gold">{formatCents(dollarsToCents(game.dollarValue))}/two</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {game.settlement.holes.every((h) => h.winnerRoundPlayerIds.length === 0) ? (
              <p className="text-sm text-charcoal-400">No 2s made yet.</p>
            ) : (
              <ul className="space-y-1.5">
                {game.settlement.holes
                  .filter((h) => h.winnerRoundPlayerIds.length > 0)
                  .map((h) => (
                    <li key={h.holeNumber} className="flex items-center justify-between text-sm text-charcoal-700">
                      <span>Hole {h.holeNumber}</span>
                      <span className="text-charcoal-500">
                        {h.winnerRoundPlayerIds.map((id) => displayNameById.get(id) ?? "Golfer").join(" & ")} win{" "}
                        {formatCents(h.amountCents)}
                      </span>
                    </li>
                  ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
