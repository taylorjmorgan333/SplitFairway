import type { Metadata } from "next";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { FAQ } from "@/components/marketing/faq";

export const metadata: Metadata = {
  title: "FAQ",
  description: "Answers to common questions about SplitFairway — pricing, expenses, privacy and more.",
  alternates: { canonical: "/faq" },
};

/**
 * The complete FAQ list, moved here from being fully inline on the
 * homepage (spec item 9: the homepage now shows just 3 with a
 * "View All FAQs" link to this page). Renders the exact same FAQS data
 * as the homepage's preview -- nothing was shortened or removed, only
 * relocated.
 */
export default function FaqPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <FAQ />
      </main>
      <SiteFooter />
    </>
  );
}
