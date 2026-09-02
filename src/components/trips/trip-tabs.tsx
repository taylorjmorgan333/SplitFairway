"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BalanceCards } from "@/components/trips/balance-cards";
import { SettlementView } from "@/components/trips/settlement-view";
import { ActivityFeed, type ActivityRow } from "@/components/trips/activity-feed";
import { ExpenseForm } from "@/components/trips/expense-form";
import { ExpenseList, type ExpenseRow } from "@/components/trips/expense-list";
import { PaymentForm } from "@/components/trips/payment-form";
import { PaymentsList, type PaymentRow } from "@/components/trips/payments-list";
import { MemberList, type MemberRow } from "@/components/trips/member-list";
import { InviteMemberForm } from "@/components/trips/invite-member-form";
import { EditTripForm } from "@/components/trips/edit-trip-form";
import { TripDangerZone } from "@/components/trips/trip-danger-zone";
import {
  RemindersTab,
  type OverdueCandidate,
  type DueSoonCandidate,
  type ConfirmCandidate,
  type InvitationCandidate,
} from "@/components/trips/reminders-tab";
import { OnboardingChecklist } from "@/components/trips/onboarding-checklist";
import { isStepDoneLocally, markStepDone } from "@/lib/onboarding";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { MemberBalance, SettlementSuggestion } from "@/lib/balances";
import type { Tables } from "@/lib/supabase/database.types";

type Member = { id: string; display_name: string };

const CAPTAIN_TABS = ["Overview", "Golfers", "Expenses", "Payments", "Reminders", "Activity", "Settings"] as const;
const MEMBER_TABS = ["Overview", "Golfers", "Expenses", "Payments", "Activity", "Settings"] as const;
type Tab = (typeof CAPTAIN_TABS)[number];

export type OverviewStats = {
  totalTripCostCents: number;
  paidOrConfirmedCents: number;
  outstandingCents: number;
  nextDueDate: string | null;
  activeGolferCount: number;
};

export type ReminderData = {
  overdue: OverdueCandidate[];
  dueSoon: DueSoonCandidate[];
  awaitingConfirmation: ConfirmCandidate[];
  invitations: InvitationCandidate[];
};

