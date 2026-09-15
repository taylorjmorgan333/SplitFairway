"use client";

import { useState } from "react";
import Link from "next/link";
import { Trophy } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { AddGroupMemberForm } from "@/components/groups/add-group-member-form";
import { AddGamePresetForm } from "@/components/groups/add-game-preset-form";
import { PresetCard } from "@/components/groups/preset-card";
import { GolferCard, type GolferRoundRow } from "@/components/groups/golfer-card";
import { InviteGroupForm } from "@/components/groups/invite-group-form";
import { GroupInvitationsList, type GroupInvitationRow } from "@/components/groups/group-invitations-list";
import { CreateGroupSeasonForm } from "@/components/groups/create-group-season-form";
import { DeleteGroupButton } from "@/components/groups/group-management";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { GroupLeaderboardResult } from "@/lib/golf/group-leaderboard";

const TABS = ["Overview", "Rounds", "Leaderboard", "Golfers", "Settings"] as const;
type Tab = (typeof TABS)[number];

export interface GroupMemberRow {
  id: string;
  userId: string | null;
  displayName: string;
  email: string | null;
  role: "owner" | "member";
  defaultHandicapIndex: number | null;
  preferredTeeName: string | null;
}

export interface GroupRoundRow {
  id: string;
  tripId: string;
  courseName: string;
  roundDate: string;
  holeCount: number;
  status: string;
}

export interface PresetRow {
  id: string;
  name: string;
  side_game_type: string;
  settings: { scoringMetric?: "gross" | "net"; carryover?: boolean; isMonetary?: boolean; dollarValue?: number | null };
}

export interface SeasonRow {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
}

/**
 * The Group dashboard's five tabs (spec item 1): Overview, Rounds,
 * Leaderboard, Golfers, Settings. Client-side tab switching (no route
 * change) mirrors TripTabs' own pattern (trip-tabs.tsx) rather than
 * introducing a second navigation convention for essentially the same
 * kind of page.
 */
