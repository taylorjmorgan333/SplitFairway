import { Target, Swords, Flag, Trophy, ListChecks, Bookmark } from "lucide-react";
import { Container } from "@/components/ui/container";

const GAME_FEATURES = [
  { icon: Target, label: "Skins" },
  { icon: Swords, label: "Nassau" },
  { icon: Flag, label: "Match Play" },
  { icon: Trophy, label: "Stableford" },
  { icon: ListChecks, label: "Gross, net and points standings" },
  { icon: Bookmark, label: "Saved game presets" },
] as const;

/** Every format listed here is a real, supported side_game_type (see
 * database.types.ts's side_game_type enum and src/lib/golf/{skins,
 * nassau}.ts + the match_play/stableford scoring in scoring.ts) --
 * nothing advertised that the app can't actually run today. */
function SkinsResultPreview() {
  return (
    <div className="mx-auto w-full max-w-sm rounded-2xl border border-forest-900/[0.08] bg-white p-5 shadow-card">
      <p className="text-xs font-medium uppercase tracking-wide text-charcoal-400">Skins — Final</p>
      <div className="mt-3 space-y-2">
        <div className="flex items-center justify-between rounded-xl bg-gold-50 px-3.5 py-2.5">
          <span className="text-sm font-medium text-forest-900">Taylor</span>
          <span className="text-sm font-medium text-gold-700">2 skins</span>
        </div>
        <div className="flex items-center justify-between rounded-xl bg-gold-50 px-3.5 py-2.5">
          <span className="text-sm font-medium text-forest-900">Tom</span>
          <span className="text-sm font-medium text-gold-700">4 skins</span>
        </div>
      </div>
    </div>
  );
}

export function GamesSection() {
  return (
    <section id="games" className="bg-forest-50 py-10 sm:py-20 lg:py-28">
      <Container>
        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <h2 className="text-3xl sm:text-4xl">Games and leaderboards, done automatically.</h2>
            <p className="mt-4 max-w-xl text-lg text-charcoal-500">
              Set up the games your group already plays and watch the standings update
              themselves as scores are entered.
            </p>
            <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-5">
              {GAME_FEATURES.map((feature) => (
                <div key={feature.label} className="flex items-center gap-3">
                  <feature.icon
                    className="h-5 w-5 shrink-0 text-forest-700"
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />
                  <span className="text-sm font-medium text-forest-900">{feature.label}</span>
                </div>
              ))}
            </div>
          </div>
          <SkinsResultPreview />
        </div>
      </Container>
    </section>
  );
}
