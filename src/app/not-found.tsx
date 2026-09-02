import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

export default function NotFound() {
  return (
    <Container className="flex min-h-screen flex-col items-center justify-center text-center">
      <p className="font-serif text-6xl text-gold-500">404</p>
      <h1 className="mt-4 text-2xl">This hole doesn&apos;t exist</h1>
      <p className="mt-2 text-charcoal-500">
        The page you&apos;re looking for isn&apos;t here.
      </p>
      <ButtonLink href="/" variant="primary" className="mt-8">
        Back to the clubhouse
      </ButtonLink>
    </Container>
  );
}
