export function ScoreStepper({
  name,
  holeNumber,
  score,
  onDecrease,
  onIncrease,
  onClear,
}: {
  name: string;
  holeNumber: number;
  score: number | null;
  onDecrease: () => void;
  onIncrease: () => void;
  onClear: () => void;
}) {
  const entered = score == null ? "not entered" : String(score);

  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-forest-900/[0.08] bg-white px-3 py-3">
      <p className="min-w-0 flex-1 truncate text-sm font-medium text-forest-900">{name}</p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-forest-900 text-lg text-cream-50"
          aria-label={`Decrease ${name}'s score on hole ${holeNumber}`}
          onClick={onDecrease}
        >
          −
        </button>
        <span
          className="w-8 text-center font-serif text-xl tabular-nums text-forest-900"
          aria-label={`${name} on hole ${holeNumber}: ${entered}`}
        >
          {score ?? "–"}
        </span>
        <button
          type="button"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-forest-900 text-lg text-cream-50"
          aria-label={`Increase ${name}'s score on hole ${holeNumber}`}
          onClick={onIncrease}
        >
          +
        </button>
        <button
          type="button"
          className="h-11 px-2 text-xs font-medium text-charcoal-500 underline-offset-2 hover:underline"
          aria-label={`Clear ${name}'s score on hole ${holeNumber}`}
          onClick={onClear}
        >
          Clear
        </button>
      </div>
    </div>
  );
}
