import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GOLF_SCORING_ENABLED } from "@/lib/config";
import { Card, CardContent } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatTeeTime } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Rounds" };

const STATUS_BADGE = {
  scheduled: { label: "Scheduled", variant: "gold" as const },
  in_progress: { label: "In progress", variant: "success" as const },
  completed: { label: "Completed", variant: "neutral" as const },
  locked: { label: "Locked", variant: "neutral" as const },
};

export default async function RoundsPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  if (!GOLF_SCORING_ENABLED) {
    redirect("/dashboard");
  }

  const { tripId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: trip } = await supabase.from("trips").select("id, name").eq("id", tripId).maybeSingle();
  if (!trip) {
    notFound();
  }

  const [{ data: rounds }, { data: myMembership }] = await Promise.all([
    supabase
      .from("rounds")
      .select("id, name, round_date, start_time, hole_count, status, tournaments(name)")
      .eq("trip_id", tripId)
      .order("round_date", { ascending: false })
      .order("start_time", { ascending: true, nullsFirst: false }),
    supabase
      .from("trip_members")
      .select("role, status")
      .eq("trip_id", tripId)
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  const isCaptain = myMembership?.role === "captain" && myMembership.status === "active";
  const rows = rounds ?? [];

  // Rows are already ordered newest-day-first, ties broken by tee time,
  // so grouping is just a matter of collecting consecutive rows that
  // share a round_date -- no re-sorting needed.
  const dayGroups: { date: string; rounds: typeof rows }[] = [];
  for (const round of rows) {
    const lastGroup = dayGroups[dayGroups.length - 1];
    if (lastGroup && lastGroup.date === round.round_date) {
      lastGroup.rounds.push(round);
    } else {
      dayGroups.push({ date: round.round_date, rounds: [round] });
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-charcoal-400">
            {trip.name}
          </p>
          <h1 className="mt-1 text-2xl">Rounds</h1>
        </div>
        {isCaptain && (
          <ButtonLink href={`/trips/${tripId}/rounds/new`} variant="primary" size="sm">
            {rows.length === 0 ? "Add a Tee Time" : "Add Another Tee Time"}
          </ButtonLink>
        )}
      </div>

      {rows.length === 0 ? (
        <Card className="mt-6">
          <CardContent>
            <p className="text-sm text-charcoal-500">
              {isCaptain
                ? "No tee times scheduled yet. Add one against a course from your library."
                : "No tee times scheduled yet."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="mt-6 space-y-6">
          {dayGroups.map((group) => (
            <div key={group.date}>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-charcoal-400">
                {new Intl.DateTimeFormat("en-US", { weekday: "long", month: "short", day: "numeric" }).format(
                  new Date(group.date),
                )}
              </h2>
              <div className="mt-2 space-y-3">
                {group.rounds.map((round) => {
                  const badge = STATUS_BADGE[round.status];
                  // Supabase types the embedded to-one relation as an
                  // array even though a round has at most one
                  // tournament -- same quirk handled elsewhere for
                  // trip_members embeds.
                  const tournament = Array.isArray(round.tournaments) ? round.tournaments[0] : round.tournaments;
                  const teeTime = round.start_time ? formatTeeTime(round.start_time) : null;
                  // Title falls back through round name -> tournament
                  // name -> tee time -> the date itself, and the
                  // subtitle then only repeats whichever of those the
                  // title *didn't* already use -- e.g. a round named
                  // "Round 1" in the "Saturday Scramble" tournament
                  // shows both; an unnamed tee time with no tournament
                  // shows just its time, once, as the title.
                  const title = round.name || tournament?.name || teeTime || formatDate(round.round_date);
                  const subtitleBits: string[] = [];
                  if (tournament && tournament.name !== title) subtitleBits.push(tournament.name);
                  if (teeTime && teeTime !== title) subtitleBits.push(teeTime);
                  else if (!teeTime) subtitleBits.push("Tee time TBD");
                  subtitleBits.push(`${round.hole_count} holes`);

                  return (
                    <Link key={round.id} href={`/trips/${tripId}/rounds/${round.id}`}>
                      <Card className="transition-shadow hover:shadow-md">
                        <CardContent className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-medium text-forest-900">{title}</p>
                            <p className="mt-0.5 text-xs text-charcoal-400">{subtitleBits.join(" · ")}</p>
                          </div>
                          <Badge variant={badge.variant}>{badge.label}</Badge>
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-8">
        <ButtonLink href={`/trips/${tripId}`} variant="outline">
          Back to trip
        </ButtonLink>
      </div>
    </div>
  );
}
