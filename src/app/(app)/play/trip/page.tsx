import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, Luggage } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { GOLF_SCORING_ENABLED } from "@/lib/config";
import { Card } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Trip Round" };

export default async function PlayTripPage() {
  if (!GOLF_SCORING_ENABLED) {
    redirect("/home");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data: memberships } = await supabase
    .from("trip_members")
    .select("trip_id, trips(id, name, start_date, kind)")
    .eq("user_id", user.id)
    .eq("status", "active");

  const trips = (memberships ?? [])
    .filter((m) => m.trips !== null && m.trips!.kind === "trip")
    .map((m) => m.trips!)
    .sort((a, b) => (a.start_date ?? "9999-99-99").localeCompare(b.start_date ?? "9999-99-99"));

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-2xl">Trip Round</h1>
      <p className="mt-1.5 text-base text-charcoal-500">Choose which trip this round belongs to.</p>

      {trips.length === 0 ? (
        <Card className="mt-8 flex flex-col items-center border border-dashed border-forest-900/15 bg-white/60 px-6 py-12 text-center shadow-none">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-forest-800/10">
            <Luggage className="h-5 w-5 text-forest-700" strokeWidth={1.75} aria-hidden="true" />
          </span>
          <h2 className="mt-5 text-xl text-forest-900">No trips yet</h2>
          <p className="mt-2 max-w-sm text-base text-charcoal-500">
            Plan a trip first, then attach rounds to it as you go.
          </p>
          <ButtonLink href="/trips/new" variant="primary" className="mt-6">
            Plan a Trip
          </ButtonLink>
        </Card>
      ) : (
        <div className="mt-8 space-y-3">
          {trips.map((trip) => (
            <Link key={trip.id} href={`/trips/${trip.id}/rounds/new`} className="block">
              <Card className="flex items-center gap-4 p-5 transition-shadow hover:shadow-card-hover">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-forest-800/10">
                  <Luggage className="h-5 w-5 text-forest-700" aria-hidden="true" strokeWidth={1.75} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-medium text-forest-900">{trip.name}</p>
                  <p className="mt-0.5 text-base text-charcoal-500">
                    {trip.start_date ? formatDate(trip.start_date) : "Dates TBD"}
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-charcoal-400" aria-hidden="true" />
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
