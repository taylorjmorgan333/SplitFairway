import { ButtonLink } from "@/components/ui/button";
import { SectionLink } from "@/components/marketing/section-link";
import { Container } from "@/components/ui/container";
import { HeroPhoneDemo } from "@/components/marketing/hero-phone-demo";

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

      <Container className="relative py-12 sm:py-20 lg:py-32">
        <div className="grid items-center gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:gap-8">
          <div className="max-w-2xl">
            <p className="mb-4 inline-flex items-center rounded-full border border-gold-400/30 bg-gold-400/10 px-3.5 py-1 text-xs font-medium uppercase tracking-wide text-gold-300">
              The home for your golf group
            </p>
            <h1 className="text-4xl leading-[1.1] text-cream-50 sm:text-5xl md:text-6xl">
              Every round. Every game. Every trip.
            </h1>
            <p className="mt-4 max-w-xl text-lg leading-relaxed text-cream-100/80">
              Score rounds, run the side games and keep your group&apos;s golf all in one place.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
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
            <p className="mt-4 text-sm text-cream-100/60">
              Free for every golfer. No credit card required during beta.
            </p>
          </div>

          <HeroPhoneDemo />
        </div>
      </Container>
    </section>
  );
}
