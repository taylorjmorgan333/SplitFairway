import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Logo } from "@/components/ui/logo";

export const metadata: Metadata = {
  title: "Account deleted",
  robots: { index: false, follow: false },
};

/**
 * Where deleteAccountAction redirects after a successful deletion — by
 * then the session is already signed out, so this is a plain public
 * page, not a route behind auth. Exists so the person gets an explicit,
 * unambiguous "yes, that worked" instead of just bouncing to /login and
 * wondering whether the request went through.
 */
export default function AccountDeletedPage() {
  return (
    <Container className="flex min-h-screen flex-col items-center justify-center text-center">
      <Logo />
      <h1 className="mt-8 text-2xl">Your account has been deleted</h1>
      <p className="mt-2 max-w-sm text-sm text-charcoal-500">
        Your profile and login are gone, and you&apos;ve been signed out of this device. Trips
        only you used were deleted entirely; on any trip you shared with other golfers, your name
        and login are removed but the shared expense and payment history stays so their balances
        stay correct.
      </p>
      <ButtonLink href="/" variant="primary" className="mt-8">
        Back to SplitFairway
      </ButtonLink>
    </Container>
  );
}
