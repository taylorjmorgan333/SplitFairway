import type { Metadata } from "next";
import { LegalPageShell } from "@/components/legal/legal-page-shell";

export const metadata: Metadata = { title: "Privacy Policy (Draft)" };

export default function PrivacyPolicyPage() {
  return (
    <LegalPageShell title="Privacy Policy" updated="private beta — draft">
      <p>
        Golf Trip Treasurer (&ldquo;we,&rdquo; &ldquo;us&rdquo;) helps golf trip organizers split
        expenses and track who has paid. This page describes, in draft form, what information we
        collect and how we use it.
      </p>

      <section>
        <h2 className="font-serif text-lg text-forest-900">Information we collect</h2>
        <p className="mt-2">
          Account information (name, email address, and authentication data) when you sign up.
          Trip data you or your golfers enter — trip names and dates, expense amounts and
          categories, reported payment amounts, methods, and notes. We do not collect payment
          card numbers, bank account numbers, or Venmo/PayPal/Zelle credentials — those payments
          happen entirely outside this app, on the services you already use.
        </p>
      </section>

      <section>
        <h2 className="font-serif text-lg text-forest-900">How we use it</h2>
        <p className="mt-2">
          To operate the app: calculating balances, sending invitations and reminders you
          request, and showing your trip data back to you and the golfers you invite. We do not
          sell personal information to third parties, and we do not use your trip or financial
          data to serve advertising.
        </p>
      </section>

      <section>
        <h2 className="font-serif text-lg text-forest-900">Where it&apos;s stored</h2>
        <p className="mt-2">
          Data is stored with Supabase (Postgres) using row-level security so that only the
          golfers on a given trip can see that trip&apos;s data. Emails, when sent, are delivered
          through a third-party transactional email provider.
        </p>
      </section>

      <section>
        <h2 className="font-serif text-lg text-forest-900">Your choices</h2>
        <p className="mt-2">
          You can edit your account details at any time, and a trip captain can remove a golfer
          from a trip. To request deletion of your account and associated data, see our{" "}
          <a href="/legal/data-deletion" className="text-forest-800 underline">
            data deletion page
          </a>
          .
        </p>
      </section>

      <section>
        <h2 className="font-serif text-lg text-forest-900">Beta status</h2>
        <p className="mt-2">
          Golf Trip Treasurer is in private beta. This policy will be reviewed and finalized by
          counsel before a public launch, and this page will be updated when that happens.
        </p>
      </section>

      <section>
        <h2 className="font-serif text-lg text-forest-900">Contact</h2>
        <p className="mt-2">
          Questions about this policy? Reach us from the{" "}
          <a href="/contact" className="text-forest-800 underline">
            contact page
          </a>
          .
        </p>
      </section>
    </LegalPageShell>
  );
}
