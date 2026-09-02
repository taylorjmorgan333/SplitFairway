import { Container } from "@/components/ui/container";

const PROBLEMS = [
  {
    title: "The spreadsheet nobody opens",
    body: "One person builds a color-coded tracker. Everyone else ignores it, and it's out of date by day two.",
  },
  {
    title: "The awkward group text",
    body: "\"Hey just a reminder...\" turns into three follow-ups and a running joke about who still owes for the cabin.",
  },
  {
    title: "The math nobody trusts",
    body: "Uneven rooms, someone skipping a round, one guy who paid for gas — everyone does their own version of the split.",
  },
];

export function ProblemSection() {
  return (
    <section className="bg-cream-50 py-20 sm:py-28">
      <Container>
        <div className="max-w-2xl">
          <h2 className="text-3xl sm:text-4xl">Every trip has a treasurer.</h2>
          <p className="mt-4 text-lg text-charcoal-500">
            Usually it&apos;s the one person who ends up fronting money,
            tracking Venmo requests, and sending reminders nobody answers.
          </p>
        </div>

        <div className="mt-14 grid gap-8 sm:grid-cols-3">
          {PROBLEMS.map((problem) => (
            <div key={problem.title}>
              <div className="h-px w-10 bg-gold-500" />
              <h3 className="mt-5 text-lg text-forest-900">{problem.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-charcoal-500">
                {problem.body}
              </p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
