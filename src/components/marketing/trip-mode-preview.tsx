import { Calculator, CalendarDays, ShieldCheck } from "lucide-react";
import { Container } from "@/components/ui/container";
import { SectionLink } from "@/components/marketing/section-link";

const BENEFITS = [
  { icon: Calculator, label: "Split expenses fairly" },
  { icon: CalendarDays, label: "Multiple rounds in one place" },
  { icon: ShieldCheck, label: "Final settlement at the end" },
] as const;

function TripVisualPreview() {
  return (
    <div className="mx-auto w-full max-w-sm rounded-2xl border border-forest-900/[0.08] bg-white p-5 shadow-card">
      <p className="text-xs font-medium uppercase tracking-wide text-charcoal-400">Pebble Ridge Trip</p>
      <p className="mt-1 font-serif text-lg text-forest-900">Sept 18–21 · 8 golfers</p>
      <div className="mt-3 flex items-center justify-between rounded-xl bg-cream-100 px-3.5 py-2.5">
        <span className="text-sm text-charcoal-700">Total outstanding</span>
        <span className="font-serif text-lg text-forest-900">$975.00</span>
      </div>
      <div className="mt-2 flex items-center justify-between rounded-xl bg-cream-100 px-3.5 py-2.5">
        <span className="text-sm text-charcoal-700">Settled up</span>
        <span className="text-sm font-medium text-forest-700">2 of 4 golfers</span>
      </div>
    </div>
  );
}

/**
 * A short preview, not a full explanation (spec item 6) -- one visual,
 * three benefits, one link. The complete Trip Mode story (fair expense
 * splitting, a running ledger, payment tracking, reminders, multiple
 * rounds, trip games, final settlement) still exists in full at
 * /trip-mode, reusing the same TripModeSection + DashboardPreview
 * components that used to render directly on the homepage -- nothing
 * was deleted, just relocated to its own dedicated page.
 */
export function TripModePreviewSection() {
  return (
    <section id="trip-mode" className="bg-cream-50 py-10 sm:py-20 lg:py-28">
      <Container>
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <h2 className="text-3xl sm:text-4xl">When the group travels, Trip Mode takes over.</h2>
            <p className="mt-4 max-w-xl text-lg text-charcoal-500">
              Keep rounds, lodging, expenses and payments together for the whole trip.
            </p>
            <div className="mt-6 space-y-3">
              {BENEFITS.map((benefit) => (
                <div key={benefit.label} className="flex items-center gap-3">
                  <benefit.icon
                    className="h-5 w-5 shrink-0 text-forest-700"
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />
                  <span className="text-sm font-medium text-forest-900">{benefit.label}</span>
                </div>
              ))}
            </div>
            <div className="mt-8">
              <SectionLink href="/trip-mode" variant="primary" size="lg">
                Explore Trip Mode
              </SectionLink>
            </div>
          </div>
          <TripVisualPreview />
        </div>
      </Container>
    </section>
  );
}
