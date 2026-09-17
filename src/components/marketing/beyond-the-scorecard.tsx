import { GlassWater, MapPin, RotateCcw, Hash, Award, TrendingUp, Share2 } from "lucide-react";
import { Container } from "@/components/ui/container";

const TAGS = ["19th Hole counters", "Season standings", "Custom awards", "Shareable recaps"];

const COUNTERS = [
  { icon: GlassWater, label: "Drinks", value: "3" },
  { icon: MapPin, label: "Lost Balls", value: "2" },
  { icon: RotateCcw, label: "Mulligans", value: "4" },
  { icon: Hash, label: "3-Putts", value: "5" },
] as const;

/** One visual example standing in for all four combined ideas (19th
 * Hole counters, season standings, custom awards, shareable recaps) --
 * tasteful and not alcohol-centered: one counter out of four
 * references drinks, styled identically to the other three. */
function BeyondScorecardPreview() {
  return (
    <div className="mx-auto w-full max-w-sm rounded-2xl border border-forest-900/[0.08] bg-white p-5 shadow-card">
      <p className="text-xs font-medium uppercase tracking-wide text-charcoal-400">19th Hole · Recap</p>
      <div className="mt-3 grid grid-cols-2 gap-3">
        {COUNTERS.map((counter) => (
          <div key={counter.label} className="rounded-xl bg-cream-100 px-3.5 py-3">
            <counter.icon className="h-4 w-4 text-forest-700" strokeWidth={1.75} aria-hidden="true" />
            <p className="mt-2 font-serif text-xl text-forest-900">{counter.value}</p>
            <p className="text-xs text-charcoal-500">{counter.label}</p>
          </div>
        ))}
      </div>
      <div className="mt-3 space-y-2">
        <div className="flex items-center gap-2.5 rounded-xl bg-gold-50 px-3.5 py-2.5">
          <Award className="h-4 w-4 shrink-0 text-gold-700" aria-hidden="true" />
          <p className="text-xs font-medium text-forest-900">Longest Drive — Taylor</p>
        </div>
        <div className="flex items-center gap-2.5 rounded-xl bg-cream-100 px-3.5 py-2.5">
          <TrendingUp className="h-4 w-4 shrink-0 text-forest-700" aria-hidden="true" />
          <p className="text-xs font-medium text-forest-900">Season Rank — 2nd</p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-center gap-2 rounded-full border border-forest-900/15 py-1.5 text-xs font-medium text-forest-800">
        <Share2 className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
        Share Recap
      </div>
    </div>
  );
}

/**
 * Combines what used to be three separate ideas spread across the
 * homepage -- the 19th Hole section, season standings (previously
 * shown again inside GroupsSection), and awards/recaps -- into one
 * concise section with a single visual, per the "Beyond the Scorecard"
 * spec item. Nothing here is repeated in Games and Leaderboards
 * (per-round game standings) or the Weekly Groups tab (which only
 * name-drops "standings" as a bullet, not an explanation).
 */
export function BeyondTheScorecardSection() {
  return (
    <section id="beyond-the-scorecard" className="bg-forest-50 py-10 sm:py-20 lg:py-28">
      <Container>
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <h2 className="text-3xl sm:text-4xl">Beyond the Scorecard</h2>
            <p className="mt-4 max-w-xl text-lg text-charcoal-500">
              SplitFairway tracks the moments and competition your group actually remembers —
              19th Hole counters, season standings, custom awards and shareable recaps.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {TAGS.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-forest-800/[0.06] px-3 py-1 text-xs font-medium text-forest-800"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
          <BeyondScorecardPreview />
        </div>
      </Container>
    </section>
  );
}
