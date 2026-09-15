"use client";

import { useState, useTransition } from "react";
import {
  revokeGuestInvitationAction,
  regenerateGuestInvitationAction,
} from "@/actions/guest-invitations";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { resolveGuestInvitationStatus } from "@/lib/golf/guest-invitation";

export interface GuestInvitationRow {
  id: string;
  guestDisplayName: string;
  status: "pending" | "redeemed" | "revoked";
  expiresAt: string;
}

/**
 * Captain-only management list for this round's guest scoring links
 * (spec item 1: "Allow the captain to revoke and regenerate access").
 * Revoked links are filtered out by the round page's own loader
 * (there's nothing actionable left to do with one), so every row here
 * is either still awaiting first use or already being used to score.
 */
export function GuestInvitationsList({
  tripId,
  roundId,
  invitations,
}: {
  tripId: string;
  roundId: string;
  invitations: GuestInvitationRow[];
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [newLink, setNewLink] = useState<{ id: string; url: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  if (invitations.length === 0) {
    return null;
  }

  function handleRevoke(id: string) {
    setError(null);
    setBusyId(id);
    startTransition(async () => {
      try {
        await revokeGuestInvitationAction(tripId, roundId, id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't revoke that guest link.");
      } finally {
        setBusyId(null);
      }
    });
  }

  function handleRegenerate(id: string) {
    setError(null);
    setBusyId(id);
    setNewLink(null);
    startTransition(async () => {
      try {
        const { token } = await regenerateGuestInvitationAction(tripId, roundId, id);
        setNewLink({ id, url: `${window.location.origin}/invite/guest/${token}` });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't regenerate that guest link.");
      } finally {
        setBusyId(null);
      }
    });
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-charcoal-500">Guest scoring links</p>
      {error && <Alert variant="error">{error}</Alert>}
      <ul className="divide-y divide-charcoal-400/10 overflow-hidden rounded-lg border border-charcoal-400/10">
        {invitations.map((inv) => (
          <li key={inv.id} className="space-y-2 px-3.5 py-3">
            {(() => {
              const resolved = resolveGuestInvitationStatus({ status: inv.status, expiresAt: inv.expiresAt });
              const BADGE_COPY = {
                pending: { label: "Not opened yet", variant: "gold" as const },
                redeemed: { label: "Scoring", variant: "success" as const },
                expired: { label: "Expired", variant: "neutral" as const },
                revoked: { label: "Revoked", variant: "neutral" as const },
              };
              const badge = BADGE_COPY[resolved];
              return (
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-charcoal">{inv.guestDisplayName}</p>
                    <Badge variant={badge.variant}>{badge.label}</Badge>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isPending && busyId === inv.id}
                      onClick={() => handleRegenerate(inv.id)}
                    >
                      Regenerate
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={isPending && busyId === inv.id}
                      onClick={() => handleRevoke(inv.id)}
                    >
                      Revoke
                    </Button>
                  </div>
                </div>
              );
            })()}
            {newLink?.id === inv.id && (
              <div className="space-y-1 rounded-lg bg-cream-100 p-2">
                <p className="text-xs text-charcoal-500">New link -- the old one no longer works.</p>
                <code className="block break-all text-xs text-charcoal-600">{newLink.url}</code>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
