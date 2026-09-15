import { describe, expect, it } from "vitest";
import { addRoundPlayerSchema } from "./round";

const VALID_TRIP_MEMBER_ID = "00000000-0000-0000-0000-000000000001";

describe("addRoundPlayerSchema", () => {
  it("accepts a golfer with a tee and a handicap", () => {
    const result = addRoundPlayerSchema.safeParse({
      tripMemberId: VALID_TRIP_MEMBER_ID,
      teeSetName: "Champ",
      playingHandicap: "12.4",
    });
    expect(result.success).toBe(true);
  });

  it("accepts an empty string for a blank optional field (the shape a real <select>/<input> submits)", () => {
    const result = addRoundPlayerSchema.safeParse({
      tripMemberId: VALID_TRIP_MEMBER_ID,
      teeSetName: "",
      playingHandicap: "",
    });
    expect(result.success).toBe(true);
  });

  it("accepts the fields being omitted entirely (undefined)", () => {
    const result = addRoundPlayerSchema.safeParse({ tripMemberId: VALID_TRIP_MEMBER_ID });
    expect(result.success).toBe(true);
  });

  // Regression test for the Quick Round "Couldn't add any golfers to
  // this round" bug: FormData.get() returns `null` (not `undefined`)
  // for a key that was never set(), and this schema's optional fields
  // only ever accepted `undefined` or the literal "" -- never a bare
  // `null`. startQuickRoundSetupAction (actions/quick-round.ts) used to
  // build its FormData with `if (p.teeSetName) fd.set(...)`, which
  // skips fd.set() entirely for a blank field instead of setting it to
  // "" -- so every golfer with no tee or no handicap (the single most
  // common case: a first-time golfer with no saved preferences) failed
  // this validation and was silently dropped, and since it happened for
  // every player, the round always reported "Couldn't add any golfers."
  // This test documents the actual contract so a future caller of
  // addRoundPlayerAction can't reintroduce the same bug: every caller
  // MUST send "" for a blank optional field, never omit the key.
  it("rejects a bare null for an optional field -- callers must send '' instead of omitting the key", () => {
    const result = addRoundPlayerSchema.safeParse({
      tripMemberId: VALID_TRIP_MEMBER_ID,
      teeSetName: null,
      playingHandicap: null,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing tripMemberId", () => {
    const result = addRoundPlayerSchema.safeParse({ tripMemberId: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a handicap outside the -10 to 54 range", () => {
    const result = addRoundPlayerSchema.safeParse({ tripMemberId: VALID_TRIP_MEMBER_ID, playingHandicap: "99.0" });
    expect(result.success).toBe(false);
  });
});
