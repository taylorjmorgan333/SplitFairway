import type { Metadata } from "next";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { Hero } from "@/components/marketing/hero";
import { WaysToPlaySection } from "@/components/marketing/ways-to-play";
import { GamesSection } from "@/components/marketing/games-section";
import { BeyondTheScorecardSection } from "@/components/marketing/beyond-the-scorecard";
import { TripModePreviewSection } from "@/components/marketing/trip-mode-preview";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { PricingPreview } from "@/components/marketing/pricing-preview";
import { FAQ } from "@/components/marketing/faq";
import { CtaSection } from "@/components/marketing/cta-section";

const DESCRIPTION =
  "Track golf scores, side games, weekly groups, trip expenses and payments—all in one golf app.";

// Absolute title — bypasses the root layout's "%s · SplitFairway"
// template so the homepage reads exactly "SplitFairway | Scores,
// Games, Groups & Golf Trips" instead of doubling up the brand name.
// Next.js does NOT deep-merge nested metadata objects (openGraph, twitter)
// across route segments — a page-level `openGraph`/`twitter` block replaces
// the root layout's entirely, field for field. So even though the layout
// already sets siteName/type/images, this homepage override has to restate
// every field it wants to keep, or they silently disappear from the
// deployed <head> (which is exactly what happened: og:image, twitter:image,
// og:site_name, og:type, and twitter:card were missing in production until
// this fix).
const OG_IMAGE = {
  url: "/og-image.png",
  width: 1200,
  height: 630,
  alt: "SplitFairway — every round, every game, every trip.",
};

export const metadata: Metadata = {
  title: { absolute: "SplitFairway | Scores, Games, Groups & Golf Trips" },
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    siteName: "SplitFairway",
    type: "website",
    title: "SplitFairway | Scores, Games, Groups & Golf Trips",
    description: DESCRIPTION,
    url: "/",
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "SplitFairway | Scores, Games, Groups & Golf Trips",
    description: DESCRIPTION,
    images: ["/og-image.png"],
  },
};

/**
 * Mobile-first cleanup (see project notes): the homepage now leads
 * with three equally-weighted destinations in a fixed order -- playing
 * a round today, the weekly group, then a golf trip -- instead of
 * repeating each one's benefits across several sections. Content that
 * used to live directly on this page but was fully superseded by a
 * shorter section now lives at its own dedicated page instead of being
 * deleted: the full Trip Mode walkthrough is at /trip-mode, the full
 * plan comparison is at /pricing, and the complete FAQ list is at /faq.
 */
export default function LandingPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <Hero />
        <WaysToPlaySection />
        <GamesSection />
        <BeyondTheScorecardSection />
        <TripModePreviewSection />
        <HowItWorks />
        <PricingPreview />
        <FAQ preview />
        <CtaSection />
      </main>
      <SiteFooter />
    </>
  );
}
