import { describe, expect, it } from "vitest";
import { startQuickRoundSchema, quickRoundPlayerSchema } from "./quick-round";

const VALID_SELF_PLAYER = { kind: "self", displayName: "Taylor", teeSetName: "", playingHandicap: "" };

function validInput(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    courseId: "00000000-0000-0000-0000-000000000001",
    holeCount: "18",
    roundName: "Quick Round – Sep 15, 2026",
    roundDate: "2026-09-15",
    startTime: "08:00",
    players: JSON.stringify([VALID_SELF_PLAYER]),
    gameType: "",
    ...overrides,
  };
}

describe("quickRoundPlayerSchema", () => {
  it("accepts a player with no handicap on file -- gross scoring, never blocked", () => {
    const result = quickRoundPlayerSchema.safeParse(VALID_SELF_PLAYER);
    expect(result.success).toBe(true);
  });

  it("accepts a walk-up golfer added by name only", () => {
    const result = quickRoundPlayerSchema.safeParse({
      kind: "new",
      displayName: "Sam",
      teeSetName: "",
      playingHandicap: "",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a blank display name", () => {
    const result = quickRoundPlayerSchema.safeParse({ ...VALID_SELF_PLAYER, displayName: "" });
    expect(result.success).toBe(false);
  });
});

describe("startQuickRoundSchema", () => {
  it("accepts a normal 18-hole submission with the signed-in golfer only", () => {
    const result = startQuickRoundSchema.safeParse(validInput());
    expect(result.success).toBe(true);
  });

  it("accepts 9 holes", () => {
    const result = startQuickRoundSchema.safeParse(validInput({ holeCount: "9" }));
    expect(result.success).toBe(true);
  });

  it("rejects a hole count that isn't 9 or 18", () => {
    const result = startQuickRoundSchema.safeParse(validInput({ holeCount: "12" }));
    expect(result.success).toBe(false);
  });

  it("requires a course to be chosen", () => {
    const result = startQuickRoundSchema.safeParse(validInput({ courseId: "" }));
    expect(result.success).toBe(false);
  });

  it("rejects malformed players JSON instead of throwing (spec: course/course-picker failures should surface as a message, not crash)", () => {
    const result = startQuickRoundSchema.safeParse(validInput({ players: "{not valid json" }));
    expect(result.success).toBe(false);
  });

  it("rejects an empty player list", () => {
    const result = startQuickRoundSchema.safeParse(validInput({ players: JSON.stringify([]) }));
    expect(result.success).toBe(false);
  });

  it("accepts a chosen game type from the simple ad-hoc list", () => {
    const result = startQuickRoundSchema.safeParse(validInput({ gameType: "skins" }));
    expect(result.success).toBe(true);
  });

  it("accepts an empty game type ('Just Keep Score')", () => {
    const result = startQuickRoundSchema.safeParse(validInput({ gameType: "" }));
    expect(result.success).toBe(true);
  });

  it("rejects a game type outside the simple ad-hoc list", () => {
    const result = startQuickRoundSchema.safeParse(validInput({ gameType: "wolf" }));
    expect(result.success).toBe(false);
  });

  it("accepts multiple players, including added golfers with no account", () => {
    const result = startQuickRoundSchema.safeParse(
      validInput({
        players: JSON.stringify([
          VALID_SELF_PLAYER,
          { kind: "new", displayName: "Walk-up Golfer", teeSetName: "", playingHandicap: "" },
        ]),
      }),
    );
    expect(result.success).toBe(true);
  });
});
