"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { inviteMemberAction, type InviteActionState } from "@/actions/members";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormField } from "@/components/ui/form-field";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

const initialState: InviteActionState = { status: "idle" };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "Sending…" : "Send invite"}
    </Button>
  );
}

export function InviteMemberForm({ tripId }: { tripId: string }) {
  const boundAction = inviteMemberAction.bind(null, tripId);
  const [state, formAction] = useActionState(boundAction, initialState);
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (!state.inviteLink) return;
    try {
      await navigator.clipboard.writeText(state.inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can fail (e.g. insecure context) — the link
      // is still shown as selectable text below, so this is a soft
      // failure, not something worth surfacing as an error.
    }
  }

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.status === "error" && state.message && (
        <Alert variant="error">{state.message}</Alert>
      )}
      {state.status === "success" && state.message && (
        <Alert variant="success">{state.message}</Alert>
      )}
      {state.inviteLink && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-cream-100 p-3">
          <code className="flex-1 break-all text-xs text-charcoal-600">{state.inviteLink}</code>
          <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
            {copied ? "Copied!" : "Copy link"}
          </Button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="displayName" label="Name" errors={state.fieldErrors?.displayName}>
          <Input name="displayName" type="text" placeholder="Golfer's name" required />
        </FormField>
        <FormField id="email" label="Email" errors={state.fieldErrors?.email}>
          <Input name="email" type="email" placeholder="them@example.com" required />
        </FormField>
      </div>

      <div>
        <Label htmlFor="role">Role</Label>
        <select
          id="role"
          name="role"
          defaultValue="member"
          className="h-11 w-full rounded-lg border border-charcoal-400/25 bg-white px-3.5 text-sm text-charcoal transition-colors focus:border-forest-600"
        >
          <option value="member">Member</option>
          <option value="captain">Co-treasurer (full captain access)</option>
        </select>
        <p className="mt-1.5 text-xs text-charcoal-400">
          Co-treasurers can edit trip details, invite golfers, and confirm
          payments alongside you.
        </p>
      </div>

      <SubmitButton />
    </form>
  );
}
