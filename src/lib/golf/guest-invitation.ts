/**
 * Pure mirror of get_guest_invitation_preview()'s status resolution
 * (supabase/migrations/20260916190000_guest_invitation_rpcs.sql) --
 * the actual authorization decision always happens in that
 * SECURITY DEFINER function (a client can never be trusted to decide
 * its own access), but the exact same "revoked wins, then expiry,
 * then pending" rule is also what the captain's guest-links list
 * (GuestInvitationsList) needs to render an "Expired" badge for a
 * still-'pending' row whose expires_at has simply passed -- the raw
 * stored status alone can't tell that apart from a link nobody has
 * opened yet. Keeping this in one tested function is what keeps that
 * UI-only judgment call in sync with the RPC's real rule instead of
 * silently drifting from it.
 */

export type StoredGuestInvitationStatus = "pending" | "redeemed" | "revoked";
export type ResolvedGuestInvitationStatus = "revoked" | "expired" | "redeemed" | "pending";

export function resolveGuestInvitationStatus(input: {
  status: StoredGuestInvitationStatus;
  expiresAt: string | Date;
  now?: Date;
}): ResolvedGuestInvitationStatus {
  if (input.status === "revoked") {
    return "revoked";
  }

  const now = input.now ?? new Date();
  const expiresAt = typeof input.expiresAt === "string" ? new Date(input.expiresAt) : input.expiresAt;
  if (expiresAt.getTime() <= now.getTime()) {
    return "expired";
  }

  return input.status;
}
