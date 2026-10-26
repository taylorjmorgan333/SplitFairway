import Link from "next/link";
import { PublicPage } from "@/components/marketing/public-page";
import { ButtonLink } from "@/components/ui/button";
import { PLANS } from "@/lib/billing/plans";
import { publicMetadata } from "@/lib/seo/public-metadata";

const DESCRIPTION =
  "Split lodging, cars, and the rest of a golf trip without a spreadsheet. Everyone sees what they owe. Payments stay outside the app.";

export const metadata = publicMetadata("Golf trip expense splitter", DESCRIPTION, "/guides/golf-trip-expenses");

const tripPass = PLANS.find((plan) => plan.id === "trip_pass");

export default function GolfTripExpensesPage() {
  return (
    <PublicPage>
      <h1 className="text-3xl sm:text-4xl">Split golf trip expenses without the spreadsheet</h1>
      <p className="mt-4 text-lg leading-relaxed text-charcoal-500">
        Lodging, cars, caddie fees, the dinner that three of you skipped — one ledger for the
        group, instead of a thread of screenshots.
      </p>

      <div className="mt-10 space-y-8 text-sm leading-relaxed text-charcoal-700">
        <section>
          <h2 className="text-xl text-forest-900">Add the expense, then choose the split</h2>
          <p className="mt-2">
            The trip captain adds each cost and who paid it. Split it evenly across the group, or
            only across the golfers who used it. A rental car for three people does not have to
            land on all eight.
          </p>
        </section>
        <section>
          <h2 className="text-xl text-forest-900">Payments happen outside the app</h2>
          <p className="mt-2">
            Venmo, Zelle, PayPal, cash, or a check — whatever the group already uses.
            SplitFairway records that a payment was reported and whether the right person
            confirmed it. A reported payment is not treated as settled until that confirmation.
            The app never holds or transfers the money.
          </p>
        </section>
        <section>
          <h2 className="text-xl text-forest-900">Rounds stay with the ledger</h2>
          <p className="mt-2">
            The same trip holds every round, the side games, lodging notes, and the final
            balances. When the trip is over, the settlement view is who is square and who is not.
            The full walkthrough is on the{" "}
            <Link href="/trip-mode" className="font-medium text-forest-800 underline">
              Trip Mode
            </Link>{" "}
            page.
          </p>
        </section>
        <section>
          <h2 className="text-xl text-forest-900">Who pays for the app</h2>
          <p className="mt-2">
            Golfers you invite can join and see their own balance for free. A Trip Pass
            {tripPass ? ` (${tripPass.price})` : ""} is the one-time plan for the captain running
            that trip. During beta, signed-in golfers have those features unlocked. See{" "}
            <Link href="/pricing" className="font-medium text-forest-800 underline">
              pricing
            </Link>{" "}
            for the three plans.
          </p>
        </section>
        <section>
          <h2 className="text-xl text-forest-900">What this will not do</h2>
          <p className="mt-2">
            It will not book the house, the cars, or the tee times. Those reservations stay with
            the vendor. It also will not convert currencies — a trip uses one currency.
          </p>
        </section>
      </div>

      <div className="mt-10">
        <ButtonLink href="/signup" variant="gold" size="lg">
          Start a trip free
        </ButtonLink>
      </div>
    </PublicPage>
  );
}
