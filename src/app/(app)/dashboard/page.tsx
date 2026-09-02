import type { Metadata } from "next";
import { CircleDollarSign, Clock, MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { StatCard } from "@/components/dashboard/stat-card";
import { EmptyState } from "@/components/dashboard/empty-state";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const firstName = (user?.user_metadata?.full_name as string | undefined)?.split(" ")[0];

  // Trip data isn't backed by a database table yet — this dashboard
  // shows the same empty state every account will see today. Real
  // trip and payment queries land once the trips schema exists.
  const trips: never[] = [];

  return (
    <div>
      <h1 className="text-2xl">
        {firstName ? `Welcome back, ${firstName}` : "Your dashboard"}
      </h1>
      <p className="mt-1.5 text-sm text-charcoal-500">
        Here&apos;s where things stand across your trips.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <StatCard label="Total outstanding" value="$0.00" icon={CircleDollarSign} tone="gold" />
        <StatCard label="Payments awaiting confirmation" value="0" icon={Clock} />
        <StatCard label="Upcoming trips" value="0" icon={MapPin} />
      </div>

      <div className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-charcoal-400">
          Upcoming trips
        </h2>
        <div className="mt-4">
          {trips.length === 0 ? (
            <EmptyState />
          ) : (
            <p className="text-sm text-charcoal-500">Trips will list here.</p>
          )}
        </div>
      </div>
    </div>
  );
}
