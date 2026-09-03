"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  extractGhinScreenshotAction,
  confirmGhinImportAction,
  initialGhinExtractState,
} from "@/actions/golf-ghin-import";
import type { ActionState } from "@/actions/auth";
import type { Tables } from "@/lib/supabase/database.types";
import type { ExtractedField } from "@/lib/ocr/ghin-extract";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormField } from "@/components/ui/form-field";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

const confirmInitialState: ActionState = { status: "idle" };

function lowConfidenceHint(f: ExtractedField | undefined): string | undefined {
  if (!f) return undefined;
  if (f.value === null) return "We couldn't read this — please enter it yourself.";
  if (f.lowConfidence) return "Low-confidence read — please double-check this against your screenshot.";
  return undefined;
}

function ExtractButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Reading screenshot…" : "Read screenshot"}
    </Button>
  );
}

function ConfirmButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : "Confirm and save"}
    </Button>
  );
}

/**
 * "Import from a GHIN screenshot" — two deliberate steps, per the
 * requirement that nothing extracted is ever saved without the golfer
 * reviewing and confirming it:
 *   1. Pick a photo/screenshot -> extractGhinScreenshotAction runs OCR
 *      only, on bytes that are never written to storage or the
 *      database at this stage.
 *   2. Review the extracted fields (editable, low-confidence ones
 *      flagged) -> confirmGhinImportAction is the only place anything
 *      is actually saved, and the screenshot itself is only uploaded to
 *      private storage if "keep my screenshot" is checked.
 */
export function GhinImportForm({ profile }: { profile: Tables<"golf_profiles"> | null }) {
  const [extractState, extractAction] = useActionState(
    extractGhinScreenshotAction,
    initialGhinExtractState,
  );
  const [confirmState, confirmAction] = useActionState(confirmGhinImportAction, confirmInitialState);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [retain, setRetain] = useState(false);
  const confirmFileInputRef = useRef<HTMLInputElement>(null);

  // Carries the originally selected file over to the confirm step's
  // form (only actually submitted if "keep my screenshot" is checked)
  // — browsers won't let a File be assigned to an <input type="file">
  // directly, so a DataTransfer is used to seed it.
  useEffect(() => {
    if (extractState.status === "extracted" && selectedFile && confirmFileInputRef.current) {
      const dt = new DataTransfer();
      dt.items.add(selectedFile);
      confirmFileInputRef.current.files = dt.files;
    }
  }, [extractState.status, selectedFile]);

  if (confirmState.status === "success") {
    return <Alert variant="success">{confirmState.message}</Alert>;
  }

  if (extractState.status !== "extracted") {
    return (
      <div className="rounded-lg border border-dashed border-charcoal-400/25 p-4">
        <p className="text-sm text-charcoal-700">Import from a GHIN screenshot</p>
        <p className="mt-1 text-xs text-charcoal-400">
          Photograph or upload your own GHIN profile screen. SplitFairway reads the visible text
          with on-device/server OCR — it never connects to GHIN directly — and you&apos;ll review
          and confirm every value before anything is saved.
        </p>

        {extractState.status === "error" && (
          <Alert variant="error" className="mt-3">
            {extractState.message}
          </Alert>
        )}

        <form action={extractAction} className="mt-3 space-y-3">
          <Input
            type="file"
            name="screenshot"
            accept="image/jpeg,image/png,image/webp,image/heic"
            capture="environment"
            required
            onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
          />
          <ExtractButton />
        </form>
      </div>
    );
  }

  const { golferName, ghinNumber, handicapIndex, revisionDateIso } = extractState;

  return (
    <div className="rounded-lg border border-charcoal-400/25 p-4">
      <p className="text-sm font-medium text-forest-900">Review before saving</p>
      <p className="mt-1 text-xs text-charcoal-400">
        Nothing has been saved yet. Check every value against your screenshot, fix anything that
        looks wrong, then confirm.
      </p>

      {golferName.value && (
        <p className="mt-3 text-xs text-charcoal-500">
          Name on this screenshot: <span className="font-medium text-charcoal-700">{golferName.value}</span>{" "}
          — make sure this is your own GHIN profile before continuing.
        </p>
      )}

      {confirmState.status === "error" && confirmState.message && (
        <Alert variant="error" className="mt-3">
          {confirmState.message}
        </Alert>
      )}

      <form action={confirmAction} className="mt-4 space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            id="ghinNumber"
            label="GHIN number"
            hint={lowConfidenceHint(ghinNumber)}
            errors={confirmState.status === "error" ? confirmState.fieldErrors?.ghinNumber : undefined}
          >
            <Input
              name="ghinNumber"
              defaultValue={ghinNumber.value ?? ""}
              inputMode="numeric"
              autoComplete="off"
              className={cn(ghinNumber.lowConfidence && "border-amber-400 focus:border-amber-500")}
            />
          </FormField>

          <FormField
            id="handicapIndex"
            label="Handicap index"
            hint={lowConfidenceHint(handicapIndex)}
            errors={confirmState.status === "error" ? confirmState.fieldErrors?.handicapIndex : undefined}
          >
            <Input
              name="handicapIndex"
              defaultValue={handicapIndex.value ?? ""}
              inputMode="decimal"
              autoComplete="off"
              className={cn(handicapIndex.lowConfidence && "border-amber-400 focus:border-amber-500")}
            />
          </FormField>

          <FormField
            id="handicapRevisionDate"
            label="Handicap revision date"
            hint={
              revisionDateIso
                ? undefined
                : "We couldn't read a date — please enter it yourself if known."
            }
            errors={
              confirmState.status === "error" ? confirmState.fieldErrors?.handicapRevisionDate : undefined
            }
          >
            <Input
              name="handicapRevisionDate"
              type="date"
              defaultValue={revisionDateIso ?? ""}
              className={cn(!revisionDateIso && "border-amber-400 focus:border-amber-500")}
            />
          </FormField>

          <FormField id="homeClub" label="Home club" hint="Optional" errors={undefined}>
            <Input name="homeClub" defaultValue={profile?.home_club ?? ""} />
          </FormField>

          <FormField id="golfAssociation" label="Golf association" hint="Optional" errors={undefined}>
            <Input name="golfAssociation" defaultValue={profile?.golf_association ?? ""} />
          </FormField>

          <FormField id="preferredTee" label="Preferred tees" hint="Optional" errors={undefined}>
            <Input name="preferredTee" defaultValue={profile?.preferred_tee ?? ""} />
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

        <label className="flex items-start gap-2 text-sm text-charcoal-700">
          <input
            type="checkbox"
            name="retainScreenshot"
            checked={retain}
            onChange={(e) => setRetain(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            Keep my screenshot on file (private, visible only to me). Otherwise it&apos;s discarded
            as soon as you confirm.
          </span>
        </label>

        {/* Hidden — populated from the originally selected file via the
            effect above, and only actually read server-side when the
            checkbox above is checked. */}
        <input ref={confirmFileInputRef} type="file" name="screenshot" className="hidden" />

        <ConfirmButton />
      </form>
    </div>
  );
}
