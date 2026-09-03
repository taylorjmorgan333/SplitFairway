"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { updateGolfProfileAction, removeGhinNumberAction } from "@/actions/golf";
import { deleteGhinScreenshotAction } from "@/actions/golf-ghin-import";
import type { ActionState } from "@/actions/auth";
import type { Tables } from "@/lib/supabase/database.types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormField } from "@/components/ui/form-field";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { HandicapHistoryList } from "@/components/account/handicap-history-list";
import { GhinImportForm } from "@/components/account/ghin-import-form";
import { formatDate } from "@/lib/utils";

const initialState: ActionState = { status: "idle" };

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : "Save golf profile"}
    </Button>
  );
}

function RemoveGhinButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="outline"
      disabled={pending}
      className="border-red-200 text-red-700 hover:bg-red-50"
    >
      {pending ? "Removing…" : "Remove GHIN number"}
    </Button>
  );
}

/**
 * The "Golf Profile" section of Account settings — manual entry only
 * (method 2, GHIN screenshot import, is a separate later phase; the
 * card below advertises it as coming soon rather than pretending it
 * works). Every value here is typed in by the golfer; nothing is
 * fetched from GHIN.com or any GHIN service, and the UI never claims
 * otherwise — see the fixed disclaimer text below and
 * src/lib/validation/golf.ts / src/actions/golf.ts for how it's saved.
 */
function DeleteScreenshotButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="ghost" disabled={pending} className="text-xs text-charcoal-500">
      {pending ? "Removing…" : "Delete saved screenshot"}
    </Button>
  );
}

export function GolfProfileForm({
  profile,
  history,
  ghinImportEnabled,
}: {
  profile: Tables<"golf_profiles"> | null;
  history: Tables<"handicap_history">[];
  ghinImportEnabled: boolean;
}) {
  const [state, formAction] = useActionState(updateGolfProfileAction, initialState);
  const [removeState, removeAction] = useActionState(removeGhinNumberAction, initialState);
  const [deleteScreenshotState, deleteScreenshotAction] = useActionState(
    deleteGhinScreenshotAction,
    initialState,
  );

  const sourceLabel =
    profile?.handicap_index == null
      ? null
      : profile.handicap_source === "ghin_screenshot_import"
        ? "Imported from GHIN by golfer"
        : "Entered manually";

  return (
    <div className="space-y-6">
      {profile?.handicap_index != null && (
        <div className="rounded-lg bg-cream-100 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-serif text-2xl text-forest-900">
              {profile.handicap_index.toFixed(1)}
            </span>
            <span className="text-sm text-charcoal-500">handicap index</span>
            {sourceLabel && <Badge variant="forest">{sourceLabel}</Badge>}
          </div>
          <p className="mt-1 text-xs text-charcoal-400">
            Last updated {formatDate(profile.handicap_updated_at)}
            {profile.handicap_revision_date &&
              ` · revision date ${formatDate(profile.handicap_revision_date)}`}
          </p>
        </div>
      )}

      <Alert variant="info">
        SplitFairway does not independently verify this information with the USGA.
      </Alert>

      {state.status === "error" && state.message && <Alert variant="error">{state.message}</Alert>}
      {state.status === "success" && state.message && (
        <Alert variant="success">{state.message}</Alert>
      )}

      <form action={formAction} className="space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            id="ghinNumber"
            label="GHIN number"
            hint="Optional — digits only, visible only to you"
            errors={state.fieldErrors?.ghinNumber}
          >
            <Input
              name="ghinNumber"
              defaultValue={profile?.ghin_number ?? ""}
              inputMode="numeric"
              autoComplete="off"
              placeholder="1234567"
            />
          </FormField>

          <FormField
            id="handicapIndex"
            label="Current handicap"
            hint="e.g. 12.4 or +2.0"
            errors={state.fieldErrors?.handicapIndex}
          >
            <Input
              name="handicapIndex"
              defaultValue={profile?.handicap_index?.toFixed(1) ?? ""}
              inputMode="decimal"
              autoComplete="off"
              placeholder="12.4"
            />
          </FormField>

          <FormField
            id="handicapRevisionDate"
            label="Handicap revision date"
            hint="Optional"
            errors={state.fieldErrors?.handicapRevisionDate}
          >
            <Input
              name="handicapRevisionDate"
              type="date"
              defaultValue={profile?.handicap_revision_date ?? ""}
            />
          </FormField>

          <FormField id="homeClub" label="Home club" hint="Optional" errors={state.fieldErrors?.homeClub}>
            <Input name="homeClub" defaultValue={profile?.home_club ?? ""} />
          </FormField>

          <FormField
            id="golfAssociation"
            label="Golf association"
            hint="Optional"
            errors={state.fieldErrors?.golfAssociation}
          >
            <Input name="golfAssociation" defaultValue={profile?.golf_association ?? ""} />
          </FormField>

          <FormField
            id="preferredTee"
            label="Preferred tees"
            hint="Optional"
            errors={state.fieldErrors?.preferredTee}
          >
            <Input name="preferredTee" defaultValue={profile?.preferred_tee ?? ""} placeholder="White" />
          </FormField>

          <div>
            <Label htmlFor="dominantHand">Dominant hand</Label>
            <select
              id="dominantHand"
              name="dominantHand"
              defaultValue={profile?.dominant_hand ?? ""}
              className="h-11 w-full rounded-lg border border-charcoal-400/25 bg-white px-3.5 text-sm text-charcoal transition-colors focus:border-forest-600"
            >
              <option value="">Optional — not set</option>
              <option value="right">Right</option>
              <option value="left">Left</option>
            </select>
          </div>
        </div>

        <SaveButton />
      </form>

      {profile?.ghin_number && (
        <form action={removeAction} className="border-t border-charcoal-400/10 pt-4">
          {removeState.status === "error" && removeState.message && (
            <Alert variant="error" className="mb-3">
              {removeState.message}
            </Alert>
          )}
          <p className="mb-2 text-xs text-charcoal-400">
            Removing your GHIN number keeps your handicap on file — you can still track a manual
            handicap with no GHIN number.
          </p>
          <RemoveGhinButton />
        </form>
      )}

      <HandicapHistoryList entries={history} />

      {profile?.ghin_screenshot_retained && (
        <div className="flex items-center justify-between rounded-lg bg-cream-100 px-4 py-2.5">
          <p className="text-xs text-charcoal-500">
            A GHIN screenshot is saved on your account (private, visible only to you).
          </p>
          {deleteScreenshotState.status === "error" && deleteScreenshotState.message && (
            <Alert variant="error">{deleteScreenshotState.message}</Alert>
          )}
          <form action={deleteScreenshotAction}>
            <DeleteScreenshotButton />
          </form>
        </div>
      )}

      {ghinImportEnabled ? (
        <GhinImportForm profile={profile} />
      ) : (
        <div className="rounded-lg border border-dashed border-charcoal-400/25 p-4">
          <p className="text-sm text-charcoal-700">Import from a GHIN screenshot</p>
          <p className="mt-1 text-xs text-charcoal-400">
            Coming soon — photograph or upload your own GHIN profile screen and review every
            extracted value before anything is saved. SplitFairway will never connect to GHIN
            directly.
          </p>
        </div>
      )}
    </div>
  );
}