export function GroupTabs({
  group,
  isOwner,
  currentUserId,
  golfScoringEnabled,
  monetaryEnabled,
  members,
  memberStatsByUserId,
  roundsByUserId,
  rounds,
  recentRound,
  balanceLine,
  upcomingTrip,
  currentSeasonLeaderboard,
  allTimeLeaderboard,
  seasons,
  presets,
  invitations,
}: {
  group: { id: string; name: string; description: string | null };
  isOwner: boolean;
  currentUserId: string;
  golfScoringEnabled: boolean;
  monetaryEnabled: boolean;
  members: GroupMemberRow[];
  memberStatsByUserId: Record<string, { roundsPlayed: number; grossAvg: number; netAvg: number; wins: number }>;
  roundsByUserId: Record<string, GolferRoundRow[]>;
  rounds: GroupRoundRow[];
  recentRound: GroupRoundRow | null;
  balanceLine: string | null;
  upcomingTrip: { id: string; name: string; startDate: string | null } | null;
  currentSeasonLeaderboard: GroupLeaderboardResult;
  allTimeLeaderboard: GroupLeaderboardResult;
  seasons: SeasonRow[];
  presets: PresetRow[];
  invitations: GroupInvitationRow[];
}) {
  const [tab, setTab] = useState<Tab>("Overview");
  const [showAllTime, setShowAllTime] = useState(false);
  const [showSeasonForm, setShowSeasonForm] = useState(false);
  const [showPresetForm, setShowPresetForm] = useState(false);

  const leaderboard = showAllTime ? allTimeLeaderboard : currentSeasonLeaderboard;
  const topThree = currentSeasonLeaderboard.entries.slice(0, 3);

  return (
    <div>
      <div className="-mx-5 overflow-x-auto px-5 sm:mx-0 sm:px-0">
        <div className="flex w-fit gap-1 rounded-full bg-cream-200 p-1">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={
                tab === t
                  ? "shrink-0 rounded-full bg-white px-4 py-3 text-sm font-medium text-forest-900 shadow-card sm:py-1.5"
                  : "shrink-0 rounded-full px-4 py-3 text-sm text-charcoal-500 transition-colors hover:text-charcoal sm:py-1.5"
              }
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6">
        {tab === "Overview" && (
          <div className="space-y-6">
            {golfScoringEnabled && (
              <ButtonLink href={`/play/group/${group.id}/start`} variant="gold" size="lg" className="flex w-full justify-center">
                Start a Group Round
              </ButtonLink>
            )}

            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-charcoal-400">Most Recent Round</h2>
              {recentRound ? (
                <Card className="mt-3 flex items-center justify-between gap-4 p-4">
                  <div className="min-w-0">
                    <p className="text-base font-medium text-forest-900">{recentRound.courseName}</p>
                    <p className="text-sm text-charcoal-500">{formatDate(recentRound.roundDate)}</p>
                  </div>
                  <ButtonLink href={`/trips/${recentRound.tripId}/rounds/${recentRound.id}/results`} variant="outline" size="sm">
                    View Results
                  </ButtonLink>
                </Card>
              ) : (
                <p className="mt-2 text-base text-charcoal-500">No rounds played with this group yet.</p>
              )}
            </section>

            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-charcoal-400">Current Season Leaders</h2>
              {topThree.length > 0 ? (
                <Card className="mt-3">
                  <CardContent className="divide-y divide-cream-200 p-0">
                    {topThree.map((entry, i) => (
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
                        <span className="text-base font-semibold text-forest-900">{entry.netAvg}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ) : (
                <p className="mt-2 text-base text-charcoal-500">
                  No completed rounds yet this season -- standings will show up here once one is finished.
                </p>
              )}
            </section>

            {balanceLine && (
              <section>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-charcoal-400">Balances</h2>
                <Card className="mt-3 p-5">
                  <p className="text-lg font-medium text-forest-900">{balanceLine}</p>
                </Card>
              </section>
            )}

            {upcomingTrip && (
              <section>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-charcoal-400">Upcoming Trip</h2>
                <Link href={`/trips/${upcomingTrip.id}`} className="mt-3 block">
                  <Card className="flex items-center justify-between gap-4 p-4 transition-shadow hover:shadow-card-hover">
                    <div className="min-w-0">
                      <p className="text-base font-medium text-forest-900">{upcomingTrip.name}</p>
                      {upcomingTrip.startDate && <p className="text-sm text-charcoal-500">{formatDate(upcomingTrip.startDate)}</p>}
                    </div>
                  </Card>
                </Link>
              </section>
            )}
          </div>
        )}

        {tab === "Rounds" && (
          <div>
            {rounds.length === 0 ? (
              <p className="text-base text-charcoal-500">No rounds played with this group yet.</p>
            ) : (
              <div className="space-y-3">
                {rounds.map((r) => (
                  <Link key={r.id} href={`/trips/${r.tripId}/rounds/${r.id}`} className="block">
                    <Card className="flex items-center justify-between gap-4 p-4 transition-shadow hover:shadow-card-hover">
                      <div className="min-w-0">
                        <p className="text-base font-medium text-forest-900">{r.courseName}</p>
                        <p className="text-sm text-charcoal-500">{formatDate(r.roundDate)}</p>
                      </div>
                      <Badge variant="neutral">{r.holeCount} holes</Badge>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "Leaderboard" && (
          <div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-base text-charcoal-600">{leaderboard.season.name}</p>
              <button
                type="button"
                onClick={() => setShowAllTime((v) => !v)}
                className="text-sm font-medium text-forest-700 underline hover:no-underline"
              >
                {showAllTime ? "View current season" : "View all-time"}
              </button>
            </div>

            {leaderboard.entries.length === 0 ? (
              <p className="mt-4 text-base text-charcoal-500">
                No completed rounds yet -- standings show up here once a round is finished.
              </p>
            ) : (
              <Card className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[480px] text-sm">
                  <thead>
                    <tr className="border-b border-cream-200 text-left text-xs uppercase tracking-wide text-charcoal-400">
                      <th className="px-3 py-2">Golfer</th>
                      <th className="px-3 py-2 text-right">Rounds</th>
                      <th className="px-3 py-2 text-right">Gross</th>
                      <th className="px-3 py-2 text-right">Net</th>
                      <th className="px-3 py-2 text-right">Wins</th>
                      {leaderboard.availability.skins && <th className="px-3 py-2 text-right">Skins</th>}
                      {leaderboard.availability.stableford && <th className="px-3 py-2 text-right">Points</th>}
                      {leaderboard.availability.earnings && <th className="px-3 py-2 text-right">Earnings</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.entries.map((e) => (
                      <tr key={e.userId} className="border-b border-cream-100 last:border-0">
                        <td className="px-3 py-2.5 font-medium text-forest-900">{e.displayName}</td>
                        <td className="px-3 py-2.5 text-right text-charcoal-700">{e.roundsPlayed}</td>
                        <td className="px-3 py-2.5 text-right text-charcoal-700">{e.grossAvg}</td>
                        <td className="px-3 py-2.5 text-right text-charcoal-700">{e.netAvg}</td>
                        <td className="px-3 py-2.5 text-right text-charcoal-700">{e.wins}</td>
                        {leaderboard.availability.skins && <td className="px-3 py-2.5 text-right text-charcoal-700">{e.skinsWon}</td>}
                        {leaderboard.availability.stableford && (
                          <td className="px-3 py-2.5 text-right text-charcoal-700">{e.stablefordPoints}</td>
                        )}
                        {leaderboard.availability.earnings && (
                          <td className={`px-3 py-2.5 text-right ${e.earningsCents >= 0 ? "text-forest-700" : "text-red-700"}`}>
                            {e.earningsCents === 0 ? "—" : formatCurrency(Math.abs(e.earningsCents))}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            )}

            {isOwner && (
              <div className="mt-6">
                <button
                  type="button"
                  onClick={() => setShowSeasonForm((v) => !v)}
                  className="text-sm font-medium text-forest-700 underline hover:no-underline"
                >
                  {showSeasonForm ? "Cancel" : "Create a custom season"}
                </button>
                {showSeasonForm && (
                  <Card className="mt-3 p-5">
                    <CreateGroupSeasonForm groupId={group.id} onSaved={() => setShowSeasonForm(false)} />
                  </Card>
                )}
                {seasons.length > 0 && (
                  <p className="mt-3 text-sm text-charcoal-500">
                    Seasons: {seasons.map((s) => s.name).join(", ")}. Every group defaults to the calendar
                    year unless a custom one covers today.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {tab === "Golfers" && (
          <div>
            <Card className="divide-y divide-cream-200 p-0">
              {members.map((m) => (
                <GolferCard
                  key={m.id}
                  groupId={group.id}
                  isOwner={isOwner}
                  isMe={m.userId === currentUserId}
                  member={m}
                  stats={m.userId ? (memberStatsByUserId[m.userId] ?? { roundsPlayed: 0, grossAvg: 0, netAvg: 0, wins: 0 }) : null}
                  rounds={m.userId ? (roundsByUserId[m.userId] ?? []) : []}
                />
              ))}
            </Card>
            {isOwner && (
              <Card className="mt-4 p-5">
                <p className="mb-4 text-base font-medium text-forest-900">Add a golfer</p>
                <AddGroupMemberForm groupId={group.id} />
              </Card>
            )}
          </div>
        )}

        {tab === "Settings" && (
          <div className="space-y-8">
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-charcoal-400">Group Details</h2>
              <Card className="mt-3 p-5">
                <p className="text-base text-forest-900">{group.name}</p>
                {group.description && <p className="mt-1 text-sm text-charcoal-500">{group.description}</p>}
                {isOwner && (
                  <Link href={`/groups/${group.id}/edit`} className="mt-2 inline-block text-sm font-medium text-forest-800 underline">
                    Edit details
                  </Link>
                )}
              </Card>
            </section>

            {isOwner && (
              <section>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-charcoal-400">Invitations</h2>
                <Card className="mt-3 p-5">
                  <GroupInvitationsList groupId={group.id} invitations={invitations} />
                </Card>
                <Card className="mt-3 p-5">
                  <InviteGroupForm groupId={group.id} groupName={group.name} />
                </Card>
              </section>
            )}

            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-charcoal-400">Saved Game Presets</h2>
              <Card className="mt-3 divide-y divide-cream-200 p-0">
                {presets.length === 0 && <p className="p-5 text-base text-charcoal-500">No game presets saved yet.</p>}
                {presets.map((p) => (
                  <PresetCard key={p.id} groupId={group.id} isOwner={isOwner} monetaryEnabled={monetaryEnabled} preset={p} />
                ))}
              </Card>
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => setShowPresetForm((v) => !v)}
                  className="text-sm font-medium text-forest-700 underline hover:no-underline"
                >
                  {showPresetForm ? "Cancel" : "Save a new preset"}
                </button>
                {showPresetForm && (
                  <Card className="mt-3 p-5">
                    <AddGamePresetForm groupId={group.id} monetaryEnabled={monetaryEnabled} onSaved={() => setShowPresetForm(false)} />
                  </Card>
                )}
              </div>
            </section>

            {isOwner && (
              <section>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-charcoal-400">Danger Zone</h2>
                <Card className="mt-3 border-red-200 bg-red-50/40 p-5">
                  <p className="text-base text-charcoal-600">
                    Deleting this group removes it for everyone — golfers, saved presets, and this page.
                    Rounds already played are kept in Trips and are never affected.
                  </p>
                  <div className="mt-4">
                    <DeleteGroupButton groupId={group.id} groupName={group.name} />
                  </div>
                </Card>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
