import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

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

      <Container className="relative py-24 sm:py-32">
        <div className="max-w-2xl">
          <p className="mb-5 inline-flex items-center rounded-full border border-gold-400/30 bg-gold-400/10 px-3.5 py-1 text-xs font-medium tracking-wide text-gold-300">
            Built for golf trip organizers
          </p>
          <h1 className="text-4xl leading-[1.1] text-cream-50 sm:text-5xl md:text-6xl">
            Plan the money once.
            <br />
            Stop chasing your golf buddies.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-cream-100/80">
            Split lodging, tee times, rental cars and every other trip
            expense. Everyone sees exactly what they owe and when it&apos;s
            due.
          </p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/signup" variant="gold" size="lg">
              Create Your Trip
            </ButtonLink>
            <ButtonLink
              href="#how-it-works"
              variant="outline"
              size="lg"
              className="border-cream-50/25 text-cream-50 hover:bg-cream-50/10"
            >
              See How It Works
            </ButtonLink>
          </div>
        </div>
      </Container>
    </section>
  );
}
