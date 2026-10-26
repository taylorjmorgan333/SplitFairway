import type { ReactNode } from "react";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { Container } from "@/components/ui/container";

export function PublicPage({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main className="bg-cream-50 py-14 sm:py-20">
        <Container className="max-w-3xl">{children}</Container>
      </main>
      <SiteFooter />
    </>
  );
}
