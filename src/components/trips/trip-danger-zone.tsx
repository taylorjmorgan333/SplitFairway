"use client";

import { useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { setTripArchivedAction, deleteTripAction } from "@/actions/trips";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import type { Tables } from "@/lib/supabase/database.types";

function DeleteSubmitButton() {
  // Its own useFormStatus, not the archive toggle's useTransition — the
  // delete form's redirect-on-success can take a moment, and without
  // this the button would stay clickable (and double-submittable) the
  // whole time.
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="ghost"
      size="sm"
      disabled={pending}
      className="text-red-700 hover:bg-red-50"
    >
      {pending ? "Deleting…" : "Delete trip"}
    </Button>
  );
}

export function TripDangerZone({ trip }: { trip: Tables<"trips"> }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const isArchived = trip.status === "cancelled";

  function handleToggleArchive() {
    setError(null);
    startTransition(async () => {
      try {
        await setTripArchivedAction(trip.id, !isArchived);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not update the trip.");
      }
    });
  }

  // deleteTripAction redirects on success (a Next.js control-flow throw,
  // not a real error), so it's submitted as a real form action rather
  // than called from a try/catch — that lets the redirect happen normally.
  const boundDelete = deleteTripAction.bind(null, trip.id);

  return (
    <div className="space-y-4">
      {error && <Alert variant="error">{error}</Alert>}
      <div className="flex flex-wrap gap-3">
        <Button variant="outline" size="sm" disabled={isPending} onClick={handleToggleArchive}>
          {isArchived ? "Restore trip" : "Archive trip"}
        </Button>
        <form
          action={boundDelete}
          onSubmit={(event) => {
            if (
              !window.confirm(
                `Delete "${trip.name}" permanently? This removes every expense, payment and invitation on this trip. This cannot be undone.`,
              )
            ) {
              event.preventDefault();
            }
          }}
        >
          <DeleteSubmitButton />
        </form>
      </div>
      <p className="text-xs text-charcoal-400">
        Archiving marks the trip cancelled and keeps its history. Deleting
        removes it — and everything on it — for every golfer.
      </p>
    </div>
  );
}
