import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadGroupLeaderboard } from "@/lib/golf/group-leaderboard";
import { calculateBalances, type ExpenseInput, type PaymentInput } from "@/lib/balances";
import { formatCurrency } from "@/lib/utils";
import { GOLF_SCORING_ENABLED, MONETARY_GAME_VALUES_ENABLED } from "@/lib/config";
import { GroupTabs, type GroupMemberRow, type GroupRoundRow, type PresetRow, type SeasonRow } from "@/components/groups/group-tabs";
import type { GolferRoundRow } from "@/components/groups/golfer-card";
import type { GroupInvitationRow } from "@/components/groups/group-invitations-list";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Group" };

export default async function GroupDetailPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  // RLS (golf_groups_select_members) silently returns no row if this
  // user isn't a member of the group — a missing row and a bad id look
  // identical here, same convention as the trip detail page.
  const [{ data: group }, { data: memberRows }, { data: presetRows }, { data: seasonRows }] = await Promise.all([
    supabase.from("golf_groups").select("*").eq("id", groupId).maybeSingle(),
    supabase
      .from("golf_group_members")
      .select("id, user_id, display_name, email, role, default_handicap_index, preferred_tee_name")
      .eq("group_id", groupId)
      .order("role", { ascending: true }),
    supabase
      .from("golf_group_game_presets")
      .select("id, name, side_game_type, settings, created_at")
      .eq("group_id", groupId)
      .order("created_at", { ascending: false }),
    supabase
      .from("golf_group_seasons")
      .select("id, name, start_date, end_date")
      .eq("group_id", groupId)
      .order("start_date", { ascending: false }),
  ]);

  if (!group) {
    notFound();
  }

  const memberRowsSafe = memberRows ?? [];
  const me = memberRowsSafe.find((m) => m.user_id === user.id);
  const isOwner = me?.role === "owner";

  const members: GroupMemberRow[] = memberRowsSafe.map((m) => ({
    id: m.id,
    userId: m.user_id,
    displayName: m.display_name,
    email: m.email,
    role: m.role,
    defaultHandicapIndex: m.default_handicap_index,
    preferredTeeName: m.preferred_tee_name,
  }));

  const presets: PresetRow[] = (presetRows ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    side_game_type: p.side_game_type,
    settings: (p.settings ?? {}) as unknown as PresetRow["settings"],
  }));

  const seasons: SeasonRow[] = (seasonRows ?? []).map((s) => ({ id: s.id, name: s.name, start_date: s.start_date, end_date: s.end_date }));

  // ---- Round history across every trip this group has ever hosted a
  // round on (both real trips linked via attach_trip_to_group and the
  // hidden trips start_group_round_trip creates). ----
  const { data: tripRows } = await supabase.from("trips").select("id, name, kind, start_date").eq("golf_group_id", groupId);
  const trips = tripRows ?? [];
  const tripIds = trips.map((t) => t.id);

  const today = new Date().toISOString().slice(0, 10);
  const upcomingTripRow = trips
    .filter((t) => t.kind === "trip" && t.start_date && t.start_date >= today)
    .sort((a, b) => (a.start_date! < b.start_date! ? -1 : 1))[0];
  const upcomingTrip = upcomingTripRow ? { id: upcomingTripRow.id, name: upcomingTripRow.name, startDate: upcomingTripRow.start_date } : null;

  let rounds: GroupRoundRow[] = [];
  const roundsByUserId: Record<string, GolferRoundRow[]> = {};

  if (GOLF_SCORING_ENABLED && tripIds.length > 0) {
    const { data: roundRows } = await supabase
      .from("rounds")
      .select("id, trip_id, round_date, hole_count, status")
      .in("trip_id", tripIds)
      .order("round_date", { ascending: false });
    const roundList = roundRows ?? [];
    const roundIds = roundList.map((r) => r.id);
    const [{ data: snapshotRows }, { data: roundPlayerRows }] = await Promise.all([
      roundIds.length
        ? supabase.from("round_course_snapshots").select("round_id, course_name").in("round_id", roundIds)
        : Promise.resolve({ data: [] as { round_id: string; course_name: string }[] }),
      roundIds.length
        ? supabase.from("round_players").select("round_id, trip_member_id").in("round_id", roundIds)
        : Promise.resolve({ data: [] as { round_id: string; trip_member_id: string }[] }),
    ]);
    const courseNameByRound = new Map((snapshotRows ?? []).map((s) => [s.round_id, s.course_name]));
    rounds = roundList.map((r) => ({
      id: r.id,
      tripId: r.trip_id,
      courseName: courseNameByRound.get(r.id) ?? "Course",
      roundDate: r.round_date,
      holeCount: r.hole_count,
      status: r.status,
    }));
    const roundById = new Map(rounds.map((r) => [r.id, r]));

    const tripMemberIds = [...new Set((roundPlayerRows ?? []).map((rp) => rp.trip_member_id))];
    const { data: tripMemberRows } = tripMemberIds.length
      ? await supabase.from("trip_members").select("id, user_id").in("id", tripMemberIds)
      : { data: [] as { id: string; user_id: string | null }[] };
    const userIdByTripMember = new Map((tripMemberRows ?? []).map((tm) => [tm.id, tm.user_id]));

    for (const rp of roundPlayerRows ?? []) {
      const userId = userIdByTripMember.get(rp.trip_member_id);
      const round = roundById.get(rp.round_id);
      if (!userId || !round) continue;
      const list = roundsByUserId[userId] ?? [];
      list.push({ id: round.id, tripId: round.tripId, courseName: round.courseName, roundDate: round.roundDate });
      roundsByUserId[userId] = list;
    }
  }

  const recentRound = rounds.find((r) => r.status === "completed" || r.status === "locked") ?? rounds[0] ?? null;

  const currentSeasonLeaderboard = GOLF_SCORING_ENABLED
    ? await loadGroupLeaderboard(supabase, groupId)
    : { season: { id: null, name: "", startDate: "", endDate: "" }, entries: [], availability: { stableford: false, skins: false, earnings: false } };
  const allTimeLeaderboard = GOLF_SCORING_ENABLED
    ? await loadGroupLeaderboard(supabase, groupId, { allTime: true })
    : currentSeasonLeaderboard;

  const memberStatsByUserId: Record<string, { roundsPlayed: number; grossAvg: number; netAvg: number; wins: number }> = {};
  for (const entry of allTimeLeaderboard.entries) {
    memberStatsByUserId[entry.userId] = {
      roundsPlayed: entry.roundsPlayed,
      grossAvg: entry.grossAvg,
      netAvg: entry.netAvg,
      wins: entry.wins,
    };
  }

  const invitations: GroupInvitationRow[] = [];
  if (isOwner) {
    const { data: invitationRows } = await supabase
      .from("golf_group_invitations")
      .select("id, email, invited_role, status, expires_at")
      .eq("group_id", groupId)
      .order("created_at", { ascending: false });
    invitations.push(...(invitationRows ?? []));
  }

  // ---- Expense balances across this group's trips (game-money
  // settlements stay on each round's own Settle page). ----
  let balanceLine: string | null = null;
  if (tripIds.length > 0) {
    const { data: myMemberships } = await supabase
      .from("trip_members")
      .select("id, trip_id")
      .eq("user_id", user.id)
      .in("trip_id", tripIds);
    const myMemberIds = (myMemberships ?? []).map((m) => m.id);
    const myMemberIdByTrip = new Map((myMemberships ?? []).map((m) => [m.trip_id, m.id]));

    if (myMemberIds.length > 0) {
      const [{ data: expensesRaw }, { data: myShares }, { data: myPayments }] = await Promise.all([
        supabase
          .from("expenses")
          .select("id, trip_id, total_amount_cents, paid_by_member_id, due_date")
          .in("trip_id", tripIds),
        supabase
          .from("expense_shares")
          .select("expense_id, trip_member_id, amount_owed_cents")
          .in("trip_member_id", myMemberIds),
        supabase
          .from("payments")
          .select("trip_id, payer_member_id, recipient_member_id, amount_cents, status")
          .or(`payer_member_id.in.(${myMemberIds.join(",")}),recipient_member_id.in.(${myMemberIds.join(",")})`),
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
      let total = 0;
      for (const tripId of tripIds) {
        const myMemberId = myMemberIdByTrip.get(tripId);
        if (!myMemberId) continue;
        const [balance] = calculateBalances(
          [{ id: myMemberId, displayName: "" }],
          expensesByTrip.get(tripId) ?? [],
          paymentsByTrip.get(tripId) ?? [],
        );
        if (balance) total += balance.amountOwedCents;
      }
      balanceLine = total > 0 ? `You owe ${formatCurrency(total)}` : "You're settled up";
    }
  }

  return (
    <div>
      <h1 className="text-2xl">{group.name}</h1>
      {group.description && <p className="mt-1.5 text-base text-charcoal-500">{group.description}</p>}

      <div className="mt-6">
        <GroupTabs
          group={{ id: group.id, name: group.name, description: group.description }}
          isOwner={isOwner}
          currentUserId={user.id}
          golfScoringEnabled={GOLF_SCORING_ENABLED}
          monetaryEnabled={MONETARY_GAME_VALUES_ENABLED}
          members={members}
          memberStatsByUserId={memberStatsByUserId}
          roundsByUserId={roundsByUserId}
          rounds={rounds}
          recentRound={recentRound}
          balanceLine={balanceLine}
          upcomingTrip={upcomingTrip}
          currentSeasonLeaderboard={currentSeasonLeaderboard}
          allTimeLeaderboard={allTimeLeaderboard}
          seasons={seasons}
          presets={presets}
          invitations={invitations}
        />
      </div>
    </div>
  );
}
