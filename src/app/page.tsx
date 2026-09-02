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
