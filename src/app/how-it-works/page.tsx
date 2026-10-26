import Link from "next/link";
import { PublicPage } from "@/components/marketing/public-page";
import { ButtonLink } from "@/components/ui/button";
import { publicMetadata } from "@/lib/seo/public-metadata";

const DESCRIPTION =
  "How SplitFairway works: start a round, score it, run side games, keep a weekly group, and track trip expenses without a spreadsheet.";

export const metadata = publicMetadata("How it works", DESCRIPTION, "/how-it-works");

const STEPS = [
  {
    title: "Start a round",
    body: "Pick a course and the golfers who are playing. A quick round is enough for today. A group round reuses the roster you already saved. A trip round sits with the rest of that trip.",
  },
  {
    title: "Enter scores on your phone",
    body: "The scorecard is hole by hole. Gross and net both update from the handicaps and tees on the round. You do not need a separate paper card to know who is up.",
  },
  {
    title: "Turn on the games you already play",
    body: "Skins, Nassau, Wolf, Stableford, and the other formats in the app score themselves from those same hole scores. A custom game can be noted when it is something the app does not calculate.",
  },
  {
    title: "Keep the weekly group",
    body: "A group holds the roster, game presets, seasons, and standings so next week does not start from a blank text thread. Guest scoring links exist for someone who is not ready to make an account.",
  },
  {
    title: "Run the trip in the same place",
    body: "Trip Mode adds multiple rounds, lodging notes, expenses, and a settlement view. Splits can be even or limited to the golfers who actually used something, like one rental car.",
  },
];

export default function HowItWorksPage() {
  return (
    <PublicPage>
      <h1 className="text-3xl sm:text-4xl">How SplitFairway works</h1>
      <p className="mt-4 text-lg leading-relaxed text-charcoal-500">
        One place for the round you are playing today, the group you play with every week, and
        the trip that needs a shared ledger.
      </p>

      <ol className="mt-10 space-y-8">
        {STEPS.map((step, index) => (
          <li key={step.title}>
            <p className="font-serif text-2xl text-gold-500">0{index + 1}</p>
            <h2 className="mt-2 text-xl text-forest-900">{step.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-charcoal-500">{step.body}</p>
          </li>
        ))}
      </ol>

      <h2 className="mt-12 text-xl text-forest-900">What it does not do</h2>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-charcoal-500">
        <li>It does not book travel. Reservations stay with the hotel, the course, or the rental company.</li>
        <li>It does not hold or transfer money. It records payments you make somewhere else.</li>
        <li>It does not verify a handicap with the USGA. You enter the number the group is using.</li>
      </ul>

      <h2 className="mt-12 text-xl text-forest-900">Go deeper</h2>
      <ul className="mt-3 space-y-2 text-sm">
        <li>
          <Link href="/guides/golf-side-games" className="font-medium text-forest-800 underline">
            Golf side games guide
          </Link>
        </li>
        <li>
          <Link href="/guides/golf-trip-expenses" className="font-medium text-forest-800 underline">
            Split a golf trip&apos;s expenses
          </Link>
        </li>
        <li>
          <Link href="/tools/nassau-calculator" className="font-medium text-forest-800 underline">
            Nassau calculator
          </Link>
        </li>
        <li>
          <Link href="/tools/skins-calculator" className="font-medium text-forest-800 underline">
            Skins calculator
          </Link>
        </li>
        <li>
          <Link href="/trip-mode" className="font-medium text-forest-800 underline">
            Trip Mode
          </Link>
        </li>
        <li>
          <Link href="/pricing" className="font-medium text-forest-800 underline">
            Pricing
          </Link>
        </li>
      </ul>

      <div className="mt-10">
        <ButtonLink href="/signup" variant="gold" size="lg">
          Start playing free
        </ButtonLink>
      </div>
    </PublicPage>
  );
}
