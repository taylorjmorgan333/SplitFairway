import { Logo } from "@/components/ui/logo";

type ScoreRow = { name: string; score: number };

const SCORES: ScoreRow[] = [
  { name: "Taylor", score: 4 },
  { name: "Tom", score: 5 },
];

const LEADERBOARD = [
  { name: "Taylor", toPar: "−2" },
  { name: "Tom", toPar: "+1" },
];

const TABS = ["Scorecard", "Games", "Leaderboard"] as const;

const NAV_ICON_PATHS = {
  home: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3 10.5 12 3l9 7.5M5 9v11a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9"
    />
  ),
  plus: <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />,
  user: (
    <>
      <circle cx="12" cy="8" r="3.5" strokeLinecap="round" strokeLinejoin="round" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 20a7.5 7.5 0 0 1 15 0" />
    </>
  ),
};

/**
 * The hero's main product preview -- a static (no client JS, no
 * animation) recreation of an in-progress round, matching the real
 * app's actual screens (course/hole header, segmented Scorecard/Games/
 * Leaderboard tabs, circular +/- score controls, a game-result banner)
 * rather than inventing a different interface. Deliberately static:
 * the previous animated trip-balance mockup (phone-preview.tsx) added
 * client JS and a timer loop just to cycle through scenes, and the
 * spec for this redesign explicitly favors "no unnecessary animation"
 * and "no autoplay carousel ... required to understand the product" --
 * a single, readable frame of an everyday round does that with zero
 * runtime cost.
 */
export function RoundPreview() {
  return (
    <div aria-hidden="true" className="relative w-[250px] shrink-0 sm:w-[270px]">
      <div className="rounded-[2.75rem] border-[6px] border-cream-50/10 bg-forest-900 p-1.5 shadow-2xl shadow-black/50">
        <div className="relative h-[540px] overflow-hidden rounded-[2.15rem] bg-cream-50">
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center pt-2">
            <div className="h-5 w-24 rounded-full bg-forest-950" />
          </div>

          <div className="flex h-full flex-col pt-8">
            <div className="flex items-center justify-between border-b border-forest-900/[0.06] px-3.5 py-2.5">
              <div className="origin-left scale-[0.82]">
                <Logo />
              </div>
              <div className="h-6 w-6 rounded-full bg-forest-800/10" />
            </div>

            <div className="flex-1 space-y-3 px-3.5 py-3.5">
              <p className="text-[10px] font-medium text-charcoal-400">Plum Creek Golf Club</p>

              <div className="flex gap-1 rounded-full bg-cream-100 p-0.5">
                {TABS.map((tab, i) => (
                  <div
                    key={tab}
                    className={`flex-1 rounded-full py-1 text-center text-[8.5px] font-medium ${
                      i === 0 ? "bg-forest-900 text-cream-50" : "text-charcoal-400"
                    }`}
                  >
                    {tab}
                  </div>
                ))}
              </div>

              <div>
                <p className="text-[9px] font-medium uppercase tracking-wide text-charcoal-400">Hole 7</p>
                <p className="text-[10px] text-charcoal-500">Par 4 · 385 yds</p>
              </div>

              <div className="space-y-2">
                {SCORES.map((row) => (
                  <div
                    key={row.name}
                    className="flex items-center justify-between rounded-xl bg-cream-100 px-3 py-2.5"
                  >
                    <span className="text-[11px] font-medium text-charcoal-700">{row.name}</span>
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-forest-900/10 text-forest-900">
                        <span className="text-base font-medium leading-none">–</span>
                      </div>
                      <span className="w-5 text-center font-serif text-xl tabular-nums text-forest-900">
                        {row.score}
                      </span>
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-forest-900/10 text-forest-900">
                        <span className="text-base font-medium leading-none">+</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="rounded-xl bg-white px-3 py-2.5 shadow-sm">
                <p className="text-[9px] font-medium uppercase tracking-wide text-charcoal-400">Leaderboard</p>
                <div className="mt-1.5 space-y-1">
                  {LEADERBOARD.map((row, i) => (
                    <div key={row.name} className="flex items-center justify-between text-[11px]">
                      <span className="font-medium text-charcoal-700">
                        {i + 1}. {row.name}
                      </span>
                      <span className="font-medium tabular-nums text-forest-700">{row.toPar}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl bg-gold-50 px-3 py-2.5">
                <p className="text-[10px] font-medium text-forest-900">Skins</p>
                <div className="mt-1 space-y-0.5">
                  <p className="text-[10px] text-charcoal-600">Taylor — 2 skins</p>
                  <p className="text-[10px] text-charcoal-600">Tom — 4 skins</p>
                </div>
              </div>
            </div>

            <div className="flex border-t border-forest-900/[0.08] bg-cream-50/95 px-2 py-1.5">
              {(["home", "plus", "user"] as const).map((icon) => (
                <div key={icon} className="flex flex-1 flex-col items-center gap-0.5 py-1 text-charcoal-500">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-4 w-4">
                    {NAV_ICON_PATHS[icon]}
                  </svg>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-2.5 flex justify-center">
        <div className="h-1 w-24 rounded-full bg-cream-50/30" />
      </div>
    </div>
  );
}
