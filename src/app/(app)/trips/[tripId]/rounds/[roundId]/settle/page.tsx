import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { GOLF_SCORING_ENABLED, SIDE_GAMES_ENABLED, LIVE_LEADERBOARD_ENABLED } from "@/lib/config";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { RoundPhaseTabs } from "@/components/rounds/round-nav";
import { loadRoundResultsData } from "@/lib/golf/round-results-data";
import { formatCents, formatSignedCents, dollarsToCents } from "@/lib/golf/settlement";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Settle Up" };

/**
 * "Who owes whom" -- split out of the old combined Results page so a
 * golfer who just wants final standings never has to scroll past a
 * wall of per-game money breakdowns, and a golfer settling up never
 * has to hunt for it inside "Results." Shares its math with the
 * Results page via loadRoundResultsData -- no second settlement
 * implementation.
 */
export default async function SettleUpPage({
  params,
}: {
  params: Promise<{ tripId: string; roundId: string }>;
}) {
  if (!GOLF_SCORING_ENABLED) {
    redirect("/dashboard");
  }

  const { tripId, roundId } = await params;
  const data = await loadRoundResultsData(tripId, roundId);
  if (data.redirectToLogin) {
    redirect("/login");
  }
  const {
    round,
    displayNameById,
    hasAnyMonetaryGame,
    roundNetEntries,
    nassauSections,
    skinsSections,
    wolfSections,
    vegasSections,
    quotaSections,
    ninesSections,
    twosSections,
  } = data;

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
        <h1 className="text-xl">Settle Up</h1>
        <ButtonLink href={`/trips/${tripId}/rounds/${roundId}/results`} variant="ghost" size="sm">
          Results
        </ButtonLink>
      </div>

      {!hasAnyMonetaryGame ? (
        <Card>
          <CardContent className="space-y-3 p-5 text-center sm:p-6">
            <p className="text-base text-charcoal-600">
              No money games in this round, so there&apos;s nothing to settle up.
            </p>
            <ButtonLink href={`/trips/${tripId}/rounds/${roundId}/results`} variant="outline" size="md">
              Back to Results
            </ButtonLink>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Round total</CardTitle>
              <CardDescription>
                Net across every money game below. SplitFairway doesn&apos;t process or move any money —
                golfers settle up between themselves.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {roundNetEntries.length === 0 ? (
                <p className="text-base text-charcoal-400">Nothing settled yet — games are still in progress.</p>
              ) : (
                <ul className="divide-y divide-charcoal-400/10">
                  {roundNetEntries.map(([roundPlayerId, cents]) => (
                    <li key={roundPlayerId} className="flex items-center justify-between py-2.5 text-base">
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
                    <li key={bet.key} className="flex items-center justify-between text-base text-charcoal-700">
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
                  <p className="text-sm text-charcoal-400">Some bets are still in progress and aren&apos;t reflected in the total yet.</p>
                )}
              </CardContent>
            </Card>
          ))}

          {skinsSections.map((game) => (
            <Card className="mt-6" key={game.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{game.name}</CardTitle>
                  <Badge variant="gold">{formatCents(dollarsToCents(game.dollarValue))} ante</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {game.settlement.holes.length === 0 ? (
                  <p className="text-base text-charcoal-400">No skins settled yet.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {game.settlement.holes.map((h) => (
                      <li key={h.holeNumber} className="flex items-center justify-between text-base text-charcoal-700">
                        <span>Hole {h.holeNumber}</span>
                        <span className="text-charcoal-500">
                          {displayNameById.get(h.winnerRoundPlayerId) ?? "Golfer"} wins {formatCents(h.amountCents)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="text-sm text-charcoal-400">
                  {formatCents(game.settlement.potCents)} pot
                  {game.settlement.skinsAwarded > 0
                    ? ` splits across ${game.settlement.skinsAwarded} skin${game.settlement.skinsAwarded === 1 ? "" : "s"}. A golfer with no skins loses exactly their ante — never more.`
                    : " — not yet split, no skins decided."}
                </p>
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
                  <p className="text-base text-charcoal-400">No holes decided yet.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {game.settlement.holes
                      .filter((h) => h.outcome != null)
                      .map((h) => {
                        const wolfName = h.wolfRoundPlayerId ? (displayNameById.get(h.wolfRoundPlayerId) ?? "Golfer") : "Wolf";
                        const partnerName = h.partnerRoundPlayerId ? (displayNameById.get(h.partnerRoundPlayerId) ?? "Golfer") : null;
                        const wolfSideLabel = partnerName ? `${wolfName} & ${partnerName}` : wolfName;
                        return (
                          <li key={h.holeNumber} className="flex items-center justify-between text-base text-charcoal-700">
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
                  <p className="text-sm text-charcoal-400">
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
                  <p className="text-base text-charcoal-400">No holes settled yet.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {game.settlement.holes.map((h) => (
                      <li key={h.holeNumber} className="flex items-center justify-between text-base text-charcoal-700">
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
                  <p className="text-base text-charcoal-400">
                    Not settled yet — every golfer needs to finish all their holes.
                  </p>
                ) : game.settlement.players.every((p) => !p.beatQuota) ? (
                  <p className="text-base text-charcoal-400">
                    No one beat their quota — the pot is returned, nothing changes hands.
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {game.settlement.players
                      .filter((p) => p.beatQuota)
                      .map((p) => (
                        <li key={p.roundPlayerId} className="flex items-center justify-between text-base text-charcoal-700">
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
                  <p className="text-base text-charcoal-400">No points yet.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {game.players.map((p) => (
                      <li key={p.roundPlayerId} className="flex items-center justify-between text-base text-charcoal-700">
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
                  <p className="text-base text-charcoal-400">No 2s made yet.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {game.settlement.holes
                      .filter((h) => h.winnerRoundPlayerIds.length > 0)
                      .map((h) => (
                        <li key={h.holeNumber} className="flex items-center justify-between text-base text-charcoal-700">
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
        </>
      )}
    </div>
  );
}
