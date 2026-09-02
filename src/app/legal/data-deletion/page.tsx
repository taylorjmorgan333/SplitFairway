import type { Metadata } from "next";
import { LegalPageShell } from "@/components/legal/legal-page-shell";
import { SupportEmail } from "@/components/ui/support-email";

export const metadata: Metadata = {
  title: "Data Deletion",
  description: "How SplitFairway account deletion works, and what happens to your data.",
  alternates: { canonical: "/legal/data-deletion" },
};

export default function DataDeletionPage() {
  return (
    <LegalPageShell title="Data deletion" updated="to describe the self-serve deletion process">
      <p>
        You can permanently delete your account and personal data at any time from{" "}
        <a href="/account" className="text-forest-800 underline">
          Account settings
        </a>{" "}
        — no waiting on the team. It requires re-entering your password and typing a
        confirmation phrase, and takes effect immediately.
      </p>

      <section>
        <h2 className="font-serif text-lg text-forest-900">What gets deleted immediately</h2>
        <ul className="mt-2 list-disc space-y-1.5 pl-5">
          <li>Your profile and login — you&apos;re signed out on every device right away.</li>
          <li>
            Any trip where you&apos;re the only active golfer — the trip and everything on it
            (expenses, payments, invitations, activity log) is deleted entirely.
          </li>
          <li>Your beta feedback submissions and product-usage records.</li>
        </ul>
      </section>

      <section>
        <h2 className="font-serif text-lg text-forest-900">
          What&apos;s anonymized instead of deleted
        </h2>
        <p className="mt-2">
          On a trip you share with other golfers, deleting your account never deletes their
          data. Your name and email are replaced with a generic placeholder and your login is
          disconnected from the trip, but the expenses and payments you were part of stay —
          otherwise the remaining golfers&apos; balances would stop adding up correctly. If you
          were the only captain on a shared trip, another active golfer is automatically made
          captain so the trip doesn&apos;t get stuck with no one able to manage it.
        </p>
      </section>

      <section>
        <h2 className="font-serif text-lg text-forest-900">Timeline</h2>
        <p className="mt-2">
          Immediate — deletion runs the moment you confirm it, not on a delay or a batch job.
        </p>
      </section>

      <section>
        <h2 className="font-serif text-lg text-forest-900">Can&apos;t access your account?</h2>
        <p className="mt-2">
          If you&apos;re locked out and can&apos;t sign in to use the self-serve option, email{" "}
          <SupportEmail /> from the email address on your account and we&apos;ll process the
          same deletion by hand after confirming your identity.
        </p>
      </section>
    </LegalPageShell>
  );
}
