import { formatDate } from "@/lib/utils";
import type { Tables } from "@/lib/supabase/database.types";

/**
 * Read-only view of handicap_history — an append-only audit trail
 * written exclusively by the handle_handicap_change() trigger (see
 * supabase/migrations/20260903000000_golf_profiles.sql). Nothing here
 * ever writes to that table.
 */
export function HandicapHistoryList({ entries }: { entries: Tables<"handicap_history">[] }) {
  if (entries.length === 0) return null;

  return (
    <div>
      <h4 className="text-sm font-medium text-forest-900">Handicap history</h4>
      <ul className="mt-2 divide-y divide-charcoal-400/10 text-sm">
        {entries.map((entry) => (
          <li key={entry.id} className="flex items-center justify-between py-1.5">
            <span className="text-charcoal-700">{entry.handicap_index.toFixed(1)}</span>
            <span className="text-xs text-charcoal-400">
              {formatDate(entry.recorded_at)} ·{" "}
              {entry.source === "ghin_screenshot_import" ? "GHIN import" : "manual"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
