/**
 * Editable defaults for the public calculators. This is a sample
 * routing so net scoring has a par and a stroke index to allocate
 * against. It is not a real course, and the screens say so.
 */

export const SAMPLE_PARS_18: readonly number[] = [
  4, 5, 3, 4, 4, 4, 5, 3, 4, 4, 3, 5, 4, 4, 4, 3, 5, 4,
];

/** A common odd-front / even-back stroke-index pattern. Not universal. */
export const SAMPLE_STROKE_INDEX_18: readonly number[] = [
  7, 3, 15, 1, 11, 5, 17, 9, 13, 8, 4, 16, 2, 12, 6, 18, 10, 14,
];

export type HoleSetup = {
  holeNumber: number;
  par: number;
  strokeIndex: number;
};

export function holesForCount(
  holeCount: number,
  pars: readonly number[] = SAMPLE_PARS_18,
  strokeIndexes: readonly number[] = SAMPLE_STROKE_INDEX_18,
): HoleSetup[] {
  const count = holeCount === 9 ? 9 : 18;
  return Array.from({ length: count }, (_, index) => ({
    holeNumber: index + 1,
    par: clampPar(pars[index] ?? 4),
    strokeIndex: clampStrokeIndex(strokeIndexes[index] ?? index + 1, count),
  }));
}

export function clampPar(value: number): number {
  if (!Number.isFinite(value)) return 4;
  return Math.min(6, Math.max(3, Math.round(value)));
}

export function clampStrokeIndex(value: number, holeCount: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(holeCount, Math.max(1, Math.round(value)));
}

export function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 4;
  return Math.min(15, Math.max(1, Math.round(value)));
}
