import Link from "next/link";
import { Flag, ChevronRight, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { formatDate, formatTeeTime } from "@/lib/utils";

/**
 * Every card on Home follows the same rule: it only renders when it has
 * something real to say (see each section's caller in
 * src/app/(app)/home/page.tsx), and text here is text-base (16px)
 * minimum and up, not the text-sm/text-xs used on some older screens --
 * Home is the one screen every golfer, including one who's never used
 * the app before, lands on first.
 */

export function ContinueRoundCard({
  tripName,
  courseName,
  holesCompleted,
  holeCount,
  href,
}: {
  tripName: string;
  courseName: string;
  holesCompleted: number;
  holeCount: number;
  href: string;
}) {
  return (
    <Card className="border-forest-800/15 bg-forest-900 p-6 text-cream-50 shadow-card">
      <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gold-300">
        <Flag className="h-4 w-4" aria-hidden="true" />
        Round in progress
      </div>
      <p className="mt-3 font-serif text-2xl">{courseName}</p>
      <p className="mt-1 text-base text-cream-100/80">{tripName}</p>
      <p className="mt-4 text-base text-cream-100/90">
        {holesCompleted} of {holeCount} holes scored
      </p>
      <ButtonLink href={href} variant="gold" size="lg" className="mt-5 flex w-full justify-center sm:w-auto">
        Continue Scoring
      </ButtonLink>
    </Card>
  );
}

export function UpcomingCard({
  title,
  subtitle,
  dateLabel,
  href,
  actionLabel,
}: {
  title: string;
  subtitle?: string;
  dateLabel: string;
  href: string;
  actionLabel: string;
}) {
  return (
    <Link href={href} className="block">
      <Card className="flex items-center justify-between gap-4 p-5 transition-shadow hover:shadow-card-hover">
        <div className="min-w-0">
          <p className="text-base font-medium text-forest-900">{title}</p>
          {subtitle && <p className="mt-0.5 text-base text-charcoal-500">{subtitle}</p>}
          <p className="mt-1 text-sm text-charcoal-400">{dateLabel}</p>
        </div>
        <span className="flex shrink-0 items-center gap-1 text-base font-medium text-forest-800">
          {actionLabel}
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </span>
      </Card>
    </Link>
  );
}

export interface HomeGroupSummary {
  id: string;
  name: string;
  memberCount: number;
}

export function GroupsSection({ groups }: { groups: HomeGroupSummary[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {groups.map((group) => (
        <Link key={group.id} href={`/groups/${group.id}`} className="block">
          <Card className="flex items-center justify-between gap-3 p-4 transition-shadow hover:shadow-card-hover">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-forest-800/10">
                <Users className="h-5 w-5 text-forest-700" aria-hidden="true" strokeWidth={1.75} />
              </span>
              <div>
                <p className="text-base font-medium text-forest-900">{group.name}</p>
                <p className="text-sm text-charcoal-500">
                  {group.memberCount} {group.memberCount === 1 ? "golfer" : "golfers"}
                </p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-charcoal-400" aria-hidden="true" />
          </Card>
        </Link>
      ))}
    </div>
  );
}

export interface HomeRecentRound {
  id: string;
  tripId: string;
  tripName: string;
  courseName: string;
  roundDate: string;
  holeCount: number;
  href: string;
}

export function RecentRoundsSection({ rounds }: { rounds: HomeRecentRound[] }) {
  return (
    <div className="space-y-3">
      {rounds.map((round) => (
        <Link key={round.id} href={round.href} className="block">
          <Card className="flex items-center justify-between gap-4 p-4 transition-shadow hover:shadow-card-hover">
            <div className="min-w-0">
              <p className="text-base font-medium text-forest-900">{round.courseName}</p>
              <p className="text-sm text-charcoal-500">
                {round.tripName} · {formatDate(round.roundDate)}
              </p>
            </div>
            <Badge variant="neutral">{round.holeCount} holes</Badge>
          </Card>
        </Link>
      ))}
    </div>
  );
}

export function formatRoundWhen(roundDate: string, startTime: string | null) {
  return startTime ? `${formatDate(roundDate)} · ${formatTeeTime(startTime)}` : formatDate(roundDate);
}
