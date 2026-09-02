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
export const metadata: Metadata = {
  title: { absolute: "SplitFairway | Golf Trip Expense Tracking" },
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    title: "SplitFairway | Golf Trip Expense Tracking",
    description: DESCRIPTION,
    url: "/",
  },
  twitter: {
    title: "SplitFairway | Golf Trip Expense Tracking",
    description: DESCRIPTION,
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
