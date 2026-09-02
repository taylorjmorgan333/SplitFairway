import { Container } from "@/components/ui/container";

const STEPS = [
  {
    number: "01",
    title: "Build the trip",
    body: "Add lodging, tee times, carts and any other cost. Assign who's in on each one.",
  },
  {
    number: "02",
    title: "Split it fairly",
    body: "We calculate exactly what each golfer owes — even split, or itemized by who actually used what.",
  },
  {
    number: "03",
    title: "Track who's paid",
    body: "Record payments made by Venmo, Zelle, PayPal, cash or check. Everyone sees a live tally.",
  },
  {
    number: "04",
    title: "Send a nudge, not a lecture",
    body: "Automatic reminders go out for what's still owed, so you don't have to be the bad guy.",
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
