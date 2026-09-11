import type { WhoCanRecord } from "@/lib/validation/nineteenth-hole";

export type NineteenthHoleMember = { id: string; displayName: string };

export type NineteenthHoleRound = { id: string; label: string };

export type NineteenthHoleCounter = {
  id: string;
  key: string;
  label: string;
  isDefault: boolean;
  isActive: boolean;
  sortOrder: number;
};

/** One row per +1/-1 tap. `deletedAt` set means undone/corrected -- kept
 * in the list (for the "own vs. captain" permission check and, for
 * captains, visibility into what got corrected) but excluded from every
 * count and hidden from the default Activity view. */
export type NineteenthHoleActivityEntry = {
  id: string;
  tripMemberId: string;
  counterId: string;
  roundId: string | null;
  quantity: 1 | -1;
  recordedBy: string | null;
  createdAt: string;
  deletedAt: string | null;
};

export type NineteenthHoleSettings = {
  enabled: boolean;
  whoCanRecord: WhoCanRecord;
};
