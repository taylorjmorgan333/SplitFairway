import { describe, expect, it } from "vitest";
import { buildAddRoundPlayerFormData } from "./round-player-form-data";
import { addRoundPlayerSchema } from "@/lib/validation/round";

const TRIP_MEMBER_ID = "11111111-1111-1111-1111-111111111111";

/**
 * Regression coverage for the "Couldn't add any golfers to this round"
 * bug: FormData.get() returns `null` for an unset key, but
 * addRoundPlayerSchema's optional fields only accept `undefined` or `""`,
 * never a bare `null`. Every scenario below builds the exact FormData
 * that startQuickRoundSetupAction / startFastGroupRoundAction hand to
 * addRoundPlayerAction, then re-parses it the same way that action does
 * (via addRoundPlayerSchema.safeParse against formData.get() values) to
 * confirm no golfer is ever silently dropped.
 */
function parseAsAddRoundPlayerAction(fd: FormData) {
  return addRoundPlayerSchema.safeParse({
    tripMemberId: fd.get("tripMemberId"),
    teeSetName: fd.get("teeSetName"),
    playingHandicap: fd.get("playingHandicap"),
  });
}

describe("buildAddRoundPlayerFormData", () => {
  it("Quick Round: blank handicap (string schema) still validates -- golfer is not dropped", () => {
    // Quick Round's quickRoundPlayerSchema types playingHandicap as string | undefined.
    const fd = buildAddRoundPlayerFormData(TRIP_MEMBER_ID, {
      teeSetName: "White",
      playingHandicap: undefined,
    });
    expect(fd.get("playingHandicap")).toBe("");
    const result = parseAsAddRoundPlayerAction(fd);
    expect(result.success).toBe(true);
  });

  it("Quick Round: blank optional tee still validates -- golfer is not dropped", () => {
    const fd = buildAddRoundPlayerFormData(TRIP_MEMBER_ID, {
      teeSetName: undefined,
      playingHandicap: "12.3",
    });
    expect(fd.get("teeSetName")).toBe("");
    const result = parseAsAddRoundPlayerAction(fd);
    expect(result.success).toBe(true);
  });

  it("Group Round: blank handicap (numeric-or-empty schema) still validates -- golfer is not dropped", () => {
    // Group Round's startFastGroupRoundPlayerSchema types playingHandicap
    // as number | "" | undefined -- exercise both possible blank shapes.
    for (const blank of ["" as const, undefined]) {
      const fd = buildAddRoundPlayerFormData(TRIP_MEMBER_ID, {
        teeSetName: "Blue",
        playingHandicap: blank,
      });
      expect(fd.get("playingHandicap")).toBe("");
      const result = parseAsAddRoundPlayerAction(fd);
      expect(result.success).toBe(true);
    }
  });

  it("Group Round: blank optional tee still validates -- golfer is not dropped", () => {
    const fd = buildAddRoundPlayerFormData(TRIP_MEMBER_ID, {
      teeSetName: null,
      playingHandicap: 8,
    });
    expect(fd.get("teeSetName")).toBe("");
    const result = parseAsAddRoundPlayerAction(fd);
    expect(result.success).toBe(true);
  });

  it("mixed golfers: some with handicaps, some without -- none are silently dropped", () => {
    const golfers: Array<{ label: string; teeSetName?: string | null; playingHandicap?: string | number | null }> = [
      { label: "self, full handicap", teeSetName: "White", playingHandicap: "14.2" },
      { label: "guest, no handicap on file", teeSetName: "White", playingHandicap: "" },
      { label: "scratch golfer (numeric 0, must survive ?? coalescing)", teeSetName: "Blue", playingHandicap: 0 },
      { label: "no tee chosen yet", teeSetName: undefined, playingHandicap: 9 },
      { label: "nothing set at all", teeSetName: null, playingHandicap: null },
    ];

    const results = golfers.map((g) => {
      const fd = buildAddRoundPlayerFormData(TRIP_MEMBER_ID, g);
      return { label: g.label, result: parseAsAddRoundPlayerAction(fd) };
    });

    for (const { label, result } of results) {
      expect(result.success, `${label} should validate successfully`).toBe(true);
    }

    // The scratch (0) handicap must be preserved, not coalesced away like a blank.
    const scratch = buildAddRoundPlayerFormData(TRIP_MEMBER_ID, { playingHandicap: 0 });
    expect(scratch.get("playingHandicap")).toBe("0");
  });

  it("never omits the teeSetName or playingHandicap keys, even when both inputs are absent", () => {
    const fd = buildAddRoundPlayerFormData(TRIP_MEMBER_ID, {});
    // FormData.has() confirms the key itself was set(), not merely that
    // its value happens to be falsy -- this is the exact distinction
    // between the fixed behavior and the original bug (an omitted key
    // reads back as `null` via get(), which is what broke validation).
    expect(fd.has("teeSetName")).toBe(true);
    expect(fd.has("playingHandicap")).toBe(true);
    expect(fd.get("teeSetName")).toBe("");
    expect(fd.get("playingHandicap")).toBe("");

    const result = parseAsAddRoundPlayerAction(fd);
    expect(result.success).toBe(true);
  });

  it("always sets tripMemberId", () => {
    const fd = buildAddRoundPlayerFormData(TRIP_MEMBER_ID, {});
    expect(fd.get("tripMemberId")).toBe(TRIP_MEMBER_ID);
  });
});
