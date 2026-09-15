import { Users, Flag, Hash, Zap, TrendingUp, History, UserPlus } from "lucide-react";
import { Container } from "@/components/ui/container";
import { ButtonLink } from "@/components/ui/button";

const GROUP_HIGHLIGHTS = [
  { icon: Users, label: "Saved golfers" },
  { icon: Flag, label: "Preferred tees" },
  { icon: Hash, label: "Current handicap snapshots" },
  { icon: Zap, label: "Quick Group Round" },
  { icon: TrendingUp, label: "Season leaderboard" },
  { icon: History, label: "Round and game history" },
  { icon: UserPlus, label: "Invitations and guest scoring" },
] as const;

function SeasonStandingsPreview() {
  const rows = [
    { name: "Taylor", points: "142 pts" },
    { name: "Tom", points: "128 pts" },
    { name: "Jordan", points: "115 pts" },
  ];
  return (
    <div className="mx-auto w-full max-w-sm rounded-2xl border border-forest-900/[0.08] bg-white p-5 shadow-card">
      <p className="text-xs font-medium uppercase tracking-wide text-charcoal-400">
        Saturday Group · Season
      </p>
      <div className="mt-3 space-y-2">
        {rows.map((row, i) => (
          <div
            key={row.name}
            className="flex items-center justify-between rounded-xl bg-cream-100 px-3.5 py-2.5"
          >
            <span className="text-sm font-medium text-forest-900">
              {i + 1}. {row.name}
            </span>
            <span className="text-sm text-charcoal-500">{row.points}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function GroupsSection() {
  return (
    <section id="groups" className="bg-cream-50 py-20 sm:py-28">
      <Container>
        <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <SeasonStandingsPreview />
          <div>
            <h2 className="text-3xl sm:text-4xl">Your group remembers everything.</h2>
            <p className="mt-4 max-w-xl text-lg text-charcoal-500">
              Keep the same golfers, handicaps, preferred tees and game settings ready for next
              weekend. Follow the season without rebuilding the group every round.
            </p>
            <div className="mt-8 grid gap-x-8 gap-y-5 sm:grid-cols-2">
              {GROUP_HIGHLIGHTS.map((item) => (
                <div key={item.label} className="flex items-center gap-3">
                  <item.icon
                    className="h-5 w-5 shrink-0 text-forest-700"
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />
                  <span className="text-sm font-medium text-forest-900">{item.label}</span>
                </div>
              ))}
            </div>
            <div className="mt-8">
              <ButtonLink href="/signup" variant="primary" size="lg">
                Start Your Group
              </ButtonLink>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
