import { z } from "zod";

// Mirrors public.side_game_type (see database.types.ts's generated
// Constants.public.Enums.side_game_type) -- kept as a plain list here
// rather than re-exported from side-game.ts because that file has no
// single exported array of every value, only per-format schemas.
export const GROUP_PRESET_GAME_TYPES = [
  "nassau",
  "skins",
  "wolf",
  "vegas",
  "quota",
  "nines",
  "twos",
  "match_play",
  "stroke_play",
  "stableford",
  "best_ball",
  "worst_ball",
  "shamble",
  "team_average",
  "low_ball_high_ball",
  "low_ball_low_total",
  "low_handicap_high_handicap",
  "one_gross_one_net",
  "lone_ranger",
  "cha_cha_cha",
  "custom",
] as const;

/**
 * Presets can be saved for these four formats today -- the ones the
 * daily-use revamp spec names by example ("Saturday Skins, Nassau,
 * Stableford, Team Match") and, not coincidentally, the four whose
 * create-game settings are simple enough (no fixed hitting order, no
 * fixed team size) to sensibly apply without a saved lineup. A preset
 * never saves *who* played -- only the format and its settings (bet
 * size, carryover, scoring metric) -- so applying one always asks the
 * fast-round flow to split whoever's playing today into fresh sides,
 * per "do not automatically reuse old teams."  Every other game type
 * is still fully available on a round's own Games step; it just isn't
 * saveable as a group preset yet (see the Phase 2 report's deferred
 * list).
 */
export const PRESET_GAME_TYPES = ["skins", "nassau", "stableford", "match_play"] as const;
export type PresetGameType = (typeof PRESET_GAME_TYPES)[number];

export const createGroupSchema = z.object({
  name: z.string().trim().min(1, "Group name is required").max(120),
  description: z.string().trim().max(500).optional().or(z.literal("")),
});
export type CreateGroupInput = z.infer<typeof createGroupSchema>;

export const updateGroupSchema = createGroupSchema;
export type UpdateGroupInput = z.infer<typeof updateGroupSchema>;

// Adding a saved golfer to a group -- deliberately close to
// addMemberManuallySchema (trip.ts): a name is the only thing actually
// required, since the whole point of a saved group is being able to
// add "the regular Saturday guys" without an email address for anyone
// who won't have an account.
export const addGroupMemberSchema = z.object({
  displayName: z.string().trim().min(1, "Name is required").max(120),
  email: z
    .union([z.string().trim().email("Enter a valid email address"), z.literal("")])
    .optional(),
  defaultHandicapIndex: z
    .union([z.coerce.number().min(-10).max(54), z.literal("")])
    .optional(),
  preferredTeeName: z.string().trim().max(60).optional().or(z.literal("")),
});
export type AddGroupMemberInput = z.infer<typeof addGroupMemberSchema>;

// Editing a saved golfer's own record (Golfers tab) -- same shape as
// adding one, since every field is editable after the fact. Changing
// these values only affects what a *future* round is pre-filled with;
// see the doc comment on golf_group_members.default_handicap_index --
// round_players.playing_handicap is a permanent per-round snapshot,
// never rewritten by this.
export const updateGroupMemberSchema = addGroupMemberSchema;
export type UpdateGroupMemberInput = z.infer<typeof updateGroupMemberSchema>;

const monetaryPresetFields = z.object({
  isMonetary: z.coerce.boolean().default(false),
  dollarValue: z
    .union([z.coerce.number().positive(), z.literal(""), z.undefined(), z.null()])
    .optional()
    .transform((v) => (v === "" || v === undefined || v === null ? null : v)),
});

/**
 * One schema per preset-able format, each mirroring the exact settings
 * fields its real create*GameAction (src/actions/side-games.ts) needs
 * -- applying a preset later (applyGamePresetToRoundAction,
 * src/actions/group-rounds.ts) replays these same settings straight
 * into that same action, so the game math is never re-implemented.
 * These are plain (unrefined) ZodObjects -- not `.refine()`ed
 * individually -- because zod's discriminatedUnion only accepts plain
 * object schemas as members; the shared monetary-value check is
 * applied once, after the union is assembled, below.
 */
export const createSkinsPresetSchema = z.object({
  name: z.string().trim().min(1, "Give this preset a name").max(120),
  sideGameType: z.literal("skins"),
  scoringMetric: z.enum(["gross", "net"]).default("net"),
  carryover: z.coerce.boolean().default(true),
}).merge(monetaryPresetFields);

export const createNassauPresetSchema = z.object({
  name: z.string().trim().min(1, "Give this preset a name").max(120),
  sideGameType: z.literal("nassau"),
  scoringMetric: z.enum(["gross", "net"]).default("net"),
}).merge(monetaryPresetFields);

export const createMatchPlayPresetSchema = createNassauPresetSchema.extend({
  sideGameType: z.literal("match_play"),
});

export const createStablefordPresetSchema = z.object({
  name: z.string().trim().min(1, "Give this preset a name").max(120),
  sideGameType: z.literal("stableford"),
}).merge(monetaryPresetFields);

export const createGroupGamePresetSchema = z
  .discriminatedUnion("sideGameType", [
    createSkinsPresetSchema,
    createNassauPresetSchema,
    createMatchPlayPresetSchema,
    createStablefordPresetSchema,
  ])
  .refine((data) => !data.isMonetary || data.dollarValue != null, {
    message: "Enter a dollar value for a monetary preset",
    path: ["dollarValue"],
  });
export type CreateGroupGamePresetInput = z.infer<typeof createGroupGamePresetSchema>;

export const createGroupSeasonSchema = z
  .object({
    name: z.string().trim().min(1, "Give this season a name").max(60),
    startDate: z.string().min(1, "Start date is required"),
    endDate: z.string().min(1, "End date is required"),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: "End date must be on or after the start date",
    path: ["endDate"],
  });
export type CreateGroupSeasonInput = z.infer<typeof createGroupSeasonSchema>;

export const createGroupInvitationSchema = z.object({
  email: z.union([z.string().trim().email("Enter a valid email address"), z.literal("")]).optional(),
  role: z.enum(["member", "guest"]).default("member"),
});
export type CreateGroupInvitationInput = z.infer<typeof createGroupInvitationSchema>;


/**
 * The fast Group Round start wizard (spec: "make starting a Group Round
 * extremely fast") submits its whole per-golfer roster as one JSON
 * blob rather than a dozen dynamically-named fields -- each entry
 * mirrors exactly what addRoundPlayerAction (src/actions/rounds.ts)
 * already accepts per golfer (teeSetName/playingHandicap), so applying
 * them just calls that same action once per selected golfer instead of
 * re-implementing the insert.
 */
const startFastGroupRoundPlayerSchema = z.object({
  memberId: z.string().uuid(),
  teeSetName: z.string().trim().max(60).optional().or(z.literal("")),
  playingHandicap: z.union([z.coerce.number().min(-10).max(54), z.literal("")]).optional(),
});

export const startFastGroupRoundSchema = z.object({
  courseId: z.string().uuid("Choose a course"),
  players: z
    .string()
    .min(1, "Select at least one golfer")
    .transform((s, ctx) => {
      try {
        return JSON.parse(s) as unknown;
      } catch {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid player selection" });
        return z.NEVER;
      }
    })
    .pipe(z.array(startFastGroupRoundPlayerSchema).min(1, "Select at least one golfer")),
  presetId: z.union([z.string().uuid(), z.literal("")]).optional(),
});
export type StartFastGroupRoundInput = z.infer<typeof startFastGroupRoundSchema>;
