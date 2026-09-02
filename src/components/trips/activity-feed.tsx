import { formatCurrency } from "@/lib/utils";
import type { Tables } from "@/lib/supabase/database.types";

export type ActivityRow = Tables<"activity_log"> & {
  actorName: string | null;
};

function describe(activity: ActivityRow): string {
  const data = (activity.event_data ?? {}) as Record<string, unknown>;
  const actor = activity.actorName ?? "Someone";
  const asString = (v: unknown) => (typeof v === "string" ? v : "");
  const asCents = (v: unknown) => (typeof v === "number" ? formatCurrency(v) : "");

  switch (activity.event_type) {
    case "trip_created":
      return `${actor} created the trip "${asString(data.name)}"`;
    case "member_invited":
      return `${actor} invited ${asString(data.email)} as ${asString(data.role) === "captain" ? "a co-treasurer" : "a golfer"}`;
    case "member_joined":
      return `${asString(data.email)} joined the trip`;
    case "member_role_changed":
      return `${actor} made a golfer ${asString(data.role) === "captain" ? "a co-treasurer" : "a regular member"}`;
    case "member_removed":
      return `${actor} removed ${asString(data.display_name) || "a golfer"} from the trip`;
    case "invitation_declined":
      return `${asString(data.email)} declined their invitation`;
    case "expense_created":
      return `${actor} added the expense "${asString(data.title)}" (${asCents(data.amount_cents)})`;
    case "expense_updated":
      return `${actor} edited the expense "${asString(data.title)}" (now ${asCents(data.amount_cents)})`;
    case "expense_deleted":
      return `${actor} deleted the expense "${asString(data.title)}"`;
    case "payment_reported":
      return `${actor} reported a payment of ${asCents(data.amount_cents)}`;
    case "payment_confirmed":
      return `${actor} confirmed a payment of ${asCents(data.amount_cents)}`;
    case "payment_rejected":
      return `${actor} rejected a reported payment${data.reason ? ` (${asString(data.reason)})` : ""}`;
    case "trip_updated":
      return `${actor} updated the trip details`;
    case "trip_archived":
      return `${actor} archived the trip`;
    case "trip_restored":
      return `${actor} restored the trip from the archive`;
    default:
      return `${actor} — ${activity.event_type}`;
  }
}

export function ActivityFeed({ activity, limit }: { activity: ActivityRow[]; limit?: number }) {
  const rows = limit ? activity.slice(0, limit) : activity;

  if (rows.length === 0) {
    return <p className="text-sm text-charcoal-500">Nothing has happened on this trip yet.</p>;
  }

  return (
    <ul className="divide-y divide-forest-900/[0.06]">
      {rows.map((row) => (
        <li key={row.id} className="py-2.5 text-sm text-charcoal">
          {describe(row)}
          <span className="ml-2 text-xs text-charcoal-400">
            {new Intl.DateTimeFormat("en-US", {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            }).format(new Date(row.created_at))}
          </span>
        </li>
      ))}
    </ul>
  );
}
