import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { TripTabs, type OverviewStats, type ReminderData } from "@/components/trips/trip-tabs";
import type { ExpenseRow } from "@/components/trips/expense-list";
import type { PaymentRow } from "@/components/trips/payments-list";
import type { ActivityRow } from "@/components/trips/activity-feed";
import { calculateBalances, suggestSettlements } from "@/lib/balances";
import { formatDate } from "@/lib/utils";
import { PAYMENT_METHOD_LABELS } from "@/lib/validation/payment";
import { GOLF_SCORING_ENABLED, SIDE_GAMES_ENABLED, LIVE_LEADERBOARD_ENABLED } from "@/lib/config";
import {
  RoundsSection,
  type RoundSummary,
  type InProgressSummary,
} from "@/components/trips/rounds-section";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Trip details" };

const STATUS_BADGE: Record<string, "forest" | "gold" | "neutral" | "success"> = {
  planning: "gold",
  active: "success",
  completed: "neutral",
  cancelled: "neutral",
};

export default async function TripDetailPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  // RLS (trips_select_members) silently returns no row if this user
  // isn't an active member of the trip, so a missing row and a bad ID
  // look identical here — both correctly render as "not found."
  const [{ data: trip }, { data: members }] = await Promise.all([
    supabase.from("trips").select("*").eq("id", tripId).maybeSingle(),
    supabase
      .from("trip_members")
      .select("id, display_name, email, role, status, user_id")
      .eq("trip_id", tripId)
      .order("created_at", { ascending: true }),
  ]);

  if (!trip) {
    notFound();
  }

  const memberRows = members ?? [];
  const myMembership = memberRows.find((m) => m.user_id === user.id) ?? null;
  const isCaptain = Boolean(
    myMembership && myMembership.role === "captain" && myMembership.status === "active",
  );
  const isOwner = Boolean(trip.owner_id && trip.owner_id === user.id);
  const activeMembers = memberRows.filter((m) => m.status === "active");
  const activeCaptains = activeMembers.filter((m) => m.role === "captain");
  const memberNameById = new Map(memberRows.map((m) => [m.id, m.display_name]));
  const memberEmailById = new Map(memberRows.map((m) => [m.id, m.email]));

  const [{ data: expensesRaw }, { data: paymentsRaw }, { data: activityRaw }] = await Promise.all([
    supabase
      .from("expenses")
      .select("*")
      .eq("trip_id", tripId)
      .order("expense_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false }),
    supabase.from("payments").select("*").eq("trip_id", tripId).order("paid_at", { ascending: false }),
    supabase
      .from("activity_log")
      .select("*")
      .eq("trip_id", tripId)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const expenseIds = (expensesRaw ?? []).map((e) => e.id);
  const { data: sharesRaw } = expenseIds.length
    ? await supabase.from("expense_shares").select("*").in("expense_id", expenseIds)
    : { data: [] };
  const shares = sharesRaw ?? [];

  const expenses: ExpenseRow[] = (expensesRaw ?? []).map((expense) => ({
    ...expense,
    paidByName: expense.paid_by_member_id ? (memberNameById.get(expense.paid_by_member_id) ?? null) : null,
    shares: shares
      .filter((s) => s.expense_id === expense.id)
      .map((s) => ({
        trip_member_id: s.trip_member_id,
        amount_owed_cents: s.amount_owed_cents,
        display_name: memberNameById.get(s.trip_member_id) ?? "Unknown",
      })),
  }));

  const payments: PaymentRow[] = (paymentsRaw ?? []).map((payment) => ({
    ...payment,
    payerName: memberNameById.get(payment.payer_member_id) ?? "Unknown",
    recipientName: payment.recipient_member_id
      ? (memberNameById.get(payment.recipient_member_id) ?? null)
      : null,
  }));

  // Fetch the actor's display name for each activity row via their
  // trip membership when possible (falls back to "Someone" in the UI).
  const activity: ActivityRow[] = (activityRaw ?? []).map((row) => {
    const actorMember = memberRows.find((m) => m.user_id === row.actor_user_id);
    return { ...row, actorName: actorMember?.display_name ?? null };
  });

  // The one authoritative balance calculation — see src/lib/balances.ts.
  // Balances are computed for every member who is either currently
  // active, or who has historical expense shares / payments (so
  // removing a golfer mid-trip never silently erases what they owed or
  // were owed).
  const memberIdsWithActivity = new Set<string>([
    ...shares.map((s) => s.trip_member_id),
    ...(paymentsRaw ?? []).flatMap((p) => [p.payer_member_id, p.recipient_member_id].filter(Boolean) as string[]),
  ]);
  const balanceMembers = memberRows
    .filter((m) => m.status === "active" || memberIdsWithActivity.has(m.id))
    .map((m) => ({ id: m.id, displayName: m.display_name }));

  const balances = calculateBalances(
    balanceMembers,
    (expensesRaw ?? []).map((e) => ({
      id: e.id,
      totalAmountCents: e.total_amount_cents,
      paidByMemberId: e.paid_by_member_id,
      dueDate: e.due_date,
      shares: shares
        .filter((s) => s.expense_id === e.id)
        .map((s) => ({ tripMemberId: s.trip_member_id, amountOwedCents: s.amount_owed_cents })),
    })),
    (paymentsRaw ?? []).map((p) => ({
      id: p.id,
      payerMemberId: p.payer_member_id,
      recipientMemberId: p.recipient_member_id,
      amountCents: p.amount_cents,
      status: p.status,
    })),
  );
  const settlements = suggestSettlements(balances);

  const totalTripCostCents = (expensesRaw ?? []).reduce((sum, e) => sum + e.total_amount_cents, 0);
  const outstandingCents = balances.reduce((sum, b) => sum + b.amountOwedCents, 0);
  const paidOrConfirmedCents = Math.max(0, totalTripCostCents - outstandingCents);
  const today = new Date().toISOString().slice(0, 10);
  const nextDueDate =
    (expensesRaw ?? [])
      .map((e) => e.due_date)
      .filter((d): d is string => d !== null && d >= today)
      .sort()[0] ?? null;

  const overview: OverviewStats = {
    totalTripCostCents,
    paidOrConfirmedCents,
    outstandingCents,
    nextDueDate,
    activeGolferCount: activeMembers.length,
  };

  // Reminder-center data — only meaningful for captains, but cheap
  // enough to compute regardless (the extra trip_invitations query is
  // skipped for non-captains, and RLS would return nothing for them
  // anyway). Balances stay the single source of truth for "how much
  // does this member currently owe" — the due-date buckets below only
  // decide WHICH members to flag, not how much they owe.
  const balanceByMemberId = new Map(balances.map((b) => [b.memberId, b]));
  const todayForReminders = today;
  const sevenDaysOut = new Date();
  sevenDaysOut.setDate(sevenDaysOut.getDate() + 7);
  const sevenDaysOutStr = sevenDaysOut.toISOString().slice(0, 10);

  const overdueDueDateByMember = new Map<string, string>();
  const dueSoonDueDateByMember = new Map<string, string>();
  for (const expense of expensesRaw ?? []) {
    if (!expense.due_date) continue;
    const bucket = expense.due_date < todayForReminders
      ? overdueDueDateByMember
      : expense.due_date <= sevenDaysOutStr
        ? dueSoonDueDateByMember
        : null;
    if (!bucket) continue;
    for (const share of shares.filter((s) => s.expense_id === expense.id)) {
      const existing = bucket.get(share.trip_member_id);
      if (!existing || expense.due_date < existing) {
        bucket.set(share.trip_member_id, expense.due_date);
      }
    }
  }

  // Members added manually (no invite email) may have no email on
  // file — the reminder center only makes sense for someone reachable
  // by email, so they're simply left out of these two lists rather
  // than surfaced with a blank/broken "send" target.
  const reminderOverdue: ReminderData["overdue"] = activeMembers
    .filter(
      (m): m is typeof m & { email: string } =>
        m.email !== null &&
        overdueDueDateByMember.has(m.id) &&
        (balanceByMemberId.get(m.id)?.amountOwedCents ?? 0) > 0,
    )
    .map((m) => ({
      memberId: m.id,
      displayName: m.display_name,
      email: m.email,
      amountCents: balanceByMemberId.get(m.id)!.amountOwedCents,
      dueDate: overdueDueDateByMember.get(m.id)!,
    }));

  const reminderDueSoon: ReminderData["dueSoon"] = activeMembers
    .filter(
      (m): m is typeof m & { email: string } =>
        m.email !== null &&
        dueSoonDueDateByMember.has(m.id) &&
        (balanceByMemberId.get(m.id)?.amountOwedCents ?? 0) > 0,
    )
    .map((m) => ({
      memberId: m.id,
      displayName: m.display_name,
      email: m.email,
      amountCents: balanceByMemberId.get(m.id)!.amountOwedCents,
      dueDate: dueSoonDueDateByMember.get(m.id)!,
    }));

  const fallbackCaptain = activeCaptains[0] ?? null;
  const reminderAwaitingConfirmation: ReminderData["awaitingConfirmation"] = (paymentsRaw ?? [])
    .filter((p) => p.status === "reported")
    .map((p) => {
      const recipientId = p.recipient_member_id ?? fallbackCaptain?.id ?? null;
      return {
        paymentId: p.id,
        payerName: memberNameById.get(p.payer_member_id) ?? "Unknown",
        amountCents: p.amount_cents,
        paymentMethodLabel: PAYMENT_METHOD_LABELS[p.payment_method],
        recipientMemberId: recipientId,
        recipientName: recipientId ? (memberNameById.get(recipientId) ?? "the trip captain") : "the trip captain",
        recipientEmail: recipientId ? (memberEmailById.get(recipientId) ?? "") : "",
      };
    })
    .filter((c) => c.recipientEmail !== "");

  let reminderInvitations: ReminderData["invitations"] = [];
  if (isCaptain) {
    const { data: pendingInvitations } = await supabase
      .from("trip_invitations")
      .select("email, expires_at")
      .eq("trip_id", tripId)
      .eq("status", "pending");

    const now = Date.now();
    const invitationByEmail = new Map(
      (pendingInvitations ?? []).map((inv) => [inv.email.toLowerCase(), inv]),
    );
    reminderInvitations = memberRows
      .filter((m) => m.status === "invited" && m.email !== null)
      .map((m) => {
        // Guaranteed non-null by the filter above (an "invited" row is
        // always created with an email — see invite_trip_member), but
        // the column type is nullable overall so TS still needs this.
        const email = m.email as string;
        const invitation = invitationByEmail.get(email.toLowerCase());
        if (!invitation) return null;
        const expiresAt = new Date(invitation.expires_at).getTime();
        if (expiresAt <= now) return null;
        return {
          tripMemberId: m.id,
          displayName: m.display_name,
          email,
          daysUntilExpiry: Math.max(1, Math.ceil((expiresAt - now) / (24 * 60 * 60 * 1000))),
        };
      })
      .filter((c): c is ReminderData["invitations"][number] => c !== null);
  }

  const reminders: ReminderData = {
    overdue: reminderOverdue,
    dueSoon: reminderDueSoon,
    awaitingConfirmation: reminderAwaitingConfirmation,
    invitations: reminderInvitations,
  };

  // Golf rounds for the trip dashboard's "Rounds" section -- gated on
  // GOLF_SCORING_ENABLED like every other golf surface, and skipped
  // entirely (not just hidden) when the flag is off so a disabled trip
  // never pays for these extra queries.
  let roundSummaries: RoundSummary[] = [];
  let inProgressSummary: InProgressSummary | null = null;

  if (GOLF_SCORING_ENABLED) {
    const { data: roundRows } = await supabase
      .from("rounds")
      .select("id, name, round_date, start_time, hole_count, status")
      .eq("trip_id", tripId)
      .order("round_date", { ascending: true })
      .order("start_time", { ascending: true, nullsFirst: false });

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

      roundSummaries = roundsData.map((r) => ({
        id: r.id,
        name: r.name,
        courseName: courseNameByRound.get(r.id) ?? "Course",
        roundDate: r.round_date,
        startTime: r.start_time,
        holeCount: r.hole_count,
        status: r.status,
        golferCount: golferCountByRound.get(r.id) ?? 0,
      }));

      // Trip-level "Round in progress" summary -- computed only for the
      // (normally singular) round actually being played right now, so
      // this stays cheap even on a trip with a long rounds history. A
      // hole only counts as "completed" once every golfer in the round
      // has a score for it, not just whoever's gotten there first.
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

        inProgressSummary = {
          roundId: activeRound.id,
          holesCompleted,
          holeCount: activeRound.hole_count,
        };
      }
    }
  }

  const dateRange =
    trip.start_date && trip.end_date
      ? `${formatDate(trip.start_date)} – ${formatDate(trip.end_date)}`
      : trip.start_date
        ? formatDate(trip.start_date)
        : "Dates TBD";

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-charcoal-400">
            Trip
          </p>
          <h1 className="mt-1 text-2xl">{trip.name}</h1>
          <p className="mt-1.5 text-sm text-charcoal-500">
            {trip.destination ? `${trip.destination} · ` : ""}
            {dateRange} · {activeMembers.length} golfer{activeMembers.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={STATUS_BADGE[trip.status] ?? "neutral"} className="capitalize">
            {trip.status}
          </Badge>
          {isCaptain && <Badge variant="gold">You&apos;re a captain</Badge>}
        </div>
      </div>

      {GOLF_SCORING_ENABLED && (
        <div className="mt-6">
          <RoundsSection
            tripId={trip.id}
            isCaptain={isCaptain}
            rounds={roundSummaries}
            inProgress={inProgressSummary}
            sideGamesEnabled={SIDE_GAMES_ENABLED}
            leaderboardEnabled={LIVE_LEADERBOARD_ENABLED}
          />
        </div>
      )}

      <div className="mt-8">
        <TripTabs
          trip={trip}
          isCaptain={isCaptain}
          isOwner={isOwner}
          activeMembers={activeMembers.map((m) => ({ id: m.id, display_name: m.display_name }))}
          memberRows={memberRows}
          currentUserMemberId={myMembership?.id ?? null}
          expenses={expenses}
          payments={payments}
          activity={activity}
          balances={balances}
          settlements={settlements}
          overview={overview}
          reminders={reminders}
        />
      </div>

      <div className="mt-8">
        <ButtonLink href="/dashboard" variant="outline">
          Back to dashboard
        </ButtonLink>
      </div>
    </div>
  );
}
