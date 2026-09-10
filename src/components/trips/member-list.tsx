"use client";

import { useActionState, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { Pencil } from "lucide-react";
import {
  setMemberRoleAction,
  removeMemberAction,
  resendInvitationAction,
  revokeInvitationAction,
  transferOwnershipAction,
  updateMemberPaymentInfoAction,
} from "@/actions/members";
import type { ActionState } from "@/actions/auth";
import { PAYMENT_METHOD_VALUES, PAYMENT_METHOD_LABELS } from "@/lib/validation/payment";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Dialog } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import type { Tables } from "@/lib/supabase/database.types";

export type MemberRow = Pick<
  Tables<"trip_members">,
  | "id"
  | "display_name"
  | "email"
  | "role"
  | "status"
  | "user_id"
  | "preferred_payment_method"
  | "payment_handle"
>;

const STATUS_FILTERS = ["all", "active", "invited", "declined", "removed"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

const STATUS_FILTER_LABELS: Record<StatusFilter, string> = {
  all: "All",
  active: "Active",
  invited: "Invited",
  declined: "Declined",
  removed: "Removed",
};

export function MemberList({
  tripId,
  members,
  isCaptain,
  currentUserMemberId,
  ownerUserId,
  isOwner,
}: {
  tripId: string;
  members: MemberRow[];
  isCaptain: boolean;
  currentUserMemberId: string | null;
  /** trips.owner_id — an auth user id, not a trip_member id. */
  ownerUserId: string | null;
  /** Whether the currently signed-in user IS that owner. */
  isOwner: boolean;
}) {
  const [filter, setFilter] = useState<StatusFilter>("all");
  const activeCaptainCount = members.filter(
    (m) => m.role === "captain" && m.status === "active",
  ).length;

  const visibleMembers = filter === "all" ? members : members.filter((m) => m.status === filter);
  const transferTargets = members.filter(
    (m) => m.status === "active" && m.user_id !== null && m.user_id !== ownerUserId,
  );

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {STATUS_FILTERS.map((f) => {
          const count = f === "all" ? members.length : members.filter((m) => m.status === f).length;
          if (f !== "all" && count === 0) return null;
          return (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={
                filter === f
                  ? "rounded-full bg-forest-800 px-3 py-1 text-xs font-medium text-cream-50"
                  : "rounded-full border border-forest-900/15 px-3 py-1 text-xs text-charcoal-500 hover:bg-forest-50"
              }
            >
              {STATUS_FILTER_LABELS[f]} ({count})
            </button>
          );
        })}
      </div>

      <ul className="divide-y divide-forest-900/[0.06]">
        {visibleMembers.map((member) => (
          <MemberRowItem
            key={member.id}
            tripId={tripId}
            member={member}
            isCaptain={isCaptain}
            isSelf={member.id === currentUserMemberId}
            isLastActiveCaptain={
              member.role === "captain" && member.status === "active" && activeCaptainCount <= 1
            }
            isOwner={member.user_id === ownerUserId && member.user_id !== null}
          />
        ))}
        {visibleMembers.length === 0 && (
          <p className="py-4 text-sm text-charcoal-500">No golfers in this category.</p>
        )}
      </ul>

      {isOwner && transferTargets.length > 0 && (
        <div className="mt-6 border-t border-forest-900/[0.06] pt-6">
          <h4 className="mb-1 font-serif text-base text-forest-900">Transfer trip ownership</h4>
          <p className="mb-3 text-xs text-charcoal-400">
            Ownership is a single, transferable administrative designation — it doesn&apos;t take
            away anything from other captains, and the new owner is automatically made a
            co-treasurer if they aren&apos;t already one.
          </p>
          <TransferOwnershipForm tripId={tripId} targets={transferTargets} />
        </div>
      )}
    </div>
  );
}

