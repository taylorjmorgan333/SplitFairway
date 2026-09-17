import type { Metadata } from "next";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { Container } from "@/components/ui/container";
import { ButtonLink } from "@/components/ui/button";
import { TripModeSection } from "@/components/marketing/trip-mode-section";
import { DashboardPreview } from "@/components/marketing/dashboard-preview";

export const metadata: Metadata = {
  title: "Trip Mode",
  description:
    "The complete SplitFairway Trip Mode walkthrough — multiple rounds, lodging, expenses, payment tracking and final settlement, all in one place.",
  alternates: { canonical: "/trip-mode" },
};

/**
 * The full Trip Mode explanation, moved here from the homepage (spec
 * item 6: the homepage now only shows a short preview with a link to
 * this page). TripModeSection and DashboardPreview are the exact same
 * components that used to render directly on "/" -- nothing about
 * Trip Mode's detailed feature list or the sample trip dashboard was
 * deleted, only relocated to its own dedicated page.
 */
export default function TripModePage() {
  return (
    <>
      <SiteHeader />
      <main>
        <section className="bg-forest-950 py-14 sm:py-20">
          <Container className="text-center">
            <h1 className="text-3xl text-cream-50 sm:text-4xl">Trip Mode</h1>
            <p className="mx-auto mt-3 max-w-xl text-cream-100/80">
              Everything your group needs for the big golf trip — rounds, lodging, expenses,
              payments and a final recap, all in one place.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <ButtonLink href="/signup" variant="gold" size="lg">
                Start Playing Free
              </ButtonLink>
            </div>
          </Container>
        </section>

        <TripModeSection />
        <DashboardPreview />
      </main>
      <SiteFooter />
    </>
  );
}
