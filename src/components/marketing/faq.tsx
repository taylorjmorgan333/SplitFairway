import { Container } from "@/components/ui/container";
import { SectionLink } from "@/components/marketing/section-link";

type FaqEntry = { question: string; answer: string; previewAnswer?: string };

export const FAQS: FaqEntry[] = [
  {
    question: "Do invited golfers have to pay?",
    answer:
      "No. Every golfer you invite joins, scores, and sees their own balance for free. Organizer Pro and Trip Pass only apply to the organizer or trip captain who chooses to upgrade -- nobody else in the group is ever charged.",
    previewAnswer: "No. Every golfer you invite plays and scores for free -- only the organizer ever upgrades.",
  },
  {
    question: "What is Organizer Pro?",
    answer:
      "Organizer Pro is the $59.99/year plan for the person who runs a recurring golf group -- unlimited Group Rounds, saved rosters and game presets, group seasons and standings, and season-long 19th Hole records.",
    previewAnswer: "The $59.99/year plan for running a recurring group -- unlimited rounds, saved rosters and standings.",
  },
  {
    question: "What is a Trip Pass?",
    answer:
      "A Trip Pass is a $29.99 one-time purchase that covers a single trip end to end -- unlimited trip rounds, itinerary and lodging details, expenses and settlement, and a full recap -- for everyone invited to that trip.",
    previewAnswer: "A $29.99 one-time purchase covering a full trip -- rounds, lodging, expenses and settlement.",
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

const HOMEPAGE_PREVIEW_COUNT = 3;

/**
 * Shows a short 3-question preview on the homepage with a link to the
 * full list (spec item 9), or the complete list when rendered on its
 * own /faq page (preview=false). FAQS is exported so /faq can reuse
 * the exact same content -- nothing here was deleted, only split
 * between the two surfaces.
 */
export function FAQ({ preview = false }: { preview?: boolean } = {}) {
  const items = preview ? FAQS.slice(0, HOMEPAGE_PREVIEW_COUNT) : FAQS;

  return (
    <section id="faq" className="bg-cream-50 py-10 sm:py-20 lg:py-28">
      <Container>
        <div className="max-w-2xl">
          <h2 className="text-3xl sm:text-4xl">Frequently asked questions</h2>
        </div>

        <dl className="mt-8 max-w-3xl divide-y divide-forest-900/10">
          {items.map((faq) => (
            <div key={faq.question} className="py-4">
              <dt className="text-base font-medium text-forest-900">
                {faq.question}
              </dt>
              <dd className="mt-2 text-sm leading-relaxed text-charcoal-500">
                {preview && faq.previewAnswer ? faq.previewAnswer : faq.answer}
              </dd>
            </div>
          ))}
        </dl>

        {preview && (
          <div className="mt-8">
            <SectionLink href="/faq" variant="outline">
              View All FAQs
            </SectionLink>
          </div>
        )}
      </Container>
    </section>
  );
}
