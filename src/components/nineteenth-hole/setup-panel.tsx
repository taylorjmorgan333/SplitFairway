"use client";

import { useState, useTransition } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";
import {
  addCustomCounterAction,
  removeCustomCounterAction,
  renameCounterAction,
  setCounterActiveAction,
  setWhoCanRecordAction,
} from "@/actions/nineteenth-hole";
import { WHO_CAN_RECORD_VALUES, type WhoCanRecord } from "@/lib/validation/nineteenth-hole";
import type { NineteenthHoleCounter, NineteenthHoleSettings } from "@/components/nineteenth-hole/types";

const WHO_CAN_RECORD_LABELS: Record<WhoCanRecord, string> = {
  everyone: "Every golfer",
  captains_only: "Captains only",
};

/** One counter row -- an inline-editable label, an active toggle, and
 * (custom counters only) a remove button. Kept deliberately simple
 * (no drag-to-reorder) since captains configure this once per trip,
 * not something used often enough to warrant more machinery. */
function CounterRow({
  tripId,
  counter,
  onRenamed,
  onActiveChanged,
  onRemoved,
}: {
  tripId: string;
  counter: NineteenthHoleCounter;
  onRenamed: (label: string) => void;
  onActiveChanged: (isActive: boolean) => void;
  onRemoved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(counter.label);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function saveLabel() {
    const trimmed = label.trim();
    if (!trimmed || trimmed === counter.label) {
      setLabel(counter.label);
      setEditing(false);
      return;
    }
    startTransition(async () => {
      try {
        await renameCounterAction(tripId, counter.id, trimmed);
        onRenamed(trimmed);
        setEditing(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't rename that counter.");
        setLabel(counter.label);
      }
    });
  }

  return (
    <div className="flex items-center gap-3 rounded-xl bg-cream-100 px-3.5 py-2.5">
      <label className="flex min-h-11 flex-1 items-center gap-3 sm:min-h-0">
        <input
          type="checkbox"
          checked={counter.isActive}
          disabled={isPending}
          onChange={(e) => {
            const next = e.target.checked;
            startTransition(async () => {
              try {
                await setCounterActiveAction(tripId, counter.id, next);
                onActiveChanged(next);
              } catch (err) {
                setError(err instanceof Error ? err.message : "Couldn't update that counter.");
              }
            });
          }}
          className="h-5 w-5 shrink-0 accent-forest-700"
        />
        {editing ? (
          <input
            autoFocus
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={saveLabel}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                saveLabel();
              }
              if (e.key === "Escape") {
                setLabel(counter.label);
                setEditing(false);
              }
            }}
            maxLength={40}
            className="h-9 w-full min-w-0 rounded-lg border border-forest-600 bg-white px-2.5 text-base text-charcoal focus:outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className={cn(
              "truncate text-left text-base",
              counter.isActive ? "text-charcoal" : "text-charcoal-400 line-through",
            )}
          >
            {counter.label}
          </button>
        )}
      </label>
      {!counter.isDefault && (
        <button
          type="button"
          onClick={() => setConfirmRemove(true)}
          aria-label={`Remove ${counter.label}`}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-charcoal-400 hover:bg-cream-200 hover:text-red-700"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
      {error && <p className="w-full text-xs text-red-600">{error}</p>}
      <ConfirmDialog
        open={confirmRemove}
        onOpenChange={setConfirmRemove}
        title={`Remove "${counter.label}"?`}
        description="This deletes every entry recorded under this counter for this trip. This can't be undone."
        confirmLabel="Remove counter"
        onConfirm={async () => {
          await removeCustomCounterAction(tripId, counter.id);
          onRemoved();
        }}
      />
    </div>
  );
}

export function NineteenthHoleSetupPanel({
  tripId,
  settings,
  counters,
  onSettingsChange,
  onCountersChange,
}: {
  tripId: string;
  settings: NineteenthHoleSettings;
  counters: NineteenthHoleCounter[];
  onSettingsChange: (patch: Partial<NineteenthHoleSettings>) => void;
  onCountersChange: (updater: (prev: NineteenthHoleCounter[]) => NineteenthHoleCounter[]) => void;
}) {
  const [newCounterLabel, setNewCounterLabel] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [isAdding, startAdding] = useTransition();
  const [isSavingWho, startSavingWho] = useTransition();
  const [whoError, setWhoError] = useState<string | null>(null);

  const sorted = [...counters].sort((a, b) => a.sortOrder - b.sortOrder);

  function addCounter() {
    const trimmed = newCounterLabel.trim();
    if (!trimmed) return;
    setAddError(null);
    startAdding(async () => {
      try {
        const created = await addCustomCounterAction(tripId, trimmed);
        onCountersChange((prev) => [...prev, created]);
        setNewCounterLabel("");
      } catch (err) {
        setAddError(err instanceof Error ? err.message : "Couldn't add that counter.");
      }
    });
  }

  return (
    <div className="space-y-5">
      <div>
        <Label>Who can record activity</Label>
        <div className="flex flex-col gap-2 sm:flex-row sm:gap-4">
          {WHO_CAN_RECORD_VALUES.map((value) => (
            <label key={value} className="flex min-h-11 items-center gap-2 text-base text-charcoal-700 sm:min-h-0">
              <input
                type="radio"
                name="whoCanRecord"
                checked={settings.whoCanRecord === value}
                disabled={isSavingWho}
                onChange={() => {
                  setWhoError(null);
                  startSavingWho(async () => {
                    try {
                      await setWhoCanRecordAction(tripId, value);
                      onSettingsChange({ whoCanRecord: value });
                    } catch (err) {
                      setWhoError(err instanceof Error ? err.message : "Couldn't update this setting.");
                    }
                  });
                }}
                className="h-5 w-5 accent-forest-700"
              />
              {WHO_CAN_RECORD_LABELS[value]}
            </label>
          ))}
        </div>
        {whoError && <p className="mt-1 text-xs text-red-600">{whoError}</p>}
      </div>

      <div>
        <Label>Counters</Label>
        <div className="space-y-2">
          {sorted.map((counter) => (
            <CounterRow
              key={counter.id}
              tripId={tripId}
              counter={counter}
              onRenamed={(label) =>
                onCountersChange((prev) => prev.map((c) => (c.id === counter.id ? { ...c, label } : c)))
              }
              onActiveChanged={(isActive) =>
                onCountersChange((prev) => prev.map((c) => (c.id === counter.id ? { ...c, isActive } : c)))
              }
              onRemoved={() => onCountersChange((prev) => prev.filter((c) => c.id !== counter.id))}
            />
          ))}
        </div>
        <p className="mt-1.5 text-xs text-charcoal-400">
          Uncheck a counter to hide it without losing its history. Default counters can be turned off but not
          removed; custom counters can be removed entirely.
        </p>
      </div>

      <div>
        <Label htmlFor="newCounterLabel">Add a custom counter</Label>
        <div className="flex gap-2">
          <Input
            id="newCounterLabel"
            value={newCounterLabel}
            onChange={(e) => setNewCounterLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCounter();
              }
            }}
            placeholder="e.g. Sand Traps, Bad Jokes"
            maxLength={40}
          />
          <Button type="button" size="lg" disabled={isAdding || !newCounterLabel.trim()} onClick={addCounter}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add
          </Button>
        </div>
        {addError && <p className="mt-1 text-xs text-red-600">{addError}</p>}
      </div>

      <Alert variant="info">
        The 19th Hole tracks fun trip stats only — no dollar values, payments, or drinking goals.
      </Alert>
    </div>
  );
}
