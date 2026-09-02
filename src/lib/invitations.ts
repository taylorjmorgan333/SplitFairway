/**
 * Shape of get_invitation_preview()'s JSON response — see the RPC in
 * supabase/migrations/20260902050000_invitations_ownership_reminders.sql
 * for the authoritative definition. Deliberately graduated: only a
 * still-actionable ("pending") invitation reveals trip/cost/captain
 * details; every other status reveals as little as possible.
 */
export type InvitationPreview =
  | { status: "not_found" }
  | { status: "revoked"; trip_name: string }
  | { status: "declined"; trip_name: string }
  | { status: "accepted"; trip_name: string; trip_id: string }
  | { status: "expired"; trip_name: string }
  | {
      status: "pending";
      trip_id: string;
      trip_name: string;
      destination: string | null;
      start_date: string | null;
      end_date: string | null;
      captain_name: string;
      invitee_name: string;
      invitee_email: string;
      estimated_cost_cents: number;
    };
