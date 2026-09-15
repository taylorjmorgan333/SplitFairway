"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { discardRoundAction } from "@/actions/rounds";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";

/**
 * "Delete Round" for a COMPLETED round only -- rendered inside Round
 * Settings (src/app/(app)/trips/[tripId]/rounds/[roundId]/page.tsx),
 * never as a prominent control next to the results themselves.
 * Deliberately a stronger confirmation than the quick "Keep Round" /
 * "Discard Round" dialog used for an incomplete round's card menu:
 * typing the literal word DELETE, the same pattern already used for
 * permanently deleting an account (see DeleteAccountForm) -- since a
 * completed round is the one a captain is least likely to want to
 * remove by accident.
 *
 * Uses the exact same discard_round() soft delete underneath (still
 * recoverable at the database level, still excluded everywhere
 * immediately), not a separate hard-delete path -- item 5 of the spec
 * only calls for a different confirmation and placement here, not a
 * different underlying mechanism.
 */
export function DeleteRoundButton({ tripId, roundId }: { tripId: string; roundId: string }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!expanded) {
    return (
      <Button
        type="button"
        variant="outline"
        onClick={() => setExpanded(true)}
        className="border-red-200 text-red-700 hover:bg-red-50"
      >
        Delete Round
      </Button>
    );
  }

  return (
    <div className="space-y-4 rounded-lg border border-red-200 bg-red-50/40 p-4">
      <Alert variant="error">
        <strong>This can&apos;t be undone from here.</strong> Scores and game results recorded for
        this round will be removed. Your saved course, golfers, group and trip information will
        not be affected.
      </Alert>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div>
        <Label htmlFor="delete-round-confirmation">
          Type <span className="font-mono font-semibold">DELETE</span> to confirm
        </Label>
        <Input
          id="delete-round-confirmation"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          autoComplete="off"
        />
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
        <Button type="button" variant="ghost" size="lg" onClick={() => { setExpanded(false); setConfirmText(""); setError(null); }} disabled={pending}>
          Cancel
        </Button>
        <Button
          type="button"
          size="lg"
          disabled={confirmText !== "DELETE" || pending}
          className="bg-red-700 text-white hover:bg-red-800 active:bg-red-900"
          onClick={async () => {
            setPending(true);
            setError(null);
            const result = await discardRoundAction(tripId, roundId);
            if (result.status === "error") {
              setPending(false);
              setError(result.message ?? "Couldn't delete this round. Please try again.");
              return;
            }
            router.push(`/trips/${tripId}/rounds`);
            router.refresh();
          }}
        >
          {pending ? "Deleting…" : "Permanently delete this round"}
        </Button>
      </div>
    </div>
  );
}
