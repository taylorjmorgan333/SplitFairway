import { ButtonLink } from "@/components/ui/button";
import { SectionLink } from "@/components/marketing/section-link";
import { Container } from "@/components/ui/container";
import { RoundPreview } from "@/components/marketing/round-preview";
import { TripModeMiniPreview } from "@/components/marketing/trip-mode-mini-preview";

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-forest-950">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-contour-lines opacity-60"
      />
      <div
        aria-hidden="true"
        className="absolute -top-40 right-[-10%] h-96 w-96 rounded-full bg-forest-700/30 blur-3xl"
      />

      <Container className="relative py-20 sm:py-28 lg:py-32">
        <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-8">
          <div className="max-w-2xl">
            <p className="mb-5 inline-flex items-center rounded-full border border-gold-400/30 bg-gold-400/10 px-3.5 py-1 text-xs font-medium uppercase tracking-wide text-gold-300">
              The home for your golf group
            </p>
            <h1 className="text-4xl leading-[1.1] text-cream-50 sm:text-5xl md:text-6xl">
              Every round. Every game. Every trip.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-cream-100/80">
              Keep score, run the side games, save your weekly group and organize the big
              trip—all in one place.
            </p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href="/signup" variant="gold" size="lg">
                Start Playing Free
              </ButtonLink>
              <SectionLink
                href="/#trip-mode"
                variant="outline"
                size="lg"
                className="border-cream-50/25 text-cream-50 hover:bg-cream-50/10"
              >
                Explore Trip Mode
              </SectionLink>
            </div>
            <p className="mt-6 text-sm text-cream-100/60">
              Free for every golfer. No credit card required during beta.
            </p>
          </div>

          <div className="flex flex-col items-center lg:items-end">
            <RoundPreview />
            <TripModeMiniPreview />
          </div>
        </div>
      </Container>
    </section>
  );
}
