import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

export function CtaSection() {
  return (
    <section className="bg-forest-950 py-20">
      <Container className="text-center">
        <h2 className="text-3xl text-cream-50 sm:text-4xl">
          Your next round starts here.
        </h2>
        <p className="mx-auto mt-3 max-w-md text-cream-100/75">
          Start a Quick Round today, build your regular group or bring the whole crew together
          for the next golf trip.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <ButtonLink href="/signup" variant="gold" size="lg">
            Start Playing Free
          </ButtonLink>
          <ButtonLink
            href="/signup"
            variant="outline"
            size="lg"
            className="border-cream-50/25 text-cream-50 hover:bg-cream-50/10"
          >
            Plan a Trip
          </ButtonLink>
        </div>
      </Container>
    </section>
  );
}
