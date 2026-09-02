import type { Metadata } from "next";
import { LegalPageShell } from "@/components/legal/legal-page-shell";

export const metadata: Metadata = { title: "Terms of Service (Draft)" };

export default function TermsOfServicePage() {
  return (
    <LegalPageShell title="Terms of Service" updated="private beta — draft">
      <p>
        These draft terms describe how SplitFairway works during the private beta. By
        using the app you agree to the points below, which will be replaced by finished,
        attorney-reviewed terms before any public launch.
      </p>

      <section>
        <h2 className="font-serif text-lg text-forest-900">What this app does</h2>
        <p className="mt-2">
          SplitFairway is expense-splitting and payment-tracking software for group golf
          trips. It calculates who owes what and lets golfers report payments they&apos;ve made
          to each other outside the app.
        </p>
      </section>

      <section>
        <h2 className="font-serif text-lg text-forest-900">What this app does not do</h2>
        <ul className="mt-2 list-disc space-y-1.5 pl-5">
          <li>
            <strong>We do not book travel.</strong> We do not reserve tee times, lodging, flights,
            or rental cars, and we make no representation about the availability, price, or
            existence of any such reservation. Every booking is made directly between you and the
            course, hotel, airline, or rental company.
          </li>
          <li>
            <strong>We do not hold or transfer money.</strong> No payment ever passes through
            SplitFairway. Golfers pay each other using Venmo, Zelle, PayPal, cash, check,
            or any other method of their choosing, entirely outside this app, and then record
            that it happened here.
          </li>
          <li>
            <strong>We do not verify that a reported payment actually happened.</strong> A
            payment record only reflects what one golfer typed in. It becomes &ldquo;confirmed&rdquo;
            only when the trip captain or the specific golfer who was paid says it happened —
            confirming a payment you did not actually receive is a mistake the confirming person
            is responsible for, not something the app can detect on your behalf.
          </li>
        </ul>
      </section>

      <section>
        <h2 className="font-serif text-lg text-forest-900">Trip captain responsibilities</h2>
        <p className="mt-2">
          A trip captain (or co-treasurer) is responsible for verifying that reservations
          referenced on a trip are real and paid for through the appropriate vendor, and for
          reviewing and confirming or rejecting reported payments accurately. SplitFairway
          provides the calculations and the record-keeping; it does not verify reservations or
          independently confirm that money changed hands.
        </p>
      </section>

      <section>
        <h2 className="font-serif text-lg text-forest-900">Accounts</h2>
        <p className="mt-2">
          You&apos;re responsible for the accuracy of the information you enter and for keeping
          your account credentials secure. You must be old enough to form a binding agreement in
          your jurisdiction to create an account.
        </p>
      </section>

      <section>
        <h2 className="font-serif text-lg text-forest-900">Private beta</h2>
        <p className="mt-2">
          The app is provided during this beta on an &ldquo;as-is&rdquo; basis, without warranty,
          while we test reliability and gather feedback. Features, and this document, may change
          without notice before a public release.
        </p>
      </section>
    </LegalPageShell>
  );
}
