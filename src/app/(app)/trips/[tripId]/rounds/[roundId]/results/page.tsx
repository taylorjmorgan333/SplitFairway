import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { GOLF_SCORING_ENABLED, SIDE_GAMES_ENABLED, LIVE_LEADERBOARD_ENABLED } from "@/lib/config";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { RoundPhaseTabs } from "@/components/rounds/round-nav";
import { loadRoundResultsData } from "@/lib/golf/round-results-data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Results" };

/**
 * "What happened" -- final standings and (soon) per-game outcomes.
 * "Who owes whom" now lives on its own Settle Up screen
 * (`round-results-data.ts` computes both from one shared loader so
 * this split never re-derives the settlement math a second time).
 */
export default async function ResultsPage({
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
  const { round, standings, totalsById, displayNameById, hasAnyMonetaryGame } = data;

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
        <h1 className="text-xl">{round.name || "Results"}</h1>
        <ButtonLink href={`/trips/${tripId}/rounds/${roundId}`} variant="ghost" size="sm">
          Details
        </ButtonLink>
      </div>

      {round.status !== "locked" && round.status !== "completed" && (
        <p className="mb-4 rounded-lg bg-cream-100 px-3.5 py-2.5 text-base text-charcoal-500">
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
            <p className="text-base text-charcoal-400">No scores entered yet.</p>
          ) : (
            <ul className="divide-y divide-charcoal-400/10">
              {standings.map((s) => {
                const totals = totalsById.get(s.roundPlayerId);
                return (
                  <li key={s.roundPlayerId} className="flex items-center justify-between py-2.5">
                    <div className="flex items-center gap-3">
                      <span className="w-6 text-base font-medium text-charcoal-400">{s.rank}</span>
                      <div>
                        <p className="text-base font-medium text-charcoal-800">
                          {displayNameById.get(s.roundPlayerId) ?? "Golfer"}
                        </p>
                        <p className="text-sm text-charcoal-400">
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
          <p className="mt-3 text-sm text-charcoal-400">
            Net shown here — Gross and Points are on the leaderboard.
          </p>
        </CardContent>
      </Card>

      {hasAnyMonetaryGame && (
        <div className="mt-6">
          <ButtonLink href={`/trips/${tripId}/rounds/${roundId}/settle`} size="lg" className="flex w-full justify-center">
            See Settle Up
          </ButtonLink>
        </div>
      )}
    </div>
  );
}
