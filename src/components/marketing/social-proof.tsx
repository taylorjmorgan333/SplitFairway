import { Container } from "@/components/ui/container";
import {
  PUBLIC_STATS,
  TESTIMONIALS,
  visibleStats,
  visibleTestimonials,
} from "@/content/social-proof";

/**
 * Renders nothing until src/content/social-proof.ts has at least one
 * real quote (with a name) or one real stat. Placeholder rows are
 * empty on purpose and must not show up as fake reviews or fake counts.
 */
export function SocialProof() {
  const quotes = visibleTestimonials(TESTIMONIALS);
  const stats = visibleStats(PUBLIC_STATS);
  if (quotes.length === 0 && stats.length === 0) return null;

  return (
    <section aria-labelledby="social-proof-heading" className="bg-white py-10 sm:py-20 lg:py-28">
      <Container>
        <h2 id="social-proof-heading" className="text-3xl sm:text-4xl">
          {quotes.length > 0 ? "From golfers using SplitFairway" : "By the numbers"}
        </h2>

        {stats.length > 0 && (
          <dl className="mt-8 grid gap-4 sm:grid-cols-3">
            {stats.map((stat) => (
              <div
                key={`${stat.value}-${stat.label}`}
                className="rounded-2xl border border-forest-900/[0.08] bg-cream-50 px-5 py-4"
              >
                <dt className="text-sm text-charcoal-500">{stat.label}</dt>
                <dd className="mt-1 font-serif text-3xl text-forest-900">{stat.value}</dd>
              </div>
            ))}
          </dl>
        )}

        {quotes.length > 0 && (
          <ul className="mt-8 grid gap-4 lg:grid-cols-3">
            {quotes.map((quote) => (
              <li key={`${quote.name}-${quote.quote}`}>
                <figure className="h-full rounded-2xl border border-forest-900/[0.08] bg-cream-50 p-5">
                  <blockquote className="text-base leading-relaxed text-forest-900">
                    “{quote.quote}”
                  </blockquote>
                  <figcaption className="mt-4 text-sm text-charcoal-500">
                    <span className="font-medium text-forest-900">{quote.name}</span>
                    {quote.detail.trim() ? ` · ${quote.detail.trim()}` : null}
                  </figcaption>
                </figure>
              </li>
            ))}
          </ul>
        )}
      </Container>
    </section>
  );
}
