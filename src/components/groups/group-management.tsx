"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import {
  removeGroupMemberAction,
  deleteGroupAction,
} from "@/actions/groups";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

/**
 * Every destructive action in this file confirms first via
 * window.confirm() — same pattern the rest of the app already uses
 * (member-list.tsx, expense-list.tsx, trip-danger-zone.tsx) — so
 * nothing here is a silent one-tap delete.
 */

export function RemoveGroupMemberButton({
  groupId,
  memberId,
  displayName,
}: {
  groupId: string;
  memberId: string;
  displayName: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleRemove() {
    if (!window.confirm(`Remove ${displayName} from this group?`)) return;
    setError(null);
    startTransition(async () => {
      try {
        await removeGroupMemberAction(groupId, memberId);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not remove that golfer.");
      }
    });
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleRemove}
        disabled={isPending}
        aria-label={`Remove ${displayName}`}
        className="flex h-11 w-11 items-center justify-center rounded-full text-charcoal-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
      >
        <X className="h-5 w-5" aria-hidden="true" />
      </button>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}


export function DeleteGroupButton({ groupId, groupName }: { groupId: string; groupName: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function handleDelete() {
    if (
      !window.confirm(
        `Delete "${groupName}"? Rounds already played from this group are kept — this only removes the saved group itself.`,
      )
    )
      return;
    setError(null);
    startTransition(async () => {
      try {
        await deleteGroupAction(groupId);
      } catch (err) {
        // deleteGroupAction redirects on success (which throws internally
        // in Next.js) — a real error only reaches here.
        setError(err instanceof Error ? err.message : "Could not delete that group.");
        router.refresh();
      }
    });
  }

  return (
    <div>
      {error && (
        <Alert variant="error" className="mb-3">
          {error}
        </Alert>
      )}
      <Button type="button" variant="outline" onClick={handleDelete} disabled={isPending}>
        {isPending ? "Deleting…" : "Delete Group"}
      </Button>
    </div>
  );
}
