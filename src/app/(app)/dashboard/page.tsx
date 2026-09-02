import type { Metadata } from "next";
import { CircleDollarSign, Clock, MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { StatCard } from "@/components/dashboard/stat-card";
import { EmptyState } from "@/components/dashboard/empty-state";
import { TripCard, type TripSummary } from "@/components/dashboard/trip-card";
import { calculateBalances, type ExpenseInput, type PaymentInput } from "@/lib/balances";
import { formatCurrency, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // The (app) layout already redirects signed-out visitors — this is
    // just a type-narrowing guard.
    return null;
  }

  const [{ data: profile }, { data: memberships }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
    supabase
      .from("trip_members")
      .select("id, role, trip_id, trips(*)")
      .eq("user_id", user.id)
      .eq("status", "active"),
  ]);

  const firstName = profile?.full_name?.split(" ")[0];
  const rows = (memberships ?? []).filter((m) => m.trips !== null);
  const tripIds = rows.map((m) => m.trip_id);
  const myMemberIds = rows.map((m) => m.id);
  const captainTripIds = rows.filter((m) => m.role === "captain").map((m) => m.trip_id);

  const [{ data: memberCountsRaw }, { data: expensesRaw }, { data: myShares }, { data: myPayments }, { count: awaitingConfirmationCount }] =
    await Promise.all([
      tripIds.length
        ? supabase.from("trip_members").select("trip_id").eq("status", "active").in("trip_id", tripIds)
        : Promise.resolve({ data: [] as { trip_id: string }[] }),
      // Every expense's total + who fronted it — needed (not just my
      // own shares) so "amount I fronted" can be computed alongside
      // "my share", via the one authoritative balance module.
      tripIds.length
        ? supabase
            .from("expenses")
            .select("id, trip_id, total_amount_cents, paid_by_member_id, due_date")
            .in("trip_id", tripIds)
        : Promise.resolve({ data: [] as { id: string; trip_id: string; total_amount_cents: number; paid_by_member_id: string | null; due_date: string | null }[] }),
      myMemberIds.length
        ? supabase
            .from("expense_shares")
            .select("expense_id, trip_member_id, amount_owed_cents")
            .in("trip_member_id", myMemberIds)
        : Promise.resolve({ data: [] as { expense_id: string; trip_member_id: string; amount_owed_cents: number }[] }),
      myMemberIds.length
        ? supabase
            .from("payments")
            .select("trip_id, payer_member_id, recipient_member_id, amount_cents, status")
            .or(`payer_member_id.in.(${myMemberIds.join(",")}),recipient_member_id.in.(${myMemberIds.join(",")})`)
        : Promise.resolve({ data: [] as { trip_id: string; payer_member_id: string; recipient_member_id: string | null; amount_cents: number; status: "reported" | "confirmed" | "rejected" }[] }),
      captainTripIds.length
        ? supabase
            .from("payments")
            .select("id", { count: "exact", head: true })
            .in("trip_id", captainTripIds)
            .eq("status", "reported")
        : Promise.resolve({ count: 0 }),
    ]);

  const memberCountByTrip = new Map<string, number>();
  for (const row of memberCountsRaw ?? []) {
    memberCountByTrip.set(row.trip_id, (memberCountByTrip.get(row.trip_id) ?? 0) + 1);
  }

  const myMemberIdByTrip = new Map(rows.map((m) => [m.trip_id, m.id]));
  const expenseTripById = new Map((expensesRaw ?? []).map((e) => [e.id, e.trip_id]));

  const expensesByTrip = new Map<string, ExpenseInput[]>();
  for (const e of expensesRaw ?? []) {
    const list = expensesByTrip.get(e.trip_id) ?? [];
    list.push({
      id: e.id,
      totalAmountCents: e.total_amount_cents,
      paidByMemberId: e.paid_by_member_id,
      dueDate: e.due_date,
      shares: [],
    });
    expensesByTrip.set(e.trip_id, list);
  }
  const expenseById = new Map<string, ExpenseInput>();
  for (const list of expensesByTrip.values()) {
    for (const e of list) expenseById.set(e.id, e);
  }
  for (const share of myShares ?? []) {
    const tripId = expenseTripById.get(share.expense_id);
    const expense = expenseById.get(share.expense_id);
    if (!tripId || !expense) continue;
    expense.shares.push({ tripMemberId: share.trip_member_id, amountOwedCents: share.amount_owed_cents });
  }

  const paymentsByTrip = new Map<string, PaymentInput[]>();
  for (const p of myPayments ?? []) {
    const list = paymentsByTrip.get(p.trip_id) ?? [];
    list.push({
      id: `${p.payer_member_id}-${p.amount_cents}-${list.length}`,
      payerMemberId: p.payer_member_id,
      recipientMemberId: p.recipient_member_id,
      amountCents: p.amount_cents,
      status: p.status,
    });
    paymentsByTrip.set(p.trip_id, list);
  }

  // Run every trip's numbers through the one authoritative balance
  // module (src/lib/balances.ts) — the exact same function the trip
  // detail page uses — rather than re-deriving "what do I owe" here.
  const balanceByTrip = new Map<string, ReturnType<typeof calculateBalances>[number]>();
  for (const tripId of tripIds) {
    const myMemberId = myMemberIdByTrip.get(tripId);
    if (!myMemberId) continue;
    const [balance] = calculateBalances(
      [{ id: myMemberId, displayName: "" }],
      expensesByTrip.get(tripId) ?? [],
      paymentsByTrip.get(tripId) ?? [],
    );
    if (balance) balanceByTrip.set(tripId, balance);
  }

  const today = new Date().toISOString().slice(0, 10);
  const totalOutstandingCents = tripIds.reduce(
    (sum, tripId) => sum + (balanceByTrip.get(tripId)?.amountOwedCents ?? 0),
    0,
  );

  const trips: TripSummary[] = rows
    .map((m) => {
      const trip = m.trips!;
      const isPast =
        trip.status === "completed" ||
        trip.status === "cancelled" ||
        (trip.end_date !== null && trip.end_date < today);
      const outstanding = balanceByTrip.get(trip.id)?.amountOwedCents ?? 0;

      const dateRange =
        trip.start_date && trip.end_date
          ? `${formatDate(trip.start_date)} – ${formatDate(trip.end_date)}`
          : trip.start_date
            ? formatDate(trip.start_date)
            : "Dates TBD";

      return {
        id: trip.id,
        name: trip.name,
        destination: trip.destination ?? undefined,
        dateRange,
        golferCount: memberCountByTrip.get(trip.id) ?? 1,
        outstandingLabel:
          outstanding > 0 ? `You owe ${formatCurrency(outstanding)}` : "You're settled up",
        status: isPast ? ("past" as const) : ("upcoming" as const),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const upcomingTrips = trips.filter((t) => t.status === "upcoming");
  const pastTrips = trips.filter((t) => t.status === "past");

  return (
    <div>
      <h1 className="text-2xl">
        {firstName ? `Welcome back, ${firstName}` : "Your dashboard"}
      </h1>
      <p className="mt-1.5 text-sm text-charcoal-500">
        Here&apos;s where things stand across your trips.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Total outstanding"
          value={formatCurrency(totalOutstandingCents)}
          icon={CircleDollarSign}
          tone="gold"
        />
        <StatCard
          label="Payments awaiting confirmation"
          value={String(awaitingConfirmationCount ?? 0)}
          icon={Clock}
        />
        <StatCard label="Upcoming trips" value={String(upcomingTrips.length)} icon={MapPin} />
      </div>

      <div className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-charcoal-400">
          Upcoming trips
        </h2>
        <div className="mt-4">
          {upcomingTrips.length === 0 && pastTrips.length === 0 ? (
            <EmptyState />
          ) : upcomingTrips.length === 0 ? (
            <p className="text-sm text-charcoal-500">No upcoming trips right now.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {upcomingTrips.map((trip) => (
                <TripCard key={trip.id} trip={trip} />
              ))}
            </div>
          )}
        </div>
      </div>

      {pastTrips.length > 0 && (
        <div className="mt-10">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-charcoal-400">
            Past trips
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pastTrips.map((trip) => (
              <TripCard key={trip.id} trip={trip} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
