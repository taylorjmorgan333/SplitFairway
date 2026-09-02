import { Logo } from "@/components/ui/logo";

const NAV_ICONS = {
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
  check: <path strokeLinecap="round" strokeLinejoin="round" d="m5 12.5 4.5 4.5L19 7.5" />,
};

/**
 * A pure-CSS recreation of the actual mobile dashboard — no stock device
 * photography, no glassy/skeuomorphic mockup styling. It mirrors the real
 * "your balance" hero + quick actions + bottom tab bar from the
 * authenticated app (see MyBalanceHero in trip-tabs.tsx and the mobile
 * nav in app-shell.tsx) at phone scale, so what a visitor sees here is
 * what they'll actually get after signing up.
 */
export function PhonePreview() {
  return (
    <div aria-hidden="true" className="relative w-[250px] shrink-0 sm:w-[270px]">
      <div className="rounded-[2.75rem] border-[6px] border-cream-50/10 bg-forest-900 p-1.5 shadow-2xl shadow-black/50">
        <div className="relative h-[510px] overflow-hidden rounded-[2.15rem] bg-cream-50">
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

            <div className="flex-1 space-y-3 overflow-hidden px-3.5 py-3.5">
              <p className="text-[10px] font-medium text-charcoal-400">Pebble Beach Weekend</p>

              <div className="rounded-2xl bg-forest-950 p-3.5 text-cream-50">
                <p className="text-[9px] font-medium uppercase tracking-wide text-cream-100/60">
                  Your balance
                </p>
                <p className="mt-1 text-2xl font-medium tabular-nums">$342</p>
                <p className="mt-0.5 text-[10px] text-cream-100/75">You owe the group</p>
                <div className="mt-3 grid grid-cols-3 gap-1.5">
                  {(["plus", "check", "check"] as const).map((icon, i) => (
                    <div
                      key={i}
                      className="flex h-9 flex-col items-center justify-center gap-0.5 rounded-lg bg-cream-50/10"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3 w-3">
                        {NAV_ICONS[icon]}
                      </svg>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                {[
                  { name: "Sam", amt: "Owed $118", tone: "text-forest-700" },
                  { name: "Jordan", amt: "Settled up", tone: "text-charcoal-400" },
                  { name: "Riley", amt: "Owes $64", tone: "text-gold-700" },
                ].map((row) => (
                  <div
                    key={row.name}
                    className="flex items-center justify-between rounded-xl bg-cream-100 px-3 py-2"
                  >
                    <span className="text-[11px] font-medium text-charcoal">{row.name}</span>
                    <span className={`text-[10px] font-medium tabular-nums ${row.tone}`}>
                      {row.amt}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex border-t border-forest-900/[0.08] bg-cream-50/95 px-2 py-1.5">
              {(["home", "plus", "user"] as const).map((icon) => (
                <div key={icon} className="flex flex-1 flex-col items-center gap-0.5 py-1 text-charcoal-500">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-4 w-4">
                    {NAV_ICONS[icon]}
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
