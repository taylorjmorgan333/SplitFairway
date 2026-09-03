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
import { GOLF_SCORING_ENABLED } from "@/lib/config";

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

  const reminderOverdue: ReminderData["overdue"] = activeMembers
    .filter((m) => overdueDueDateByMember.has(m.id) && (balanceByMemberId.get(m.id)?.amountOwedCents ?? 0) > 0)
    .map((m) => ({
      memberId: m.id,
      displayName: m.display_name,
      email: m.email,
      amountCents: balanceByMemberId.get(m.id)!.amountOwedCents,
      dueDate: overdueDueDateByMember.get(m.id)!,
    }));

  const reminderDueSoon: ReminderData["dueSoon"] = activeMembers
    .filter((m) => dueSoonDueDateByMember.has(m.id) && (balanceByMemberId.get(m.id)?.amountOwedCents ?? 0) > 0)
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
      .filter((m) => m.status === "invited")
      .map((m) => {
        const invitation = invitationByEmail.get(m.email.toLowerCase());
        if (!invitation) return null;
        const expiresAt = new Date(invitation.expires_at).getTime();
        if (expiresAt <= now) return null;
        return {
          tripMemberId: m.id,
          displayName: m.display_name,
          email: m.email,
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
          <ButtonLink href={`/trips/${trip.id}/rounds`} variant="outline" size="sm">
            Golf rounds
          </ButtonLink>
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
