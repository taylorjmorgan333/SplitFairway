import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = { title: "Not authorized" };

/**
 * A generic, friendly "you can't do that" page. Note that trip pages
 * deliberately do NOT link here for "you're not a member of this trip" —
 * that case renders the regular 404 instead, on purpose, so a captain
 * can't probe for which trip IDs exist by watching which ones say
 * "unauthorized" vs "not found" (see the trips_select_members RLS
 * policy and src/app/(app)/trips/[tripId]/page.tsx). This page is for
 * the more general "you're signed in, but this isn't yours" case.
 */
export default function UnauthorizedPage() {
  return (
    <Container className="flex min-h-screen flex-col items-center justify-center text-center">
      <p className="font-serif text-6xl text-gold-500">403</p>
      <h1 className="mt-4 text-2xl">You don&apos;t have access to that</h1>
      <p className="mt-2 max-w-sm text-sm text-charcoal-500">
        Either you&apos;re signed in as the wrong account, or this belongs to someone else.
      </p>
      <ButtonLink href="/dashboard" variant="primary" className="mt-8">
        Back to your dashboard
      </ButtonLink>
    </Container>
  );
}
