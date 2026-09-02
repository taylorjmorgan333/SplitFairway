import { Container } from "@/components/ui/container";

const FAQS = [
  {
    question: "Does SplitFairway hold or move my group's money?",
    answer:
      "No. This version is payment tracking only. You record payments made through Venmo, Zelle, PayPal, cash, check, or any other method your group already uses — we never touch the money itself.",
  },
  {
    question: "How does splitting expenses work?",
    answer:
      "Add each expense and choose who's covering it. Split it evenly across the group, or itemize it to only the golfers who used it — like a rental car only three of you needed.",
  },
  {
    question: "Will you eventually charge for this?",
    answer:
      "Yes, but only for the software itself — a simple subscription, not a percentage of your trip. We'll never take a cut of money moving between golfers.",
  },
  {
    question: "What if someone in my group doesn't want to sign up?",
    answer:
      "The organizer can track a trip on behalf of the whole group. Inviting golfers to see their own balance is optional, not required.",
  },
  {
    question: "Is my data secure?",
    answer:
      "Your account is protected by Supabase authentication, and trip data is stored in a private database tied to your account. We do not sell your information.",
  },
];

export function FAQ() {
  return (
    <section id="faq" className="bg-forest-50 py-20 sm:py-28">
      <Container>
        <div className="max-w-2xl">
          <h2 className="text-3xl sm:text-4xl">Frequently asked questions</h2>
        </div>

        <dl className="mt-12 max-w-3xl divide-y divide-forest-900/10">
          {FAQS.map((faq) => (
            <div key={faq.question} className="py-6">
              <dt className="text-base font-medium text-forest-900">
                {faq.question}
              </dt>
              <dd className="mt-2 text-sm leading-relaxed text-charcoal-500">
                {faq.answer}
              </dd>
            </div>
          ))}
        </dl>
      </Container>
    </section>
  );
}
