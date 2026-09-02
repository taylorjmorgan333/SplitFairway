import type { Metadata } from "next";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { Hero } from "@/components/marketing/hero";
import { ProblemSection } from "@/components/marketing/problem-section";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { DashboardPreview } from "@/components/marketing/dashboard-preview";
import { FeatureList } from "@/components/marketing/feature-list";
import { PricingPreview } from "@/components/marketing/pricing-preview";
import { FAQ } from "@/components/marketing/faq";
import { CtaSection } from "@/components/marketing/cta-section";

const DESCRIPTION =
  "Split lodging, tee times, rental cars and every other golf trip expense. Everyone sees exactly what they owe and when it's due.";

// Absolute title — bypasses the root layout's "%s · SplitFairway"
// template so the homepage reads exactly "SplitFairway | Golf Trip
// Expense Tracking" instead of doubling up the brand name.
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
  alt: "SplitFairway — keep the trip together, split everything else.",
};

export const metadata: Metadata = {
  title: { absolute: "SplitFairway | Golf Trip Expense Tracking" },
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    siteName: "SplitFairway",
    type: "website",
    title: "SplitFairway | Golf Trip Expense Tracking",
    description: DESCRIPTION,
    url: "/",
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "SplitFairway | Golf Trip Expense Tracking",
    description: DESCRIPTION,
    images: ["/og-image.png"],
  },
};

export default function LandingPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <Hero />
        <ProblemSection />
        <HowItWorks />
        <DashboardPreview />
        <FeatureList />
        <PricingPreview />
        <FAQ />
        <CtaSection />
      </main>
      <SiteFooter />
    </>
  );
}
