"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createTeeSetAction } from "@/actions/courses";
import type { ActionState } from "@/actions/auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

const initialState: ActionState = { status: "idle" };

function AddButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outline" size="sm" disabled={pending}>
      {pending ? "Adding…" : "Add tee set"}
    </Button>
  );
}

export function AddTeeSetForm({ courseId }: { courseId: string }) {
  const action = createTeeSetAction.bind(null, courseId);
  const [state, formAction] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="flex-1 min-w-[10rem]">
        <label htmlFor="teeSetName" className="text-xs font-medium text-charcoal-500">
          Tee name
        </label>
        <Input id="teeSetName" name="name" placeholder="White" className="mt-1" required />
        {state.status === "error" && state.fieldErrors?.name && (
          <p className="mt-1 text-xs text-red-600">{state.fieldErrors.name[0]}</p>
        )}
      </div>
      <AddButton />
      {state.status === "error" && state.message && (
        <Alert variant="error" className="w-full">
          {state.message}
        </Alert>
      )}
    </form>
  );
}