function MemberRowItem({
  tripId,
  member,
  isCaptain,
  isSelf,
  isLastActiveCaptain,
  isOwner,
}: {
  tripId: string;
  member: MemberRow;
  isCaptain: boolean;
  isSelf: boolean;
  isLastActiveCaptain: boolean;
  isOwner: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const canEditPaymentInfo = (isCaptain || isSelf) && member.status !== "removed";
  const paymentLabel = member.preferred_payment_method
    ? PAYMENT_METHOD_LABELS[member.preferred_payment_method]
    : null;
  const paymentSummary = [paymentLabel, member.payment_handle].filter(Boolean).join(" · ");

  function handleRoleChange(role: "captain" | "member") {
    setError(null);
    startTransition(async () => {
      try {
        await setMemberRoleAction(tripId, member.id, role);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not update role.");
      }
    });
  }

  function handleRemove() {
    if (!window.confirm(`Remove ${member.display_name} from this trip?`)) {
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await removeMemberAction(tripId, member.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not remove golfer.");
      }
    });
  }

  function handleResend() {
    setError(null);
    startTransition(async () => {
      try {
        const { inviteLink: link } = await resendInvitationAction(tripId, member.id);
        setInviteLink(link);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not resend the invitation.");
      }
    });
  }

  function handleRevoke() {
    if (!window.confirm(`Revoke the invitation to ${member.display_name}?`)) {
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await revokeInvitationAction(tripId, member.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not revoke the invitation.");
      }
    });
  }

  async function handleCopy() {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Soft failure — the link stays visible as selectable text.
    }
  }

  return (
    <li className="flex flex-col gap-3 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-medium text-charcoal">
              {member.display_name}
              {isSelf && <span className="text-charcoal-400"> (you)</span>}
            </p>
            {canEditPaymentInfo && (
              <MemberPaymentInfoForm tripId={tripId} member={member} isSelf={isSelf} />
            )}
          </div>
          <p className="text-xs text-charcoal-400">
            {member.email ?? <span className="italic">No email on file</span>}
          </p>
          {paymentSummary && <p className="text-xs text-charcoal-400">{paymentSummary}</p>}
          {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={member.role === "captain" ? "gold" : "neutral"}>
            {member.role === "captain" ? "Captain" : "Member"}
          </Badge>
          {isOwner && <Badge variant="forest">Owner</Badge>}
          {member.status !== "active" && (
            <Badge variant="neutral" className="capitalize">
              {member.status}
            </Badge>
          )}

          {isCaptain && member.status === "active" && (
            <>
              {member.role === "member" ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isPending}
                  onClick={() => handleRoleChange("captain")}
                >
                  Make co-treasurer
                </Button>
              ) : (
                !isLastActiveCaptain && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isPending}
                    onClick={() => handleRoleChange("member")}
                  >
                    Remove co-treasurer
                  </Button>
                )
              )}
              {!(member.role === "captain" && isLastActiveCaptain) && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={isPending}
                  onClick={handleRemove}
                  className="text-red-700 hover:bg-red-50"
                >
                  Remove
                </Button>
              )}
            </>
          )}

          {isCaptain && member.status === "invited" && (
            <>
              <Button variant="outline" size="sm" disabled={isPending} onClick={handleResend}>
                Resend
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={isPending}
                onClick={handleRevoke}
                className="text-red-700 hover:bg-red-50"
              >
                Revoke
              </Button>
            </>
          )}
        </div>
      </div>

      {inviteLink && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-cream-100 p-3">
          <code className="flex-1 break-all text-xs text-charcoal-600">{inviteLink}</code>
          <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
            {copied ? "Copied!" : "Copy link"}
          </Button>
        </div>
      )}
    </li>
  );
}

function TransferSubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outline" size="sm" disabled={pending || disabled}>
      {pending ? "Transferring…" : "Transfer ownership"}
    </Button>
  );
}

const initialTransferState: ActionState = { status: "idle" };

