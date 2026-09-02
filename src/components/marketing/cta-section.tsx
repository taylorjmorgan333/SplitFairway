import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

export function CtaSection() {
  return (
    <section className="bg-forest-950 py-20">
      <Container className="text-center">
        <h2 className="text-3xl text-cream-50 sm:text-4xl">
          Plan the money once.
        </h2>
        <p className="mx-auto mt-3 max-w-md text-cream-100/75">
          Set up your trip in a few minutes and stop being the group
          accountant in your group chat.
        </p>
        <div className="mt-8">
          <ButtonLink href="/signup" variant="gold" size="lg">
            Create Your Trip
          </ButtonLink>
        </div>
      </Container>
    </section>
  );
}
