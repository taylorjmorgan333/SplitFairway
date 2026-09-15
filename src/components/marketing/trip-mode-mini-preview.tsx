/**
 * A small secondary preview shown beneath the hero's main RoundPreview
 * -- a reminder that Trip Mode exists without letting it compete with
 * the everyday-round mockup for attention (see hero.tsx). Static, no
 * client JS, same restrained dark-card treatment as the hero itself.
 */
export function TripModeMiniPreview() {
  return (
    <div
      aria-hidden="true"
      className="mt-4 flex w-[250px] items-center justify-between rounded-2xl border border-cream-50/15 bg-forest-900/60 px-4 py-3 sm:w-[270px]"
    >
      <div>
        <p className="text-[9px] font-semibold uppercase tracking-wide text-gold-300/80">Trip Mode</p>
        <p className="mt-0.5 text-xs text-cream-100/80">Pebble Beach Weekend</p>
      </div>
      <p className="font-serif text-sm text-cream-50">$342 owed</p>
    </div>
  );
}
