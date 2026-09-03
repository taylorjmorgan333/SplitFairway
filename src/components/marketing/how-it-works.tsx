import { Container } from "@/components/ui/container";

const STEPS = [
  {
    number: "01",
    title: "Build the trip",
    body: "Add your golfers, lodging, tee times, transportation and other trip details.",
  },
  {
    number: "02",
    title: "Split it fairly",
    body: "We calculate what each golfer owes — even when rooms, rounds and expenses aren't shared evenly.",
  },
  {
    number: "03",
    title: "Play the rounds",
    body: "Keep hole-by-hole scores, follow the leaderboard and track the group's side games.",
  },
  {
    number: "04",
    title: "Settle everything",
    body: "See the final trip balances, record payments and send a friendly reminder when needed.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-forest-50 py-20 sm:py-28">
      <Container>
        <div className="max-w-2xl">
          <h2 className="text-3xl sm:text-4xl">How it works</h2>
          <p className="mt-4 text-lg text-charcoal-500">
            Four steps between booking the trip and everyone actually
            settling up.
          </p>
        </div>

        <ol className="mt-14 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step) => (
            <li key={step.number}>
              <span className="font-serif text-3xl text-gold-500">
                {step.number}
              </span>
              <h3 className="mt-3 text-lg text-forest-900">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-charcoal-500">
                {step.body}
              </p>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}
