import { Check, Flag } from "lucide-react";
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

      <ol className="mt-8 w-full max-w-xs space-y-2 text-left text-xs text-charcoal-400">
        <li className="flex items-center gap-2">
          <Check className="h-3.5 w-3.5 shrink-0 text-forest-600" aria-hidden="true" />
          <span className="text-charcoal-500 line-through">Create your account</span>
        </li>
        <li className="flex items-center gap-2">
          <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border border-forest-900/25 text-[9px] font-medium text-charcoal-500">
            2
          </span>
          Create your golf trip
        </li>
        <li className="flex items-center gap-2 opacity-60">
          <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border border-forest-900/25 text-[9px] font-medium">
            3
          </span>
          Add your golfers, then an expense, and share the invite link
        </li>
      </ol>
    </div>
  );
}
