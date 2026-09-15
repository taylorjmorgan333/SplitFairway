import type { Metadata } from "next";
import { Flag } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  ContinueRoundCard,
  UpcomingCard,
  GroupsSection,
  RecentRoundsSection,
  type HomeGroupSummary,
  type HomeRecentRound,
} from "@/components/home/home-sections";
import { primaryHrefForRound } from "@/components/rounds/round-phase";
import { calculateBalances, type ExpenseInput, type PaymentInput } from "@/lib/balances";
import { formatCurrency, formatDate } from "@/lib/utils";
import { GOLF_SCORING_ENABLED } from "@/lib/config";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Home" };

export default async function HomePage() {
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
      .select("id, role, trip_id, trips(id, name, status, start_date, end_date, kind)")
      .eq("user_id", user.id)
      .eq("status", "active"),
  ]);

  const firstName = profile?.full_name?.split(" ")[0];
  const rows = (memberships ?? []).filter((m) => m.trips !== null);
  const allTripIds = rows.map((m) => m.trip_id);
  const myMemberIds = rows.map((m) => m.id);
  const myMemberIdByTrip = new Map(rows.map((m) => [m.trip_id, m.id]));
  // "Real" trips only — a hidden trip auto-created for a Quick Round or
  // Group Round (see trips.kind) never shows up as a trip anywhere in
  // the UI, Home included.
  const realTrips = rows.filter((m) => m.trips!.kind === "trip").map((m) => m.trips!);

  // ---- Balances across every trip (any kind — a Quick Round could in
  // principle carry an expense too), reusing the exact same balance
  // module the trip detail page uses. ----
  const [{ data: expensesRaw }, { data: myShares }, { data: myPayments }] = await Promise.all([
    allTripIds.length
      ? supabase
          .from("expenses")
          .select("id, trip_id, total_amount_cents, paid_by_member_id, due_date")
          .in("trip_id", allTripIds)
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
  ]);

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
  for (const list of expensesByTrip.values()) for (const e of list) expenseById.set(e.id, e);
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
  let totalOutstandingCents = 0;
  for (const tripId of allTripIds) {
    const myMemberId = myMemberIdByTrip.get(tripId);
    if (!myMemberId) continue;
    const [balance] = calculateBalances(
      [{ id: myMemberId, displayName: "" }],
      expensesByTrip.get(tripId) ?? [],
      paymentsByTrip.get(tripId) ?? [],
    );
    if (balance) totalOutstandingCents += balance.amountOwedCents;
  }

  // ---- Rounds: Continue / Upcoming / Recent, across every trip ----
  const tripNameById = new Map(rows.map((m) => [m.trip_id, m.trips!.name]));
  let continueRound: {
    roundId: string;
    tripId: string;
    tripName: string;
    courseName: string;
    holesCompleted: number;
    holeCount: number;
  } | null = null;
  let upcomingRound: {
    roundId: string;
    tripId: string;
    tripName: string;
    courseName: string;
    roundDate: string;
    startTime: string | null;
  } | null = null;
  let recentRounds: HomeRecentRound[] = [];

  if (GOLF_SCORING_ENABLED && allTripIds.length > 0) {
    const { data: roundRows } = await supabase
      .from("rounds")
      .select("id, trip_id, round_date, start_time, hole_count, status")
      .in("trip_id", allTripIds)
      .order("round_date", { ascending: false })
      .order("start_time", { ascending: false, nullsFirst: false });

    const roundsData = roundRows ?? [];
    const roundIds = roundsData.map((r) => r.id);

    if (roundIds.length > 0) {
      const [{ data: snapshotRows }, { data: roundPlayerRows }] = await Promise.all([
        supabase.from("round_course_snapshots").select("round_id, course_name").in("round_id", roundIds),
        supabase.from("round_players").select("id, round_id").in("round_id", roundIds),
      ]);
      const courseNameByRound = new Map((snapshotRows ?? []).map((s) => [s.round_id, s.course_name]));
      const golferCountByRound = new Map<string, number>();
      for (const p of roundPlayerRows ?? []) {
        golferCountByRound.set(p.round_id, (golferCountByRound.get(p.round_id) ?? 0) + 1);
      }

      const activeRound = roundsData.find((r) => r.status === "in_progress") ?? null;
      if (activeRound) {
        const { data: scoreRows } = await supabase
          .from("hole_scores")
          .select("hole_number, gross_strokes")
          .eq("round_id", activeRound.id)
          .not("gross_strokes", "is", null);
        const enteredCountByHole = new Map<number, number>();
        for (const s of scoreRows ?? []) {
          enteredCountByHole.set(s.hole_number, (enteredCountByHole.get(s.hole_number) ?? 0) + 1);
        }
        const activeGolferCount = golferCountByRound.get(activeRound.id) ?? 0;
        const holesCompleted =
          activeGolferCount > 0
            ? [...enteredCountByHole.values()].filter((n) => n >= activeGolferCount).length
            : 0;
        continueRound = {
          roundId: activeRound.id,
          tripId: activeRound.trip_id,
          tripName: tripNameById.get(activeRound.trip_id) ?? "Round",
          courseName: courseNameByRound.get(activeRound.id) ?? "Course",
          holesCompleted,
          holeCount: activeRound.hole_count,
        };
      }

      const today = new Date().toISOString().slice(0, 10);
      const nextScheduled = roundsData
        .filter((r) => r.status === "scheduled" && r.round_date >= today)
        .sort((a, b) => a.round_date.localeCompare(b.round_date))[0];
      if (nextScheduled) {
        upcomingRound = {
          roundId: nextScheduled.id,
          tripId: nextScheduled.trip_id,
          tripName: tripNameById.get(nextScheduled.trip_id) ?? "Round",
          courseName: courseNameByRound.get(nextScheduled.id) ?? "Course",
          roundDate: nextScheduled.round_date,
          startTime: nextScheduled.start_time,
        };
      }

      recentRounds = roundsData
        .filter((r) => r.status === "completed" || r.status === "locked")
        .slice(0, 3)
        .map((r) => ({
          id: r.id,
          tripId: r.trip_id,
          tripName: tripNameById.get(r.trip_id) ?? "Round",
          courseName: courseNameByRound.get(r.id) ?? "Course",
          roundDate: r.round_date,
          holeCount: r.hole_count,
          href: primaryHrefForRound(r.trip_id, r.id, "completed"),
        }));
    }
  }

  // ---- Upcoming trip (fallback when there's no upcoming round yet) ----
  const today = new Date().toISOString().slice(0, 10);
  const upcomingTrip = realTrips
    .filter((t) => {
      const isPast = t.status === "completed" || t.status === "cancelled" || (t.end_date !== null && t.end_date < today);
      return !isPast;
    })
    .sort((a, b) => (a.start_date ?? "9999-99-99").localeCompare(b.start_date ?? "9999-99-99"))[0];

  // ---- My Groups ----
  const { data: myGroupMemberships } = await supabase
    .from("golf_group_members")
    .select("group_id, golf_groups(id, name)")
    .eq("user_id", user.id);
  const groupRows = (myGroupMemberships ?? []).filter((g) => g.golf_groups !== null);
  const groupIds = groupRows.map((g) => g.group_id);
  const { data: allGroupMemberRows } = groupIds.length
    ? await supabase.from("golf_group_members").select("group_id").in("group_id", groupIds)
    : { data: [] as { group_id: string }[] };
  const memberCountByGroup = new Map<string, number>();
  for (const r of allGroupMemberRows ?? []) {
    memberCountByGroup.set(r.group_id, (memberCountByGroup.get(r.group_id) ?? 0) + 1);
  }
  const groups: HomeGroupSummary[] = groupRows
    .map((g) => ({
      id: g.golf_groups!.id,
      name: g.golf_groups!.name,
      memberCount: memberCountByGroup.get(g.group_id) ?? 1,
    }))
    .slice(0, 4);

  const hasAnythingAtAll =
    continueRound || upcomingRound || upcomingTrip || groups.length > 0 || recentRounds.length > 0 || allTripIds.length > 0;

  return (
    <div>
      <h1 className="text-2xl">{firstName ? `Welcome back, ${firstName}` : "Welcome to SplitFairway"}</h1>
      <p className="mt-1.5 text-base text-charcoal-500">Your group. Every round. Every trip.</p>

      <div className="mt-8 space-y-8">
        {continueRound && (
          <ContinueRoundCard
            tripName={continueRound.tripName}
            courseName={continueRound.courseName}
            holesCompleted={continueRound.holesCompleted}
            holeCount={continueRound.holeCount}
            href={primaryHrefForRound(continueRound.tripId, continueRound.roundId, "in_progress")}
          />
        )}

        {GOLF_SCORING_ENABLED && (
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <ButtonLink href="/play" variant="gold" size="lg" className="flex w-full justify-center sm:w-auto">
              <Flag className="h-4 w-4" aria-hidden="true" />
              Start a Round
            </ButtonLink>
            <ButtonLink href="/trips/new" variant="outline" size="md" className="flex w-full justify-center sm:w-auto">
              Plan a Trip
            </ButtonLink>
          </div>
        )}
        {!GOLF_SCORING_ENABLED && (
          <ButtonLink href="/trips/new" variant="primary" size="lg" className="flex w-full justify-center sm:w-auto">
            Plan a Trip
          </ButtonLink>
        )}

        {!hasAnythingAtAll && (
          <Card className="flex flex-col items-center border border-dashed border-forest-900/15 bg-white/60 px-6 py-14 text-center shadow-none">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-forest-800/10">
              <Flag className="h-5 w-5 text-forest-700" strokeWidth={1.75} aria-hidden="true" />
            </span>
            <h2 className="mt-5 text-xl text-forest-900">Let&apos;s get you started</h2>
            <p className="mt-2 max-w-sm text-base text-charcoal-500">
              Start a round with your group today, or plan a full golf trip — you can always add the
              other later.
            </p>
          </Card>
        )}

        {(upcomingRound || upcomingTrip) && (
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-charcoal-400">
              {upcomingRound ? "Upcoming Round" : "Upcoming Trip"}
            </h2>
            <div className="mt-3">
              {upcomingRound ? (
                <UpcomingCard
                  title={upcomingRound.courseName}
                  subtitle={upcomingRound.tripName}
                  dateLabel={formatDate(upcomingRound.roundDate)}
                  href={`/trips/${upcomingRound.tripId}/rounds/${upcomingRound.roundId}`}
                  actionLabel="View"
                />
              ) : (
                <UpcomingCard
                  title={upcomingTrip!.name}
                  dateLabel={upcomingTrip!.start_date ? formatDate(upcomingTrip!.start_date) : "Dates TBD"}
                  href={`/trips/${upcomingTrip!.id}`}
                  actionLabel="View"
                />
              )}
            </div>
          </section>
        )}

        {groups.length > 0 && (
          <section>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-charcoal-400">My Groups</h2>
              <ButtonLink href="/groups" variant="ghost" size="sm" className="text-base">
                See all
              </ButtonLink>
            </div>
            <div className="mt-3">
              <GroupsSection groups={groups} />
            </div>
          </section>
        )}

        {recentRounds.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-charcoal-400">Recent Rounds</h2>
            <div className="mt-3">
              <RecentRoundsSection rounds={recentRounds} />
            </div>
          </section>
        )}

        {allTripIds.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-charcoal-400">Balances</h2>
            <Card className="mt-3 p-5">
              <p className="text-lg font-medium text-forest-900">
                {totalOutstandingCents > 0 ? `You owe ${formatCurrency(totalOutstandingCents)}` : "You're settled up"}
              </p>
              <p className="mt-1 text-base text-charcoal-500">Across all your trips and rounds.</p>
            </Card>
          </section>
        )}
      </div>
    </div>
  );
}
