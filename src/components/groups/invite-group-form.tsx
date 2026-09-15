"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { createGroupInvitationAction } from "@/actions/group-invitations";
import type { ActionState } from "@/actions/auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormField } from "@/components/ui/form-field";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

type GroupInviteState = ActionState & { token?: string };
const initialState: GroupInviteState = { status: "idle" };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "Creating…" : "Create invitation"}
    </Button>
  );
}

/**
 * Captains can invite a named golfer by email (single-use, same shape
 * as a trip invitation) or leave email blank for a reusable link they
 * copy or share -- "Use the device share sheet when supported" (spec
 * item 6) uses the Web Share API when the browser exposes it, falling
 * back to copy-to-clipboard everywhere else (older/desktop browsers,
 * or when the share sheet itself is dismissed/unsupported).
 */
export function InviteGroupForm({ groupId, groupName }: { groupId: string; groupName: string }) {
  const boundAction = createGroupInvitationAction.bind(null, groupId);
  const [state, formAction] = useActionState(boundAction, initialState);
  const [copied, setCopied] = useState(false);

  const link = state.token && typeof window !== "undefined" ? `${window.location.origin}/invite/group/${state.token}` : null;

  async function handleShare() {
    if (!link) return;
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({ title: `Join ${groupName} on SplitFairway`, url: link });
        return;
      } catch {
        // User cancelled the share sheet, or the browser refused --
        // fall through to copy so there's still a way to grab the link.
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
    <form action={formAction} className="space-y-4" noValidate>
      {state.status === "error" && state.message && <Alert variant="error">{state.message}</Alert>}

      {link && (
        <div className="space-y-2 rounded-lg bg-cream-100 p-3">
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
        id="email"
        label="Email (optional)"
        errors={state.fieldErrors?.email}
        hint="Leave blank to create a reusable link you can share with anyone."
      >
        <Input name="email" type="email" placeholder="them@example.com" />
      </FormField>

      <div>
        <Label htmlFor="role">Invite as</Label>
        <select
          id="role"
          name="role"
          defaultValue="member"
          className="h-11 w-full rounded-lg border border-charcoal-400/25 bg-white px-3.5 text-sm text-charcoal transition-colors focus:border-forest-600"
        >
          <option value="member">Member — full group access</option>
          <option value="guest">Guest — just today&apos;s round</option>
        </select>
        <p className="mt-1.5 text-xs text-charcoal-400">
          A guest lands straight on the group&apos;s current round to enter their scores, instead of
          the full group dashboard.
        </p>
      </div>

      <SubmitButton />
    </form>
  );
}
