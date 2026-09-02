import type { Metadata } from "next";
import { LegalPageShell } from "@/components/legal/legal-page-shell";

export const metadata: Metadata = { title: "Data Deletion Request (Draft)" };

export default function DataDeletionPage() {
  return (
    <LegalPageShell title="Data deletion request" updated="private beta — draft">
      <p>
        You can ask us to delete your account and the personal data tied to it. During this
        private beta, deletion is handled manually by the team rather than through a self-serve
        button — this page describes what that process covers.
      </p>

      <section>
        <h2 className="font-serif text-lg text-forest-900">How to request deletion</h2>
        <p className="mt-2">
          Email{" "}
          <a href="mailto:support@golftriptreasurer.example" className="text-forest-800 underline">
            support@golftriptreasurer.example
          </a>{" "}
          from the email address on your account with the subject line &ldquo;Delete my
          account.&rdquo; We&apos;ll confirm your identity against that account before acting on
          the request.
        </p>
      </section>

      <section>
        <h2 className="font-serif text-lg text-forest-900">What gets deleted</h2>
        <ul className="mt-2 list-disc space-y-1.5 pl-5">
          <li>Your profile (name, email, account credentials).</li>
          <li>
            Any trip where you are the only captain — the trip and everything on it (expenses,
            payments, invitations, activity log).
          </li>
          <li>Your own reported payments and roster entry on trips you don&apos;t own.</li>
        </ul>
      </section>

      <section>
        <h2 className="font-serif text-lg text-forest-900">What we keep</h2>
        <p className="mt-2">
          On a shared trip where other golfers still need an accurate record of who paid what, we
          keep the expense and payment records that involve you (so the remaining golfers&apos;
          balances stay correct), but remove your personally identifying details from your
          profile and disable your login. Trip captains remain responsible for those trips&apos;
          records after you leave, per our{" "}
          <a href="/legal/terms" className="text-forest-800 underline">
            Terms of Service
          </a>
          .
        </p>
      </section>

      <section>
        <h2 className="font-serif text-lg text-forest-900">Timeline</h2>
        <p className="mt-2">
          We aim to process deletion requests within 30 days. This is a beta-stage manual process
          — a faster, self-serve version is planned before a public launch.
        </p>
      </section>
    </LegalPageShell>
  );
}
