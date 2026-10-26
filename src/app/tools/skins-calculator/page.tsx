import type { Metadata } from "next";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { Container } from "@/components/ui/container";
import { SkinsCalculator } from "@/components/tools/skins-calculator";
import { toolMetadata } from "@/lib/tools/tool-metadata";

const DESCRIPTION =
  "See who won each skin, including carryovers. Gross or net, on your phone, with no account required.";

export const metadata: Metadata = toolMetadata("Skins Calculator", DESCRIPTION, "/tools/skins-calculator");

export default function SkinsCalculatorPage() {
  return (
    <>
      <SiteHeader />
      <main className="bg-cream-50 py-10 sm:py-16">
        <Container className="max-w-3xl">
          <h1 className="text-3xl sm:text-4xl">Skins calculator</h1>
          <p className="mt-3 text-base leading-relaxed text-charcoal-500">
            Lowest unique score takes the hole. Ties can carry. This uses the same skins rules as
            a round inside SplitFairway, and it does not save anything until you create an account.
          </p>
          <div className="mt-8">
            <SkinsCalculator />
          </div>
        </Container>
      </main>
      <SiteFooter />
    </>
  );
}
