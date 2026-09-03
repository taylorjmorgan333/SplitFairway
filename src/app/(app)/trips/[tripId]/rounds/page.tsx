import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GOLF_SCORING_ENABLED } from "@/lib/config";
import { Card, CardContent } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

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
      .select("id, name, round_date, start_time, hole_count, status")
      .eq("trip_id", tripId)
      .order("round_date", { ascending: false }),
    supabase
      .from("trip_members")
      .select("role, status")
      .eq("trip_id", tripId)
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  const isCaptain = myMembership?.role === "captain" && myMembership.status === "active";
  const rows = rounds ?? [];

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
            Schedule a round
          </ButtonLink>
        )}
      </div>

      {rows.length === 0 ? (
        <Card className="mt-6">
          <CardContent>
            <p className="text-sm text-charcoal-500">
              {isCaptain
                ? "No rounds scheduled yet. Schedule one against a course from your library."
                : "No rounds scheduled yet."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="mt-6 space-y-3">
          {rows.map((round) => {
            const badge = STATUS_BADGE[round.status];
            return (
              <Link key={round.id} href={`/trips/${tripId}/rounds/${round.id}`}>
                <Card className="transition-shadow hover:shadow-md">
                  <CardContent className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-forest-900">
                        {round.name || formatDate(round.round_date)}
                      </p>
                      <p className="mt-0.5 text-xs text-charcoal-400">
                        {formatDate(round.round_date)}
                        {round.start_time ? ` · ${round.start_time.slice(0, 5)}` : ""}
                        {" · "}
                        {round.hole_count} holes
                      </p>
                    </div>
                    <Badge variant={badge.variant}>{badge.label}</Badge>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
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
