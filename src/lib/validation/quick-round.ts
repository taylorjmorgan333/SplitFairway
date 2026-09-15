import { z } from "zod";
import { ROUND_HOLE_COUNT_VALUES, playingHandicapString } from "@/lib/validation/round";
import { PRESET_GAME_TYPES } from "@/lib/validation/group";

/**
 * One golfer in the Quick Round setup screen's player list (spec item
 * 2: the signed-in golfer is always included automatically; "Add
 * Golfer" appends a walk-up golfer by name only, mirroring
 * addNewGolferToRoundSchema's shape). "kind" tells the server action
 * whether to reuse the caller's own trip_member (self) or create a
 * brand-new one via add_trip_member_manually (new) -- see
 * startQuickRoundSetupAction.
 */
export const quickRoundPlayerSchema = z.object({
  kind: z.enum(["self", "new"]),
  displayName: z.string().trim().min(1, "Name is required").max(120),
  teeSetName: z.string().trim().max(80).optional().or(z.literal("")),
  playingHandicap: playingHandicapString.optional().or(z.literal("")),
});
export type QuickRoundPlayerInput = z.infer<typeof quickRoundPlayerSchema>;

/**
 * The Quick Round setup screen's single submit (spec item 5: "one
 * screen ... one large sticky button: Start Scoring. No separate
 * Review step."). Every golfer is submitted as one JSON blob, same
 * pattern as startFastGroupRoundSchema (validation/group.ts) --
 * applying them just calls addRoundPlayerAction once per golfer
 * instead of re-implementing the insert. gameType is one of the four
 * simple, no-saved-lineup-required formats (PRESET_GAME_TYPES) or ""
 * for "Just Keep Score" -- a fuller game setup stays available from the
 * scorecard after the round begins (spec item 4).
 */
export const startQuickRoundSchema = z.object({
  courseId: z.string().uuid("Choose a course"),
  holeCount: z.coerce
    .number()
    .refine((n) => ROUND_HOLE_COUNT_VALUES.includes(n as 9 | 18), { message: "Choose 9 or 18 holes" }),
  roundName: z.string().trim().max(120).optional().or(z.literal("")),
  roundDate: z.string().min(1, "Choose a date"),
  startTime: z.string().optional().or(z.literal("")),
  players: z
    .string()
    .min(1, "Add at least one golfer")
    .transform((s, ctx) => {
      try {
        return JSON.parse(s) as unknown;
      } catch {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid player list" });
        return z.NEVER;
      }
    })
    .pipe(z.array(quickRoundPlayerSchema).min(1, "Add at least one golfer")),
  gameType: z.union([z.enum(PRESET_GAME_TYPES), z.literal("")]).optional(),
});
export type StartQuickRoundInput = z.infer<typeof startQuickRoundSchema>;
