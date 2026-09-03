"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Pencil } from "lucide-react";
import { updateRoundDetailsAction } from "@/actions/rounds";
import type { ActionState } from "@/actions/auth";
import { Dialog } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

const initialState: ActionState = { status: "idle" };

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending} className="w-full sm:w-auto">
      {pending ? "Saving…" : "Save changes"}
    </Button>
  );
}

/**
 * The small "Edit round details" link the redesign calls for instead of
 * surfacing every setting on the header. Deliberately narrow in scope:
 * name always editable, date/start time only while the round hasn't
 * started (see updateRoundDetailsAction) -- course and hole count
 * aren't editable here since changing them would invalidate the
 * course snapshot every score and game already depends on.
 */
export function EditRoundDetailsForm({
  tripId,
  roundId,
  name,
  roundDate,
  startTime,
  canEditDateTime,
}: {
  tripId: string;
  roundId: string;
  name: string | null;
  roundDate: string;
  startTime: string | null;
  canEditDateTime: boolean;
}) {
  const [open, setOpen] = useState(false);
  const action = updateRoundDetailsAction.bind(null, tripId, roundId);
  const [state, formAction] = useActionState(action, initialState);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-forest-700 underline decoration-forest-700/40 underline-offset-2 hover:text-forest-900"
      >
        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
        Edit round details
      </button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Edit Round Details"
        description={
          canEditDateTime
            ? "Update the round's name, date or start time."
            : "This round has already started, so only its name can be changed."
        }
      >
        <form action={formAction} className="space-y-4" noValidate>
          {state.status === "error" && state.message && <Alert variant="error">{state.message}</Alert>}
          {state.status === "success" && state.message && <Alert variant="success">{state.message}</Alert>}

          <FormField id="name" label="Round name" hint="Optional" errors={state.fieldErrors?.name}>
            <Input name="name" defaultValue={name ?? ""} placeholder="Round 1" />
          </FormField>

          {canEditDateTime ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="roundDate" label="Date" errors={state.fieldErrors?.roundDate}>
                <Input name="roundDate" type="date" defaultValue={roundDate} required />
              </FormField>
              <FormField id="startTime" label="Start time" hint="Optional" errors={state.fieldErrors?.startTime}>
                <Input name="startTime" type="time" defaultValue={startTime ?? ""} />
              </FormField>
            </div>
          ) : (
            <>
              <input type="hidden" name="roundDate" value={roundDate} />
              <input type="hidden" name="startTime" value={startTime ?? ""} />
            </>
          )}

          <SaveButton />
        </form>
      </Dialog>
    </>
  );
}
