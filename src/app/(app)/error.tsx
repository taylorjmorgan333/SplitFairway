"use client";

import { useEffect } from "react";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

/**
 * Catches any rendering/data error thrown inside the authenticated app
 * (dashboard, trip pages, account) and shows a recoverable, friendly
 * screen instead of a blank page or a raw stack trace. Server Actions
 * already return typed error states for expected failures (a rejected
 * split, a bad invitation) — this boundary is the backstop for anything
 * unexpected.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Server-side error logging (Vercel/hosting logs) is enough for
    // now — deliberately not sending the raw error object anywhere
    // that could carry user data into a client-visible console log.
    // eslint-disable-next-line no-console
    console.error("App error boundary:", error.digest ?? error.message);
  }, [error]);

  return (
    <Container className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <p className="font-serif text-5xl text-gold-500">Oops</p>
      <h1 className="mt-4 text-2xl">Something went wrong</h1>
      <p className="mt-2 max-w-md text-sm text-charcoal-500">
        That&apos;s on us, not your data — nothing was lost. Try again, and if it keeps
        happening, use the feedback button to let us know what you were doing.
      </p>
      {error.digest && (
        <p className="mt-2 text-xs text-charcoal-400">Reference: {error.digest}</p>
      )}
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-forest-800 px-5 text-sm font-medium text-cream-50 transition-colors hover:bg-forest-700"
        >
          Try again
        </button>
        <ButtonLink href="/dashboard" variant="outline">
          Back to dashboard
        </ButtonLink>
      </div>
    </Container>
  );
}
