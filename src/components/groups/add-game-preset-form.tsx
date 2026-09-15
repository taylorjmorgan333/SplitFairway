"use client";

import { useActionState, useRef, useState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { createGroupGamePresetAction, updateGroupGamePresetAction } from "@/actions/groups";
import type { ActionState } from "@/actions/auth";
import { PRESET_GAME_TYPES, type PresetGameType } from "@/lib/validation/group";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { MONETARY_GAME_NOTICE } from "@/lib/golf/money-notice";

const initialState: ActionState = { status: "idle" };

const GAME_TYPE_LABELS: Record<PresetGameType, string> = {
  skins: "Skins",
  nassau: "Nassau",
  match_play: "Match Play",
  stableford: "Stableford",
};

export interface GamePresetInitialValues {
  id: string;
  name: string;
  sideGameType: PresetGameType;
  scoringMetric?: "gross" | "net";
  carryover?: boolean;
  isMonetary?: boolean;
  dollarValue?: number | null;
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={pending}>
      {pending ? "Saving…" : label}
    </Button>
  );
}

/**
 * One form for both saving a new preset and editing an existing one --
 * the fields shown depend on which of the four supported formats
 * (PRESET_GAME_TYPES) is selected, mirroring exactly the settings each
 * format's real create*GameAction reads (src/actions/side-games.ts) so
 * applying a preset later never has to guess at a default. A preset
 * never collects *who's playing* -- see the doc comment on
 * PRESET_GAME_TYPES -- so there's no player picker here, unlike the
 * in-round game-creation forms this otherwise mirrors.
 */
export function AddGamePresetForm({
  groupId,
  monetaryEnabled,
  initialValues,
  onSaved,
}: {
  groupId: string;
  monetaryEnabled: boolean;
  initialValues?: GamePresetInitialValues;
  onSaved?: () => void;
}) {
  const isEdit = Boolean(initialValues);
  const action = isEdit
    ? updateGroupGamePresetAction.bind(null, groupId, initialValues!.id)
    : createGroupGamePresetAction.bind(null, groupId);
  const [state, formAction] = useActionState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const [sideGameType, setSideGameType] = useState<PresetGameType>(initialValues?.sideGameType ?? "skins");
  const [isMonetary, setIsMonetary] = useState(initialValues?.isMonetary ?? false);

  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
      onSaved?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="space-y-5" noValidate>
      {state.status === "error" && state.message && <Alert variant="error">{state.message}</Alert>}

      <FormField id="name" label="Preset name" errors={state.fieldErrors?.name}>
        <Input name="name" type="text" placeholder="e.g. Saturday Skins" required defaultValue={initialValues?.name} />
      </FormField>

      <FormField id="sideGameType" label="Game" errors={state.fieldErrors?.sideGameType}>
        <select
          name="sideGameType"
          required
          value={sideGameType}
          onChange={(e) => setSideGameType(e.target.value as PresetGameType)}
          className="h-11 w-full rounded-lg border border-charcoal-400/25 bg-white px-3.5 text-base text-charcoal transition-colors focus:border-forest-600"
        >
          {PRESET_GAME_TYPES.map((type) => (
            <option key={type} value={type}>
              {GAME_TYPE_LABELS[type]}
            </option>
          ))}
        </select>
      </FormField>

      {sideGameType !== "stableford" && (
        <FormField id="scoringMetric" label="Scoring" errors={state.fieldErrors?.scoringMetric}>
          <select
            name="scoringMetric"
            defaultValue={initialValues?.scoringMetric ?? "net"}
            className="h-11 w-full rounded-lg border border-charcoal-400/25 bg-white px-3.5 text-base text-charcoal transition-colors focus:border-forest-600"
          >
            <option value="net">Net</option>
            <option value="gross">Gross</option>
          </select>
        </FormField>
      )}

      {sideGameType === "skins" && (
        <label className="flex items-center gap-2 text-base text-charcoal-700">
          <input type="checkbox" name="carryover" defaultChecked={initialValues?.carryover ?? true} />
          Carry over skins when a hole ties
        </label>
      )}

      {monetaryEnabled && (
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-base text-charcoal-700">
            <input
              type="checkbox"
              name="isMonetary"
              checked={isMonetary}
              onChange={(e) => setIsMonetary(e.target.checked)}
            />
            Play for money
          </label>
          {isMonetary && (
            <div className="space-y-3 rounded-lg bg-cream-100 p-3">
              <div className="max-w-[10rem]">
                <FormField id="dollarValue" label="Dollar value" errors={state.fieldErrors?.dollarValue}>
                  <Input
                    name="dollarValue"
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder="5.00"
                    defaultValue={initialValues?.dollarValue ?? undefined}
                  />
                </FormField>
              </div>
              <p className="text-xs text-charcoal-500">{MONETARY_GAME_NOTICE}</p>
            </div>
          )}
        </div>
      )}

      <p className="text-sm text-charcoal-500">
        Applying this preset to a round always asks who&apos;s playing today -- a preset saves the
        format and its settings, never a saved lineup.
      </p>

      <SubmitButton label={isEdit ? "Save Changes" : "Save Preset"} />
    </form>
  );
}
