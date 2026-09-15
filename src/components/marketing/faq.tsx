import { Container } from "@/components/ui/container";

const FAQS = [
  {
    question: "Do invited golfers have to pay?",
    answer:
      "No. Every golfer you invite joins, scores, and sees their own balance for free. Organizer Pro and Trip Pass only apply to the organizer or trip captain who chooses to upgrade -- nobody else in the group is ever charged.",
  },
  {
    question: "What is Organizer Pro?",
    answer:
      "Organizer Pro is the $59.99/year plan for the person who runs a recurring golf group -- unlimited Group Rounds, saved rosters and game presets, group seasons and standings, and season-long 19th Hole records.",
  },
  {
    question: "What is a Trip Pass?",
    answer:
      "A Trip Pass is a $29.99 one-time purchase that covers a single trip end to end -- unlimited trip rounds, itinerary and lodging details, expenses and settlement, and a full recap -- for everyone invited to that trip.",
  },
  {
    question: "Are premium features available during beta?",
    answer:
      "Yes. SplitFairway is in beta, so every Organizer Pro and Trip Pass feature is unlocked for signed-in golfers right now at no charge -- upgrading later will simply keep that access going.",
  },
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