function TransferOwnershipForm({
  tripId,
  targets,
}: {
  tripId: string;
  targets: MemberRow[];
}) {
  const boundAction = transferOwnershipAction.bind(null, tripId);
  const [state, formAction] = useActionState(boundAction, initialTransferState);
  const [confirmation, setConfirmation] = useState("");

  return (
    <form action={formAction} className="space-y-3">
      {state.status === "error" && state.message && (
        <Alert variant="error">{state.message}</Alert>
      )}
      {state.status === "success" && state.message && (
        <Alert variant="success">{state.message}</Alert>
      )}

      <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <select
          name="newOwnerTripMemberId"
          defaultValue=""
          required
          className="h-11 w-full rounded-lg border border-charcoal-400/25 bg-white px-3.5 text-sm text-charcoal transition-colors focus:border-forest-600"
        >
          <option value="" disabled>
            Choose the new owner
          </option>
          {targets.map((t) => (
            <option key={t.id} value={t.id}>
              {t.display_name}
            </option>
          ))}
        </select>
        <Input
          name="confirmation"
          type="text"
          placeholder="Type TRANSFER to confirm"
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          className="sm:w-52"
        />
        <TransferSubmitButton disabled={confirmation !== "TRANSFER"} />
      </div>
      {state.fieldErrors?.confirmation && (
        <p className="text-xs text-red-600">{state.fieldErrors.confirmation[0]}</p>
      )}
      {state.fieldErrors?.newOwnerTripMemberId && (
        <p className="text-xs text-red-600">{state.fieldErrors.newOwnerTripMemberId[0]}</p>
      )}
    </form>
  );
}

const initialPaymentInfoState: ActionState = { status: "idle" };

/**
 * The "how do I pay this golfer" info shown on their Golfers-tab row --
 * a preferred app plus their username/handle on it. Separate from
 * PaymentForm/reportPaymentSchema (which record an actual payment that
 * happened): this is just a standing preference so trip mates know
 * where to send money before they ever open that form. Either the
 * captain (who may have added this golfer manually, before they ever
 * signed in) or the golfer themselves can edit it -- enforced by
 * set_trip_member_payment_info() server-side, not just by hiding this
 * button.
 */
function MemberPaymentInfoForm({
  tripId,
  member,
  isSelf,
}: {
  tripId: string;
  member: MemberRow;
  isSelf: boolean;
}) {
  const [open, setOpen] = useState(false);
  const boundAction = updateMemberPaymentInfoAction.bind(null, tripId, member.id);
  const [state, formAction] = useActionState(boundAction, initialPaymentInfoState);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Edit payment info for ${member.display_name}`}
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-charcoal-400 hover:bg-cream-100 hover:text-forest-700"
      >
        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
      </button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Payment Info"
        description={
          isSelf
            ? "Let your trip mates know where to send you money."
            : `Set how ${member.display_name} prefers to get paid.`
        }
      >
        <form action={formAction} className="space-y-4" noValidate>
          {state.status === "error" && state.message && (
            <Alert variant="error">{state.message}</Alert>
          )}
          {state.status === "success" && state.message && (
            <Alert variant="success">{state.message}</Alert>
          )}

          <FormField
            id={`preferredPaymentMethod-${member.id}`}
            label="Payment app"
            errors={state.fieldErrors?.preferredPaymentMethod}
          >
            <select
              name="preferredPaymentMethod"
              defaultValue={member.preferred_payment_method ?? ""}
              className="h-11 w-full rounded-lg border border-charcoal-400/25 bg-white px-3.5 text-sm text-charcoal transition-colors focus:border-forest-600"
            >
              <option value="">No preference set</option>
              {PAYMENT_METHOD_VALUES.map((value) => (
                <option key={value} value={value}>
                  {PAYMENT_METHOD_LABELS[value]}
                </option>
              ))}
            </select>
          </FormField>

          <FormField
            id={`paymentHandle-${member.id}`}
            label="Username / handle"
            hint="Optional — e.g. @taylor-morgan"
            errors={state.fieldErrors?.paymentHandle}
          >
            <Input
              name="paymentHandle"
              defaultValue={member.payment_handle ?? ""}
              placeholder="@taylor-morgan"
              maxLength={120}
            />
          </FormField>

          <PaymentInfoSaveButton />
        </form>
      </Dialog>
    </>
  );
}

function PaymentInfoSaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending} className="w-full sm:w-auto">
      {pending ? "Saving…" : "Save"}
    </Button>
  );
}

