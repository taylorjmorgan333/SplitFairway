import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GOLF_SCORING_ENABLED, NINETEENTH_HOLE_ENABLED } from "@/lib/config";
import { loadRoundRecap } from "@/lib/golf/round-recap";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { formatToPar } from "@/lib/golf/scoring";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Group Recap" };

function formatMoney(cents: number): string {
  const dollars = Math.abs(cents) / 100;
  const amount = dollars.toLocaleString("en-US", { minimumFractionDigits: dollars % 1 === 0 ? 0 : 2 });
  return cents >= 0 ? `+$${amount}` : `-$${amount}`;
}

/**
 * Concise post-round summary for a group-linked round (spec item 7),
 * shown right after "Review & Finish" locks the round. Never claims a
 * round is final until it actually is -- loadRoundRecap's isFinal check
 * mirrors the same "every required score entered, round locked" rule
 * used everywhere else scores are treated as done.
 */
export default async function GroupRecapPage({
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

  const { data: trip } = await supabase.from("trips").select("id, golf_group_id").eq("id", tripId).maybeSingle();
  if (!trip) {
    notFound();
  }

  const recap = await loadRoundRecap(supabase, roundId);
  if (!recap) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-2xl pb-10">
      <h1 className="text-2xl">Round Recap</h1>
      <p className="mt-1 text-base text-charcoal-500">{recap.courseName}</p>

      {!recap.isFinal && (
        <div className="mt-4 rounded-lg bg-cream-100 px-3.5 py-2.5 text-base text-charcoal-500">
          This round isn&apos;t fully scored and locked yet, so these results may still change.
        </div>
      )}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Leaderboard</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-charcoal-400">Net</p>
            <ul className="divide-y divide-cream-200">
              {recap.netLeaderboard.map((e) => (
                <li key={e.roundPlayerId} className="flex items-center justify-between py-2 text-base">
                  <span className="text-charcoal-800">
                    {e.rank}. {e.displayName}
                  </span>
                  <span className="font-medium text-forest-900">{formatToPar(e.toPar)}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-charcoal-400">Gross</p>
            <ul className="divide-y divide-cream-200">
              {recap.grossLeaderboard.map((e) => (
                <li key={e.roundPlayerId} className="flex items-center justify-between py-2 text-base">
                  <span className="text-charcoal-800">
                    {e.rank}. {e.displayName}
                  </span>
                  <span className="font-medium text-forest-900">{formatToPar(e.toPar)}</span>
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>

      {recap.skinsLines.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Skins</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5 text-base text-charcoal-800">
              {recap.skinsLines.map((line) => (
                <li key={line.displayName}>
                  {line.displayName} — {line.skins} {line.skins === 1 ? "skin" : "skins"}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {recap.gameSummaries.map((game) => (
        <Card key={game.id} className="mt-6">
          <CardHeader>
            <CardTitle>{game.name}</CardTitle>
          </CardHeader>
          <CardContent>
            {game.moneyLines.length > 0 ? (
              <ul className="space-y-1.5 text-base text-charcoal-800">
                {game.moneyLines
                  .filter((l) => l.cents !== 0)
                  .map((l) => (
                    <li key={l.displayName} className="flex justify-between">
                      <span>{l.displayName}</span>
                      <span className={l.cents >= 0 ? "text-forest-700" : "text-red-700"}>{formatMoney(l.cents)}</span>
                    </li>
                  ))}
              </ul>
            ) : (
              <p className="text-sm text-charcoal-500">Not a money game -- see full results on the Games tab.</p>
            )}
          </CardContent>
        </Card>
      ))}

      {recap.otherGameNames.length > 0 && (
        <Card className="mt-6">
          <CardContent className="p-5">
            <p className="text-sm text-charcoal-500">
              Also played: {recap.otherGameNames.join(", ")}. See the full breakdown on the round&apos;s
              Games page.
            </p>
            <ButtonLink href={`/trips/${tripId}/rounds/${roundId}/games`} variant="ghost" size="sm" className="mt-2">
              View games
            </ButtonLink>
          </CardContent>
        </Card>
      )}

      {NINETEENTH_HOLE_ENABLED && (
        <Card className="mt-6">
          <CardContent className="p-5">
            <p className="text-sm text-charcoal-500">Got 19th Hole results for this round?</p>
            <ButtonLink href={`/trips/${tripId}/rounds/${roundId}/nineteenth-hole`} variant="ghost" size="sm" className="mt-2">
              View 19th Hole
            </ButtonLink>
          </CardContent>
        </Card>
      )}

      <div className="mt-8 space-y-3">
        {trip.golf_group_id && (
          <ButtonLink href={`/play/group/${trip.golf_group_id}/start`} size="lg" className="flex w-full justify-center">
            Start Another Round
          </ButtonLink>
        )}
        {trip.golf_group_id && (
          <ButtonLink href={`/groups/${trip.golf_group_id}`} variant="outline" size="lg" className="flex w-full justify-center">
            Back to Group
          </ButtonLink>
        )}
      </div>
    </div>
  );
}
