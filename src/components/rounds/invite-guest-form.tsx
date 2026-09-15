"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { createGuestInvitationAction } from "@/actions/guest-invitations";
import type { ActionState } from "@/actions/auth";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

type GuestInviteState = ActionState & { token?: string };
const initialState: GuestInviteState = { status: "idle" };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "Creating…" : "Create guest link"}
    </Button>
  );
}

/**
 * Captain-only "invite a guest to score this round" (spec item 1) --
 * no email, no password, no account for the guest. The resulting link
 * signs them in anonymously and drops them straight onto this round's
 * scorecard. Share/copy UX mirrors InviteGroupForm exactly.
 */
export function InviteGuestForm({
  tripId,
  roundId,
  groupId,
}: {
  tripId: string;
  roundId: string;
  groupId: string | null;
}) {
  const boundAction = createGuestInvitationAction.bind(null, tripId, roundId, groupId);
  const [state, formAction] = useActionState(boundAction, initialState);
  const [copied, setCopied] = useState(false);

  const link = state.token && typeof window !== "undefined" ? `${window.location.origin}/invite/guest/${state.token}` : null;

  async function handleShare() {
    if (!link) return;
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({ title: "Score this round on SplitFairway", url: link });
        return;
      } catch {
        // Cancelled or unsupported -- fall through to copy.
      }
    }
    handleCopy();
  }

  async function handleCopy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Soft failure -- the link is still shown as selectable text below.
    }
  }

  return (
    <form action={formAction} className="space-y-3">
      {state.status === "error" && state.message && <Alert variant="error">{state.message}</Alert>}

      {link && (
        <div className="space-y-2 rounded-lg bg-cream-100 p-3">
          <p className="text-xs font-medium text-charcoal-600">{state.message}</p>
          <code className="block break-all text-xs text-charcoal-600">{link}</code>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={handleShare}>
              Share
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={handleCopy}>
              {copied ? "Copied!" : "Copy link"}
            </Button>
          </div>
        </div>
      )}

      <FormField
        id="guestDisplayName"
        label="Guest's name"
        errors={state.fieldErrors?.guestDisplayName}
        hint="No account or password needed -- they'll go straight to this round's scorecard."
      >
        <Input name="guestDisplayName" placeholder="Guest" maxLength={60} />
      </FormField>

      <SubmitButton />
    </form>
  );
}
