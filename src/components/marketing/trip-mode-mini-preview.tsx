/**
 * A small secondary preview shown beneath the hero's animated phone
 * demo (hero-phone-demo.tsx) -- a reminder that Trip Mode exists
 * without letting it compete with the everyday-round walkthrough for
 * attention (see hero.tsx). Static layout and copy; the only thing
 * that ever changes is the optional `emphasize` highlight the phone
 * demo briefly turns on near the end of its 19th Hole scene, to tie
 * "the group's everyday app" back to "the same group's trip" without
 * this card ever resizing, moving, or outgrowing the phone next to it.
 */
export function TripModeMiniPreview({ emphasize = false }: { emphasize?: boolean }) {
  return (
    <div
      aria-hidden="true"
      className="mt-4 flex w-[250px] items-center justify-between rounded-2xl border px-4 py-3 transition-all duration-500 ease-out sm:w-[270px]"
      style={{
        borderColor: emphasize ? "rgba(201,162,78,0.6)" : "rgba(253,251,246,0.15)",
        backgroundColor: emphasize ? "rgba(24,48,32,0.75)" : "rgba(15,33,23,0.6)",
        boxShadow: emphasize ? "0 0 0 3px rgba(201,162,78,0.15)" : "none",
        transform: emphasize ? "scale(1.02)" : "scale(1)",
      }}
    >
      <div>
        <p className="text-[9px] font-semibold uppercase tracking-wide text-gold-300/80">Trip Mode</p>
        <p className="mt-0.5 text-xs text-cream-100/80">Pebble Beach Weekend</p>
        <p className="mt-0.5 text-[10px] text-cream-100/60">4 golfers</p>
      </div>
      <p className="font-serif text-sm text-cream-50">$342 outstanding</p>
    </div>
  );
}
