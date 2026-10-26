/**
 * /join/[code] sits on top of the invite links the app already creates.
 *
 * Trip, group, and guest invitations are 32-byte hex tokens (64
 * characters). Only a sha256 hash is stored. There is no short code,
 * group slug, or public join-code column, and a short code cannot be
 * resolved by hashing it and hoping — the raw token is not recoverable.
 *
 * A 64-character hex code is forwarded to the existing anon preview
 * RPCs, then the visitor is sent to the invite page that already knows
 * how to accept it. Anything else is shown as an invalid link.
 *
 * Supporting memorable codes needs a new table (code → invitation id,
 * or its own hash), an anon-granted preview RPC, and a place in the
 * captain UI that mints the code. That schema change is intentionally
 * not in this repo change.
 */

export type InviteKind = "trip" | "group" | "guest";

export type InvitePreview = { status?: string | null };

export function isStoredInviteToken(code: string): boolean {
  return /^[0-9a-fA-F]{64}$/.test(code);
}

export function invitePath(kind: InviteKind, code: string): string {
  if (kind === "trip") return `/invite/${code}`;
  if (kind === "group") return `/invite/group/${code}`;
  return `/invite/guest/${code}`;
}

/** First preview that is a real invitation. Order matches how captains describe a link: trip, then group, then guest. */
export function firstMatchingInvite(
  previews: Record<InviteKind, InvitePreview | null | undefined>,
): InviteKind | null {
  const order: InviteKind[] = ["trip", "group", "guest"];
  for (const kind of order) {
    const status = previews[kind]?.status;
    if (typeof status === "string" && status.length > 0 && status !== "not_found") {
      return kind;
    }
  }
  return null;
}
