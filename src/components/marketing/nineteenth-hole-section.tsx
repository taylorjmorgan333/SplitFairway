import { GlassWater, MapPin, RotateCcw, Hash, Award } from "lucide-react";
import { Container } from "@/components/ui/container";

const TAGS = ["Drinks", "Lost Balls", "Mulligans", "3-Putts", "Custom counters", "Post-round awards"];

const COUNTERS = [
  { icon: GlassWater, label: "Drinks", value: "3" },
  { icon: MapPin, label: "Lost Balls", value: "2" },
  { icon: RotateCcw, label: "Mulligans", value: "4" },
  { icon: Hash, label: "3-Putts", value: "5" },
] as const;

/** Tasteful, not alcohol-centered: one counter out of four references
 * drinks, styled identically to the other three, and the section leads
 * with the awards/records framing rather than a drinking theme. */
function NineteenthHolePreview() {
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
      <div className="mt-3 flex items-center gap-2.5 rounded-xl bg-gold-50 px-3.5 py-2.5">
        <Award className="h-4 w-4 shrink-0 text-gold-700" aria-hidden="true" />
        <p className="text-xs font-medium text-forest-900">Longest Drive — Taylor</p>
      </div>
    </div>
  );
}

export function NineteenthHoleSection() {
  return (
    <section id="nineteenth-hole" className="bg-forest-50 py-20 sm:py-28">
      <Container>
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <h2 className="text-3xl sm:text-4xl">The stats that don&apos;t make the scorecard.</h2>
            <p className="mt-4 max-w-xl text-lg text-charcoal-500">
              Track the moments your group actually talks about after the round—from lost balls
              and mulligans to drinks, custom awards and trip records.
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
            <p className="mt-6 text-sm leading-relaxed text-charcoal-500">
              Basic counters are free for every golfer. Custom counters, group records and awards
              are included with Organizer Pro or a Trip Pass.
            </p>
          </div>
          <NineteenthHolePreview />
        </div>
      </Container>
    </section>
  );
}
