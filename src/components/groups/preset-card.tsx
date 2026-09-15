"use client";

import { useState, useTransition } from "react";
import { Pencil, Copy, X } from "lucide-react";
import { duplicateGroupGamePresetAction, deleteGroupGamePresetAction } from "@/actions/groups";
import { AddGamePresetForm, type GamePresetInitialValues } from "@/components/groups/add-game-preset-form";
import type { PresetGameType } from "@/lib/validation/group";

const GAME_TYPE_LABELS: Record<PresetGameType, string> = {
  skins: "Skins",
  nassau: "Nassau",
  match_play: "Match Play",
  stableford: "Stableford",
};

interface PresetSettings {
  scoringMetric?: "gross" | "net";
  carryover?: boolean;
  isMonetary?: boolean;
  dollarValue?: number | null;
}

/**
 * One saved preset's row on the Settings tab -- rename/edit (opens this
 * same form inline, prefilled), duplicate (one tap, no form), and
 * delete (owner-only, confirmed) per spec item 3. Edit/duplicate are
 * available to any group member, matching golf_group_game_presets'
 * insert/update RLS; delete stays owner-only (its own RLS policy).
 */
export function PresetCard({
  groupId,
  isOwner,
  monetaryEnabled,
  preset,
}: {
  groupId: string;
  isOwner: boolean;
  monetaryEnabled: boolean;
  preset: { id: string; name: string; side_game_type: string; settings: PresetSettings };
}) {
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (editing) {
    const initialValues: GamePresetInitialValues = {
      id: preset.id,
      name: preset.name,
      sideGameType: preset.side_game_type as PresetGameType,
      scoringMetric: preset.settings.scoringMetric,
      carryover: preset.settings.carryover,
      isMonetary: preset.settings.isMonetary,
      dollarValue: preset.settings.dollarValue,
    };
    return (
      <div className="p-5">
        <AddGamePresetForm
          groupId={groupId}
          monetaryEnabled={monetaryEnabled}
          initialValues={initialValues}
          onSaved={() => setEditing(false)}
        />
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="mt-3 text-sm font-medium text-charcoal-500 underline hover:no-underline"
        >
          Cancel
        </button>
      </div>
    );
  }

  const isPresetType = (preset.side_game_type as PresetGameType) in GAME_TYPE_LABELS;
  const summary = [
    isPresetType ? GAME_TYPE_LABELS[preset.side_game_type as PresetGameType] : preset.side_game_type,
    preset.settings.scoringMetric ? preset.settings.scoringMetric : null,
    preset.settings.carryover ? "carryover" : null,
    preset.settings.isMonetary && preset.settings.dollarValue
      ? `$${preset.settings.dollarValue}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex items-center justify-between gap-3 p-5">
      <div className="min-w-0">
        <p className="text-base font-medium text-forest-900">{preset.name}</p>
        <p className="mt-0.5 text-sm text-charcoal-500">{summary}</p>
        {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label={`Edit ${preset.name}`}
          className="flex h-11 w-11 items-center justify-center rounded-full text-charcoal-400 transition-colors hover:bg-cream-200 hover:text-forest-800"
        >
          <Pencil className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              try {
                await duplicateGroupGamePresetAction(groupId, preset.id);
              } catch (err) {
                setError(err instanceof Error ? err.message : "Couldn't duplicate that preset.");
              }
            });
          }}
          aria-label={`Duplicate ${preset.name}`}
          className="flex h-11 w-11 items-center justify-center rounded-full text-charcoal-400 transition-colors hover:bg-cream-200 hover:text-forest-800 disabled:opacity-50"
        >
          <Copy className="h-4 w-4" aria-hidden="true" />
        </button>
        {isOwner && (
          <button
            type="button"
            disabled={isPending}
            onClick={() => {
              if (!window.confirm(`Delete the "${preset.name}" preset?`)) return;
              setError(null);
              startTransition(async () => {
                try {
                  await deleteGroupGamePresetAction(groupId, preset.id);
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Couldn't delete that preset.");
                }
              });
            }}
            aria-label={`Delete ${preset.name}`}
            className="flex h-11 w-11 items-center justify-center rounded-full text-charcoal-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}
