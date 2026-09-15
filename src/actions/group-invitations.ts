"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createGroupInvitationSchema } from "@/lib/validation/group";
import type { ActionState } from "@/actions/auth";

/**
 * Creates a group invitation (spec item 6). email set = a named,
 * single-use invite (mirrors invitations.ts's trip-invitation flow
 * exactly, including the email-match check inside
 * accept_group_invitation); email left blank = a reusable link -- stays
 * 'pending' indefinitely so it can be shared once and used by several
 * different people, matching "copy a group invitation link" / device
 * share sheet. Owner-only, per create_group_invitation()'s own
 * is_group_owner check.
 */
export async function createGroupInvitationAction(
  groupId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState & { token?: string }> {
  const parsed = createGroupInvitationSchema.safeParse({
    email: formData.get("email"),
    role: formData.get("role") || "member",
  });

  if (!parsed.success) {
    return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_group_invitation", {
    p_group_id: groupId,
    p_email: parsed.data.email || undefined,
    p_role: parsed.data.role,
  });

  if (error || !data) {
    return { status: "error", message: error?.message ?? "Couldn't create that invitation." };
  }

  const result = data as unknown as { invitation_id: string; token: string; email: string | null };

  revalidatePath(`/groups/${groupId}`);
  return { status: "success", message: "Invitation created.", token: result.token };
}

export async function revokeGroupInvitationAction(groupId: string, invitationId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_group_invitation", { p_invitation_id: invitationId });
  if (error) {
    throw new Error(error.message);
  }
  revalidatePath(`/groups/${groupId}`);
}

/**
 * Accepts a group invitation token for the currently signed-in user.
 * accept_group_invitation() does the real work (email-match check for
 * named invites, idempotent re-use of an existing membership row for
 * reusable links). The returned role ("member" or "guest") only decides
 * where this sends the golfer next -- see the doc comment on
 * golf_group_invitation_role: a "guest" still becomes a normal
 * golf_group_members row (role='member' there too), just landed
 * straight on the group's current round instead of the full dashboard.
 */
export async function acceptGroupInvitationAction(
  token: string,
): Promise<{ groupId: string; role: "member" | "guest"; redirectPath: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_group_invitation", { p_token: token });

  if (error) {
    throw new Error(error.message);
  }

  const result = data as unknown as { group_id: string; role: "member" | "guest" };
  revalidatePath("/groups");

  // A guest lands straight on the group's current round to enter
  // scores -- "view the relevant round... without navigating the
  // entire app" -- rather than the full group dashboard a regular
  // member gets. "Current round" is whichever of this group's rounds
  // is in progress, or failing that the most recently scheduled one;
  // with no rounds at all yet, a guest just goes to the group page too.
  let redirectPath = `/groups/${result.group_id}`;
  if (result.role === "guest") {
    const { data: tripRows } = await supabase.from("trips").select("id").eq("golf_group_id", result.group_id);
    const tripIds = (tripRows ?? []).map((t) => t.id);
    if (tripIds.length > 0) {
      const { data: roundRows } = await supabase
        .from("rounds")
        .select("id, trip_id, status, round_date")
        .in("trip_id", tripIds)
        .order("round_date", { ascending: false });
      const rounds = roundRows ?? [];
      const current = rounds.find((r) => r.status === "in_progress") ?? rounds.find((r) => r.status === "scheduled") ?? rounds[0];
      if (current) {
        redirectPath = `/trips/${current.trip_id}/rounds/${current.id}/score`;
      }
    }
  }

  return { groupId: result.group_id, role: result.role, redirectPath };
}
