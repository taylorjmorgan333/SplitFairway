import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { Container } from "@/components/ui/container";
import { Alert } from "@/components/ui/alert";

export function LegalPageShell({
  title,
  updated,
  showDraftBanner = true,
  children,
}: {
  title: string;
  updated: string;
  /**
   * Every legal page shows the "Draft — not final" notice by default.
   * Set false only for a page whose content is no longer a placeholder
   * draft (e.g. a Privacy Policy the owner has actually supplied) —
   * Terms of Service and the data-deletion page keep the default.
   */
  showDraftBanner?: boolean;
  children: React.ReactNode;
}) {
  return (
    <>
      <SiteHeader />
      <main className="py-14 sm:py-20">
        <Container className="max-w-3xl">
          <h1 className="text-3xl sm:text-4xl">{title}</h1>
          <p className="mt-2 text-sm text-charcoal-500">Last updated {updated}</p>

          {showDraftBanner && (
            <Alert variant="info" className="mt-6">
              <strong>Draft — not final.</strong> This page is placeholder legal text written for
              a private beta, not a finished policy. It has not been reviewed by an attorney and
              should not be relied on as legal advice or a binding agreement until it has been.
            </Alert>
          )}

          <div className="prose-legal mt-8 space-y-6 text-sm leading-relaxed text-charcoal-700">
            {children}
          </div>
        </Container>
      </main>
      <SiteFooter />
    </>
  );
}
