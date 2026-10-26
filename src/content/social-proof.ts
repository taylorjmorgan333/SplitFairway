/**
 * Social proof for the public homepage and pricing page.
 *
 * PLACEHOLDERS ONLY. Do not invent quotes, names, cities, or numbers.
 * An entry renders only when its required fields are non-empty strings
 * the owner has replaced with something real. Until then the whole
 * section returns nothing — an empty quote must never ship as if a
 * golfer said it.
 *
 * To publish an entry, replace the empty strings below. Delete the
 * sample row if you do not need the extra slot.
 */

export type Testimonial = {
  /** The golfer's words, copied from them. Leave "" until you have them. */
  quote: string;
  /** Name they agreed to show. Leave "" until you have it. */
  name: string;
  /** Optional context (city, group). Leave "" if you do not have it. */
  detail: string;
};

export type PublicStat = {
  /** The figure exactly as it should appear, e.g. "128". Leave "" until measured. */
  value: string;
  /** What that figure counts. Leave "" until you have a real value. */
  label: string;
};

export const TESTIMONIALS: readonly Testimonial[] = [
  { quote: "", name: "", detail: "" },
];

export const PUBLIC_STATS: readonly PublicStat[] = [
  { value: "", label: "" },
];

export function visibleTestimonials(items: readonly Testimonial[]): Testimonial[] {
  return items.filter((item) => item.quote.trim().length > 0 && item.name.trim().length > 0);
}

export function visibleStats(items: readonly PublicStat[]): PublicStat[] {
  return items.filter((item) => item.value.trim().length > 0 && item.label.trim().length > 0);
}

export function hasSocialProof(
  testimonials: readonly Testimonial[] = TESTIMONIALS,
  stats: readonly PublicStat[] = PUBLIC_STATS,
): boolean {
  return visibleTestimonials(testimonials).length > 0 || visibleStats(stats).length > 0;
}
