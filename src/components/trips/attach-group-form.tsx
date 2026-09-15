"use client";

import { useState, useTransition } from "react";
import { attachTripToGroupAction } from "@/actions/groups";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

/**
 * Requirement: "Trips may optionally be connected to a saved group."
 * Purely a metadata link (see attach_trip_to_group's RLS/RPC comment) --
 * saving it never adds or removes anyone from either side.
 */
export function AttachGroupForm({
  tripId,
  currentGroupId,
  groups,
}: {
  tripId: string;
  currentGroupId: string | null;
  groups: { id: string; name: string }[];
}) {
  const [value, setValue] = useState(currentGroupId ?? "");
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  function handleSave() {
    setMessage(null);
    startTransition(async () => {
      const result = await attachTripToGroupAction(tripId, value || null);
      setMessage({
        type: result.status === "error" ? "error" : "success",
        text: result.message ?? (result.status === "error" ? "Something went wrong." : "Saved."),
      });
    });
  }

  if (groups.length === 0) {
    return (
      <p className="text-base text-charcoal-500">
        You don&apos;t have any saved groups yet — create one from Groups to connect it here.
      </p>
    );
  }

  return (
    <div>
      {message && (
        <Alert variant={message.type === "error" ? "error" : "success"} className="mb-4">
          {message.text}
        </Alert>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <select
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="h-11 w-full rounded-lg border border-charcoal-400/25 bg-white px-3.5 text-base text-charcoal transition-colors focus:border-forest-600 sm:max-w-xs"
        >
          <option value="">Not connected to a group</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
        <Button type="button" variant="outline" onClick={handleSave} disabled={isPending}>
          {isPending ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}
