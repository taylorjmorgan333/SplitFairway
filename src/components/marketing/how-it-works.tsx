import { Container } from "@/components/ui/container";

const STEPS = [
  {
    number: "01",
    title: "Start a round",
    body: "Choose a course and begin scoring.",
  },
  {
    number: "02",
    title: "Play your games",
    body: "Add Skins, Nassau, Match Play or another supported format.",
  },
  {
    number: "03",
    title: "Keep the group together",
    body: "Save golfers, standings and history for next week.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-forest-50 py-10 sm:py-20 lg:py-28">
      <Container>
        <div className="max-w-2xl">
          <h2 className="text-3xl sm:text-4xl">How it works</h2>
        </div>

        <ol className="mt-10 grid gap-8 sm:grid-cols-3">
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
