import { ButtonLink } from "@/components/ui/button";

export function SaveRoundCta({ game }: { game: string }) {
  return (
    <section className="rounded-2xl bg-forest-950 px-5 py-6 text-cream-50 sm:px-7">
      <h2 className="text-2xl">Save this round</h2>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-cream-100/80">
        Create a free account to keep this {game}, score the next one with your group, and pick
        the same games up next week.
      </p>
      <div className="mt-5">
        <ButtonLink href="/signup" variant="gold" size="lg">
          Save this round
        </ButtonLink>
      </div>
    </section>
  );
}
