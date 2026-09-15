/**
 * Shared FormData builder for addRoundPlayerAction (src/actions/rounds.ts),
 * used by every round-creation flow that adds golfers programmatically
 * (Quick Round's startQuickRoundSetupAction, Group Round's fast-start
 * startFastGroupRoundAction) rather than through a real HTML <form>.
 *
 * Root cause this exists to prevent: FormData.get(key) returns `null`
 * (not `undefined`) for a key that was never set(). addRoundPlayerSchema
 * (src/lib/validation/round.ts) only ever treats a field as "absent" via
 * `.optional()`, which accepts `undefined`, never a bare `null`. Callers
 * that built FormData conditionally -- `if (p.teeSetName) fd.set(...)` --
 * omitted the key entirely for any blank field, so Zod received `null`
 * and validation failed, silently dropping that golfer from the round.
 * This was the exact cause of "Couldn't add any golfers to this round."
 *
 * The fix/contract: always call fd.set(field, value) for every field,
 * coercing a missing/blank value to the empty string `""` -- exactly
 * what a real <select>/<input> already submits when left blank, which is
 * why real-form-based paths (AddRoundPlayerForm, round-player-row.tsx)
 * were never affected by this bug.
 */

export interface RoundPlayerFormDataInput {
  teeSetName?: string | null;
  /**
   * Quick Round's schema keeps this as a string (or undefined); Group
   * Round's schema coerces it to a number (or "" / undefined). Accepting
   * both here lets a single helper serve both callers without either one
   * reimplementing the null/empty-string contract itself.
   */
  playingHandicap?: string | number | null;
}

/**
 * Builds the FormData for a single addRoundPlayerAction(roundId, prevState, formData)
 * call. tripMemberId is required (a golfer can't be added without one --
 * callers must resolve/roll back before calling this). teeSetName and
 * playingHandicap are always set, defaulting to "" when missing, blank,
 * or nullish -- never omitted -- so a blank optional field is never
 * silently dropped.
 */
export function buildAddRoundPlayerFormData(tripMemberId: string, player: RoundPlayerFormDataInput): FormData {
  const fd = new FormData();
  fd.set("tripMemberId", tripMemberId);
  fd.set("teeSetName", player.teeSetName == null ? "" : String(player.teeSetName));
  fd.set(
    "playingHandicap",
    player.playingHandicap == null || player.playingHandicap === "" ? "" : String(player.playingHandicap),
  );
  return fd;
}
