import type { Metadata } from "next";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { Container } from "@/components/ui/container";
import { NassauCalculator } from "@/components/tools/nassau-calculator";
import { toolMetadata } from "@/lib/tools/tool-metadata";

const DESCRIPTION =
  "Score a Nassau on your phone — front, back, and overall match play, with best ball, net handicaps, and presses. No account needed.";

export const metadata: Metadata = toolMetadata("Nassau Calculator", DESCRIPTION, "/tools/nassau-calculator");

export default function NassauCalculatorPage() {
  return (
    <>
      <SiteHeader />
      <main className="bg-cream-50 py-10 sm:py-16">
        <Container className="max-w-3xl">
          <h1 className="text-3xl sm:text-4xl">Nassau calculator</h1>
          <p className="mt-3 text-base leading-relaxed text-charcoal-500">
            Enter scores as you play. The front nine, the back nine, and the overall match update
            from the same rules SplitFairway uses in a round. Nothing is stored on this page.
          </p>
          <div className="mt-8">
            <NassauCalculator />
          </div>
        </Container>
      </main>
      <SiteFooter />
    </>
  );
}
