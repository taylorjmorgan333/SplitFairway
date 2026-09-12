"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, ButtonLink } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

/**
 * Lets a captain jump straight from a course's detail page into
 * scheduling a round at it, instead of the previous dead end (course
 * detail had no next step -- you had to go find the right trip's
 * Rounds page yourself and pick the course again from the dropdown
 * there). Rounds are trip-scoped and RLS-restricted to a trip's captain
 * (rounds_insert_captain), so this only ever offers trips the caller
 * actually captains -- the caller (the course detail page) is
 * responsible for querying that list and rendering nothing here (in
 * favor of a "become a captain first" message) when it's empty.
 */
export function StartRoundControl({
  courseId,
  trips,
}: {
  courseId: string;
  trips: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [tripId, setTripId] = useState(trips[0]?.id ?? "");

  if (trips.length === 0) {
    return null;
  }

  if (trips.length === 1) {
    return (
      <ButtonLink href={`/trips/${trips[0].id}/rounds/new?courseId=${courseId}`} variant="primary">
        Start a Round
      </ButtonLink>
    );
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex-1">
        <Label htmlFor="startRoundTrip">Which trip?</Label>
        <select
          id="startRoundTrip"
          value={tripId}
          onChange={(e) => setTripId(e.target.value)}
          className="h-11 w-full rounded-lg border border-charcoal-400/25 bg-white px-3.5 text-sm text-charcoal transition-colors focus:border-forest-600"
        >
          {trips.map((trip) => (
            <option key={trip.id} value={trip.id}>
              {trip.name}
            </option>
          ))}
        </select>
      </div>
      <Button
        type="button"
        onClick={() => router.push(`/trips/${tripId}/rounds/new?courseId=${courseId}`)}
      >
        Start a Round
      </Button>
    </div>
  );
}
