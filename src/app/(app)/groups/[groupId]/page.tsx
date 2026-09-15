import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Trophy, Flag } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import {
  RemoveGroupMemberButton,
  DeleteGroupPresetButton,
  DeleteGroupButton,
} from "@/components/groups/group-management";
import { AddGroupMemberForm } from "@/components/groups/add-group-member-form";
import { AddGamePresetForm } from "@/components/groups/add-game-preset-form";
import { loadGroupLeaderboard } from "@/lib/golf/group-leaderboard";
import { calculateBalances, type ExpenseInput, type PaymentInput } from "@/lib/balances";
import { formatCurrency, formatDate } from "@/lib/utils";
import { formatToPar } from "@/lib/golf/scoring";
import { GOLF_SCORING_ENABLED } from "@/lib/config";

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
  const [{ data: group }, { data: memberRows }, { data: presetRows }] = await Promise.all([
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
  ]);

  if (!group) {
    notFound();
  }

  const members = memberRows ?? [];
  const presets = presetRows ?? [];
  const me = members.find((m) => m.user_id === user.id);
  const isOwner = me?.role === "owner";

  // ---- Round history across every trip this group has ever hosted a
  // round on (both real trips linked via attach_trip_to_group and the
  // hidden trips start_group_round_trip creates). ----
  const { data: tripRows } = await supabase.from("trips").select("id, name, kind").eq("golf_group_id", groupId);
  const trips = tripRows ?? [];
  const tripIds = trips.map((t) => t.id);
  const tripNameById = new Map(trips.map((t) => [t.id, t.name]));

  let rounds: {
    id: string;
    tripId: string;
    courseName: string;
    roundDate: string;
    holeCount: number;
    status: string;
  }[] = [];

  if (GOLF_SCORING_ENABLED && tripIds.length > 0) {
    const { data: roundRows } = await supabase
      .from("rounds")
      .select("id, trip_id, round_date, hole_count, status")
      .in("trip_id", tripIds)
      .order("round_date", { ascending: false });
    const ids = (roundRows ?? []).map((r) => r.id);
    const { data: snapshotRows } = ids.length
      ? await supabase.from("round_course_snapshots").select("round_id, course_name").in("round_id", ids)
      : { data: [] as { round_id: string; course_name: string }[] };
    const courseNameByRound = new Map((snapshotRows ?? []).map((s) => [s.round_id, s.course_name]));
    rounds = (roundRows ?? []).map((r) => ({
      id: r.id,
      tripId: r.trip_id,
      courseName: courseNameByRound.get(r.id) ?? "Course",
      roundDate: r.round_date,
      holeCount: r.hole_count,
      status: r.status,
    }));
  }

  const leaderboard = GOLF_SCORING_ENABLED ? await loadGroupLeaderboard(supabase, groupId) : [];

  // ---- Expense balances across this group's trips (game-money
  // settlements stay on each round's own Settle page — see the link
  // below — rather than re-derived here). ----
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
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl">{group.name}</h1>
          {group.description && <p className="mt-1.5 text-base text-charcoal-500">{group.description}</p>}
          {isOwner && (
            <Link href={`/groups/${groupId}/edit`} className="mt-1.5 inline-block text-base font-medium text-forest-800 underline">
              Edit details
            </Link>
          )}
        </div>
        {GOLF_SCORING_ENABLED && (
          <ButtonLink href="/play/group" variant="gold" size="md">
            Start a Round
          </ButtonLink>
        )}
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-charcoal-400">Saved Golfers</h2>
            <Card className="mt-3">
              <CardContent className="divide-y divide-cream-200 p-0">
                {members.length === 0 && <p className="p-5 text-base text-charcoal-500">No golfers saved yet.</p>}
                {members.map((m) => (
                  <div key={m.id} className="flex items-center justify-between gap-3 p-5">
                    <div className="min-w-0">
                      <p className="text-base font-medium text-forest-900">
                        {m.display_name}
                        {m.role === "owner" && (
                          <Badge variant="forest" className="ml-2 align-middle">
                            Owner
                          </Badge>
                        )}
                      </p>
                      <p className="mt-0.5 text-sm text-charcoal-500">
                        {[
                          m.default_handicap_index != null ? `Handicap ${m.default_handicap_index}` : null,
                          m.preferred_tee_name ? `${m.preferred_tee_name} tees` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "No handicap or tee saved"}
                      </p>
                    </div>
                    {isOwner && m.user_id !== user.id && (
                      <RemoveGroupMemberButton groupId={groupId} memberId={m.id} displayName={m.display_name} />
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
            {isOwner && (
              <Card className="mt-4">
                <CardContent>
                  <p className="mb-4 text-base font-medium text-forest-900">Add a golfer</p>
                  <AddGroupMemberForm groupId={groupId} />
                </CardContent>
              </Card>
            )}
          </section>

          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-charcoal-400">Saved Game Presets</h2>
            <Card className="mt-3">
              <CardContent className="divide-y divide-cream-200 p-0">
                {presets.length === 0 && (
                  <p className="p-5 text-base text-charcoal-500">No game presets saved yet.</p>
                )}
                {presets.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-3 p-5">
                    <div className="min-w-0">
                      <p className="text-base font-medium text-forest-900">{p.name}</p>
                      <p className="mt-0.5 text-sm text-charcoal-500">
                        {p.side_game_type}
                        {(p.settings as { notes?: string } | null)?.notes
                          ? ` · ${(p.settings as { notes?: string }).notes}`
                          : ""}
                      </p>
                    </div>
                    {isOwner && <DeleteGroupPresetButton groupId={groupId} presetId={p.id} name={p.name} />}
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card className="mt-4">
              <CardContent>
                <p className="mb-4 text-base font-medium text-forest-900">Save a game preset</p>
                <AddGamePresetForm groupId={groupId} />
              </CardContent>
            </Card>
          </section>

          {GOLF_SCORING_ENABLED && (
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-charcoal-400">Round History</h2>
              {rounds.length === 0 ? (
                <p className="mt-3 text-base text-charcoal-500">No rounds played with this group yet.</p>
              ) : (
                <div className="mt-3 space-y-3">
                  {rounds.map((r) => (
                    <Link key={r.id} href={`/trips/${r.tripId}/rounds/${r.id}`} className="block">
                      <Card className="flex items-center justify-between gap-4 p-4 transition-shadow hover:shadow-card-hover">
                        <div className="min-w-0">
                          <p className="text-base font-medium text-forest-900">{r.courseName}</p>
                          <p className="text-sm text-charcoal-500">
                            {tripNameById.get(r.tripId)} · {formatDate(r.roundDate)}
                          </p>
                        </div>
                        <Badge variant="neutral">{r.holeCount} holes</Badge>
                      </Card>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          )}

          {isOwner && (
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-charcoal-400">Danger Zone</h2>
              <Card className="mt-3 border-red-200 bg-red-50/40 p-5">
                <p className="text-base text-charcoal-600">
                  Deleting this group removes it for everyone — golfers, saved presets, and this page. Rounds
                  already played are kept in Trips and are never affected.
                </p>
                <div className="mt-4">
                  <DeleteGroupButton groupId={groupId} groupName={group.name} />
                </div>
              </Card>
            </section>
          )}
        </div>

        <div className="space-y-8">
          {GOLF_SCORING_ENABLED && leaderboard.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-charcoal-400">Group Leaderboard</h2>
              <Card className="mt-3">
                <CardContent className="divide-y divide-cream-200 p-0">
                  {leaderboard.map((entry, i) => (
                    <div key={entry.userId} className="flex items-center justify-between gap-3 p-4">
                      <div className="flex items-center gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-forest-800/10 text-sm font-semibold text-forest-800">
                          {i === 0 ? <Trophy className="h-4 w-4" aria-hidden="true" /> : i + 1}
                        </span>
                        <div>
                          <p className="text-base font-medium text-forest-900">{entry.displayName}</p>
                          <p className="text-sm text-charcoal-500">
                            {entry.roundsPlayed} {entry.roundsPlayed === 1 ? "round" : "rounds"}
                          </p>
                        </div>
                      </div>
                      <span className="text-base font-semibold text-forest-900">{formatToPar(entry.avgToPar)}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
              <p className="mt-2 text-sm text-charcoal-400">Average score to par per round. Guests aren&apos;t included — see each round&apos;s own results for their scores.</p>
            </section>
          )}

          {balanceLine && (
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-charcoal-400">Balances</h2>
              <Card className="mt-3 p-5">
                <p className="text-lg font-medium text-forest-900">{balanceLine}</p>
                <p className="mt-1 text-sm text-charcoal-500">
                  Expenses across this group&apos;s rounds and trips. Game-money settlements are on each round&apos;s
                  own Settle page.
                </p>
              </Card>
            </section>
          )}

          {!GOLF_SCORING_ENABLED && (
            <Card className="p-5">
              <Flag className="h-5 w-5 text-forest-700" aria-hidden="true" />
              <p className="mt-2 text-base text-charcoal-500">
                Scoring isn&apos;t turned on for this account yet.
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
