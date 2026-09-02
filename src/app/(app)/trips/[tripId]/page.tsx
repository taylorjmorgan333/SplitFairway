import type { Metadata } from "next";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Trip details" };

export default async function TripDetailPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;

  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-charcoal-400">
        Trip
      </p>
      <h1 className="mt-1 text-2xl">Trip details</h1>
      <p className="mt-1.5 text-sm text-charcoal-500">
        Reference ID: <span className="font-mono">{tripId}</span>
      </p>

      <Alert variant="info" className="mt-6">
        Trip storage isn&apos;t built yet, so there&apos;s no real trip
        behind this page. Once expenses, golfers and payments are wired to
        the database, this is where your group will see the full ledger:
        every expense, each golfer&apos;s balance, and who still owes what.
      </Alert>

      <div className="mt-8">
        <ButtonLink href="/dashboard" variant="outline">
          Back to dashboard
        </ButtonLink>
      </div>
    </div>
  );
}