export function TripTabs({
  trip,
  isCaptain,
  isOwner,
  activeMembers,
  memberRows,
  currentUserMemberId,
  expenses,
  payments,
  activity,
  balances,
  settlements,
  overview,
  reminders,
}: {
  trip: Tables<"trips">;
  isCaptain: boolean;
  isOwner: boolean;
  activeMembers: Member[];
  memberRows: MemberRow[];
  currentUserMemberId: string | null;
  expenses: ExpenseRow[];
  payments: PaymentRow[];
  activity: ActivityRow[];
  balances: MemberBalance[];
  settlements: SettlementSuggestion[];
  overview: OverviewStats;
  reminders: ReminderData;
}) {
  const [tab, setTab] = useState<Tab>("Overview");
  const [reviewedBalances, setReviewedBalances] = useState(false);
  const myMembership = memberRows.find((m) => m.id === currentUserMemberId) ?? null;
  const tabs = isCaptain ? CAPTAIN_TABS : MEMBER_TABS;

  useEffect(() => {
    setReviewedBalances(isStepDoneLocally(trip.id, "reviewedBalances"));
  }, [trip.id]);

  function handleReviewBalances() {
    markStepDone(trip.id, "reviewedBalances");
    setReviewedBalances(true);
  }

  const hasGolfers = memberRows.some((m) => m.id !== currentUserMemberId);
  const onboardingSteps = [
    {
      key: "account",
      label: "Create your account",
      description: "Done — you're signed in.",
      done: true,
    },
    {
      key: "trip",
      label: "Create your golf trip",
      description: `Done — "${trip.name}" is set up.`,
      done: true,
    },
    {
      key: "golfers",
      label: "Add your golfers",
      description: "Invite everyone who's coming from the Golfers tab.",
      done: hasGolfers,
      onGo: () => setTab("Golfers"),
      goLabel: "Add golfers",
    },
    {
      key: "expense",
      label: "Add the first expense",
      description: "Lodging, tee times, whatever it was — add it from the Expenses tab.",
      done: expenses.length > 0,
      onGo: () => setTab("Expenses"),
      goLabel: "Add expense",
    },
    {
      key: "balances",
      label: "Review everyone's balances",
      description: "See who owes what on the Overview tab below.",
      done: reviewedBalances,
      onGo: handleReviewBalances,
      goLabel: "Review balances",
    },
    {
      key: "invite",
      label: "Share the invitation link",
      description: "Copy each golfer's link from the Golfers tab and send it their way.",
      done: hasGolfers,
      onGo: () => setTab("Golfers"),
      goLabel: "Go to Golfers",
    },
  ];

  return (
    <div>
      <div className="flex w-fit flex-wrap gap-1 rounded-full bg-cream-200 p-1">
        {tabs.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={
              tab === t
                ? "rounded-full bg-white px-4 py-1.5 text-sm font-medium text-forest-900 shadow-card"
                : "rounded-full px-4 py-1.5 text-sm text-charcoal-500 transition-colors hover:text-charcoal"
            }
          >
            {t}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "Overview" && (
          <div className="space-y-6">
            {isCaptain && <OnboardingChecklist tripId={trip.id} steps={onboardingSteps} />}
            <OverviewTab
              overview={overview}
              balances={balances}
              settlements={settlements}
              currentMemberId={currentUserMemberId}
              activity={activity}
            />
          </div>
        )}

        {tab === "Golfers" && (
          <Card>
            <CardHeader>
              <CardTitle>Golfers</CardTitle>
              <CardDescription>
                Everyone tracking expenses and payments on this trip.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {memberRows.length === 0 ? (
                <p className="text-sm text-charcoal-500">No golfers yet.</p>
              ) : (
                <MemberList
                  tripId={trip.id}
                  members={memberRows}
                  isCaptain={isCaptain}
                  currentUserMemberId={currentUserMemberId}
                  ownerUserId={trip.owner_id}
                  isOwner={isOwner}
                />
              )}
              {isCaptain && (
                <div className="border-t border-forest-900/[0.06] pt-6">
                  <h4 className="mb-3 font-serif text-base text-forest-900">Invite a golfer</h4>
                  <p className="mb-3 text-xs text-charcoal-400">
                    Add anyone to the trip — make them a co-treasurer if they should share full
                    captain access.
                  </p>
                  <InviteMemberForm tripId={trip.id} />
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {tab === "Expenses" && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Expenses</CardTitle>
                <CardDescription>
                  Lodging, tee times, rental cars — everything the trip cost.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ExpenseList
                  tripId={trip.id}
                  expenses={expenses}
                  isCaptain={isCaptain}
                  members={activeMembers}
                />
              </CardContent>
            </Card>

            {isCaptain && activeMembers.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Add an expense</CardTitle>
                </CardHeader>
                <CardContent>
                  <ExpenseForm tripId={trip.id} members={activeMembers} />
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {tab === "Payments" && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Payments</CardTitle>
                <CardDescription>
                  Reported outside this app (Venmo, Zelle, cash...) and logged here.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PaymentsList
                  tripId={trip.id}
                  payments={payments}
                  isCaptain={isCaptain}
                  currentUserMemberId={currentUserMemberId}
                />
              </CardContent>
            </Card>

            {myMembership && myMembership.status === "active" && (
              <Card>
                <CardHeader>
                  <CardTitle>Report a payment</CardTitle>
                </CardHeader>
                <CardContent>
                  <PaymentForm
                    tripId={trip.id}
                    payerMemberId={myMembership.id}
                    recipients={activeMembers.filter((m) => m.id !== myMembership.id)}
                  />
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {tab === "Reminders" && isCaptain && (
          <RemindersTab
            tripId={trip.id}
            tripName={trip.name}
            overdue={reminders.overdue}
            dueSoon={reminders.dueSoon}
            awaitingConfirmation={reminders.awaitingConfirmation}
            invitations={reminders.invitations}
          />
        )}

        {tab === "Activity" && (
          <Card>
            <CardHeader>
              <CardTitle>Activity</CardTitle>
              <CardDescription>Everything that&apos;s happened on this trip, most recent first.</CardDescription>
            </CardHeader>
            <CardContent>
              <ActivityFeed activity={activity} />
            </CardContent>
          </Card>
        )}

        {tab === "Settings" && (
          <div className="space-y-6">
            {isCaptain ? (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>Trip settings</CardTitle>
                    <CardDescription>Visible to every golfer on the trip.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <EditTripForm trip={trip} />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>Danger zone</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <TripDangerZone trip={trip} />
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>About this trip</CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className="space-y-3 text-sm">
                    <div>
                      <dt className="text-charcoal-400">Destination</dt>
                      <dd className="text-charcoal">{trip.destination || "TBD"}</dd>
                    </div>
                  </dl>
                  <p className="mt-4 text-xs text-charcoal-400">
                    Only trip captains can edit these details or manage golfers.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function OverviewTab({
  overview,
  balances,
  settlements,
  currentMemberId,
  activity,
}: {
  overview: OverviewStats;
  balances: MemberBalance[];
  settlements: SettlementSuggestion[];
  currentMemberId: string | null;
  activity: ActivityRow[];
}) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Total trip cost" value={formatCurrency(overview.totalTripCostCents)} />
        <Stat label="Paid or confirmed" value={formatCurrency(overview.paidOrConfirmedCents)} />
        <Stat label="Outstanding" value={formatCurrency(overview.outstandingCents)} />
        <Stat
          label="Next payment due"
          value={overview.nextDueDate ? formatDate(overview.nextDueDate) : "None scheduled"}
        />
        <Stat label="Active golfers" value={String(overview.activeGolferCount)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Who owes what?</CardTitle>
          <CardDescription>
            A suggested minimum set of reimbursements to settle up on confirmed balances. Nothing
            here creates a payment automatically — golfers still report and captains still confirm.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SettlementView balances={balances} suggestions={settlements} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Golfer balances</CardTitle>
        </CardHeader>
        <CardContent>
          <BalanceCards balances={balances} currentMemberId={currentMemberId} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
        </CardHeader>
        <CardContent>
          <ActivityFeed activity={activity} limit={8} />
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-forest-900/[0.08] bg-white p-4 shadow-card">
      <p className="text-xs font-medium uppercase tracking-wide text-charcoal-400">{label}</p>
      <p className="mt-1 text-lg font-medium text-forest-900">{value}</p>
    </div>
  );
}
