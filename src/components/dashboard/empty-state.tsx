import { Flag } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";

export function EmptyState() {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-forest-900/15 bg-white/60 px-6 py-16 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-forest-800/10">
        <Flag className="h-5 w-5 text-forest-700" strokeWidth={1.75} aria-hidden="true" />
      </span>
      <h2 className="mt-5 text-xl text-forest-900">No trips yet</h2>
      <p className="mt-2 max-w-sm text-sm text-charcoal-500">
        Create your first trip to start splitting expenses and tracking who
        has paid.
      </p>
      <ButtonLink href="/trips/new" variant="primary" className="mt-6">
        Create New Trip
      </ButtonLink>
    </div>
  );
}
