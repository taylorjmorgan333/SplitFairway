"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { updateGroupAction } from "@/actions/groups";
import type { ActionState } from "@/actions/auth";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

const initialState: ActionState = { status: "idle" };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? "Saving…" : "Save changes"}
    </Button>
  );
}

export function EditGroupForm({
  groupId,
  name,
  description,
}: {
  groupId: string;
  name: string;
  description: string | null;
}) {
  const action = updateGroupAction.bind(null, groupId);
  const [state, formAction] = useActionState(action, initialState);
  const router = useRouter();

  useEffect(() => {
    if (state.status === "success") {
      router.push(`/groups/${groupId}`);
      router.refresh();
    }
  }, [state, router, groupId]);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {state.status === "error" && state.message && <Alert variant="error">{state.message}</Alert>}

      <FormField id="name" label="Group name" errors={state.fieldErrors?.name}>
        <Input name="name" type="text" defaultValue={name} required />
      </FormField>

      <FormField id="description" label="Notes" errors={state.fieldErrors?.description} hint="Optional">
        <textarea
          name="description"
          rows={3}
          defaultValue={description ?? ""}
          className="w-full rounded-lg border border-charcoal-400/25 bg-white px-3.5 py-2.5 text-base text-charcoal placeholder:text-charcoal-400 transition-colors focus:border-forest-600"
        />
      </FormField>

      <SubmitButton />
    </form>
  );
}
