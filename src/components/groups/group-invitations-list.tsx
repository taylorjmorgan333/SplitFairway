"use client";

import { useState, useTransition } from "react";
import { revokeGroupInvitationAction } from "@/actions/group-invitations";
import { formatDate } from "@/lib/utils";

export interface GroupInvitationRow {
  id: string;
  email: string | null;
  invited_role: "member" | "guest";
  status: string;
  expires_at: string;
}

/** Owner-only list of this group's outstanding invitations, with revoke -- pending only (accepted/declined/revoked/expired ones are just noise once they're resolved). */
export function GroupInvitationsList({ groupId, invitations }: { groupId: string; invitations: GroupInvitationRow[] }) {
  const pending = invitations.filter((i) => i.status === "pending" && new Date(i.expires_at) > new Date());
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (pending.length === 0) {
    return <p className="text-sm text-charcoal-500">No outstanding invitations.</p>;
  }

  return (
    <div>
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      <ul className="divide-y divide-cream-200">
        {pending.map((inv) => (
          <li key={inv.id} className="flex items-center justify-between gap-3 py-3 text-sm">
            <div>
              <p className="font-medium text-forest-900">
                {inv.email ?? "Reusable link"}{" "}
                <span className="font-normal text-charcoal-500">
                  · {inv.invited_role === "guest" ? "Guest" : "Member"}
                </span>
              </p>
              <p className="text-xs text-charcoal-400">Expires {formatDate(inv.expires_at)}</p>
            </div>
            <button
              type="button"
              disabled={isPending}
              onClick={() => {
                setError(null);
                startTransition(async () => {
                  try {
                    await revokeGroupInvitationAction(groupId, inv.id);
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Couldn't revoke that invitation.");
                  }
                });
              }}
              className="text-xs font-medium text-red-700 underline hover:no-underline disabled:opacity-50"
            >
              Revoke
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
