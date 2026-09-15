"use client";

import { useActionState, useRef, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { createGroupGamePresetAction } from "@/actions/groups";
import type { ActionState } from "@/actions/auth";
import { GROUP_PRESET_GAME_TYPES } from "@/lib/validation/group";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

const initialState: ActionState = { status: "idle" };

const GAME_TYPE_LABELS: Record<(typeof GROUP_PRESET_GAME_TYPES)[number], string> = {
  nassau: "Nassau",
  skins: "Skins",
  wolf: "Wolf",
  vegas: "Vegas",
  quota: "Quota",
  nines: "Nines",
  twos: "Twos",
  match_play: "Match Play",
  stroke_play: "Stroke Play",
  stableford: "Stableford",
  best_ball: "Best Ball",
  worst_ball: "Worst Ball",
  shamble: "Shamble",
  team_average: "Team Average",
  low_ball_high_ball: "Low Ball / High Ball",
  low_ball_low_total: "Low Ball / Low Total",
  low_handicap_high_handicap: "Low Handicap / High Handicap",
  one_gross_one_net: "One Gross, One Net",
  lone_ranger: "Lone Ranger",
  cha_cha_cha: "Cha Cha Cha",
  custom: "Custom",
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={pending}>
      {pending ? "Saving…" : "Save Preset"}
    </Button>
  );
}

export function AddGamePresetForm({ groupId }: { groupId: string }) {
  const action = createGroupGamePresetAction.bind(null, groupId);
  const [state, formAction] = useActionState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="space-y-5" noValidate>
      {state.status === "error" && state.message && <Alert variant="error">{state.message}</Alert>}

      <FormField id="name" label="Preset name" errors={state.fieldErrors?.name}>
        <Input name="name" type="text" placeholder="e.g. $2 Nassau" required />
      </FormField>

      <FormField id="sideGameType" label="Game" errors={state.fieldErrors?.sideGameType}>
        <select
          name="sideGameType"
          required
          className="h-11 w-full rounded-lg border border-charcoal-400/25 bg-white px-3.5 text-base text-charcoal transition-colors focus:border-forest-600"
        >
          {GROUP_PRESET_GAME_TYPES.map((type) => (
            <option key={type} value={type}>
              {GAME_TYPE_LABELS[type]}
            </option>
          ))}
        </select>
      </FormField>

      <FormField
        id="notes"
        label="Details"
        errors={state.fieldErrors?.notes}
        hint="Optional — e.g. stakes or house rules, so you set it up the same way every time."
      >
        <textarea
          name="notes"
          rows={2}
          className="w-full rounded-lg border border-charcoal-400/25 bg-white px-3.5 py-2.5 text-base text-charcoal placeholder:text-charcoal-400 transition-colors focus:border-forest-600"
          placeholder="e.g. $2 a hole, presses automatic on 2-down"
        />
      </FormField>

      <SubmitButton />
    </form>
  );
}
